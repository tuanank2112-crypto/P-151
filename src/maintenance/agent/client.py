"""Model clients of the reasoning Agent (plan 06, SPEC-P01 section 4.2, TESTING section 2).

`openai_json_client` is the only code that talks to a model: an OpenAI-compatible chat call (DeepSeek, OpenRouter,
OpenAI) in JSON mode, one attempt (`max_retries=0`), `temperature=0`. The fake clients are what every test uses, so
no test ever reaches a network.
"""

import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import threading
import time
from collections import OrderedDict
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any, Literal, Protocol

from src.maintenance.catalog import Catalog, Lexicon

from .baseline import mirror_decision
from .inputs import DecisionInput
from .schema import AgentDecision


@dataclass(frozen=True)
class ClientReply:
    text: str
    latency_ms: float
    usage: dict[str, int] | None = None


class DecisionClient(Protocol):
    def __call__(self, system: str, user: str, data: DecisionInput) -> ClientReply:
        """`data` is only for the fake clients; the real client ignores it."""
        ...


_FENCE = re.compile(r"```(?:json)?", re.IGNORECASE)


def _strip_to_json_object(text: str) -> str:
    """prompt_only mode: drop ``` fences and keep the text from the first "{" to the last "}"."""
    text = _FENCE.sub("", text)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end < start:
        return text.strip()
    return text[start : end + 1]


def openai_json_client(
    model: str,
    api_key: str,
    base_url: str | None,
    *,
    timeout: float,
    max_output_tokens: int,
    json_mode: Literal["json_object", "prompt_only"],
    stream: bool = False,
    reasoning_effort: str = "",
) -> DecisionClient:
    """`stream=True` keeps bytes flowing while the model writes: a proxy that cuts a silent connection (vyceai.com
    behind Cloudflare answers 504 after ~12-15 s) still delivers the whole JSON. `timeout` then bounds the whole call,
    not only the wait between chunks, so a slow trickle cannot hold the request open."""
    import openai  # imported here so the module loads (and tests run) without touching the SDK

    sdk = openai.OpenAI(api_key=api_key, base_url=base_url or None, timeout=timeout, max_retries=0)

    def call(system: str, user: str, data: DecisionInput) -> ClientReply:
        kwargs: dict[str, Any] = {
            "model": model,
            "temperature": 0,
            "max_tokens": max_output_tokens,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }
        if json_mode == "json_object":
            kwargs["response_format"] = {"type": "json_object"}
        if (
            reasoning_effort
        ):  # a thinking model writes hidden reasoning tokens first; "low" halves them (deepseek-v4-flash)
            kwargs["reasoning_effort"] = reasoning_effort
        started = time.perf_counter()
        if stream:
            chunks = sdk.chat.completions.create(**kwargs, stream=True, stream_options={"include_usage": True})
            text, raw_usage = _read_stream(chunks, started, timeout)
        else:
            reply = sdk.chat.completions.create(**kwargs)
            text, raw_usage = reply.choices[0].message.content or "", getattr(reply, "usage", None)
        latency_ms = (time.perf_counter() - started) * 1000
        if json_mode == "prompt_only":
            text = _strip_to_json_object(text)
        return ClientReply(text=text, latency_ms=latency_ms, usage=_usage(raw_usage))

    return call


def claude_cli_client(
    model: str,
    *,
    timeout: float,
    effort: str = "",
    json_schema: Mapping[str, Any] | None = None,
    cli_path: str | None = None,
) -> DecisionClient:
    """Local development and demo only: one `claude -p` call per decision, signed in with the subscription of the
    person running this backend. Do NOT use it for a deployed service that serves other people (Anthropic consumer
    terms: a personal plan is for personal use; a shared service needs an API key).

    The CLI runs in an empty temporary directory (no repo CLAUDE.md), with no tools, no MCP servers, no slash
    commands and no saved session; `--system-prompt` replaces the default one. The reply text goes through the same
    fence stripping as `prompt_only`; with `json_schema` the CLI enforces the shape and `structured_output` is used.
    `effort` ("low" …) limits hidden thinking. A non-zero exit, `is_error` or unreadable output raises (the Agent then
    falls back to the rules); `subprocess.TimeoutExpired` becomes a TIMEOUT fallback."""
    executable = cli_path or shutil.which("claude") or "claude"
    workdir = tempfile.mkdtemp(prefix="mo-agent-cli-")

    def call(system: str, user: str, data: DecisionInput) -> ClientReply:
        args = [
            executable,
            "-p",
            "--output-format",
            "json",
            "--model",
            model,
            "--tools",
            "",
            "--strict-mcp-config",
            "--no-session-persistence",
            "--disable-slash-commands",
            "--system-prompt",
            system,
        ]
        if effort:
            args += ["--effort", effort]
        if json_schema is not None:
            args += ["--json-schema", json.dumps(json_schema, ensure_ascii=False)]
        started = time.perf_counter()
        proc = subprocess.run(
            args, input=user, capture_output=True, text=True, encoding="utf-8", timeout=timeout, cwd=workdir
        )
        latency_ms = (time.perf_counter() - started) * 1000
        if proc.returncode != 0:
            raise RuntimeError(f"claude CLI exit {proc.returncode}: {(proc.stderr or proc.stdout)[:300]}")
        out = json.loads(proc.stdout)
        if out.get("is_error"):
            raise RuntimeError(f"claude CLI error: {str(out.get('result'))[:300]}")
        raw = out.get("usage") or {}
        cached = int(raw.get("cache_read_input_tokens") or 0)
        prompt_tokens = int(raw.get("input_tokens") or 0) + cached + int(raw.get("cache_creation_input_tokens") or 0)
        completion = int(raw.get("output_tokens") or 0)
        usage = {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion,
            "total_tokens": prompt_tokens + completion,
            "prompt_cache_hit_tokens": cached,
        }
        structured = out.get("structured_output")
        if isinstance(structured, dict):
            text = json.dumps(structured, ensure_ascii=False)
        else:
            text = _strip_to_json_object(str(out.get("result") or ""))
        return ClientReply(text=text, latency_ms=latency_ms, usage=usage)

    return call


def agy_cli_client(
    model: str,
    *,
    timeout: float,
    effort: str = "",
    json_schema: Mapping[str, Any] | None = None,
    cli_path: str | None = None,
) -> DecisionClient:
    """Local development and demo only, like `claude_cli_client`: one `agy -p` call (Antigravity CLI, e.g. a Gemini
    Flash model) per decision, signed in with the operator's own plan — not for a service that serves other people.

    `agy` has no flag to replace its system prompt or to turn tools off, so the Agent's system prompt is sent at the
    top of the prompt, the CLI runs in an empty temporary directory with `--sandbox` and without auto-approval (a
    tool request in print mode is never approved). Pick a model explicitly: the default one may sit on a smaller
    quota. A non-zero exit or `status != SUCCESS` raises (the Agent falls back to the rules)."""
    executable = cli_path or shutil.which("agy") or "agy"
    workdir = tempfile.mkdtemp(prefix="mo-agent-agy-")

    def call(system: str, user: str, data: DecisionInput) -> ClientReply:
        prompt_text = f"{system}\n\n=== PHẢN ÁNH CẦN QUYẾT ĐỊNH ===\n{user}"
        args = [
            executable,
            "-p",
            prompt_text,
            "--model",
            model,
            "--output-format",
            "json",
            "--sandbox",
            "--disable-slash-commands",
            "--print-timeout",
            f"{max(1, int(timeout))}s",
        ]
        if effort:
            args += ["--effort", effort]
        if json_schema is not None:
            args += ["--json-schema", json.dumps(json_schema, ensure_ascii=False)]
        started = time.perf_counter()
        proc = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", timeout=timeout + 5, cwd=workdir)
        latency_ms = (time.perf_counter() - started) * 1000
        try:
            out = json.loads(proc.stdout)
        except ValueError as exc:
            raise RuntimeError(f"agy exit {proc.returncode}: {(proc.stderr or proc.stdout)[:300]}") from exc
        if proc.returncode != 0 or out.get("status") != "SUCCESS":
            raise RuntimeError(f"agy {out.get('status')} (exit {proc.returncode}): {str(out.get('error'))[:300]}")
        raw = out.get("usage") or {}
        cached = int(raw.get("cache_read_tokens") or 0)
        prompt_tokens = int(raw.get("input_tokens") or 0)
        completion = int(raw.get("output_tokens") or 0) + int(raw.get("thinking_tokens") or 0)
        usage = {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion,
            "total_tokens": prompt_tokens + completion,
            "prompt_cache_hit_tokens": cached,
        }
        structured = out.get("structured_output")
        if isinstance(structured, dict):
            text = json.dumps(structured, ensure_ascii=False)
        else:
            text = _strip_to_json_object(str(out.get("response") or ""))
        return ClientReply(text=text, latency_ms=latency_ms, usage=usage)

    return call


def _usage(raw: Any) -> dict[str, int] | None:
    """Token counts, plus the provider's prompt-cache counters when it reports them (DeepSeek: the stable system
    prompt is a cached prefix, so `prompt_cache_hit_tokens` shows whether the prefix cache works)."""
    if raw is None:
        return None
    usage = {
        "prompt_tokens": int(raw.prompt_tokens),
        "completion_tokens": int(raw.completion_tokens),
        "total_tokens": int(raw.total_tokens),
    }
    for name in ("prompt_cache_hit_tokens", "prompt_cache_miss_tokens"):
        value = getattr(raw, name, None)
        if isinstance(value, int):
            usage[name] = value
    return usage


def _read_stream(chunks: Any, started: float, timeout: float) -> tuple[str, Any]:
    """Joins the content deltas; the last chunk that carries `usage` wins. Past `timeout` seconds -> TimeoutError."""
    parts: list[str] = []
    usage = None
    try:
        for chunk in chunks:
            if time.perf_counter() - started > timeout:
                raise TimeoutError(f"model stream exceeded {timeout:g} s")
            if getattr(chunk, "usage", None) is not None:
                usage = chunk.usage
            for choice in getattr(chunk, "choices", None) or ():
                content = getattr(choice.delta, "content", None)
                if content:
                    parts.append(content)
    finally:
        close = getattr(chunks, "close", None)
        if callable(close):
            close()
    return "".join(parts), usage


class CachingClient:
    """Reuses the reply to an identical request (same system prompt and user message, so the same ticket, content,
    candidates and locks) for `ttl_seconds`, keeping at most `max_entries` replies (least recently used goes first).

    Only a reply that is a valid `AgentDecision` is kept: an outage, a cut stream or a malformed reply is asked again.
    A hit makes no model call and reports latency 0 and usage {"cache_hit": 1}. The model call itself runs outside
    the cache lock, so two concurrent misses may both call the model; the later reply simply replaces the earlier."""

    def __init__(
        self,
        inner: DecisionClient,
        *,
        max_entries: int,
        ttl_seconds: float,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.inner = inner
        self.max_entries = max_entries
        self.ttl_seconds = ttl_seconds
        self._clock = clock
        self._entries: OrderedDict[str, tuple[float, str]] = OrderedDict()
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    def __call__(self, system: str, user: str, data: DecisionInput) -> ClientReply:
        key = hashlib.sha256(f"{system}\x00{user}".encode()).hexdigest()
        with self._lock:
            entry = self._entries.get(key)
            if entry is not None and self._clock() - entry[0] <= self.ttl_seconds:
                self._entries.move_to_end(key)
                self.hits += 1
                return ClientReply(text=entry[1], latency_ms=0.0, usage={"cache_hit": 1})
            self._entries.pop(key, None)
            self.misses += 1
        reply = self.inner(system, user, data)
        if _is_decision(reply.text):
            with self._lock:
                self._entries[key] = (self._clock(), reply.text)
                self._entries.move_to_end(key)
                while len(self._entries) > self.max_entries:
                    self._entries.popitem(last=False)
        return reply


def _is_decision(text: str) -> bool:
    try:
        AgentDecision.model_validate_json(text)
    except ValueError:
        return False
    return True


# ------------------------------------------------------------------------------------------------ fake clients


class ScriptedClient:
    """The first key that is a substring of `data.report_text` wins; an exception value is raised; no key matches
    -> `default`, and with no default an AssertionError (a test forgot a script, so it must not pass silently)."""

    def __init__(self, replies: Mapping[str, str | BaseException], default: str | BaseException | None = None):
        self.replies = dict(replies)
        self.default = default

    def __call__(self, system: str, user: str, data: DecisionInput) -> ClientReply:
        for key, reply in self.replies.items():
            if key in data.report_text:
                return self._answer(reply)
        if self.default is None:
            raise AssertionError("ScriptedClient: không có kịch bản")
        return self._answer(self.default)

    @staticmethod
    def _answer(reply: str | BaseException) -> ClientReply:
        if isinstance(reply, BaseException):
            raise reply
        return ClientReply(text=reply, latency_ms=0.0)


class MirrorClient:
    """Answers with the decision the fixed rules would make (`baseline.mirror_decision`)."""

    def __init__(self, catalog: Catalog, lexicon: Lexicon):
        self.catalog = catalog
        self.lexicon = lexicon

    def __call__(self, system: str, user: str, data: DecisionInput) -> ClientReply:
        decision = mirror_decision(data, self.catalog, self.lexicon)
        return ClientReply(text=decision.model_dump_json(), latency_ms=0.0)


class FailingClient:
    """timeout -> TimeoutError; http -> RuntimeError("HTTP 500"); garbage -> not JSON; schema -> JSON of the wrong shape."""

    def __init__(self, kind: Literal["timeout", "http", "garbage", "schema"]):
        self.kind = kind

    def __call__(self, system: str, user: str, data: DecisionInput) -> ClientReply:
        if self.kind == "timeout":
            raise TimeoutError("model timeout")
        if self.kind == "http":
            raise RuntimeError("HTTP 500")
        if self.kind == "garbage":
            return ClientReply(text="không phải json", latency_ms=0.0)
        return ClientReply(text='{"schema_version": "agent-decision/1"}', latency_ms=0.0)


class LockProbeClient:
    """Records, at every call, whether the engine lock is held and the transaction depth (I-16), then delegates."""

    def __init__(self, engine: Any, inner: Callable[[str, str, DecisionInput], ClientReply]):
        self.engine = engine
        self.inner = inner
        self.observations: list[tuple[bool, int]] = []

    def __call__(self, system: str, user: str, data: DecisionInput) -> ClientReply:
        self.observations.append((bool(self.engine.lock._is_owned()), int(getattr(self.engine._local, "tx_depth", 0))))
        return self.inner(system, user, data)


class CountingClient:
    """Counts the calls (I-24), then delegates."""

    def __init__(self, inner: Callable[[str, str, DecisionInput], ClientReply]):
        self.inner = inner
        self.calls = 0

    def __call__(self, system: str, user: str, data: DecisionInput) -> ClientReply:
        self.calls += 1
        return self.inner(system, user, data)

"""Model clients of the reasoning Agent (plan 06, SPEC-P01 section 4.2, TESTING section 2).

`openai_json_client` is the only code that talks to a model: an OpenAI-compatible chat call (DeepSeek, OpenRouter,
OpenAI) in JSON mode, one attempt (`max_retries=0`), `temperature=0`. The fake clients are what every test uses, so
no test ever reaches a network.
"""

import re
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any, Literal, Protocol

from src.maintenance.catalog import Catalog, Lexicon

from .baseline import mirror_decision
from .inputs import DecisionInput


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
) -> DecisionClient:
    import openai  # imported here so the module loads (and tests run) without touching the SDK

    sdk = openai.OpenAI(api_key=api_key, base_url=base_url or None, timeout=timeout, max_retries=0)

    def call(system: str, user: str, data: DecisionInput) -> ClientReply:
        kwargs: dict[str, Any] = {
            "model": model,
            "temperature": 0,
            "max_tokens": max_output_tokens,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }
        if model == "gpt-6-luna":
            # Luna rejects max_tokens. Use the verified non-reasoning chat path
            # so the output budget is available for the decision JSON.
            kwargs.pop("temperature")
            kwargs.pop("max_tokens")
            kwargs["max_completion_tokens"] = max_output_tokens
            kwargs["reasoning_effort"] = "none"
        if json_mode == "json_object":
            kwargs["response_format"] = {"type": "json_object"}
        started = time.perf_counter()
        reply = sdk.chat.completions.create(**kwargs)
        latency_ms = (time.perf_counter() - started) * 1000
        text = reply.choices[0].message.content or ""
        if json_mode == "prompt_only":
            text = _strip_to_json_object(text)
        raw_usage = getattr(reply, "usage", None)
        usage = (
            {
                "prompt_tokens": int(raw_usage.prompt_tokens),
                "completion_tokens": int(raw_usage.completion_tokens),
                "total_tokens": int(raw_usage.total_tokens),
            }
            if raw_usage is not None
            else None
        )
        return ClientReply(text=text, latency_ms=latency_ms, usage=usage)

    return call


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

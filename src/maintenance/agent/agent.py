"""The reasoning Agent: one model call per decision, validated, reconciled with the fixed rules (plan 06, SPEC-P01).

`decide()` never raises because of the model: every failure becomes a `FALLBACK_RULE` record (I-21). A programming
error (TypeError, KeyError, a test double asserting) still raises. One call, no retry, `temperature=0`; every call is
written to `ai_logger`. The Agent keeps no state between two `decide()` calls apart from the compiled graph, the
prompt text and the client.
"""

import hashlib
import json
import re
import time
from collections.abc import Callable
from datetime import datetime
from typing import Any

from pydantic import ValidationError

from src.config import Settings
from src.maintenance.ai_logger import AILogStatus, ai_logger
from src.maintenance.catalog import Catalog, Lexicon
from src.maintenance.enums import RiskLevel

from .baseline import rule_view
from .client import CachingClient, DecisionClient, agy_cli_client, claude_cli_client, openai_json_client
from .graph import AgentState, GraphSteps, build_graph
from .inputs import DecisionInput
from .prompt import PROMPT_VERSION, render_system_prompt, render_user_message
from .reconcile import reconcile, rule_record
from .schema import AgentDecision, AgentDecisionRecord
from .validate import validate

MAX_REPORT_CHARS = 12000  # a longer report goes to the rules: cutting it could drop a safety signal (SPEC-P01 9)
_SECRET = re.compile(r"(sk-[A-Za-z0-9_\-]{6,}|Bearer\s+\S+)")


def _redact(text: str) -> str:
    return _SECRET.sub("[redacted]", text)


class ReasoningAgent:
    def __init__(
        self,
        client: DecisionClient | None,
        *,
        catalog: Catalog,
        lexicon: Lexicon,
        model_label: str,
        clock: Callable[[], datetime],
    ) -> None:
        self._client = client
        self.catalog = catalog
        self.lexicon = lexicon
        self.model_label = model_label
        self._clock = clock
        self._system = render_system_prompt(catalog, lexicon)  # once: it holds no per-report data
        digest = hashlib.sha256(self._system.encode("utf-8")).hexdigest()[:16]
        self._system_tag = f"{PROMPT_VERSION} sha256:{digest}"
        self._graph = build_graph(
            GraphSteps(
                rules=self._rules_node,
                llm=self._llm_node,
                parse=self._parse_node,
                validate=self._validate_node,
                reconcile=self._reconcile_node,
                finish_skip=self._finish_skip_node,
                fallback=self._fallback_node,
                after_rules=self._after_rules,
                after_llm=lambda state: "fallback" if state.get("error") else "parse",
                after_parse=lambda state: "fallback" if state.get("error") else "validate",
            )
        )

    # -------------------------------------------------------------------------------------------- public API

    def decide(self, data: DecisionInput) -> AgentDecisionRecord:
        return self._graph.invoke({"data": data})["record"]

    def fallback(self, data: DecisionInput, reason: str) -> AgentDecisionRecord:
        """A FALLBACK_RULE record with the rule evidence filled in. Pure: no model call, no log."""
        return rule_record(
            data,
            rule_view(data, self.catalog, self.lexicon),
            source="FALLBACK_RULE",
            reason=reason,
            clock=self._clock,
        )

    # -------------------------------------------------------------------------------------------- graph nodes

    def _rules_node(self, state: AgentState) -> dict[str, Any]:
        data = state["data"]
        view = rule_view(data, self.catalog, self.lexicon)
        update: dict[str, Any] = {"rules": view}
        if view.safety.risk_level == RiskLevel.EMERGENCY:
            return update  # the rules already stop it; the model is not asked (SPEC-P01 9)
        if len(data.report_text) > MAX_REPORT_CHARS:
            update["error"] = {"reason": "INPUT_TOO_LARGE", "latency_ms": 0.0, "log_id": None}
        elif self._client is None:
            update["error"] = {"reason": "HTTP_ERROR", "latency_ms": 0.0, "log_id": None}  # no model configured
        return update

    @staticmethod
    def _after_rules(state: AgentState) -> str:
        if state["rules"].safety.risk_level == RiskLevel.EMERGENCY:
            return "skip"
        return "fallback" if state.get("error") else "llm"

    def _log(self, data: DecisionInput, user: str, **fields: Any):
        return ai_logger.log(
            ticket_id=data.ticket_id,
            prompt_sent={"system": self._system_tag, "user": user},
            model_name=self.model_label,
            **fields,
        )

    def _llm_node(self, state: AgentState) -> dict[str, Any]:
        data = state["data"]
        user = render_user_message(data, self.catalog)
        started = time.perf_counter()
        try:
            reply = self._client(self._system, user, data)
        except AssertionError:
            raise  # a test double (or a bug) asserting: never turn it into a quiet fallback
        except Exception as exc:  # noqa: BLE001 - the model boundary: any failure means "use the rules"
            latency_ms = (time.perf_counter() - started) * 1000
            name = type(exc).__name__
            timed_out = isinstance(exc, TimeoutError) or "Timeout" in name
            if timed_out:
                status = AILogStatus.TIMEOUT
            elif "RateLimit" in name:
                status = AILogStatus.RATE_LIMIT
            else:
                status = AILogStatus.FALLBACK_RULE
            entry = self._log(
                data,
                user,
                latency_ms=latency_ms,
                status=status,
                error_message=f"{name}: {_redact(str(exc))}"[:500],
            )
            reason = "TIMEOUT" if timed_out else "HTTP_ERROR"
            return {"error": {"reason": reason, "latency_ms": latency_ms, "log_id": entry.log_id}}
        return {"reply": reply, "user": user}

    def _parse_node(self, state: AgentState) -> dict[str, Any]:
        data, reply, user = state["data"], state["reply"], state["user"]
        decision: AgentDecision | None = None
        reason, detail = None, ""
        try:
            payload = json.loads(reply.text)
        except (ValueError, TypeError, RecursionError) as exc:
            reason, detail = "INVALID_JSON", f"{type(exc).__name__}: {exc}"
        else:
            try:
                decision = AgentDecision.model_validate(payload)
            except ValidationError as exc:
                reason, detail = "SCHEMA_INVALID", f"{exc.error_count()} lỗi schema: {exc.errors()[0]['msg']}"
        entry = self._log(
            data,
            user,
            raw_output=reply.text[:20000],
            structured_output=decision.model_dump(mode="json") if decision else None,
            latency_ms=reply.latency_ms,
            status=AILogStatus.SUCCESS if decision else AILogStatus.SCHEMA_ERROR,
            error_message=_redact(detail)[:500] if detail else None,
            token_usage=reply.usage,
        )
        if decision is None:
            return {"error": {"reason": reason, "latency_ms": reply.latency_ms, "log_id": entry.log_id}}
        return {"decision": decision, "log_id": entry.log_id}

    def _validate_node(self, state: AgentState) -> dict[str, Any]:
        return {
            "validated": validate(
                state["decision"], state["data"], state["rules"], self.catalog, self.lexicon, self.model_label
            )
        }

    def _reconcile_node(self, state: AgentState) -> dict[str, Any]:
        return {
            "record": reconcile(
                state["decision"],
                state["data"],
                state["rules"],
                state["validated"],
                catalog=self.catalog,
                lexicon=self.lexicon,
                model=self.model_label,
                latency_ms=state["reply"].latency_ms,
                ai_log_id=state["log_id"],
                clock=self._clock,
            )
        }

    def _finish_skip_node(self, state: AgentState) -> dict[str, Any]:
        return {
            "record": rule_record(
                state["data"], state["rules"], source="SKIPPED_RULE_EMERGENCY", reason=None, clock=self._clock
            )
        }

    def _fallback_node(self, state: AgentState) -> dict[str, Any]:
        error = state["error"]
        return {
            "record": rule_record(
                state["data"],
                state["rules"],
                source="FALLBACK_RULE",
                reason=error["reason"],
                clock=self._clock,
                latency_ms=error["latency_ms"],
                ai_log_id=error["log_id"],
            )
        }


def build_agent(
    settings: Settings, catalog: Catalog, lexicon: Lexicon, clock: Callable[[], datetime]
) -> ReasoningAgent | None:
    """The Agent for this process, or None (the rules decide) unless the Agent is switched on (`MO_AGENT_ENABLED`)
    and either LLM_MODE=openai with a key or LLM_MODE=claude_cli / agy_cli (local development/demo only: the CLI
    signed in with the operator's own subscription). Building never calls the model and never logs the key."""
    if not settings.mo_agent_enabled:
        return None
    client: DecisionClient
    if settings.llm_mode == "claude_cli":
        client = claude_cli_client(
            settings.model_name,
            timeout=settings.mo_agent_timeout_seconds,
            effort=settings.mo_agent_reasoning_effort,
            json_schema=AgentDecision.model_json_schema(),
        )
    elif settings.llm_mode == "agy_cli":
        client = agy_cli_client(
            settings.model_name,
            timeout=settings.mo_agent_timeout_seconds,
            effort=settings.mo_agent_reasoning_effort,
            json_schema=AgentDecision.model_json_schema(),
        )
    elif settings.llm_mode == "openai" and settings.openai_api_key:
        client = openai_json_client(
            settings.model_name,
            settings.openai_api_key,
            settings.openai_base_url or None,
            timeout=settings.mo_agent_timeout_seconds,
            max_output_tokens=settings.mo_agent_max_output_tokens,
            json_mode=settings.mo_agent_json_mode,
            stream=settings.mo_agent_stream,
            reasoning_effort=settings.mo_agent_reasoning_effort,
        )
    else:
        return None
    if settings.mo_agent_cache_entries > 0:  # the same request (ticket, content, candidates, locks) is asked once
        client = CachingClient(
            client, max_entries=settings.mo_agent_cache_entries, ttl_seconds=settings.mo_agent_cache_ttl_seconds
        )
    return ReasoningAgent(client, catalog=catalog, lexicon=lexicon, model_label=settings.model_name, clock=clock)

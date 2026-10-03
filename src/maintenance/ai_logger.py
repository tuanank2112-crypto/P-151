"""In-memory thread-safe logger for LLM invocations in MaintenanceOps.

Maintains a sliding window of the most recent 100 AI log entries.
Designed for low-overhead logging, auditing, and real-time dashboard inspection.
"""

import threading
import uuid
from collections import deque
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class AILogStatus(StrEnum):
    """Execution status of an LLM call."""

    SUCCESS = "SUCCESS"  # Model responded successfully with valid schema
    FALLBACK_RULE = "FALLBACK_RULE"  # Model error/timeout -> Graceful fallback to deterministic rule
    SCHEMA_ERROR = "SCHEMA_ERROR"  # Model response failed schema validation
    RATE_LIMIT = "RATE_LIMIT"  # HTTP 429 quota exhausted
    TIMEOUT = "TIMEOUT"  # Request exceeded maximum allowable timeout


class AILogEntry(BaseModel):
    """Detailed record for an individual LLM prompt and response cycle."""

    log_id: str = Field(
        default_factory=lambda: f"ailog_{uuid.uuid4().hex[:12]}", description="Unique identifier for the log entry"
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="UTC timestamp when the request was initiated"
    )
    ticket_id: str = Field(
        default="PENDING", description="Associated ticket identifier (e.g. TK-20260930-001 or PENDING during ingest)"
    )
    prompt_sent: dict[str, str] = Field(
        ..., description="Payload sent to the model, containing system prompt and user input"
    )
    raw_output: str | None = Field(
        default=None, description="Raw completion text/JSON received from the model prior to parsing"
    )
    structured_output: dict[str, Any] | None = Field(
        default=None, description="Validated structured dictionary adhering to LLMAssessment schema"
    )
    model_name: str = Field(
        default="unknown", description="Identifier of the model used (e.g. gpt-4o-mini, gemini-1.5-flash)"
    )
    latency_ms: float = Field(default=0.0, ge=0.0, description="Round-trip latency in milliseconds")
    status: AILogStatus = Field(default=AILogStatus.SUCCESS, description="Execution status of the invocation")
    error_message: str | None = Field(default=None, description="Error details or exception message if the call failed")
    token_usage: dict[str, int] | None = Field(
        default=None, description="Token consumption metrics: prompt_tokens, completion_tokens, total_tokens"
    )


class InMemoryAILogger:
    """Thread-safe in-memory sliding window store for AI logs."""

    def __init__(self, max_capacity: int = 100):
        self._max_capacity = max_capacity
        self._logs: deque[AILogEntry] = deque(maxlen=max_capacity)
        self._lock = threading.Lock()

    def record(self, entry: AILogEntry) -> AILogEntry:
        """Add an AILogEntry in a thread-safe manner."""
        with self._lock:
            self._logs.appendleft(entry)  # Most recent first
        return entry

    def log(
        self,
        *,
        ticket_id: str = "PENDING",
        prompt_sent: dict[str, str],
        raw_output: str | None = None,
        structured_output: dict[str, Any] | None = None,
        model_name: str = "unknown",
        latency_ms: float = 0.0,
        status: AILogStatus = AILogStatus.SUCCESS,
        error_message: str | None = None,
        token_usage: dict[str, int] | None = None,
    ) -> AILogEntry:
        """Helper to create and append an AILogEntry in one call."""
        entry = AILogEntry(
            ticket_id=ticket_id,
            prompt_sent=prompt_sent,
            raw_output=raw_output,
            structured_output=structured_output,
            model_name=model_name,
            latency_ms=round(latency_ms, 2),
            status=status,
            error_message=error_message,
            token_usage=token_usage,
        )
        return self.record(entry)

    def get_logs(self, ticket_id: str | None = None, limit: int = 100) -> list[AILogEntry]:
        """Retrieve recent logs, optionally filtered by ticket_id."""
        with self._lock:
            items = list(self._logs)

        if ticket_id:
            items = [item for item in items if item.ticket_id == ticket_id]

        return items[:limit]

    def export_data(self, ticket_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        """Export logs as serializable dictionaries (for JSON endpoints or UI consumption)."""
        entries = self.get_logs(ticket_id=ticket_id, limit=limit)
        return [entry.model_dump(mode="json") for entry in entries]

    def stats(self) -> dict[str, Any]:
        """Compute summary statistics for the stored sliding window."""
        with self._lock:
            items = list(self._logs)

        total = len(items)
        if total == 0:
            return {
                "total_calls": 0,
                "success_count": 0,
                "fallback_count": 0,
                "error_count": 0,
                "avg_latency_ms": 0.0,
            }

        success = sum(1 for e in items if e.status == AILogStatus.SUCCESS)
        fallback = sum(1 for e in items if e.status == AILogStatus.FALLBACK_RULE)
        errors = sum(1 for e in items if e.status not in (AILogStatus.SUCCESS, AILogStatus.FALLBACK_RULE))
        avg_latency = round(sum(e.latency_ms for e in items) / total, 2)

        return {
            "total_calls": total,
            "success_count": success,
            "fallback_count": fallback,
            "error_count": errors,
            "avg_latency_ms": avg_latency,
        }

    def clear(self) -> None:
        """Clear all stored logs (e.g. during test setup or demo reset)."""
        with self._lock:
            self._logs.clear()


# Global singleton instance for application-wide use
ai_logger = InMemoryAILogger(max_capacity=100)


def record_ai_log(entry: AILogEntry) -> AILogEntry:
    """Convenience function to record an entry in the global logger."""
    return ai_logger.record(entry)


def get_ai_logs(ticket_id: str | None = None, limit: int = 100) -> list[AILogEntry]:
    """Convenience function to get entries from the global logger."""
    return ai_logger.get_logs(ticket_id=ticket_id, limit=limit)


def export_ai_logs(ticket_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    """Convenience function to export serializable log dictionaries."""
    return ai_logger.export_data(ticket_id=ticket_id, limit=limit)

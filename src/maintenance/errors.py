"""Engine errors that belong to the engine itself (plan 06 SPEC-P02 §1).

`EngineError`, `GuardError` and `NotFoundError` live with the store (`store.base`). These three moved out of
`engine.py` so the coordination mixins can raise them without importing the engine; `engine.py` re-exports them.
"""

from src.maintenance.store.base import EngineError, GuardError


class InvalidTransitionError(GuardError):
    code = "INVALID_TRANSITION"


class ActionDeniedError(EngineError):
    """Permission rejection (canonical code ACTION_DENIED). The denial itself is audited."""

    code = "ACTION_DENIED"


class AuditWriteError(EngineError):
    code = "AUDIT_WRITE_FAILED"

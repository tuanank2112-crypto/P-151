"""Engine errors that belong to the engine itself (plan 06 SPEC-P02 §1).

`EngineError`, `GuardError` and `NotFoundError` live with the store (`store.base`). These three moved out of
`engine.py` so the coordination mixins can raise them without importing the engine; `engine.py` re-exports them.
"""

from src.maintenance.store.base import EngineError, GuardError


class InvalidTransitionError(GuardError):
    code = "INVALID_TRANSITION"


class StockShortError(GuardError):
    """The warehouse holds less than a material request needs (plan 11 SPEC-P04 §2): 409 `STOCK_SHORT`."""

    code = "STOCK_SHORT"


class ActionDeniedError(EngineError):
    """Permission rejection (canonical code ACTION_DENIED). The denial itself is audited."""

    code = "ACTION_DENIED"


class AuditWriteError(EngineError):
    code = "AUDIT_WRITE_FAILED"


class InvalidRatingError(ValueError):
    """Rating tags or comment the catalog does not allow (plan 11 SPEC-P04 §4): the API answers 422."""

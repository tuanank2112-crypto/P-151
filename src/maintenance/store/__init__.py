"""Persistence layer for MaintenanceOps (plan #01): the `CaseRepository` contract and its implementations."""

from src.maintenance.store.base import (
    CaseRepository,
    ConcurrencyError,
    EngineError,
    GuardError,
    NotFoundError,
    StoreUnavailableError,
    Tx,
)
from src.maintenance.store.memory import InMemoryRepository

__all__ = [
    "CaseRepository",
    "ConcurrencyError",
    "EngineError",
    "GuardError",
    "InMemoryRepository",
    "NotFoundError",
    "StoreUnavailableError",
    "Tx",
]

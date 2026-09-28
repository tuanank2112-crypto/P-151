import pytest

from src.maintenance.engine import MaintenanceEngine


@pytest.fixture
def engine() -> MaintenanceEngine:
    """Fresh engine with the 12 fixture tickets ingested and proposed (nothing confirmed yet)."""
    e = MaintenanceEngine()
    e.reset()
    return e

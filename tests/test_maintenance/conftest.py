import pytest

from src.maintenance.engine import MaintenanceEngine
from tests.test_maintenance.helpers import MONDAY_9AM, Clock


@pytest.fixture
def engine() -> MaintenanceEngine:
    """Engine with the 12 fixture tickets replayed at their own created_at."""
    e = MaintenanceEngine()
    e.reset()
    return e


@pytest.fixture
def clock() -> Clock:
    return Clock(MONDAY_9AM)


@pytest.fixture
def fresh(clock) -> MaintenanceEngine:
    """Empty engine on a controllable clock, so duplicate checks and SLAs only see what the test creates."""
    e = MaintenanceEngine(clock=clock)
    e.reset(with_fixtures=False)
    return e

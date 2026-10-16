"""Unit tests for the in-memory AI Logger, proposer integration, and endpoints."""

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from src.api.auth import actor_header_allowed
from src.api.routers.maintenance import get_engine
from src.main import app
from src.maintenance.ai_logger import AILogStatus, InMemoryAILogger, ai_logger
from src.maintenance.engine import MaintenanceEngine
from src.maintenance.proposer import LLMAssessment, propose

QA_HEADERS = {"X-Actor-Id": "SIM-ACTOR-QA-01"}
BPTN_HEADERS = {"X-Actor-Id": "SIM-ACTOR-BPTN-01"}
RESIDENT_HEADERS = {"X-Actor-Id": "SIM-ACTOR-RESIDENT-01"}


@pytest.fixture(autouse=True)
def clean_ai_logger():
    """Ensure a clean AI logger state for every test."""
    ai_logger.clear()
    yield
    ai_logger.clear()


@pytest.fixture
def engine():
    e = MaintenanceEngine()
    e.reset()
    app.dependency_overrides[get_engine] = lambda: e
    yield e
    app.dependency_overrides.pop(get_engine, None)


@pytest.fixture
def client(engine):
    app.dependency_overrides[actor_header_allowed] = lambda: True
    yield TestClient(app)
    app.dependency_overrides.pop(actor_header_allowed, None)


# ------------------------------------------------------------------ InMemoryAILogger unit tests


def test_in_memory_logger_record_and_get():
    logger = InMemoryAILogger(max_capacity=10)
    entry = logger.log(
        ticket_id="TK-001",
        prompt_sent={"system": "sys", "user": "usr"},
        structured_output={"service_category": "KY_THUAT"},
        model_name="gpt-4o-mini",
        latency_ms=120.5,
        status=AILogStatus.SUCCESS,
    )

    assert entry.ticket_id == "TK-001"
    assert entry.latency_ms == 120.5
    assert entry.status == AILogStatus.SUCCESS

    logs = logger.get_logs()
    assert len(logs) == 1
    assert logs[0].log_id == entry.log_id

    # Filter by ticket_id
    assert len(logger.get_logs(ticket_id="TK-001")) == 1
    assert len(logger.get_logs(ticket_id="NON_EXISTENT")) == 0


def test_in_memory_logger_sliding_window():
    logger = InMemoryAILogger(max_capacity=5)
    for i in range(10):
        logger.log(
            ticket_id=f"TK-{i:03d}",
            prompt_sent={"user": f"prompt {i}"},
            latency_ms=10.0 + i,
        )

    logs = logger.get_logs()
    assert len(logs) == 5
    # Most recent first
    assert [entry.ticket_id for entry in logs] == ["TK-009", "TK-008", "TK-007", "TK-006", "TK-005"]


def test_in_memory_logger_thread_safety():
    logger = InMemoryAILogger(max_capacity=100)

    def write_log(idx: int):
        logger.log(
            ticket_id=f"TK-{idx}",
            prompt_sent={"user": f"concurrent test {idx}"},
            latency_ms=50.0,
        )

    with ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(write_log, range(50)))

    logs = logger.get_logs()
    assert len(logs) == 50


def test_in_memory_logger_stats_and_export():
    logger = InMemoryAILogger(max_capacity=10)
    logger.log(prompt_sent={"q": "1"}, latency_ms=100.0, status=AILogStatus.SUCCESS)
    logger.log(prompt_sent={"q": "2"}, latency_ms=200.0, status=AILogStatus.FALLBACK_RULE)
    logger.log(prompt_sent={"q": "3"}, latency_ms=300.0, status=AILogStatus.TIMEOUT)

    stats = logger.stats()
    assert stats["total_calls"] == 3
    assert stats["success_count"] == 1
    assert stats["fallback_count"] == 1
    assert stats["error_count"] == 1
    assert stats["avg_latency_ms"] == 200.0

    data = logger.export_data()
    assert len(data) == 3
    assert isinstance(data[0], dict)
    assert "log_id" in data[0]


# ------------------------------------------------------------------ Proposer integration tests


def test_propose_logs_success_invocation():
    mock_assessment = LLMAssessment(
        service_category="KY_THUAT",
        ticket_type="COMMON_AREA_LIGHTING",
        reason="Đèn hỏng cần sửa",
    )

    def mock_llm(description: str) -> LLMAssessment:
        return mock_assessment

    result = propose("Đèn sảnh tầng 1 chập chờn", llm=mock_llm, model_label="test-model", ticket_id="TK-TEST-PROPOSE")
    assert result.classification.service_category.value == "KY_THUAT"

    logs = ai_logger.get_logs()
    assert len(logs) == 1
    log = logs[0]
    assert log.ticket_id == "TK-TEST-PROPOSE"
    assert log.status == AILogStatus.SUCCESS
    assert log.model_name == "test-model"
    assert log.structured_output["service_category"] == "KY_THUAT"
    assert log.latency_ms >= 0


def test_propose_logs_fallback_on_exception():
    def failing_llm(description: str) -> LLMAssessment:
        raise TimeoutError("LLM API timed out")

    result = propose("Rác bẩn ở hành lang tầng 3", llm=failing_llm, model_label="fail-model", ticket_id="TK-FAIL")
    # Deterministic rule still categorizes it
    assert result.classification.service_category.value == "VE_SINH"

    logs = ai_logger.get_logs()
    assert len(logs) == 1
    log = logs[0]
    assert log.ticket_id == "TK-FAIL"
    assert log.status == AILogStatus.FALLBACK_RULE
    assert "TimeoutError" in (log.error_message or "")


# ------------------------------------------------------------------ API Endpoints tests


def test_api_get_ai_logs_permissions(client):
    # Non-staff resident is forbidden
    resp = client.get("/api/v1/mo/ai-logs", headers=RESIDENT_HEADERS)
    assert resp.status_code == 403

    # Staff (BPTN or QA) is allowed
    resp = client.get("/api/v1/mo/ai-logs", headers=BPTN_HEADERS)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_api_get_ai_logs_filtering(client):
    now = datetime.now(UTC)
    ai_logger.log(ticket_id="T1", prompt_sent={"q": "1"}, status=AILogStatus.SUCCESS)
    ai_logger.log(ticket_id="T2", prompt_sent={"q": "2"}, status=AILogStatus.FALLBACK_RULE)

    # Filter by status
    resp = client.get("/api/v1/mo/ai-logs?status=SUCCESS", headers=QA_HEADERS)
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["ticket_id"] == "T1"

    # Filter by ticket_id
    resp = client.get("/api/v1/mo/ai-logs?ticket_id=T2", headers=QA_HEADERS)
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["ticket_id"] == "T2"

    # Filter by time range
    since = (now - timedelta(minutes=5)).isoformat()
    until = (now + timedelta(minutes=5)).isoformat()
    resp = client.get("/api/v1/mo/ai-logs", params={"since": since, "until": until}, headers=QA_HEADERS)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_api_reset_ai_logs(client):
    ai_logger.log(ticket_id="T1", prompt_sent={"q": "1"})
    assert len(ai_logger.get_logs()) == 1

    # Non-QA cannot reset
    resp = client.post("/api/v1/mo/ai-logs/reset", headers=BPTN_HEADERS)
    assert resp.status_code == 403

    # QA can reset
    resp = client.post("/api/v1/mo/ai-logs/reset", headers=QA_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["message"] == "Đã reset dữ liệu AI logs"
    assert len(ai_logger.get_logs()) == 0


def test_latency_log_appends_one_json_line_without_prompt(tmp_path, monkeypatch):
    path = tmp_path / "logs" / "latency.jsonl"
    monkeypatch.setenv("MO_LATENCY_LOG", str(path))
    logger = InMemoryAILogger()
    logger.log(
        ticket_id="TK-1",
        prompt_sent={"system": "secret"},
        model_name="m",
        latency_ms=12.345,
        token_usage={"prompt_tokens": 100, "completion_tokens": 7, "total_tokens": 107},
    )
    lines = path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1
    row = json.loads(lines[0])
    assert row["ticket_id"] == "TK-1" and row["latency_ms"] == 12.35 and row["status"] == "SUCCESS"
    assert (row["prompt_tokens"], row["completion_tokens"], row["total_tokens"]) == (100, 7, 107)
    assert "secret" not in lines[0]


def test_latency_log_off_and_unwritable_never_raise(tmp_path, monkeypatch):
    monkeypatch.setenv("MO_LATENCY_LOG", "off")
    InMemoryAILogger().log(prompt_sent={"system": "x"})
    assert not list(tmp_path.iterdir())
    blocker = tmp_path / "file"
    blocker.write_text("x")
    monkeypatch.setenv("MO_LATENCY_LOG", str(blocker / "latency.jsonl"))
    InMemoryAILogger().log(prompt_sent={"system": "x"})  # parent is a file -> OSError swallowed

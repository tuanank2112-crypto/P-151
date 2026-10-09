"""Plan 12 (planning/12_2026-10-09_backend-latency, TESTING §1): photo routes off the event loop, one transaction per
photo batch, photo byte cache, gzip. Memory store; the Postgres read engine is tested in test_read_engine.py (--pg)."""

import asyncio
import threading
import time

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from src.api import photos
from src.api.auth import actor_header_allowed
from src.api.routers.maintenance import get_engine
from src.main import app
from src.maintenance.engine import MaintenanceEngine
from src.maintenance.enums import Action, EvidenceType
from src.maintenance.store.photos import LocalPhotoStore

from .helpers import MONDAY_9AM, RESIDENT, Clock, dept_of, report

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
FRESH = "Sảnh thang máy tầng 9 tòa S2 nhiều rác, cần vệ sinh."  # no fixture ticket like it: ROUTED


class CountingStore:
    """Local photo store that counts calls and can be slow on put (a slow Supabase Storage)."""

    def __init__(self, inner: LocalPhotoStore, delay: float = 0.0):
        self.inner, self.delay = inner, delay
        self.puts = self.gets = self.deletes = 0
        self.lock = threading.Lock()

    def put(self, ref, data, media_type):
        with self.lock:
            self.puts += 1
        if self.delay:
            time.sleep(self.delay)  # blocking on purpose, like the httpx client of SupabasePhotoStore
        self.inner.put(ref, data, media_type)

    def get(self, ref):
        with self.lock:
            self.gets += 1
        return self.inner.get(ref)

    def delete(self, ref):
        with self.lock:
            self.deletes += 1
        self.inner.delete(ref)


@pytest.fixture
def engine():
    e = MaintenanceEngine(clock=Clock(MONDAY_9AM))
    e.reset()
    app.dependency_overrides[get_engine] = lambda: e
    app.dependency_overrides[actor_header_allowed] = lambda: True
    yield e
    app.dependency_overrides.pop(get_engine, None)
    app.dependency_overrides.pop(actor_header_allowed, None)


@pytest.fixture
def store(tmp_path, monkeypatch):
    s = CountingStore(LocalPhotoStore(tmp_path))
    monkeypatch.setattr(photos, "photo_store", lambda: s)
    getattr(photos, "clear_photo_cache", lambda: None)()
    yield s
    getattr(photos, "clear_photo_cache", lambda: None)()


def files(n: int):
    return [("files", (f"p{i}.png", PNG, "image/png")) for i in range(n)]


def routed(engine) -> str:
    return report(engine, FRESH)


def in_progress(engine) -> tuple[str, str]:
    tid = routed(engine)
    actor = dept_of(engine, tid)
    engine.accept(tid, actor)
    return tid, actor


# ---------------------------------------------------------------------- P1: the event loop keeps running


@pytest.mark.parametrize("who", ["resident", "department"])
@pytest.mark.asyncio
async def test_p1_upload_waiting_on_storage_does_not_freeze_the_server(engine, store, who):
    store.delay = 1.0
    if who == "resident":
        tid, actor = routed(engine), RESIDENT
        url = f"/api/v1/resident/tickets/{tid}/photos"
    else:
        tid, actor = in_progress(engine)
        url = f"/api/v1/mo/tickets/{tid}/photos"
    stop = asyncio.Event()

    async def ticker() -> float:
        """Longest pause of the event loop while the upload runs (≈ 10 ms when nothing blocks it)."""
        worst, last = 0.0, time.perf_counter()
        while not stop.is_set():
            await asyncio.sleep(0.01)
            now = time.perf_counter()
            worst, last = max(worst, now - last), now
        return worst

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t", headers={"X-Actor-Id": actor}) as ac:
        watch = asyncio.create_task(ticker())
        response = await ac.post(url, files=files(1))
        health = await ac.get("/health")
        stop.set()
        worst = await watch
    assert response.status_code == 200, response.text
    assert health.status_code == 200
    assert worst < 0.3, f"event loop paused {worst:.2f}s during the upload (blocking I/O in an async route)"


# ---------------------------------------------------------------------- P2–P4: one transaction, all or nothing


def test_p2_three_photos_are_one_mutate(engine, store, monkeypatch):
    tid = routed(engine)
    calls = []
    original = engine._mutate

    def spy(ticket_id, actor_id, action, *args, **kwargs):
        calls.append(action)
        return original(ticket_id, actor_id, action, *args, **kwargs)

    monkeypatch.setattr(engine, "_mutate", spy)
    api = TestClient(app, headers={"X-Actor-Id": RESIDENT})
    before = engine.get(tid)
    response = api.post(f"/api/v1/resident/tickets/{tid}/photos", files=files(3))
    assert response.status_code == 200, response.text
    after = engine.get(tid)
    assert calls.count(Action.ADD_RESIDENT_PHOTO) == 1
    assert len(after.evidence) - len(before.evidence) == 3
    audits = [a for a in after.audit[len(before.audit) :] if a.action == Action.ADD_RESIDENT_PHOTO]
    assert len(audits) == 3 and len(response.json()["photos"]) == 3
    assert len({e.evidence_id for e in after.evidence}) == len(after.evidence)


def test_p3_over_the_limit_stores_nothing(engine, store, tmp_path):
    tid = routed(engine)
    api = TestClient(app, headers={"X-Actor-Id": RESIDENT})
    assert api.post(f"/api/v1/resident/tickets/{tid}/photos", files=files(3)).status_code == 200
    before = engine.get(tid)
    response = api.post(f"/api/v1/resident/tickets/{tid}/photos", files=files(3))  # 2 places left
    assert response.status_code == 409
    assert len(engine.get(tid).evidence) == len(before.evidence)
    assert len(list(tmp_path.iterdir())) == 3


def test_p4_engine_refusal_discards_every_saved_photo(engine, store, tmp_path):
    tid = routed(engine)  # ROUTED, not accepted: execution photos are refused by the engine
    actor = dept_of(engine, tid)
    before = engine.get(tid)
    response = TestClient(app, headers={"X-Actor-Id": actor}).post(f"/api/v1/mo/tickets/{tid}/photos", files=files(2))
    assert response.status_code == 409
    assert len(engine.get(tid).evidence) == len(before.evidence)
    assert store.puts == 2 and store.deletes == 2 and list(tmp_path.iterdir()) == []


def test_p4b_department_batch_keeps_one_record_per_photo(engine, store):
    tid, actor = in_progress(engine)
    response = TestClient(app, headers={"X-Actor-Id": actor}).post(f"/api/v1/mo/tickets/{tid}/photos", files=files(2))
    assert response.status_code == 200, response.text
    shots = [
        e
        for e in engine.get(tid).evidence
        if e.evidence_type == EvidenceType.SIMULATED_IMAGE and e.content_or_metadata.endswith(".png")
    ]
    assert len(shots) == 2 and all(e.submitted_by == actor for e in shots)


# ---------------------------------------------------------------------- P5: photo cache, Z: gzip


def test_p5_second_view_of_a_photo_skips_the_store(engine, store):
    tid = routed(engine)
    api = TestClient(app, headers={"X-Actor-Id": RESIDENT})
    view = api.post(f"/api/v1/resident/tickets/{tid}/photos", files=files(1)).json()
    url = f"/api/v1/resident/tickets/{tid}/photos/{view['photos'][0]}"
    first = api.get(url, headers={"Accept-Encoding": "gzip"})
    second = api.get(url, headers={"Accept-Encoding": "gzip"})
    assert first.content == second.content == PNG
    assert store.gets == 1
    assert "immutable" in second.headers["cache-control"]
    assert second.headers.get("content-encoding", "identity") == "identity"


def test_p5b_discard_drops_the_cached_bytes(store):
    ref = photos.save(PNG, "png")
    assert photos.load(ref)[0] == PNG
    photos.discard(ref)
    with pytest.raises(Exception):
        photos.load(ref)


def test_z1_large_json_is_gzipped(engine, store):
    for floor in (4, 5, 6, 7):
        report(engine, f"Sảnh thang máy tầng {floor} tòa S2 nhiều rác, cần vệ sinh.")
    api = TestClient(app, headers={"X-Actor-Id": RESIDENT})
    plain = api.get("/api/v1/resident/tickets", headers={"Accept-Encoding": "identity"})
    zipped = api.get("/api/v1/resident/tickets", headers={"Accept-Encoding": "gzip"})
    assert len(plain.content) > 1024
    assert zipped.headers.get("content-encoding") == "gzip"
    assert zipped.json() == plain.json()


def test_z2_small_responses_are_not_gzipped():
    response = TestClient(app).get("/health", headers={"Accept-Encoding": "gzip"})
    assert response.status_code == 200 and "content-encoding" not in response.headers

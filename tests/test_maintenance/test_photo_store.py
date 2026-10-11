"""Photo storage (plan #01, SPEC-P02 §10: T15, T16, T17). Supabase is faked with httpx.MockTransport: no network."""

import json
import logging

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from src.api import photos
from src.api.auth import actor_header_allowed
from src.api.routers.maintenance import get_engine
from src.main import app
from src.maintenance.engine import MaintenanceEngine
from src.maintenance.store.photos import (
    LocalPhotoStore,
    PhotoNotFoundError,
    PhotoStoreError,
    SupabasePhotoStore,
    build_photo_store,
)

BASE = "https://example-ref.supabase.co"
BUCKET = "maintenance-photos"
REF = "0123456789abcdef0123456789abcdef.png"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
SECRET = "sb_secret_" + "fake-test-key"  # split so the G9 secret scan never matches a fake
RESIDENT = {"X-Actor-Id": "SIM-ACTOR-RESIDENT-01"}
CLN = {"X-Actor-Id": "SIM-ACTOR-DEPT-CLN-01"}


def supabase(responses, key: str = SECRET):
    """A store whose HTTP calls are answered from `responses` in order (a status, a Response, or an exception)."""
    sent: list[httpx.Request] = []
    sleeps: list[float] = []
    queue = list(responses)

    def handler(request: httpx.Request) -> httpx.Response:
        sent.append(request)
        answer = queue.pop(0)
        if isinstance(answer, Exception):
            raise answer
        if isinstance(answer, int):
            return httpx.Response(answer, content=b"[]" if request.method == "DELETE" else PNG)
        return answer

    store = SupabasePhotoStore(
        BASE, SecretStr(key), BUCKET, client=httpx.Client(transport=httpx.MockTransport(handler)), sleep=sleeps.append
    )
    return store, sent, sleeps


# ---------------------------------------------------------------------- T15 SupabasePhotoStore


def test_t15a_put_posts_the_object_without_upsert():
    store, sent, _ = supabase([200])
    store.put(REF, PNG, "image/png")
    [request] = sent
    assert request.method == "POST"
    assert str(request.url) == f"{BASE}/storage/v1/object/{BUCKET}/{REF}"
    assert request.headers["x-upsert"] == "false" and request.headers["content-type"] == "image/png"
    assert request.content == PNG


def test_t15b_get_returns_bytes_and_maps_not_found():
    store, _, _ = supabase(
        [200, 404, httpx.Response(400, json={"statusCode": "404", "error": "not_found", "message": "Object not found"})]
    )
    assert store.get(REF) == PNG
    with pytest.raises(PhotoNotFoundError):
        store.get(REF)
    with pytest.raises(PhotoNotFoundError):
        store.get(REF)


def test_t15c_auth_headers_depend_on_the_key_kind():
    store, sent, _ = supabase([200])
    store.get(REF)
    assert sent[0].headers["apikey"] == SECRET and "authorization" not in sent[0].headers
    store, sent, _ = supabase([200], key="eyJxyz")
    store.get(REF)
    assert sent[0].headers["apikey"] == "eyJxyz" and sent[0].headers["authorization"] == "Bearer eyJxyz"


def test_t15d_retries_5xx_twice_then_gives_up():
    store, sent, sleeps = supabase([503, 503, 200])
    store.put(REF, PNG, "image/png")
    assert len(sent) == 3 and sleeps == [0.5, 1.0]
    store, sent, _ = supabase([503, 503, 503])
    with pytest.raises(PhotoStoreError) as caught:
        store.put(REF, PNG, "image/png")
    assert caught.value.status == 503 and len(sent) == 3


def test_t15e_4xx_is_not_retried():
    store, sent, sleeps = supabase([httpx.Response(401, json={"message": "Invalid key"})])
    with pytest.raises(PhotoStoreError) as caught:
        store.put(REF, PNG, "image/png")
    assert caught.value.status == 401 and len(sent) == 1 and sleeps == []


def test_t15f_the_key_never_shows_in_errors_or_repr():
    store, _, _ = supabase([httpx.Response(401, json={"message": "Invalid key"})])
    with pytest.raises(PhotoStoreError) as caught:
        store.get(REF)
    assert SECRET not in str(caught.value) and SECRET not in repr(caught.value)
    assert SECRET not in repr(store)


def test_t15g_duplicate_on_a_retry_means_the_first_try_landed():
    store, sent, _ = supabase(
        [httpx.ReadTimeout("timed out"), httpx.Response(400, json={"error": "Duplicate", "message": "already exists"})]
    )
    store.put(REF, PNG, "image/png")
    assert len(sent) == 2
    store, _, _ = supabase([httpx.Response(400, json={"error": "Duplicate", "message": "already exists"})])
    with pytest.raises(PhotoStoreError):  # on the first try a duplicate is a real error
        store.put(REF, PNG, "image/png")


def test_t15h_delete_sends_prefixes_and_is_idempotent():
    store, sent, _ = supabase([200, 404])
    store.delete(REF)
    store.delete(REF)
    assert sent[0].method == "DELETE" and str(sent[0].url) == f"{BASE}/storage/v1/object/{BUCKET}"
    assert json.loads(sent[0].content) == {"prefixes": [REF]}


def test_supabase_store_needs_url_and_key():
    from src.config import get_settings

    settings = get_settings().model_copy(update={"mo_photo_store": "supabase", "supabase_url": ""})
    with pytest.raises(RuntimeError, match="SUPABASE_URL"):
        build_photo_store(settings)
    assert isinstance(build_photo_store(get_settings()), LocalPhotoStore)


# ---------------------------------------------------------------------- T16, T17 through the API


class RecordingStore:
    def __init__(self, fail_delete: bool = False, fail_put: bool = False):
        self.calls: list[tuple[str, str]] = []
        self.fail_delete = fail_delete
        self.fail_put = fail_put
        self.objects: dict[str, bytes] = {}

    def put(self, ref, data, media_type):
        self.calls.append(("put", ref))
        if self.fail_put:
            raise PhotoStoreError(503, ref, "unavailable")
        self.objects[ref] = data

    def get(self, ref):
        if ref not in self.objects:
            raise PhotoNotFoundError(ref)
        return self.objects[ref]

    def delete(self, ref):
        self.calls.append(("delete", ref))
        if self.fail_delete:
            raise PhotoStoreError(503, ref, "unavailable")
        self.objects.pop(ref, None)


@pytest.fixture
def api(tmp_path, monkeypatch):
    engine = MaintenanceEngine()
    engine.reset()
    monkeypatch.setattr(photos, "upload_dir", lambda: tmp_path)
    app.dependency_overrides[get_engine] = lambda: engine
    app.dependency_overrides[actor_header_allowed] = lambda: True
    yield engine, TestClient(app, headers={"X-Actor-Id": "SIM-ACTOR-QA-01"})
    app.dependency_overrides.pop(get_engine, None)
    app.dependency_overrides.pop(actor_header_allowed, None)


def _create(client) -> str:
    response = client.post(
        "/api/v1/resident/tickets",
        json={"original_description": "Cầu thang bộ tầng 4 tòa S2 nhiều rác"},
        headers=RESIDENT,
    )
    assert response.status_code == 201, response.text
    return response.json()["ticket_id"]


def _send_department_photo(client, tid):
    return client.post(f"/api/v1/mo/tickets/{tid}/photos", files=[("files", ("a.png", PNG, "image/png"))], headers=CLN)


def test_t16_refused_evidence_deletes_its_photo(api, monkeypatch, caplog):
    _, client = api
    tid = _create(client)
    store = RecordingStore()
    monkeypatch.setattr(photos, "photo_store", lambda: store)
    response = _send_department_photo(client, tid)  # ROUTED, not accepted: the engine refuses (409)
    assert response.status_code == 409
    [(_, ref)] = [call for call in store.calls if call[0] == "put"]
    assert store.calls.count(("delete", ref)) == 1

    store = RecordingStore(fail_delete=True)
    monkeypatch.setattr(photos, "photo_store", lambda: store)
    with caplog.at_level(logging.WARNING, logger="src.api.photos"):
        response = _send_department_photo(client, tid)
    assert response.status_code == 409  # the client still gets the original error
    [(_, ref)] = [call for call in store.calls if call[0] == "put"]
    assert any(ref in record.getMessage() for record in caplog.records)


def test_failed_upload_records_no_evidence(api, monkeypatch):
    engine, client = api
    tid = _create(client)
    monkeypatch.setattr(photos, "photo_store", lambda: RecordingStore(fail_put=True))
    response = client.post(
        f"/api/v1/resident/tickets/{tid}/photos", files=[("files", ("a.png", PNG, "image/png"))], headers=RESIDENT
    )
    assert response.status_code == 502 and response.json()["detail"]["code"] == "PHOTO_STORE_FAILED"
    assert engine.get(tid).evidence == []


def test_t17_photo_api_is_unchanged(api):
    engine, client = api
    tid = _create(client)
    view = client.post(
        f"/api/v1/resident/tickets/{tid}/photos", files=[("files", ("a.png", PNG, "image/png"))], headers=RESIDENT
    ).json()
    [photo] = view["photos"]
    for url, headers in (
        (f"/api/v1/resident/tickets/{tid}/photos/{photo}", RESIDENT),
        (f"/api/v1/mo/tickets/{tid}/photos/{photo}", CLN),
    ):
        response = client.get(url, headers=headers)
        assert response.status_code == 200 and response.content == PNG
        assert response.headers["content-type"] == "image/png"
        # plan 12 Q10 (R01 #2/#3): the browser keeps the bytes but asks every time (was max-age=3600, then immutable)
        assert response.headers["cache-control"] == "private, no-cache"
        assert response.headers["etag"] == f'"{engine.get(tid).evidence[0].content_or_metadata}"'

    case = engine.add_resident_photo(tid, "SIM-ACTOR-RESIDENT-01", "../../etc/passwd")
    bad = case.evidence[-1].evidence_id
    assert client.get(f"/api/v1/resident/tickets/{tid}/photos/{bad}", headers=RESIDENT).status_code == 404

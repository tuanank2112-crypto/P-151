"""Plan 11 (planning/11_2026-10-09_mobile-pwa-app, TESTING §1): the phone app is served at /app/ next to /ui/ and the API."""

import json
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.api.auth import AuthService, get_auth, load_accounts
from src.api.routers.maintenance import get_engine
from src.main import app
from src.maintenance.engine import MaintenanceEngine

SW = Path(__file__).resolve().parents[2] / "src" / "mobile" / "sw.js"


@pytest.fixture
def client():
    engine = MaintenanceEngine()
    engine.reset()
    auth = AuthService({a.username: a for a in load_accounts().accounts})
    app.dependency_overrides[get_engine] = lambda: engine
    app.dependency_overrides[get_auth] = lambda: auth
    yield TestClient(app)
    app.dependency_overrides.pop(get_engine, None)
    app.dependency_overrides.pop(get_auth, None)


def test_app_index_served(client):
    response = client.get("/app/")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert 'rel="manifest" href="manifest.json"' in response.text
    assert 'type="module" src="js/main.js' in response.text


def test_manifest_valid(client):
    response = client.get("/app/manifest.json")
    assert response.status_code == 200
    manifest = json.loads(response.text)
    assert manifest["start_url"] == "/app/"
    assert manifest["scope"] == "/app/"
    assert manifest["display"] == "standalone"
    sizes = {icon["sizes"] for icon in manifest["icons"]}
    assert {"192x192", "512x512"} <= sizes
    assert any(icon.get("purpose") == "maskable" for icon in manifest["icons"])
    for icon in manifest["icons"]:
        image = client.get(f"/app/{icon['src']}")
        assert image.status_code == 200, icon["src"]
        assert image.headers["content-type"] == "image/png"


def test_sw_served_as_js(client):
    response = client.get("/app/sw.js")
    assert response.status_code == 200
    assert "javascript" in response.headers["content-type"]


def test_sw_never_caches_api():
    """I-3: the fetch handler leaves /api/ to the network before it can answer anything from the cache."""
    source = SW.read_text(encoding="utf-8")
    handler = source[source.index("addEventListener('fetch'") :]
    bypass = re.search(r"if \(url\.pathname\.startsWith\('/api/'\)\) return;", handler)
    assert bypass is not None, "sw.js must return early for /api/ requests"
    assert bypass.start() < handler.index("respondWith"), "the /api/ bypass must come before any respondWith"


def test_existing_routes_unchanged(client):
    assert client.get("/health").status_code == 200
    login = client.post("/api/v1/auth/login", json={"username": "cudan01", "password": "Demo@2026"})
    assert login.status_code == 200
    assert login.json()["user"]["role"] == "RESIDENT"

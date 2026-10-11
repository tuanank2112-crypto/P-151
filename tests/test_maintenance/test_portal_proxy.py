"""Develop UI integration must keep Python routes and forward portal cookies/redirects."""

import httpx
import pytest
from fastapi.testclient import TestClient

import src.main as main


@pytest.fixture
def proxy(monkeypatch):
    seen = []

    def upstream(request):
        seen.append(request)
        return httpx.Response(
            302,
            headers=[
                ("location", "http://portal:3000/login"),
                ("set-cookie", "session=one; Path=/; HttpOnly"),
                ("set-cookie", "other=two; Path=/"),
            ],
            content=b"portal redirect",
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(upstream))
    monkeypatch.setattr(main, "PORTAL_URL", "http://portal:3000")
    monkeypatch.setattr(main, "_portal_client", client)
    return TestClient(main.app), seen


def test_portal_proxy_preserves_query_body_cookies_and_redirect(proxy):
    client, seen = proxy
    response = client.post("/login?from=technical", content=b"action=login", follow_redirects=False)
    assert response.status_code == 302
    assert response.headers["location"] == "/login"
    assert len(response.headers.get_list("set-cookie")) == 2
    assert seen[0].url == "http://portal:3000/login?from=technical"
    assert seen[0].content == b"action=login"


def test_python_routes_take_priority_over_portal(proxy):
    client, seen = proxy
    assert client.get("/health").status_code == 200
    assert client.get("/ui/").status_code == 200
    assert client.get("/app/").status_code == 200
    assert not seen


def test_portal_unavailable_keeps_python_ui_fallback(monkeypatch):
    def offline(request):
        raise httpx.ConnectError("offline", request=request)

    monkeypatch.setattr(main, "PORTAL_URL", "http://portal:3000")
    monkeypatch.setattr(main, "_portal_client", httpx.AsyncClient(transport=httpx.MockTransport(offline)))
    client = TestClient(main.app)
    assert client.get("/", follow_redirects=False).headers["location"] == "/ui/"
    assert client.get("/technical").status_code == 503

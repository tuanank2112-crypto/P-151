"""The portal proxy shares one httpx client between all visitors, so it must never store a cookie: otherwise the
session cookie of the last login is sent on a later request without cookies and that visitor gets the account."""

import httpx

import src.main as main


def _login_response(url: str) -> httpx.Response:
    return httpx.Response(200, headers={"set-cookie": "mo_session=secret; Path=/"}, request=httpx.Request("POST", url))


def test_the_shared_proxy_client_never_keeps_a_session_cookie(monkeypatch):
    monkeypatch.setattr(main, "PORTAL_URL", "http://portal.test")
    monkeypatch.setattr(main, "_portal_client", None)
    client = main._get_portal_client()
    client.cookies.extract_cookies(_login_response("http://portal.test/login"))
    assert len(client.cookies) == 0
    request = client.build_request("GET", "http://portal.test/management")
    assert "cookie" not in request.headers


def test_a_default_client_would_leak_it(monkeypatch):
    """Control: the same steps on a plain AsyncClient keep the cookie, so the test above is measuring something."""
    client = httpx.AsyncClient(base_url="http://portal.test")
    client.cookies.extract_cookies(_login_response("http://portal.test/login"))
    assert client.build_request("GET", "http://portal.test/management").headers.get("cookie") == "mo_session=secret"

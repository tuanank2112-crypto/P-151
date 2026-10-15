"""Login and sessions for the prototype (test accounts only, signed tokens).

Each account maps to one simulated actor, and the actor's role comes from the catalog, so an account can never act
outside its role. Passwords are stored as PBKDF2-SHA256 hashes. A session is a token signed with HMAC-SHA256 that
carries the username and its expiry (plan 26): any process holding `AUTH_TOKEN_SECRET` checks it, nothing is kept in
memory, so the serverless instances on Vercel (one per concurrent request, none sharing memory) agree on who is logged
in. Logout is remembered by the instance that received it until the token expires; the browser drops the token anyway.

`X-Actor-Id` (the old way to pick an actor) is only accepted when `MO_ALLOW_ACTOR_HEADER=true`; it is off by default
so the UI cannot be bypassed by setting a header.
"""

import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Annotated

import yaml
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field

from src.config import get_settings
from src.maintenance.catalog import FIXTURE_DIR

SESSION_TTL_SECONDS = 8 * 3600
TOKEN_VERSION = "v1"
MAX_FAILED_LOGINS = 5
LOCKOUT_SECONDS = 5 * 60
MAX_TRACKED_FAILURES = 10_000
PBKDF2_ITERATIONS = 200_000


class Profile(BaseModel):
    """Where a resident lives (shown by the portal; test data only)."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    tower: str
    floor: str
    apartment: str


class Account(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    username: str = Field(pattern=r"^[a-z0-9_.-]{3,32}$")
    display_name: str
    actor_id: str
    password_hash: str
    profile: Profile | None = None


class AccountFile(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    synthetic: bool
    shared_test_password: str | None = None  # shown on the login page outside production, test data only
    accounts: tuple[Account, ...]


@lru_cache
def load_accounts(path: Path = FIXTURE_DIR / "accounts.yaml") -> AccountFile:
    return AccountFile.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))


def hash_password(password: str, *, salt: bytes | None = None, iterations: int = PBKDF2_ITERATIONS) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt, expected = stored.split("$")
    except ValueError:
        return False
    if scheme != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations))
    return hmac.compare_digest(digest.hex(), expected)


_DUMMY_HASH = hash_password("timing-equaliser")
logger = logging.getLogger(__name__)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


@dataclass
class AuthService:
    """Signed-token sessions and the login throttle (the throttle and logouts are per process)."""

    accounts: dict[str, Account]
    clock: Callable[[], float] = time.monotonic  # login throttle only
    secret: bytes = field(default_factory=lambda: secrets.token_bytes(32))
    wall: Callable[[], float] = time.time  # token expiry: the same in every process
    revoked: dict[str, float] = field(default_factory=dict)  # nonce of a logged-out token -> its expiry
    # (username, client address) -> (count, locked_until). Keyed by client too, so failures from elsewhere
    # cannot lock the real user out of their own account.
    failures: dict[tuple[str, str], tuple[int, float]] = field(default_factory=dict)

    def login(self, username: str, password: str, client: str = "") -> tuple[str, Account]:
        now = self.clock()
        username = username.strip().lower()
        key = (username, client)
        count, locked_until = self.failures.get(key, (0, 0.0))
        if locked_until > now:
            raise HTTPException(status_code=429, detail="Đăng nhập sai quá nhiều lần. Thử lại sau vài phút.")
        account = self.accounts.get(username)
        # Always hash, so a wrong username takes as long as a wrong password
        ok = verify_password(password, account.password_hash if account else _DUMMY_HASH) and account is not None
        if not ok:
            if len(self.failures) >= MAX_TRACKED_FAILURES:  # bound memory: keep only live lockouts
                self.failures = {k: v for k, v in self.failures.items() if v[1] > now}
            count += 1
            self.failures[key] = (count, now + LOCKOUT_SECONDS if count >= MAX_FAILED_LOGINS else 0.0)
            raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không đúng")
        self.failures.pop(key, None)
        claims = {"u": account.username, "exp": int(self.wall()) + SESSION_TTL_SECONDS, "n": secrets.token_urlsafe(12)}
        payload = _b64(json.dumps(claims, separators=(",", ":")).encode())
        return f"{TOKEN_VERSION}.{payload}.{self._sign(payload)}", account

    def _sign(self, payload: str) -> str:
        return _b64(hmac.new(self.secret, f"{TOKEN_VERSION}.{payload}".encode(), hashlib.sha256).digest())

    def _claims(self, token: str) -> dict | None:
        """The claims of a token this key signed and that has not expired, else None (never raises)."""
        version, _, rest = token.partition(".")
        payload, _, signature = rest.partition(".")
        if (
            version != TOKEN_VERSION
            or not payload
            or not hmac.compare_digest(signature.encode(), self._sign(payload).encode())
        ):
            return None
        try:
            claims = json.loads(_unb64(payload))
        except ValueError:
            return None
        if not isinstance(claims, dict) or not isinstance(claims.get("exp"), int) or claims["exp"] <= self.wall():
            return None
        return claims

    def account_for(self, token: str) -> Account | None:
        claims = self._claims(token)
        if claims is None or claims.get("n") in self.revoked:
            return None
        return self.accounts.get(claims.get("u"))

    def logout(self, token: str) -> None:
        claims = self._claims(token)
        if claims is None:
            return
        now = self.wall()
        self.revoked = {n: exp for n, exp in self.revoked.items() if exp > now}  # forget what expired anyway
        self.revoked[claims["n"]] = claims["exp"]


_service: AuthService | None = None


def get_auth() -> AuthService:
    global _service
    if _service is None:
        secret = get_settings().auth_token_secret
        if not secret:
            logger.warning("AUTH_TOKEN_SECRET is not set: login tokens are valid in this process only")
        accounts = {a.username: a for a in load_accounts().accounts}
        _service = AuthService(accounts, secret=secret.encode()) if secret else AuthService(accounts)
    return _service


def actor_header_allowed() -> bool:
    return get_settings().mo_allow_actor_header


bearer = HTTPBearer(auto_error=False, description="Token nhận từ POST /api/v1/auth/login")


def get_actor(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    auth: Annotated[AuthService, Depends(get_auth)],
    header_allowed: Annotated[bool, Depends(actor_header_allowed)],
    x_actor_id: Annotated[str | None, Header(alias="X-Actor-Id", include_in_schema=False)] = None,
) -> str:
    """The actor behind the request: the logged-in account, or (tests only) the X-Actor-Id header."""
    if credentials is not None:
        account = auth.account_for(credentials.credentials)
        if account is None:
            raise HTTPException(
                status_code=401, detail="Phiên đăng nhập đã hết hạn", headers={"WWW-Authenticate": "Bearer"}
            )
        return account.actor_id
    if x_actor_id and header_allowed:
        return x_actor_id
    raise HTTPException(status_code=401, detail="Cần đăng nhập", headers={"WWW-Authenticate": "Bearer"})


# ------------------------------------------------------------------ routes

router = APIRouter(prefix="/auth", tags=["đăng nhập"])


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class Me(BaseModel):
    username: str
    display_name: str
    actor_id: str
    role: str
    department_id: str | None
    profile: Profile | None = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = SESSION_TTL_SECONDS
    user: Me


def _me(account: Account) -> Me:
    from src.api.routers.maintenance import get_engine  # avoid an import cycle at module load

    actor = get_engine().catalog.actor(account.actor_id)
    return Me(
        username=account.username,
        display_name=account.display_name,
        actor_id=account.actor_id,
        role=actor.actor_role.value,
        department_id=actor.department_id.value if actor.department_id else None,
        profile=account.profile,
    )


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, request: Request, auth: Annotated[AuthService, Depends(get_auth)]) -> LoginResponse:
    token, account = auth.login(body.username, body.password, request.client.host if request.client else "")
    return LoginResponse(access_token=token, user=_me(account))


@router.get("/me", response_model=Me)
def me(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    auth: Annotated[AuthService, Depends(get_auth)],
) -> Me:
    account = auth.account_for(credentials.credentials) if credentials else None
    if account is None:
        raise HTTPException(status_code=401, detail="Cần đăng nhập", headers={"WWW-Authenticate": "Bearer"})
    return _me(account)


@router.post("/logout", status_code=204)
def logout(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    auth: Annotated[AuthService, Depends(get_auth)],
) -> None:
    if credentials:
        auth.logout(credentials.credentials)


class DemoAccount(BaseModel):
    username: str
    display_name: str
    role: str


class DemoAccounts(BaseModel):
    shared_test_password: str | None
    accounts: list[DemoAccount]


@router.get("/demo-accounts", response_model=DemoAccounts)
def demo_accounts() -> DemoAccounts:
    """Test accounts for the login page. Disabled in production."""
    if get_settings().app_env == "production":
        raise HTTPException(status_code=404, detail="Not found")
    data = load_accounts()
    return DemoAccounts(
        shared_test_password=data.shared_test_password,
        accounts=[
            DemoAccount(username=a.username, display_name=a.display_name, role=_me(a).role) for a in data.accounts
        ],
    )

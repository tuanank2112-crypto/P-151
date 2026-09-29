"""Login and sessions for the prototype (test accounts only, in-memory sessions).

Each account maps to one simulated actor, and the actor's role comes from the catalog, so an account can never act
outside its role. Passwords are stored as PBKDF2-SHA256 hashes. Sessions are opaque random tokens kept in memory:
restarting the server logs everyone out.

`X-Actor-Id` (the old way to pick an actor) is only accepted when `MO_ALLOW_ACTOR_HEADER=true`; it is off by default
so the UI cannot be bypassed by setting a header.
"""

import hashlib
import hmac
import secrets
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Annotated

import yaml
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field

from src.config import get_settings
from src.maintenance.catalog import FIXTURE_DIR

SESSION_TTL_SECONDS = 8 * 3600
MAX_FAILED_LOGINS = 5
LOCKOUT_SECONDS = 5 * 60
PBKDF2_ITERATIONS = 200_000


class Account(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    username: str = Field(pattern=r"^[a-z0-9_.-]{3,32}$")
    display_name: str
    actor_id: str
    password_hash: str


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


@dataclass
class AuthService:
    """In-memory session store and login throttle."""

    accounts: dict[str, Account]
    clock: Callable[[], float] = time.monotonic
    sessions: dict[str, tuple[str, float]] = field(default_factory=dict)  # token -> (username, expires_at)
    failures: dict[str, tuple[int, float]] = field(default_factory=dict)  # username -> (count, locked_until)

    def login(self, username: str, password: str) -> tuple[str, Account]:
        now = self.clock()
        key = username.strip().lower()
        count, locked_until = self.failures.get(key, (0, 0.0))
        if locked_until > now:
            raise HTTPException(status_code=429, detail="Đăng nhập sai quá nhiều lần. Thử lại sau vài phút.")
        account = self.accounts.get(key)
        # Always hash, so a wrong username takes as long as a wrong password
        ok = verify_password(password, account.password_hash if account else _DUMMY_HASH) and account is not None
        if not ok:
            count += 1
            self.failures[key] = (count, now + LOCKOUT_SECONDS if count >= MAX_FAILED_LOGINS else 0.0)
            raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không đúng")
        self.failures.pop(key, None)
        token = secrets.token_urlsafe(32)
        self.sessions[token] = (account.username, now + SESSION_TTL_SECONDS)
        return token, account

    def account_for(self, token: str) -> Account | None:
        entry = self.sessions.get(token)
        if entry is None:
            return None
        username, expires_at = entry
        if expires_at <= self.clock():
            self.sessions.pop(token, None)
            return None
        return self.accounts.get(username)

    def logout(self, token: str) -> None:
        self.sessions.pop(token, None)


_service: AuthService | None = None


def get_auth() -> AuthService:
    global _service
    if _service is None:
        _service = AuthService({a.username: a for a in load_accounts().accounts})
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
    )


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, auth: Annotated[AuthService, Depends(get_auth)]) -> LoginResponse:
    token, account = auth.login(body.username, body.password)
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

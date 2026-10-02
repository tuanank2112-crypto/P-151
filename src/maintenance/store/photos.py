"""Photo bytes storage (plan #01, SPEC-P02): a local folder (MO_PHOTO_STORE=local) or Supabase Storage (supabase).

A `ref` is the name `src.api.photos` generated (`<32 hex>.<jpg|png|webp>`); in the bucket the object path is exactly
the `ref`. The browser never talks to Storage: the backend proxies the bytes so ticket permissions still apply.
The service key is a `SecretStr` and never goes into an exception, a log line or a `repr`.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING, Protocol

import httpx
from pydantic import SecretStr

if TYPE_CHECKING:
    from src.config import Settings

RETRY_DELAYS = (0.5, 1.0)  # transport errors and 5xx: two more tries
_NOT_FOUND_MARKERS = ("not_found", "Object not found")
_DUPLICATE_MARKERS = ("Duplicate", "already exists")


class PhotoNotFoundError(Exception):
    """No photo under this ref."""


class PhotoStoreError(Exception):
    """The store failed (after retries). Carries the HTTP status (None for a transport error), the ref and a reason."""

    def __init__(self, status: int | None, ref: str, reason: str) -> None:
        self.status = status
        self.ref = ref
        self.reason = reason[:200]
        super().__init__(f"Photo store failed (status={status}) for {ref}: {self.reason}")


class PhotoStore(Protocol):
    def put(self, ref: str, data: bytes, media_type: str) -> None: ...

    def get(self, ref: str) -> bytes: ...

    def delete(self, ref: str) -> None: ...


class LocalPhotoStore:
    """v0.5 behaviour byte for byte: one file per ref in one folder."""

    def __init__(self, directory: Path) -> None:
        self.directory = directory

    def put(self, ref: str, data: bytes, media_type: str) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        (self.directory / ref).write_bytes(data)

    def get(self, ref: str) -> bytes:
        path = self.directory / ref
        if not path.is_file():
            raise PhotoNotFoundError(ref)
        return path.read_bytes()

    def delete(self, ref: str) -> None:
        (self.directory / ref).unlink(missing_ok=True)


class SupabasePhotoStore:
    """Supabase Storage over its REST API (private bucket, service key)."""

    def __init__(
        self,
        url: str,
        key: SecretStr,
        bucket: str,
        *,
        client: httpx.Client | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._base = url.rstrip("/") + "/storage/v1"
        self._key = key
        self._bucket = bucket
        self._client = client or httpx.Client(timeout=httpx.Timeout(30.0, connect=5.0))
        self._sleep = sleep

    def __repr__(self) -> str:
        return f"SupabasePhotoStore(base={self._base!r}, bucket={self._bucket!r})"

    def _headers(self) -> dict[str, str]:
        key = self._key.get_secret_value()
        headers = {"apikey": key}
        if key.startswith("eyJ"):  # legacy JWT service_role key
            headers["Authorization"] = f"Bearer {key}"
        return headers

    def _send(
        self, ref: str, method: str, url: str, *, headers: dict[str, str] | None = None, **body
    ) -> tuple[httpx.Response, int]:
        """One request, retried on transport errors and 5xx. Returns the last response and the retry count used."""
        retries = 0
        while True:
            try:
                response = self._client.request(method, url, headers={**self._headers(), **(headers or {})}, **body)
            except httpx.TransportError as exc:
                if retries < len(RETRY_DELAYS):
                    self._sleep(RETRY_DELAYS[retries])
                    retries += 1
                    continue
                raise PhotoStoreError(None, ref, type(exc).__name__) from None
            if response.status_code >= 500 and retries < len(RETRY_DELAYS):
                self._sleep(RETRY_DELAYS[retries])
                retries += 1
                continue
            return response, retries

    def _object_url(self, ref: str) -> str:
        return f"{self._base}/object/{self._bucket}/{ref}"

    def put(self, ref: str, data: bytes, media_type: str) -> None:
        response, retries = self._send(
            ref,
            "POST",
            self._object_url(ref),
            headers={"Content-Type": media_type, "x-upsert": "false"},
            content=data,
        )
        if response.status_code == 200:
            return
        if retries and _duplicate(response):
            return  # an earlier try wrote it (the ref is 128 random bits, nobody else writes it)
        raise PhotoStoreError(response.status_code, ref, response.text)

    def get(self, ref: str) -> bytes:
        response, _ = self._send(ref, "GET", self._object_url(ref))
        if response.status_code == 200:
            return response.content
        if _not_found(response):
            raise PhotoNotFoundError(ref)
        raise PhotoStoreError(response.status_code, ref, response.text)

    def delete(self, ref: str) -> None:
        response, _ = self._send(ref, "DELETE", f"{self._base}/object/{self._bucket}", json={"prefixes": [ref]})
        if response.status_code == 200 or _not_found(response):
            return
        raise PhotoStoreError(response.status_code, ref, response.text)


def _not_found(response: httpx.Response) -> bool:
    if response.status_code == 404:
        return True
    return response.status_code == 400 and any(marker in response.text for marker in _NOT_FOUND_MARKERS)


def _duplicate(response: httpx.Response) -> bool:
    return response.status_code in (400, 409) and any(marker in response.text for marker in _DUPLICATE_MARKERS)


def build_photo_store(settings: Settings) -> PhotoStore:
    if settings.mo_photo_store == "supabase":
        if not settings.supabase_url or not settings.supabase_service_role_key.get_secret_value():
            raise RuntimeError("MO_PHOTO_STORE=supabase cần SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY")
        return SupabasePhotoStore(
            settings.supabase_url, settings.supabase_service_role_key, settings.supabase_storage_bucket
        )
    return LocalPhotoStore(Path(settings.mo_upload_dir))

"""Photo files for MaintenanceOps: residents may attach some, departments must send at least one.

Only the bytes live in the photo store (a local folder or Supabase Storage, MO_PHOTO_STORE); the engine keeps an
EvidenceRecord whose `content_or_metadata` is the name (`ref`) this module generated. The type is read from the
file's own bytes, never from the name or the Content-Type the client sent, and the name never comes from the client
either, so a stored name cannot point outside the folder or the bucket.
"""

import functools
import logging
import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from src.config import get_settings
from src.maintenance.store.photos import (
    LocalPhotoStore,
    PhotoNotFoundError,
    PhotoStore,
    PhotoStoreError,
    build_photo_store,
)

logger = logging.getLogger(__name__)

MAX_BYTES = 5 * 1024 * 1024
MAX_FILES_PER_REQUEST = 5

# magic bytes → (extension, media type)
_SIGNATURES = (
    (b"\xff\xd8\xff", "jpg", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "png", "image/png"),
)
_MEDIA_TYPES = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
_REF = re.compile(r"^[0-9a-f]{32}\.(jpg|png|webp)$")


def upload_dir() -> Path:
    path = Path(get_settings().mo_upload_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _sniff(head: bytes) -> str | None:
    for signature, extension, _ in _SIGNATURES:
        if head.startswith(signature):
            return extension
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


async def read_photos(files: list[UploadFile]) -> list[tuple[bytes, str]]:
    """Validate every file before anything is stored, so one bad file rejects the whole request."""
    if not files:
        raise HTTPException(status_code=422, detail="Chưa chọn ảnh nào")
    if len(files) > MAX_FILES_PER_REQUEST:
        raise HTTPException(status_code=422, detail=f"Mỗi lần gửi tối đa {MAX_FILES_PER_REQUEST} ảnh")
    photos = []
    for file in files:
        data = await file.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=413, detail=f"Ảnh {file.filename} lớn hơn 5 MB")
        extension = _sniff(data[:12])
        if extension is None:
            raise HTTPException(status_code=415, detail=f"{file.filename} không phải ảnh JPG, PNG hoặc WEBP")
        photos.append((data, extension))
    return photos


@functools.lru_cache(maxsize=1)
def _remote_store() -> PhotoStore:
    return build_photo_store(get_settings())


def photo_store() -> PhotoStore:
    """Supabase: one client per process. Local: built on every call, so tests can monkeypatch `upload_dir`."""
    if get_settings().mo_photo_store == "supabase":
        return _remote_store()
    return LocalPhotoStore(upload_dir())


def check_photo_store() -> None:
    """Startup: a missing Supabase URL/key stops the app (RuntimeError). Configuration only, no network call."""
    photo_store()


def new_ref(extension: str) -> str:
    return f"{uuid.uuid4().hex}.{extension}"


def save(data: bytes, extension: str) -> str:
    ref = new_ref(extension)
    try:
        photo_store().put(ref, data, _MEDIA_TYPES[extension])
    except PhotoStoreError as exc:
        logger.warning("photo save failed: %s", exc)
        raise HTTPException(
            status_code=502, detail={"code": "PHOTO_STORE_FAILED", "message": "Không lưu được ảnh, thử lại sau"}
        ) from exc
    return ref


def discard(ref: str) -> None:
    """Best effort: a photo whose evidence was refused is deleted; a failure only leaves an orphan, logged."""
    if not _REF.match(ref):
        return
    try:
        photo_store().delete(ref)
    except PhotoStoreError:
        logger.warning("photo discard failed ref=%s", ref)


def load(ref: str) -> tuple[bytes, str]:
    """Bytes and media type of a stored photo; 404 for anything this module did not write."""
    match = _REF.match(ref)
    if match is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh")
    try:
        data = photo_store().get(ref)
    except PhotoNotFoundError:
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh") from None
    except PhotoStoreError as exc:
        logger.warning("photo load failed: %s", exc)
        raise HTTPException(
            status_code=502, detail={"code": "PHOTO_STORE_FAILED", "message": "Không tải được ảnh, thử lại sau"}
        ) from exc
    return data, _MEDIA_TYPES[match.group(1)]

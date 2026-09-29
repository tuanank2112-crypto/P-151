"""Photo files for MaintenanceOps: residents may attach some, departments must send at least one.

Only the file lives on disk; the engine keeps an EvidenceRecord whose `content_or_metadata` is the file name this
module generated. The type is read from the file's own bytes, never from the name or the Content-Type the client
sent, and the file name never comes from the client either, so a stored name cannot point outside the folder.
"""

import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from src.config import get_settings

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


def save(data: bytes, extension: str) -> str:
    ref = f"{uuid.uuid4().hex}.{extension}"
    (upload_dir() / ref).write_bytes(data)
    return ref


def discard(ref: str) -> None:
    if _REF.match(ref):
        (upload_dir() / ref).unlink(missing_ok=True)


def locate(ref: str) -> tuple[Path, str]:
    """Path and media type of a stored photo; 404 for anything this module did not write."""
    match = _REF.match(ref)
    path = upload_dir() / ref if match else None
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh")
    return path, _MEDIA_TYPES[match.group(1)]

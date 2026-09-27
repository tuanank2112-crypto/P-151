"""Evidence storage and hard-rule completeness check. No LLM involved."""

import hashlib
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from src.config import get_settings
from src.models.entities import Evidence, WorkOrder
from src.models.schemas import CheckIssue, CheckResult

ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/heic": ".heic"}


async def save_photo(work_order: WorkOrder, kind: str, upload: UploadFile) -> Evidence:
    settings = get_settings()
    if upload.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"'{upload.filename}': chỉ nhận ảnh {', '.join(ALLOWED_IMAGE_TYPES)}",
        )
    data = await upload.read()
    if not data:
        raise HTTPException(status_code=422, detail=f"'{upload.filename}' rỗng")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"'{upload.filename}' vượt quá {settings.max_upload_mb} MB")

    folder = Path(settings.upload_dir) / f"wo_{work_order.id}"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{kind}_{uuid.uuid4().hex[:12]}{ALLOWED_IMAGE_TYPES[upload.content_type]}"
    path.write_bytes(data)
    return Evidence(
        work_order_id=work_order.id,
        kind=kind,
        file_path=str(path),
        content_type=upload.content_type,
        size_bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
    )


def check_evidence(work_order: WorkOrder, evidence: list[Evidence]) -> CheckResult:
    issues: list[CheckIssue] = []
    by_kind: dict[str, list[Evidence]] = {}
    for item in evidence:
        by_kind.setdefault(item.kind, []).append(item)

    labels = {"before": "ảnh trước khi sửa", "after": "ảnh sau khi sửa"}
    for kind in work_order.required_photos:
        if not by_kind.get(kind):
            issues.append(CheckIssue(code=f"missing_photo_{kind}", message=f"Thiếu {labels.get(kind, kind)}"))

    before_hashes = {e.sha256 for e in by_kind.get("before", [])}
    if any(e.sha256 in before_hashes for e in by_kind.get("after", [])):
        issues.append(CheckIssue(code="same_photo", message="Ảnh sau trùng hệt ảnh trước"))

    done = set(work_order.checklist_done)
    for item in work_order.checklist:
        if item["code"] not in done:
            issues.append(CheckIssue(code=f"checklist_{item['code']}", message=f"Chưa tick checklist: {item['label']}"))

    if work_order.requires_materials and not work_order.materials_used:
        issues.append(CheckIssue(code="missing_materials", message="Chưa khai báo vật tư đã dùng"))

    return CheckResult(passed=not issues, issues=issues)

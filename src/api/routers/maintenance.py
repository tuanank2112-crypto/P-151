"""MaintenanceOps Agent v0.6 candidate API (CR-BPTN-03; simulated data; MO_STORE=memory or postgres).

Three routers over one engine:
  /mo        internal: demo control, Agent/department/BPTN/warehouse/system actions, full case
  /resident  what a resident sees and may do (public fields only)
  /bql       BQL dashboard, emergencies, and the only close / rework / cancel actions

The caller is the logged-in account (`Authorization: Bearer <token>` from /api/v1/auth/login); its role comes from
the simulated actor catalog. Reads are scoped too: a department only sees tickets handed to it, the warehouse only
tickets waiting for material, residents only their own tickets (via /resident), and demo control is QA-only.
"""

import threading
from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field, ValidationError, field_validator

from src.api import photos
from src.api.auth import get_actor
from src.config import get_settings
from src.maintenance.ai_logger import AILogEntry, AILogStatus, ai_logger
from src.maintenance.demo import EvaluationReport, evaluate, run_fixture
from src.maintenance.engine import (
    MAX_EXECUTION_PHOTOS,
    MAX_RESIDENT_PHOTOS,
    ActionDeniedError,
    AuditWriteError,
    EngineError,
    GuardError,
    MaintenanceEngine,
    NotFoundError,
    build_engine,
    execution_photos,
    resident_photos,
    seed_if_empty,
)
from src.maintenance.enums import (
    Action,
    ActorRole,
    ChecklistStatus,
    Department,
    EvidenceType,
    Priority,
    ReadabilityStatus,
    ReasonCode,
    RiskLevel,
    ServiceCategory,
    TicketStatus,
)
from src.maintenance.messages import status_label
from src.maintenance.models import AuditEvent, Case, Notification, PlannedMaterial, StatusEvent
from src.maintenance.store.base import ConcurrencyError, StorePermissionError, StoreUnavailableError
from src.maintenance.views import (
    BqlTicketRow,
    ResidentTicketView,
    bql_rows,
    resident_view,
)

router = APIRouter(prefix="/mo", tags=["maintenance-ops (nội bộ)"])
resident_router = APIRouter(prefix="/resident", tags=["cư dân"])
bql_router = APIRouter(prefix="/bql", tags=["BQL"])

_engine: MaintenanceEngine | None = None
_engine_lock = threading.Lock()


def get_engine() -> MaintenanceEngine:
    global _engine
    if _engine is None:
        with _engine_lock:  # two first requests must not build two engines
            if _engine is None:
                settings = get_settings()
                engine = build_engine(settings)
                if settings.mo_seed_on_empty:
                    seed_if_empty(engine)  # never wipes: a persistent store keeps its tickets across restarts
                _engine = engine
    return _engine


EngineDep = Annotated[MaintenanceEngine, Depends(get_engine)]
ActorDep = Annotated[str, Depends(get_actor)]

STAFF = {ActorRole.BPTN, ActorRole.DEPARTMENT, ActorRole.WAREHOUSE, ActorRole.BQL, ActorRole.QA_INTERNAL}


def _call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except ActionDeniedError as exc:
        raise HTTPException(status_code=403, detail={"message": exc.message, **exc.detail}) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message) from exc
    except GuardError as exc:
        raise HTTPException(
            status_code=409, detail={"code": exc.code, "message": exc.message, **_plain(exc.detail)}
        ) from exc
    except ConcurrencyError as exc:
        raise HTTPException(status_code=409, detail={"code": exc.code, "message": exc.message}) from exc
    except StoreUnavailableError as exc:
        raise HTTPException(status_code=503, detail={"code": exc.code, "message": exc.message}) from exc
    except StorePermissionError as exc:
        raise HTTPException(status_code=403, detail={"code": exc.code, "message": exc.message}) from exc
    except AuditWriteError as exc:
        raise HTTPException(status_code=500, detail={"code": exc.code, "message": exc.message}) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors(include_url=False)) from exc
    except EngineError as exc:
        raise HTTPException(status_code=500, detail={"code": exc.code, "message": exc.message}) from exc


def _require_reset_allowed() -> None:
    """Reset and evaluate wipe the store: on a shared database only when MO_ALLOW_RESET=true."""
    settings = get_settings()
    if settings.mo_store != "memory" and not settings.mo_allow_reset:
        raise HTTPException(
            status_code=403,
            detail={"code": "RESET_DISABLED", "message": "Reset bị tắt trên DB dùng chung (MO_ALLOW_RESET=false)"},
        )


def _plain(detail: dict[str, Any]) -> dict[str, Any]:
    return {k: v.isoformat() if isinstance(v, datetime) else v for k, v in detail.items()}


def _require_role(engine: MaintenanceEngine, actor_id: str, *roles: ActorRole) -> ActorRole:
    role = engine.catalog.actor_role(actor_id)
    if role not in roles:
        allowed = ", ".join(roles)
        raise HTTPException(status_code=403, detail={"code": "ACTION_DENIED", "message": f"Chỉ {allowed}"})
    return role


def _visible(engine: MaintenanceEngine, actor_id: str, case: Case) -> bool:
    """Who may read a ticket's internal detail."""
    actor = engine.catalog.actor(actor_id)
    ticket = case.ticket
    if actor.actor_role == ActorRole.DEPARTMENT:
        return ticket.department_id is not None and ticket.department_id == actor.department_id
    if actor.actor_role == ActorRole.WAREHOUSE:
        return ticket.blocker is not None and ticket.blocker.code == ReasonCode.WAITING_MATERIAL
    return actor.actor_role in (ActorRole.BPTN, ActorRole.BQL, ActorRole.QA_INTERNAL)


def _staff_case(engine: MaintenanceEngine, actor_id: str, ticket_id: str) -> Case:
    _require_role(engine, actor_id, *STAFF)
    case = _call(engine.get, ticket_id)
    if not _visible(engine, actor_id, case):
        raise HTTPException(status_code=404, detail=f"Không có ticket {ticket_id}")  # do not reveal it exists
    return case


def _no_placeholder(value: str | None) -> str | None:
    if value is not None and value.strip().lower() == "string":
        raise ValueError('"string" là giá trị mẫu của Swagger, không phải dữ liệu thật')
    return value


class NoteBody(BaseModel):
    model_config = {"extra": "forbid"}

    note: str | None = None

    @field_validator("note")
    @classmethod
    def _check(cls, value: str | None) -> str | None:
        return _no_placeholder(value)


class RequiredNoteBody(NoteBody):
    note: str = Field(min_length=1)


PhotoFiles = Annotated[list[UploadFile], File(description="Ảnh JPG, PNG hoặc WEBP, tối đa 5 MB mỗi ảnh")]


async def _attach_photos(files: list[UploadFile], room: int, limit: int, attach) -> Case:
    """Validate all files, then store and record them one by one. A file whose record is refused is deleted."""
    batch = await photos.read_photos(files)
    if len(batch) > room:
        raise HTTPException(status_code=409, detail=f"Tối đa {limit} ảnh; còn gửi thêm được {room} ảnh")
    case = None
    for data, extension in batch:
        ref = photos.save(data, extension)
        try:
            case = _call(attach, ref)
        except Exception:
            photos.discard(ref)
            raise
    return case


def _photo_file(case: Case, evidence_id: str, allowed) -> Response:
    record = next((e for e in allowed(case) if e.evidence_id == evidence_id), None)
    if record is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh")
    data, media_type = photos.load(record.content_or_metadata)
    return Response(content=data, media_type=media_type, headers={"Cache-Control": "private, max-age=3600"})


# ------------------------------------------------------------------ demo control (internal, FR-DEMO-001)


@router.post("/reset")
def reset(actor: ActorDep, engine: EngineDep) -> dict[str, Any]:
    """Chỉ QA. Xoá mọi dữ liệu thay đổi, nạp lại 12 ticket fixture (mỗi ticket chạy đúng tại created_at của nó)."""
    _require_role(engine, actor, ActorRole.QA_INTERNAL)
    _require_reset_allowed()
    return {"run_id": engine.reset(), "tickets": len(engine.cases)}


@router.post("/demo/{ticket_id}", response_model=Case)
def run_demo_ticket(ticket_id: str, actor: ActorDep, engine: EngineDep) -> Case:
    """Chỉ QA. Chạy kịch bản phòng ban của một ticket fixture: nhận việc, cập nhật, báo hoàn thành (nếu đã ROUTED)."""
    _require_role(engine, actor, ActorRole.QA_INTERNAL)
    if engine.dataset.get(ticket_id) is None:
        raise HTTPException(status_code=404, detail=f"{ticket_id} không có trong fixture")
    return _call(run_fixture, engine, ticket_id)


@router.post("/evaluate", response_model=EvaluationReport)
def run_evaluation(actor: ActorDep, engine: EngineDep) -> EvaluationReport:
    """Chỉ QA. Reset rồi chạy cả 12 ticket, so với expected outcome. Acceptance nội bộ trên dữ liệu mô phỏng."""
    _require_role(engine, actor, ActorRole.QA_INTERNAL)
    _require_reset_allowed()  # evaluate starts with engine.reset()
    return evaluate(engine)


@router.get("/ai-logs", response_model=list[AILogEntry])
def get_ai_logs(
    actor: ActorDep,
    engine: EngineDep,
    status: AILogStatus | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
    ticket_id: str | None = None,
    limit: int = 100,
) -> list[AILogEntry]:
    """Lấy danh sách các lượt gọi LLM (AI Logs), hỗ trợ lọc theo trạng thái, khoảng thời gian và ticket_id."""
    _require_role(engine, actor, *STAFF)
    logs = ai_logger.get_logs(ticket_id=ticket_id, limit=limit)
    if status is not None:
        logs = [entry for entry in logs if entry.status == status]
    if since is not None:
        logs = [entry for entry in logs if entry.timestamp >= since]
    if until is not None:
        logs = [entry for entry in logs if entry.timestamp <= until]
    return logs


@router.post("/ai-logs/reset")
def reset_ai_logs(actor: ActorDep, engine: EngineDep) -> dict[str, Any]:
    """Reset toàn bộ dữ liệu AI logs phục vụ QA và kịch bản demo."""
    _require_role(engine, actor, ActorRole.QA_INTERNAL)
    ai_logger.clear()
    return {"message": "Đã reset dữ liệu AI logs"}


# ------------------------------------------------------------------ tickets (internal, full detail)


class IngestRequest(BaseModel):
    """Chỉ những gì cư dân gửi. ticket_id và created_at do hệ thống tạo."""

    original_description: str = Field(examples=["Hành lang tầng 3 tòa S1 nhiều rác, cần vệ sinh."])
    channel: Literal["form", "app", "hotline"] = "form"
    simulated_received_at: datetime | None = Field(
        default=None,
        description="Chỉ dùng khi demo: giả lập giờ tiếp nhận (phòng ban làm 06:00–22:00). Trống = hiện tại.",
        examples=[None],
    )


def _ingest(engine: MaintenanceEngine, body: IngestRequest, resident_id: str) -> Case:
    if body.simulated_received_at is not None and body.simulated_received_at.tzinfo is None:
        raise HTTPException(status_code=422, detail="simulated_received_at phải có timezone, ví dụ +07:00")
    return _call(
        engine.receive,
        body.original_description,
        resident_id=resident_id,
        channel=body.channel,
        received_at=body.simulated_received_at,
    )


@router.post("/tickets", response_model=Case, status_code=201)
def ingest_ticket(body: IngestRequest, actor: ActorDep, engine: EngineDep) -> Case:
    """Chỉ QA. Tạo phản ánh demo thay cho SIM-ACTOR-RESIDENT-01; cư dân thật dùng POST /resident/tickets."""
    _require_role(engine, actor, ActorRole.QA_INTERNAL)
    return _ingest(engine, body, "SIM-ACTOR-RESIDENT-01")


class TicketSummary(BaseModel):
    ticket_id: str
    status: TicketStatus
    status_label: str
    reason_code: ReasonCode | None
    proposed_department_id: Department | None
    department_id: Department | None
    escalated: bool
    risk_level: RiskLevel | None = None
    priority: Priority | None = None
    created_at: str
    description: str  # resident text: untrusted data, the UI renders it as plain text
    flow: str | None
    synthetic: bool = True


_PRIORITY_RANK = {Priority.HIGH: 0, Priority.MEDIUM: 1, None: 1, Priority.LOW: 2}


def _queue_key(row: TicketSummary) -> tuple:
    """CR-BPTN-03 §7: emergency first, then priority (unset counts as MEDIUM), then oldest first."""
    return (0 if row.risk_level == RiskLevel.EMERGENCY else 1, _PRIORITY_RANK[row.priority], row.created_at)


@router.get("/tickets", response_model=list[TicketSummary])
def list_tickets(actor: ActorDep, engine: EngineDep, status: TicketStatus | None = None) -> list[TicketSummary]:
    """Work queue nội bộ, chỉ gồm ticket vai trò của bạn được xem (phòng ban: ticket đã giao; kho: chờ vật tư).
    Sắp xếp: khẩn cấp trước, rồi mức ưu tiên, rồi cũ trước (CR-BPTN-03 §7)."""
    _require_role(engine, actor, *STAFF)
    rows = []
    for case in list(engine.cases.values()):  # snapshot: a new ticket may arrive from another thread
        ticket = case.ticket
        if (status is not None and ticket.status != status) or not _visible(engine, actor, case):
            continue
        fixture = engine.dataset.get(ticket.ticket_id)
        rows.append(
            TicketSummary(
                ticket_id=ticket.ticket_id,
                status=ticket.status,
                status_label=status_label(ticket.status),
                reason_code=ticket.blocker.code if ticket.blocker else None,
                proposed_department_id=ticket.proposed_department_id,
                department_id=ticket.department_id,
                escalated=bool(ticket.blocker and ticket.blocker.escalated),
                risk_level=ticket.risk_level,
                priority=ticket.priority,
                created_at=ticket.raw.created_at,
                description=ticket.raw.original_description,
                flow=fixture.flow if fixture else None,
            )
        )
    rows.sort(key=_queue_key)
    return rows


class CatalogView(BaseModel):
    departments: dict[str, str]
    assets: list[dict[str, str]]
    status_labels: dict[str, str]
    materials: list[dict[str, str]]
    custom_materials_enabled: bool = True  # plan 11: false ⇒ the portal hides the "+" that adds a material


@router.get("/catalog", response_model=CatalogView)
def read_catalog(actor: ActorDep, engine: EngineDep) -> CatalogView:
    """Tên phòng ban, asset, vật tư và nhãn trạng thái cho giao diện (dữ liệu mô phỏng, read-only)."""
    catalog = engine.catalog
    return CatalogView(
        departments={d.department_id.value: d.name for d in catalog.departments},
        assets=[{"asset_id": a.asset_id, "location": a.location_normalized} for a in catalog.assets],
        status_labels={s.value: status_label(s) for s in TicketStatus},
        materials=[
            {"item_code": m.item_code, "item_name": m.item_name, "unit": m.unit or ""} for m in engine.all_materials()
        ],
        custom_materials_enabled=get_settings().custom_materials_enabled(),
    )


@router.get("/tickets/{ticket_id}", response_model=Case)
def read_ticket(ticket_id: str, actor: ActorDep, engine: EngineDep) -> Case:
    return _staff_case(engine, actor, ticket_id)


@router.get("/tickets/{ticket_id}/events", response_model=list[StatusEvent])
def read_events(ticket_id: str, actor: ActorDep, engine: EngineDep) -> list[StatusEvent]:
    """`ticket_status_events`: mọi thay đổi status/blocker."""
    return _staff_case(engine, actor, ticket_id).events


@router.get("/tickets/{ticket_id}/audit", response_model=list[AuditEvent])
def read_audit(ticket_id: str, actor: ActorDep, engine: EngineDep) -> list[AuditEvent]:
    return _staff_case(engine, actor, ticket_id).audit


@router.get("/tickets/{ticket_id}/notifications", response_model=list[Notification])
def read_notifications(ticket_id: str, actor: ActorDep, engine: EngineDep) -> list[Notification]:
    return _staff_case(engine, actor, ticket_id).notifications


class TransitionRequest(BaseModel):
    model_config = {"extra": "forbid"}

    to: TicketStatus
    note: str | None = None
    eta: datetime | None = None
    cancel_reason: str | None = None


@router.post("/tickets/{ticket_id}/transition", response_model=Case)
def transition(ticket_id: str, body: TransitionRequest, actor: ActorDep, engine: EngineDep) -> Case:
    """Hàm chuyển trạng thái chung (CR-BPTN-03 §4.1). Vai trò không bao giờ được vào trạng thái đích → 403 + audit;
    vai trò đúng nhưng sai trạng thái nguồn → 409 INVALID_TRANSITION."""
    return _call(engine.transition, ticket_id, body.to, actor, **body.model_dump(exclude={"to"}))


@router.post("/tickets/{ticket_id}/resume", response_model=Case)
def resume(ticket_id: str, actor: ActorDep, engine: EngineDep) -> Case:
    """Chỉ QA. Chạy lại nếu điều kiện gỡ blocker đã đạt. Idempotent."""
    _require_role(engine, actor, ActorRole.QA_INTERNAL)
    return _call(engine.resume, ticket_id)


class JobsRequest(BaseModel):
    now: datetime | None = Field(default=None, description="Chỉ dùng khi demo: giả lập thời điểm chạy job")


@router.post("/jobs/run")
def run_jobs(body: JobsRequest, actor: ActorDep, engine: EngineDep) -> dict[str, list[str]]:
    """Chỉ QA. Job định kỳ: retry/nhắc/leo thang các ticket đến hạn. Server tự chạy mỗi `job_interval_minutes`."""
    _require_role(engine, actor, ActorRole.QA_INTERNAL)
    if body.now is not None and body.now.tzinfo is None:
        raise HTTPException(status_code=422, detail="now phải có timezone")
    return {"changed": _call(engine.run_jobs, body.now)}


# ------------------------------------------------------------------ BPTN


class BptnResolveRequest(BaseModel):
    model_config = {
        "extra": "forbid",
        "json_schema_extra": {
            "examples": [{"note": "Không có trong sổ tài sản, cần xem tại chỗ", "asset_onsite": True}]
        },
    }

    note: str | None = None
    merge: bool | None = Field(default=None, description="Chỉ với DUPLICATE: true = gộp, false = không trùng")
    category: ServiceCategory | None = None
    department: Department | None = Field(default=None, description="Chỉ với WRONG_DEPT, khi giữ nguyên loại việc")
    location: str | None = None
    asset_id: str | None = None
    asset_onsite: bool = Field(default=False, description="ASSET_UNCLEAR: xác định tại hiện trường (bắt buộc note)")
    info: str | None = Field(default=None, description="Chỉ với MISSING_INFO: thông tin BPTN thu thập từ cư dân")

    @field_validator("note", "location", "asset_id", "info")
    @classmethod
    def _check(cls, value: str | None) -> str | None:
        return _no_placeholder(value)


@router.post("/tickets/{ticket_id}/bptn-resolve", response_model=Case)
def bptn_resolve(ticket_id: str, body: BptnResolveRequest, actor: ActorDep, engine: EngineDep) -> Case:
    """BPTN gỡ blocker VERIFYING, hoặc MISSING_INFO (NEED_INFO) sau khi liên hệ cư dân. Giá trị BPTN chọn vào
    `locked_fields`; Agent không ghi đè."""
    return _call(engine.bptn_resolve, ticket_id, actor, **body.model_dump())


class SafetyRequest(NoteBody):
    decision: Literal["CONFIRM_SAFE", "REQUEST_INFO", "ESCALATE"]


@router.post("/tickets/{ticket_id}/safety", response_model=Case)
def safety_decide(ticket_id: str, body: SafetyRequest, actor: ActorDep, engine: EngineDep) -> Case:
    """BPTN chọn một trong ba hướng cho Bậc 2 (VERIFYING + SAFETY_REVIEW_REQUIRED): CONFIRM_SAFE, REQUEST_INFO,
    ESCALATE. Chỉ bọc `engine.safety_*`; vai, trạng thái và `note` do engine kiểm."""
    if body.decision == "CONFIRM_SAFE":
        return _call(engine.safety_confirm_safe, ticket_id, actor, note=body.note)
    if body.decision == "REQUEST_INFO":
        return _call(engine.safety_request_info, ticket_id, actor, note=body.note)
    return _call(engine.safety_escalate, ticket_id, actor, note=body.note)


class PriorityRequest(RequiredNoteBody):
    priority: Priority


@router.post("/tickets/{ticket_id}/priority", response_model=Case)
def set_priority(ticket_id: str, body: PriorityRequest, actor: ActorDep, engine: EngineDep) -> Case:
    """BPTN hoặc BQL sửa mức ưu tiên, bắt buộc lý do; Agent không ghi đè nữa."""
    return _call(engine.set_priority, ticket_id, actor, priority=body.priority, note=body.note)


class ToBqlRequest(NoteBody):
    """`note` is checked by the engine: empty or missing ⇒ 409 GUARD_FAILED (SPEC-P01 §2)."""


@router.post("/tickets/{ticket_id}/to-bql", response_model=Case)
def send_to_bql(ticket_id: str, body: ToBqlRequest, actor: ActorDep, engine: EngineDep) -> Case:
    """BPTN chuyển ticket ngoài phạm vi (OUT_OF_SCOPE) sang "Việc của BQL" (cờ leo thang), bắt buộc lý do."""
    return _call(engine.send_to_bql, ticket_id, actor, note=body.note)


# ------------------------------------------------------------------ department


@router.post("/tickets/{ticket_id}/wrong-department", response_model=Case)
def report_wrong_department(ticket_id: str, body: NoteBody, actor: ActorDep, engine: EngineDep) -> Case:
    """Phòng ban đã nhận việc báo sai phòng ban (T16): IN_PROGRESS → VERIFYING (WRONG_DEPT_AFTER_START), BQL quyết."""
    return _call(engine.report_wrong_department, ticket_id, actor, note=body.note)


@router.post("/tickets/{ticket_id}/accept", response_model=Case)
def accept(ticket_id: str, actor: ActorDep, engine: EngineDep) -> Case:
    """Phòng ban nhận việc: ROUTED → IN_PROGRESS."""
    return _call(engine.accept, ticket_id, actor)


@router.post("/tickets/{ticket_id}/return", response_model=Case)
def return_wrong_department(ticket_id: str, body: RequiredNoteBody, actor: ActorDep, engine: EngineDep) -> Case:
    """Sai phòng ban: ROUTED → VERIFYING (WRONG_DEPT), bắt buộc lý do."""
    return _call(engine.return_wrong_department, ticket_id, actor, note=body.note)


class BlockRequest(BaseModel):
    model_config = {"extra": "forbid"}

    note: str = Field(min_length=1)
    eta: datetime


@router.post("/tickets/{ticket_id}/block", response_model=Case)
def block_onsite(ticket_id: str, body: BlockRequest, actor: ActorDep, engine: EngineDep) -> Case:
    """Vướng tại hiện trường: IN_PROGRESS → ON_HOLD (BLOCKED_ONSITE), bắt buộc lý do và eta."""
    return _call(engine.block_onsite, ticket_id, actor, note=body.note, eta=body.eta)


@router.post("/tickets/{ticket_id}/resume-work", response_model=Case)
def resume_work(ticket_id: str, actor: ActorDep, engine: EngineDep) -> Case:
    """Tiếp tục sau BLOCKED_ONSITE: ON_HOLD → IN_PROGRESS."""
    return _call(engine.resume_work, ticket_id, actor)


class ChecklistRequest(BaseModel):
    status: ChecklistStatus
    note: str | None = None


@router.post("/tickets/{ticket_id}/checklist/{template_item_id}", response_model=Case)
def update_checklist(
    ticket_id: str, template_item_id: str, body: ChecklistRequest, actor: ActorDep, engine: EngineDep
) -> Case:
    return _call(engine.update_checklist, ticket_id, actor, template_item_id, status=body.status, note=body.note)


class MaterialRequest(BaseModel):
    issued_qty: float = Field(ge=0)
    used_qty: float = Field(ge=0)
    variance_reason: str | None = None


@router.post("/tickets/{ticket_id}/materials/{item_code}", response_model=Case)
def record_material(ticket_id: str, item_code: str, body: MaterialRequest, actor: ActorDep, engine: EngineDep) -> Case:
    return _call(engine.record_material, ticket_id, actor, item_code, **body.model_dump())


class MaterialPlanRequest(BaseModel):
    lines: list[PlannedMaterial] = Field(examples=[[{"item_code": "SIM-MAT-LAMP-02", "planned_qty": 2}]])
    note: str = Field(examples=["Kiểm tại chỗ: đèn tuýp, không phải LED"])


@router.post("/tickets/{ticket_id}/material-plan", response_model=Case)
def confirm_materials(ticket_id: str, body: MaterialPlanRequest, actor: ActorDep, engine: EngineDep) -> Case:
    """Phòng ban xác nhận vật tư thực tế tại hiện trường (thay đề xuất của Agent); `lines` rỗng = không dùng vật tư."""
    return _call(engine.confirm_materials, ticket_id, actor, lines=body.lines, note=body.note)


class EvidenceRequest(BaseModel):
    requirement_id: str | None = Field(examples=["CLN-EVD-PROCESSING-NOTE"])
    evidence_type: EvidenceType
    content_or_metadata: str
    readability_status: ReadabilityStatus = ReadabilityStatus.NOT_APPLICABLE


@router.post("/tickets/{ticket_id}/evidence", response_model=Case)
def add_evidence(ticket_id: str, body: EvidenceRequest, actor: ActorDep, engine: EngineDep) -> Case:
    return _call(engine.add_evidence, ticket_id, actor, **body.model_dump())


@router.post("/tickets/{ticket_id}/photos", response_model=Case)
async def add_execution_photos(ticket_id: str, files: PhotoFiles, actor: ActorDep, engine: EngineDep) -> Case:
    """Phòng ban gửi ảnh sau khi xử lý (bắt buộc ít nhất một ảnh trước khi báo hoàn thành)."""
    case = _staff_case(engine, actor, ticket_id)
    room = MAX_EXECUTION_PHOTOS - len(execution_photos(case))

    def attach(ref: str) -> Case:
        return engine.add_evidence(
            ticket_id,
            actor,
            requirement_id=None,
            evidence_type=EvidenceType.SIMULATED_IMAGE,
            content_or_metadata=ref,
            readability_status=ReadabilityStatus.READABLE,
        )

    return await _attach_photos(files, room, MAX_EXECUTION_PHOTOS, attach)


@router.get("/tickets/{ticket_id}/photos/{evidence_id}", response_class=Response)
def read_photo(ticket_id: str, evidence_id: str, actor: ActorDep, engine: EngineDep) -> Response:
    """Ảnh của cư dân hoặc của phòng ban, cho người được xem ticket."""
    case = _staff_case(engine, actor, ticket_id)
    # every department photo, including those from before a rework, so BQL can compare
    images = (EvidenceType.RESIDENT_ORIGINAL, EvidenceType.SIMULATED_IMAGE)
    return _photo_file(case, evidence_id, lambda c: [e for e in c.evidence if e.evidence_type in images])


@router.post("/tickets/{ticket_id}/complete", response_model=Case)
def report_complete(ticket_id: str, actor: ActorDep, engine: EngineDep) -> Case:
    """Báo hoàn thành → Agent đối soát (bước 10). Không đạt: giữ IN_PROGRESS, xem
    `draft.readiness_evaluation.failing_items`."""
    return _call(engine.report_complete, ticket_id, actor)


# ------------------------------------------------------------------ warehouse


class StockRequest(BaseModel):
    qty: float = Field(gt=0)


class StockRow(BaseModel):
    item_code: str
    item_name: str
    unit: str | None = None
    qty: float | None = None  # null = tồn kho không rõ


@router.get("/warehouse/stock", response_model=list[StockRow])
def read_stock(actor: ActorDep, engine: EngineDep) -> list[StockRow]:
    """Tồn kho mô phỏng hiện tại của mọi vật tư (chỉ nhân viên)."""
    return _call(engine.stock_levels, actor)


class NewMaterialRequest(BaseModel):
    """Length rules (name 2..80, unit 1..20) are the engine's (409); the caps here only bound the request."""

    model_config = {"extra": "forbid"}

    item_name: str = Field(max_length=500)
    unit: str = Field(max_length=100)


@router.post("/warehouse/items", response_model=StockRow, status_code=201)
def create_material(body: NewMaterialRequest, actor: ActorDep, engine: EngineDep) -> StockRow:
    """Kho hoặc phòng ban thêm vật tư ngoài danh mục (mã SIM-MAT-X-…, tồn kho 0). Cùng tên ⇒ trả mã có sẵn.
    Tắt bằng MO_CUSTOM_MATERIALS=false ⇒ 403 FEATURE_DISABLED."""
    if not get_settings().custom_materials_enabled():
        raise HTTPException(
            status_code=403,
            detail={"code": "FEATURE_DISABLED", "message": "Chưa bật nhập vật tư mới (MO_CUSTOM_MATERIALS=false)"},
        )
    item = _call(engine.create_material_item, actor, body.item_name, body.unit)
    return StockRow(
        item_code=item.item_code,
        item_name=item.item_name,
        unit=item.unit or None,
        qty=engine.repo.stock_of(item.item_code),
    )


@router.post("/warehouse/stock/{item_code}", response_model=list[Case])
def receive_stock(item_code: str, body: StockRequest, actor: ActorDep, engine: EngineDep) -> list[Case]:
    """Kho nhập vật tư (sự kiện `stock_received`): ticket chờ vật tư đó tự chạy lại từ bước 6 (chưa nhận việc)
    hoặc quay lại IN_PROGRESS (đã nhận việc)."""
    return _call(engine.receive_stock, actor, item_code, body.qty)


# ------------------------------------------------------------------ denial path


class AttemptRequest(BaseModel):
    action: Action = Field(examples=[Action.EDIT_RAW])
    field_name: str = Field(examples=["original_description"])
    new_value: Any = None
    reason: str = "Thử hành động ngoài quyền"


@router.post("/tickets/{ticket_id}/attempt", response_model=Case)
def attempt(ticket_id: str, body: AttemptRequest, actor: ActorDep, engine: EngineDep) -> Case:
    """Thử một hành động ngoài quyền (sửa raw, sửa catalog, chỉnh tồn kho...) → luôn ACTION_DENIED."""
    return _call(
        engine.attempt,
        ticket_id,
        actor,
        body.action,
        field_name=body.field_name,
        new_value=body.new_value,
        reason=body.reason,
    )


# ------------------------------------------------------------------ resident


@resident_router.post("/tickets", response_model=ResidentTicketView, status_code=201)
def resident_create(body: IngestRequest, actor: ActorDep, engine: EngineDep) -> ResidentTicketView:
    """Cư dân gửi phản ánh."""
    _require_role(engine, actor, ActorRole.RESIDENT)
    if body.simulated_received_at is not None and get_settings().app_env == "production":
        # demo-only: a resident must not backdate a report (it shifts duplicate checks and SLA timers)
        raise HTTPException(status_code=422, detail="simulated_received_at chỉ dùng khi demo")
    case = _ingest(engine, body, actor)
    return resident_view(engine, case, engine.clock())


@resident_router.get("/tickets", response_model=list[ResidentTicketView])
def resident_list(actor: ActorDep, engine: EngineDep) -> list[ResidentTicketView]:
    """Các phản ánh của chính cư dân gọi API, mới nhất trước."""
    _require_role(engine, actor, ActorRole.RESIDENT)
    now = engine.clock()
    snapshot = list(engine.cases.values())
    lookup = {c.ticket.ticket_id: c for c in snapshot}  # linked tickets (merge/split) come from the same read
    own = [c for c in snapshot if c.ticket.resident_id == actor]
    own.sort(key=lambda c: c.ticket.raw.created_at, reverse=True)
    return [resident_view(engine, c, now, lookup) for c in own]


def _own_case(engine: MaintenanceEngine, ticket_id: str, actor: str) -> Case:
    _require_role(engine, actor, ActorRole.RESIDENT)
    case = _call(engine.get, ticket_id)
    if case.ticket.resident_id != actor:
        raise HTTPException(status_code=404, detail=f"Không có ticket {ticket_id}")  # do not reveal others' tickets
    return case


@resident_router.get("/tickets/{ticket_id}", response_model=ResidentTicketView)
def resident_read(ticket_id: str, actor: ActorDep, engine: EngineDep) -> ResidentTicketView:
    """Chỉ trường công khai: trạng thái, phòng ban, lời nhắn, eta, timeline, hành động được phép."""
    return resident_view(engine, _own_case(engine, ticket_id, actor), engine.clock())


class AdditionRequest(BaseModel):
    content: str = Field(min_length=1, examples=["Ở hành lang tầng 3 tòa S1"])


@resident_router.post("/tickets/{ticket_id}/additions", response_model=ResidentTicketView)
def resident_add(ticket_id: str, body: AdditionRequest, actor: ActorDep, engine: EngineDep) -> ResidentTicketView:
    """Bổ sung thông tin (append-only; nội dung gốc không đổi)."""
    _own_case(engine, ticket_id, actor)
    case = _call(engine.add_resident_info, ticket_id, actor, body.content)
    return resident_view(engine, case, engine.clock())


@resident_router.post("/tickets/{ticket_id}/photos", response_model=ResidentTicketView)
async def resident_add_photos(
    ticket_id: str, files: PhotoFiles, actor: ActorDep, engine: EngineDep
) -> ResidentTicketView:
    """Đính kèm ảnh (không bắt buộc) vào phản ánh của chính mình."""
    case = _own_case(engine, ticket_id, actor)
    room = MAX_RESIDENT_PHOTOS - len(resident_photos(case))
    case = await _attach_photos(
        files, room, MAX_RESIDENT_PHOTOS, lambda ref: engine.add_resident_photo(ticket_id, actor, ref)
    )
    return resident_view(engine, case, engine.clock())


@resident_router.get("/tickets/{ticket_id}/photos/{evidence_id}", response_class=Response)
def resident_read_photo(ticket_id: str, evidence_id: str, actor: ActorDep, engine: EngineDep) -> Response:
    """Chỉ ảnh cư dân tự gửi."""
    return _photo_file(_own_case(engine, ticket_id, actor), evidence_id, resident_photos)


class RatingRequest(BaseModel):
    score: int = Field(ge=1, le=5)


@resident_router.post("/tickets/{ticket_id}/rating", response_model=ResidentTicketView)
def resident_rate(ticket_id: str, body: RatingRequest, actor: ActorDep, engine: EngineDep) -> ResidentTicketView:
    _own_case(engine, ticket_id, actor)
    case = _call(engine.rate, ticket_id, actor, body.score)
    return resident_view(engine, case, engine.clock())


# ------------------------------------------------------------------ BQL


@bql_router.get("/tickets", response_model=list[BqlTicketRow])
def bql_list(
    actor: ActorDep,
    engine: EngineDep,
    status: TicketStatus | None = None,
    department_id: Department | None = None,
    blocker_code: ReasonCode | None = None,
    escalated: bool | None = None,
    overdue: bool | None = None,
    risk_level: RiskLevel | None = None,
    priority: Priority | None = None,
) -> list[BqlTicketRow]:
    """Đầy đủ chi tiết, lọc theo status, phòng ban, mã blocker, cờ leo thang, quá SLA, mức rủi ro, ưu tiên.
    Khẩn cấp luôn ở trên cùng."""
    _require_role(engine, actor, ActorRole.BQL)
    return bql_rows(
        engine,
        engine.clock(),
        status=status,
        department_id=department_id,
        blocker_code=blocker_code,
        escalated=escalated,
        overdue=overdue,
        risk_level=risk_level,
        priority=priority,
    )


@bql_router.post("/tickets/{ticket_id}/close", response_model=Case)
def bql_close(ticket_id: str, body: NoteBody, actor: ActorDep, engine: EngineDep) -> Case:
    """Nghiệm thu: READY_FOR_REVIEW → CLOSED. Chỉ BQL."""
    return _call(engine.close, ticket_id, actor, note=body.note)


@bql_router.post("/tickets/{ticket_id}/rework", response_model=Case)
def bql_rework(ticket_id: str, body: RequiredNoteBody, actor: ActorDep, engine: EngineDep) -> Case:
    """Trả lại làm lại: READY_FOR_REVIEW → IN_PROGRESS (REWORK), bắt buộc lý do."""
    return _call(engine.rework, ticket_id, actor, note=body.note)


class CancelRequest(BaseModel):
    model_config = {"extra": "forbid"}

    cancel_reason: str = Field(min_length=1)


@bql_router.post("/tickets/{ticket_id}/cancel", response_model=Case)
def bql_cancel(ticket_id: str, body: CancelRequest, actor: ActorDep, engine: EngineDep) -> Case:
    """Hủy ticket chưa kết thúc. Chỉ BQL, bắt buộc lý do."""
    return _call(engine.cancel, ticket_id, actor, cancel_reason=body.cancel_reason)


class EmergencyNoteBody(NoteBody):
    model_config = {"extra": "ignore"}  # a client-sent closure_kind is ignored: the engine sets EMERGENCY_HANDLED


@bql_router.post("/tickets/{ticket_id}/handled", response_model=Case)
def bql_handled(ticket_id: str, body: NoteBody, actor: ActorDep, engine: EngineDep) -> Case:
    """Đánh dấu "Việc của BQL" đã xử lý: VERIFYING + OUT_OF_SCOPE → CLOSED. Chỉ BQL, bắt buộc ghi kết quả."""
    return _call(engine.bql_handle_out_of_scope, ticket_id, actor, note=body.note)


@bql_router.post("/tickets/{ticket_id}/return-to-bptn", response_model=Case)
def bql_return_to_bptn(ticket_id: str, body: NoteBody, actor: ActorDep, engine: EngineDep) -> Case:
    """Trả ticket ngoài phạm vi đã leo thang về BPTN (hết cờ leo thang, tính lại hạn). Chỉ BQL, bắt buộc lý do."""
    return _call(engine.bql_return_to_bptn, ticket_id, actor, note=body.note)


class WrongDepartmentDecision(NoteBody):
    decision: Literal["KEEP", "TO_BPTN"]


@bql_router.post("/tickets/{ticket_id}/wrong-department", response_model=Case)
def bql_wrong_department(ticket_id: str, body: WrongDepartmentDecision, actor: ActorDep, engine: EngineDep) -> Case:
    """BQL quyết định ticket phòng ban báo sai sau khi nhận: KEEP (giữ phòng ban) hoặc TO_BPTN (BPTN phân lại)."""
    return _call(engine.bql_wrong_department, ticket_id, actor, decision=body.decision, note=body.note)


@bql_router.post("/tickets/{ticket_id}/emergency/close", response_model=Case)
def bql_emergency_close(ticket_id: str, body: EmergencyNoteBody, actor: ActorDep, engine: EngineDep) -> Case:
    """Bậc 1 đã xử lý ngoài hệ thống: VERIFYING + EMERGENCY_PENDING_BQL → CLOSED (EMERGENCY_HANDLED). Chỉ BQL."""
    return _call(engine.emergency_close, ticket_id, actor, note=body.note)


@bql_router.post("/tickets/{ticket_id}/emergency/downgrade", response_model=Case)
def bql_emergency_downgrade(ticket_id: str, body: EmergencyNoteBody, actor: ActorDep, engine: EngineDep) -> Case:
    """Báo động giả: hạ Bậc 1, luồng thường chạy lại. Chỉ BQL, bắt buộc `note`."""
    return _call(engine.emergency_downgrade, ticket_id, actor, note=body.note)

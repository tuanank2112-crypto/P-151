"""MaintenanceOps Agent v0.5 candidate API (CR-BPTN-02; simulated data, in-memory, resettable).

Three routers over one engine:
  /mo        internal: demo control, Agent/department/BPTN/warehouse/system actions, full case
  /resident  what a resident sees and may do (public fields only)
  /bql       BQL dashboard and the only close / rework / cancel actions

The caller is identified by the `X-Actor-Id` header; its role comes from the simulated actor catalog.
"""

from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, ValidationError, field_validator

from src.maintenance.demo import EvaluationReport, evaluate, run_fixture
from src.maintenance.engine import (
    ActionDeniedError,
    AuditWriteError,
    EngineError,
    GuardError,
    MaintenanceEngine,
    NotFoundError,
    build_engine,
)
from src.maintenance.enums import (
    Action,
    ActorRole,
    ChecklistStatus,
    Department,
    EvidenceType,
    ReadabilityStatus,
    ReasonCode,
    ServiceCategory,
    TicketStatus,
)
from src.maintenance.models import AuditEvent, Case, Notification, StatusEvent
from src.maintenance.views import BqlTicketRow, ResidentTicketView, bql_rows, resident_view

router = APIRouter(prefix="/mo", tags=["maintenance-ops (nội bộ)"])
resident_router = APIRouter(prefix="/resident", tags=["cư dân"])
bql_router = APIRouter(prefix="/bql", tags=["BQL"])

_engine: MaintenanceEngine | None = None


def get_engine() -> MaintenanceEngine:
    global _engine
    if _engine is None:
        _engine = build_engine()
        _engine.reset()
    return _engine


EngineDep = Annotated[MaintenanceEngine, Depends(get_engine)]
ActorDep = Annotated[
    str,
    Header(
        alias="X-Actor-Id",
        description="VD: SIM-ACTOR-RESIDENT-01, SIM-ACTOR-BPTN-01, SIM-ACTOR-DEPT-CLN-01, SIM-ACTOR-DEPT-TEC-01, "
        "SIM-ACTOR-WAREHOUSE-01, SIM-ACTOR-BQL-01, SIM-ACTOR-SYSTEM",
    ),
]


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
    except AuditWriteError as exc:
        raise HTTPException(status_code=500, detail={"code": exc.code, "message": exc.message}) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors(include_url=False)) from exc
    except EngineError as exc:
        raise HTTPException(status_code=500, detail={"code": exc.code, "message": exc.message}) from exc


def _plain(detail: dict[str, Any]) -> dict[str, Any]:
    return {k: v.isoformat() if isinstance(v, datetime) else v for k, v in detail.items()}


def _require_role(engine: MaintenanceEngine, actor_id: str, role: ActorRole) -> None:
    if engine.catalog.actor_role(actor_id) != role:
        raise HTTPException(status_code=403, detail={"code": "ACTION_DENIED", "message": f"Chỉ {role}"})


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


# ------------------------------------------------------------------ demo control (internal, FR-DEMO-001)


@router.post("/reset")
def reset(engine: EngineDep) -> dict[str, Any]:
    """Xoá mọi dữ liệu thay đổi, nạp lại 12 ticket fixture (mỗi ticket chạy đúng tại created_at của nó)."""
    return {"run_id": engine.reset(), "tickets": len(engine.cases)}


@router.post("/demo/{ticket_id}", response_model=Case)
def run_demo_ticket(ticket_id: str, engine: EngineDep) -> Case:
    """Chạy kịch bản phòng ban của một ticket fixture: nhận việc, cập nhật, báo hoàn thành (nếu đã ROUTED)."""
    if engine.dataset.get(ticket_id) is None:
        raise HTTPException(status_code=404, detail=f"{ticket_id} không có trong fixture")
    return _call(run_fixture, engine, ticket_id)


@router.post("/evaluate", response_model=EvaluationReport)
def run_evaluation(engine: EngineDep) -> EvaluationReport:
    """Reset rồi chạy cả 12 ticket, so với expected outcome. Acceptance nội bộ trên dữ liệu mô phỏng."""
    return evaluate(engine)


# ------------------------------------------------------------------ tickets (internal, full detail)


class IngestRequest(BaseModel):
    """Chỉ những gì cư dân gửi. ticket_id và created_at do hệ thống tạo."""

    original_description: str = Field(examples=["Hành lang tầng 3 tòa SIM-A nhiều rác, cần vệ sinh."])
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
def ingest_ticket(body: IngestRequest, engine: EngineDep) -> Case:
    """Tạo phản ánh demo thay cho SIM-ACTOR-RESIDENT-01; Agent chạy pipeline bước 2–8."""
    return _ingest(engine, body, "SIM-ACTOR-RESIDENT-01")


class TicketSummary(BaseModel):
    ticket_id: str
    status: TicketStatus
    reason_code: ReasonCode | None
    department_id: Department | None
    escalated: bool
    flow: str | None
    synthetic: bool = True


@router.get("/tickets", response_model=list[TicketSummary])
def list_tickets(engine: EngineDep, status: TicketStatus | None = None) -> list[TicketSummary]:
    """Work queue nội bộ."""
    rows = []
    for case in engine.cases.values():
        ticket = case.ticket
        if status is not None and ticket.status != status:
            continue
        fixture = engine.dataset.get(ticket.ticket_id)
        rows.append(
            TicketSummary(
                ticket_id=ticket.ticket_id,
                status=ticket.status,
                reason_code=ticket.blocker.code if ticket.blocker else None,
                department_id=ticket.department_id,
                escalated=bool(ticket.blocker and ticket.blocker.escalated),
                flow=fixture.flow if fixture else None,
            )
        )
    return rows


@router.get("/tickets/{ticket_id}", response_model=Case)
def read_ticket(ticket_id: str, engine: EngineDep) -> Case:
    return _call(engine.get, ticket_id)


@router.get("/tickets/{ticket_id}/events", response_model=list[StatusEvent])
def read_events(ticket_id: str, engine: EngineDep) -> list[StatusEvent]:
    """`ticket_status_events`: mọi thay đổi status/blocker."""
    return _call(engine.get, ticket_id).events


@router.get("/tickets/{ticket_id}/audit", response_model=list[AuditEvent])
def read_audit(ticket_id: str, engine: EngineDep) -> list[AuditEvent]:
    return _call(engine.get, ticket_id).audit


@router.get("/tickets/{ticket_id}/notifications", response_model=list[Notification])
def read_notifications(ticket_id: str, engine: EngineDep) -> list[Notification]:
    return _call(engine.get, ticket_id).notifications


class TransitionRequest(BaseModel):
    model_config = {"extra": "forbid"}

    to: TicketStatus
    note: str | None = None
    eta: datetime | None = None
    cancel_reason: str | None = None


@router.post("/tickets/{ticket_id}/transition", response_model=Case)
def transition(ticket_id: str, body: TransitionRequest, actor: ActorDep, engine: EngineDep) -> Case:
    """Hàm chuyển trạng thái chung (CR §3). Vai trò không bao giờ được vào trạng thái đích → 403 + audit;
    vai trò đúng nhưng sai trạng thái nguồn → 409 INVALID_TRANSITION."""
    return _call(engine.transition, ticket_id, body.to, actor, **body.model_dump(exclude={"to"}))


@router.post("/tickets/{ticket_id}/resume", response_model=Case)
def resume(ticket_id: str, engine: EngineDep) -> Case:
    """Chạy lại nếu điều kiện gỡ blocker đã đạt. Idempotent."""
    return _call(engine.resume, ticket_id)


class JobsRequest(BaseModel):
    now: datetime | None = Field(default=None, description="Chỉ dùng khi demo: giả lập thời điểm chạy job")


@router.post("/jobs/run")
def run_jobs(body: JobsRequest, engine: EngineDep) -> dict[str, list[str]]:
    """Job định kỳ: retry/nhắc/leo thang các ticket đến hạn. Server tự chạy mỗi `job_interval_minutes`."""
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

    @field_validator("note", "location", "asset_id")
    @classmethod
    def _check(cls, value: str | None) -> str | None:
        return _no_placeholder(value)


@router.post("/tickets/{ticket_id}/bptn-resolve", response_model=Case)
def bptn_resolve(ticket_id: str, body: BptnResolveRequest, actor: ActorDep, engine: EngineDep) -> Case:
    """BPTN gỡ blocker VERIFYING. Giá trị BPTN chọn vào `locked_fields`; Agent không ghi đè."""
    return _call(engine.bptn_resolve, ticket_id, actor, **body.model_dump())


# ------------------------------------------------------------------ department


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


class EvidenceRequest(BaseModel):
    requirement_id: str | None = Field(examples=["CLN-EVD-PROCESSING-NOTE"])
    evidence_type: EvidenceType
    content_or_metadata: str
    readability_status: ReadabilityStatus = ReadabilityStatus.NOT_APPLICABLE


@router.post("/tickets/{ticket_id}/evidence", response_model=Case)
def add_evidence(ticket_id: str, body: EvidenceRequest, actor: ActorDep, engine: EngineDep) -> Case:
    return _call(engine.add_evidence, ticket_id, actor, **body.model_dump())


@router.post("/tickets/{ticket_id}/complete", response_model=Case)
def report_complete(ticket_id: str, actor: ActorDep, engine: EngineDep) -> Case:
    """Báo hoàn thành → Agent đối soát (bước 10). Không đạt: giữ IN_PROGRESS, xem
    `draft.readiness_evaluation.failing_items`."""
    return _call(engine.report_complete, ticket_id, actor)


# ------------------------------------------------------------------ warehouse


class StockRequest(BaseModel):
    qty: float = Field(gt=0)


@router.post("/warehouse/stock/{item_code}", response_model=list[Case])
def receive_stock(item_code: str, body: StockRequest, actor: ActorDep, engine: EngineDep) -> list[Case]:
    """Kho nhập vật tư (sự kiện `stock_received`); ticket đang chờ vật tư đó tự chạy lại từ bước 7."""
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
    case = _ingest(engine, body, actor)
    return resident_view(engine, case, engine.clock())


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
    content: str = Field(min_length=1, examples=["Ở hành lang tầng 3 tòa SIM-A"])


@resident_router.post("/tickets/{ticket_id}/additions", response_model=ResidentTicketView)
def resident_add(ticket_id: str, body: AdditionRequest, actor: ActorDep, engine: EngineDep) -> ResidentTicketView:
    """Bổ sung thông tin (append-only; nội dung gốc không đổi)."""
    _own_case(engine, ticket_id, actor)
    case = _call(engine.add_resident_info, ticket_id, actor, body.content)
    return resident_view(engine, case, engine.clock())


class RatingRequest(BaseModel):
    score: int = Field(ge=1, le=5)


@resident_router.post("/tickets/{ticket_id}/rating", response_model=ResidentTicketView)
def resident_rate(ticket_id: str, body: RatingRequest, actor: ActorDep, engine: EngineDep) -> ResidentTicketView:
    _own_case(engine, ticket_id, actor)
    case = _call(engine.rate, ticket_id, actor, body.score)
    return resident_view(engine, case, engine.clock())


@resident_router.post("/tickets/{ticket_id}/reopen", response_model=ResidentTicketView)
def resident_reopen(ticket_id: str, body: NoteBody, actor: ActorDep, engine: EngineDep) -> ResidentTicketView:
    """Báo chưa xong: CLOSED → READY_FOR_REVIEW trong thời hạn mở lại."""
    _own_case(engine, ticket_id, actor)
    case = _call(engine.reopen, ticket_id, actor, note=body.note)
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
) -> list[BqlTicketRow]:
    """Đầy đủ chi tiết, lọc theo status, phòng ban, mã blocker, cờ leo thang, quá SLA."""
    _require_role(engine, actor, ActorRole.BQL)
    return bql_rows(
        engine,
        engine.clock(),
        status=status,
        department_id=department_id,
        blocker_code=blocker_code,
        escalated=escalated,
        overdue=overdue,
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

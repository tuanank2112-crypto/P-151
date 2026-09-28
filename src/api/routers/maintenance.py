"""MaintenanceOps Agent v0.3 API (simulated data, in-memory, resettable).

The caller is identified by the `X-Actor-Id` header; its role comes from the simulated actor catalog:
SIM-ACTOR-BPTN-01 (BPTN), SIM-ACTOR-EXEC-01 (nhân sự thực hiện), SIM-ACTOR-BQL-01 (BQL), SIM-ACTOR-AGENT.
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
    ChecklistStatus,
    EvidenceType,
    ReadabilityStatus,
    ServiceCategory,
    TicketState,
    TicketType,
)
from src.maintenance.models import AuditEvent, Case

router = APIRouter(prefix="/mo", tags=["maintenance-ops v0.3"])

_engine: MaintenanceEngine | None = None


def get_engine() -> MaintenanceEngine:
    global _engine
    if _engine is None:
        _engine = build_engine()
        _engine.reset()
    return _engine


EngineDep = Annotated[MaintenanceEngine, Depends(get_engine)]
ActorDep = Annotated[
    str, Header(alias="X-Actor-Id", description="VD: SIM-ACTOR-BPTN-01, SIM-ACTOR-EXEC-01, SIM-ACTOR-BQL-01")
]


def _call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except ActionDeniedError as exc:
        raise HTTPException(status_code=403, detail={"message": exc.message, **exc.detail}) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message) from exc
    except GuardError as exc:
        raise HTTPException(status_code=409, detail={"message": exc.message, **exc.detail}) from exc
    except AuditWriteError as exc:
        raise HTTPException(status_code=500, detail={"code": exc.code, "message": exc.message}) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors(include_url=False)) from exc
    except EngineError as exc:
        raise HTTPException(status_code=500, detail={"code": exc.code, "message": exc.message}) from exc


class TicketSummary(BaseModel):
    ticket_id: str
    current_state: TicketState
    rule_id: str
    reason: str
    playbook_id: str | None
    route_status: str | None
    routing_team_id: str | None
    queue_reason: str | None
    flow: str | None
    synthetic: bool = True


def _summary(engine: MaintenanceEngine, case: Case) -> TicketSummary:
    fixture = engine.dataset.get(case.ticket.ticket_id)
    draft = case.draft
    return TicketSummary(
        ticket_id=case.ticket.ticket_id,
        current_state=case.ticket.current_state,
        rule_id=case.ticket.state_decision.rule_id,
        reason=case.ticket.state_decision.reason,
        playbook_id=case.proposal.playbook_id if case.proposal else None,
        route_status=draft.route_status if draft else None,
        routing_team_id=draft.routing_team_id if draft else None,
        queue_reason=draft.queue_reason if draft else None,
        flow=fixture.flow if fixture else None,
    )


# ------------------------------------------------------------------ demo control (internal, FR-DEMO-001)


@router.post("/reset")
def reset(engine: EngineDep) -> dict[str, Any]:
    """Xoá mọi dữ liệu thay đổi, nạp lại 12 ticket fixture (không sửa file fixture)."""
    return {"run_id": engine.reset(), "tickets": len(engine.cases)}


@router.post("/demo/{ticket_id}", response_model=Case)
def run_demo_ticket(ticket_id: str, engine: EngineDep) -> Case:
    """Chạy các bước kịch bản của một ticket fixture: BPTN xác nhận, rồi nhân sự cập nhật nếu đã route."""
    if engine.dataset.get(ticket_id) is None:
        raise HTTPException(status_code=404, detail=f"{ticket_id} không có trong fixture")
    return _call(run_fixture, engine, ticket_id)


@router.post("/evaluate", response_model=EvaluationReport)
def run_evaluation(engine: EngineDep) -> EvaluationReport:
    """Reset rồi chạy cả 12 ticket, so với expected outcome. Acceptance nội bộ trên dữ liệu mô phỏng."""
    return evaluate(engine)


# ------------------------------------------------------------------ tickets


class IngestRequest(BaseModel):
    """Chỉ những gì cư dân gửi. ticket_id và created_at do hệ thống tạo; vật tư dự kiến do Agent xác định."""

    original_description: str = Field(examples=["Hành lang tầng 3 tòa SIM-A nhiều rác, cần vệ sinh."])
    channel: Literal["form", "app", "hotline"] = "form"
    simulated_received_at: datetime | None = Field(
        default=None,
        description="Chỉ dùng khi demo: giả lập giờ tiếp nhận để chọn ca trực (ca sáng 06–14h có team). "
        "Để trống = thời điểm hiện tại.",
        examples=[None],
    )


@router.post("/tickets", response_model=Case, status_code=201)
def ingest_ticket(body: IngestRequest, engine: EngineDep) -> Case:
    """Cư dân gửi phản ánh. Hệ thống tạo mã ticket; Agent đề xuất playbook và chạy luật rủi ro ngay."""
    if body.simulated_received_at is not None and body.simulated_received_at.tzinfo is None:
        raise HTTPException(status_code=422, detail="simulated_received_at phải có timezone, ví dụ +07:00")
    return _call(
        engine.receive,
        body.original_description,
        channel=body.channel,
        received_at=body.simulated_received_at,
    )


@router.get("/tickets", response_model=list[TicketSummary])
def list_tickets(engine: EngineDep, state: TicketState | None = None) -> list[TicketSummary]:
    """Work queue (UI-01)."""
    cases = [c for c in engine.cases.values() if state is None or c.ticket.current_state == state]
    return [_summary(engine, c) for c in cases]


@router.get("/tickets/{ticket_id}", response_model=Case)
def read_ticket(ticket_id: str, engine: EngineDep) -> Case:
    return _call(engine.get, ticket_id)


@router.get("/tickets/{ticket_id}/audit", response_model=list[AuditEvent])
def read_audit(ticket_id: str, engine: EngineDep) -> list[AuditEvent]:
    return _call(engine.get, ticket_id).audit


class ConfirmRequest(BaseModel):
    model_config = {"json_schema_extra": {"examples": [{"reason": "Xác nhận theo đề xuất của Agent"}]}}

    location_normalized: str | None = Field(
        default=None, description="Bỏ trống = dùng proposal.location_proposed; điền để sửa vị trí"
    )
    reason: str
    service_category: ServiceCategory | None = None
    ticket_type: TicketType | None = None

    @field_validator("location_normalized", "reason")
    @classmethod
    def _not_swagger_placeholder(cls, value: str | None) -> str | None:
        if value is not None and value.strip().lower() == "string":
            raise ValueError('"string" là giá trị mẫu của Swagger, không phải dữ liệu thật')
        return value


@router.post("/tickets/{ticket_id}/confirm", response_model=Case)
def confirm(ticket_id: str, body: ConfirmRequest, actor: ActorDep, engine: EngineDep) -> Case:
    """BPTN xác nhận/chỉnh service, type và location; Agent tạo draft và đề xuất route nếu đủ gate.

    `location_normalized` bỏ trống thì hệ thống lấy vị trí Agent đã đọc từ phản ánh (`proposal.location_proposed`).
    """
    return _call(engine.confirm, ticket_id, actor, **body.model_dump())


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


class ResolveRequest(BaseModel):
    resolution_note: str


@router.post("/tickets/{ticket_id}/exceptions/{exception_id}/resolve", response_model=Case)
def resolve_exception(
    ticket_id: str, exception_id: str, body: ResolveRequest, actor: ActorDep, engine: EngineDep
) -> Case:
    """Chỉ BQL; Agent không được resolve exception."""
    return _call(engine.resolve_exception, ticket_id, actor, exception_id, resolution_note=body.resolution_note)


@router.post("/tickets/{ticket_id}/handoff", response_model=Case)
def handoff(ticket_id: str, actor: ActorDep, engine: EngineDep) -> Case:
    """'Chuyển BQL xem xét' — chỉ khi READY_FOR_REVIEW; không phải nghiệm thu."""
    return _call(engine.handoff_to_bql, ticket_id, actor)


class AttemptRequest(BaseModel):
    action: Action = Field(examples=[Action.ASSIGN_EMPLOYEE])
    field_name: str = Field(examples=["assignee_id"])
    new_value: Any = None
    reason: str = "Thử hành động ngoài quyền"


@router.post("/tickets/{ticket_id}/attempt", response_model=Case)
def attempt(ticket_id: str, body: AttemptRequest, actor: ActorDep, engine: EngineDep) -> Case:
    """Thử một hành động ngoài quyền (sửa raw, gán nhân viên, đóng ticket, duyệt vật tư...) → luôn ACTION_DENIED."""
    return _call(
        engine.attempt,
        ticket_id,
        actor,
        body.action,
        field_name=body.field_name,
        new_value=body.new_value,
        reason=body.reason,
    )

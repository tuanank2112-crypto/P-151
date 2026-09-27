from typing import Literal

from pydantic import BaseModel, Field

from src.models.entities import Escalation, Evidence, Ticket, TicketPhoto, WorkOrder


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000, description="Tin nhắn từ user")


class ChatResponse(BaseModel):
    response: str = Field(..., description="Phản hồi từ agent")
    analysis: str = Field(default="", description="Phân tích nội bộ")


# ---- Maintenance-ops ticket flow ----


class WorkOrderDetail(BaseModel):
    work_order: WorkOrder
    evidence: list[Evidence]
    ticket_status: str


class TicketDetail(BaseModel):
    ticket: Ticket
    photos: list[TicketPhoto]
    work_orders: list[WorkOrderDetail]
    escalations: list[Escalation]


class ReassignRequest(BaseModel):
    technician_id: str = Field(description="Mã kỹ thuật mới, phải đang trực đúng chuyên môn. Ví dụ KT02")
    note: str | None = None


class CheckIssue(BaseModel):
    code: str
    message: str


class CheckResult(BaseModel):
    passed: bool
    issues: list[CheckIssue]


class CheckResponse(BaseModel):
    result: CheckResult
    work_order: WorkOrder
    ticket_status: str
    escalation: Escalation | None = None


class CloseRequest(BaseModel):
    note: str | None = None


class EscalateRequest(BaseModel):
    detail: str = Field(..., min_length=3, max_length=1000, description="Lý do chuyển BQL")


class ResolveRequest(BaseModel):
    action: Literal["resume", "retriage", "close"] = Field(
        description="resume: quay lại bước trước khi chuyển BQL; "
        "retriage: sửa vị trí/loại sự cố rồi tự giao lại cho người đang trực (huỷ work order đang mở); "
        "close: đóng ticket (đã xử lý ngoài hệ thống, trùng, không phải sự cố)"
    )
    note: str | None = None
    location_id: str | None = Field(default=None, description="Chỉ dùng với retriage")
    category: str | None = Field(default=None, description="Chỉ dùng với retriage")


class OverdueResult(BaseModel):
    checked_at: str
    created: list[Escalation]

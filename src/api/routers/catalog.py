from fastapi import APIRouter
from sqlmodel import select

from src.api.deps import SessionDep
from src.models.entities import Location, Playbook, Shift
from src.services import clock
from src.services.assignment import is_on_shift

router = APIRouter(tags=["catalog"])


@router.get("/locations", response_model=list[Location])
def list_locations(session: SessionDep, floor: int | None = None, area: str | None = None) -> list[Location]:
    """Danh mục vị trí của tòa (dùng để tra location_id)."""
    query = select(Location).order_by(Location.id)
    if floor is not None:
        query = query.where(Location.floor == floor)
    if area:
        query = query.where(Location.area == area)
    return list(session.exec(query).all())


@router.get("/shifts", response_model=list[Shift])
def list_shifts(session: SessionDep, on_duty_now: bool = False) -> list[Shift]:
    """Lịch trực kỹ thuật. `on_duty_now=true` chỉ lấy người đang trong ca."""
    shifts = session.exec(select(Shift).order_by(Shift.id)).all()
    if on_duty_now:
        now = clock.now()
        shifts = [s for s in shifts if is_on_shift(s, now)]
    return list(shifts)


@router.get("/playbooks", response_model=list[Playbook])
def list_playbooks(session: SessionDep) -> list[Playbook]:
    """Playbook theo loại sự cố: các bước, checklist, hạn nhận việc/hoàn thành."""
    return list(session.exec(select(Playbook)).all())

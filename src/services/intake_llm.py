"""Turn a resident's free-text report into structured fields, then match a catalog location.

The LLM (or the mock) only extracts fields from free text. Deciding whether the location
is unambiguous is a deterministic rule in `match_location`.
"""

import re
from typing import Literal

from pydantic import BaseModel, Field

from src.config import get_settings
from src.models.entities import Location
from src.services.safety import normalize

Category = Literal["lighting", "plumbing", "elevator", "electrical", "other"]
Area = Literal["corridor", "elevator_lobby", "stairwell", "lobby", "parking", "elevator_car"]


class IntakeExtraction(BaseModel):
    category: Category = Field(
        description="lighting: đèn/bóng đèn; plumbing: rò rỉ/ống nước; elevator: thang máy; "
        "electrical: ổ cắm, công tắc, dây điện, mất điện; other: loại khác"
    )
    building: str | None = Field(default=None, description="Mã tòa nếu có, ví dụ 'S1.01'")
    floor: int | None = Field(default=None, description="Số tầng; hầm B1 = -1; không rõ thì null")
    area: Area | None = Field(
        default=None,
        description="corridor: hành lang; elevator_lobby: sảnh thang máy; stairwell: cầu thang bộ; "
        "lobby: sảnh chính; parking: hầm xe; elevator_car: bên trong thang máy. Không rõ thì null",
    )
    unit: str | None = Field(default=None, description="Số thang máy nếu có, ví dụ '2'")
    summary: str = Field(description="Tóm tắt sự cố trong một câu ngắn, tiếng Việt")
    urgency: Literal["normal", "high"] = Field(default="normal")


class LocationMatch(BaseModel):
    location_id: str | None
    candidates: list[str]


SYSTEM_PROMPT = (
    "Bạn là nhân viên tiếp nhận phản ánh sự cố của Ban quản lý chung cư. "
    "Trích xuất thông tin từ phản ánh của cư dân. Chỉ điền những gì cư dân nói rõ; "
    "không đoán tầng, khu vực hoặc số thang máy nếu văn bản không nêu."
)


def extract(text: str) -> IntakeExtraction:
    if get_settings().llm_mode == "mock":
        return extract_mock(text)
    return extract_openai(text)


def extract_openai(text: str) -> IntakeExtraction:
    from langchain_openai import ChatOpenAI

    settings = get_settings()
    llm = ChatOpenAI(model=settings.model_name, api_key=settings.openai_api_key, temperature=0)
    structured = llm.with_structured_output(IntakeExtraction)
    return structured.invoke([("system", SYSTEM_PROMPT), ("human", text)])


# ---- Mock: deterministic keyword rules, for tests and for running without an API key ----

_AREA_PATTERNS: list[tuple[str, str]] = [
    # Order matters: "sảnh thang máy" before "thang máy" and "sảnh"
    (r"sanh thang may", "elevator_lobby"),
    (r"hanh lang", "corridor"),
    (r"cau thang bo|thang bo", "stairwell"),
    (r"\bham\b|\bb1\b", "parking"),
    (r"thang may", "elevator_car"),
    (r"\bsanh\b", "lobby"),
]


def extract_mock(text: str) -> IntakeExtraction:
    lowered = text.lower()
    n = normalize(text)

    if "đèn" in lowered or "tối" in lowered or re.search(r"bong den|khong sang|nhap nhay|chap chon", n):
        category = "lighting"
    elif "thang may" in n:
        category = "elevator"
    elif re.search(r"ro ri|ri nuoc|ong nuoc|tran nuoc|ngap nuoc|\bnuoc\b", n):
        category = "plumbing"
    elif re.search(r"o cam|cong tac|day dien|mat dien|\bdien\b", n):
        category = "electrical"
    else:
        category = "other"

    area = next((a for pattern, a in _AREA_PATTERNS if re.search(pattern, n)), None)

    floor = None
    if area == "parking":
        floor = -1
    elif m := re.search(r"\btang\s*(\d{1,2})\b", n):
        floor = int(m.group(1))

    unit = None
    # Require "thang may": plain "thang 5" is usually "tháng 5" (May)
    if m := re.search(r"thang may\s*(?:so\s*)?(\d)\b", n):
        unit = m.group(1)
        # "thang máy số 2" means the elevator car even if the text also says "tầng"
        if area in (None, "elevator_car"):
            area = "elevator_car"

    building = None
    if m := re.search(r"\b(s\d\.\d{2})\b", n):
        building = m.group(1).upper()

    urgency = "high" if re.search(r"nguy hiem|gap|khan cap", n) else "normal"
    summary = text.strip().split("\n")[0][:200]
    return IntakeExtraction(
        category=category,
        building=building,
        floor=floor,
        area=area,
        unit=unit,
        summary=summary,
        urgency=urgency,
    )


def match_location(extraction: IntakeExtraction, locations: list[Location]) -> LocationMatch:
    """Return the single catalog location matching the extraction, or the candidates if ambiguous."""
    candidates = locations
    if extraction.building:
        candidates = [loc for loc in candidates if loc.building.lower() == extraction.building.lower()]

    if extraction.area:
        candidates = [loc for loc in candidates if loc.area == extraction.area]
    if extraction.floor is not None:
        # Elevator cars are not tied to a floor
        candidates = [loc for loc in candidates if loc.floor is None or loc.floor == extraction.floor]
    if extraction.unit:
        candidates = [loc for loc in candidates if loc.unit is None or loc.unit == extraction.unit]

    # Without an area and a floor we cannot pin a location, even if the catalog is tiny
    enough_info = extraction.area is not None and (
        extraction.floor is not None or extraction.area in ("lobby", "parking", "elevator_car")
    )
    ids = [loc.id for loc in candidates]
    if enough_info and len(ids) == 1:
        return LocationMatch(location_id=ids[0], candidates=ids)
    return LocationMatch(location_id=None, candidates=ids[:20])

"""Deterministic classification and location rules (Playbook v1.1 §6.3, §7.3; Data Contract §6.3).

CR-BPTN-02 removed the safety-signal rules and the EXCEPTION state; nothing here scores risk any more.

No model output is used here: the resident text is treated as untrusted data and only matched against
fixed patterns, so any instruction embedded in it has no effect (FR-SECURITY-001).
"""

import re
import unicodedata
from dataclasses import dataclass

from src.maintenance.enums import PlaybookId, ReasonCode, ServiceCategory, TicketType


def normalize(text: str) -> str:
    """Lowercase, strip Vietnamese diacritics and collapse whitespace so rules match typed-without-accents text."""
    text = text.lower().replace("đ", "d")
    text = "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", text).strip()


def _any(patterns: list[str], text: str) -> bool:
    return any(re.search(p, text) for p in patterns)


# --- Classification triggers ------------------------------------------------

CLEANING_PATTERNS = [
    r"\bve sinh\b",
    r"\bdon dep\b",
    r"\brac\b",
    r"\bbui\b",
    r"\bvet ban\b",
    r"\bdinh ban\b",
    r"\bbi ban\b",
    r"\bchat long\b",
    r"\bvung nuoc\b",
    r"\bchat thai\b",
    r"\bbai non\b",
    r"\bdo tran\b",
]
# "đèn" and "đến" both normalize to "den", so a bare "den" is never enough
LIGHTING_PATTERNS = [
    r"\bbong den\b",
    r"\bchieu sang\b",
    r"\bden (hanh lang|sanh|cau thang|ham|tang|khu vuc)\b",
]
NOT_WORKING_PATTERNS = [r"\bkhong sang\b", r"\bkhong hoat dong\b", r"\bhong\b", r"\bchap chon\b", r"\btat\b"]


@dataclass(frozen=True)
class Classification:
    playbook_id: PlaybookId | None
    service_category: ServiceCategory
    ticket_type: TicketType
    rule_id: str
    reason: str
    reason_code: ReasonCode | None = None  # why there is no playbook: CATEGORY_UNCLEAR or OUT_OF_SCOPE


def classify(description: str) -> Classification:
    """PB-CLN-R-TRG-01 / PB-TEC-R-TRG-01; anything else is PB-COM-R-CLS-01 (no invented playbook).

    Matching both playbooks is CATEGORY_UNCLEAR (BPTN picks one); matching none is OUT_OF_SCOPE.
    """
    text = normalize(description)
    cleaning = _any(CLEANING_PATTERNS, text)
    lighting = _any(LIGHTING_PATTERNS, text) and _any(NOT_WORKING_PATTERNS, text)
    if cleaning and not lighting:
        return Classification(
            PlaybookId.CLN,
            ServiceCategory.VE_SINH,
            TicketType.COMMON_AREA_CLEANING,
            "PB-CLN-R-TRG-01",
            "Nội dung khớp phản ánh vệ sinh khu vực chung",
        )
    if lighting and not cleaning:
        return Classification(
            PlaybookId.TEC,
            ServiceCategory.KY_THUAT,
            TicketType.COMMON_AREA_LIGHTING,
            "PB-TEC-R-TRG-01",
            "Nội dung khớp phản ánh đèn chiếu sáng khu vực chung không hoạt động",
        )
    if cleaning:
        reason, code = "khớp cả hai playbook", ReasonCode.CATEGORY_UNCLEAR
    else:
        reason, code = "không khớp playbook nào trong v1.1", ReasonCode.OUT_OF_SCOPE
    return Classification(
        None, ServiceCategory.UNKNOWN, TicketType.UNKNOWN, "PB-COM-R-CLS-01", f"Nội dung {reason}", code
    )


# --- Location proposal ------------------------------------------------------

BUILDING_PATTERN = r"\btoa ([a-z0-9]+(?:-[a-z0-9]+)*)\b"
FLOOR_PATTERN = r"\b(?:tang(?: ham)?|ham) (b?\d+)\b"
# Ordered: the longer area name must win ("sảnh thang máy" before "sảnh chính")
AREA_PATTERNS: list[tuple[str, str]] = [
    (r"\bsanh thang may\b", "Sảnh thang máy"),
    (r"\bsanh chinh\b", "Sảnh chính"),
    (r"\bhanh lang\b", "Hành lang"),
    (r"\bcau thang bo\b", "Cầu thang bộ"),
    (r"\bham( xe)?\b", "Hầm xe"),
]
IMPLIED_FLOOR = {"Sảnh chính": "1"}


def extract_location(description: str) -> str | None:
    """Propose `Tòa X / Tầng N / Khu vực` from the resident text, or None unless all three parts are found.

    A preliminary location: pipeline step 2 asks the resident for more when this is None.
    """
    building, floor, area = _location_parts(description)
    if not (building and floor and area):
        return None
    return f"Tòa {building} / Tầng {floor} / {area}"


def missing_location_parts(description: str) -> list[str]:
    """Which of building / floor / area the resident still has to give, so the request can name just those."""
    parts = _location_parts(description)
    return [name for name, value in zip(("building", "floor", "area"), parts) if value is None]


def _location_parts(description: str) -> tuple[str | None, str | None, str | None]:
    text = normalize(description)
    building = re.search(BUILDING_PATTERN, text)
    area = next((label for pattern, label in AREA_PATTERNS if re.search(pattern, text)), None)
    floor = re.search(FLOOR_PATTERN, text)
    floor_label = floor.group(1).upper() if floor else IMPLIED_FLOOR.get(area)
    return (building.group(1).upper() if building else None), floor_label, area

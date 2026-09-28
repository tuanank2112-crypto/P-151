"""Deterministic classification and risk-signal rules (Playbook v1.1 §6.3, §7.3; Data Contract §6.3).

No model output is used here: the resident text is treated as untrusted data and only matched against
fixed patterns, so any instruction embedded in it has no effect (FR-SECURITY-001).
"""

import re
import unicodedata
from dataclasses import dataclass

from src.maintenance.enums import PlaybookId, ServiceCategory, SignalStatus, TicketType


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


def classify(description: str) -> Classification:
    """PB-CLN-R-TRG-01 / PB-TEC-R-TRG-01; anything else is PB-COM-R-CLS-01 (no invented playbook)."""
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
    reason = "khớp cả hai playbook" if cleaning else "không khớp playbook nào trong v1.1"
    return Classification(None, ServiceCategory.UNKNOWN, TicketType.UNKNOWN, "PB-COM-R-CLS-01", f"Nội dung {reason}")


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

    Only a proposal: BPTN still confirms or edits it before it becomes `location_normalized`.
    """
    text = normalize(description)
    building = re.search(BUILDING_PATTERN, text)
    area = next((label for pattern, label in AREA_PATTERNS if re.search(pattern, text)), None)
    floor = re.search(FLOOR_PATTERN, text)
    floor_label = floor.group(1).upper() if floor else IMPLIED_FLOOR.get(area)
    if not (building and floor_label and area):
        return None
    return f"Tòa {building.group(1).upper()} / Tầng {floor_label} / {area}"


# --- Risk signals -----------------------------------------------------------

# Hedged wording ("hình như", "không chắc", ...) before a risk term makes the signal UNCLEAR, not PRESENT
HEDGE = r"(hinh nhu|co ve|nghi la|nghi co|khong chac|chua ro co)"

SIGNAL_TERMS: dict[str, list[str]] = {
    # PB-CLN-01
    "UNKNOWN_SUBSTANCE_PRESENT": [r"chat (long |bot |ran )?la\b", r"khong ro nguon goc", r"chat khong ro"],
    "HAZARD_SIGNAL_PRESENT": [r"mui (hac|xoc|hoa chat)", r"boc hoi", r"an mon", r"kho tho", r"cay mat"],
    # PB-TEC-01
    "BURNING_SMELL_PRESENT": [r"mui khet", r"\bkhet\b"],
    "SPARK_PRESENT": [r"tia lua", r"toe lua", r"xet dien"],
    "EXPOSED_WIRE_PRESENT": [r"ho day", r"day dien (bi )?ho", r"day (dien )?(bi )?(dut|lo ra)"],
}

SIGNALS_BY_PLAYBOOK: dict[PlaybookId, tuple[str, ...]] = {
    PlaybookId.CLN: ("UNKNOWN_SUBSTANCE_PRESENT", "HAZARD_SIGNAL_PRESENT"),
    PlaybookId.TEC: ("BURNING_SMELL_PRESENT", "SPARK_PRESENT", "EXPOSED_WIRE_PRESENT"),
}


def signal_status(signal_code: str, description: str) -> SignalStatus:
    text = normalize(description)
    terms = SIGNAL_TERMS[signal_code]
    if any(re.search(HEDGE + r"[^.]{0,25}" + term, text) for term in terms):
        return SignalStatus.UNCLEAR
    if _any(terms, text):
        return SignalStatus.PRESENT
    return SignalStatus.ABSENT


@dataclass(frozen=True)
class RiskOutcome:
    """Result of the exception rules. `exception` wins over `unclear`; neither means continue the standard flow."""

    rule_id: str | None
    exception: bool
    unclear: bool
    signals: dict[str, SignalStatus]


def rule_signals(description: str) -> dict[str, SignalStatus]:
    """All five signals from the fixed patterns, whatever the playbook."""
    return {code: signal_status(code, description) for code in SIGNAL_TERMS}


def evaluate_risk(playbook_id: PlaybookId, description: str) -> RiskOutcome:
    return evaluate_signals(playbook_id, rule_signals(description))


def evaluate_signals(playbook_id: PlaybookId, assessment: dict[str, SignalStatus]) -> RiskOutcome:
    """Apply PB-*-R-EX-01 / R-RISK-01 / R-SAFE-01 to an already-assessed signal set."""
    signals = {code: SignalStatus(assessment[code]) for code in SIGNALS_BY_PLAYBOOK[playbook_id]}
    values = list(signals.values())
    present = [v == SignalStatus.PRESENT for v in values]
    unclear = SignalStatus.UNCLEAR in values

    if playbook_id == PlaybookId.CLN:
        if all(present):
            return RiskOutcome("PB-CLN-R-EX-01", True, False, signals)
        if unclear:
            return RiskOutcome("PB-CLN-R-RISK-01", False, True, signals)
        if any(present):
            # One PRESENT + one ABSENT is not an exception; continue without claiming the area is safe
            return RiskOutcome("PB-CLN-R-SAFE-01", False, False, signals)
        return RiskOutcome(None, False, False, signals)

    if any(present):
        return RiskOutcome("PB-TEC-R-EX-01", True, False, signals)
    if unclear:
        return RiskOutcome("PB-TEC-R-RISK-01", False, True, signals)
    return RiskOutcome(None, False, False, signals)

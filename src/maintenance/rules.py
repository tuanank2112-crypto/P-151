"""Deterministic classification and location rules (Playbook v1.1 §6.3, §7.3; Data Contract §6.3).

CR-BPTN-02 removed the safety-signal rules and the EXCEPTION state; nothing here scores risk any more.

No model output is used here: the resident text is treated as untrusted data and only matched against
fixed patterns, so any instruction embedded in it has no effect (FR-SECURITY-001).
"""

import re
import unicodedata
from collections.abc import Sequence
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

# Accented words that collide with other words once diacritics are stripped. They are swapped for an ASCII
# marker BEFORE normalize(), so the accent still tells them apart ("đèn"/"đến", "bụi"/"Bùi", "bẩn"/"bận").
ACCENT_MARKERS: list[tuple[str, str]] = [
    (r"\bđèn\b", "luminaire"),
    (r"\bđến\b", "arrive"),
    (r"\bcháy\b", "burnt"),  # "cháy" (burnt out), not "chạy"/"chảy"; step 2b already stopped any real fire
    (r"\bbùi\b", "surname"),
    (r"\bbận\b", "busy"),
    (r"\b(?:bẩn|dơ)\b", "dirty"),
    (r"\bphân\b", "feces"),
    (r"\bnôn\b", "vomit"),
]


def _classification_text(description: str) -> str:
    """Normalize for classification only; `extract_location` keeps using plain `normalize`."""
    text = unicodedata.normalize("NFC", description).lower()
    for pattern, marker in ACCENT_MARKERS:
        text = re.sub(pattern, marker, text)
    return normalize(text)


CLEANING_PATTERNS = [
    r"\bve sinh\b",
    r"\bdon dep\b",
    r"\brac\b",
    r"\bbui\b(?! van\b| thi\b)",  # not a surname ("Bui Van An"); accented "Bùi" is already a marker
    r"\bvet ban\b",
    r"\bdinh ban\b",
    r"\bbi ban\b",
    r"\bchat long\b",
    r"\bvung nuoc\b",
    r"\bchat thai\b",
    r"\bbai non\b",
    r"\bdo tran\b",
]
# Softer words ("bẩn", "phân", "nôn"...) only count when a common area is named, so chatter about anything
# else cannot trigger the cleaning playbook
SOFT_CLEANING_PATTERNS = [r"\bdirty\b", r"\bfeces\b", r"\bvomit\b", r"\bnuoc tieu\b"]
COMMON_AREA_PATTERNS = [
    r"\bhanh lang\b",
    r"\bsanh\b",
    r"\bcau thang\b",
    r"\bthang bo\b",
    r"\bham\b",
    r"\bkhu vuc\b",
    r"\bphong rac\b",
    r"\bbai (?:do |dau )?xe\b",
    r"\bnha xe\b",
    r"\bsan (?:choi|thuong)\b",
    r"\bloi di\b",
]
# Unaccented "den" is ambiguous ("đèn"/"đến"/"đen"): it needs an area right after and no arrival verb before it
LIGHTING_PATTERNS = [
    r"\bbong (?:den|luminaire)\b",
    r"\bchieu sang\b",
    r"(?<!khi )(?<!di )(?<!toi )\bden (hanh lang|sanh|cau thang|ham|tang|khu vuc)\b",
]
# Accented "đèn" is unambiguous: with a common area named anywhere in the report it is a common-area lamp
# ("Cầu thang bộ tầng 6 đèn bị hỏng", "Hầm B2 đèn tắt hết"). A report with dirt as well is CATEGORY_UNCLEAR.
LUMINAIRE = r"\bluminaire\b"
LUMINAIRE_LOST = r"\bmat luminaire\b"
# Q22: "bóng đèn … bị cháy" is a burnt-out lamp (2b ran first: a real fire never reaches classification)
LAMP_BURNT = r"\b(?:bong|luminaire|tuyp)\b(?: [a-z0-9-]+){0,10}? (?:burnt|(?:bi|da) chay)\b"
NOT_WORKING_PATTERNS = [
    LAMP_BURNT,
    r"\bkhong sang\b",
    r"\bkhong len\b",
    r"\bkhong hoat dong\b",
    r"\bhong\b",
    r"\bhu\b",
    r"\bvo\b",
    r"\bnhap nhay\b",
    LUMINAIRE_LOST,
    r"\bchap chon\b",
    r"\btat\b",
]


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
    text = _classification_text(description)
    in_common_area = _any(COMMON_AREA_PATTERNS, text)
    cleaning = _any(CLEANING_PATTERNS, text) or (in_common_area and _any(SOFT_CLEANING_PATTERNS, text))
    lit_subject = _any(LIGHTING_PATTERNS, text) or (in_common_area and re.search(LUMINAIRE, text))
    lighting = bool(lit_subject) and _any(NOT_WORKING_PATTERNS, text)
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

FLOOR_PATTERN = r"\b(?:tang(?: ham)?|ham|lau) (b?\d+|tret)\b"
FLOOR_LABELS = {"TRET": "Trệt"}  # "tầng trệt" (ground floor)
# Ordered: the longer area name must win ("sảnh thang máy" before "sảnh chính"; "hầm" before "bãi đỗ xe", so
# "Tầng hầm B1 / Bãi đỗ xe" keeps the label the asset catalog uses). The labels the UI used to offer are all here.
AREA_PATTERNS: list[tuple[str, str]] = [
    (r"\bsanh thang may\b", "Sảnh thang máy"),
    (r"\bsanh chinh\b", "Sảnh chính"),
    (r"\bsanh cu dan\b", "Sảnh cư dân"),
    (r"\bhanh lang\b", "Hành lang"),
    (r"\b(?:cau )?thang bo\b", "Cầu thang bộ"),
    (r"\bham( xe)?\b", "Hầm xe"),
    (r"\bphong rac\b", "Phòng rác"),
    (r"\b(?:bai (?:do |dau )?xe|nha xe)\b", "Bãi đỗ xe"),
    (r"\bsan choi\b", "Sân chơi"),
    (r"\bsan thuong\b", "Sân thượng"),
    (r"\bloi di\b", "Lối đi"),
]
# Areas that only exist on one floor: the resident does not have to name the floor
IMPLIED_FLOOR = {"Sảnh chính": "1", "Sảnh cư dân": "1"}


def extract_location(description: str, buildings: Sequence[str]) -> str | None:
    """Propose `Tòa X / Tầng N / Khu vực` from the resident text, or None unless all three parts are found.

    Only a building in `buildings` (catalog `site.buildings`) counts; any other one is treated as missing.
    A preliminary location: pipeline step 2 asks the resident for more when this is None.
    """
    building, floor, area = _location_parts(description, buildings)
    if not (building and floor and area):
        return None
    return f"Tòa {building} / Tầng {floor} / {area}"


def missing_location_parts(description: str, buildings: Sequence[str]) -> list[str]:
    """Which of building / floor / area the resident still has to give, so the request can name just those."""
    parts = _location_parts(description, buildings)
    return [name for name, value in zip(("building", "floor", "area"), parts) if value is None]


def _building_pattern(buildings: Sequence[str]) -> str:
    """A known building code, with or without "tòa"/"tòa nhà"/"block" in front ("tòa S1", "S1"), keeping a
    sub-building ("S1.12"). Only catalog codes match, so words like "tòa nhà tầng 3" never become a building.

    Longer codes are tried first.
    """
    codes = sorted((re.escape(normalize(b)) for b in buildings), key=len, reverse=True)
    return rf"(?<![a-z0-9-])(?:(?:toa(?: nha)?|block) )?((?:{'|'.join(codes)})(?:\.\d{{1,2}})?)(?![a-z0-9-]|\.\d)"


def _location_parts(description: str, buildings: Sequence[str]) -> tuple[str | None, str | None, str | None]:
    text = normalize(description)
    building = re.search(_building_pattern(buildings), text)
    area = next((label for pattern, label in AREA_PATTERNS if re.search(pattern, text)), None)
    floor = re.search(FLOOR_PATTERN, text)
    floor_label = FLOOR_LABELS.get(floor.group(1).upper(), floor.group(1).upper()) if floor else IMPLIED_FLOOR.get(area)
    return (building.group(1).upper() if building else None), floor_label, area

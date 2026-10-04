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
    (r"\bmờ\b", "dim"),  # not "mở" (a lamp left on)
    (r"\b(?:rơi|rớt)\b", "fall"),  # not "rồi"
    (r"\bnổ\b", "explode"),  # not "nó"
    (r"\bđầy\b", "full"),  # not "dãy" (a row of lamps)
    (r"\btràn\b", "overflow"),  # not "trần" (ceiling)
]
# Location names that contain a trigger word: they are swapped for a neutral area marker, so where the resident
# stands never picks the job type ("Phòng rác: đèn chập chờn" is a lamp, not rubbish). Plan 05 Q01.
LOCATION_MARKERS: list[tuple[str, str]] = [(r"\bphong rac\b", "garbageroom")]


def _classification_text(description: str) -> str:
    """Normalize for classification only; `extract_location` keeps using plain `normalize`."""
    text = unicodedata.normalize("NFC", description).lower()
    for pattern, marker in ACCENT_MARKERS:
        text = re.sub(pattern, marker, text)
    text = normalize(text)
    for pattern, marker in LOCATION_MARKERS:
        text = re.sub(pattern, marker, text)
    return text


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
    r"\bdo (?:tran|overflow)\b",
]
# Softer words ("bẩn", "phân", "nôn"...) only count when a common area is named, so chatter about anything
# else cannot trigger the cleaning playbook
# Things spilt on the floor: "sơn đổ", "sữa đổ ra sàn", "dầu mỡ đổ loang" (also typed without accents)
SPILT = r"\b(?:son|sua|ca phe|nuoc(?: ngot| canh)?|dau(?: mo| an)?|bia|chao)(?: [a-z]+)?? (?:do|tran|overflow|loang)\b"
SOFT_CLEANING_PATTERNS = [
    r"\bdirty\b",
    r"\bfeces\b",
    r"\bvomit\b",
    r"\bnuoc tieu\b",
    # plan 05: what residents actually write (accented or not); every one still needs a common area named
    r"(?<!toi )(?<!em )(?<!minh )(?<!anh )(?<!chi )\b(?:ban|do) (?:qua|lam|thiu|kinh khung)\b",  # not "tôi bận quá"
    r"\brat (?:ban|do)\b",
    r"\bban thiu\b",
    r"\b(?:nuoc|vung) dong\b",
    r"\bdong nuoc\b",
    r"\bnuoc (?:ban|thai)\b",
    r"\blenh lang\b",
    r"\bsan (?:[a-z]+ )?tron\b",
    r"\btron truot\b",
    r"\bmui (?:hoi|thoi|khai|tanh|kho chiu)\b",
    r"\bboc mui\b",
    r"\bhoi thoi\b",
    r"\bphan (?:cho|meo|chim|chuot|nguoi)\b",  # unaccented "phân"; "Phan Văn Tài" is not followed by these
    r"\bnon (?:ra|mua)\b",
    r"\bla (?:cay|kho|rung)\b",
    r"\bmang nhen\b",
    r"\bdau mo\b",
    SPILT,
    r"\bkinh\b(?: [a-z]+){0,3}? (?:dirty|ban|bam bui)\b",
    r"\bvo (?:chai|lon|hop|banh|keo)\b",
    r"\b(?:dau loc|tan|mau|dau) thuoc\b",
    r"\bgiay vun\b",
    r"\bvuong vai\b",
    r"\bvut (?:bua|lung tung|day|full)\b",
    r"\bkeo cao su\b",
    r"\b(?:dat cat|bun dat|dat bun)\b",
    r"\blong (?:cho|meo)\b",
    r"\breu\b",
    r"\bthung carton\b",
    r"\bnhop(?: nhap)?\b",
    r"\b(?:khong|chua) ai (?:lau|don)\b",  # not "không lâu sau"
    r"\bchua (?:duoc )?don\b",
    # the garbage room itself overflowing: accented "đầy"/"tràn" anywhere, unaccented only right after it
    r"\bgarbageroom\b.*\b(?:full|overflow)\b",
    r"\b(?:full|overflow)\b.*\bgarbageroom\b",
    r"\bgarbageroom (?:(?:tang|lau|toa|block|ham) [a-z0-9-]+ )*(?:bi |da |qua )?(?:day|tran|ngap)\b",
]
COMMON_AREA_PATTERNS = [
    r"\bhanh lang\b",
    r"\bsanh\b",
    r"\bcau thang\b",
    r"\bthang bo\b",
    r"\bham\b",
    r"\bkhu vuc\b",
    r"\bgarbageroom\b",
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
# Unaccented "den" a few words before a lamp symptom ("den chap chon", "den exit thoat hiem khong sang") is a lamp
# too when a common area is named; arrival ("khi den", "toi den noi") is excluded as above.
NOT_WORKING_WORDS = (
    r"(?:chap chon|nhap nhay|nhay nhay|chop|tat|hong|hu|vo|chet|dut|khong (?:sang|len|bat|hoat dong)"
    r"|bat khong (?:len|sang)|sang (?:yeu|lo mo)|lo mo|mo qua|toi (?:om|thui|mu)|roi xuong|rot|bi no|lung lang|re re|bi chay|chay bong)"
)
UNACCENTED_LAMP = rf"(?<!khi )(?<!di )(?<!toi )(?<!moi )(?<!vua )\bden(?: [a-z]+){{0,3}}? {NOT_WORKING_WORDS}\b"
# A lamp inside a flat or out on the street is not a common-area lamp (Playbook §7.1), even when the resident
# also names where they live ("Tòa SIM-A tầng 3 hành lang: đèn trong căn hộ tôi bị hỏng")
PRIVATE_LAMP_PATTERNS = [
    r"\b(?:luminaire|den|tuyp) (?:(?:trong|cua|o|tai) )?(?:can ho|nha (?:toi|minh|em)|phong (?:ngu|khach|tam)|nha tam|nha bep)\b",
    r"\b(?:can ho|nha) (?:toi|minh|em),? (?:luminaire|bong (?:den|luminaire))\b",
]
# A fluorescent tube is a lamp even without "đèn" ("bóng tuýp chết", "tuýp chập chờn"); like the other lamp words
# it needs a common area. Darkness alone ("tối om") is NOT a lamp: it may be a power cut, so it stays with the LLM.
TUBE_LAMP = r"\btuyp\b"
OUTSIDE_PATTERNS = [r"\bngoai (?:cong|khuon vien)\b", r"\bduong pho\b", r"\bvia he\b"]
# Accented "đèn" is unambiguous: with a common area named anywhere in the report it is a common-area lamp
# ("Cầu thang bộ tầng 6 đèn bị hỏng", "Hầm B2 đèn tắt hết"). A report with dirt as well is CATEGORY_UNCLEAR.
LUMINAIRE = r"\bluminaire\b"
LUMINAIRE_LOST = r"\bmat (?:luminaire|den)\b"  # "mất đèn", also typed without accents (needs a common area)
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
    # plan 05: flicker / dim / dead / fallen lamps as residents write them
    r"\b(?:nhay nhay|chop)\b",
    r"\bkhong (?:chiu |tu )?bat\b",
    r"\bbat khong (?:len|sang|duoc)\b",
    r"\b(?:sang )?yeu\b",
    r"\b(?:dim|lo mo|mo qua)\b",
    r"\btoi (?:om|thui|mu)\b",
    r"\b(?:explode|bi no|no tung)\b",
    r"\b(?:fall|roi xuong|rot)\b",
    r"\b(?:dut|chet)\b",
    r"\b(?:lung lang|re re)\b",
    r"\b(?:bong (?:den|luminaire) chay|chay bong)\b",  # Q22 typed without accents: "bong den chay roi"
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
    lit_subject = _any(LIGHTING_PATTERNS, text) or (
        in_common_area and _any([LUMINAIRE, UNACCENTED_LAMP, LUMINAIRE_LOST, TUBE_LAMP], text)
    )
    not_common_lamp = _any(PRIVATE_LAMP_PATTERNS, text) or _any(OUTSIDE_PATTERNS, text)
    lighting = bool(lit_subject) and _any(NOT_WORKING_PATTERNS, text) and not not_common_lamp
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

# "tòa nhà SIM-A" and "block SIM-A" name the building too; "nhà" and the words that start another location part
# ("tòa nhà tầng 3", "tòa hành lang") are never the building code
BUILDING_PATTERN = (
    r"\b(?:toa(?: nha)?|block) (?!(?:nha|tang|lau|ham|hanh|sanh|cau|thang|khu|phong|bai|san|loi|nay|do|kia)\b)"
    r"([a-z0-9]+(?:-[a-z0-9]+)*)\b"
)
FLOOR_PATTERN = r"\b(?:tang(?: ham)?|ham|lau) (b?\d+|tret)\b"
FLOOR_LABELS = {"TRET": "Trệt"}  # "tầng trệt" (ground floor)
# Ordered: the longer area name must win ("sảnh thang máy" before "sảnh chính"; "hầm" before "bãi đỗ xe", so
# "Tầng hầm B1 / Bãi đỗ xe" keeps the label the asset catalog uses). The labels the UI used to offer are all here.
AREA_PATTERNS: list[tuple[str, str]] = [
    (r"\bsanh thang may\b", "Sảnh thang máy"),
    (r"\bsanh chinh\b", "Sảnh chính"),
    (r"\bhanh lang\b", "Hành lang"),
    (r"\b(?:cau )?thang bo\b", "Cầu thang bộ"),
    (r"\bham( xe)?\b", "Hầm xe"),
    (r"\bphong rac\b", "Phòng rác"),
    (r"\b(?:bai (?:do |dau )?xe|nha xe)\b", "Bãi đỗ xe"),
    (r"\bsan choi\b", "Sân chơi"),
    (r"\bsan thuong\b", "Sân thượng"),
    (r"\bloi di\b", "Lối đi"),
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
    floor_label = FLOOR_LABELS.get(floor.group(1).upper(), floor.group(1).upper()) if floor else IMPLIED_FLOOR.get(area)
    return (building.group(1).upper() if building else None), floor_label, area

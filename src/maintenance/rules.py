"""Deterministic classification and location rules (Playbook v1.1 §6.3, §7.3; Data Contract §6.3).

CR-BPTN-02 removed the safety-signal rules and the EXCEPTION state; nothing here scores risk any more.

No model output is used here: the resident text is treated as untrusted data and only matched against
fixed patterns, so any instruction embedded in it has no effect (FR-SECURITY-001).
"""

import re
import unicodedata
from collections.abc import Sequence
from dataclasses import dataclass

from src.maintenance.enums import SPLIT_PAIR, PlaybookId, ReasonCode, ServiceCategory, TicketType


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
    r"\bloi thoat hiem\b",
    r"\b(?:trong|buong|cabin|long) thang may\b",  # the lift cabin (same words as AREA_PATTERNS)
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
    r"|bat khong (?:len|sang)|sang (?:yeu|lo mo)|lo mo|mo qua|toi (?:om|thui|mu)|roi xuong|rot|bi no|lung lang|re re|bi chay|chay bong"
    r"|bi chap|chap(?: dien| mach)?)"
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
    r"\bchap(?: dien| mach)?\b(?! chon\b| nhan\b| hanh\b)",  # plan 05b: "đèn bị chập" = broken lamp (not "chấp nhận")
    r"\b(?:bi|da) chay\b",  # plan 05b: "den hanh lang ... bi chay" typed without accents (2b already caught a real fire)
]
# Plan 05 H04 (d): liquid reaching electrical equipment, or bare wires, is neither a spill to mop up nor an ordinary
# broken lamp. The report gets no playbook (OUT_OF_SCOPE, BPTN reads it); the safety step 2b runs first and is the
# real guard, this is the second line of defence so such a report is never dispatched as routine work.
ELECTRICAL_EQUIPMENT = r"(?:tu dien|o dien|hop dien|o cam|cong tac|cau dao|bang dien)"
LIQUID = r"(?:nuoc|chat long|overflow|tran|ngap|ro ri|ri nuoc|tham)"
ELECTRICAL_HAZARD_PATTERNS = [
    rf"\b{LIQUID}\b(?: [a-z]+){{0,5}}? {ELECTRICAL_EQUIPMENT}\b",  # "nước tràn vào tủ điện", "ngập gần tới ổ cắm"
    rf"\b{ELECTRICAL_EQUIPMENT}(?: [a-z]+){{0,4}}? (?:bi )?(?:ngap|uot|dong nuoc|ngam nuoc|vao nuoc)\b",
    r"\b(?:loi|lo|ho)(?: ca| ra| het)? (?:ca )?day dien\b",  # "lòi cả dây điện", "lộ dây điện"
    r"\bday dien(?: [a-z]+){0,5}? (?:loi|lo|ho|bi ho)\b",  # "dây điện chỗ đèn lòi ra ngoài"
]


@dataclass(frozen=True)
class Classification:
    playbook_id: PlaybookId | None
    service_category: ServiceCategory
    ticket_type: TicketType
    rule_id: str
    reason: str
    reason_code: ReasonCode | None = None  # why there is no playbook: CATEGORY_UNCLEAR or OUT_OF_SCOPE


def _matches_both(text: str) -> tuple[bool, bool]:
    """(cleaning, lighting): whether the already normalised classification text matches each playbook.

    One definition for `classify`, `category_evidence` and `split_verdict`, so the evidence the Agent is checked
    against can never drift from the classification itself (plan 06 SPEC-P05 section 2.1).
    """
    in_common_area = _any(COMMON_AREA_PATTERNS, text)
    cleaning = _any(CLEANING_PATTERNS, text) or (in_common_area and _any(SOFT_CLEANING_PATTERNS, text))
    lit_subject = _any(LIGHTING_PATTERNS, text) or (
        in_common_area and _any([LUMINAIRE, UNACCENTED_LAMP, LUMINAIRE_LOST, TUBE_LAMP], text)
    )
    not_common_lamp = _any(PRIVATE_LAMP_PATTERNS, text) or _any(OUTSIDE_PATTERNS, text)
    lighting = bool(lit_subject) and _any(NOT_WORKING_PATTERNS, text) and not not_common_lamp
    return bool(cleaning), bool(lighting)


def classify(description: str) -> Classification:
    """PB-CLN-R-TRG-01 / PB-TEC-R-TRG-01; anything else is PB-COM-R-CLS-01 (no invented playbook).

    Matching both playbooks is CATEGORY_UNCLEAR (BPTN picks one); matching none is OUT_OF_SCOPE.
    """
    text = _classification_text(description)
    if _any(ELECTRICAL_HAZARD_PATTERNS, text):
        return Classification(
            None,
            ServiceCategory.UNKNOWN,
            TicketType.UNKNOWN,
            "PB-COM-R-CLS-01",
            "Nội dung có chất lỏng ở thiết bị điện hoặc dây điện hở: không thuộc playbook nào trong v1.1",
            ReasonCode.OUT_OF_SCOPE,
        )
    cleaning, lighting = _matches_both(text)
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


def mentions_playbook_subject(description: str) -> bool:
    """Whether the report talks about a lamp or about dirt at all, even with no common area named yet ("Đèn tầng 3
    hỏng", "Nhiều rác quá"). Such a report is in scope once located, so the resident is asked for the location;
    only a report about neither may skip that question (plan 05 Q05)."""
    text = _classification_text(description)
    if _any(ELECTRICAL_HAZARD_PATTERNS, text) or _any(PRIVATE_LAMP_PATTERNS, text) or _any(OUTSIDE_PATTERNS, text):
        return False
    dirt = _any(CLEANING_PATTERNS, text) or _any(SOFT_CLEANING_PATTERNS, text)
    lamp = _any([*LIGHTING_PATTERNS, LUMINAIRE, UNACCENTED_LAMP, LUMINAIRE_LOST, TUBE_LAMP], text)
    return bool(dirt or lamp)


# --- Location proposal ------------------------------------------------------

FLOOR_PATTERN = r"\b(?:tang(?: ham)?|ham|lau) (b?\d+|tret)\b"
FLOOR_LABELS = {"TRET": "Trệt"}  # "tầng trệt" (ground floor)
# Ordered: the longer area name must win ("sảnh thang máy" before "sảnh chính"; "hầm" before "bãi đỗ xe", so
# "Tầng hầm B1 / Bãi đỗ xe" keeps the label the asset catalog uses). The labels the UI used to offer are all here.
# "cầu thang" alone is the staircase ("cầu thang tầng 5"), never "cầu thang máy".
AREA_PATTERNS: list[tuple[str, str]] = [
    (r"\bsanh thang may\b", "Sảnh thang máy"),
    (r"\bsanh chinh\b", "Sảnh chính"),
    (r"\bsanh cu dan\b", "Sảnh cư dân"),
    (r"\bhanh lang\b", "Hành lang"),
    (r"\bloi thoat hiem\b", "Lối thoát hiểm"),
    (r"\b(?:cau thang(?! may\b)|thang bo)\b", "Cầu thang bộ"),
    (r"\bham( xe)?\b", "Hầm xe"),
    (r"\bphong rac\b", "Phòng rác"),
    (r"\b(?:bai (?:do |dau )?xe|nha xe)\b", "Bãi đỗ xe"),
    (r"\bsan choi\b", "Sân chơi"),
    (r"\bsan thuong\b", "Sân thượng"),
    (r"\bloi di\b", "Lối đi"),
    (
        r"\b(?:trong|buong|cabin|long) thang may\b",
        "Thang máy",
    ),  # inside the cabin only: "trước/cạnh thang máy" is a landmark
]
# Areas that only exist on one floor: the resident does not have to name the floor.
# A lift cabin moves between floors, so its "floor" is the placeholder "—" (one cabin problem = one location per building)
IMPLIED_FLOOR = {"Sảnh chính": "1", "Sảnh cư dân": "1", "Thang máy": "—"}


def location_area(location: str | None) -> str | None:
    """Area label (AREA_PATTERNS) of a `Tòa X / Tầng N / Khu vực` location, read from its last part; None if none.

    Asset lookup matches on this alone (plan 14): one lighting asset per area, whatever the building and floor.
    """
    if not location:
        return None
    last = location.rsplit("/", 1)[-1].strip()
    if last in AREA_LABELS:  # already the canonical label ("Thang máy" no longer matches its own text pattern)
        return last
    text = normalize(last)
    return next((label for pattern, label in AREA_PATTERNS if re.search(pattern, text)), None)


AREA_LABELS: frozenset[str] = frozenset(label for _, label in AREA_PATTERNS)


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


# Where the resident LIVES is not where the problem is (plan 05 H04): "Căn 1508 tầng 15 tòa SIM-A, báo giúp hành
# lang tầng 3 có rác", "Em ở tòa SIM-B, đi qua hành lang tầng 3 tòa SIM-A". A residence clause starts at one of
# these cues and ends at punctuation, a line break or a reporting verb.
RESIDENCE_CUE = r"\b(?:can(?: ho)?(?: so)? [a-z]?\d[a-z0-9-]*|can ho|phong \d[a-z0-9-]*|(?:em|toi|minh|anh|chi) o|nha (?:toi|em|minh))\b"
CLAUSE_END = r"[,.;:!?]| - |\b(?:bao|nho|thay|di qua|di ngang|nhan|phan anh|xin|va)\b"


def _residence_spans(text: str, areas: list[re.Match]) -> list[tuple[int, int]]:
    """Clauses naming the resident's home. A clause that also names a common area is where the resident stands
    ("Em ở tòa SIM-B tầng 9 hành lang, báo: …"), so it is not a residence clause."""
    spans = []
    for cue in re.finditer(RESIDENCE_CUE, text):
        end = re.compile(CLAUSE_END).search(text, cue.end())
        span = (cue.start(), end.start() if end else len(text))
        if not any(span[0] <= a.start() < span[1] for a in areas):
            spans.append(span)
    return spans


def _pick(matches: list[re.Match], spans: list[tuple[int, int]], anchor: re.Match | None) -> re.Match | None:
    """The mention closest to the area, outside the residence clauses; the first one when no area is named."""
    candidates = [m for m in matches if not any(s <= m.start() < e for s, e in spans)]
    if not candidates:
        return None
    if anchor is None:
        return candidates[0]
    return min(candidates, key=lambda m: abs(m.start() - anchor.start()))


def _floor_label(raw: str) -> str:
    """'03' -> '3', 'b01' -> 'B1', 'tret' -> 'Trệt'."""
    raw = raw.upper()
    if raw in FLOOR_LABELS:
        return FLOOR_LABELS[raw]
    prefix, digits = ("B", raw[1:]) if raw.startswith("B") else ("", raw)
    return f"{prefix}{int(digits)}"


def _location_parts(description: str, buildings: Sequence[str]) -> tuple[str | None, str | None, str | None]:
    """Building / floor / area of the PROBLEM.

    Rules (plan 05 H04 a): the area is the first label in AREA_PATTERNS order; building and floor are the mentions
    closest to that area, skipping mentions inside a residence clause (RESIDENCE_CUE). Only `buildings`
    (catalog `site.buildings`) are building mentions. A residence building is still
    used when no other building is named (residents report in their own building); a residence floor never is: the
    resident is asked instead of the job being sent to their flat's floor.
    """
    text = normalize(description.replace("\n", ". "))
    area_match, area = next(
        ((m, label) for pattern, label in AREA_PATTERNS if (m := re.search(pattern, text))), (None, None)
    )
    areas = [m for pattern, _ in AREA_PATTERNS for m in re.finditer(pattern, text)]
    spans = _residence_spans(text, areas)
    mentions = list(re.finditer(_building_pattern(buildings), text))
    building = _pick(mentions, spans, area_match) or _pick(mentions, [], area_match)
    floor = _pick(list(re.finditer(FLOOR_PATTERN, text)), spans, area_match)
    floor_label = _floor_label(floor.group(1)) if floor else IMPLIED_FLOOR.get(area)
    code = building.group(1).upper() if building else None
    return code, floor_label, area


# --- Evidence for the reasoning Agent (plan 06 SPEC-P01 / SPEC-P05 section 2) ---------------------------------------
# The Agent decides; these functions only say what the fixed rules see, so the engine can compare (disagreement table
# G-1..G-9) and so a split still works when there is no Agent. None of them changes `classify`.


def category_evidence(description: str) -> frozenset[ServiceCategory]:
    """R: the categories the fixed rules find in the text (cleaning, lighting). Raw evidence: no electrical-hazard
    branch (that is `electrical_hazard`), so a report both playbooks match gives both categories."""
    cleaning, lighting = _matches_both(_classification_text(description))
    found: set[ServiceCategory] = set()
    if cleaning:
        found.add(ServiceCategory.VE_SINH)
    if lighting:
        found.add(ServiceCategory.KY_THUAT)
    return frozenset(found)


def electrical_hazard(description: str) -> bool:
    """Liquid at electrical equipment or bare wires (the patterns `classify` stops on)."""
    return _any(ELECTRICAL_HAZARD_PATTERNS, _classification_text(description))


@dataclass(frozen=True)
class SplitVerdict:
    categories: tuple[ServiceCategory, ...]  # SPLIT_PAIR when the report holds two independent jobs, else ()
    reason: str  # "split" or the rule that blocked: "electrical-hazard" | "not-both" | "marker:<phrase>" | ...


# R-S3: words that make one job the cause or effect of the other, or the report unsure. Accented forms are compared on
# NFC lowercase text, unaccented forms on `normalize`d text, so a missing accent never invents a marker.
CAUSAL_ACCENTED = (
    "nên",
    "vì",
    "bởi",
    "do",
    "khiến",
    "làm cho",
    "dẫn đến",
    "gây ra",
    "không thấy",
    "mảnh vỡ",
    "mảnh kính",
)
HEDGE_ACCENTED = ("hình như", "có vẻ", "không biết", "không rõ", "chắc là", "có lẽ", "nghi là", "hay là", "hoặc")
CAUSAL_FOLDED = (
    "nen",
    "vi",
    "boi",
    "do",
    "khien",
    "lam cho",
    "dan den",
    "gay ra",
    "khong thay",
    "manh vo",
    "manh kinh",
)
HEDGE_FOLDED = ("hinh nhu", "co ve", "khong biet", "khong ro", "chac la", "co le", "nghi la", "hay la", "hoac")


def _has_phrase(text: str, phrases: tuple[str, ...]) -> str | None:
    for phrase in phrases:
        if re.search(r"(?<!\w)" + re.escape(phrase) + r"(?!\w)", text):
            return phrase
    return None


def _has_no_accent(text: str) -> bool:
    folded = unicodedata.normalize("NFD", text.replace("đ", "d").replace("Đ", "D"))
    return all(unicodedata.category(c) != "Mn" for c in folded)


def location_mentions(
    description: str, buildings: Sequence[str]
) -> tuple[frozenset[str], frozenset[str], frozenset[str]]:
    """Distinct (area labels, floors, buildings) named outside the residence clauses. A "tầng hầm B1" is a floor,
    not an area label."""
    text = normalize(description.replace("\n", ". "))
    areas = [m for pattern, _ in AREA_PATTERNS for m in re.finditer(pattern, text)]
    spans = _residence_spans(text, areas)

    def outside(m: re.Match) -> bool:
        return not any(s <= m.start() < e for s, e in spans)

    floor_matches = [m for m in re.finditer(FLOOR_PATTERN, text) if outside(m)]
    floor_spans = [m.span() for m in floor_matches]

    def inside_floor(m: re.Match) -> bool:
        return any(a <= m.start() and m.end() <= b for a, b in floor_spans)

    labels = {
        label
        for pattern, label in AREA_PATTERNS
        for m in re.finditer(pattern, text)
        if outside(m) and not inside_floor(m)
    }
    floors = {m.group(1).lstrip("0") or "0" for m in floor_matches}
    found_buildings = {
        m.group(1).replace(" ", "-") for m in re.finditer(_building_pattern(buildings), text) if outside(m)
    }
    return frozenset(labels), frozenset(floors), frozenset(found_buildings)


def split_verdict(description: str, buildings: Sequence[str]) -> SplitVerdict:
    """Whether the report holds TWO independent jobs (cleaning + lighting) at ONE place. Conservative: the first
    blocking rule wins (R-S1..R-S5, SPEC-P05 section 2.2); a wrong split is worse than none."""
    text = _classification_text(description)
    if _any(ELECTRICAL_HAZARD_PATTERNS, text):
        return SplitVerdict((), "electrical-hazard")
    cleaning, lighting = _matches_both(text)
    if not (cleaning and lighting):
        return SplitVerdict((), "not-both")
    raw = unicodedata.normalize("NFC", description).lower()
    folded = normalize(description)
    building_pattern = _building_pattern(buildings)
    for pattern in [p for p, _ in AREA_PATTERNS] + [FLOOR_PATTERN, building_pattern]:
        folded = re.sub(pattern, " ", folded)  # "bai do xe" is a place, not the cause word "do"
    if _has_no_accent(description):
        hit = _has_phrase(folded, CAUSAL_FOLDED) or _has_phrase(folded, HEDGE_FOLDED)
    else:
        hit = _has_phrase(raw, CAUSAL_ACCENTED) or _has_phrase(raw, HEDGE_ACCENTED)
    if hit:
        return SplitVerdict((), f"marker:{hit}")
    if "?" in description:
        return SplitVerdict((), "question")
    labels, floors, found_buildings = location_mentions(description, buildings)
    if len(labels) > 1 or len(floors) > 1 or len(found_buildings) > 1:
        return SplitVerdict((), "two-places")
    return SplitVerdict(SPLIT_PAIR, "split")

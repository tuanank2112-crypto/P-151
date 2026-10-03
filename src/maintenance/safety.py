"""Safety layer, pipeline step 3b (CR-BPTN-03 §6).

Fixed rules decide; a model may only raise a signal, never lower it (§6.1.1). The resident text is untrusted data: it
is only matched against fixed patterns here, so an instruction inside it changes nothing.

Patterns are written in Vietnamese with diacritics. Each accented letter compiles to a class of itself and its bare
letter, so a report typed with diacritics matches exactly ("chạy" is not "cháy", "khỏi" is not "khói") while a report
typed without them still matches. Exclusions written without diacritics therefore only apply to bare text, where the
ambiguity lives.

Every match is kept as a `RiskSignal` with its quote, including ABSENT ones (negated, or the benign B-01 reading), so
a reviewer can see why a ticket was or was not flagged. Nothing here diagnoses, advises or picks a department.
"""

import re
import unicodedata
from collections.abc import Sequence
from dataclasses import dataclass, field

from src.maintenance.enums import RiskLevel, SignalStatus
from src.maintenance.models import RiskSignal
from src.maintenance.rules import normalize

PRESENT, ABSENT, UNCLEAR = SignalStatus.PRESENT, SignalStatus.ABSENT, SignalStatus.UNCLEAR


def _bare(char: str) -> str:
    if char in "đĐ":
        return "d"
    return "".join(c for c in unicodedata.normalize("NFD", char) if unicodedata.category(c) != "Mn")


def _vi(pattern: str) -> re.Pattern[str]:
    """Compile a Vietnamese pattern so accented letters also match their bare letter (see module docstring)."""
    out = []
    for char in pattern:
        bare = _bare(char)
        out.append(f"[{char}{bare}]" if bare != char and bare.isalpha() else char)
    return re.compile("".join(out))


def vi_any(patterns: Sequence[str]) -> re.Pattern[str]:
    return _vi("|".join(f"(?:{p})" for p in patterns))


def clean(text: str) -> str:
    """Lowercase, NFC, single spaces. Diacritics are kept (see `_vi`)."""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", text.lower())).strip()


_CLAUSE = re.compile(r"[^.,;!?\n]+")

# Negation (B-02). Either right before the signal ("không khét"), or opened by "không có / chưa thấy / ..." earlier in
# the clause and running to its end or to a contrast word ("không thấy tia lửa hay khói gì" negates both).
# "đèn không sáng và có tia lửa" stays PRESENT: "không sáng" does not open a negated region.
_NEG = r"\b(?:không|chưa|chẳng|ko|hông|hok|k)"
_NEGATION = _vi(_NEG + r"\s*$")
_NEGATION_OPEN = _vi(_NEG + r"(?:\s+(?:hề|có|thấy|ngửi thấy|ngửi|nghe thấy|nghe|bị|còn|xuất hiện|phát hiện|hiện))+\b")
_CONTRAST = _vi(r"\b(?:nhưng|mà|còn|tuy nhiên|song|lại)\b")
_HEDGE = vi_any([r"\bhình như\b", r"\bcó vẻ\b", r"\bcó lẽ\b", r"\bnghi\b", r"\bkhông chắc\b", r"\bnghe như\b"])
_PAST = vi_any([r"\bhôm qua\b", r"\bhôm trước\b", r"\btuần trước\b", r"\blúc trước\b", r"\btrước đó\b", r"\bđã từng\b"])
_OVER_NOW = vi_any([r"\b(?:giờ|bây giờ|hiện tại|hiện|nay)(?: thì)?(?: đã)? (?:hết|không còn)\b", r"\bhết rồi\b"])

_ELECTRIC = vi_any(
    [
        r"\bđèn\b",
        r"\bbóng\b",
        r"\bđiện\b",
        r"\bổ cắm\b",
        r"\bcông tắc\b",
        r"\bcầu dao\b",
        r"\baptomat\b",
        r"\bdây\b",
        r"\bnhựa\b",
        r"\bmáy\b",
    ]
)


@dataclass(frozen=True)
class _Spec:
    signal_id: str
    patterns: tuple[str, ...]
    exclude: tuple[str, ...] = ()
    needs_electric: str | None = None  # without an electrical word: "unclear" (B-04) or "drop"


# Tier 1 (§6.2). S-12, S-14 and C-01 are combinations, evaluated below.
TIER1: tuple[_Spec, ...] = (
    _Spec("S-01", (r"\bkhét\b",), needs_electric="unclear"),
    _Spec("S-02", (r"\btia lửa\b", r"\btóe lửa\b", r"\btoé lửa\b", r"\bxẹt (?:điện|lửa)\b", r"\bphóng điện\b")),
    _Spec(
        "S-03",
        (
            r"\bdây (?:điện )?(?:bị )?(?:hở|trần|lộ|đứt|lòi|tuột)\b",
            r"\bhở dây\b",
            r"\blộ dây\b",
        ),
    ),
    _Spec(
        "S-04",
        (r"\bkhói\b",),
        exclude=(r"\bkhói thuốc\b", r"\b(?:ra|thoat|tranh) khoi\b", r"\bkhoi (?:benh|phai|can|lo|di)\b"),
    ),
    _Spec(
        "S-05",
        (
            r"\bbốc cháy\b",
            r"\bđang cháy\b",
            r"\bcháy (?:lớn|to|nổ|hộp|tủ|ổ|dây|công tắc|máy)\b",
            r"\bhỏa hoạn\b",
            r"\bhoả hoạn\b",
            r"\bcó lửa\b",
            r"\bngọn lửa\b",
            r"\bbốc lửa\b",
            r"\bbắt lửa\b",
            r"\blửa (?:bùng|cháy|bốc|lan)\b",
        ),
        exclude=(r"\bdang chay (?:bo|nhay|ra|vao|tot|binh thuong)\b",),
    ),
    _Spec(
        "S-06",
        (
            r"\bđiện giật\b",
            r"\bgiật điện\b",
            r"\bbị giật\b",
            r"\bgiật tay\b",
            r"\brò (?:rỉ )?điện\b",
        ),
    ),
    _Spec(
        "S-07",
        (
            r"\bnóng (?:bỏng|ran|rực)\b",
            r"\bbỏng tay\b",
            r"\bquá nóng\b",
            r"\bchảy nhựa\b",
            r"\bnhựa (?:bị )?chảy\b",
            r"\bcháy xém\b",
            r"\bbiến dạng\b",
        ),
        needs_electric="drop",
    ),
    _Spec(
        "S-08",
        (
            r"\bnước[^.,;!?]{0,30}\b(?:hộp điện|ổ cắm|ổ điện|tủ điện|công tắc|bảng điện|cầu dao)\b",
            r"\b(?:hộp điện|ổ cắm|ổ điện|tủ điện|công tắc|bảng điện|cầu dao)[^.,;!?]{0,20}\b(?:ngấm nước|ướt|nước)\b",
        ),
    ),
    _Spec(
        "S-09",
        (
            r"\bbị thương\b",
            r"\bchảy máu\b",
            r"\bđập đầu\b",
            r"\bbất tỉnh\b",
            r"\bngất\b",
            r"\bmắc kẹt\b",
            r"\b(?:người|ai đó|em bé|trẻ) (?:bị )?kẹt\b",
            r"\bbị kẹt (?:bên )?trong\b",
        ),
    ),
    _Spec(
        "S-10",
        (r"\bmùi (?:gas|ga|khí đốt)\b", r"\b(?:rò|xì) (?:rỉ )?(?:gas|ga|khí)\b", r"\bkhí gas\b"),
    ),
    _Spec(
        "S-11",
        (
            r"\bsắp (?:rơi|rớt|sập)\b",
            r"\b(?:đèn|bóng|trần|kính|chao đèn|máng đèn|quạt|biển)(?: đèn)? (?:bị )?(?:rơi|rớt|sập|lung lay)\b",
            r"\brơi (?:xuống|trúng)\b",
            r"\bsập trần\b",
            r"\blủng lẳng\b",
            r"\bkính vỡ\b",
        ),
        exclude=(r"\brơi vãi\b",),
    ),
    _Spec(
        "S-13",
        (
            r"\b(?:kim|ống|bơm) tiêm\b",
            r"\bchất thải y tế\b",
            r"\b(?:vết|vũng|dính|có) máu\b",
            r"\bmáu me\b",
        ),
    ),
)

_HAZARD = (
    r"\bmùi (?:hắc|xốc|hóa chất|hoá chất)\b",
    r"\bbốc hơi\b",
    r"\băn mòn\b",
    r"\bkhó thở\b",
    r"\bcay mắt\b",
    r"\bngạt (?:mũi|thở)\b",
    r"\bsủi bọt\b",
    r"\bchóng mặt\b",
)
_STRANGE = (
    r"\bchất (?:lỏng |bột |rắn )?lạ\b",
    r"\bkhông rõ nguồn gốc\b",
    r"\bchất không rõ\b",
    r"\bkhông biết (?:là )?chất gì\b",
)
_CHEMICAL = (r"\bhóa chất\b", r"\bhoá chất\b")
_SPILL = r"\b(?:đổ|tràn|rò|vỡ|chảy)\b"
_FLICKER = (r"\bnhấp nháy\b", r"\bchập chờn\b", r"\blúc sáng lúc tắt\b")
_HEAT_OR_SMELL = (r"\bnóng\b", r"\bmùi\b")
# Tier 2 (§6.3)
_SOUND = (
    r"\bxèo xèo\b",
    r"\bxè xè\b",
    r"\brè rè\b",
    r"\bù ù\b",
    r"\bkêu ù\b",
    r"\bù (?:lớn|to)\b",
    r"\blốp bốp\b",
    r"\blách tách\b",
    r"\btách tách\b",
    r"\btiếng nổ\b",
    r"\btiếng (?:kêu )?lạ\b",
    r"\bkêu lạ\b",
    r"\btiếng xẹt\b",
    r"\bxẹt xẹt\b",
)
# B-01: the most common lighting report. Benign unless another tier-1/tier-2 signal is present.
_BENIGN = (
    r"\b(?:bóng đèn|bóng|đèn)(?: [\w/-]+){0,8}? (?:bị |đã |hay |thì |cứ )?(?:cháy|hỏng|chập chờn|nhấp nháy|nổ|tắt|chết)\b",
    r"\b(?:nổ|cháy|chết) bóng\b",
)
# B-03 words that are tier 2 when they stand alone. The ones whose bare spelling is an everyday word ("giặt" →
# "giat", "nó" → "no") only count when typed with diacritics.
_AMBIGUOUS_LOOSE = (r"\bcháy\b", r"\bchập\b")
_AMBIGUOUS_EXACT = re.compile(r"\b(?:giật|nổ)\b")
_AMBIGUOUS_EXCLUDE = (
    r"\bchập chờn\b",
    r"\b(?:nuoc|nhua|dau|mau|ri) chay\b",
    r"\bchay (?:ra|xuong|tran|vao|qua|nuoc|nhanh|bo|di)\b",
)

_VULNERABLE = (
    r"\btrẻ (?:em|nhỏ|con)\b",
    r"\bem bé\b",
    r"\bcháu bé\b",
    r"\bngười (?:già|cao tuổi|khuyết tật)\b",
    r"\bcụ già\b",
    r"\bxe lăn\b",
    r"\bbà bầu\b",
    r"\bmang thai\b",
)
_EXIT_ROUTE = (r"\blối thoát hiểm\b", r"\bcầu thang\b", r"\bhầm\b", r"\bsảnh\b")

TIER1_IDS = frozenset({*(s.signal_id for s in TIER1), "S-12", "S-14", "C-01"})


@dataclass(frozen=True)
class SafetyAssessment:
    risk_level: RiskLevel
    signals: tuple[RiskSignal, ...] = ()
    amplifiers: tuple[str, ...] = ()


@dataclass
class _Scan:
    text: str
    signals: list[RiskSignal] = field(default_factory=list)
    spans: list[tuple[int, int]] = field(default_factory=list)  # matched by a tier-1 / tier-2 / benign rule

    def clauses(self):
        return _CLAUSE.finditer(self.text)


def _overlaps(span: tuple[int, int], spans: Sequence[tuple[int, int]]) -> bool:
    return any(span[0] < end and start < span[1] for start, end in spans)


def _excluded(clause: str, match: re.Match, exclude: re.Pattern | None) -> bool:
    if exclude is None:
        return False
    return any(_overlaps(match.span(), [m.span()]) for m in exclude.finditer(clause))


def _status(clause: str, start: int, over_now: bool) -> SignalStatus:
    before = clause[:start]
    if _NEGATION.search(before):
        return ABSENT
    opened = list(_NEGATION_OPEN.finditer(before))
    if opened and not _CONTRAST.search(before, opened[-1].end()):
        return ABSENT
    if _HEDGE.search(before) or _PAST.search(before) or over_now:
        return UNCLEAR
    return PRESENT


def _find(
    scan: _Scan, pattern: re.Pattern, over_now: bool, exclude: re.Pattern | None = None
) -> list[tuple[re.Match, SignalStatus, int]]:
    """Every match with its status and absolute offset."""
    found = []
    for clause_match in scan.clauses():
        clause = clause_match.group(0)
        for match in pattern.finditer(clause):
            if not _excluded(clause, match, exclude):
                found.append((match, _status(clause, match.start(), over_now), clause_match.start()))
    return found


def _add(scan: _Scan, signal_id: str, status: SignalStatus, quote: str, span: tuple[int, int] | None = None):
    scan.signals.append(RiskSignal(signal_id=signal_id, status=status, source_quote=quote, detected_by="RULE"))
    if span is not None:
        scan.spans.append(span)


def _best(found: list[tuple[re.Match, SignalStatus, int]]) -> tuple[re.Match, SignalStatus, int] | None:
    """PRESENT wins over UNCLEAR wins over ABSENT (§6.2)."""
    order = {PRESENT: 0, UNCLEAR: 1, ABSENT: 2}
    return min(found, key=lambda f: order[f[1]]) if found else None


def assess(text: str) -> SafetyAssessment:
    scan = _Scan(clean(text))
    if not scan.text:
        return SafetyAssessment(RiskLevel.NONE)
    over_now = bool(_OVER_NOW.search(scan.text))
    electric = bool(_ELECTRIC.search(scan.text))

    for spec in TIER1:
        exclude = vi_any(spec.exclude) if spec.exclude else None
        found = _find(scan, vi_any(spec.patterns), over_now, exclude)
        for match, status, offset in found:
            scan.spans.append((offset + match.start(), offset + match.end()))
        best = _best(found)
        if best is None:
            continue
        match, status, _ = best
        if spec.needs_electric and not electric:
            if spec.needs_electric == "drop":
                continue
            status = UNCLEAR if status == PRESENT else status  # B-04: "khét" outside an electrical context
        _add(scan, spec.signal_id, status, match.group(0))

    _combinations(scan, over_now)

    for match, status, offset in _find(scan, vi_any(_SOUND), over_now):
        scan.spans.append((offset + match.start(), offset + match.end()))
        _add(scan, "T2-04", UNCLEAR if status == PRESENT else status, match.group(0))

    for match, _, offset in _find(scan, vi_any(_BENIGN), over_now):
        _add(scan, "B-01", ABSENT, match.group(0), (offset + match.start(), offset + match.end()))

    _ambiguous_words(scan, over_now)
    return SafetyAssessment(_level(scan.signals), tuple(_dedupe(scan.signals)), amplifiers(scan.text))


def _combinations(scan: _Scan, over_now: bool) -> None:
    hazards = [f for f in _find(scan, vi_any(_HAZARD), over_now) if f[1] != ABSENT]
    strange = [f for f in _find(scan, vi_any(_STRANGE), over_now) if f[1] != ABSENT]
    chemical = [f for f in _find(scan, vi_any(_CHEMICAL), over_now) if f[1] != ABSENT]
    present_hazards = [f for f in hazards if f[1] == PRESENT]
    for group in (hazards, strange, chemical):
        for match, _, offset in group:
            scan.spans.append((offset + match.start(), offset + match.end()))

    if strange and hazards:  # S-14 needs both
        status = PRESENT if any(f[1] == PRESENT for f in strange) and present_hazards else UNCLEAR
        _add(scan, "S-14", status, f"{strange[0][0].group(0)} … {hazards[0][0].group(0)}")
    elif chemical and (hazards or _vi(_SPILL).search(scan.text)):
        status = PRESENT if any(f[1] == PRESENT for f in chemical) else UNCLEAR
        _add(scan, "S-12", status, chemical[0][0].group(0))
    elif len({f[0].group(0) for f in present_hazards}) >= 2:
        _add(scan, "S-12", PRESENT, " … ".join(f[0].group(0) for f in present_hazards[:2]))
    elif strange or hazards or chemical:  # T2-05: only one hazard sign
        first = (strange or hazards or chemical)[0][0]
        _add(scan, "T2-05", UNCLEAR, first.group(0))

    flicker = [f for f in _find(scan, vi_any(_FLICKER), over_now) if f[1] != ABSENT]
    companion = [f for f in _find(scan, vi_any(_HEAT_OR_SMELL + _SOUND), over_now) if f[1] != ABSENT]
    if flicker and companion:  # B-05 / C-01
        status = PRESENT if flicker[0][1] == PRESENT and any(f[1] == PRESENT for f in companion) else UNCLEAR
        _add(scan, "C-01", status, f"{flicker[0][0].group(0)} … {companion[0][0].group(0)}")
        for match, _, offset in flicker:
            scan.spans.append((offset + match.start(), offset + match.end()))


def _ambiguous_words(scan: _Scan, over_now: bool) -> None:
    exclude = vi_any(_AMBIGUOUS_EXCLUDE)
    found = _find(scan, vi_any(_AMBIGUOUS_LOOSE), over_now, exclude) + _find(scan, _AMBIGUOUS_EXACT, over_now, exclude)
    for match, status, offset in found:
        span = (offset + match.start(), offset + match.end())
        if _overlaps(span, scan.spans):
            continue
        _add(scan, "T2-03", UNCLEAR if status == PRESENT else status, match.group(0), span)


def _level(signals: Sequence[RiskSignal]) -> RiskLevel:
    if any(s.signal_id in TIER1_IDS and s.status == PRESENT for s in signals):
        return RiskLevel.EMERGENCY
    if any(s.status in (PRESENT, UNCLEAR) for s in signals):
        return RiskLevel.UNCLEAR
    return RiskLevel.NONE


def _dedupe(signals: Sequence[RiskSignal]) -> list[RiskSignal]:
    seen, out = set(), []
    for s in signals:
        key = (s.signal_id, s.status, s.source_quote)
        if key not in seen:
            seen.add(key)
            out.append(s)
    return out


def amplifiers(text: str) -> tuple[str, ...]:
    """Tier 3 (§6.7): never a risk level, only a priority raise."""
    cleaned = clean(text)
    found = []
    if vi_any(_EXIT_ROUTE).search(cleaned):
        found.append("exit_route_location")
    if vi_any(_VULNERABLE).search(cleaned):
        found.append("vulnerable_person")
    return tuple(found)


def merge_llm(rule: SafetyAssessment, llm_signals: Sequence[RiskSignal], text: str) -> SafetyAssessment:
    """Add the model's signals without ever lowering a rule signal (§6.1.1).

    An LLM PRESENT must quote the report verbatim, otherwise it counts as UNCLEAR. LLM ABSENT rows are dropped: they
    cannot clear anything.
    """
    cleaned = clean(text)
    extra = []
    for signal in llm_signals:
        if signal.status == ABSENT:
            continue
        status = signal.status
        if status == PRESENT and clean(signal.source_quote) not in cleaned:
            status = UNCLEAR
        extra.append(signal.model_copy(update={"status": status, "detected_by": "LLM"}))
    signals = [*rule.signals, *extra]
    level = max(rule.risk_level, _level(signals), key=_LEVEL_ORDER.index)
    return SafetyAssessment(level, tuple(_dedupe(signals)), rule.amplifiers)


_LEVEL_ORDER = [RiskLevel.NONE, RiskLevel.UNCLEAR, RiskLevel.EMERGENCY]


# ---------------------------------------------------------------- CR03 P0 isolated rules (PR #6)
# Kept side by side until the CR-03 engine merge picks one safety layer; names that clashed carry a P0 prefix.


@dataclass(frozen=True)
class SafetySignal:
    signal_id: str
    status: str
    source_quote: str


@dataclass(frozen=True)
class P0SafetyAssessment:
    risk_level: str
    signals: tuple[SafetySignal, ...]


_RISK = {"NONE": 0, "UNCLEAR": 1, "EMERGENCY": 2}
_PATTERNS = {
    "S-01": r"\b(?:mui khet|khet let|khet nhu nhua chay)\b",
    "S-02": r"\b(?:tia lua|toe lua|xet dien|xet lua)\b",
    "S-03": r"\b(?:day dien ho|day tran|day dut loi ra|lo day)\b",
    "S-04": r"\bkhoi\b",
    "S-05": r"\b(?:boc chay|dang chay|co lua|chay hop dien)\b",
    "S-09": r"\b(?:bi thuong|chay mau|nga dap dau|ngat(?!\s+(?:mui|tho))|mac ket)\b",
}
_UNKNOWN = r"\b(?:chat (?:long )?la|chat (?:long )?khong ro(?: nguon goc)?|khong ro chat gi)\b"
_P0_HAZARD = r"\b(?:mui hac|cay mat|ngat mui|kho tho|gay bong|an mon)\b"
_NEGATIVE = re.compile(r"\b(?:khong|ko|k|chua|chang)\b(?:\s+\w+){0,5}\s*$")
_UNCERTAIN = re.compile(r"\b(?:hinh nhu|co le|nghi ngo|nghi la|nghe nhu|khong chac|chua ro)\b")
_HISTORICAL = re.compile(r"\b(?:hom qua|truoc day|da tung|luc truoc|tuan truoc|gio het|da het)\b")
_P0_BENIGN = re.compile(r"\b(?:bong den|den|bong)\s+(?:bi\s+)?(?:chay|hong|chap chon|nhap nhay|no bong)\b|\bno bong\b")


def _clauses(text: str):
    """Yield exact original excerpts; history carries across a comma until 'now'."""
    for sentence in re.split(r"[.!?;\n]+", text):
        historical = False
        negative = False
        separator = ""
        for index, clause in enumerate(
            re.split(r"(,|\b(?:nhưng|nhung|còn|con|và|va|tuy nhiên|tuy nhien)\b)", sentence, flags=re.I)
        ):
            if index % 2:
                separator = normalize(clause)
                continue
            quote = clause.strip()
            if not quote:
                continue
            normalized = normalize(quote)
            if re.search(r"\b(?:gio|hien tai|bay gio)\b", normalized):
                historical = False
            historical = historical or bool(_HISTORICAL.search(normalized))
            inherited_negative = negative and separator == "va" and not re.match(r"(?:co|dang|boc)\b", normalized)
            negative = inherited_negative or bool(re.match(r"(?:khong|ko|chua|chang)\s+(?:co|thay)\b", normalized))
            yield quote, normalized, historical, inherited_negative


def _p0_status(text: str, start: int, historical: bool, inherited_negative: bool = False) -> str:
    prefix = text[:start]
    if _UNCERTAIN.search(text) or historical:
        return "UNCLEAR"
    if inherited_negative or _NEGATIVE.search(prefix):
        return "ABSENT"
    return "PRESENT"


def assess_safety(text: str, previous_risk: str = "NONE") -> P0SafetyAssessment:
    """Scan each new text event; retain previous risk. Invalid inputs fail closed."""
    if not isinstance(text, str) or not isinstance(previous_risk, str) or previous_risk not in _RISK:
        raise ValueError("text must be str and previous_risk must be NONE, UNCLEAR or EMERGENCY")
    signals: list[SafetySignal] = []
    unknown: list[SafetySignal] = []
    hazards: list[SafetySignal] = []
    for quote, clause, historical, inherited_negative in _clauses(text):
        for signal_id, pattern in _PATTERNS.items():
            for match in re.finditer(pattern, clause):
                status = _p0_status(clause, match.start(), historical, inherited_negative)
                if (
                    signal_id == "S-01"
                    and status == "PRESENT"
                    and re.search(r"\b(?:com|thuc an|do an|bep|noi|thit)\b", clause)
                    and not re.search(r"\b(?:dien|den|o cam|nhua)\b", clause)
                ):
                    signals.append(SafetySignal("B-04", "UNCLEAR", quote))
                    status = "UNCLEAR"
                signals.append(SafetySignal(signal_id, status, quote))
        for target, pattern in ((unknown, _UNKNOWN), (hazards, _P0_HAZARD)):
            for match in re.finditer(pattern, clause):
                target.append(
                    SafetySignal("S-14", _p0_status(clause, match.start(), historical, inherited_negative), quote)
                )
        benign = _P0_BENIGN.search(clause)
        if benign:
            signals.append(SafetySignal("B-01", "ABSENT", quote))
        ambiguous = re.search(r"\b(?:chay|chap|giat|no bong|khet)\b", clause)
        if ambiguous and not benign and not any(re.search(p, clause) for p in _PATTERNS.values()):
            status = _p0_status(clause, ambiguous.start(), historical, inherited_negative)
            signals.append(
                SafetySignal(
                    "B-04" if "khet" in clause else "T2-03", "ABSENT" if status == "ABSENT" else "UNCLEAR", quote
                )
            )
        sound = re.search(r"\b(?:xeo xeo|u lon|no lop bop|tieng xet)\b", clause)
        if sound:
            status = _p0_status(clause, sound.start(), historical, inherited_negative)
            signals.append(SafetySignal("T2-04", "ABSENT" if status == "ABSENT" else "UNCLEAR", quote))
    # Two independent positive conditions are mandatory for S-14. A single
    # condition is reviewable, never silently promoted to an emergency.
    if unknown or hazards:
        present = any(s.status == "PRESENT" for s in unknown) and any(s.status == "PRESENT" for s in hazards)
        candidates = unknown + hazards
        status = "PRESENT" if present else "UNCLEAR" if any(s.status != "ABSENT" for s in candidates) else "ABSENT"
        signals.extend(SafetySignal("S-14", status, s.source_quote) for s in candidates)
    risk = (
        "EMERGENCY"
        if any(s.status == "PRESENT" for s in signals)
        else "UNCLEAR"
        if any(s.status == "UNCLEAR" for s in signals)
        else "NONE"
    )
    return P0SafetyAssessment(max((risk, previous_risk), key=_RISK.__getitem__), tuple(signals))

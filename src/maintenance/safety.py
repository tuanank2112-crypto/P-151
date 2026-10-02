"""Safety layer, pipeline step 2b (CR-BPTN-03 §6): fixed rules decide, the LLM may only raise the level (Q09).

Pure functions: no IO, no clock, no LLM except `assess_with_llm`. Ticket text is DATA: it is only matched against
lexicon patterns, so an instruction inside the text has no effect (FR-SECURITY-001, AC-18).

A negation, a hedge or an "already over" marker only counts inside the CLAUSE of the signal it modifies (Q25). Clause
boundaries are `, ; : . ! ? ( ) —`, a line break and the conjunctions listed in the lexicon (và / nhưng / mà / rồi).
"""

import re
import unicodedata
from bisect import bisect_left, bisect_right
from collections.abc import Callable, Sequence
from dataclasses import dataclass, replace
from typing import Literal

from pydantic import BaseModel, Field

from src.maintenance.catalog import SafetyLexicon, compile_pattern
from src.maintenance.enums import DetectedBy, RiskLevel, SignalStatus
from src.maintenance.models import RiskSignal

SEVERITY: dict[SignalStatus, int] = {SignalStatus.ABSENT: 0, SignalStatus.UNCLEAR: 1, SignalStatus.PRESENT: 2}
LEAD = re.compile(r"^(co|thay|nghe thay|ngui thay|bi) ")  # lead words the negation window absorbs ("khong co khoi")
SOFT_BREAKS = ",:()—–"  # clause breaks that keep a space in `norm`, so a phrase may still match across them
HARD_BREAKS = ".;!?"  # sentence breaks, kept in `norm`
WINDOW_CHARS = 200  # a negation/hedge window never needs more than this many characters of context

Span = tuple[int, int]


# ---------------------------------------------------------------- 3.1 normalisation with an index map


def _fold(char: str) -> str:
    """One character: NFKC (full-width, compatibility forms), lower case, d-stroke to d, accents stripped."""
    low = unicodedata.normalize("NFKC", char).lower().replace("đ", "d")
    return "".join(c for c in unicodedata.normalize("NFD", low) if unicodedata.category(c) != "Mn")


def _normalize(text: str) -> tuple[str, list[int], list[int], list[int]]:
    """Returns (norm, index_map, hard_cuts, soft_cuts). A cut is the index in `norm` where the next segment starts.

    Format characters (zero-width and the like) vanish without a space; a run of 3 or more equal letters becomes one
    ("khóiiiii" -> "khoi"); `.;!?` and line breaks are hard cuts; `,:()—–` are soft cuts.
    """
    out: list[str] = []
    index: list[int] = []
    hard: list[int] = []
    soft: list[int] = []
    prev_space = True
    run_char, run_len, collapsed = "", 0, False
    for i, char in enumerate(text):
        for c in _fold(char):
            if unicodedata.category(c) == "Cf":
                continue
            if c.isalpha():
                run_len = run_len + 1 if c == run_char else 1
                if c != run_char:
                    run_char, collapsed = c, False
                if run_len >= 3:
                    if not collapsed:  # the first two letters of the run are replaced by one
                        del out[-2:], index[-2:]
                        out.append(c)
                        index.append(i)
                        collapsed = True
                    else:
                        index[-1] = i
                    prev_space = False
                    continue
                out.append(c)
                index.append(i)
                prev_space = False
                continue
            run_char, run_len, collapsed = "", 0, False
            if c in HARD_BREAKS:
                out.append(c)
                index.append(i)
                prev_space = False
                hard.append(len(out))
            elif c.isalnum():
                out.append(c)
                index.append(i)
                prev_space = False
            else:  # whitespace and every other punctuation mark: one space
                if not prev_space:
                    out.append(" ")
                    index.append(i)
                    prev_space = True
                if out:
                    if c == "\n":
                        hard.append(len(out))
                    elif c in SOFT_BREAKS:
                        soft.append(len(out))
    while out and out[-1] == " ":
        out.pop()
        index.pop()
    return "".join(out), index, hard, soft


def normalize_with_map(text: str) -> tuple[str, list[int]]:
    """Lower case, accents stripped, d-stroke to d; punctuation other than `.;!?` becomes one space.

    Returns (norm, index_map) where index_map[k] is the index in `text` of the character that produced norm[k].
    """
    norm, index, _, _ = _normalize(text)
    return norm, index


def quote_of(text: str, index_map: list[int], start: int, end: int) -> str:
    """The verbatim (accented) text that produced norm[start:end]."""
    if start >= end or not index_map:
        return ""
    return text[index_map[start] : index_map[end - 1] + 1]


# ---------------------------------------------------------------- text context: sentences and clauses (one pass)


@dataclass(frozen=True)
class TextContext:
    text: str
    norm: str
    index: list[int]
    sentence_cuts: list[int]
    clause_cuts: list[int]

    def sentence(self, pos: int) -> Span:
        return _span(self.sentence_cuts, pos, len(self.norm))

    def clause(self, pos: int) -> Span:
        return _span(self.clause_cuts, pos, len(self.norm))

    def words_before(self, pos: int, count: int) -> str:
        """The `count` words right before `pos`, inside the same clause."""
        if not count:
            return ""
        lo = self.clause(pos)[0]
        bound = max(lo, pos - WINDOW_CHARS)
        words = self.norm[bound:pos].split()
        if bound > lo and self.norm[bound - 1] != " " and words:
            words = words[1:]  # the first word was cut in the middle
        return " ".join(words[-count:])


def _span(cuts: list[int], pos: int, size: int) -> Span:
    k = bisect_right(cuts, pos)
    return (cuts[k - 1] if k else 0), (cuts[k] if k < len(cuts) else size)


def build_context(text: str, conjunctions: Sequence[str] = ()) -> TextContext:
    """Normalise once and index the sentence and clause boundaries (no per-match scanning later)."""
    norm, index, hard, soft = _normalize(text)
    sentence = sorted(set(hard))
    cuts = set(hard) | set(soft)
    if conjunctions:
        conj = re.compile(r"\b(?:" + "|".join(re.escape(c) for c in conjunctions) + r")\b")
        for m in conj.finditer(norm):
            cuts.update((m.start(), m.end()))
    return TextContext(text, norm, index, sentence, sorted(cuts))


def negation_spans(window: str, prefixes: Sequence[str]) -> list[Span]:
    """Non-overlapping negation phrases found in `window` (the longest wins where two overlap)."""
    found = sorted(
        (m.span() for prefix in prefixes for m in compile_pattern(prefix).finditer(window)),
        key=lambda s: (s[0], s[0] - s[1]),
    )
    kept: list[Span] = []
    for start, end in found:
        if not kept or start >= kept[-1][1]:
            kept.append((start, end))
    return kept


def is_negated(ctx: TextContext, start: int, prefixes: Sequence[str], window_words: int) -> bool:
    """A negation phrase within `window_words` words before `start`, in the same clause (used by priority too)."""
    return bool(negation_spans(ctx.words_before(start, window_words), prefixes))


# ---------------------------------------------------------------- result types


@dataclass(frozen=True)
class SafetyAssessment:
    risk_level: RiskLevel
    signals: tuple[RiskSignal, ...]  # one record per (signal_id, status): see `_dedupe`
    notes: tuple[str, ...] = ()  # LLM guard / fallback notes
    proposer: str = "rules"  # "rules" | "rules+llm:<model_label>"


@dataclass(frozen=True)
class _Hit:
    signal_id: str
    status: SignalStatus
    quote: str
    rule_id: str


class _Coverage:
    """Union of spans on a bytearray: `inside(a, b)` is O(b - a), not O(number of spans)."""

    def __init__(self, size: int):
        self.cells = bytearray(size)

    def add(self, start: int, end: int) -> None:
        self.cells[start:end] = b"\x01" * (end - start)

    def inside(self, start: int, end: int) -> bool:
        return start < end and self.cells.find(0, start, end) == -1


def _matches(patterns: Sequence[str], norm: str) -> list[re.Match[str]]:
    return [m for pattern in patterns for m in compile_pattern(pattern).finditer(norm)]


def _starts(spans: Sequence[Span]) -> list[int]:
    return sorted(s for s, _ in spans)


def _any_in(starts: list[int], lo: int, hi: int) -> bool:
    k = bisect_left(starts, lo)
    return k < len(starts) and starts[k] < hi


class _Lookups:
    """Everything `_judge` and `assess` ask about positions, computed once per text."""

    def __init__(self, ctx: TextContext, lexicon: SafetyLexicon):
        norm = ctx.norm
        self.ctx = ctx
        self.lexicon = lexicon
        self.markers = sorted(m.span() for m in _matches(lexicon.resolved_markers, norm))
        self.marker_starts = [s for s, _ in self.markers]
        self.gio_markers = [(s, e) for s, e in self.markers if norm[s:e].startswith("gio ")]
        self.gio_starts = [s for s, _ in self.gio_markers]
        self.cooking = _starts([m.span() for m in _matches(lexicon.khet_benign_contexts, norm)])
        self.electric = _starts([m.span() for m in _matches(lexicon.khet_electric_contexts, norm)])
        self.non_lamp = _starts([m.span() for m in _matches(lexicon.non_lamp_electrical, norm)])
        raw = unicodedata.normalize("NFC", ctx.text).lower()
        self.cooking_raw = sorted(
            m.start() for p in lexicon.khet_benign_contexts_accented for m in compile_pattern(p).finditer(raw)
        )
        self.raw_offset = 0 if len(raw) == len(ctx.text) else None  # raw positions only usable when NFC kept lengths
        self.lamp_nouns = sorted(m.span() for m in _matches(lexicon.benign_lamp_nouns, norm))

    def cooking_context(self, sentence: Span) -> bool:
        """B-04: a cooking word in the sentence and no electrical word: 'khét' near food, not near a wire."""
        s0, s1 = sentence
        if _any_in(self.electric, s0, s1):
            return False
        if _any_in(self.cooking, s0, s1):
            return True
        if self.raw_offset is not None and self.ctx.index and s1 > s0:
            return _any_in(self.cooking_raw, self.ctx.index[s0], self.ctx.index[s1 - 1] + 1)
        return False


# ---------------------------------------------------------------- 3.2 judging one match


def _judge(lk: _Lookups, match: re.Match[str]):
    """Status of one signal match. Priority: B-02 negation > T2-01 hedge > T2-02 resolved > PRESENT.

    Negation, hedge and 'already over' only count in the clause of the signal (Q25). Returns (status, quote, rule_id).
    """
    ctx, lexicon = lk.ctx, lk.lexicon
    norm, index, text = ctx.norm, ctx.index, ctx.text
    start, end = match.start(), match.end()
    c0, c1 = ctx.clause(start)
    lead = LEAD.match(norm[start:end])
    probe_end = start + lead.end() - 1 if lead else start  # "khong co khoi": the window absorbs the lead word
    window = ctx.words_before(probe_end, lexicon.negation_window_words)
    if lead:
        window = (window + " " + norm[start:probe_end]).strip()
    negations = negation_spans(window, lexicon.negation_prefixes)
    if negations:
        first = norm.rfind(window[negations[0][0] : negations[0][1]], c0, end)
        quote = quote_of(text, index, first if first >= 0 else start, end)
        if len(negations) >= 2:  # "không phải không có khói": a double negation is not a clear absence
            return SignalStatus.UNCLEAR, quote, "B-02D"
        return SignalStatus.ABSENT, quote, "B-02"
    hedge_window = ctx.words_before(start, lexicon.hedge_window_words)
    for hedge in lexicon.hedges:
        found = compile_pattern(hedge).search(hedge_window)
        if found:
            quote_start = norm.rfind(found.group(0), c0, start)
            return SignalStatus.UNCLEAR, quote_of(text, index, quote_start if quote_start >= 0 else start, end), "T2-01"
    s0, s1 = ctx.sentence(start)
    k = bisect_left(lk.marker_starts, c0)
    if k < len(lk.markers) and lk.markers[k][0] < c1:  # an "already over" phrase in the same clause
        m0, m1 = lk.markers[k]
        if m0 >= start:
            return SignalStatus.UNCLEAR, quote_of(text, index, start, m1), "T2-02"
        return SignalStatus.UNCLEAR, quote_of(text, index, m0, end), "T2-02"
    g = bisect_left(lk.gio_starts, c1)  # "..., giờ hết rồi": an explicit "now" in the next clause of the sentence
    if g < len(lk.gio_markers) and lk.gio_markers[g][0] < s1:
        return SignalStatus.UNCLEAR, quote_of(text, index, start, lk.gio_markers[g][1]), "T2-02"
    return SignalStatus.PRESENT, quote_of(text, index, start, end), None


# ---------------------------------------------------------------- 3 assess


def assess(text: str, lexicon: SafetyLexicon) -> SafetyAssessment:
    """Deterministic rule assessment of `text` against `lexicon` (SPEC-P01 §3, Q25, Q26)."""
    ctx = build_context(text, lexicon.clause_conjunctions)
    norm, index = ctx.norm, ctx.index
    if not norm.strip():
        return SafetyAssessment(RiskLevel.NONE, ())
    lk = _Lookups(ctx, lexicon)
    hits: list[_Hit] = []
    tier1 = _Coverage(len(norm))
    excluded = _Coverage(len(norm))
    for m in _matches(lexicon.ambiguous_exclusions, norm):
        excluded.add(*m.span())
    # B-01 benign phrases: not when another electrical device (socket, box, wire...) is in the same clause (Q25.3)
    benign_spans = [
        m.span() for m in _matches(lexicon.benign_phrases, norm) if not _any_in(lk.non_lamp, *ctx.clause(m.start()))
    ]
    benign = _Coverage(len(norm))
    for span in benign_spans:
        benign.add(*span)
    active = [s for s in lexicon.signals if s.phase in lexicon.active_phases]

    # 3.3 pattern signals
    for signal in active:
        for match in _matches(signal.patterns, norm):
            status, quote, rule = _judge(lk, match)
            rule_id = rule or signal.signal_id
            if signal.signal_id == "S-01" and status == SignalStatus.PRESENT:  # B-04
                if lk.cooking_context(ctx.sentence(match.start())):
                    status, rule_id = SignalStatus.UNCLEAR, "B-04"
            if signal.tier == 1 and status == SignalStatus.PRESENT:
                tier1.add(*match.span())
            hits.append(_Hit(signal.signal_id, status, quote, rule_id))

    # 3.4 components and combinations (S-14 / T2-05)
    component_best: dict[str, tuple[SignalStatus, str, str]] = {}
    for component in lexicon.components:
        best: tuple[SignalStatus, str, str] | None = None
        for match in _matches(component.patterns, norm):
            status, quote, rule = _judge(lk, match)
            if best is None or SEVERITY[status] > SEVERITY[best[0]]:
                best = (status, quote, rule or component.component_id)
        if best:
            component_best[component.component_id] = best
    for signal in active:
        if signal.all_of:
            parts = [component_best.get(c) for c in signal.all_of]
            if all(p is not None and p[0] == SignalStatus.PRESENT for p in parts):
                quote = " | ".join(p[1] for p in parts if p)
                hits.append(_Hit(signal.signal_id, SignalStatus.PRESENT, quote, signal.signal_id))
                tier1.add(0, len(norm))  # a PRESENT combination needs no T2-05 record
        if signal.any_of:
            found = [component_best.get(c) for c in signal.any_of]
            if all(p is not None and p[0] == SignalStatus.PRESENT for p in found):
                continue
            present = [p for p in found if p is not None]
            if present and any(p[0] != SignalStatus.ABSENT for p in present):
                top = max(present, key=lambda p: SEVERITY[p[0]])
                rule_id = top[2] if top[2] in ("B-02", "B-02D", "T2-01", "T2-02") else signal.signal_id
                hits.append(_Hit(signal.signal_id, top[0], top[1], rule_id))

    # 3.5 B-01 benign phrases: recorded for traceability, one record per span
    seen: set[Span] = set()
    for span in benign_spans:
        if span not in seen and not tier1.inside(*span):
            seen.add(span)
            hits.append(_Hit("T2-03", SignalStatus.ABSENT, quote_of(text, index, *span), "B-01"))

    # 3.6 ambiguous terms (B-03 -> T2-03)
    for match in _matches(lexicon.ambiguous_terms, norm):
        a, b = match.span()
        if tier1.inside(a, b) or excluded.inside(a, b) or benign.inside(a, b):
            continue
        if match.group(0) in lexicon.benign_with_lamp_noun and not _any_in(lk.non_lamp, *ctx.clause(a)):
            sentence_start = ctx.sentence(a)[0]
            j = bisect_left(lk.lamp_nouns, (sentence_start, 0))
            while j < len(lk.lamp_nouns) and lk.lamp_nouns[j][0] < a and lk.lamp_nouns[j][1] > a:
                j += 1
            if j < len(lk.lamp_nouns) and lk.lamp_nouns[j][0] < a:  # "Bong den ... bi chay": benign (B-01)
                hits.append(_Hit("T2-03", SignalStatus.ABSENT, quote_of(text, index, lk.lamp_nouns[j][0], b), "B-01"))
                continue
        status, quote, rule = _judge(lk, match)
        hits.append(_Hit("T2-03", status, quote, rule or "B-03"))

    signals = _dedupe(hits)
    return SafetyAssessment(derive_risk_level(signals, lexicon), signals)


def _dedupe(hits: Sequence[_Hit]) -> tuple[RiskSignal, ...]:
    """One record per (signal_id, status): the longest quote, in order of first appearance (3.7)."""
    best: dict[tuple[str, SignalStatus], _Hit] = {}
    for hit in hits:
        key = (hit.signal_id, hit.status)
        if key not in best or len(hit.quote) > len(best[key].quote):
            best[key] = hit
    return tuple(
        RiskSignal(
            signal_id=h.signal_id,
            status=h.status,
            source_quote=h.quote,
            detected_by=DetectedBy.RULE,
            rule_id=h.rule_id,
        )
        for h in best.values()
    )


def derive_risk_level(signals: Sequence[RiskSignal], lexicon: SafetyLexicon) -> RiskLevel:
    """EMERGENCY: a tier-1 PRESENT. UNCLEAR: a tier-1 UNCLEAR or any tier-2 PRESENT/UNCLEAR. Otherwise NONE."""
    tier = {s.signal_id: s.tier for s in lexicon.signals}
    if any(tier.get(s.signal_id) == 1 and s.status == SignalStatus.PRESENT for s in signals):
        return RiskLevel.EMERGENCY
    if any(tier.get(s.signal_id) == 1 and s.status == SignalStatus.UNCLEAR for s in signals):
        return RiskLevel.UNCLEAR
    if any(tier.get(s.signal_id) == 2 and s.status != SignalStatus.ABSENT for s in signals):
        return RiskLevel.UNCLEAR
    return RiskLevel.NONE


# ---------------------------------------------------------------- 4 LLM guard: raise only


class SignalJudgement(BaseModel):
    signal_id: str
    status: Literal["PRESENT", "ABSENT", "UNCLEAR"]
    quote: str | None = Field(default=None, description="Verbatim excerpt of the report; required for PRESENT/UNCLEAR")


class LLMSafetyAssessment(BaseModel):
    judgements: list[SignalJudgement] = Field(default_factory=list)


SafetyLLMClient = Callable[[str], LLMSafetyAssessment]


def _grounded(quote: str | None, text: str) -> bool:
    if not quote or not quote.strip():
        return False
    return normalize_with_map(quote)[0] in normalize_with_map(text)[0]


def merge_llm(
    rule: SafetyAssessment,
    llm_result: LLMSafetyAssessment,
    text: str,
    lexicon: SafetyLexicon,
    *,
    model_label: str = "llm",
) -> SafetyAssessment:
    """Fold LLM judgements into the rule result. Never lowers the level, never drops a rule record (I-12)."""
    signals = list(rule.signals)
    notes = list(rule.notes)
    known = {s.signal_id for s in lexicon.signals if s.phase in lexicon.active_phases}
    for judgement in llm_result.judgements:
        sid = judgement.signal_id
        if sid not in known:
            notes.append(f"{sid}: LLM nêu tín hiệu ngoài từ vựng P0; bỏ qua")
            continue
        status = SignalStatus(judgement.status)
        quote = (judgement.quote or "").strip()
        if status == SignalStatus.ABSENT:
            notes.append(f"{sid}: LLM ABSENT không bao giờ hạ mức luật; bỏ qua")
            continue
        if not quote:
            notes.append(f"{sid}: LLM {status} không có trích dẫn; bỏ qua")
            continue
        if not _grounded(quote, text):
            notes.append(f"{sid}: trích dẫn LLM không có trong phản ánh -> UNCLEAR")
            status = SignalStatus.UNCLEAR
        best_rule = max((SEVERITY[s.status] for s in signals if s.signal_id == sid), default=-1)
        if SEVERITY[status] > best_rule:
            signals.append(
                RiskSignal(signal_id=sid, status=status, source_quote=quote, detected_by=DetectedBy.LLM, rule_id="LLM")
            )
        else:
            notes.append(f"{sid}: LLM {judgement.status} không cao hơn luật; giữ luật")
    merged = _dedupe_signals(signals)
    return SafetyAssessment(
        risk_level=derive_risk_level(merged, lexicon),
        signals=merged,
        notes=tuple(notes),
        proposer=f"rules+llm:{model_label}",
    )


def _dedupe_signals(signals: Sequence[RiskSignal]) -> tuple[RiskSignal, ...]:
    best: dict[tuple[str, SignalStatus], RiskSignal] = {}
    for signal in signals:
        key = (signal.signal_id, signal.status)
        if key not in best or len(signal.source_quote) > len(best[key].source_quote):
            best[key] = signal
    return tuple(best.values())


def assess_with_llm(
    text: str, lexicon: SafetyLexicon, llm: SafetyLLMClient | None = None, model_label: str = "llm"
) -> SafetyAssessment:
    """Rules first; with a client, merge its judgements. An LLM failure keeps the rule result."""
    rule = assess(text, lexicon)
    if llm is None:
        return rule
    try:
        result = llm(text)
    except Exception as exc:  # any failure: rules already decided
        return replace(rule, notes=(*rule.notes, f"LLM lỗi ({type(exc).__name__}); giữ kết quả luật"))
    return merge_llm(rule, result, text, lexicon, model_label=model_label)

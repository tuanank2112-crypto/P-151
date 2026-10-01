"""Safety layer, pipeline step 2b (CR-BPTN-03 §6): fixed rules decide, the LLM may only raise the level (Q09).

Pure functions: no IO, no clock, no LLM except `assess_with_llm`. Ticket text is DATA: it is only matched against
lexicon patterns, so an instruction inside the text has no effect (FR-SECURITY-001, AC-18).
"""

import re
import unicodedata
from collections.abc import Callable, Sequence
from dataclasses import dataclass, replace
from typing import Literal

from pydantic import BaseModel, Field

from src.maintenance.catalog import SafetyLexicon, compile_pattern
from src.maintenance.enums import DetectedBy, RiskLevel, SignalStatus
from src.maintenance.models import RiskSignal

SEVERITY: dict[SignalStatus, int] = {SignalStatus.ABSENT: 0, SignalStatus.UNCLEAR: 1, SignalStatus.PRESENT: 2}
SENTENCE_BREAK = re.compile(r"[.;!?\n]")
LEAD = re.compile(r"^(co|thay|nghe thay|ngui thay|bi) ")  # lead words the negation window absorbs ("khong co khoi")

Span = tuple[int, int]


# ---------------------------------------------------------------- 3.1 normalisation with an index map


def normalize_with_map(text: str) -> tuple[str, list[int]]:
    """Lower case, accents stripped, d-stroke to d; punctuation other than `.;!?` becomes one space.

    Returns (norm, index_map) where index_map[k] is the index in `text` of the character that produced norm[k].
    """
    out: list[str] = []
    index: list[int] = []
    prev_space = True
    for i, char in enumerate(text):
        low = char.lower().replace("đ", "d")
        base = "".join(c for c in unicodedata.normalize("NFD", low) if unicodedata.category(c) != "Mn")
        for c in base:
            if c in ".;!?" or c.isalnum():
                out.append(c)
                index.append(i)
                prev_space = False
            elif not prev_space:  # whitespace and every other punctuation mark
                out.append(" ")
                index.append(i)
                prev_space = True
    while out and out[-1] == " ":
        out.pop()
        index.pop()
    return "".join(out), index


def quote_of(text: str, index_map: list[int], start: int, end: int) -> str:
    """The verbatim (accented) text that produced norm[start:end]."""
    if start >= end or not index_map:
        return ""
    return text[index_map[start] : index_map[end - 1] + 1]


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


# ---------------------------------------------------------------- 3.2 judging one match


def _sentence_bounds(norm: str, pos: int) -> Span:
    start = max((m.end() for m in SENTENCE_BREAK.finditer(norm, 0, pos)), default=0)
    found = SENTENCE_BREAK.search(norm, pos)
    return start, found.start() if found else len(norm)


def _words_before(norm: str, start: int, count: int) -> str:
    """The `count` words right before `start`, inside the same sentence."""
    sentence_start = _sentence_bounds(norm, start)[0] if start else 0
    words = [w for w in norm[sentence_start:start].split(" ") if w]
    return " ".join(words[-count:]) if count else ""


def _judge(norm: str, index: list[int], text: str, match: re.Match[str], lexicon: SafetyLexicon):
    """Status of one signal match. Priority: B-02 negation > T2-01 hedge > T2-02 resolved > PRESENT.

    Returns (status, quote, rule_id or None).
    """
    start, end = match.start(), match.end()
    lead = LEAD.match(norm[start:end])
    probe_end = start + lead.end() - 1 if lead else start  # "khong co khoi": the window absorbs the lead word
    window = _words_before(norm, probe_end, lexicon.negation_window_words)
    if lead:
        window = (window + " " + norm[start:probe_end]).strip()
    for prefix in lexicon.negation_prefixes:
        found = compile_pattern(prefix).search(window)
        if found:
            quote_start = norm.rfind(found.group(0), 0, end)
            return SignalStatus.ABSENT, quote_of(text, index, quote_start, end), "B-02"
    hedge_window = _words_before(norm, start, lexicon.hedge_window_words)
    for hedge in lexicon.hedges:
        found = compile_pattern(hedge).search(hedge_window)
        if found:
            quote_start = norm.rfind(found.group(0), 0, start)
            return SignalStatus.UNCLEAR, quote_of(text, index, quote_start, end), "T2-01"
    s0, s1 = _sentence_bounds(norm, start)
    sentence = norm[s0:s1]
    for marker in lexicon.resolved_markers:
        found = compile_pattern(marker).search(sentence)
        if found:
            if s0 + found.start() >= start:
                return SignalStatus.UNCLEAR, quote_of(text, index, start, s0 + found.end()), "T2-02"
            return SignalStatus.UNCLEAR, quote_of(text, index, s0 + found.start(), end), "T2-02"
    return SignalStatus.PRESENT, quote_of(text, index, start, end), None


def _inside(spans: list[Span], start: int, end: int) -> bool:
    return any(a <= start and end <= b for a, b in spans)


def _matches(patterns: Sequence[str], norm: str) -> list[re.Match[str]]:
    return [m for pattern in patterns for m in compile_pattern(pattern).finditer(norm)]


# ---------------------------------------------------------------- 3 assess


def assess(text: str, lexicon: SafetyLexicon) -> SafetyAssessment:
    """Deterministic rule assessment of `text` against `lexicon` (SPEC-P01 §3)."""
    norm, index = normalize_with_map(text)
    if not norm.strip():
        return SafetyAssessment(RiskLevel.NONE, ())
    hits: list[_Hit] = []
    benign_spans = [m.span() for m in _matches(lexicon.benign_phrases, norm)]
    excluded_spans = [m.span() for m in _matches(lexicon.ambiguous_exclusions, norm)]
    tier1_spans: list[Span] = []
    active = [s for s in lexicon.signals if s.phase in lexicon.active_phases]

    # 3.3 pattern signals
    for signal in active:
        for match in _matches(signal.patterns, norm):
            status, quote, rule = _judge(norm, index, text, match, lexicon)
            rule_id = rule or signal.signal_id
            if signal.signal_id == "S-01" and status == SignalStatus.PRESENT:  # B-04: only "khet" near cooking
                s0, s1 = _sentence_bounds(norm, match.start())
                if any(compile_pattern(c).search(norm[s0:s1]) for c in lexicon.khet_benign_contexts):
                    status, rule_id = SignalStatus.UNCLEAR, "B-04"
            if signal.tier == 1 and status == SignalStatus.PRESENT:
                tier1_spans.append(match.span())
            hits.append(_Hit(signal.signal_id, status, quote, rule_id))

    # 3.4 components and combinations (S-14 / T2-05)
    component_best: dict[str, tuple[SignalStatus, str, str]] = {}
    for component in lexicon.components:
        best: tuple[SignalStatus, str, str] | None = None
        for match in _matches(component.patterns, norm):
            status, quote, rule = _judge(norm, index, text, match, lexicon)
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
                tier1_spans.append((0, len(norm)))  # a PRESENT combination needs no T2-05 record
        if signal.any_of:
            found = [component_best.get(c) for c in signal.any_of]
            if all(p is not None and p[0] == SignalStatus.PRESENT for p in found):
                continue
            present = [p for p in found if p is not None]
            if present and any(p[0] != SignalStatus.ABSENT for p in present):
                top = max(present, key=lambda p: SEVERITY[p[0]])
                rule_id = top[2] if top[2] in ("B-02", "T2-01", "T2-02") else signal.signal_id
                hits.append(_Hit(signal.signal_id, top[0], top[1], rule_id))

    # 3.5 B-01 benign phrases: recorded for traceability, one record per span
    seen: set[Span] = set()
    for span in benign_spans:
        if span not in seen and not _inside(tier1_spans, *span):
            seen.add(span)
            hits.append(_Hit("T2-03", SignalStatus.ABSENT, quote_of(text, index, *span), "B-01"))

    # 3.6 ambiguous terms (B-03 -> T2-03)
    for match in _matches(lexicon.ambiguous_terms, norm):
        a, b = match.span()
        if _inside(tier1_spans, a, b) or _inside(excluded_spans, a, b) or _inside(benign_spans, a, b):
            continue
        if match.group(0) in lexicon.benign_with_lamp_noun:
            sentence_start = _sentence_bounds(norm, a)[0]
            nouns = [m for p in lexicon.benign_lamp_nouns for m in compile_pattern(p).finditer(norm, sentence_start, a)]
            if nouns:  # "Bong den ... bi chay": a lamp noun earlier in the sentence makes it benign (B-01)
                first = min(nouns, key=lambda m: m.start())
                hits.append(_Hit("T2-03", SignalStatus.ABSENT, quote_of(text, index, first.start(), b), "B-01"))
                continue
        status, quote, rule = _judge(norm, index, text, match, lexicon)
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

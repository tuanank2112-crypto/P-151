"""Safety layer, pipeline step 2b (CR-BPTN-03 §6): fixed rules decide, the LLM may only raise the level (Q09).

Pure functions: no IO, no clock, no LLM except `assess_with_llm`. Ticket text is DATA: it is only matched against
lexicon patterns, so an instruction inside the text has no effect (FR-SECURITY-001, AC-18).

Scope rules (plan Q29, rules R1-R10): a negation or a hedge is a cue plus at most two filler tokens ending right before
the signal, inside its clause and within 80 characters; "already over" markers must follow the signal; a benign lamp
phrase (B-01) is a closed set; homographs are judged by their accented token; invisible characters are read twice.
Every threshold, cue and closed set comes from the lexicon.
"""

import re
import unicodedata
from bisect import bisect_left, bisect_right
from collections.abc import Callable, Sequence
from dataclasses import dataclass, replace
from functools import lru_cache
from typing import Literal

from pydantic import BaseModel, Field

from src.maintenance.catalog import SafetyLexicon, compile_pattern
from src.maintenance.enums import DetectedBy, RiskLevel, SignalStatus
from src.maintenance.models import RiskSignal

SEVERITY: dict[SignalStatus, int] = {SignalStatus.ABSENT: 0, SignalStatus.UNCLEAR: 1, SignalStatus.PRESENT: 2}
LEAD = re.compile(r"^(co|thay|nghe thay|ngui thay|bi) ")  # a span opening with a lead word: the window ends after it
SOFT_BREAKS = ",:()—–"  # clause breaks that keep a space in `norm`, so a phrase may still match across them
HARD_BREAKS = ".;!?"  # sentence breaks, kept in `norm`
HANGUL_FILLERS = frozenset(map(chr, (0x115F, 0x1160, 0x3164, 0xFFA0)))  # R8 (code points, never literal characters)
DOWNGRADE_RULES = frozenset({"B-02", "B-02D", "T2-01", "T2-02"})  # rules copied onto T2-05 (§3.4)
TOKEN = re.compile(r"[a-z0-9]+")
LETTERS = re.compile(r"[a-z]+")

Span = tuple[int, int]


# ---------------------------------------------------------------- 3.1 normalisation with an index map (R8)


def is_invisible(char: str) -> bool:
    """R8 + Q31.G, checked on the ORIGINAL character: format and control characters (not tab/newline/CR), U+034F,
    variation selectors, Hangul fillers, the blank Braille cell and private-use characters."""
    category = unicodedata.category(char)
    code = ord(char)
    return (
        category in ("Cf", "Co")
        or (category == "Cc" and char not in (chr(9), chr(10), chr(13)))
        or code in (0x034F, 0x2800)
        or 0xFE00 <= code <= 0xFE0F
        or char in HANGUL_FILLERS
    )


def _fold(char: str) -> str:
    """One character: NFKC (full-width, compatibility forms), lower case, d-stroke to d, accents stripped."""
    low = unicodedata.normalize("NFKC", char).lower().replace("đ", "d")
    return "".join(c for c in unicodedata.normalize("NFD", low) if unicodedata.category(c) != "Mn")


def _normalize(text: str, invisible_as_space: bool) -> tuple[str, list[int], list[int], list[int]]:
    """Returns (norm, index_map, hard_cuts, soft_cuts). A cut is the index in `norm` where the next segment starts.

    Variant A (`invisible_as_space=False`): an invisible character vanishes and does not split a word. Variant B: it
    becomes one space (no clause break). A run of 3 or more equal letters becomes one ("khóiiiii" -> "khoi").
    `.;!?` and line breaks are hard cuts; `,:()—–` are soft cuts.
    """
    out: list[str] = []
    index: list[int] = []
    hard: list[int] = []
    soft: list[int] = []
    prev_space = True
    run_char, run_len, collapsed = "", 0, False
    for i, char in enumerate(text):
        if is_invisible(char):
            if invisible_as_space:
                if not prev_space:
                    out.append(" ")
                    index.append(i)
                    prev_space = True
                run_char, run_len, collapsed = "", 0, False
            continue
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


def normalize_with_map(text: str, *, invisible_as_space: bool = False) -> tuple[str, list[int]]:
    """Lower case, accents stripped, d-stroke to d; punctuation other than `.;!?` becomes one space.

    Returns (norm, index_map) where index_map[k] is the index in `text` of the character that produced norm[k].
    """
    norm, index, _, _ = _normalize(text, invisible_as_space)
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

    def original(self, start: int, end: int) -> str:
        """R7/R9: the accented source of norm[start:end]: NFC, lower case, whitespace collapsed."""
        return " ".join(unicodedata.normalize("NFC", quote_of(self.text, self.index, start, end)).lower().split())


def _span(cuts: list[int], pos: int, size: int) -> Span:
    k = bisect_right(cuts, pos)
    return (cuts[k - 1] if k else 0), (cuts[k] if k < len(cuts) else size)


def build_context(text: str, conjunctions: Sequence[str] = (), *, invisible_as_space: bool = False) -> TextContext:
    """Normalise once and index the sentence and clause boundaries (no per-match scanning later)."""
    norm, index, hard, soft = _normalize(text, invisible_as_space)
    cuts = set(hard) | set(soft)
    if conjunctions:
        conj = re.compile(r"\b(?:" + "|".join(re.escape(c) for c in conjunctions) + r")\b")
        for m in conj.finditer(norm):
            cuts.update((m.start(), m.end()))
    return TextContext(text, norm, index, sorted(set(hard)), sorted(cuts))


# ---------------------------------------------------------------- R1: ONE scope rule shared with priority


@dataclass(frozen=True)
class Scope:
    cue_start: int  # position in norm of the first letter of the cue (start of the quote)
    double: bool  # R1: another cue (+ 0..max_fillers fillers) ends right before this cue: a double negation


def _alt(values: Sequence[str]) -> str:
    return "|".join(re.escape(v) for v in sorted(set(values), key=len, reverse=True))


@lru_cache(maxsize=256)
def _scope_regex(cues: tuple[str, ...], fillers: tuple[str, ...], max_fillers: int) -> re.Pattern[str]:
    pad = rf"(?:\s(?:{_alt(fillers)})){{0,{max_fillers}}}" if fillers and max_fillers > 0 else ""
    return re.compile(rf"(?:^|(?<=\s))(?P<cue>{_alt(cues)}){pad}\s*$")


@lru_cache(maxsize=256)
def _coordination_regex(
    cues: tuple[str, ...], fillers: tuple[str, ...], max_fillers: int, conjunctions: tuple[str, ...]
) -> re.Pattern[str]:
    pad = rf"(?:\s(?:{_alt(fillers)})){{0,{max_fillers}}}" if fillers and max_fillers > 0 else ""
    tail = rf"(?:\s(?:{_alt(fillers)}))?" if fillers else ""
    return re.compile(
        rf"(?:^|(?<=\s))(?P<cue>{_alt(cues)}){pad}(?P<x>(?:\s[a-z0-9]+){{1,3}})\s(?:{_alt(conjunctions)}){tail}\s*$"
    )


def _window(ctx: TextContext, start: int, hi: int, max_chars: int) -> tuple[int, str]:
    """The text a cue is looked for in: inside the clause of `start`, at most `max_chars` before `hi`."""
    lo = max(ctx.clause(start)[0], hi - max_chars)
    if lo > ctx.clause(start)[0] and lo > 0 and ctx.norm[lo - 1] != " ":
        space = ctx.norm.find(" ", lo, hi)  # never start in the middle of a word
        lo = hi if space < 0 else space + 1
    return lo, ctx.norm[lo:hi]


def scope_before(
    ctx: TextContext,
    start: int,
    hi: int,
    cues: Sequence[str],
    fillers: Sequence[str],
    *,
    max_fillers: int,
    max_chars: int,
) -> Scope | None:
    """R1: a cue plus 0..max_fillers filler tokens ending right before `hi`, in the clause of `start`, within
    `max_chars`. Used by safety (negation, hedge) and by priority: one rule, one function."""
    lo, window = _window(ctx, start, hi, max_chars)
    regex = _scope_regex(tuple(cues), tuple(fillers), max_fillers)
    found = regex.search(window)
    if found is None:
        return None
    before = window[: found.start("cue")]
    return Scope(lo + found.start("cue"), bool(before.strip()) and regex.search(before) is not None)


def merge_spans(spans: Sequence[Span]) -> list[Span]:
    """R2: overlapping spans of one signal become one; spans that only touch stay apart."""
    merged: list[Span] = []
    for start, end in sorted(spans):
        if merged and start < merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


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


# ---------------------------------------------------------------- lookups computed once per text and variant


class _Lookups:
    """Everything `_judge` and `assess` ask about positions, computed once per text and per R8 variant."""

    def __init__(self, ctx: TextContext, lexicon: SafetyLexicon):
        norm = ctx.norm
        self.ctx = ctx
        self.lexicon = lexicon
        self.max_fillers = lexicon.scope_max_fillers
        self.max_chars = lexicon.scope_max_chars
        self.particles = frozenset(lexicon.final_particles)
        self.bridge = frozenset(lexicon.resolved_bridge_tokens)
        self.markers = sorted(m.span() for m in _matches(lexicon.resolved_markers, norm))
        self._valid_markers: dict[int, list[Span]] = {}
        self.cooking = _starts([m.span() for m in _matches(lexicon.khet_benign_contexts, norm)])
        self.electric = _starts([m.span() for m in _matches(lexicon.khet_electric_contexts, norm)])
        raw = unicodedata.normalize("NFC", ctx.text).lower()
        self.cooking_raw = sorted(
            m.start() for p in lexicon.khet_benign_contexts_accented for m in compile_pattern(p).finditer(raw)
        )
        self.raw_aligned = len(raw) == len(ctx.text)  # raw positions only usable when NFC kept the lengths
        self.token_starts = [m.start() for m in TOKEN.finditer(norm)]
        self.lamp_re = re.compile(r"\b(?:" + _alt(lexicon.benign_lamp_nouns) + r")\b")
        self.phrases = {tuple(p.split()) for p in (*lexicon.benign_lamp_nouns, *lexicon.b01_prefix_words)}
        self.longest = max((len(p) for p in self.phrases), default=1)
        self.code_re = re.compile(lexicon.b01_code_token_regex)
        self.person = frozenset(lexicon.person_signal_ids)
        self._clause_grams: dict[int, frozenset[str]] = {}

    # -- B-04 ----------------------------------------------------------------------------------------------
    def cooking_context(self, sentence: Span) -> bool:
        """B-04: a cooking word in the sentence and no electrical word: 'khét' near food, not near a wire."""
        s0, s1 = sentence
        if _any_in(self.electric, s0, s1):
            return False
        if _any_in(self.cooking, s0, s1):
            return True
        if self.raw_aligned and self.ctx.index and s1 > s0:
            return _any_in(self.cooking_raw, self.ctx.index[s0], self.ctx.index[s1 - 1] + 1)
        return False

    # -- R5 markers ----------------------------------------------------------------------------------------
    def valid_markers(self, sentence: Span) -> list[Span]:
        """Markers of the sentence after which only final particles remain (computed once per sentence)."""
        s0, s1 = sentence
        if s0 not in self._valid_markers:
            inside = [(a, b) for a, b in self.markers if s0 <= a < s1]
            tail = s0
            if inside:  # end of the last token of the sentence that is not a final particle
                for token in reversed(list(TOKEN.finditer(self.ctx.norm, s0, s1))):
                    if token.group(0) not in self.particles:
                        tail = token.end()
                        break
            self._valid_markers[s0] = [(a, b) for a, b in inside if b >= tail]
        return self._valid_markers[s0]

    # -- R7 ------------------------------------------------------------------------------------------------
    def clause_grams(self, pos: int) -> frozenset[str]:
        """Single tokens and token pairs of the clause of `pos`, computed once per clause."""
        c0, c1 = self.ctx.clause(pos)
        if c0 not in self._clause_grams:
            tokens = TOKEN.findall(self.ctx.norm, c0, c1)
            self._clause_grams[c0] = frozenset(tokens) | frozenset(f"{a} {b}" for a, b in zip(tokens, tokens[1:]))
        return self._clause_grams[c0]

    def homograph_dropped(self, start: int, end: int, pattern: str) -> bool:
        """R7 + Q31.C: a match whose accented token is a known non-risk homograph is dropped, unless the pattern
        means it or the clause holds a word that confirms the dangerous reading (typos keep the signal)."""
        homographs = self.lexicon.homographs
        intended = self.lexicon.homograph_intended.get(pattern, {})
        for token in LETTERS.finditer(self.ctx.norm, start, end):
            forms = homographs.get(token.group(0))
            if forms:
                original = self.ctx.original(token.start(), token.end())
                if original in forms and original not in intended.get(token.group(0), ()):
                    confirmers = self.lexicon.homograph_confirmers.get(token.group(0), ())
                    if confirmers and not self.clause_grams(start).isdisjoint(confirmers):
                        continue
                    return True
        return False


# ---------------------------------------------------------------- 3.2 judging one span


def _negation(lk: _Lookups, start: int, hi: int, signal_id: str) -> Scope | None:
    """R1 + R3 (generic cues, plus person cues for person signals), then R4 (hay/hoặc/lẫn)."""
    lexicon, ctx = lk.lexicon, lk.ctx
    cues = lexicon.negation_prefixes
    if signal_id in lk.person:
        cues = (*cues, *lexicon.person_negation_cues)
    found = scope_before(
        ctx, start, hi, cues, lexicon.negation_fillers, max_fillers=lk.max_fillers, max_chars=lk.max_chars
    )
    if found is not None:
        return found
    lo, window = _window(ctx, start, hi, lk.max_chars)
    regex = _coordination_regex(
        tuple(cues), tuple(lexicon.negation_fillers), lk.max_fillers, tuple(lexicon.coordination_conjunctions)
    )
    m = regex.search(window)
    if m is None:
        return None
    hazard = set(lexicon.coordination_hazard_tokens)
    base = lo + m.start("x")
    excluded = [
        e.span()
        for phrase in lexicon.coordination_hazard_exclusions
        for e in compile_pattern(phrase).finditer(m.group("x"))
    ]  # Q31.D: "chữa cháy", "báo cháy", "phòng cháy" are equipment, not a fire
    for token in TOKEN.finditer(m.group("x")):
        if token.group(0) in hazard and not any(a <= token.start() and token.end() <= b for a, b in excluded):
            a, b = base + token.start(), base + token.end()
            if ctx.original(a, b) not in lexicon.homographs.get(token.group(0), ()):
                before = window[: m.start("cue")]
                regex1 = _scope_regex(tuple(cues), tuple(lexicon.negation_fillers), lk.max_fillers)
                return Scope(lo + m.start("cue"), bool(before.strip()) and regex1.search(before) is not None)
    return None


def _judge(lk: _Lookups, start: int, end: int, signal_id: str = ""):
    """Status of one span. Order: B-02 (R1/R3/R4) > T2-01 (R5 hedge) > T2-02 (R5 marker) > PRESENT.

    Returns (status, quote, rule_id or None).
    """
    ctx, lexicon = lk.ctx, lk.lexicon
    norm, index, text = ctx.norm, ctx.index, ctx.text
    lead = LEAD.match(norm[start:end])
    hi = start + lead.end() - 1 if lead else start  # "khong co khoi": the window ends after the lead word
    negated = _negation(lk, start, hi, signal_id)
    if negated is not None:
        quote = quote_of(text, index, negated.cue_start, end)
        if negated.double:  # "không phải không có khói": a double negation is not a clear absence
            return SignalStatus.UNCLEAR, quote, "B-02D"
        return SignalStatus.ABSENT, quote, "B-02"
    hedge = scope_before(
        ctx, start, hi, lexicon.hedges, lexicon.hedge_fillers, max_fillers=lk.max_fillers, max_chars=lk.max_chars
    )
    if hedge is not None and _hedge_accented(lk, hedge.cue_start):
        return SignalStatus.UNCLEAR, quote_of(text, index, hedge.cue_start, end), "T2-01"
    sentence = ctx.sentence(start)
    for m0, m1 in lk.valid_markers(sentence):
        if end <= m0 < sentence[1]:
            gap = norm[max(end, ctx.clause(m0)[0]) : m0]
            if len(gap) <= lk.max_chars and all(t in lk.bridge for t in gap.split()):  # A2: no subject in between
                return SignalStatus.UNCLEAR, quote_of(text, index, start, m1), "T2-02"
    return SignalStatus.PRESENT, quote_of(text, index, start, end), None


def _hedge_accented(lk: _Lookups, cue_start: int) -> bool:
    """Q31.B: the hedge cue must be written with its accents ("có lẽ", not the name "Cô Lê"); unaccented text keeps
    the higher level."""
    norm = lk.ctx.norm
    for phrase, forms in lk.lexicon.hedge_forms.items():
        end = cue_start + len(phrase)
        if norm.startswith(phrase, cue_start) and (end >= len(norm) or not norm[end].isalnum()):
            if lk.ctx.original(cue_start, end) in forms:
                return True
    return False


# ---------------------------------------------------------------- 3.5 B-01 benign lamp phrases (R6, A1)


def _closed_prefix(lk: _Lookups, c0: int, p: int) -> bool:
    """R6(a)(b): the tokens of norm[c0:p] are at most N and decompose into the closed set of phrases and codes."""
    count = bisect_left(lk.token_starts, p) - bisect_left(lk.token_starts, c0)
    if count > lk.lexicon.b01_max_prefix_tokens:
        return False
    tokens = lk.ctx.norm[c0:p].split()
    reach = [False] * (len(tokens) + 1)
    reach[0] = True
    for i in range(len(tokens)):
        if not reach[i]:
            continue
        if lk.code_re.fullmatch(tokens[i]):
            reach[i + 1] = True
        for length in range(1, min(lk.longest, len(tokens) - i) + 1):
            if tuple(tokens[i : i + length]) in lk.phrases:
                reach[i + length] = True
    return reach[len(tokens)]


def _proven_lamp(lk: _Lookups, match: re.Match[str]) -> bool:
    """A1: every token of the lamp noun that has accented forms is written with one of them."""
    forms = lk.lexicon.benign_lamp_noun_forms
    for token in TOKEN.finditer(match.group(0)):
        accepted = forms.get(token.group(0))
        if accepted and lk.ctx.original(match.start() + token.start(), match.start() + token.end()) not in accepted:
            return False
    return True


def _b01_ok(lk: _Lookups, c0: int, p: int, e: int) -> bool:
    """R6: candidate [p, e) in the clause starting at c0 is a benign lamp phrase."""
    if e > p and lk.ctx.clause(e - 1)[0] != c0:  # the candidate itself crosses a clause break ("cháy, đèn")
        return False
    if not _closed_prefix(lk, c0, p):
        return False
    norm = lk.ctx.norm
    if any(_proven_lamp(lk, m) for m in lk.lamp_re.finditer(norm, c0, e)):
        return True
    after = e + 1 if e < len(norm) and norm[e] == " " else e
    following = lk.lamp_re.match(norm, after)
    # R6: the lamp noun right after the candidate counts only inside the same clause ("cháy, đèn tắt" is two clauses)
    return following is not None and lk.ctx.clause(after)[0] == c0 and _proven_lamp(lk, following)


# ---------------------------------------------------------------- 3 assess


def _assess_hits(text: str, lexicon: SafetyLexicon, invisible_as_space: bool) -> list[_Hit]:
    """§3.0: the whole sequence for ONE R8 variant."""
    ctx = build_context(text, lexicon.clause_conjunctions, invisible_as_space=invisible_as_space)
    norm = ctx.norm
    if not norm.strip():
        return []
    lk = _Lookups(ctx, lexicon)
    hits: list[_Hit] = []
    excluded = _Coverage(len(norm))
    for m in _matches(lexicon.ambiguous_exclusions, norm):
        excluded.add(*m.span())
    benign_spans = []
    for m in _matches(lexicon.benign_phrases, norm):
        c0 = ctx.clause(m.start())[0]
        if _b01_ok(lk, c0, m.start(), m.end()):
            benign_spans.append(m.span())
    benign = _Coverage(len(norm))
    for span in benign_spans:
        benign.add(*span)
    tier1 = _Coverage(len(norm))
    anysig = _Coverage(len(norm))
    active = [s for s in lexicon.signals if s.phase in lexicon.active_phases]

    # 3.3 pattern signals: R7 drops homographs per pattern, R2 merges overlaps, then one verdict per span
    for signal in active:
        raw: list[Span] = []
        for pattern in signal.patterns:
            for m in compile_pattern(pattern).finditer(norm):
                if not lk.homograph_dropped(m.start(), m.end(), pattern):
                    raw.append(m.span())
        for a, b in merge_spans(raw):
            anysig.add(a, b)
            status, quote, rule = _judge(lk, a, b, signal.signal_id)
            rule_id = rule or signal.signal_id
            if signal.signal_id == "S-01" and status == SignalStatus.PRESENT:  # B-04
                if lk.cooking_context(ctx.sentence(a)):
                    status, rule_id = SignalStatus.UNCLEAR, "B-04"
            if signal.tier == 1 and status == SignalStatus.PRESENT:
                tier1.add(a, b)
            hits.append(_Hit(signal.signal_id, status, quote, rule_id))

    # 3.4 components and combinations (S-14 / T2-05)
    component_best: dict[str, tuple[SignalStatus, str, str]] = {}
    for component in lexicon.components:
        best: tuple[SignalStatus, str, str] | None = None
        for match in _matches(component.patterns, norm):
            status, quote, rule = _judge(lk, match.start(), match.end())
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
                rule_id = top[2] if top[2] in DOWNGRADE_RULES else signal.signal_id
                hits.append(_Hit(signal.signal_id, top[0], top[1], rule_id))

    # 3.5.3 B-01 records, one per span
    seen: set[Span] = set()
    for span in benign_spans:
        if span not in seen and not tier1.inside(*span):
            seen.add(span)
            hits.append(_Hit("T2-03", SignalStatus.ABSENT, quote_of(ctx.text, ctx.index, *span), "B-01"))

    # 3.6.1 ambiguous terms (B-03 -> T2-03)
    for pattern in lexicon.ambiguous_terms:
        for match in compile_pattern(pattern).finditer(norm):
            a, b = match.span()
            if tier1.inside(a, b) or excluded.inside(a, b) or benign.inside(a, b):
                continue
            if lk.homograph_dropped(a, b, pattern):
                continue
            c0 = ctx.clause(a)[0]
            if match.group(0) in lexicon.benign_with_lamp_noun and _b01_ok(lk, c0, a, b):
                q0 = c0 + (1 if norm[c0 : c0 + 1] == " " else 0)
                hits.append(_Hit("T2-03", SignalStatus.ABSENT, quote_of(ctx.text, ctx.index, q0, b), "B-01"))
                continue
            status, quote, rule = _judge(lk, a, b)
            hits.append(_Hit("T2-03", status, quote, rule or "B-03"))

    # 3.6.2 R9: accented "khói / lửa / máu / bất động" outside every span is a tier-2 net
    for root, forms in lexicon.tier2_net_roots.items():
        for match in compile_pattern(root).finditer(norm):
            a, b = match.span()
            if any(c.inside(a, b) for c in (tier1, excluded, benign, anysig)):
                continue
            if ctx.original(a, b) not in forms:
                continue
            status, quote, rule = _judge(lk, a, b)
            hits.append(_Hit("T2-03", status, quote, rule or "B-03N"))
    return hits


def assess(text: str, lexicon: SafetyLexicon) -> SafetyAssessment:
    """Deterministic rule assessment of `text` against `lexicon` (SPEC-P01 §3, rules R1-R10).

    R8: the text is read once with invisible characters dropped and, if it has any, once with them as spaces; the
    records of both readings are merged, so the level is the higher of the two.
    """
    hits = _assess_hits(text, lexicon, False)
    if any(is_invisible(c) for c in text):
        hits += _assess_hits(text, lexicon, True)
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

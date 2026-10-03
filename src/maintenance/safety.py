"""Isolated CR03 P0 rules. Text is data; no model, IO or runtime mutations."""

import re
from dataclasses import dataclass

from src.maintenance.rules import normalize


@dataclass(frozen=True)
class SafetySignal:
    signal_id: str
    status: str
    source_quote: str


@dataclass(frozen=True)
class SafetyAssessment:
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
_HAZARD = r"\b(?:mui hac|cay mat|ngat mui|kho tho|gay bong|an mon)\b"
_NEGATIVE = re.compile(r"\b(?:khong|ko|k|chua|chang)\b(?:\s+\w+){0,5}\s*$")
_UNCERTAIN = re.compile(r"\b(?:hinh nhu|co le|nghi ngo|nghi la|nghe nhu|khong chac|chua ro)\b")
_HISTORICAL = re.compile(r"\b(?:hom qua|truoc day|da tung|luc truoc|tuan truoc|gio het|da het)\b")
_BENIGN = re.compile(r"\b(?:bong den|den|bong)\s+(?:bi\s+)?(?:chay|hong|chap chon|nhap nhay|no bong)\b|\bno bong\b")


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


def _status(text: str, start: int, historical: bool, inherited_negative: bool = False) -> str:
    prefix = text[:start]
    if _UNCERTAIN.search(text) or historical:
        return "UNCLEAR"
    if inherited_negative or _NEGATIVE.search(prefix):
        return "ABSENT"
    return "PRESENT"


def assess_safety(text: str, previous_risk: str = "NONE") -> SafetyAssessment:
    """Scan each new text event; retain previous risk. Invalid inputs fail closed."""
    if not isinstance(text, str) or not isinstance(previous_risk, str) or previous_risk not in _RISK:
        raise ValueError("text must be str and previous_risk must be NONE, UNCLEAR or EMERGENCY")
    signals: list[SafetySignal] = []
    unknown: list[SafetySignal] = []
    hazards: list[SafetySignal] = []
    for quote, clause, historical, inherited_negative in _clauses(text):
        for signal_id, pattern in _PATTERNS.items():
            for match in re.finditer(pattern, clause):
                status = _status(clause, match.start(), historical, inherited_negative)
                if (
                    signal_id == "S-01"
                    and status == "PRESENT"
                    and re.search(r"\b(?:com|thuc an|do an|bep|noi|thit)\b", clause)
                    and not re.search(r"\b(?:dien|den|o cam|nhua)\b", clause)
                ):
                    signals.append(SafetySignal("B-04", "UNCLEAR", quote))
                    status = "UNCLEAR"
                signals.append(SafetySignal(signal_id, status, quote))
        for target, pattern in ((unknown, _UNKNOWN), (hazards, _HAZARD)):
            for match in re.finditer(pattern, clause):
                target.append(
                    SafetySignal("S-14", _status(clause, match.start(), historical, inherited_negative), quote)
                )
        benign = _BENIGN.search(clause)
        if benign:
            signals.append(SafetySignal("B-01", "ABSENT", quote))
        ambiguous = re.search(r"\b(?:chay|chap|giat|no bong|khet)\b", clause)
        if ambiguous and not benign and not any(re.search(p, clause) for p in _PATTERNS.values()):
            status = _status(clause, ambiguous.start(), historical, inherited_negative)
            signals.append(
                SafetySignal(
                    "B-04" if "khet" in clause else "T2-03", "ABSENT" if status == "ABSENT" else "UNCLEAR", quote
                )
            )
        sound = re.search(r"\b(?:xeo xeo|u lon|no lop bop|tieng xet)\b", clause)
        if sound:
            status = _status(clause, sound.start(), historical, inherited_negative)
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
    return SafetyAssessment(max((risk, previous_risk), key=_RISK.__getitem__), tuple(signals))

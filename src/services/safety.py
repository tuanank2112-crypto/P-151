"""Hard safety rules on the resident's raw text. The LLM cannot override these.

Any match sends the ticket straight to BQL; no work order is created.
"""

import re
import unicodedata

# Patterns run on text without diacritics, so "mùi khét" and "mui khet" both match
SAFETY_PATTERNS: dict[str, list[str]] = {
    "burning_smell": [r"\bkhet\b"],
    # Bare "khoi"/"chap" are avoided: "khỏi" and "chập chờn" (flickering light) are common
    "smoke_fire": [
        r"boc khoi",
        r"co khoi",
        r"khoi den",
        r"boc chay",
        r"dang chay",
        r"chay no",
        r"tieng no",
        r"phat no",
    ],
    "sparks_short": [r"tia lua", r"chap dien", r"chap mach", r"chap chay", r"xet dien"],
    "electric_shock": [r"dien giat", r"giat dien", r"bi giat", r"ro dien"],
    "exposed_wire": [r"ho day", r"day dien ho", r"day dien bi dut", r"dut day"],
    "power_outage": [r"mat dien", r"cup dien"],
    "breaker_trip": [r"aptomat", r"attomat", r"cau dao", r"cb nhay", r"nhay at"],
    "entrapment": [r"mac ket", r"ket nguoi", r"ket trong thang", r"nguoi bi ket"],
}


def normalize(text: str) -> str:
    """Lowercase and strip Vietnamese diacritics: 'Đèn tầng 5' -> 'den tang 5'."""
    text = text.lower().replace("đ", "d")
    text = unicodedata.normalize("NFD", text)
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def detect_safety_flags(text: str) -> list[str]:
    normalized = normalize(text)
    return [flag for flag, patterns in SAFETY_PATTERNS.items() if any(re.search(p, normalized) for p in patterns)]

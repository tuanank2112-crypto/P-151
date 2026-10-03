"""THAM CHIẾU (REF) bộ nhận diện an toàn 2b + priority (CR-BPTN-03 §6, §7) — bản đo của architect, KHÔNG import vào src/.

Thuật toán ở đây là thuật toán SPEC-P01 §3 / SPEC-P03 §3 mô tả; worker viết lại trong src/maintenance/safety.py.
Chạy (từ root repo, venv 3.11, PYTHONUTF8=1): python planning/01_2026-10-01_cr03-p0-engine/specs/REF-safety-proto.py planning/01_2026-10-01_cr03-p0-engine/specs/SAFETY-CASES-P0.yaml planning/01_2026-10-01_cr03-p0-engine/specs/LEXICON-P0.yaml  → in bảng + tổng; exit 1 nếu có ca sai nhãn.
"""

import re
import sys
import unicodedata
from dataclasses import dataclass

import yaml

SEVERITY = {"ABSENT": 0, "UNCLEAR": 1, "PRESENT": 2}
SENTENCE_BREAK = re.compile(r"[.;!?\n]")


# ---------------------------------------------------------------- chuẩn hoá có bản đồ chỉ số
def normalize_with_map(text: str) -> tuple[str, list[int]]:
    """Chữ thường, bỏ dấu, đ→d, dấu câu (trừ .;!?) → khoảng trắng, gộp khoảng trắng.
    Trả (norm, index_map) với index_map[i] = vị trí ký tự gốc của norm[i]."""
    out: list[str] = []
    idx: list[int] = []
    prev_space = True
    for i, ch in enumerate(text):
        low = ch.lower().replace("đ", "d")
        base = "".join(c for c in unicodedata.normalize("NFD", low) if unicodedata.category(c) != "Mn")
        for c in base:
            if c in ".;!?":
                out.append(c)
                idx.append(i)
                prev_space = False
            elif c.isalnum():
                out.append(c)
                idx.append(i)
                prev_space = False
            else:  # khoảng trắng và mọi dấu câu khác
                if not prev_space:
                    out.append(" ")
                    idx.append(i)
                    prev_space = True
    while out and out[-1] == " ":
        out.pop()
        idx.pop()
    return "".join(out), idx


def quote_of(text: str, idx: list[int], start: int, end: int) -> str:
    """Đoạn trích NGUYÊN VĂN (có dấu) ứng với norm[start:end]."""
    if start >= end or not idx:
        return ""
    return text[idx[start] : idx[end - 1] + 1]


def compile_pattern(p: str) -> re.Pattern:
    if p.startswith("re:"):
        return re.compile(p[3:])
    return re.compile(r"\b" + re.escape(p) + r"\b")


def compile_list(items: list[str]) -> list[re.Pattern]:
    return [compile_pattern(p) for p in items]


# ---------------------------------------------------------------- lexicon
@dataclass
class Lex:
    negation_window_words: int
    negation: list[re.Pattern]
    hedge_window_words: int
    hedges: list[re.Pattern]
    resolved: list[re.Pattern]
    benign: list[re.Pattern]
    benign_lamp_nouns: list[re.Pattern]
    benign_with_lamp_noun: set[str]
    ambiguous: list[re.Pattern]
    ambiguous_excl: list[re.Pattern]
    khet_benign: list[re.Pattern]
    components: dict[str, list[re.Pattern]]
    signals: list[dict]
    active_phases: set[str]
    priority: dict


def load_lex(path: str) -> Lex:
    data = yaml.safe_load(open(path, encoding="utf-8"))
    s = data["safety"]
    return Lex(
        negation_window_words=s["negation_window_words"],
        negation=compile_list(s["negation_prefixes"]),
        hedge_window_words=s["hedge_window_words"],
        hedges=compile_list(s["hedges"]),
        resolved=compile_list(s["resolved_markers"]),
        benign=compile_list(s["benign_phrases"]),
        benign_lamp_nouns=compile_list(s["benign_lamp_nouns"]),
        benign_with_lamp_noun=set(s["benign_with_lamp_noun"]),
        ambiguous=compile_list(s["ambiguous_terms"]),
        ambiguous_excl=compile_list(s["ambiguous_exclusions"]),
        khet_benign=compile_list(s["khet_benign_contexts"]),
        components={c["component_id"]: compile_list(c["patterns"]) for c in s["components"]},
        signals=s["signals"],
        active_phases=set(s["active_phases"]),
        priority=data["priority"],
    )


# ---------------------------------------------------------------- bối cảnh quanh một match
def words_before(norm: str, start: int, k: int) -> tuple[str, int]:
    """k từ ngay trước vị trí start (cùng câu). Trả (chuỗi cửa sổ, vị trí bắt đầu cửa sổ trong norm)."""
    sent_start = max((m.end() for m in SENTENCE_BREAK.finditer(norm, 0, start)), default=0)
    before = norm[sent_start:start]
    words = before.split(" ")
    words = [w for w in words if w != ""]
    tail = words[-k:] if k else []
    window = " ".join(tail)
    pos = start - len(window) if tail else start
    # căn lại vị trí thật của cửa sổ (tránh lệch do khoảng trắng đầu)
    pos = norm.rfind(window, sent_start, start) if window else start
    return window, pos


def sentence_bounds(norm: str, pos: int) -> tuple[int, int]:
    start = max((m.end() for m in SENTENCE_BREAK.finditer(norm, 0, pos)), default=0)
    m = SENTENCE_BREAK.search(norm, pos)
    end = m.start() if m else len(norm)
    return start, end


LEAD = re.compile(r"^(co|thay|nghe thay|ngui thay|bi) ")


def judge(norm: str, idx: list[int], text: str, m: re.Match, lex: Lex) -> tuple[str, str, str]:
    """Trạng thái của một match tín hiệu theo B-02 (phủ định) > T2-01 (nghi ngờ) > T2-02 (đã hết) > PRESENT.
    Trả (status, quote, rule_id)."""
    start, end = m.start(), m.end()
    lead = LEAD.match(norm[start:end])
    probe_end = start + lead.end() - 1 if lead else start  # "khong co khoi": cửa sổ phủ định ăn vào từ dẫn
    window, wpos = words_before(norm, probe_end, lex.negation_window_words)
    if lead:
        window = (window + " " + norm[start:probe_end]).strip()
        wpos = wpos if window else start
    for neg in lex.negation:
        nm = neg.search(window)
        if nm:
            qs = norm.rfind(nm.group(0), 0, end)
            return "ABSENT", quote_of(text, idx, qs, end), "B-02"
    hwindow, hpos = words_before(norm, start, lex.hedge_window_words)
    for h in lex.hedges:
        hm = h.search(hwindow)
        if hm:
            qs = norm.rfind(hm.group(0), 0, start)
            return "UNCLEAR", quote_of(text, idx, qs, end), "T2-01"
    s0, s1 = sentence_bounds(norm, start)
    sentence = norm[s0:s1]
    for r in lex.resolved:
        rm = r.search(sentence)
        if rm:
            return "UNCLEAR", quote_of(text, idx, start, s0 + rm.end()) if s0 + rm.start() >= start else quote_of(text, idx, s0 + rm.start(), end), "T2-02"
    return "PRESENT", quote_of(text, idx, start, end), None


def inside(spans: list[tuple[int, int]], a: int, b: int) -> bool:
    return any(x <= a and b <= y for x, y in spans)


# ---------------------------------------------------------------- đánh giá
def assess(text: str, lex: Lex) -> dict:
    norm, idx = normalize_with_map(text)
    signals: list[dict] = []
    if not norm.strip():
        return {"risk_level": "NONE", "signals": signals}

    def record(signal_id: str, status: str, quote: str, rule_id: str) -> None:
        signals.append({"signal_id": signal_id, "status": status, "quote": quote, "rule_id": rule_id})

    benign_spans = [(m.start(), m.end()) for p in lex.benign for m in p.finditer(norm)]
    excl_spans = [(m.start(), m.end()) for p in lex.ambiguous_excl for m in p.finditer(norm)]
    tier1_spans: list[tuple[int, int]] = []

    # 1) Tín hiệu có pattern (Bậc 1 và Bậc 2 thường)
    comp_status: dict[str, tuple[str, str, str]] = {}
    for sig in lex.signals:
        if sig["phase"] not in lex.active_phases:
            continue
        for p in compile_list(sig.get("patterns", [])):
            for m in p.finditer(norm):
                status, quote, rule = judge(norm, idx, text, m, lex)
                rule_id = rule or sig["signal_id"]
                if sig["signal_id"] == "S-01" and status == "PRESENT":
                    s0, s1 = sentence_bounds(norm, m.start())
                    if any(k.search(norm[s0:s1]) for k in lex.khet_benign):
                        status, rule_id = "UNCLEAR", "B-04"
                if sig["tier"] == 1 and status == "PRESENT":
                    tier1_spans.append((m.start(), m.end()))
                record(sig["signal_id"], status, quote, rule_id)

    # 2) Thành phần tổ hợp (S-14 / T2-05)
    for cid, pats in lex.components.items():
        best = None
        for p in pats:
            for m in p.finditer(norm):
                status, quote, rule = judge(norm, idx, text, m, lex)
                if best is None or SEVERITY[status] > SEVERITY[best[0]]:
                    best = (status, quote, rule or cid)
        if best:
            comp_status[cid] = best
    for sig in lex.signals:
        if sig["phase"] not in lex.active_phases:
            continue
        if "all_of" in sig:
            parts = [comp_status.get(c) for c in sig["all_of"]]
            if all(p and p[0] == "PRESENT" for p in parts):
                record(sig["signal_id"], "PRESENT", " | ".join(p[1] for p in parts), sig["signal_id"])
                tier1_spans.append((0, len(norm)))  # tổ hợp đã PRESENT: không cần ghi T2-05 nữa
        if "any_of" in sig:
            parts_all = [comp_status.get(c) for c in sig["any_of"]]
            if all(p is not None and p[0] == "PRESENT" for p in parts_all):
                continue  # tổ hợp Bậc 1 đã ghi (S-14): không ghi thêm T2-05
            parts = [p for p in parts_all if p is not None]
            if parts and any(p[0] in ("PRESENT", "UNCLEAR") for p in parts):
                top = max(parts, key=lambda p: SEVERITY[p[0]])
                record(sig["signal_id"], top[0], top[1], top[2] if top[2] in ("B-02", "T2-01", "T2-02") else sig["signal_id"])

    # 3) B-01: mọi cụm lành tính khớp đều ghi T2-03 ABSENT (truy vết), không trùng span
    seen_benign: set[tuple[int, int]] = set()
    for span in benign_spans:
        if span not in seen_benign and not inside(tier1_spans, *span):
            seen_benign.add(span)
            record("T2-03", "ABSENT", quote_of(text, idx, *span), "B-01")

    # 4) Từ nhiều nghĩa (B-03 / T2-03): bỏ qua nếu nằm trong cụm Bậc 1, cụm loại trừ, hoặc cụm lành tính
    for p in lex.ambiguous:
        for m in p.finditer(norm):
            a, b = m.start(), m.end()
            if inside(tier1_spans, a, b) or inside(excl_spans, a, b) or inside(benign_spans, a, b):
                continue
            if m.group(0) in lex.benign_with_lamp_noun:
                s0, _ = sentence_bounds(norm, a)
                nouns = [nm for pn in lex.benign_lamp_nouns for nm in pn.finditer(norm, s0, a)]
                if nouns:  # "Bóng đèn ... bị cháy": danh từ đèn đứng trước trong cùng câu → B-01
                    first = min(nouns, key=lambda nm: nm.start())
                    record("T2-03", "ABSENT", quote_of(text, idx, first.start(), b), "B-01")
                    continue
            status, quote, rule = judge(norm, idx, text, m, lex)
            record("T2-03", status, quote, rule or "B-03")

    return {"risk_level": derive(signals, lex), "signals": dedupe(signals)}


def dedupe(signals: list[dict]) -> list[dict]:
    """Mỗi cặp (signal_id, status) chỉ giữ MỘT bản ghi: trích dẫn dài nhất; giữ thứ tự xuất hiện đầu tiên."""
    best: dict[tuple[str, str], dict] = {}
    order: list[tuple[str, str]] = []
    for s in signals:
        key = (s["signal_id"], s["status"])
        if key not in best:
            best[key] = s
            order.append(key)
        elif len(s["quote"]) > len(best[key]["quote"]):
            best[key] = s
    return [best[k] for k in order]


def derive(signals: list[dict], lex: Lex) -> str:
    tier = {s["signal_id"]: s["tier"] for s in lex.signals}
    if any(tier.get(s["signal_id"]) == 1 and s["status"] == "PRESENT" for s in signals):
        return "EMERGENCY"
    if any(tier.get(s["signal_id"]) == 1 and s["status"] == "UNCLEAR" for s in signals):
        return "UNCLEAR"
    if any(tier.get(s["signal_id"]) == 2 and s["status"] in ("PRESENT", "UNCLEAR") for s in signals):
        return "UNCLEAR"
    return "NONE"


# ---------------------------------------------------------------- gộp rule ⊕ llm (Q09): LLM chỉ nâng mức
def grounded(quote: str | None, text: str) -> bool:
    if not quote or not quote.strip():
        return False
    qn, _ = normalize_with_map(quote)
    tn, _ = normalize_with_map(text)
    return qn in tn


def merge_llm(rule: dict, llm_judgements: list[dict] | None, text: str, error: str | None, lex: Lex) -> dict:
    """llm_judgements: [{signal_id, status, quote}]. Trả assessment mới; không bao giờ hạ mức luật."""
    signals = [dict(s) for s in rule["signals"]]
    notes: list[str] = []
    if error is not None:
        return {"risk_level": rule["risk_level"], "signals": signals, "notes": [f"LLM lỗi ({error}); giữ kết quả luật"]}
    known = {s["signal_id"] for s in lex.signals if s["phase"] in lex.active_phases}
    for j in llm_judgements or []:
        if j["signal_id"] not in known:
            notes.append(f"{j['signal_id']}: LLM nêu tín hiệu ngoài từ vựng P0; bỏ qua")
            continue
        status = j["status"]
        quote = (j.get("quote") or "").strip()
        if status == "ABSENT":
            notes.append(f"{j['signal_id']}: LLM ABSENT không bao giờ hạ mức luật; bỏ qua")
            continue
        if not quote:
            notes.append(f"{j['signal_id']}: LLM {status} không có trích dẫn; bỏ qua")
            continue
        if not grounded(quote, text):
            notes.append(f"{j['signal_id']}: trích dẫn LLM không có trong phản ánh → UNCLEAR")
            status = "UNCLEAR"
        existing = [s for s in signals if s["signal_id"] == j["signal_id"]]
        best_rule = max((SEVERITY[s["status"]] for s in existing), default=-1)
        if SEVERITY[status] > best_rule:
            signals.append({"signal_id": j["signal_id"], "status": status, "quote": quote, "rule_id": "LLM", "detected_by": "LLM"})
        else:
            notes.append(f"{j['signal_id']}: LLM {j['status']} không cao hơn luật; giữ luật")
    return {"risk_level": derive(signals, lex), "signals": dedupe(signals), "notes": notes}


def selftest_merge(lex: Lex) -> int:
    text = "Đèn hành lang tầng 3 tòa SIM-A có mùi khét bốc ra từ hộp đèn."
    rule = assess(text, lex)
    assert rule["risk_level"] == "EMERGENCY"
    # 1) LLM nói ABSENT: không hạ
    out = merge_llm(rule, [{"signal_id": "S-01", "status": "ABSENT", "quote": None}], text, None, lex)
    assert out["risk_level"] == "EMERGENCY", out
    # 2) LLM lỗi: giữ luật, ghi fallback
    out = merge_llm(rule, None, text, "TimeoutError", lex)
    assert out["risk_level"] == "EMERGENCY" and out["notes"][0].startswith("LLM lỗi"), out
    # 3) Luật NONE, LLM PRESENT có trích dẫn đúng → nâng lên EMERGENCY
    text2 = "Hành lang tầng 3 tòa SIM-A bóng đèn tối, nghe mùi lạ như cao su cháy."
    rule2 = assess(text2, lex)
    out = merge_llm(rule2, [{"signal_id": "S-01", "status": "PRESENT", "quote": "mùi lạ như cao su cháy"}], text2, None, lex)
    assert out["risk_level"] == "EMERGENCY", (rule2, out)
    # 4) LLM PRESENT nhưng trích dẫn bịa → UNCLEAR (Bậc 2), không EMERGENCY
    out = merge_llm(rule2, [{"signal_id": "S-01", "status": "PRESENT", "quote": "có khói đen"}], text2, None, lex)
    assert out["risk_level"] == "UNCLEAR", out
    # 5) LLM nêu tín hiệu P1 (S-10) trong P0 → bỏ qua
    out = merge_llm(rule2, [{"signal_id": "S-10", "status": "PRESENT", "quote": "mùi lạ"}], text2, None, lex)
    assert out["risk_level"] == rule2["risk_level"], out
    print("MERGE_SELFTEST=5 ok (rule2 level=%s)" % rule2["risk_level"])
    return 0


# ---------------------------------------------------------------- priority
def propose_priority(category: str | None, location: str | None, text: str, lex: Lex) -> tuple[str, str]:
    norm, _ = normalize_with_map(text)
    pr = lex.priority
    area = location.split(" / ")[-1] if location else None
    if location is None or category not in ("KY_THUAT", "VE_SINH"):
        return "MEDIUM", "PRI-D0"
    if category == "KY_THUAT":
        return ("HIGH", "PRI-H1") if area in pr["high_areas"] else ("MEDIUM", "PRI-M1")
    if any(p.search(norm) for p in compile_list(pr["obstruction_patterns"])):
        return "HIGH", "PRI-H2"
    if any(p.search(norm) for p in compile_list(pr["usage_impact_patterns"])):
        return "MEDIUM", "PRI-M2"
    return "LOW", "PRI-L1"


# ---------------------------------------------------------------- chạy tập ca
def main(cases_path: str, lex_path: str) -> int:
    lex = load_lex(lex_path)
    data = yaml.safe_load(open(cases_path, encoding="utf-8"))
    bad = 0
    tier1_miss = 0
    counts = {"EMERGENCY": 0, "UNCLEAR": 0, "NONE": 0}
    for group in ("safety_cases", "regression_strings"):
        print(f"== {group} ==")
        for c in data[group]:
            r = assess(c["text"], lex)
            got = r["risk_level"]
            ids = sorted({s["signal_id"] for s in r["signals"] if s["status"] != "ABSENT"})
            ok = got == c["expect"]
            if "signals" in c:
                ok = ok and set(c["signals"]) <= set(ids)
            if "absent" in c:
                ok = ok and all(any(s["signal_id"] == a and s["status"] == "ABSENT" for s in r["signals"]) for a in c["absent"])
            # source_quote tổ hợp (S-14) = các đoạn trích nối bằng " | "; mỗi đoạn phải nằm trong văn bản gốc
            grounded = all(
                s["quote"] and all(part in c["text"] for part in s["quote"].split(" | ")) for s in r["signals"]
            )
            ok = ok and grounded
            counts[got] += 1
            if not ok:
                bad += 1
                if c["expect"] == "EMERGENCY" and got != "EMERGENCY":
                    tier1_miss += 1
            flag = "ok " if ok else "SAI"
            print(f"{flag} {c.get('id','-'):>6} expect={c['expect']:<9} got={got:<9} ids={ids} | {c['text'][:60]}")
            if not ok:
                for s in r["signals"]:
                    print("       ", s)
    print("== priority_cases ==")
    for c in data.get("priority_cases", []):
        pri, rule = propose_priority(c["category"], c["location"], c["text"], lex)
        ok = (pri, rule) == (c["expect"], c["rule"])
        if not ok:
            bad += 1
        print(f"{'ok ' if ok else 'SAI'} {c.get('id','-'):>6} expect={c['expect']}/{c['rule']} got={pri}/{rule} | {c['text'][:50]}")
    total = sum(len(data[g]) for g in ("safety_cases", "regression_strings")) + len(data.get("priority_cases", []))
    print(f"TOTAL={total} BAD={bad} TIER1_MISS={tier1_miss} levels={counts}")
    selftest_merge(lex)
    if "--quotes" in sys.argv:
        for c in data["safety_cases"]:
            if c["id"] in ("SC-07", "SC-11", "SC-13", "SC-14", "SC-18", "SC-21", "SC-24", "SC-40"):
                print(c["id"], assess(c["text"], lex)["signals"])
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "lexicon.yaml"))

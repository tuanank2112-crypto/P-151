# SPEC-P01 — Tầng an toàn (bước 2b): bộ nhận diện thuần + từ vựng dữ liệu + guard LLM

| Trường | Giá trị |
|---|---|
| WP | WP3 (🟠 worker-sonnet) — sau WP2 |
| Nguồn | CR-03 §5.1 (2b), §5.2, §6.1–§6.3, §6.6 (B-01…B-04), §15 (bộ câu), AC-01…AC-05, AC-08 (phần chạy lại), AC-18; Q06–Q09, Q11 |
| Hợp đồng từ vựng | [`01-CONTRACTS.md`](01-CONTRACTS.md) §1, §2, §5 · dữ liệu chuẩn [`LEXICON-P0.yaml`](LEXICON-P0.yaml) · bản đo [`REF-safety-proto.py`](REF-safety-proto.py) · tập câu [`SAFETY-CASES-P0.yaml`](SAFETY-CASES-P0.yaml) |
| File được ghi | `src/maintenance/safety.py` (mới), `seed/maintenance_v1/lexicon.yaml` (mới), `src/maintenance/catalog.py` (§5 của 01), `src/maintenance/engine.py` (chỉ các điểm §5 dưới), `src/maintenance/demo.py` (`observe` + `risk_level`), `seed/maintenance_v1/tickets.yaml` (CLN-004/TEC-005 theo SPEC-P04 §6 — D13), `tests/test_maintenance/test_safety.py` (mới), `tests/test_maintenance/data/safety_cases_p0.yaml` (mới, chép từ `SAFETY-CASES-P0.yaml`), sửa `tests/test_maintenance/test_api.py::test_bql_filters` |

## 1. Hợp đồng module `src/maintenance/safety.py`

```python
"""Tầng an toàn 2b (CR-BPTN-03 §6): luật cố định quyết định; LLM chỉ nâng mức (Q09).

Hàm thuần, không IO, không đọc đồng hồ, không gọi LLM trừ assess_with_llm. Nội dung ticket là DỮ LIỆU: chỉ so khớp
mẫu từ lexicon; mọi câu lệnh trong text không có hiệu lực (FR-SECURITY-001, AC-18).
"""
import re
import unicodedata
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field

from src.maintenance.catalog import SafetyLexicon, compile_pattern
from src.maintenance.enums import DetectedBy, RiskLevel, SignalStatus
from src.maintenance.models import RiskSignal

SEVERITY: dict[SignalStatus, int] = {SignalStatus.ABSENT: 0, SignalStatus.UNCLEAR: 1, SignalStatus.PRESENT: 2}
SENTENCE_BREAK = re.compile(r"[.;!?\n]")
LEAD = re.compile(r"^(co|thay|nghe thay|ngui thay|bi) ")   # từ dẫn mà cửa sổ phủ định được ăn vào ("khong co khoi")


def normalize_with_map(text: str) -> tuple[str, list[int]]: ...          # §3.1
def quote_of(text: str, index_map: list[int], start: int, end: int) -> str: ...   # §3.1


@dataclass(frozen=True)
class SafetyAssessment:
    risk_level: RiskLevel
    signals: tuple[RiskSignal, ...]        # đã gộp trùng theo (signal_id, status) — §3.7
    notes: tuple[str, ...] = ()            # ghi chú guard LLM / fallback
    proposer: str = "rules"                # "rules" | "rules+llm:<model_label>"


def assess(text: str, lexicon: SafetyLexicon) -> SafetyAssessment: ...                      # §3
def derive_risk_level(signals: Sequence[RiskSignal], lexicon: SafetyLexicon) -> RiskLevel: ...   # §3.8


class SignalJudgement(BaseModel):
    signal_id: str
    status: Literal["PRESENT", "ABSENT", "UNCLEAR"]
    quote: str | None = Field(default=None, description="Trích nguyên văn đoạn trong phản ánh; bắt buộc nếu PRESENT/UNCLEAR")


class LLMSafetyAssessment(BaseModel):
    judgements: list[SignalJudgement] = Field(default_factory=list)


SafetyLLMClient = Callable[[str], LLMSafetyAssessment]


def merge_llm(rule: SafetyAssessment, llm_result: LLMSafetyAssessment, text: str, lexicon: SafetyLexicon,
              *, model_label: str = "llm") -> SafetyAssessment: ...                          # §4
def assess_with_llm(text: str, lexicon: SafetyLexicon, llm: SafetyLLMClient | None = None,
                    model_label: str = "llm") -> SafetyAssessment: ...                       # §4
```

`assess` là hàm **xác định** (cùng text + cùng lexicon ⇒ cùng kết quả), không phụ thuộc thứ tự dict/set (duyệt `lexicon.signals`/`components` theo thứ tự khai báo).

## 2. Dữ liệu: `seed/maintenance_v1/lexicon.yaml`

- Chép **nguyên văn** `LEXICON-P0.yaml` (được đổi 2 dòng chú thích đầu). Schema và validator: 01 §5. `active_phases: [P0]`.
- Ai sửa gì không chạm code: Trường (chủ rules/nhãn) thêm/bớt pattern, đổi `phase`, thêm tín hiệu `S-15…` (regex `signal_id` cho phép), thêm `hedges`/`negation_prefixes`. Mỗi lần sửa phải chạy `tests/test_maintenance/test_safety.py` (tập câu có nhãn) — đó là lưới an toàn của dữ liệu.
- Cột `scope` **không** được code dùng ở P0 (D12). CẤM lọc tín hiệu theo category trong 2b (2b chạy trước phân loại).

## 3. Thuật toán `assess` (đúng như `REF-safety-proto.py`, đã đo TOTAL=84 BAD=0 TIER1_MISS=0)

### 3.1 Chuẩn hoá có bản đồ chỉ số
- Duyệt từng ký tự gốc `text[i]`: `lower()`, `đ→d`, `NFD` rồi bỏ mọi ký tự loại `Mn` (dấu). Ký tự kết quả: `.;!?` giữ nguyên (ranh giới câu); chữ/số giữ; **mọi ký tự khác** (khoảng trắng, `,:/()-"…`) thành MỘT khoảng trắng (gộp liên tiếp); bỏ khoảng trắng cuối. `index_map[k]` = `i` của ký tự gốc sinh ra `norm[k]`.
- `quote_of(text, index_map, a, b) = text[index_map[a] : index_map[b-1] + 1]` — **nguyên văn có dấu**. Bất biến (test): với mọi match `(a, b)` trên `norm`, `quote_of(...)` là chuỗi con của `text`.
- Ví dụ: `"MÙI  KHÉT!!! Ở HÀNH LANG"` → `norm = "mui khet o hanh lang"`; match `mui khet` (0, 8) → quote `"MÙI  KHÉT"`.

### 3.2 Phán một match (hàm `judge`) — thứ tự ưu tiên cố định: **B-02 > T2-01 > T2-02 > PRESENT**
Với match `(start, end)` của một pattern:
1. **B-02 phủ định**: cửa sổ = `negation_window_words` (4) từ ngay trước `start` **trong cùng câu**; nếu match bắt đầu bằng từ dẫn `LEAD` (`co `, `thay `, `nghe thay `, `ngui thay `, `bi `) thì cửa sổ được nối thêm từ dẫn đó (để `khong co khoi` khớp `khong co`). Có `negation_prefixes` trong cửa sổ ⇒ `ABSENT`, `rule_id="B-02"`, quote từ đầu cụm phủ định đến `end`.
2. **T2-01 nghi ngờ**: cửa sổ = `hedge_window_words` (5) từ trước `start` cùng câu; có `hedges` ⇒ `UNCLEAR`, `rule_id="T2-01"`, quote từ hedge đến `end`. Hedge **sau** tín hiệu không tính (an toàn trước).
3. **T2-02 đã xảy ra và đã hết**: câu chứa match có `resolved_markers` (`gio het roi`, `da het`, `khong con nua`…) ⇒ `UNCLEAR`, `rule_id="T2-02"`, quote từ `start` đến hết marker (hoặc từ marker đến `end` nếu marker đứng trước). **Mốc quá khứ đơn thuần** ("hôm qua") KHÔNG hạ (D4).
4. Ngược lại `PRESENT`, `rule_id = signal_id`.
Câu = đoạn giữa hai ký tự `.;!?\n` (dấu phẩy KHÔNG ngắt câu).

### 3.3 Tín hiệu có `patterns` (chỉ `phase ∈ active_phases`)
Với mỗi `SignalDef` có `patterns`, mỗi pattern, mỗi match: `status, quote, rule = judge(...)`; ghi `RiskSignal(signal_id, status, quote, detected_by=RULE, rule_id=rule or signal_id)`.
- **B-04** chỉ áp cho `S-01`: nếu `PRESENT` và cùng câu có `khet_benign_contexts` (cơm, thức ăn, nấu, bếp…) ⇒ `UNCLEAR`, `rule_id="B-04"` (D3: mặc định Bậc 1, chỉ hạ khi ngữ cảnh nấu ăn).
- Mỗi match Bậc 1 `PRESENT` ghi span vào `tier1_spans` (dùng ở 3.5/3.6).

### 3.4 Thành phần và tổ hợp (`components`, `all_of`, `any_of`)
- Mỗi `component_id`: trạng thái tốt nhất (max `SEVERITY`) trong các match của nó, kèm quote và rule.
- `all_of` (S-14): **mọi** thành phần `PRESENT` ⇒ ghi `S-14 PRESENT`, `source_quote = " | ".join(quote từng thành phần theo thứ tự all_of)`, `rule_id="S-14"`; coi toàn văn bản là span Bậc 1 (không ghi thêm T2-05).
- `any_of` (T2-05): nếu KHÔNG đủ all_of và có ít nhất một thành phần `PRESENT`/`UNCLEAR` ⇒ ghi `T2-05` với status = max, quote của thành phần đó, `rule_id` = rule hạ (`B-02`/`T2-01`/`T2-02`) nếu có, ngược lại `"T2-05"`. Chỉ có thành phần `ABSENT` ⇒ không ghi.

### 3.5 B-01 lành tính (ghi để truy vết)
Mọi span khớp `benign_phrases` (không nằm trong `tier1_spans`), mỗi span một lần ⇒ ghi `T2-03 ABSENT`, `rule_id="B-01"`, quote = span. Ví dụ: `"Nổ bóng"`, `"chập chờn"`.

### 3.6 Từ nhiều nghĩa (B-03 → T2-03)
Với mỗi match của `ambiguous_terms` `(a, b)`:
1. Bỏ qua nếu nằm trong `tier1_spans` (đã là Bậc 1), trong `ambiguous_exclusions` (`nuoc chay`, `chay ra`…: đồng tự không phải rủi ro), hoặc trong span `benign_phrases`.
2. Nếu `norm[a:b] ∈ benign_with_lamp_noun` (P0: `chay`) và **cùng câu, đứng trước** có `benign_lamp_nouns` (bong, den, tuyp, chieu sang…) ⇒ `T2-03 ABSENT`, `rule_id="B-01"`, quote từ danh từ đèn đầu tiên đến `b` (vd `"Bóng đèn hành lang tầng 3 tòa SIM-A bị cháy"`).
3. Ngược lại `judge` ⇒ `T2-03` với status/quote, `rule_id` = rule hạ nếu có, ngược lại `"B-03"`.
Hệ quả B-03 của CR-03 ("chỉ lên Bậc 1 khi đi cùng khói/lửa/mùi khét…") tự thoả: tín hiệu kèm theo đã là Bậc 1 `PRESENT` ⇒ `EMERGENCY` theo 3.8.

### 3.7 Gộp trùng
Mỗi cặp `(signal_id, status)` giữ **một** bản ghi: trích dẫn dài nhất; thứ tự = lần xuất hiện đầu. (`SC-11`: còn `S-01 PRESENT "mùi khét"` + `S-04 ABSENT "Không có khói"`.)

### 3.8 Suy ra `risk_level` (`derive_risk_level`)
```
EMERGENCY  nếu ∃ signal tier 1 với status PRESENT                      # PRESENT thắng UNCLEAR (CR-03 §6.2)
UNCLEAR    nếu không, và ∃ signal tier 1 UNCLEAR hoặc ∃ signal tier 2 PRESENT/UNCLEAR
NONE       còn lại (kể cả chỉ có ABSENT)
```
`tier` tra từ `lexicon.signals` theo `signal_id`.

### 3.9 Rỗng
`norm.strip() == ""` ⇒ `SafetyAssessment(NONE, ())`, không ghi chú.

### 3.10 Ví dụ bắt buộc đúng (từ bản đo; mọi quote là chuỗi con nguyên văn)
| Câu | risk_level | signals (signal_id/status/rule_id/quote) |
|---|---|---|
| `Đèn sảnh thang máy tầng 5 tòa SIM-A không sáng, có tia lửa và mùi khét ở hộp đèn.` (TEC-005) | EMERGENCY | `S-01/PRESENT/S-01/"mùi khét"`, `S-02/PRESENT/S-02/"tia lửa"` |
| `Tầng hầm B1 tòa SIM-A có chất lỏng lạ không rõ nguồn gốc, bốc mùi hắc gây khó thở, cần vệ sinh.` (CLN-004) | EMERGENCY | `S-14/PRESENT/S-14/"chất lỏng lạ | mùi hắc"` |
| `Không có khói nhưng có mùi khét rõ ở hộp đèn tầng 2 tòa SIM-B.` | EMERGENCY | `S-01/PRESENT`, `S-04/ABSENT/B-02/"Không có khói"` |
| `Hình như có mùi khét ở hành lang tầng 3 tòa SIM-A.` | UNCLEAR | `S-01/UNCLEAR/T2-01/"Hình như có mùi khét"` |
| `Hôm qua đèn tầng 2 tòa SIM-B có tia lửa, giờ hết rồi.` | UNCLEAR | `S-02/UNCLEAR/T2-02/"tia lửa, giờ hết rồi"` |
| `Bóng đèn hành lang tầng 3 tòa SIM-A bị cháy.` | NONE | `T2-03/ABSENT/B-01/"Bóng đèn hành lang tầng 3 tòa SIM-A bị cháy"` |
| `Không có dấu hiệu cháy nổ, chỉ là đèn hành lang tầng 3 tòa SIM-A hỏng.` | NONE | `S-05/ABSENT/B-02/"Không có dấu hiệu cháy nổ"`, `T2-03/ABSENT/B-02/…` |

## 4. Guard LLM — `merge_llm` / `assess_with_llm` (Q09, CR-03 §6.1.1, AC-05)

```
assess_with_llm(text, lexicon, llm, label):
    rule = assess(text, lexicon)
    if llm is None: return rule
    try: result = llm(text)
    except Exception as exc: return replace(rule, notes=rule.notes + (f"LLM lỗi ({type(exc).__name__}); giữ kết quả luật",))
    return merge_llm(rule, result, text, lexicon, model_label=label)

merge_llm — với từng judgement j:
    j.signal_id ∉ {s.signal_id | s ∈ lexicon.signals, s.phase ∈ active_phases}  → bỏ qua + note "ngoài từ vựng P0"
    j.status == ABSENT                                                          → bỏ qua + note (KHÔNG BAO GIỜ hạ)
    quote rỗng                                                                  → bỏ qua + note "không có trích dẫn"
    normalize(quote) ∉ normalize(text)  (so trên văn bản chuẩn hoá, 3.1)         → status := UNCLEAR + note "trích dẫn không có trong phản ánh"
    SEVERITY[status] > max SEVERITY của các bản ghi cùng signal_id trong rule   → thêm RiskSignal(detected_by=LLM, rule_id="LLM", source_quote=quote)
    ngược lại                                                                   → bỏ qua + note "không cao hơn luật"
    kết quả: signals gộp trùng (3.7), risk_level = derive_risk_level, proposer = f"rules+llm:{label}"
```
Bất biến I-12 kiểm bằng test: `merge_llm` không bao giờ trả `risk_level` thấp hơn `rule.risk_level`, không bao giờ bớt bản ghi của luật. Bản đo `MERGE_SELFTEST=5 ok` (REF).

Fake client cho test: `lambda text: LLMSafetyAssessment(judgements=[SignalJudgement(signal_id="S-01", status="ABSENT")])` v.v.; `MaintenanceEngine(safety_llm=fake)`.

## 5. Nối vào engine (`engine.py`) — chỉ các điểm sau

### 5.1 Tuple bước (`_run_pipeline`, hiện dòng 1525–1533)
```python
steps = (
    (2, self._step_2b_assess_safety),        # [MỚI] Q08: trước dữ liệu tối thiểu — Bậc 1 > Bậc 2 > MISSING_INFO
    (2, self._step_2_check_required_data),   # giữ nguyên thân hàm
    (3, self._step_3_classify_and_propose_department),
    (4, self._step_4_check_duplicate_ticket),
    (5, self._step_5_check_bptn_review_needed),
    (6, self._step_6_lookup_asset),
    (7, self._step_7_check_material_stock),
    (8, self._step_8_route_to_department),
)
```
Cả hai bước đầu mang số 2 ⇒ `resume_step=2` chạy lại cả 2b lẫn 2 (I-04, D2).

### 5.2 Văn bản 2b đọc — `_safety_scope_text`
```python
def _safety_scope_text(self, work: Case) -> str:
    """Toàn bộ nội dung khi chưa từng xác nhận an toàn; sau khi xác nhận chỉ phần cư dân bổ sung SAU mốc đó (CR-03 §5.2)."""
    cleared_at = work.ticket.safety_cleared_at
    if cleared_at is None:
        return self._content(work)
    return "\n".join(a.content for a in work.additions if a.submitted_at > cleared_at)
```

### 5.3 Bước 2b
```python
def _step_2b_assess_safety(self, work: Case, now: datetime) -> bool:
    """CR-03 §5.1 bước 2b. Chạy cho MỌI ticket có nội dung, trước phân loại; Bậc 1 dừng (BQL), Bậc 2 dừng (BPTN)."""
    text = self._safety_scope_text(work)
    if _blank(text):
        return False                                   # không có gì để đánh giá (rỗng, hoặc đã cleared và không có bổ sung mới)
    result = assess_with_llm(text, self.lexicon.safety, self.safety_llm, self.llm_label)
    ticket = work.ticket
    old = ticket.risk_level
    ticket.risk_level, ticket.risk_signals = result.risk_level, list(result.signals)
    present = sorted({s.signal_id for s in result.signals if s.status == SignalStatus.PRESENT})
    self._agent(work, Action.ASSESS_SAFETY, "Ticket", ticket.ticket_id, "risk_level", old,
                {"risk_level": result.risk_level, "signals": list(result.signals), "notes": list(result.notes),
                 "proposer": result.proposer, "scope": "additions_after_clear" if ticket.safety_cleared_at else "full"},
                "Tầng an toàn bước 2b (luật cố định; LLM chỉ nâng mức)", now=now,
                rule_id=next((s.rule_id for s in result.signals if s.status == SignalStatus.PRESENT), None))
    if result.risk_level == RiskLevel.EMERGENCY:
        ticket.related_ticket_ids = self._related_ticket_ids(work)           # Q11: chỉ liên kết, không gộp
        self._stop(work, S.VERIFYING, R.EMERGENCY_PENDING_BQL, now, resume_step=2, note=f"Bậc 1: {', '.join(present)}")
        self._notify(work, "emergency.created", BlockerOwner.BQL, now,
                     {"risk_level": RiskLevel.EMERGENCY, "signal_ids": present, "related_ticket_ids": ticket.related_ticket_ids})
        return True
    if result.risk_level == RiskLevel.UNCLEAR:
        unclear = sorted({s.signal_id for s in result.signals if s.status != SignalStatus.ABSENT})
        return self._stop(work, S.VERIFYING, R.SAFETY_REVIEW_REQUIRED, now, resume_step=2, note="Bậc 2: " + ", ".join(unclear))
    return False
```
- `_stop` dùng `actor_id=AGENT_ID, role=Role.AGENT` mặc định ⇒ T04 bởi AGENT với lý do mới (01 §3.2).
- Không tạo proposal, không `proposed_department_id`, không draft (CR-03 §6.1.4) — pipeline dừng trước bước 3.
- Thứ tự thắng Q08 tự thoả vì 2b đứng trước 2.

### 5.4 Liên kết ticket Bậc 1 (Q11)
```python
def _related_ticket_ids(self, work: Case) -> list[str]:
    """Ticket chưa kết thúc, cùng vị trí (effective_location), tạo trước, trong duplicate_window_hours — KHÔNG lọc category."""
    location, created = self.effective_location(work), _created_at(work.ticket.raw)
    if location is None or created is None:
        return []
    earliest = created - timedelta(hours=self.catalog.sla_config.duplicate_window_hours)
    found = []
    for other in self.cases.values():
        ticket = other.ticket
        if ticket.ticket_id == work.ticket.ticket_id or ticket.status in TERMINAL_STATUSES:
            continue
        other_created = _created_at(ticket.raw)
        if other_created is None or not (earliest <= other_created < created):
            continue
        if self.effective_location(other) == location:
            found.append(ticket.ticket_id)
    return sorted(found)
```
Một chiều (chỉ ticket mới ghi); không đụng `_find_duplicate_ticket_id`.

### 5.5 Blocker an toàn trong `_new_blocker` / `_schedule` / `_cleared` / `_escalate` / `route_blockers`
```python
# _new_blocker: thêm NHÁNH TRƯỚC nhánh `code in BPTN_REASONS`
elif code == R.SAFETY_REVIEW_REQUIRED:
    escalate_at = now + timedelta(hours=sla.safety_review.escalate_after_hours)   # giờ LỊCH (Q10)
elif code == R.EMERGENCY_PENDING_BQL:
    escalate_at = None                                                            # BQL đã được báo ngay (emergency.created)
# _new_blocker: MISSING_INFO nhận kwarg mới safety_context: bool = False (P02 §5.3): 12 h thay cho 72 h
# _schedule: `if code in SAFETY_REASONS: return None` (không tự nhắc)
# _cleared: dòng đầu `if code in SAFETY_REASONS: return False` (I-10)
# _escalate: khi blocker.code == R.SAFETY_REVIEW_REQUIRED ⇒ type "safety.review_escalated" (audience BQL) thay cho "escalation"
# route_blockers: 01 §3.4
```

### 5.6 Audit/outbox
| Sự kiện | Audit (`action`, `field_name`) | StatusEvent | Outbox |
|---|---|---|---|
| 2b NONE | `ASSESS_SAFETY`, `risk_level` | không | không |
| 2b UNCLEAR | `ASSESS_SAFETY` + (T04 ghi qua `_apply_transition`) | `RECEIVED→VERIFYING`, `reason_code=SAFETY_REVIEW_REQUIRED`, public | `ticket.status_changed` (cư dân) |
| 2b EMERGENCY | `ASSESS_SAFETY` | `RECEIVED→VERIFYING`, `EMERGENCY_PENDING_BQL`, public | `ticket.status_changed` + `emergency.created` (BQL) |

## 6. Seed và test hồi quy phải đổi trong WP3 (D13)
- `tickets.yaml`: CLN-004, TEC-005 theo SPEC-P04 §6 (expected Bậc 1) — nếu không, `test_all_twelve_tickets_match_expected_outcome`, `test_evaluate_endpoint_passes_all` đỏ.
- `test_api.py::test_bql_filters`: tập `VERIFYING` thành `{"SIM-TKT-TEC-002", "SIM-TKT-TEC-005", "SIM-TKT-CLN-004"}`.
- `demo.observe` thêm `risk_level`/`priority` (01 §9) để fixture khẳng định `risk_level: EMERGENCY`.

## 7. BẮT BUỘC / CẤM / Vùng cấm

**BẮT BUỘC**
1. `assess` thuần: không `datetime.now`, không đọc file, không random; `lexicon` là tham số.
2. Mọi `RiskSignal.source_quote` là chuỗi con nguyên văn của `text` (S-14: từng đoạn tách bởi `" | "`). Test kiểm trên toàn tập câu.
3. 2b chạy trước `_step_2_check_required_data`; blocker an toàn có `resume_step=2`; sau khi người gỡ, pipeline chạy lại từ 2 (P02 §4) và 2b tự bỏ qua (5.2).
4. Mọi pattern lấy từ `self.lexicon`; compile một lần (cache theo tuple pattern bằng `functools.lru_cache` trên `compile_pattern`) — đúng trước, nhanh sau.
5. Chuỗi ghi vào `Blocker.internal_note`/audit được phép chứa `S-xx`; chuỗi cho cư dân chỉ từ `vi.yaml`.

**CẤM**
1. Gọi LLM thật trong 2b khi `safety_llm is None` (mặc định); không tự tạo client từ `settings` trong WP3 (Q09).
2. Hạ mức: không nhánh nào biến `PRESENT` thành `UNCLEAR/ABSENT` ngoài B-04 (chỉ S-01, ngữ cảnh nấu ăn) và T2-01/T2-02 (nghi ngờ/đã hết — áp ngay lúc phán match, không áp sau).
3. Dùng bare `\bkhoi\b`, `\bno\b`, `\bgiat\b`, `\bngat\b` làm pattern (đồng tự: khỏi/nó/giặt/ngắt — đã đo sai).
4. Lọc tín hiệu theo category/scope trong 2b (D12); đọc ảnh (V-06).
5. Sửa `rules.py`, `proposer.py` (V-10); đặt từ vựng trong `.py`.

**Vùng cấm**
| # | Không làm | Lý do |
|---|---|---|
| P1-01 | Không hạ T2-02 chỉ vì có mốc quá khứ ("hôm qua") | "hôm qua có tia lửa" không nói đã hết — bỏ sót Bậc 1 là lỗi nặng nhất (D4) |
| P1-02 | Không đọc B-04 theo nghĩa "khét phải có ngữ cảnh điện" | "mùi khét ở hành lang" phải là Bậc 1 (D3, Q-D) |
| P1-03 | Không mở rộng cửa sổ phủ định qua liên từ ("không có mùi khét hay tia lửa") | tăng phức tạp; sai theo hướng BÁO NHẦM (Bậc 1 giả) chứ không bỏ sót — chấp nhận ở P0, ghi số liệu |
| P1-04 | Không chạy 2b lại khi BPTN đổi category / sau bước 4–8 | nội dung không đổi; chỉ bổ sung cư dân mới làm 2b chạy lại |
| P1-05 | Không ghi tín hiệu "không nhắc tới" là ABSENT | `risk_signals` chỉ chứa bằng chứng văn bản; "không nhắc" không có trích dẫn |

## 8. Phân loại lỗi (riêng P01; bảng chung 00 §7)
| Tình huống | Lớp | Hành vi bắt buộc |
|---|---|---|
| `lexicon.yaml` thiếu khoá/regex hỏng/`signal_id` trùng | `pydantic.ValidationError` lúc `load_lexicon` (engine không khởi tạo) | sửa YAML; không fallback sang từ vựng mặc định trong code |
| LLM lỗi/timeout/trả schema sai | nuốt trong `assess_with_llm`, note `"LLM lỗi (…)"`, `proposer="rules"` | giữ kết quả luật; audit ghi notes |
| LLM trích dẫn bịa | hạ judgement về `UNCLEAR` + note | không bao giờ `EMERGENCY` chỉ từ LLM không có trích dẫn khớp |
| 2b ném exception khác (bug) | lan ra `_mutate` ⇒ không commit, HTTP 500 | fail closed; không bỏ qua bước 2b |

## 9. Số đo nghiệm thu (THẬT)
| # | Lệnh (root repo, venv 3.11, `PYTHONUTF8=1`, `LLM_MODE=mock`) | Kỳ vọng (đã đo bằng REF ngày 2026-10-01) |
|---|---|---|
| S-01 | `python planning/01_2026-10-01_cr03-p0-engine/specs/REF-safety-proto.py planning/01_2026-10-01_cr03-p0-engine/specs/SAFETY-CASES-P0.yaml planning/01_2026-10-01_cr03-p0-engine/specs/LEXICON-P0.yaml \| grep -E "^(TOTAL\|MERGE)"` | `TOTAL=84 BAD=0 TIER1_MISS=0 levels={'EMERGENCY': 22, 'UNCLEAR': 10, 'NONE': 44}` và `MERGE_SELFTEST=5 ok`; exit 0; toàn bộ chạy 314 ms kể cả khởi động Python (đo `date +%s%N`) |
| S-02 | `python -m pytest -q -p no:cacheprovider tests/test_maintenance/test_safety.py` | 0 fail; số ca tham số hoá ≥ 42 (safety_cases) + 34 (regression_strings) |
| S-03 | `python -c "from src.maintenance.engine import MaintenanceEngine as E; e=E(); e.reset(); t=e.get('SIM-TKT-TEC-005').ticket; print(t.status, t.blocker.code, t.risk_level, t.proposed_department_id, [s.signal_id for s in t.risk_signals])"` | `VERIFYING EMERGENCY_PENDING_BQL EMERGENCY None ['S-01', 'S-02']` |
| S-04 | như S-03 với `SIM-TKT-CLN-004` | `VERIFYING EMERGENCY_PENDING_BQL EMERGENCY None ['S-14']` |
| S-05 | `python -c "from src.maintenance.engine import MaintenanceEngine as E; e=E(); e.reset(with_fixtures=False); c=e.receive('Hình như có mùi khét ở hành lang tầng 3 tòa SIM-A.'); print(c.ticket.status, c.ticket.blocker.code, c.ticket.risk_level, c.ticket.blocker.escalate_at - c.events[-1].created_at)"` | `VERIFYING SAFETY_REVIEW_REQUIRED UNCLEAR 4:00:00` |
| S-06 | như S-05 với `'Có mùi khét ở sảnh, không rõ tòa nào'` (thiếu vị trí) | `VERIFYING EMERGENCY_PENDING_BQL EMERGENCY` — Bậc 1 thắng `MISSING_INFO` (Q08) |
| S-07 | `python -m pytest -q -p no:cacheprovider` (toàn bộ) sau WP3 | 0 fail, 0 skip; tổng ≥ 142 + số test mới của WP3 (TESTING §5) |

# SPEC-P10 (PROPOSED) — Kiểm danh mục, không khớp trích dẫn: quote chỉ để hiển thị/audit (Q35)

| Trường | Giá trị |
|---|---|
| Trạng thái | **PROPOSED — CHỜ NGƯỜI DUYỆT.** Hướng đã duyệt (plan Q35, 2026-10-10 08:59:52 +0700); câu chữ hợp đồng này CHƯA duyệt. Trước khi duyệt: code chạy theo P01/P08; KHÔNG thi công [H18](../handoffs/H18_thi-cong_WP19.md) |
| Ngày | 2026-10-10 09:38:51 +0700 (architect 🔴, WP18 / [H17](../handoffs/H17_thi-cong_WP18.md)) |
| Nguồn | Bất biến người dùng Q01/Q29/Q30 + Q35 ([kernel dòng 21](../../../brain4agent/memory-distill.txt)); gotcha "⚠ Kiểm trích dẫn bằng chuỗi con" ([-known-gotchas](../../../brain4agent/-known-gotchas.md)); Q02/Q33 (Agent chỉ nâng; chấp nhận báo nhầm, không bỏ sót) |
| Gói | WP18 (🔴) viết SPEC này + sửa REF · WP19 (🟠, H18) thi công runtime |
| Base đo | `139399ba8fd15c29c33c662e546dbc0e649651cc` (`agent/`, `safety.py` y hệt `4533b15`; HEAD sau đó `00a59bc` chỉ thêm docs H17/plan/today.md — `git diff --stat 139399b 00a59bc` 3 file, không đụng `src/`, `tests/`, `seed/`): pytest 3664 passed / 85 deselected / 0 fail / 0 skip; ruff check 0; ruff format 1 (chỉ `src/main.py`, có từ merge develop) — [evidence/WP18](../evidence/WP18/) |
| File WP19 được ghi | `src/maintenance/agent/schema.py`, `agent/validate.py`, `agent/baseline.py`, `src/maintenance/safety.py` (CHỈ §3.3), `src/maintenance/engine.py` (CHỈ biểu thức §3.5), test ở §9.1–§9.2 |
| CẤM chạm (WP19) | `agent/prompt.py`, `agent/reconcile.py`, `agent/agent.py`, `seed/**` (gồm `lexicon.yaml`), `safety.assess` và mọi luật/regex, `rules.py`, `coordination/**`, `models.py`, `store/**`, `src/api/**`, `src/web/**`, bộ held-out, SPEC/REF/plan |
| REF | [`REF-agent-contract.py`](REF-agent-contract.py) đã sửa ở WP18 (mục A + phần đo): `--selftest` ⇒ `SELFTEST_FAILURES=0`; bản cố tình giữ kiểu quote cũ ⇒ `SELFTEST_FAILURES=4` ([ref-selftest.txt](../evidence/WP18/ref-selftest.txt)) |

Thứ tự đọc: §1 vấn đề (đo) → §2 nguyên tắc + kiểm kê → §3 hợp đồng → §4 lưới sàn giữ → §5 chống bịa vị trí → §6 luật → §7 ngoài phạm vi (câu hỏi) → §8 lỗi → §9 test + nghiệm thu → §10 dữ liệu, triển khai, rollback → §11 mục bị thay thế.

## 1. Vấn đề — đo trên Base bằng client giả (không mạng, không LLM)
Lệnh: `PYTHONPATH='.;<scratch>' LLM_MODE=mock MO_STORE=memory PYTHONUTF8=1 python <scratch>/probe_cases.py [--sim]` — nguồn script trong [probe-scripts.txt](../evidence/WP18/probe-scripts.txt). `--sim` = P10 mô phỏng TRONG BỘ NHỚ (`sim_p10.py`, không ghi file nào của repo). Output: [probe-before.txt](../evidence/WP18/probe-before.txt), [probe-after-sim.txt](../evidence/WP18/probe-after-sim.txt).

| Ca | Câu cư dân · đầu ra Agent (client giả) | Base (đo) | P10 mô phỏng (đo) |
|---|---|---|---|
| T1 | "Chỗ đi bộ trước thang máy tầng 3 tòa S1 có nhiều rác" (luật: S1/3, KHÔNG có khu) · vị trí S1/3/Hành lang, quote "hành lang tầng 3 tòa S1" (không nguyên văn) | `rejected=["location"]` ⇒ NEED_INFO/MISSING_INFO + `AGENT_FALLBACK` | `rejected=[]`, `agent_location="Tòa S1 / Tầng 3 / Hành lang"` ⇒ ROUTED `DEPT_CLEANING`; chỉ G-5 MINOR |
| T2 | như T1 · tòa "S9" | `rejected=["location.building"]`, thiếu `building` ⇒ NEED_INFO | như Base (đối chứng) |
| T3a | như T1 · quote vị trí `null` hoặc `"   "` | `rejected=["location"]` ⇒ NEED_INFO | nhận ⇒ ROUTED |
| T3b | "Hành lang tầng 3 tòa S1 nhiều rác" · quote job `""` hoặc thiếu khoá | `FALLBACK_RULE/SCHEMA_INVALID` (cả quyết định bỏ, luật quyết) | `AGENT`, job hợp lệ, quote `None` ⇒ ROUTED |
| T3c | như T3b · quote job "rác bừa bộn" | `rejected=["jobs[0]"]` ⇒ luật quyết + `AGENT_FALLBACK` | job hợp lệ, không cờ |
| T5 | "Hành lang tầng 3 tòa S1 nhiều rác, nghe tiếng xì xì từ bình gas" (luật NONE) · S-10 PRESENT, quote "bình gas bị xì" | S-10 hạ UNCLEAR ⇒ `SAFETY_REVIEW_REQUIRED` (mất Bậc 1) | S-10 PRESENT ⇒ `EMERGENCY_PENDING_BQL`, 1 `emergency.created` |
| T5b | như T5 · quote `null` | tín hiệu bị bỏ; chỉ còn S-00 UNCLEAR `LLM-UNGROUNDED` | S-10 PRESENT `rule_id="LLM-NOQUOTE"` ⇒ EMERGENCY |
| T4 | Mirror trên câu T1 | quote job = quote vị trí = cả câu (quote giả) | `None` |
| T5c, T6 | quote nguyên văn; luật EMERGENCY + Agent ABSENT | EMERGENCY | như Base (đối chứng) |

Kết luận: câu chữ của quote đang quyết định CHẤP NHẬN / LOẠI / HẠ đầu ra LLM ở 6 chỗ (§2) — trái bất biến dòng 21.

## 2. Nguyên tắc: việc của LLM hay của luật — và kiểm kê
- **Cổng chặn LLM** = chỗ code đọc câu chữ (chuỗi con/khoảng ký tự của quote, hoặc từ khoá/regex trên câu cư dân) rồi dùng kết quả để loại, hạ, hoặc giữ lại không tự áp một quyết định của LLM. **Lưới sàn luật hợp lệ** = luật chỉ NÂNG mức hoặc THÊM người xem, không loại/hạ đầu ra LLM. **Chỉ audit** = ghi/hiển thị, không đổi luồng.
- Kiểm kê [inventory.txt](../evidence/WP18/inventory.txt) (lệnh + output + một dòng mỗi chỗ): **28 chỗ = 9 cổng chặn LLM** (C1–C6 khớp quote — P10 đổi; C7–C9 khớp từ khoá luật — §7 giữ, cần người quyết) **+ 6 lưới sàn** (F1–F6, §4) **+ 13 chỉ audit** (A1–A13). Thêm S1–S3 (SPEC chưa thi công cùng loại) và K1–K6 (kiểm danh mục, giữ).

| Quyết định | Ai quyết | Code chỉ kiểm (danh mục đóng / ứng viên / enum) | Quote |
|---|---|---|---|
| Vị trí | LLM | tòa ∈ `catalog.site.buildings` (+ tòa con `.NN`); tầng khớp `B?\d{1,2}\|TRET` rồi `rules._floor_label`; khu ∈ nhãn `rules.AREA_PATTERNS`; `IMPLIED_FLOOR`; khoá BPTN thắng | audit |
| Loại việc (job) | LLM | `category` ∈ {VE_SINH, KY_THUAT} (schema); khoá/ghim của người thắng | audit |
| Tín hiệu an toàn | LLM nâng, luật sàn | `signal_id` ∈ từ vựng đang bật; status PRESENT/UNCLEAR; ABSENT bỏ; mức cuối = max(luật, Agent, đang có) | audit |
| Phòng ban, ưu tiên, trùng, tài sản, vật tư | LLM chọn | như P01 §3.2 các dòng tương ứng (bảng playbook, bảng PRI, ứng viên, asset duy nhất, `playbook_materials`) | — |
| next_step / hỏi | LLM | engine theo vị trí thực (G-9), khoá loại việc | — |

## 3. Hợp đồng (WP19 thi công đúng từng dòng)

### 3.1 Schema — REF mục A (đã sửa), chép NGUYÊN VĂN sang `src/maintenance/agent/schema.py`
```python
from pydantic import AwareDatetime, BaseModel, BeforeValidator, ConfigDict, Field, StringConstraints, model_validator

def _audit_quote(value: object) -> object:            # docstring chép nguyên văn REF
    if isinstance(value, str):
        return value.strip()[:300] or None
    return value

AuditQuote = Annotated[Annotated[str, StringConstraints(max_length=300)] | None, BeforeValidator(_audit_quote)]
# XOÁ: Quote = Annotated[str, StringConstraints(min_length=2, max_length=300)]
SignalJudgement.quote: AuditQuote = None
LocationDecision.quote: AuditQuote = None
JobDecision.quote: AuditQuote = None                 # trước: Quote (BẮT BUỘC)
```
`schema_version` giữ `"agent-decision/1"`, `record_version` giữ `"agent-record/1"` (schema chỉ NỚI: mọi quyết định cũ vẫn hợp lệ). Đo ([proto-audit-quote.txt](../evidence/WP18/proto-audit-quote.txt), pydantic 2.13.5):

| Đầu vào `quote` | Giá trị lưu |
|---|---|
| `null` / không có khoá | `None` |
| `""`, `"   "` | `None` |
| `"  nhiều rác  "` | `"nhiều rác"` |
| `".."` | `".."` (chỉ audit) |
| > 300 ký tự | 300 ký tự đầu (sau strip) |
| không phải chuỗi (`5`, `[]`, `{}`) | `ValidationError` ⇒ `SCHEMA_INVALID` (lỗi kiểu của JSON, không phải khớp chữ — giữ P01 §5) |
JSON schema của `quote`: `anyOf[string maxLength 300, null], default null`; `JobDecision.required` bỏ `quote` (đo [ref-selftest.txt](../evidence/WP18/ref-selftest.txt)).

### 3.2 `src/maintenance/agent/validate.py` — vị trí và job chỉ kiểm danh mục
```python
# XOÁ: def _fold(text: str) -> str  và  def grounded(quote: str | None, text: str) -> bool   (không còn caller)
def _check_location(loc: LocationDecision, catalog: Catalog) -> tuple[str | None, tuple[str, ...], list[str]]:
    """(complete location or None, missing parts, rejected paths). Catalog only (plan 06 Q35): `loc.quote` is not read."""
    # thân = thân hiện tại BỎ dòng 99–101 (has_parts … grounded … return None, (…), ["location"]);
    # khối building / floor / area / IMPLIED_FLOOR (dòng 102–136) giữ nguyên từng ký tự
def validate(decision: AgentDecision, data: DecisionInput, rv: RuleView, catalog: Catalog, lexicon: Lexicon,
             model: str) -> Validated                                            # chữ ký + kiểu `Validated` giữ
    # dòng 147: _check_location(decision.location, catalog)
    # XOÁ dòng 158–160: mọi job không bị khoá/ghim loại (dòng 156–157) đều vào valid_job_indexes
def merge_agent_safety(rule: safety.SafetyAssessment, decision: AgentDecision, safety_text: str, lexicon: Lexicon,
                       model: str) -> tuple[safety.SafetyAssessment, RiskLevel]
    # chữ ký + thân giữ; `_first_sentence` (XOÁ khỏi file) thay bằng `safety.first_sentence`;
    # docstring bỏ vế "a bad quote is UNCLEAR"
```
Đường dẫn `rejected` mà `validate` sinh sau P10 (tập ĐÓNG): `location.building`, `location.floor`, `location.area`, `jobs[i].department_id`, `jobs[i].priority`, `jobs[i].duplicate_of`, `jobs[i].asset_id`, `jobs[i].materials`, `ask_fields`. KHÔNG còn sinh `location` hay `jobs[i]`; code đọc chúng (`engine._activate` dòng 2977–2988, `reconcile._field_of`) GIỮ để đọc record cũ.

### 3.3 `src/maintenance/safety.py` — LLM chỉ nâng, hợp lệ theo danh mục
```python
def first_sentence(text: str, limit: int = 120) -> str: ...    # chép nguyên thân validate._first_sentence
def merge_llm(rule: SafetyAssessment, llm_result: LLMSafetyAssessment, text: str, lexicon: SafetyLexicon,
              *, model_label: str = "llm") -> SafetyAssessment                    # chữ ký giữ
# XOÁ: def _grounded(quote: str | None, text: str) -> bool
```
Mỗi `judgement`, theo thứ tự:
1. `signal_id` ∉ từ vựng đang bật ⇒ note `"{sid}: LLM nêu tín hiệu ngoài từ vựng P0; bỏ qua"` (giữ).
2. `ABSENT` ⇒ note `"{sid}: LLM ABSENT không bao giờ hạ mức luật; bỏ qua"` (giữ).
3. `quote = (judgement.quote or "").strip()[:300]`; rỗng ⇒ note `f"{sid}: LLM {status} không kèm trích dẫn; vẫn tính (trích dẫn chỉ để audit)"`.
4. KHÔNG so `quote` với `text`; `status` giữ nguyên PRESENT/UNCLEAR.
5. `SEVERITY[status] > best_rule` ⇒ thêm `RiskSignal(signal_id=sid, status=status, source_quote=quote or first_sentence(text) or "(trống)", detected_by=DetectedBy.LLM, rule_id="LLM" if quote else "LLM-NOQUOTE")`; ngược lại note `"…không cao hơn luật; giữ luật"` (giữ).
6. `_dedupe_signals`, `derive_risk_level`, `proposer=f"rules+llm:{model_label}"` giữ.

`SignalJudgement.quote` (lớp của `safety.py`) đổi mô tả thành `"Excerpt of the report for display/audit; never compared with the text (plan 06 Q35)"`. Áp cho cả hai đường gọi: Agent (`validate.merge_agent_safety` → `reconcile.safety_for`) và LLM an toàn plan 01 (`assess_with_llm`, `safety_llm`; `build_engine` không bật). `source_quote` khi thiếu quote = câu đầu của văn bản an toàn (CR §6.1.3 "đoạn trích bắt buộc"), đánh dấu `LLM-NOQUOTE` để người xem biết Agent không trích; `"(trống)"` chỉ xảy ra khi `text` rỗng — không có đường engine nào gọi như vậy (`_step_2b`, `_addition_raises_safety`, `merge_agent_safety` đều thoát sớm khi rỗng).

### 3.4 `src/maintenance/agent/baseline.py` — Mirror không sinh quote
```python
def _mirror_job(category: ServiceCategory, data: DecisionInput, rv: RuleView, catalog: Catalog,
                lexicon: Lexicon) -> JobDecision                 # bỏ tham số `quote`; JobDecision(quote=None, …)
def mirror_decision(data: DecisionInput, catalog: Catalog, lexicon: Lexicon) -> AgentDecision   # chữ ký giữ
```
- XOÁ dòng 149; dòng 150 ⇒ `categories = _mirror_categories(data, rv, catalog) if data.report_text.strip() else []`.
- XOÁ dòng 183–185 (và chú thích "SPEC-P08 §2…"); `LocationDecision(building=…, floor=…, area=…, quote=None, reason="Vị trí theo luật cố định")`.
- Tín hiệu: `SchemaSignal(signal_id=s.signal_id, status=s.status.value, quote=s.source_quote)` với `s.status ∈ {PRESENT, UNCLEAR}` — bỏ điều kiện `len(s.source_quote) >= 2`; giữ `[:10]`. Quote tín hiệu là trích đoạn THẬT luật tìm được (không phải quote giả).

### 3.5 Hiển thị quote rỗng
- `engine.py:3420` ⇒ `reason = "Agent thấy hai việc: " + "; ".join(f"{j.category} ({j.quote})" if j.quote else j.category for j in jobs)` (không đổi gì khác trong `engine.py`). Lý do đo: thiếu sửa này ghi chú thành `"VE_SINH (None); KY_THUAT (None)"` ([mirror-note-sim.txt](../evidence/WP18/mirror-note-sim.txt)).
- `engine.py:3017` (`"quote": j.quote` trong audit) giữ — `None` hợp lệ. Không có consumer nào khác (đo `grep -rn quote src/web src/api` ⇒ 0 dòng).

### 3.6 REF (WP18 đã sửa — WP19 KHÔNG sửa)
Mục A như §3.1. `grounded` đổi thành `verbatim_in` — CHỈ là số đo audit cho `--live` (`QUOTE_NOT_VERBATIM`); `classify_reply` trả `(kind, decision, đường dẫn quote thiếu/không nguyên văn)`, `kind` không phụ thuộc quote; `--selftest` thêm 5 ca của §3.1. Lệnh: `PYTHONPATH=. PYTHONUTF8=1 python planning/06_2026-10-05_reasoning-agent/specs/REF-agent-contract.py --selftest` ⇒ `SELFTEST_FAILURES=0`. Test đang dùng REF (`test_agent_prompt.py`, `test_p1_contracts.py`) trên runtime Base: 38 passed.

### 3.7 Không đổi
Kiểm danh mục/ứng viên P01 §3.2 (phòng ban, ưu tiên, trùng, tài sản, vật tư, khoá/ghim) · `ask_fields` (A4: chỉ sinh ghi chú G-8, engine không đọc) · bảng G-1…G-9 (`reconcile.py`; xem §4 G-3, §7 G-1/G-2) · `engine._activate` cờ `AGENT_FALLBACK` (đọc `location`/`jobs[i]` của record cũ) · `_job_view` (I-20; sau P10 chỉ còn kích bởi khoá/ghim loại việc) · `prompt.py` (vẫn đòi trích nguyên văn — tốt cho audit; đổi chữ cần WP11 + eval live, P01 §4.4).

## 4. Lưới sàn luật an toàn — GIỮ; vì sao không phải cổng chặn LLM
| Lưới sàn | Chỗ | Vì sao giữ |
|---|---|---|
| Luật + `lexicon.yaml` (Bậc 1/Bậc 2) | `safety.assess`; `baseline.py:51–54` | đặt mức TỐI THIỂU; mức cuối = max(luật, Agent, đang có) (`engine.py:3187`, I-17); không loại/hạ tín hiệu Agent nào (Q02/Q30) |
| Luật EMERGENCY ⇒ không gọi Agent | `agent.py:95–96, 104–107` | Bậc 1 là trần, Agent không được hạ (Q02) ⇒ không có đầu ra LLM nào bị bỏ (P08 §4 lý do kiến trúc) |
| ABSENT bị bỏ; không cao hơn luật ⇒ giữ luật | `safety.py:953–955, 962–968` | chiều hạ — cấm (Q02) |
| G-3 điện | `reconcile.py:91–103` | chỉ THÊM người xem khi luật thấy nước/dây điện ở thiết bị điện mà an toàn cuối NONE; job/vị trí Agent giữ nguyên |
| S-00 `LLM-UNGROUNDED` | `validate.py:77–88` | Agent tự khai EMERGENCY mà không có tín hiệu danh mục nào ⇒ ít nhất UNCLEAR (V-11, Q24(3)) — kiểm cấu trúc, không khớp chữ; sau P10 không còn bị lỗi quote kích hoạt |
Luật sàn là khớp từ khoá nhưng được phép vì chỉ NÂNG (kernel dòng 22 "lưới SÀN HẸP"); nới/siết từ vựng là việc khác, CẤM trong WP19.

## 5. Chống bịa vị trí KHÔNG bằng câu chữ — công cụ, rủi ro còn lại, ai chịu
Công cụ được dùng (và chỉ những cái này):
1. **Danh mục** (§2): giá trị ngoài danh mục ⇒ phần đó thiếu ⇒ engine hỏi đúng phần (T2).
2. **Khoá người**: `locks.location` (BPTN) > Agent > luật (`validate.py:149`, `engine.effective_location`).
3. **Agent tự báo thiếu**: phần `null` ⇒ `agent_missing_parts` ⇒ `MISSING_INFO` hỏi cư dân (P02 §6.2) hoặc `TO_BPTN`; Agent không chắc ⇒ `needs_review=true` ⇒ `PENDING_REVIEW` (prompt bước 10).
4. **Audit**: `case.agent_decision` (quote, `agent_location`, `rule_location`, bất đồng G-5/G-2), audit `AGENT_DECISION`, `ai_logger` (raw output).

Rủi ro còn lại — đo bằng probe WP12 `extra_invented_location.py` (client giả LUÔN bịa nơi; [invented-location.txt](../evidence/WP18/invented-location.txt)): Base **1/4** phản ánh có ticket ROUTED tới nơi bịa (lỗ đã biết: quote "Hành lang" đúng chữ, tòa/tầng bịa); P10 mô phỏng **3/5** ticket ROUTED tới nơi bịa, 2 dừng PENDING_REVIEW nhờ G-1. Tần suất mô hình THẬT bịa vị trí: **NOT_RUN** (cần eval vị trí live — G-LIVE-3, phụ thuộc WP0/WP11; `scripts/agent_live_eval.py` hiện chỉ chấm mức an toàn).
Ai chịu: **BPTN** — xem lại qua audit/AI log khi phòng ban hoặc cư dân báo sai chỗ, xử lý bằng thao tác có sẵn; P10 KHÔNG thêm cơ chế, KHÔNG thêm từ điển câu cư dân. Ngưỡng chấp nhận: người quyết (Q-P10-2).

## 6. Luật
**BẮT BUỘC**
1. Hợp lệ của đầu ra LLM chỉ xét theo danh mục đóng / ứng viên engine đưa / enum của schema (§2, §3.2); quote lưu nguyên trạng sau `_audit_quote` vào record và audit.
2. Tín hiệu an toàn của Agent có `signal_id` đang bật và status PRESENT/UNCLEAR được tính ĐÚNG mức (PRESENT Bậc 1 ⇒ EMERGENCY) bất kể quote; mức cuối = max(luật, Agent, đang có).
3. Mirror/luật không sinh quote: job và vị trí `quote=None`; tín hiệu Mirror chỉ mang `source_quote` thật của luật.
4. Mọi chỗ hiển thị quote xử lý `None` (§3.5).
5. Schema: REF mục A sửa trước, code chép nguyên văn; test so JSON schema runtime với REF (T-P10-07).
6. Test cơ chế dùng client giả đưa điều luật KHÔNG thấy (câu luật ra NONE / luật không đọc đủ vị trí); `MirrorClient` không chứng minh nhánh Agent (gotcha `SeesDanger`).
7. Năng lực live chỉ báo bằng số đo thật; chưa chạy ⇒ `NOT_RUN`.

**CẤM**
1. So quote với văn bản cư dân (chuỗi con, khoảng ký tự, giao span, "đủ thành phần", độ giống mờ/ngưỡng, embedding) để loại, hạ hoặc giữ lại đầu ra LLM — ở bất kỳ file nào dưới `src/`.
2. Tái tạo `grounded`/`_grounded`/`_fold` dưới tên khác; import `REF.verbatim_in` vào runtime.
3. Thêm từ điển/regex câu cư dân (vd "chỗ đi bộ" → Hành lang) để xác minh hay thay vị trí/việc của Agent.
4. Bịa quote (chép `report_text`, `location_text` hay câu khác làm quote) ở Mirror, luật, client giả, helper test để "qua cổng".
5. Thêm cờ cấu hình bật lại cổng quote "để rollback" (giữ hai luật trái nhau).
6. Đổi `agent/prompt.py`, `lexicon.yaml`, `safety.assess`, ngưỡng/nhãn TESTING §6, bộ held-out trong WP19.
7. Đổi G-1/G-2/G-3, `_after_rules`, `proposer.py`, F8 trong WP19 (§7).
8. Đổi tên `rule_id` đã lưu (`LLM`, `LLM-UNGROUNDED`).

**Vùng cấm** (đã cân nhắc, quyết KHÔNG làm)
| Không làm | Lý do |
|---|---|
| Giữ `grounded` làm cờ cảnh báo / điểm tin cậy trong record | cờ máy tính từ khớp chữ sẽ bị dùng lại làm cổng (đúng lỗi Q35, gotcha); người xem đã có quote cạnh văn bản |
| Hạ tín hiệu có quote không nguyên văn xuống UNCLEAR "cho chắc" | làm mất một lần NÂNG của Agent (Q02/Q35); báo nhầm đã được chấp nhận (Q33) |
| Coi G-5 (Agent điền vị trí mà luật không đọc được) là SERIOUS để chặn bịa | G-5 dựa regex câu cư dân ⇒ khớp từ khoá; ca T1 (diễn đạt khác) lại bị giữ — trái mục tiêu Q35 |
| Thêm schema P09 (`LocationEvidence`, `SplitAnalysis`), vòng tool | Q35 không cần; P09 ngoài B1/B2 giữ PROPOSED |
| Nâng S-00 `LLM-UNGROUNDED` lên EMERGENCY | V-11/Q24(3): không tin mức tự khai khi không có tín hiệu danh mục; không phải khớp chữ — ngoài Q35 |
| Ép quote ≥ 2 ký tự, hoặc chép `reason` vào quote khi thiếu, để code cũ đọc được | là bịa quote / cổng trá hình; tương thích xử lý ở §10 |
| Thêm marker revision `0003` trong WP19 | chỉ cần khi triển khai DB chung; quyết ở Q-P10-5 trước G-SRV |

## 7. Ngoài phạm vi Q35 — giữ nguyên trong P10, cần người quyết
| Chỗ | Đang làm | Vì sao chạm dòng 21 | Vì sao P10 không đổi | Câu hỏi |
|---|---|---|---|---|
| C7 G-1 `reconcile.py:62–76` | loại việc Agent ∉ `rules.category_evidence` ⇒ PENDING_REVIEW | từ khoá luật quyết Agent có được tự áp | Q06 (người dùng chốt bảng G) + Q29 "chưa duyệt thay bảng G"; P09 §4.1 PROPOSED | Q-P10-1 |
| C8 G-2 `reconcile.py:78–89` | `extract_location` đủ và khác vị trí Agent ⇒ PENDING_REVIEW | như trên; sau P10 bắn đều cho MỌI câu chữ quote ([g2-probe.txt](../evidence/WP18/g2-probe.txt): quote diễn đạt khác — Base ROUTED theo luật, P10 PENDING_REVIEW, như quote nguyên văn ở Base) | như trên | Q-P10-1 |
| C9 `proposer.py:116–129` (chỉ khi `MO_AGENT_ENABLED=false` + `LLM_MODE=openai`) | `rules.classify` phủ quyết playbook LLM | từ khoá luật | đường rollback tắt Agent có chủ đích (Q01 "Tắt bằng `MO_AGENT_ENABLED=false`") | — |
| S1 SPEC-P08 §6 F8 (WP15/H14 chưa thi công) | `rules.location_mentions` > 1 nơi ⇒ không tách, cả đường Agent | từ khoá luật chặn quyết định tách của LLM | SPEC đã duyệt, không phải quote | Q-P10-3 |
| S2 SPEC-P09 §4.1 + §8 CẤM 1 | nhận phân loại Agent khi "job.quote grounded" | khớp quote | P09 ngoài B1/B2 PROPOSED (H17 cấm đụng) | Q-P10-4 |

- **Q-P10-1:** G-1/G-2 (từ khoá luật ⇒ PENDING_REVIEW) giữ theo Q06, hay hạ MINOR theo "code chỉ kiểm danh mục" của Q35? Mặc định P10: giữ.
- **Q-P10-2:** Rủi ro Agent bịa vị trí hợp lệ danh mục: chấp nhận với BPTN xem lại (mặc định), hay đòi ngưỡng đo live (cần thêm công cụ đo vị trí) trước khi bật trên DB chung?
- **Q-P10-3:** Trước khi phóng H14: F8 chỉ áp đường luật (không chặn quyết định tách của Agent)?
- **Q-P10-4:** Khi duyệt P09: bỏ điều kiện "job.quote grounded" ở §4.1 và §8 CẤM 1.
- **Q-P10-5:** DB chung: chỉ thủ tục OPERATIONS §5 (dừng backend cũ trước), hay thêm marker revision `0003` để code trước P10 từ chối khởi động (theo V-10/Q13)? Mặc định: quyết trước G-SRV, không thuộc WP19.

## 8. Phân loại lỗi + hành vi bắt buộc của caller
| Tình huống | Nơi | Hành vi bắt buộc |
|---|---|---|
| quote `null` / `""` / khoảng trắng / thiếu khoá | schema | nhận; lưu `None`; KHÔNG `rejected`, KHÔNG fallback |
| quote > 300 ký tự | schema | cắt 300; nhận |
| quote không phải chuỗi/null | schema | `SCHEMA_INVALID` ⇒ `FALLBACK_RULE` + `AGENT_FALLBACK` (P01 §5, giữ) |
| quote không có trong văn bản | — | không kiểm; nhận; quote vào audit |
| tòa ngoài catalog / tầng sai dạng / khu ngoài nhãn | `validate._check_location` | phần đó `None`; `location.<phần>` vào `rejected`; G-8 MINOR; engine hỏi đúng phần thiếu |
| `signal_id` ngoài từ vựng đang bật | `safety.merge_llm` | bỏ + note (giữ) |
| tín hiệu ABSENT | `safety.merge_llm` | bỏ + note (Agent không hạ) |
| tín hiệu PRESENT/UNCLEAR không quote | `safety.merge_llm` | tính đủ mức; `rule_id="LLM-NOQUOTE"`; `source_quote` = câu đầu văn bản an toàn; note |
| Agent tự khai EMERGENCY, không tín hiệu danh mục | `validate.merge_agent_safety` | S-00 UNCLEAR `LLM-UNGROUNDED` (giữ) |
| record cũ có `rejected` chứa `location`/`jobs[i]` | `engine._activate`, `DecisionView` | đọc như cũ; không ghi lại |
| record cũ áp lại qua `reconcile.safety_for` (resume, bổ sung) | `safety.merge_llm` | tính lại theo P10 ⇒ mức có thể NÂNG, không bao giờ hạ (max) — chấp nhận (Q02) |
| code trước P10 đọc doc P10 có quote `null` | `models.Case` (code cũ) | `ValidationError` (đo, §10) — CẤM chạy lẫn hai bản trên một DB |
| lỗi lập trình (TypeError, KeyError) | bất kỳ | ném (không nuốt) |

## 9. Test và nghiệm thu
### 9.1 Test cũ đang ghim cổng quote — hành vi mới (đổi khẳng định / thay 1–1; số test không giảm)
Mô phỏng P10 trong bộ nhớ trên toàn suite: **19 failed / 3645 passed / 85 deselected** — đúng các dòng có dấu ★ ([sim-pytest.txt](../evidence/WP18/sim-pytest.txt)); dòng ☆ chỉ đỏ khi xoá `grounded`/đổi chữ ký (mô phỏng giữ hàm nên không thấy).

| File::test | Đang ghim | Mới |
|---|---|---|
| ☆ `test_agent_unit.py` dòng 33 | `from …validate import grounded` | xoá import |
| ★ `test_agent_unit.py::test_a_04_an_ungrounded_safety_quote_is_at_most_unclear` | S-02 PRESENT quote bịa ⇒ UNCLEAR | tên `test_a_04_an_agent_raise_keeps_its_level_whatever_its_quote`: tín hiệu LLM `[("S-02","PRESENT")]`, merged EMERGENCY, `agent_risk_level` EMERGENCY |
| ☆ `test_agent_unit.py::test_a_06c_emergency_claim_without_any_valid_signal_adds_s00_unclear` | `assert grounded(s00.source_quote, …)` | xoá đúng dòng đó |
| ★ `test_agent_unit.py::test_a_08_a_job_with_an_ungrounded_quote_is_dropped` | `jobs[1]` bị loại | tên `test_a_08_a_job_quote_not_in_the_text_is_kept_for_audit`: `rejected == []`, `valid_job_indexes == [0, 1]`, `decision.jobs[1].quote == "bóng đèn nổ tung"`, `"category" not in minor(record)` |
| ★ `test_agent_unit.py::test_a_08b_all_jobs_dropped_while_in_scope_leaves_no_valid_job` | cả hai job bị loại | tên `test_a_08b_no_job_is_dropped_for_its_quote`: `valid_job_indexes == [0, 1]`, không `jobs[i]` trong `rejected` |
| ★ `test_agent_unit.py::test_a_09b_location_parts_are_normalised_and_checked` | 3 dòng cuối: quote "tầng 9 tòa S3" ⇒ loại vị trí | 3 dòng cuối: `agent_location == LOC`, `rejected == []` (phần còn lại giữ) |
| ☆ `test_p1_audit_fixes_safety.py` dòng 4, 12 | docstring F3; import `grounded` | docstring "F3 thay bởi SPEC-P10"; import chỉ `_check_location` |
| ★ `test_p1_audit_fixes_safety.py::test_f3_location_without_quote_is_rejected` (12 tham số) | quote None/".."/"--"/"! " ⇒ loại cả vị trí | thay `test_p10_location_is_kept_whatever_its_quote` cùng 12 tham số: `_check_location(loc, CATALOG)` ⇒ đủ 3 phần `("Tòa S1 / Tầng 1 / Hành lang", (), [])`; chỉ tòa `(None, ("floor", "area"), [])`; chỉ khu `(None, ("building", "floor"), [])` (đo bằng mô phỏng) |
| ★ `test_p1_audit_fixes_safety.py::test_f3_punctuation_quote_does_not_ground_an_invented_place` | quote ".." + S2/7 ⇒ loại, NEED_INFO | thay `test_p10_an_invented_place_in_the_catalog_is_kept_and_audited`: `rejected == []`, `agent_location == "Tòa S2 / Tầng 7 / Hành lang"`, `decision.location.quote == ".."` (rủi ro §5, có chủ đích) |
| ☆ `test_p1_audit_fixes_safety.py::test_f3_no_location_and_no_quote_is_not_a_rejection` | chữ ký 3 tham số | `_check_location(loc, CATALOG)[2] == []` |
| ☆ `test_p1_audit_fixes_safety.py::test_f3_mirror_quotes_the_location_it_read` | quote vị trí Mirror grounded | thay `test_p10_mirror_location_has_no_quote_and_is_kept`: `decision.location.quote is None`, `"location" not in rejected`, `agent_location == "Tòa S1 / Tầng 3 / Hành lang"` |
| ★ `test_safety.py::test_llm_present_needs_grounded_quote` | quote bịa ⇒ UNCLEAR; không quote ⇒ NONE | tên `test_llm_present_counts_whatever_its_quote`: quote có thật ⇒ EMERGENCY (giữ); "có khói đen" ⇒ EMERGENCY, `rule_id == "LLM"`; không quote ⇒ EMERGENCY, `rule_id == "LLM-NOQUOTE"`, `source_quote == first_sentence(TEXT_NONE)` |
| ★ `test_safety.py::test_engine_with_safety_llm_never_lowers` | `inventing` ⇒ UNCLEAR / `SAFETY_REVIEW_REQUIRED` | nửa đầu (ABSENT không hạ) giữ; nửa sau ⇒ `risk_level == EMERGENCY`, blocker `EMERGENCY_PENDING_BQL`; docstring bỏ "cannot raise past tier 2 on a fake quote" |
Đột biến cũ hết hiệu lực (hành vi đột biến = hành vi mới): P01 §11 (a)(b); `evidence/WP14-v2/mutation-b-f3-unquoted-passes.txt`, `mutation-e-mirror-no-quote.txt`, `mutation-f-punct-quote-grounded.txt`. Thay bằng §9.3.

### 9.2 Test mới bắt buộc — `tests/test_maintenance/test_p10_catalog_not_quote.py`
Dùng `agent_engine(Clock(MONDAY_9AM), client)` với client giả trả JSON cố định (mẫu `probe_cases.py`), `prompt.EXAMPLE` làm khung; KHÔNG dùng `MirrorClient` cho nhánh Agent. Bảng dưới đã chạy thử bằng bản nháp ngoài repo ([proto-tests.txt](../evidence/WP18/proto-tests.txt)): Base 15 đỏ / 3 xanh đúng cột "Trên Base"; P10 mô phỏng 16 xanh / 2 đỏ (T-P10-06, -08 — mô phỏng không xoá hàm, không sửa §3.5).

| ID — tên hàm | Ca | Kỳ vọng sau WP19 | Trên Base |
|---|---|---|---|
| T-P10-01 `test_p10_01_location_worded_differently_but_in_the_catalog_is_kept` | T1 | `rejected == []`; `agent_location == "Tòa S1 / Tầng 3 / Hành lang"`; bất đồng `[("location","MINOR")]`; `AGENT_FALLBACK` ∉ cờ; `ROUTED`, `DEPT_CLEANING` | ĐỎ |
| T-P10-02 `test_p10_02_a_value_outside_the_catalog_is_rejected_on_its_own_field` (3 tham số) | tòa "S9" (qua engine, câu T1); tầng "tầng cao"; khu "Ban công" (record) | tòa: `rejected == ["location.building"]`, `agent_missing_parts == ["building"]`, NEED_INFO/MISSING_INFO, `blocker.internal_note == "Thiếu: location_building"` (đo); tầng: `["location.floor"]`/`["floor"]`; khu: `["location.area"]`/`["area"]` | xanh (đối chứng) |
| T-P10-03 `test_p10_03_a_blank_or_missing_quote_is_still_accepted` (6 tham số) | quote vị trí `None`/`""`/`"   "` (câu T1); quote job `None`/`""`/thiếu khoá (câu T3b) | vị trí: `rejected == []`, `agent_location` đủ, ROUTED; job: `source == "AGENT"`, `valid_job_indexes == [0]`, `decision.jobs[0].quote is None`, ROUTED, không `AGENT_FALLBACK` | ĐỎ cả 6 |
| T-P10-04 `test_p10_04_mirror_writes_no_quote_of_its_own` (3 tham số) | `mirror_decision` trên câu T1, `CLEANING`, "Hình như có mùi khét ở hành lang tầng 3 tòa S1" | mọi `jobs[i].quote is None`, `location.quote is None`; tập `(signal_id, quote)` = tập `(signal_id, source_quote.strip()[:300])` của `rule_view(...).safety.signals` PRESENT/UNCLEAR | ĐỎ |
| T-P10-05 `test_p10_05_an_agent_raise_is_kept_whatever_its_quote` (2 tham số: "bình gas bị xì", `None`) | T5/T5b; khẳng định trước `rule_view(...).safety.risk_level == NONE` | VERIFYING/`EMERGENCY_PENDING_BQL`, `risk_level == EMERGENCY`, đúng 1 `emergency.created`; tín hiệu `("S-10","PRESENT","LLM","bình gas bị xì")` / `("S-10","PRESENT","LLM-NOQUOTE", <cả câu T5>)` | ĐỎ cả 2 |
| T-P10-06 `test_p10_06_no_text_matching_helper_is_left` | — | `not hasattr(validate, "grounded")`, `not hasattr(validate, "_fold")`, `not hasattr(safety, "_grounded")` | ĐỎ |
| T-P10-07 `test_p10_07_runtime_schema_is_the_reference_schema` | nạp REF như `test_p1_contracts._load_ref` | `schema.AgentDecision.model_json_schema() == REF.AgentDecision.model_json_schema()` | ĐỎ (đo: `False`) |
| T-P10-08 `test_p10_08_a_missing_job_quote_is_not_shown_as_none` | `MirrorClient`, `engine._try_split = lambda work, now: False`, câu `prompt.EXAMPLE_REPORT` (mẫu A-27) | ghi chú blocker chứa `"Agent thấy hai việc: VE_SINH; KY_THUAT"` và không chứa `"None"` | ĐỎ (đo: Base ghi `"VE_SINH (Hành lang tầng 3 …); KY_THUAT (…)"` vì Mirror còn quote giả); sau WP19 chỉ m7 làm đỏ lại |

### 9.3 Đột biến (mỗi cái áp riêng lên cây đã sửa, chạy test nêu tên ⇒ EXIT≠0, rồi khôi phục)
| # | Đột biến | Test phải đỏ |
|---|---|---|
| m1 | trong `validate()`: `if decision.location.quote and decision.location.quote not in data.location_text:` ⇒ `agent_location, missing = None, ("building","floor","area")`, `rejected.append("location")` | T-P10-01 |
| m2 | trong vòng job: `if job.quote and job.quote not in data.report_text: rejected.append(f"jobs[{index}]"); continue` | `test_a_08_a_job_quote_not_in_the_text_is_kept_for_audit` |
| m3 | `merge_llm`: `if quote and quote not in text: status = SignalStatus.UNCLEAR` | T-P10-05[quote], `test_llm_present_counts_whatever_its_quote` |
| m4 | `merge_llm`: `if not quote: continue` | T-P10-05[None] |
| m5 | Mirror: `_mirror_job(…)` đặt `quote=data.report_text.strip()[:300]` | T-P10-04 |
| m6 | `schema.py`: `JobDecision.quote: Annotated[str, StringConstraints(min_length=2, max_length=300)]` | T-P10-03[job…], T-P10-07 |
| m7 | `engine.py:3420` về biểu thức cũ | T-P10-08 |

### 9.4 Số đo nghiệm thu (WP19 nộp output máy; người duyệt chạy lại)
| # | Lệnh (env `LLM_MODE=mock MO_STORE=memory MO_PHOTO_STORE=local PYTHONUTF8=1 PYTHONPATH=.`) | Kỳ vọng |
|---|---|---|
| 1 | `python -m pytest -q -p no:cacheprovider tests/test_maintenance/test_p10_catalog_not_quote.py` trên code CHƯA sửa | 15 đỏ đúng T-P10-01, -03 (6), -04 (3), -05 (2), -06, -07, -08; 3 xanh T-P10-02 (3) |
| 2 | như #1 + `test_agent_unit.py test_p1_audit_fixes_safety.py test_safety.py` sau sửa | `EXIT=0` |
| 3 | `python -m pytest -q -p no:cacheprovider` | `EXIT=0`; passed ≥ 3664 + số test mới; 0 failed; 0 skipped; 85 deselected |
| 4 | `python -m ruff check src tests` | `EXIT=0` |
| 5 | `python -m ruff format --check <các file .py WP19 chạm>` | `EXIT=0` (toàn repo Base đã `EXIT=1` vì `src/main.py` — ngoài phạm vi, không sửa) |
| 6 | `grep -rnw -e grounded -e _grounded src/maintenance --include=*.py \| wc -l` | `0` (Base: `6`) |
| 7 | `python -m pytest -q -p no:cacheprovider tests/test_maintenance/test_safety_metamorphic.py tests/test_maintenance/test_classify_metamorphic.py` + `pytest -q tests/test_maintenance/test_safety.py -k "stop_set or false_alarm_budget"` | `EXIT=0` (`assess` không đổi) |
| 8 | REF `--selftest` (OPERATIONS §1) | `SELFTEST_FAILURES=0` |
| 9 | probe `evidence/WP12/probes/extra_invented_location.py` | ghi `tickets_routed_to_invented_place` (mô phỏng: 3) — số đo rủi ro §5, không phải cổng |
| 10 | m1–m7 (§9.3) | mỗi cái `EXIT≠0` với tên test đỏ |
| 11 | `git diff --stat` | ⊆ hàng "File WP19 được ghi" |
| 12 | `--pg` (OPERATIONS §1) | chạy nếu có Docker; không có ⇒ ⬜ + lý do (WP19 không đổi store) |

Cổng P10 theo môi trường (đánh dấu khi có output máy): local giả §9.4 #1–#11 ⬜ · local `--pg` #12 ⬜ · live §9.5 ⬜ (NOT_RUN) · server ⬜ (sau Q-P10-5, theo §10).

### 9.5 Năng lực live — NOT_RUN
`PYTHONUTF8=1 PYTHONPATH=. python scripts/agent_live_eval.py --workers 3` (`.env`: `LLM_MODE=agy_cli`, `MODEL_NAME=gemini-3.8-flash-low`) — chỉ chạy khi người cho dùng quota. Ngưỡng: `under = 0` ở nhóm `expect: EMERGENCY` (A_help_fire, A2_help_fire_hard, D_smoke_lots); `over` ghi số, so với [G-LIVE 2026-10-07](../evidence/G-LIVE/) — không phải cổng (Q33). Vị trí live (G-LIVE-3): NOT_RUN, chưa có công cụ. Cấm bịa số.

## 10. Dữ liệu, triển khai, rollback
- **Doc cũ đọc bằng code P10:** schema chỉ nới ⇒ đọc được (suite mô phỏng gồm `case_pre_p1.json` J-01 và mọi test store: không đỏ ngoài §9.1).
- **Code trước P10 đọc doc P10:** LỖI — `Case.model_validate_json` ⇒ `agent_decision.decision.jobs.0.quote - string_type` ([forward-compat.txt](../evidence/WP18/forward-compat.txt)) ⇒ màn danh sách 500 nếu chạy lẫn (gotcha "Supabase dùng chung + `extra="forbid"`"). CẤM chạy code P10 với `MO_STORE=postgres` trên DB chung khi còn backend trước P10 đọc cùng DB; triển khai theo OPERATIONS §5 bước 1, 2, 4, 5 (bước 3 chỉ khi Q-P10-5 chọn marker). Memory mode không bị.
- **Record cũ áp lại** (`safety_for` khi resume/bổ sung): tính theo P10 ⇒ mức có thể NÂNG, không bao giờ hạ — chấp nhận (Q02).
- **Rollback:** R1 `MO_AGENT_ENABLED=false` (luật quyết, không sửa code, không mất dữ liệu) · R3 memory/local: revert commit WP19 · DB chung đã có doc P10: revert code ⇒ code cũ đọc lỗi ⇒ PHÁ HUỶ như OPERATIONS §6 R2, NGƯỜI quyết. KHÔNG có cờ bật lại cổng quote (CẤM 5).

## 11. Bảng mục bị thay thế (cũ → mới)
Banner một dòng `> ⚠ Bị thay thế bởi SPEC-P10 §x (Q35)` đã đặt ngay dưới tiêu đề mục ở P01/P08/P09 (cột "Banner"). Mục ngoài P01/P08/P09 và trong `plan.md`: ngoài phạm vi ghi của H17 ⇒ SO đặt/ghi.

| Mục cũ | Nội dung cũ | Mới | Banner |
|---|---|---|---|
| P01 §3.1 | `grounded(quote, text)` áp cho jobs, location, signals | không còn hàm khớp trong runtime; quote chỉ audit — §3.2, §3.3 | ✅ |
| P01 §3.2 dòng `location` (vế quote) + dòng `jobs[i]` (toàn job) | quote không grounded ⇒ loại cả vị trí / loại job | chỉ kiểm danh mục — §3.2 | ✅ |
| P01 §3.3 | `merge_llm`: "trích dẫn sai ⇒ UNCLEAR", tín hiệu không quote bị bỏ | tính đủ mức theo danh mục — §3.3 | ✅ |
| P01 §9 BẮT BUỘC 2 (vế "trích dẫn phải grounded") | | §6 | ✅ |
| P01 §10 dòng "Trường sai danh mục / trích dẫn sai" (vế trích dẫn) | | §8 | ✅ |
| P01 §11 đột biến (a)(b) | bỏ grounded job ⇒ A-08 đỏ; `max` thay `merge_llm` ⇒ A-04 đỏ | §9.3 | ✅ |
| P08 §2 (F3) toàn mục; plan Q28 phần F3 | quote rỗng ⇒ loại cả vị trí; "CẤM dùng vị trí không trích dẫn dù hợp lệ danh mục" | §3.2, §5 | ✅ (Q28: SO ghi plan.md) |
| P08 §4 nghiệm thu 2 (vế "trích dẫn bịa ⇒ UNCLEAR, không EMERGENCY") | | trích dẫn bịa ⇒ vẫn PRESENT ⇒ EMERGENCY — §3.3 | ✅ |
| plan Q34 phần `grounded` + `mirror_decision` quote vị trí | quote gấp ra rỗng = không trích dẫn; Mirror trích `location_text` | §3.2, §3.4 | SO ghi plan.md |
| P09 §1.1 gạch B1, B2 · §1.2 dòng 1 (liên kết giá trị–bằng chứng), dòng 4 (kiểm chứng trích dẫn) · §2.2 Code mục 1–2 · §3 (B1) · §4.2 (B2) · khối B2 + quote của `LocationEvidence` trong §5.1 · §7 dòng `UNBOUND_LOCATION_COMPONENT`, `RESIDENCE_CONTAMINATION` · §8 BẮT BUỘC 1 · §10.3 `P09-GATE-LOC-INV` | giao span, quote đủ 3 thành phần, liên kết giá trị–bằng chứng | §2, §3.2, §5; tách giữ P05 §3 + P08 §6 hiện hành | ✅ |
| 00-ARCHITECTURE I-18 vế 2, V-11 ("tín hiệu có trích dẫn hợp lệ"), D-12 (S-00 "phải có trích dẫn") | | tín hiệu hợp lệ danh mục; trích dẫn chỉ audit — §3.3, §6 | chưa (SO) |
| 01-CONTRACTS §3.1 (kiểu `Quote`, quote job bắt buộc) + §14 dòng V-11 | | §3.1 | chưa (SO) |
| SPEC-P03 dòng S-00 "phải có trích dẫn" | | §3.3 | chưa (SO) |
| TESTING-ACCEPTANCE §3.1 A-04, A-08 · §3.2 P-04 ("trích dẫn grounded") | | §9.1 | chưa (SO) |
| `docs/maintenance.md` §15 gạch "Trích dẫn vị trí bắt buộc (SPEC-P08 §2, F3)" · chú thích `lexicon.yaml:346` "(phải có trích dẫn)" | | đồng bộ ở WP13 sau WP19 (`lexicon.yaml` CẤM sửa trong WP18/WP19) | — |

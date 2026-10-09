# SPEC-P01 (A0) — Gói `src/maintenance/agent/`: Agent suy luận từng bước, kiểm hợp lệ, hợp nhất với luật, dự phòng

| Trường | Giá trị |
|---|---|
| WP | WP3 (🟠) — Wave 1, song song WP1/WP2/WP4; WP11 (🔴) chỉnh prompt bằng eval thật |
| Nguồn | Người dùng (Như Ý) chốt 2026-10-05 (plan Q01–Q08, Q11); CR §2 (dòng Agent), §5, §6.1, §7, §8, §15 |
| REF chạy được | [`REF-agent-contract.py`](REF-agent-contract.py) `--selftest` ⇒ `SELFTEST_FAILURES=0` (đo 2026-10-05, base `82f01f0`); bản cố tình hỏng ⇒ `SELFTEST_FAILURES=2` |
| File được ghi | `src/maintenance/agent/{__init__,schema,prompt,client,baseline,validate,reconcile,graph,agent}.py` (mới), `src/maintenance/rules.py` (CHỈ thêm 4 hàm 01 §11 + refactor `_matches_both`), `requirements.txt` (thêm `openai>=1.40.0`), `tests/test_maintenance/test_agent_unit.py`, `test_agent_prompt.py`, `test_rule_evidence.py` (mới) |
| CẤM chạm | `engine.py`, `models.py`, `enums.py`, `catalog.py`, `safety.py`, `proposer.py`, `lexicon.yaml`, `src/api/**`, `src/web/**`, `src/agents/**` |

## 1. Luồng một lần quyết định (nút = hàm thuần trong `agent/`; nối bằng LangGraph ở `graph.py` — §8)

```text
DecisionInput ─► rules_node ─┬─(luật EMERGENCY trên safety_text)► finish_skip ─► record(source=SKIPPED_RULE_EMERGENCY)
                              ├─(len(report_text) > 12000)──────► fallback(INPUT_TOO_LARGE)
                              └─► llm_node ─(lỗi client)─► fallback(TIMEOUT|HTTP_ERROR)
                                     └─► parse_node ─(JSON/schema sai)─► fallback(INVALID_JSON|SCHEMA_INVALID)
                                            └─► validate_node ─► reconcile_node ─► record(source=AGENT)
LLM_MODE=mock (không key): build_agent trả None ⇒ engine không có Agent, đi đường luật hiện tại, không có record.
```
`ReasoningAgent.decide()` KHÔNG BAO GIỜ ném lỗi do mô hình; mọi lỗi thành record `FALLBACK_RULE` (I-21). Lỗi lập trình (bug) vẫn ném.

## 2. Nền luật — `agent/baseline.py`

```python
@dataclass(frozen=True)
class RuleView:
    safety: SafetyAssessment                   # safety.assess(data.safety_text, lexicon.safety); "" ⇒ NONE, signals ()
    classification: Classification            # rules.classify(data.report_text)
    categories: frozenset[ServiceCategory]     # rules.category_evidence(data.report_text) — tập R
    electrical_hazard: bool                    # rules.electrical_hazard(data.report_text)
    location: str | None                       # data.locks.location or rules.extract_location(data.location_text, buildings)
    missing_parts: tuple[str, ...]             # rules.missing_location_parts(data.location_text, buildings) khi location None
    mentions_subject: bool                     # rules.mentions_playbook_subject(data.report_text)
    split: SplitVerdict                        # rules.split_verdict(data.report_text, buildings)

def rule_view(data: DecisionInput, catalog: Catalog, lexicon: Lexicon) -> RuleView
def mirror_decision(data: DecisionInput, catalog: Catalog, lexicon: Lexicon) -> AgentDecision
```
`mirror_decision` = quyết định "như luật" viết thành `AgentDecision` hợp lệ (dùng cho `MirrorClient` và phép thử tương đương — TESTING §3.5 PAR): an toàn = tín hiệu luật PRESENT/UNCLEAR kèm `source_quote`; jobs từ `classification` (hoặc 2 jobs khi `split` = SPLIT_PAIR); vị trí từ `location`; trùng = trong `data.duplicate_candidates`, ứng viên có `category` = loại của job và `location` = vị trí luật, chọn nhỏ nhất theo `(created_at, ticket_id)` (đúng quy tắc `engine._find_duplicate_ticket_id`); tài sản = asset duy nhất trùng vị trí; vật tư = `catalog.default_materials[playbook]`; ưu tiên = `priority.propose_priority`; `next_step` theo luật Q05/Q09 plan 05 (`_only_location_missing` + `mentions_subject`); `reasoning` = 1 bước `KET_LUAN` "Quyết định theo luật cố định".

## 3. Kiểm hợp lệ — `agent/validate.py` (sau khi `AgentDecision` qua schema)

### 3.1 Trích dẫn
`grounded(quote, text)` = hàm `grounded` của REF (gấp NFKC + chữ thường + `đ→d` + bỏ dấu + mọi ký tự không chữ/số thành một khoảng trắng; quote rỗng ⇒ False) — tương đương `safety._grounded`. Áp: `jobs[i].quote` trong `report_text`; `location.quote` trong `location_text`; `safety.signals[j].quote` trong `safety_text`.

### 3.2 Bảng kiểm từng trường (sai ⇒ thêm đường dẫn vào `rejected`, trường đó dùng luật)
| Trường | Hợp lệ khi | Sai ⇒ |
|---|---|---|
| `location` | `quote` grounded (nếu có); `building` (upper, bỏ "TÒA "/"TOA ") khớp `^(<mã tòa site>)(\.\d{1,2})?$`; `floor` chuẩn hoá bằng `rules._floor_label` khớp `^(B?\d{1,2}\|Trệt)$`; `area` trùng (NFC, không phân biệt hoa thường) một nhãn `rules.AREA_PATTERNS`; thiếu tầng mà khu vực ∈ `rules.IMPLIED_FLOOR` ⇒ điền | phần sai coi như `None` (thiếu); `quote` không grounded ⇒ loại cả `location` |
| `jobs[i]` (toàn job) | `quote` grounded | loại job; mọi job bị loại mà `scope=IN_SCOPE` ⇒ phân loại theo luật + `AGENT_FALLBACK` |
| `jobs[i]` với khoá/ghim | có `locks.category` hoặc `pinned_category` ⇒ chỉ giữ job có đúng loại đó (≤ 1) | job khác loại bị loại (không phải bất đồng) |
| `jobs[i].department_id` | = `catalog.playbook_departments[playbook của category]` (hoặc `locks.department`) | dùng bảng playbook (MINOR) |
| `jobs[i].priority_rule_id` | KY_THUAT ∈ {H1, M1, D0}; VE_SINH ∈ {H2, M2, L1, D0}; `priority` khớp mức của luật đó (H*=HIGH, M*=MEDIUM, L1=LOW, D0=MEDIUM) | ưu tiên theo luật (MINOR) |
| `jobs[i].duplicate_of` | ∈ `data.duplicate_candidates` và ứng viên cùng `category` với job | luật bước 4 quyết (MINOR) |
| `jobs[i].asset_id` | job KY_THUAT; ∈ `data.asset_candidates`; vị trí asset == vị trí cuối (khoá > Agent > luật); là asset DUY NHẤT ở vị trí đó | luật bước 6 quyết |
| `jobs[i].materials` | mọi `item_code` ∈ `catalog.playbook_materials[playbook]`, không lặp, `planned_qty ≤ agent_policy.max_material_qty` | cả danh sách ⇒ mặc định playbook (MINOR) |
| `ask_fields` | ⊆ phần vị trí còn thiếu tính bởi engine | bỏ qua (engine tự tính phần thiếu) |

### 3.3 An toàn (I-17, I-18, V-11) — dùng LẠI code đã kiểm của plan 01
```python
judgements = [safety.SignalJudgement(signal_id=s.signal_id, status=s.status, quote=s.quote) for s in decision.safety.signals]
merged = safety.merge_llm(rules.safety, safety.LLMSafetyAssessment(judgements=judgements), data.safety_text,
                          lexicon.safety, model_label=model)            # chỉ nâng; trích dẫn sai ⇒ UNCLEAR; ABSENT bị bỏ
agent_only = [s for s in merged.signals if s.detected_by == DetectedBy.LLM]
agent_risk_level = safety.derive_risk_level(agent_only, lexicon.safety)
```
- Mô hình tự khai `risk_level` = EMERGENCY nhưng `agent_risk_level == NONE` (không có tín hiệu hợp lệ) ⇒ thêm `RiskSignal(signal_id="S-00", status=UNCLEAR, source_quote=<câu đầu tiên của safety_text, nguyên văn, ≤ 120 ký tự>, detected_by=LLM, rule_id="LLM-UNGROUNDED")` ⇒ ít nhất Bậc 2 (BPTN xem). Tự khai UNCLEAR không có tín hiệu ⇒ chỉ ghi MINOR.
- `safety_text` rỗng (đã xác nhận an toàn, không bổ sung mới) ⇒ bỏ qua toàn bộ phần an toàn của mô hình.
- Kết quả an toàn của record = `merged` (rule ⊕ agent); engine lấy thêm max với mức đang có (P02 §6.1).

## 4. Prompt + client

### 4.1 Prompt — `agent/prompt.py`
- `SYSTEM_PROMPT`, `USER_TEMPLATE`, `SIGNAL_TEXT`, `EXAMPLE`, `_data()` CHÉP NGUYÊN VĂN REF mục B. `PROMPT_VERSION = "agent-prompt/1"` (tăng khi đổi chữ — WP11).
- `render_system_prompt(catalog, lexicon) -> str`: điền `site_name=catalog.site.name`, `signal_table` = `SIGNAL_TEXT` lọc theo tín hiệu Bậc 1 đang bật (`phase ∈ active_phases`, kể cả S-00 khi bật), `buildings=catalog.site.buildings`, `areas=[nhãn của rules.AREA_PATTERNS]`, `high_areas=lexicon.priority.high_areas`, `max_qty=agent_policy.max_material_qty`. Tính MỘT lần lúc dựng Agent.
- `render_user_message(data, catalog) -> str`: `USER_TEMPLATE` với `_data()` cho mọi văn bản cư dân (kể cả `excerpt` ứng viên); ứng viên mỗi dòng `- ma=<id>; loai=<VE_SINH|KY_THUAT>; vi_tri=<…>; luc=<created_at>; trang_thai=<status>; trich="<excerpt, " thay bằng '>"`; tài sản `- <asset_id>: <location>`; vật tư theo playbook `VE_SINH: SIM-MAT-CLEAN-01 (<item_name>, định mức <norm_qty> <unit>), …`; khoá `loai_viec=…; vi_tri=…; tai_san=…; phong_ban=…` (chỉ phần có), cộng `loai_viec_da_tach=<pinned>` và `la_ticket_tiep_theo_cua=<id>`; không có gì ⇒ `không`.

### 4.2 Client — `agent/client.py`
```python
@dataclass(frozen=True)
class ClientReply:
    text: str
    latency_ms: float
    usage: dict[str, int] | None = None

class DecisionClient(Protocol):
    def __call__(self, system: str, user: str, data: DecisionInput) -> ClientReply: ...   # data: chỉ client giả dùng

def openai_json_client(model: str, api_key: str, base_url: str | None, *, timeout: float, max_output_tokens: int,
                       json_mode: Literal["json_object", "prompt_only"]) -> DecisionClient
```
- `openai.OpenAI(api_key=…, base_url=base_url or None, timeout=timeout, max_retries=0)`; `chat.completions.create(model=…, temperature=0, max_tokens=max_output_tokens, messages=[system, user], response_format={"type": "json_object"} chỉ khi json_mode == "json_object")`; `text = choices[0].message.content or ""`; `usage = {prompt_tokens, completion_tokens, total_tokens}` nếu có.
- `prompt_only`: không gửi `response_format`; trước khi parse bỏ hàng rào ```` ```json ```` và lấy chuỗi từ `{` đầu tiên đến `}` cuối cùng.
- Lý do JSON mode thay function calling: DeepSeek tương thích OpenAI, hỗ trợ `response_format={"type":"json_object"}` (yêu cầu chữ "json" trong prompt — đã có, REF selftest kiểm); `langchain_openai.with_structured_output` mặc định gửi `json_schema` mà endpoint không chuẩn OpenAI có thể từ chối. Cổng G-LIVE-1 (TESTING §6) đo thật; nếu endpoint từ chối `response_format` ⇒ đặt `MO_AGENT_JSON_MODE=prompt_only` (không sửa code).
- Client giả (TESTING §2): `ScriptedClient(replies: Mapping[str, str | BaseException], default: str | BaseException | None = None)` — khoá là chuỗi con của `data.report_text` (khoá đầu tiên khớp thắng); `MirrorClient(catalog, lexicon)` — trả `mirror_decision(data, …).model_dump_json()`; `FailingClient(kind: Literal["timeout", "http", "garbage", "schema"])`.

### 4.3 Nhật ký — `ai_logger` (mọi lần gọi client, kể cả lỗi)
`ai_logger.log(ticket_id=data.ticket_id, prompt_sent={"system": f"{PROMPT_VERSION} sha256:{hex[:16]}", "user": user}, raw_output=reply.text[:20000], structured_output=decision.model_dump(mode="json") khi parse được, model_name=model, latency_ms, status, error_message, token_usage=usage)`. Status: hợp lệ ⇒ `SUCCESS`; JSON/schema sai ⇒ `SCHEMA_ERROR`; timeout ⇒ `TIMEOUT`; lớp lỗi có chữ `RateLimit` ⇒ `RATE_LIMIT`; lỗi khác ⇒ `FALLBACK_RULE`. `record.ai_log_id = entry.log_id`.

### 4.4 Đổi prompt
Chỉ WP11 (🔴) được đổi chữ `SYSTEM_PROMPT`/`SIGNAL_TEXT`/`EXAMPLE`, mỗi lần: tăng `PROMPT_VERSION`, chạy lại REF `--selftest` + `test_agent_prompt.py` + eval thật (TESTING §6), ghi số trước/sau vào evidence.

## 5. Dự phòng (FALLBACK_RULE)
| Tình huống | `fallback_reason` | `ai_logger.status` | Record |
|---|---|---|---|
| Client ném lớp có chữ `Timeout` hoặc `TimeoutError` | `TIMEOUT` | `TIMEOUT` | `source=FALLBACK_RULE`, `decision=None`, `rule_*` điền đủ |
| Client ném lỗi khác (HTTP, kết nối, 429…) | `HTTP_ERROR` | `RATE_LIMIT` / `FALLBACK_RULE` | như trên |
| `json.loads` lỗi, rỗng, bị cắt (`finish_reason=length`) | `INVALID_JSON` | `SCHEMA_ERROR` | như trên |
| `AgentDecision.model_validate` lỗi | `SCHEMA_INVALID` | `SCHEMA_ERROR` | như trên |
| `len(report_text) > 12000` | `INPUT_TOO_LARGE` | (không gọi) | như trên |
| Engine thấy vân tay lệch sau 1 lần tính lại | `STALE` (engine đặt, P02 §4.3) | (không gọi thêm) | như trên |
Mọi giá trị `fallback_reason` trên có trong Literal ở 01 §3.3.

## 6. Bất đồng Agent ↔ luật — `agent/reconcile.py` (bảng ĐÓNG; thêm dòng = đổi SPEC)

Ký hiệu: R = `rule.categories`; A = loại việc của các job HỢP LỆ; `Lr` = `rule.location`; `La` = vị trí Agent đã kiểm (đủ 3 phần).

| # | Điều kiện | `field` | Mức | Hệ quả (P02 áp) |
|---|---|---|---|---|
| G-1 | job hợp lệ có loại ∉ R (luật không thấy dấu hiệu nào của loại đó), không có khoá/ghim | `category` | **SERIOUS** | ticket của job đó dừng `PENDING_REVIEW` ở bước 5 |
| G-2 | `Lr` và `La` cùng đủ và khác nhau, không có khoá vị trí | `location` | **SERIOUS** | mọi ticket của quyết định dừng `PENDING_REVIEW` |
| G-3 | `rule.electrical_hazard` và Agent có ≥ 1 job hợp lệ và an toàn cuối NONE | `electrical_hazard` | **SERIOUS** | như G-2 |
| G-4 | A ⊂ R (Agent bỏ một loại luật thấy — vd nguyên nhân/hệ quả) | `category` | MINOR | ghi chú |
| G-5 | `Lr is None` và `La` đủ | `location` | MINOR | dùng `La` |
| G-6 | an toàn Agent thấp hơn luật | `safety` | MINOR | ghi chú "Agent cho rằng …: <reason>" cho người xem; mức vẫn theo luật |
| G-7 | ưu tiên Agent khác ưu tiên luật (cùng loại việc) | `priority` | MINOR | dùng Agent |
| G-8 | trường bị loại ở §3.2 (phòng ban, vật tư, trùng, tài sản) | tên trường | MINOR | dùng luật |
| G-9 | `next_step=PROCEED` mà vị trí còn thiếu, hoặc `ASK_RESIDENT` mà vị trí đủ | `next_step` | MINOR | engine theo vị trí thực |
Bất đồng trùng/tài sản phát hiện LÚC ÁP (P02) cũng ghi MINOR vào audit bước. Mọi `SERIOUS` ⇒ engine thêm cờ `AGENT_DISAGREEMENT`.

## 7. Record cuối
`reconcile(...) -> AgentDecisionRecord(source="AGENT", decision=<AgentDecision đã qua schema>, rejected=[…], disagreements=[…], rule_categories=sorted(R), rule_location=Lr, rule_risk_level=rule.safety.risk_level, agent_risk_level=…, candidate_ids=[c.ticket_id …], fingerprint/safety_fingerprint lấy từ data, model, latency_ms, ai_log_id, decided_at=clock())`.
Hàm thuần dùng lại lúc áp (tất định, không gọi mô hình): `reconcile.safety_for(record: AgentDecisionRecord, safety_text: str, lexicon: Lexicon, model: str) -> SafetyAssessment` = dựng lại kết quả §3.3 từ `record.decision.safety` + `safety.assess(safety_text)`; `record.decision is None` ⇒ trả `safety.assess(safety_text)`.

## 8. LangGraph — ĐỀ XUẤT CÓ (Q09 chờ người dùng gật)
- **Có**, ở `agent/graph.py`: `StateGraph(AgentState)` với `AgentState = TypedDict(total=False)` gồm `data, rules, reply, error, decision, validated, record`; nút `rules → (finish_rules | finish_skip | llm) → parse → validate → reconcile`, cạnh điều kiện tới `fallback`; `compile()` một lần trong `ReasoningAgent.__init__`; `decide()` = `graph.invoke({"data": data})["record"]` (đồng bộ, chạy trong threadpool của engine).
- Lý do CÓ: (1) kế hoạch nhóm 19/10 yêu cầu "LangGraph trên đường chạy thật" (`src/agents/` hiện chỉ là mẫu); (2) ranh giới nút = ranh giới kiểm thử/nhật ký rõ ràng (luật, mô hình, parse, kiểm, hợp nhất); (3) mở rộng sau (nút tra cứu thứ hai) không đổi engine. Chi phí: phụ thuộc đã có (`langgraph>=0.2.0`, đo bản cài 1.2.12), không thêm lượt gọi mô hình.
- Nếu người dùng nói KHÔNG: bỏ `graph.py`, `decide()` gọi tuần tự đúng các hàm nút (không đổi hợp đồng nào khác).
- Chỉ dùng API: `StateGraph`, `add_node`, `add_edge`, `add_conditional_edges`, `set_entry_point` (hoặc `START`), `END`, `compile`, `invoke`. CẤM checkpointer, bộ nhớ hội thoại, `ainvoke` trong engine.

## 9. Luật

**BẮT BUỘC**
1. Schema/prompt chép nguyên văn REF; `temperature=0`; một lượt gọi mỗi quyết định; mọi lần gọi ghi `ai_logger`.
2. Kiểm hợp lệ theo §3 cho MỌI trường trước khi engine dùng; trích dẫn phải grounded.
3. An toàn qua `safety.merge_llm` (không viết lại luật nâng mức).
4. `decide()` không ném lỗi do mô hình; mỗi nhánh dự phòng ở §5 có test.
5. Nội dung cư dân và trích đoạn ứng viên qua `_data()` trước khi nhét vào prompt.

**CẤM**
1. Cho mô hình quyết định ngoài schema (khoá lạ bị từ chối — `extra="forbid"`).
2. Đọc repo, ghi DB, giữ trạng thái giữa hai lần `decide()` (trừ graph đã compile, client).
3. Thử lại trong cùng request (retry) — dự phòng luật là đường an toàn.
4. Đưa văn bản `merged_from` hoặc dữ liệu của cư dân khác ngoài `excerpt` ≤ 200 ký tự vào prompt.

**Vùng cấm**
| Không làm | Lý do |
|---|---|
| Không dùng `with_structured_output` của LangChain | phương thức mặc định có thể gửi `json_schema` mà DeepSeek không nhận; tự parse + Pydantic kiểm soát được lỗi |
| Không gọi mô hình khi luật đã EMERGENCY | Agent không hạ được; tiết kiệm; BQL xử lý ngay (`SKIPPED_RULE_EMERGENCY`) |
| Không cho mô hình chọn ứng viên ngoài danh sách | V-03 |
| Không cắt ngắn nội dung để vừa prompt | cắt có thể bỏ mất tín hiệu; > 12000 ký tự ⇒ luật (`INPUT_TOO_LARGE`) |

## 10. Phân loại lỗi + hành vi caller (engine)
| Lỗi | Nơi | Hành vi bắt buộc |
|---|---|---|
| Mô hình timeout/HTTP/JSON/schema | `decide()` | record `FALLBACK_RULE`; engine áp luật + cờ (P02) |
| Trường sai danh mục / trích dẫn sai | `validate` | `rejected` + dùng luật cho trường đó; job/vị trí bị loại ⇒ cờ `AGENT_FALLBACK` |
| Bất đồng SERIOUS | `reconcile` | engine dừng `PENDING_REVIEW` + cờ `AGENT_DISAGREEMENT` |
| Bug (TypeError, KeyError trong code) | bất kỳ | ném ra (không nuốt) — test bắt |

## 11. Nghiệm thu
- `python -m pytest -q -p no:cacheprovider tests/test_maintenance/test_agent_unit.py tests/test_maintenance/test_agent_prompt.py tests/test_maintenance/test_rule_evidence.py; echo "EXIT=$?"` ⇒ `EXIT=0`; ca A-01…A-19 phần thuần (TESTING §3.1) + P-01…P-08 (§3.2) + RE-01…RE-06 (§3.3).
- `PYTHONPATH=. python planning/06_2026-10-05_reasoning-agent/specs/REF-agent-contract.py --selftest` ⇒ `SELFTEST_FAILURES=0`; `test_agent_prompt.py` khẳng định `prompt.SYSTEM_PROMPT == REF.SYSTEM_PROMPT` và `prompt.EXAMPLE == REF.EXAMPLE` (chép nguyên văn).
- Phải ĐỎ trước (`evidence/WP3/red-before.txt`): chạy ba file test mới trên base ⇒ lỗi import `src.maintenance.agent`.
- Đột biến (`evidence/WP3/mutation-*.txt`): (a) bỏ kiểm grounded của job ⇒ A-08 đỏ; (b) gọi thẳng `max` thay vì `merge_llm` cho phép trích dẫn sai giữ PRESENT ⇒ A-04 đỏ; (c) bỏ dòng G-1 ⇒ A-18 đỏ.

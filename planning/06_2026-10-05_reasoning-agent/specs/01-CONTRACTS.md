# 01 — CONTRACTS: enum, model, schema quyết định Agent, cấu hình, bảng chuyển, method, view, JSONB, bàn giao API/UI

> Chữ ký, tên trường, chuỗi enum dưới đây là HỢP ĐỒNG (đúng từng ký tự). Vị trí `file:dòng` đo trên base `82f01f0`, chỉ để tìm.

## 1. Enum — `src/maintenance/enums.py` (WP1)

| Enum | Thêm | Ghi chú |
|---|---|---|
| `ReasonCode` | `WAITING_EMERGENCY = "WAITING_EMERGENCY"` | P1-E: `ON_HOLD`, chủ SYSTEM; không thuộc `BPTN_REASONS`/`SAFETY_REASONS`/`BQL_REASONS` |
| `TicketFlag` | `AGENT_FALLBACK = "AGENT_FALLBACK"`, `AGENT_DISAGREEMENT = "AGENT_DISAGREEMENT"` | không chặn giao việc; lọc/hiển thị cho staff |
| `PrioritySource` | `AGENT_LLM = "AGENT_LLM"` | ưu tiên do Agent chọn (D-15) |
| `Action` (+10) | `AGENT_DECISION`, `BQL_MERGE`, `MERGE_UNDO`, `CREATE_FOLLOW_UP`, `REPORT_WRONG_DEPT`, `BQL_KEEP_DEPARTMENT`, `BQL_REASSIGN_TO_BPTN`, `SPLIT_TICKET`, `SPLIT_UNDO`, `LINK_TICKETS` | giá trị = tên; không tên nào mở đầu `SAFETY`/`EMERGENCY`/`SET_PRIORITY` (giữ xanh `test_p0_contract_permissions`) |

Hằng mới: `SPLIT_PAIR: tuple[ServiceCategory, ServiceCategory] = (ServiceCategory.VE_SINH, ServiceCategory.KY_THUAT)` — tách: gốc giữ phần tử 0, con nhận phần tử 1 (Q04).

## 2. Model — `src/maintenance/models.py` (WP1). Mọi trường mới CÓ mặc định (doc cũ đọc được)

### 2.1 `Ticket` thêm 7 trường
| Trường | Kiểu / mặc định | Ghi bởi |
|---|---|---|
| `duplicate_count` | `int = Field(default=0, ge=0)` | P04 §2 |
| `merged_children` | `list[str] = []` (chỉ nối thêm) | T08, hoàn tác tách |
| `wrong_department_return_count` | `int = Field(default=0, ge=0)` | T15 |
| `follow_up_of` | `str \| None = None` | `create_follow_up` |
| `split_from` | `str \| None = None` | tách (con) |
| `split_children` | `list[str] = []` (chỉ nối thêm) | tách (gốc) |
| `split_category` | `ServiceCategory \| None = None` | tách: gốc `SPLIT_PAIR[0]`, con `SPLIT_PAIR[1]` |

Validator `_status_rules` thêm: V-T1 `split_category ∈ {None, VE_SINH, KY_THUAT}`; V-T2 `(split_category is None) == (split_from is None and not split_children)`; V-T3 không đồng thời `split_from` và `split_children`; V-T4 không tự liên kết (`ticket_id` ∉ các danh sách; `merged_into`/`split_from`/`follow_up_of` ≠ `ticket_id`); V-T5 danh sách liên kết không lặp.

### 2.2 Bản ghi nối/chép
`ResidentAddition` và `EvidenceRecord` thêm `merged_from: str | None = None` (nối sang gốc khi gộp — chỉ staff xem, luật/Agent KHÔNG đọc) và `copied_from: str | None = None` (chép sang ticket con/tiếp theo — Agent/luật đọc). Validator: không cùng đặt; ở `EvidenceRecord` chỉ khi `source == RESIDENT_ORIGINAL`.

### 2.3 Khác
- `AgentClassificationProposal.category_source: Literal["AGENT", "BPTN_LOCKED", "AGENT_SPLIT", "AGENT_LLM"]` (+2).
- `ExecutionSnapshot` (E02) + `Case.execution_snapshots: list[ExecutionSnapshot] = []` — định nghĩa ở P06 §5 (WP1 thêm lớp vào `models.py`).
- `Case.agent_decision: AgentDecisionRecord | None = None` (§3.3) — quyết định đang áp của ticket.
- `BLOCKER_CODES_BY_STATUS[ON_HOLD]` thêm `WAITING_EMERGENCY`.

## 3. Schema Agent — `src/maintenance/agent/schema.py` (WP3)

### 3.1 Đầu ra mô hình `AgentDecision` ("agent-decision/1")
Các lớp `ReasoningStep`, `SignalJudgement`, `SafetyDecision`, `LocationDecision`, `MaterialChoice`, `JobDecision`, `AgentDecision` CHÉP NGUYÊN VĂN từ [`REF-agent-contract.py`](REF-agent-contract.py) mục A (đo: `--selftest` ⇒ `SELFTEST_FAILURES=0`; ví dụ trong prompt hợp lệ; JSON hỏng ⇒ `INVALID_JSON`; thiếu khoá/khoá lạ/hai việc cùng loại/`TO_BPTN` thiếu lý do ⇒ `SCHEMA_INVALID`). Mọi lớp `extra="forbid"`.

### 3.2 Đầu vào `DecisionInput` (engine dựng, Agent đọc)
```python
class DuplicateCandidate(BaseModel):           # model_config extra="forbid", frozen=True
    ticket_id: str
    category: ServiceCategory                   # _category(candidate), luôn có
    location: str                               # effective_location(candidate), luôn đủ 3 phần
    created_at: str
    status: TicketStatus
    excerpt: str = Field(max_length=200)        # 200 ký tự đầu _content(candidate), là DỮ LIỆU không đáng tin

class AssetCandidate(BaseModel):               # frozen
    asset_id: str
    location: str

class DecisionInput(BaseModel):                # frozen
    ticket_id: str                              # "PENDING-FOLLOWUP" cho ticket tiếp theo chưa có số (P07 §6)
    created_at: str
    report_text: str                            # engine._content(work): gốc + bổ sung KHÔNG merged_from
    location_text: str                          # engine._location_text(work)
    safety_text: str                            # engine._safety_scope_text(work)
    locks: LockedFields
    pinned_category: ServiceCategory | None     # split_category (ticket con / gốc đã tách)
    follow_up_of: str | None
    duplicate_candidates: list[DuplicateCandidate] = Field(max_length=8)
    asset_candidates: list[AssetCandidate]
    fingerprint: str                            # P02 §4.1
    safety_fingerprint: str
```

### 3.3 Bản ghi áp vào ticket `AgentDecisionRecord` (lưu `Case.agent_decision`, JSONB)
```python
class Disagreement(BaseModel):                 # extra="forbid", frozen
    field: Literal["category", "location", "electrical_hazard", "safety", "duplicate", "asset", "priority",
                   "department", "materials", "next_step"]
    severity: Literal["SERIOUS", "MINOR"]
    rule_value: str | None
    agent_value: str | None
    note: str = Field(min_length=1, max_length=300)

class AgentDecisionRecord(BaseModel):          # extra="forbid"
    record_version: Literal["agent-record/1"] = "agent-record/1"
    source: Literal["AGENT", "FALLBACK_RULE", "SKIPPED_RULE_EMERGENCY"]
    model: str                                  # settings.model_name, hoặc "rules"
    fingerprint: str
    safety_fingerprint: str
    decided_at: AwareDatetime
    latency_ms: float = Field(ge=0)
    ai_log_id: str | None = None
    fallback_reason: Literal["TIMEOUT", "HTTP_ERROR", "INVALID_JSON", "SCHEMA_INVALID", "INPUT_TOO_LARGE",
                             "STALE"] | None = None
    decision: AgentDecision | None = None       # None ⇔ source != "AGENT"
    rejected: list[str] = []                    # đường dẫn trường bị engine loại, vd "jobs[0].asset_id", "location"
    disagreements: list[Disagreement] = []
    candidate_ids: list[str] = []               # id ứng viên trùng đã đưa cho mô hình
    rule_categories: list[ServiceCategory] = [] # bằng chứng luật R (P05 §2)
    rule_location: str | None = None
    rule_risk_level: RiskLevel = RiskLevel.NONE
    agent_risk_level: RiskLevel = RiskLevel.NONE   # mức suy từ tín hiệu Agent hợp lệ (P01 §3.3)
    agent_location: str | None = None           # "Tòa X / Tầng N / Khu" khi vị trí Agent đủ 3 phần và hợp lệ
    agent_missing_parts: list[str] = []         # "building" | "floor" | "area" còn thiếu theo Agent
    valid_job_indexes: list[int] = []           # chỉ số jobs không bị loại
    prompt_version: str = ""                    # PROMPT_VERSION lúc quyết định
```
Validator: `(source == "AGENT") == (decision is not None)`; `(source == "FALLBACK_RULE") == (fallback_reason is not None)`.

### 3.4 API gói Agent
```python
class ReasoningAgent:
    def __init__(self, client: DecisionClient | None, *, catalog: Catalog, lexicon: Lexicon, model_label: str,
                 clock: Callable[[], datetime]) -> None: ...
    def decide(self, data: DecisionInput) -> AgentDecisionRecord: ...     # không bao giờ ném lỗi do mô hình
    def fallback(self, data: DecisionInput, reason: str) -> AgentDecisionRecord: ...   # thuần, không gọi mô hình
    model_label: str                                                       # thuộc tính công khai

def build_agent(settings: Settings, catalog: Catalog, lexicon: Lexicon,
                clock: Callable[[], datetime]) -> ReasoningAgent | None: ...  # None khi không đủ điều kiện (OPERATIONS §4)
```
Client (`agent/client.py`): `DecisionClient.__call__(self, system: str, user: str, data: DecisionInput) -> ClientReply` (client thật bỏ qua `data`; client giả dùng nó) với `ClientReply(text: str, latency_ms: float, usage: dict[str, int] | None)`; hiện thực: `openai_json_client(...)`, `ScriptedClient`, `MirrorClient`, `FailingClient` (P01 §4.2, TESTING §2).

## 4. Cấu hình

### 4.1 `src/config.py` (WP4) — thêm vào `Settings`
```python
mo_agent_enabled: bool = True                     # LLM_MODE=openai + key ⇒ Agent suy luận quyết định (plan 06)
mo_agent_timeout_seconds: float = Field(default=25.0, gt=0, le=120)
mo_agent_max_output_tokens: int = Field(default=2500, ge=500, le=8000)
mo_agent_json_mode: Literal["json_object", "prompt_only"] = "json_object"
```
DeepSeek: `LLM_MODE=openai`, `OPENAI_BASE_URL=https://api.deepseek.com`, `OPENAI_API_KEY`, `MODEL_NAME=deepseek-chat` (OPERATIONS §4). `llm_temperature` KHÔNG áp cho Agent (Agent luôn `temperature=0`).

### 4.2 `catalog.py` + `seed/maintenance_v1/catalog.yaml` (WP1) — khoá mới BẮT BUỘC (thiếu ⇒ `ValidationError`)
```python
class WrongDeptReturnSla(Frozen):
    escalate_at_count: int = Field(ge=1)            # CR §9.2: 2

class AgentPolicy(Frozen):
    auto_split_mixed_reports: bool                  # Q03 (đã duyệt): true
    hold_near_open_emergency: bool                  # Q18 (CHỜ DUYỆT): false
    max_material_qty: float = Field(gt=0, le=100)   # 10
    max_duplicate_candidates: int = Field(ge=0, le=8)   # 8
    max_job_agent_calls: int = Field(ge=0, le=50)   # 5: số lần gọi mô hình tối đa mỗi vòng job (chỉ ticket mồ côi)

class SlaConfig(Frozen): ...  wrong_dept_return: WrongDeptReturnSla        # thêm
class Catalog(Frozen): ...    agent_policy: AgentPolicy                     # thêm
                              playbook_materials: dict[PlaybookId, tuple[str, ...]]   # thêm
class SignalDef(Frozen): ...  agent_only: bool = False                     # thêm: S-00 không có pattern
```
Validator `Catalog`: mọi mã trong `playbook_materials` có trong `materials`; mọi `default_materials[pb]` ⊆ `playbook_materials[pb]`. Validator `SafetyLexicon` (dòng "thiếu patterns"): bỏ qua khi `signal.agent_only`; `agent_only` chỉ cho phép với `signal_id == "S-00"`.
```yaml
sla_config:
  wrong_dept_return: {escalate_at_count: 2}   # CR §9.2 / §12.2 (đã chốt)
  priority: {duplicate_raise_at_count: 3}     # CR §7 PRI-U1 / D-03 — Q19 CHỜ người dùng chốt số
playbook_materials:
  PB-CLN-01: [SIM-MAT-CLEAN-01, SIM-MAT-BAG-01]
  PB-TEC-01: [SIM-MAT-LAMP-01, SIM-MAT-LAMP-02, SIM-MAT-STARTER-01]
agent_policy:
  auto_split_mixed_reports: true    # Q03 người dùng chốt 2026-10-05: Agent tự tách
  hold_near_open_emergency: false   # Q18 CHỜ DUYỆT
  max_material_qty: 10
  max_duplicate_candidates: 8
  max_job_agent_calls: 5
```
Lexicon (WP2): thêm `{signal_id: S-00, name: agent_other_hazard, tier: 1, phase: P1, scope: [COMMON], agent_only: true}`; `active_phases: [P0, P1]` (P03).

## 5. `TRANSITIONS`, `BLOCKER_OWNERS`, `PERMISSIONS` — `engine.py` (WP1)

### 5.1 Bảng sau hồ sơ (★ = mới/đổi). `len(TRANSITIONS) == 23 + 7` (test `test_engine.py` dòng `18 + 7` đổi thành `23 + 7`)
| ID | (từ, đến) | Actors | Lý do (* bắt buộc) | pipeline_only |
|---|---|---|---|---|
| T02 | (RECEIVED, NEED_INFO) | SYSTEM | MISSING_INFO* | ✓ |
| T03 | (NEED_INFO, RECEIVED) | SYSTEM, BQL | — | |
| T04 | (RECEIVED, VERIFYING) | AGENT | 7 mã hiện có* | ✓ |
| ★T08 | (VERIFYING, MERGED) | BPTN, **BQL** | — | |
| T05 | (VERIFYING, RECEIVED) | SYSTEM, BPTN, BQL | — | |
| T06 | (VERIFYING, NEED_INFO) | BPTN, BQL | MISSING_INFO* | |
| T07 | (NEED_INFO, VERIFYING) | BQL | EMERGENCY_PENDING_BQL* | |
| T10 | (VERIFYING, CLOSED) | BQL | — | |
| ★T11 | (RECEIVED, ON_HOLD) | AGENT | WAITING_MATERIAL, **WAITING_EMERGENCY*** | ✓ |
| T12 | (ON_HOLD, RECEIVED) | SYSTEM | — | ✓ |
| T13 | (RECEIVED, ROUTED) | SYSTEM | OUT_OF_HOURS | ✓ |
| T14 | (ROUTED, IN_PROGRESS) | DEPARTMENT | — | |
| T15 | (ROUTED, VERIFYING) | DEPARTMENT | WRONG_DEPT* | |
| T18 | (IN_PROGRESS, ON_HOLD) | DEPARTMENT | BLOCKED_ONSITE* | |
| T19 | (ON_HOLD, IN_PROGRESS) | DEPARTMENT | — | |
| T20 | (IN_PROGRESS, READY_FOR_REVIEW) | AGENT | — | ✓ |
| T21 | (READY_FOR_REVIEW, CLOSED) | BQL | — | |
| T22 | (READY_FOR_REVIEW, IN_PROGRESS) | BQL | REWORK* | |
| ★T09 | (MERGED, RECEIVED) | BPTN, BQL, SYSTEM | — | |
| ★T16 | (IN_PROGRESS, VERIFYING) | DEPARTMENT | WRONG_DEPT_AFTER_START* | |
| ★T17 | (VERIFYING, IN_PROGRESS) | BQL | — | |
| ★T08S-a | (ON_HOLD, MERGED) | BPTN, BQL | — (chỉ `undo_split`) | |
| ★T08S-b | (ROUTED, MERGED) | BPTN, BQL | — (chỉ `undo_split`) | |
| T23 | 7 × (X, CANCELLED) | BQL | — | |

### 5.2 `BLOCKER_OWNERS` thêm `R.WAITING_EMERGENCY: BlockerOwner.SYSTEM`.
### 5.3 `PERMISSIONS` thêm đúng 4 khoá: `BQL_MERGE: {BQL}`, `CREATE_FOLLOW_UP: {BQL}`, `BQL_REASSIGN_TO_BPTN: {BQL}`, `SPLIT_UNDO: {BPTN, BQL}`. `AGENT_DECISION`, `SPLIT_TICKET`, `LINK_TICKETS` KHÔNG có trong `PERMISSIONS` (ghi nội bộ qua `_agent`/`_audit`).

## 6. Method công khai (mới/đổi). Thứ tự lỗi chung: **404 → 403 (audit) → 409 INVALID → 409 GUARD**

| Method | Vai | Trạng thái/blocker hợp lệ | Gọi LLM? (P02 §5) | Trả về | SPEC |
|---|---|---|---|---|---|
| `receive(…)` (đổi) | RESIDENT | — | có (trước khoá) | ticket | P02 §5 |
| `add_resident_info(tid, actor, content)` (đổi) | RESIDENT người báo | NEED_INFO | có (nội dung sẽ có) | ticket | P02 §5 |
| `bptn_resolve(…)` (đổi) | BPTN | blocker ∈ `BPTN_REASONS` | có khi khoá/bổ sung đổi vân tay | ticket | P02 §5, P04 §3 |
| `safety_confirm_safe`, `emergency_downgrade` (đổi) | như cũ | như cũ | có khi chưa có quyết định cho nội dung hiện tại | ticket | P02 §5 |
| `bql_merge(self, ticket_id: str, actor_id: str, *, into: str, note: str) -> Case` | BQL | VERIFYING + EMERGENCY_PENDING_BQL | không | ticket bị gộp | P04 §4 |
| `undo_merge(self, ticket_id: str, actor_id: str, *, note: str) -> Case` | BPTN, BQL (BPTN 403 trên ticket khẩn cấp) | MERGED | không | ticket | P04 §5 |
| `undo_split(self, ticket_id: str, actor_id: str, *, note: str) -> Case` | BPTN, BQL | ticket con; VERIFYING(blocker không thuộc BQL)/ON_HOLD/ROUTED; chưa nhận việc; `risk_level=NONE` | không | ticket con (MERGED) | P05 §5 |
| `report_wrong_department(self, ticket_id: str, actor_id: str, *, note: str) -> Case` | DEPARTMENT đang giữ | IN_PROGRESS | không | ticket | P06 §3 |
| `bql_wrong_department(self, ticket_id: str, actor_id: str, *, decision: Literal["KEEP", "TO_BPTN"], note: str) -> Case` | BQL | VERIFYING + WRONG_DEPT_AFTER_START | không | ticket | P06 §4 |
| `create_follow_up(self, ticket_id: str, actor_id: str, *, note: str) -> Case` | BQL | VERIFYING + EMERGENCY_PENDING_BQL | có (ticket mới, trước khoá) | ticket MỚI | P07 §6 |
| `return_wrong_department` (đổi) | DEPARTMENT | ROUTED (ghim `expected_from`) | không | ticket | P06 §2 |
| `cancel` (đổi hệ quả) | BQL | 7 trạng thái | không | ticket | P04 §6, P07 §5 |
| `rate` (đổi) | RESIDENT người báo | CLOSED, hoặc MERGED có gốc CLOSED | — | ticket | P04 §7 |
| `run_jobs` (đổi cơ chế: pha tính trước ngoài khoá) | SYSTEM | như cũ | chỉ ticket mồ côi, ≤ `max_job_agent_calls`/vòng | như cũ | P02 §5 |
| `resume`, `receive_stock`, `run_agent` | như cũ | như cũ | KHÔNG (dùng record đã lưu hoặc luật) | như cũ | P02 §5 |
| `MaintenanceEngine.__init__(…, agent: ReasoningAgent \| None = None)` | — | `agent` và `llm` cùng khác None ⇒ `ValueError` | — | — | P02 §1 |

## 7. Audit + outbox (tóm tắt; chi tiết ở SPEC)
| Sự kiện | Audit (`action`, `field_name`) | Outbox |
|---|---|---|
| Áp quyết định Agent (nguồn AGENT/FALLBACK_RULE) | `AGENT_DECISION`, `agent_decision` (new_value = tóm tắt §3.3 không gồm `reasoning`) | — |
| Phát hiện trùng / BQL gộp / T09 / tách / hoàn tác tách / ticket tiếp theo / liên kết | xem P04 §8, P05 §3, P07 | `ticket.status_changed` (payload thêm `split_from`/`follow_up_of` khi tạo ticket) |
| T15 lần ≥ ngưỡng, T16 | P06 | `escalation` (BQL) |
`Notification.type` KHÔNG thêm giá trị (V-09).

## 8. View — `src/maintenance/views.py` (WP1)
- `BqlTicketRow` thêm: `duplicate_count: int`, `merged_children: list[str]`, `related_ticket_ids: list[str]`, `split_from: str | None`, `split_children: list[str]`, `follow_up_of: str | None`, `wrong_department_return_count: int`, `agent_source: str | None` (= `case.agent_decision.source`), `agent_disagreements: list[str]` (= `"<field>:<severity>"`). `bql_rows(..., flag: TicketFlag | None = None)` lọc theo cờ.
- `ResidentTicketView` thêm `split_from: LinkedTicket | None`, `split_into: list[LinkedTicket]`, `follow_up_of: LinkedTicket | None` (chỉ ticket cùng `resident_id`; `LinkedTicket(ticket_id, status, status_label, public_message)`); `additions` bỏ bản `merged_from`; `allowed_actions` có `"RATE"` khi `rating is None` và (`CLOSED` hoặc `MERGED` có gốc `CLOSED`); `status_label` chung "Đang được kiểm tra" khi blocker ∈ `SAFETY_REASONS ∪ {WAITING_EMERGENCY}`. Cư dân KHÔNG thấy gì của `agent_decision` (I-14).

## 9. i18n + `messages.py` (WP1)
```yaml
reason_messages:
  WAITING_EMERGENCY: "Phản ánh đang được kiểm tra trước khi chuyển phòng ban."
split_created_message: "Phản ánh này được tách từ phản ánh {parent} vì có hai việc cần hai bộ phận khác nhau xử lý."
follow_up_created_message: "Phản ánh này được tạo để xử lý tiếp sau phản ánh {source}."
```
`messages.split_created_message(parent: str) -> str`, `messages.follow_up_created_message(source: str) -> str`. Ba chuỗi không chứa "khẩn cấp", "nguy hiểm", "rủi ro", "sự cố", "EMERGENCY".

## 10. `priority.py` — PRI-U1 (WP7)
`PriorityProposal` thêm `adjustments: tuple[str, ...] = ()`; `propose_priority(category, location, text, lexicon, *, duplicate_count: int = 0, duplicate_raise_at: int | None = None) -> PriorityProposal`; hàm mới `apply_duplicate_raise(priority: Priority, reason: str, *, duplicate_count: int, raise_at: int) -> tuple[Priority, str, tuple[str, ...]]` dùng chung cho nền luật và nền Agent (P04 §2.3).

## 11. `rules.py` — bằng chứng cho Agent (WP3; chi tiết P05 §2)
```python
def category_evidence(description: str) -> frozenset[ServiceCategory]          # R: {VE_SINH nếu cleaning, KY_THUAT nếu lighting} — đúng định nghĩa trong classify
def electrical_hazard(description: str) -> bool                               # ELECTRICAL_HAZARD_PATTERNS khớp
def split_verdict(description: str, buildings: Sequence[str]) -> SplitVerdict  # dự phòng tách khi không có Agent
def location_mentions(description: str, buildings: Sequence[str]) -> tuple[frozenset[str], frozenset[str], frozenset[str]]
```
`classify` giữ nguyên kết quả cho mọi câu hiện có (refactor nội bộ dùng chung `_matches_both`).

## 12. Tương thích JSONB Postgres (hợp đồng; vận hành OPERATIONS §5–§6)

### 12.1 Đo lỗi hiện tại (architect, model ở base cũ `db8bf0b`, cùng hành vi trên `82f01f0`)
Trên doc sinh từ seed (`SIM-TKT-CLN-001`, 36 khoá `ticket`): thêm `ticket.duplicate_count` ⇒ `ValidationError extra_forbidden ('ticket', 'duplicate_count')`; thêm `execution_snapshots` ⇒ `extra_forbidden ('execution_snapshots',)`; `audit[0].action = "MERGE_UNDO"` ⇒ `ValidationError enum ('audit', 0, 'action')`. `PostgresRepository.get/list/get_for_update` gọi `Case.model_validate(row.doc)` (`postgres.py:186, 341, 346`) ⇒ một doc mới làm `list()` của code cũ ném lỗi ⇒ hỏng danh sách BQL, kiểm trùng, job.

### 12.2 Code mới đọc doc cũ
Mọi trường mới có mặc định (§2–§3). Kiểm bằng fixture đóng băng `tests/test_maintenance/data/case_pre_p1.json` (WP0 sinh TỪ BASE `82f01f0` trước mọi sửa — OPERATIONS §3) + test round-trip + test `--pg` chèn doc cũ thẳng vào `maintops.cases` rồi đọc.

### 12.3 Code cũ gặp doc mới — revision đánh dấu (WP4), KHÔNG DDL
`src/maintenance/store/migrations/versions/0002_p1_doc_shape.py`: `revision = "0002_p1_doc_shape"`, `down_revision = "0001_maintops_initial"`, `upgrade()`/`downgrade()` = `pass` (docstring: "plan 06 marker: cases.doc may hold P1/agent fields; older code must refuse to start"). `postgres.py`: `HEAD_REVISION = "0002_p1_doc_shape"`. `PostgresRepository.check()` (`postgres.py:450-469`) đã từ chối khởi động khi revision lệch ⇒ code cũ gặp DB `0002` ⇒ `RuntimeError` có lệnh `upgrade head`, uvicorn exit 3.

## 13. Bàn giao — route API (Châm Anh), nút UI (Trí). NGOÀI phạm vi thi công
| Route | Body | Method | Vai |
|---|---|---|---|
| `POST /bql/tickets/{id}/merge` | `{into, note}` | `bql_merge` | BQL |
| `POST /mo/tickets/{id}/unmerge` | `{note}` | `undo_merge` | BPTN, BQL |
| `POST /mo/tickets/{id}/unsplit` | `{note}` | `undo_split` | BPTN, BQL |
| `POST /mo/tickets/{id}/report-wrong-dept` | `{note}` | `report_wrong_department` | DEPARTMENT |
| `POST /bql/tickets/{id}/wrong-dept` | `{decision: KEEP\|TO_BPTN, note}` | `bql_wrong_department` | BQL |
| `POST /bql/tickets/{id}/follow-up` | `{note}` | `create_follow_up` (201, ticket MỚI) | BQL |
| `GET /mo/tickets/{id}/agent-decision` | — | đọc `case.agent_decision` (staff; cư dân 403) | BPTN, BQL, QA |
| `GET /bql/tickets?flag=AGENT_FALLBACK\|AGENT_DISAGREEMENT` | — | `bql_rows(flag=…)` | BQL |
| (giữ) `/return`, `/rating`, `/bql/tickets`, `/resident/tickets/{id}` | | hành vi đổi theo §6, §8 | |

| Vai | Màn | Hiển thị / nút |
|---|---|---|
| BPTN, BQL | chi tiết ticket | khối "Agent suy luận": các bước (`reasoning`), trích dẫn, bất đồng (đỏ = NGHIÊM TRỌNG), nguồn (`AGENT`/`FALLBACK_RULE`), model, độ trễ; cờ `AGENT_FALLBACK` "Quyết định bằng luật (Agent lỗi)" |
| BPTN | hộp việc `PENDING_REVIEW` có cờ `AGENT_DISAGREEMENT` | danh sách bất đồng + nút "Đồng ý với Agent" (`bptn_resolve` không đổi giá trị) / "Sửa loại việc / vị trí" |
| BQL | ticket khẩn cấp | "Gộp vào phản ánh khẩn cấp…" (chọn từ `related_ticket_ids`), "Tạo phản ánh sửa chữa tiếp theo" |
| BPTN, BQL | ticket `MERGED` / ticket con chưa nhận | "Hoàn tác gộp" / "Gộp lại (tách sai)" — ghi chú bắt buộc |
| Phòng ban | `IN_PROGRESS` | "Báo cần BQL xem (sai phòng ban)" — tách khỏi "Trả lại" (`ROUTED`) |
| BQL | `WRONG_DEPT_AFTER_START` | "Giữ phòng ban" / "Chuyển về BPTN" (không chung nút T22) |
| Cư dân | `MERGED` có gốc `CLOSED` | nút đánh giá theo `allowed_actions`; liên kết ticket tách/tiếp theo (cùng cư dân) |

## 14. Luật của file hợp đồng
**BẮT BUỘC:** đúng chữ ký/tên/enum; mọi trường mới có mặc định; mọi khoá cấu hình mới là BẮT BUỘC trong YAML (fail fast); WP1 giữ toàn bộ test hiện có xanh (trừ dòng `18 + 7`).
**CẤM:** đổi kiểu/ý nghĩa trường cũ; đổi tên `not_duplicate_of`; thêm `Notification.type`; để stub `NotImplementedError("plan 06` khi mở PR; cho cư dân thấy bất kỳ trường nào của `agent_decision`.
**Vùng cấm:**
| Không làm | Lý do |
|---|---|
| Không lưu toàn bộ lịch sử quyết định trên `Case` | doc phình; lịch sử đã ở audit `AGENT_DECISION` + `ai_logger`; `Case.agent_decision` chỉ giữ bản đang áp |
| Không thêm cột SQL cho trường Agent/P1 | không truy vấn theo trường nào; JSONB đủ |
| Không để mô hình trả `risk_level` quyết định trực tiếp | mức suy từ tín hiệu có trích dẫn (V-11) |
**Phân loại lỗi:** 00-ARCHITECTURE §7; bảng riêng ở từng SPEC.
**Nghiệm thu (WP1):** TESTING C-01…C-05, C-12…C-14 xanh; `pytest -q` ≥ 2971 + test mới, 0 fail, 0 skip; ruff exit 0.

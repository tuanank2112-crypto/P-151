# 01 — CONTRACTS: từ vựng, model, bảng chuyển, catalog, lexicon, method công khai (P0)

Đọc sau [`00-ARCHITECTURE.md`](00-ARCHITECTURE.md). Mọi khối mã dưới đây là **chữ ký đích** (đối chiếu với code tại `e5ececf`); worker chép đúng tên, đúng kiểu, đúng mặc định. Dòng ghi `# giữ` nghĩa là không đổi so với code hiện tại. Ký hiệu `[MỚI]/[ĐỔI]/[BỎ]` so với `e5ececf`.

## 1. `src/maintenance/enums.py`

```python
class ReasonCode(StrEnum):
    MISSING_INFO = "MISSING_INFO"            # giữ … (12 mã cũ giữ nguyên thứ tự)
    REWORK = "REWORK"
    SAFETY_REVIEW_REQUIRED = "SAFETY_REVIEW_REQUIRED"    # [MỚI] CR-03 §3.2 — Bậc 2, chủ BPTN
    EMERGENCY_PENDING_BQL = "EMERGENCY_PENDING_BQL"      # [MỚI] CR-03 §3.2 — Bậc 1, chủ BQL
    WRONG_DEPT_AFTER_START = "WRONG_DEPT_AFTER_START"    # [MỚI] CR-03 §3.2 — chủ BQL; P0 chỉ khai (Q-A)


# giữ NGUYÊN 6 mã (drift D1): "gỡ bằng bptn_resolve, SLA giờ hành chính"
BPTN_REASONS = frozenset({ReasonCode.DUPLICATE, ReasonCode.CATEGORY_UNCLEAR, ReasonCode.OUT_OF_SCOPE,
                          ReasonCode.PENDING_REVIEW, ReasonCode.ASSET_UNCLEAR, ReasonCode.WRONG_DEPT})
# [MỚI] blocker tầng an toàn: KHÔNG bao giờ do _resume()/job gỡ (I-10)
SAFETY_REASONS = frozenset({ReasonCode.SAFETY_REVIEW_REQUIRED, ReasonCode.EMERGENCY_PENDING_BQL})
# [MỚI] blocker chủ BQL: BPTN bị ACTION_DENIED khi ticket đang mang (I-11)
BQL_REASONS = frozenset({ReasonCode.EMERGENCY_PENDING_BQL, ReasonCode.WRONG_DEPT_AFTER_START})


class RiskLevel(StrEnum):          # [MỚI] CR-03 §6.1.5 — tách khỏi priority
    NONE = "NONE"
    UNCLEAR = "UNCLEAR"
    EMERGENCY = "EMERGENCY"


class SignalStatus(StrEnum):       # [MỚI] CR-03 §6.1.3
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    UNCLEAR = "UNCLEAR"


class DetectedBy(StrEnum):         # [MỚI] CR-03 §6.1.3
    RULE = "RULE"
    LLM = "LLM"


class Priority(StrEnum):           # [MỚI] CR-03 §7
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class PrioritySource(StrEnum):     # [MỚI] CR-03 §7
    AGENT_RULE = "AGENT_RULE"
    HUMAN_OVERRIDE = "HUMAN_OVERRIDE"


class ClosureKind(StrEnum):        # [MỚI] CR-03 §12.1
    NORMAL = "NORMAL"
    EMERGENCY_HANDLED = "EMERGENCY_HANDLED"


class Action(StrEnum):
    # … 26 giá trị cũ giữ nguyên (kể cả SET_ASSIGNEE: giữ tên để audit lần từ chối) …
    ASSESS_SAFETY = "ASSESS_SAFETY"               # [MỚI] bước 2b (bổ sung ngoài §12.1: truy vết AC-05/AC-17)
    SAFETY_CONFIRM_SAFE = "SAFETY_CONFIRM_SAFE"   # [MỚI] CR-03 §12.1
    SAFETY_ESCALATE = "SAFETY_ESCALATE"           # [MỚI]
    SAFETY_REQUEST_INFO = "SAFETY_REQUEST_INFO"   # [MỚI] (bổ sung ngoài §12.1: T06)
    EMERGENCY_CLOSE = "EMERGENCY_CLOSE"           # [MỚI]
    EMERGENCY_DOWNGRADE = "EMERGENCY_DOWNGRADE"   # [MỚI]
    SET_PRIORITY = "SET_PRIORITY"                 # [MỚI]
```

- `TERMINAL_STATUSES`, `SIDE_STATUSES`, `TicketFlag`, `PLAYBOOK_*`, `SCHEMA_VERSION = "1.2"`: **giữ** (V-02). Sửa comment dòng 24 ("a resident may reopen…") thành "CLOSED is terminal: no reopen (CR-BPTN-03 §4.3)".
- CẤM thêm `Action` cho `CREATE_FOLLOW_UP`, `MERGE_UNDO`, `REPORT_WRONG_DEPT`, `BQL_REASSIGN_TO_BPTN` ở P0 (không có đường dùng — V-09 cùng lý do).

## 2. `src/maintenance/models.py`

```python
class RiskSignal(Entity):
    """CR-03 §6.1.3. Chỉ ghi tín hiệu CÓ bằng chứng văn bản: PRESENT/UNCLEAR, hoặc ABSENT do phủ định (B-02) / lành tính (B-01).
    Tín hiệu không được nhắc tới KHÔNG ghi."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    signal_id: str = Field(pattern=r"^(S-\d{2}|T2-0[1-5])$")
    status: SignalStatus
    source_quote: str = Field(min_length=1)   # NGUYÊN VĂN có dấu, cắt từ nội dung; S-14 nối hai đoạn bằng " | "
    detected_by: DetectedBy
    rule_id: str = Field(min_length=1)        # S-xx | T2-xx | B-01 | B-02 | B-04 | LLM


BLOCKER_CODES_BY_STATUS[TicketStatus.VERIFYING] = frozenset({
    ReasonCode.DUPLICATE, ReasonCode.CATEGORY_UNCLEAR, ReasonCode.OUT_OF_SCOPE, ReasonCode.PENDING_REVIEW,
    ReasonCode.ASSET_UNCLEAR, ReasonCode.WRONG_DEPT,
    ReasonCode.SAFETY_REVIEW_REQUIRED, ReasonCode.EMERGENCY_PENDING_BQL, ReasonCode.WRONG_DEPT_AFTER_START,  # [MỚI]
})
# STATUSES_REQUIRING_DEPARTMENT, STATUSES_REQUIRING_BLOCKER: giữ


class Ticket(Entity):
    # … 10 trường đầu giữ (ticket_id … department_id) …
    assignee_id: None = None                 # [ĐỔI] CR-03 §4.4.2: kiểu None — mọi giá trị khác ⇒ ValidationError (422)
    # … blocker, locked_fields, review_status, asset_resolution, merged_into, flags, rework_count,
    #     dispatched_at, accepted_at, closed_by, closed_at: giữ …
    closure_kind: ClosureKind | None = None  # [MỚI] iff CLOSED
    cancel_reason: str | None = None         # giữ
    # reopen_until: [BỎ] (Q03)
    rating: int | None = Field(default=None, ge=1, le=5)   # giữ; guard "một lần" ở engine.rate (SPEC-P04 §4)
    # ---- [MỚI] tầng an toàn (CR-03 §6, §12.1 — tập P0; các trường P1 xem 00 §6 V-09)
    risk_level: RiskLevel = RiskLevel.NONE
    risk_signals: list[RiskSignal] = Field(default_factory=list)   # kết quả lần đánh giá 2b GẦN NHẤT (lịch sử ở audit)
    safety_cleared_by: str | None = None
    safety_cleared_at: AwareDatetime | None = None
    safety_clear_reason: str | None = None
    safety_context: bool = False             # true CHỈ khi NEED_INFO do T06 tạo ra (hạn 12 h)
    related_ticket_ids: list[str] = Field(default_factory=list)    # Q11: liên kết (không gộp) cho ticket Bậc 1
    # ---- [MỚI] priority (CR-03 §7)
    priority: Priority | None = None
    priority_source: PrioritySource | None = None
    priority_rule_id: str | None = None      # PRI-H1|PRI-H2|PRI-M1|PRI-M2|PRI-L1|PRI-D0; None khi HUMAN_OVERRIDE
    priority_reason: str | None = None
    synthetic: Synthetic = True

    @model_validator(mode="after")
    def _status_rules(self):
        # (1) blocker ↔ status, (2) side status cần blocker: giữ nguyên
        emergency_closed = self.status == TicketStatus.CLOSED and self.closure_kind == ClosureKind.EMERGENCY_HANDLED
        if self.status in STATUSES_REQUIRING_DEPARTMENT and self.department_id is None and not emergency_closed:
            raise ValueError(f"Trạng thái {self.status} phải có department_id (đã giao ở bước 8)")   # [ĐỔI] ngoại lệ §4.4.6
        # merged_into iff MERGED, cancel_reason khi CANCELLED, closed_by/closed_at iff CLOSED: giữ
        if (self.status == TicketStatus.CLOSED) != (self.closure_kind is not None):               # [MỚI]
            raise ValueError("closure_kind bắt buộc iff CLOSED")
        cleared = (self.safety_cleared_by, self.safety_cleared_at, self.safety_clear_reason)         # [MỚI]
        if any(v is None for v in cleared) != all(v is None for v in cleared):
            raise ValueError("safety_cleared_by/at/reason phải cùng đặt hoặc cùng null")
        if (self.priority is None) != (self.priority_source is None):                              # [MỚI]
            raise ValueError("priority và priority_source cùng đặt hoặc cùng null")
        if self.priority_source == PrioritySource.HUMAN_OVERRIDE and not (self.priority_reason or "").strip():
            raise ValueError("HUMAN_OVERRIDE bắt buộc priority_reason")                             # [MỚI]
        if self.safety_context and self.status != TicketStatus.NEED_INFO:                          # [MỚI]
            raise ValueError("safety_context chỉ true khi NEED_INFO")
        return self


class Notification(Entity):
    type: Literal[
        "ticket.status_changed", "department.dispatch", "department.reconcile_failed", "reminder", "escalation",
        "emergency.created",          # [MỚI] CR-03 §6.5/§13: BQL, ngay khi vào EMERGENCY_PENDING_BQL
        "safety.review_escalated",    # [MỚI] CR-03 §13: BQL, khi SAFETY_REVIEW_REQUIRED quá 4 h lịch
    ]
```

- `WorkOrderDraft.assignee_id: None = None`: giữ. `Blocker`: giữ (resume_step cho blocker an toàn = 2).
- `Case`: giữ.

## 3. `src/maintenance/engine.py` — hằng số

### 3.1 `PERMISSIONS` (sau đổi; default deny cho mọi `Action` không có trong bảng)

```python
PERMISSIONS: dict[Action, frozenset[ActorRole]] = {
    Action.INGEST: frozenset({Role.SYSTEM}),
    Action.RUN_PIPELINE: frozenset({Role.AGENT, Role.SYSTEM}),
    Action.ADD_RESIDENT_INFO: frozenset({Role.RESIDENT}),
    Action.ADD_RESIDENT_PHOTO: frozenset({Role.RESIDENT}),
    Action.RATE_TICKET: frozenset({Role.RESIDENT}),
    Action.BPTN_RESOLVE: frozenset({Role.BPTN}),
    Action.RECEIVE_STOCK: frozenset({Role.WAREHOUSE}),
    # Action.SET_ASSIGNEE: [BỎ] khỏi bảng ⇒ mọi vai bị ACTION_DENIED có audit (CR-03 §4.4.2)
    Action.UPDATE_CHECKLIST: frozenset({Role.DEPARTMENT}),
    Action.UPDATE_MATERIAL: frozenset({Role.DEPARTMENT}),
    Action.ADD_EVIDENCE: frozenset({Role.DEPARTMENT}),
    Action.REPORT_COMPLETE: frozenset({Role.DEPARTMENT}),
    Action.RUN_JOBS: frozenset({Role.SYSTEM}),
    Action.SAFETY_CONFIRM_SAFE: frozenset({Role.BPTN, Role.BQL}),   # [MỚI] §6.4 (BPTN), §6.4 cuối (BQL)
    Action.SAFETY_ESCALATE: frozenset({Role.BPTN, Role.BQL}),       # [MỚI] E01 (BPTN|BQL); T07 chỉ BQL (qua TRANSITIONS)
    Action.SAFETY_REQUEST_INFO: frozenset({Role.BPTN, Role.BQL}),   # [MỚI] T06
    Action.EMERGENCY_DOWNGRADE: frozenset({Role.BQL}),              # [MỚI] §6.5
    Action.EMERGENCY_CLOSE: frozenset({Role.BQL}),                  # [MỚI] T10
    Action.SET_PRIORITY: frozenset({Role.BPTN, Role.BQL}),          # [MỚI] §7
}
```

### 3.2 `TRANSITIONS` (sau đổi) — **đúng 18 hàng + 7 hàng hủy = 25** (`test_transition_table_matches_the_cr` sửa thành `18 + 7`)

| ID CR-03 | Cặp | Rule | Thay đổi |
|---|---|---|---|
| T02 | `(RECEIVED, NEED_INFO)` | `_rule(Role.SYSTEM, reasons=[R.MISSING_INFO], required=True, pipeline=True)` | giữ |
| T03 | `(NEED_INFO, RECEIVED)` | `_rule(Role.SYSTEM, Role.BQL)` | [ĐỔI] bỏ `pipeline`, thêm BQL (nhánh người: P02 §4.2) |
| T04 | `(RECEIVED, VERIFYING)` | `_rule(Role.AGENT, reasons=[R.DUPLICATE, R.CATEGORY_UNCLEAR, R.OUT_OF_SCOPE, R.PENDING_REVIEW, R.ASSET_UNCLEAR, R.SAFETY_REVIEW_REQUIRED, R.EMERGENCY_PENDING_BQL], required=True, pipeline=True)` | [ĐỔI] +2 lý do |
| T08 | `(VERIFYING, MERGED)` | `_rule(Role.BPTN)` | giữ (BQL gộp = P1) |
| T05 | `(VERIFYING, RECEIVED)` | `_rule(Role.SYSTEM, Role.BPTN, Role.BQL)` | [ĐỔI] bỏ `pipeline`, +BPTN +BQL |
| T06 | `(VERIFYING, NEED_INFO)` | `_rule(Role.BPTN, Role.BQL, reasons=[R.MISSING_INFO], required=True)` | [MỚI] |
| T07 | `(NEED_INFO, VERIFYING)` | `_rule(Role.BQL, reasons=[R.EMERGENCY_PENDING_BQL], required=True)` | [MỚI] |
| T10 | `(VERIFYING, CLOSED)` | `_rule(Role.BQL)` | [MỚI] |
| T11 | `(RECEIVED, ON_HOLD)` | `_rule(Role.AGENT, reasons=[R.WAITING_MATERIAL], required=True, pipeline=True)` | giữ |
| T12 | `(ON_HOLD, RECEIVED)` | `_rule(Role.SYSTEM, pipeline=True)` | giữ |
| T13 | `(RECEIVED, ROUTED)` | `_rule(Role.SYSTEM, reasons=[R.OUT_OF_HOURS], pipeline=True)` | giữ |
| T14 | `(ROUTED, IN_PROGRESS)` | `_rule(Role.DEPARTMENT)` | giữ |
| T15 | `(ROUTED, VERIFYING)` | `_rule(Role.DEPARTMENT, reasons=[R.WRONG_DEPT], required=True)` | giữ |
| T18 | `(IN_PROGRESS, ON_HOLD)` | `_rule(Role.DEPARTMENT, reasons=[R.BLOCKED_ONSITE], required=True)` | giữ (WAITING_MATERIAL từ IN_PROGRESS = P1) |
| T19 | `(ON_HOLD, IN_PROGRESS)` | `_rule(Role.DEPARTMENT)` | giữ |
| T20 | `(IN_PROGRESS, READY_FOR_REVIEW)` | `_rule(Role.AGENT, pipeline=True)` | giữ |
| T21 | `(READY_FOR_REVIEW, CLOSED)` | `_rule(Role.BQL)` | giữ (nhánh người đặt `closure_kind=NORMAL`, bỏ `reopen_until`) |
| T22 | `(READY_FOR_REVIEW, IN_PROGRESS)` | `_rule(Role.BQL, reasons=[R.REWORK], required=True)` | giữ |
| — | `(CLOSED, READY_FOR_REVIEW)` | — | **[BỎ]** (Q03, CR-03 §4.3) |
| T23 | `(s, CANCELLED)` ∀ `s ∉ TERMINAL_STATUSES` (7 hàng) | `_rule(Role.BQL)` | giữ (lý do đã bắt buộc tại `_human_transition`) |

Bất biến kiểm được: mọi rule tới `CLOSED`/`CANCELLED` có `actors == {BQL}`; không rule nào tới `ROUTED` cho người (pipeline-only).

### 3.3 `BLOCKER_OWNERS` (sau đổi)

```python
BLOCKER_OWNERS: dict[ReasonCode, BlockerOwner] = {
    R.MISSING_INFO: BlockerOwner.RESIDENT,
    **{code: BlockerOwner.BPTN for code in BPTN_REASONS},
    R.SAFETY_REVIEW_REQUIRED: BlockerOwner.BPTN,       # [MỚI]
    R.EMERGENCY_PENDING_BQL: BlockerOwner.BQL,         # [MỚI]
    R.WRONG_DEPT_AFTER_START: BlockerOwner.BQL,        # [MỚI] (Q-A)
    R.WAITING_MATERIAL: BlockerOwner.WAREHOUSE,
    R.OUT_OF_HOURS: BlockerOwner.SYSTEM,
    R.NOT_ACCEPTED: BlockerOwner.DEPARTMENT,
    R.BLOCKED_ONSITE: BlockerOwner.DEPARTMENT,
    R.REWORK: BlockerOwner.DEPARTMENT,
}
```

Kiểm: `set(BLOCKER_OWNERS) == set(ReasonCode)` (15 mã) — thêm vào test bảng.

### 3.4 `route_blockers` / `can_route` (CR-03 §5.3)

```python
def route_blockers(ticket: Ticket) -> list[str]:
    failing = []  # ba điều kiện cũ giữ nguyên thứ tự, rồi:
    if ticket.risk_level == RiskLevel.EMERGENCY:
        failing.append("risk_level=EMERGENCY")        # [MỚI]
    return failing
```

### 3.5 Constructor

```python
def __init__(self, catalog=None, dataset=None, audit_sink=None, notify_sink=None, clock=None,
             llm: LLMClient | None = None, llm_label: str = "llm",
             lexicon: Lexicon | None = None,                 # [MỚI] None ⇒ load_lexicon()
             safety_llm: SafetyLLMClient | None = None):     # [MỚI] Q09: P0 luôn None ngoài test
    ...
    self.lexicon = lexicon or load_lexicon()
    self.safety_llm = safety_llm
```
`build_engine()` **không** truyền `safety_llm` (Q09).

## 4. `src/maintenance/catalog.py` + `seed/maintenance_v1/catalog.yaml`

```python
class MissingInfoSafetySla(Frozen):
    escalate_after_hours: float = Field(gt=0)


class MissingInfoSla(Frozen):
    retry_every_hours: float
    escalate_after_hours: float
    safety_context: MissingInfoSafetySla          # [MỚI]


class SafetyReviewSla(Frozen):
    escalate_after_hours: float = Field(gt=0)     # [MỚI] GIỜ LỊCH — KHÔNG qua business_hours.add (Q10)


class PrioritySla(Frozen):
    duplicate_raise_at_count: int = Field(ge=1)   # [MỚI] D-03; P0 nạp, chưa dùng (PRI-U1 = P1)


class SlaConfig(Frozen):
    max_auto_retries: int = Field(ge=0)
    job_interval_minutes: float = Field(gt=0)
    duplicate_window_hours: float = Field(gt=0)
    # reopen_window_days: [BỎ]
    missing_info: MissingInfoSla
    safety_review: SafetyReviewSla                # [MỚI]
    bptn: BptnSla
    waiting_material: WaitingMaterialSla
    not_accepted: NotAcceptedSla
    rework: ReworkSla
    priority: PrioritySla                         # [MỚI]
```

`catalog.yaml` khối `sla_config` **thay nguyên khối** (dòng 89–98 hiện tại) bằng:

```yaml
sla_config:
  max_auto_retries: 3
  job_interval_minutes: 5
  duplicate_window_hours: 48
  # reopen_window_days: BỎ (CR-BPTN-03 §4.3 — không reopen)
  missing_info:
    retry_every_hours: 24
    escalate_after_hours: 72
    safety_context: {escalate_after_hours: 12}   # CR-03 §6.4 / D-02: NEED_INFO khi nghi nguy hiểm
  safety_review: {escalate_after_hours: 4}       # CR-03 §6.4 / D-02: GIỜ LỊCH, không tính giờ hành chính
  bptn: {retry_every_business_hours: 1, escalate_after_business_hours: 4}
  waiting_material: {escalate_after_hours: 24}  # kiểm lại tồn kho ở đầu mỗi ca
  not_accepted: {start_after_hours: 2, retry_every_hours: 2}
  rework: {escalate_at_count: 3}
  priority: {duplicate_raise_at_count: 3}        # CR-03 §7 / D-03: P0 chỉ nạp (PRI-U1 là P1)
```

`dataset_version` của `catalog.yaml` giữ `maintenanceops-sim-v1.1`; `tickets.yaml` bump `maintenanceops-sim-v1.3` (SPEC-P04 §6).

## 5. Từ vựng là DỮ LIỆU (Q07): `seed/maintenance_v1/lexicon.yaml` + loader

Bản chuẩn: [`LEXICON-P0.yaml`](LEXICON-P0.yaml) — worker WP3 **chép nguyên văn** thành `seed/maintenance_v1/lexicon.yaml` (chỉ đổi 2 dòng chú thích đầu nếu muốn). Ngữ nghĩa pattern: chuỗi thường = khớp nguyên cụm có ranh giới từ (`\b` + `re.escape` + `\b`); tiền tố `re:` = regex Python thô. Mọi pattern khớp trên văn bản đã chuẩn hoá (SPEC-P01 §3.1).

```python
# catalog.py
def compile_pattern(pattern: str) -> re.Pattern[str]:
    """'re:<regex>' = regex thô; còn lại = cụm từ, khớp nguyên cụm có ranh giới từ."""
    return re.compile(pattern[3:]) if pattern.startswith("re:") else re.compile(r"\b" + re.escape(pattern) + r"\b")


class SignalDef(Frozen):
    signal_id: str = Field(pattern=r"^(S-\d{2}|T2-0[1-5])$")
    name: str
    tier: Literal[1, 2]
    phase: Literal["P0", "P1"]
    scope: tuple[str, ...] = ()          # chỉ để tra cứu (00 §8 D12) — P0 không lọc theo scope
    patterns: tuple[str, ...] = ()
    all_of: tuple[str, ...] = ()         # Bậc 1 tổ hợp: MỌI thành phần PRESENT (S-14)
    any_of: tuple[str, ...] = ()         # Bậc 2: có thành phần nhưng không đủ all_of (T2-05)


class ComponentDef(Frozen):
    component_id: str
    patterns: tuple[str, ...] = Field(min_length=1)


class SafetyLexicon(Frozen):
    active_phases: tuple[Literal["P0", "P1"], ...] = Field(min_length=1)
    negation_window_words: int = Field(ge=1)
    negation_prefixes: tuple[str, ...] = Field(min_length=1)
    hedge_window_words: int = Field(ge=1)
    hedges: tuple[str, ...] = Field(min_length=1)
    resolved_markers: tuple[str, ...]
    benign_phrases: tuple[str, ...]
    benign_lamp_nouns: tuple[str, ...]
    benign_with_lamp_noun: tuple[str, ...]
    ambiguous_terms: tuple[str, ...]
    ambiguous_exclusions: tuple[str, ...]
    khet_benign_contexts: tuple[str, ...]
    components: tuple[ComponentDef, ...]
    signals: tuple[SignalDef, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def _consistent(self):
        """Mọi pattern compile được (re.error ⇒ ValueError); signal_id duy nhất; all_of/any_of trỏ component có thật;
        signal có all_of/any_of thì không có patterns và ngược lại (trừ T2-03: patterns rỗng, sinh từ ambiguous_terms)."""


class PriorityLexicon(Frozen):
    high_areas: tuple[str, ...] = Field(min_length=1)            # nhãn khu vực đúng chuỗi rules.AREA_PATTERNS
    obstruction_patterns: tuple[str, ...] = Field(min_length=1)  # PRI-H2
    usage_impact_patterns: tuple[str, ...] = Field(min_length=1) # PRI-M2


class Lexicon(Frozen):
    lexicon_version: str
    synthetic: Literal[True]
    safety: SafetyLexicon
    priority: PriorityLexicon


@lru_cache
def load_lexicon(directory: Path = FIXTURE_DIR) -> Lexicon:
    return Lexicon.model_validate(_read(directory / "lexicon.yaml"))
```

Số đo nạp (LEXICON-P0): `len(lexicon.safety.signals) == 17`; số signal `phase == "P0"` = **10** (S-01, S-02, S-03, S-04, S-05, S-09, S-14, T2-03, T2-04, T2-05); `components` = 2 (`unknown_substance`, `hazard_sign`).

## 6. `src/maintenance/i18n/vi.yaml` — thêm đúng các khoá sau (không đổi khoá cũ)

```yaml
# [MỚI] CR-BPTN-03 §13: nhãn trạng thái chung cho ticket Bậc 1/Bậc 2 (resident_view ghi đè status_label)
safety_status_label: "Đang được kiểm tra"

reason_messages:
  # … 12 khoá cũ giữ nguyên …
  SAFETY_REVIEW_REQUIRED: "Phản ánh đang được kiểm tra."
  EMERGENCY_PENDING_BQL: "Phản ánh đang được kiểm tra."
  WRONG_DEPT_AFTER_START: "Đang xác minh lại phòng ban phụ trách."   # dự phòng Q-A; P0 chưa có đường tạo

field_labels:
  # … 7 khoá cũ giữ nguyên …
  safety_details: "mô tả rõ hơn hiện tượng bạn thấy (mùi, khói, tiếng động, thời điểm xảy ra)"   # Q-F
```

CẤM: khoá nào chứa chữ "khẩn cấp", "nguy hiểm", "rủi ro", mã `S-xx`/`EMERGENCY` trong lời cư dân (I-14, V-07).

## 7. Method công khai mới/đổi của `MaintenanceEngine` (Q02)

Quy ước chung: mọi method nhận `ticket_id: str, actor_id: str` đầu tiên; trả `Case` đã commit; đều giữ `engine.lock` (qua `transition`/`_mutate`); `note` bắt buộc ⇒ `_blank(note)` ⇒ `GuardError`. Thứ tự kiểm lỗi: **404 → 403 (vai, phạm vi, BPTN-trên-blocker-BQL) → 409 INVALID (status/blocker) → 409 GUARD (dữ liệu vào)**.

| Method (chữ ký Python) | Vai | Tiền điều kiện (status / blocker) | Hiệu lực (chi tiết P02/P03/P04) | Lỗi |
|---|---|---|---|---|
| `safety_confirm_safe(self, ticket_id: str, actor_id: str, *, note: str) -> Case` | BPTN, BQL (T05); **chỉ BQL** (T03) | T05: `VERIFYING` + `SAFETY_REVIEW_REQUIRED` · T03: `NEED_INFO` + `MISSING_INFO` + `safety_context=True` | audit `SAFETY_CONFIRM_SAFE`; `safety_cleared_by/at/reason`; `risk_level=NONE`; `safety_context=False`; → `RECEIVED` (một `StatusEvent`) → `_run_pipeline(2)` | 403 vai khác / BPTN trên T03 / BPTN khi blocker ∈ `BQL_REASONS`; 409 INVALID status-blocker khác; 409 GUARD `note` trống; 409 GUARD blocker `EMERGENCY_PENDING_BQL` ("dùng emergency_downgrade") |
| `safety_escalate(self, ticket_id: str, actor_id: str, *, note: str | None = None) -> Case` | BPTN, BQL (E01); **chỉ BQL** (T07) | E01: `VERIFYING` + `SAFETY_REVIEW_REQUIRED` · T07: `NEED_INFO` + `safety_context=True` | E01: audit `SAFETY_ESCALATE`; blocker → `EMERGENCY_PENDING_BQL` (chủ BQL, `since=now`, không retry/escalate_at); `risk_level=EMERGENCY`; status giữ `VERIFYING`; một `StatusEvent` public; outbox `emergency.created` · T07: → `VERIFYING`/`EMERGENCY_PENDING_BQL`, `safety_context=False`, outbox | 403 (BPTN trên T07; vai khác); 409 INVALID khác; BPTN không rút lại được (không có method ngược) |
| `safety_request_info(self, ticket_id: str, actor_id: str, *, note: str) -> Case` | BPTN, BQL | `VERIFYING` + `SAFETY_REVIEW_REQUIRED` | audit `SAFETY_REQUEST_INFO`; → `NEED_INFO`/`MISSING_INFO` với `fields=["safety_details", *phần vị trí còn thiếu]`, `safety_context=True`, `escalate_at = now + 12 h` | 403; 409 INVALID; 409 GUARD `note` trống |
| `emergency_downgrade(self, ticket_id: str, actor_id: str, *, note: str) -> Case` | **BQL** | `VERIFYING` + `EMERGENCY_PENDING_BQL` | audit `EMERGENCY_DOWNGRADE`; `safety_cleared_*`; `risk_level=NONE`; → `RECEIVED` → `_run_pipeline(2)` | 403 (BPTN: ACTION_DENIED có audit — AC-06); 409 INVALID; 409 GUARD |
| `emergency_close(self, ticket_id: str, actor_id: str, *, note: str) -> Case` | **BQL** | `VERIFYING` + `EMERGENCY_PENDING_BQL` | audit `EMERGENCY_CLOSE`; → `CLOSED`, `closure_kind=EMERGENCY_HANDLED`, `closed_by/at`, blocker `None`, `department_id` giữ `None` | 403; 409 INVALID ("Chỉ đóng từ VERIFYING khi khẩn cấp"); 409 GUARD `note` trống |
| `set_priority(self, ticket_id: str, actor_id: str, priority: Priority, *, note: str) -> Case` | BPTN, BQL | status ∉ `TERMINAL_STATUSES` | audit `SET_PRIORITY` (`old → new`, reason = note); `priority_source=HUMAN_OVERRIDE`, `priority_rule_id=None`, `priority_reason=note.strip()`; ghi bằng `_set_ticket` (atomic, validator chéo); **không** `StatusEvent` | 403; 409 GUARD (terminal / note trống / giá trị ngoài enum khi gọi trực tiếp — router trả 422 trước) |
| `rate(self, ticket_id: str, actor_id: str, score: int) -> Case` | RESIDENT (chủ ticket) | `CLOSED` và `rating is None` | giữ hành vi cũ | **[ĐỔI]** 409 GUARD khi đã có `rating` |
| `reopen(self, ticket_id: str, actor_id: str, *, note: str | None = None) -> Case` | — | — | **[ĐỔI]** `self.get(ticket_id)` rồi `raise InvalidTransitionError("Không còn mở lại ticket (CR-BPTN-03 §4.3)", {"from": CLOSED, "to": READY_FOR_REVIEW})`; không ghi gì | 404; 409 INVALID |
| `set_assignee(self, ticket_id: str, actor_id: str, assignee_id: str | None) -> Case` | — | — | **[ĐỔI]** luôn `ACTION_DENIED` có audit (qua `_mutate` với `PERMISSIONS` không có `SET_ASSIGNEE`); `assignee_id` không đổi | 403 |
| `close(...)`, `rework(...)`, `cancel(...)`, `transition(...)` | giữ chữ ký | — | `close` đặt `closure_kind=NORMAL` (P04 §5); `transition` đi qua các nhánh mới của `_human_transition` (P02 §4) | giữ |

Phương thức nội bộ mới (tên cố định để test/grep): `_step_2b_assess_safety`, `_safety_scope_text`, `_related_ticket_ids`, `_safety_precheck`, `_propose_priority`.

## 8. `src/maintenance/views.py`

```python
ResidentAction = Literal["ADD_INFO", "RATE"]          # [ĐỔI] bỏ REPORT_NOT_DONE

PRIORITY_RANK: dict[Priority | None, int] = {Priority.HIGH: 0, Priority.MEDIUM: 1, Priority.LOW: 2, None: 3}


def queue_sort_key(ticket: Ticket) -> tuple[int, int, str, str]:
    """CR-03 §7 (Q14): risk_level=EMERGENCY trên cùng, rồi priority giảm dần, rồi created_at tăng dần, rồi ticket_id.
    created_at so bằng datetime.fromisoformat(...).isoformat() (chuẩn hoá offset); không parse được ⇒ chuỗi gốc."""


def sort_queue(cases: Iterable[Case]) -> list[Case]:
    return sorted(cases, key=lambda c: queue_sort_key(c.ticket))


class BqlTicketRow(BaseModel):
    # … 17 trường cũ giữ (kể cả assignee_id: str | None — luôn None, V-11) …
    risk_level: RiskLevel                       # [MỚI]
    priority: Priority | None                   # [MỚI]
    priority_source: PrioritySource | None      # [MỚI]
    blocker_owner_role: BlockerOwner | None     # [MỚI] = blocker.owner_role (hộp "cần tôi xử lý" của BQL/BPTN)
    safety_cleared_by: str | None               # [MỚI] CR-03 §13 (danh sách đầy đủ là P1)
    closure_kind: ClosureKind | None            # [MỚI]


def bql_rows(engine, now, *, status=None, department_id=None, blocker_code=None, escalated=None, overdue=None,
             risk_level: RiskLevel | None = None, priority: Priority | None = None,
             blocker_owner_role: BlockerOwner | None = None) -> list[BqlTicketRow]:
    """[ĐỔI] duyệt snapshot list(engine.cases.values()) đã sort_queue; thêm 3 bộ lọc tuỳ chọn."""


def resident_view(engine, case, now) -> ResidentTicketView:
    """[ĐỔI] allowed_actions: ADD_INFO khi NEED_INFO; RATE khi CLOSED và rating is None. KHÔNG còn REPORT_NOT_DONE.
    status_label = _templates()["safety_status_label"] khi blocker.code ∈ SAFETY_REASONS, ngược lại status_label(status)."""
```

## 9. `src/maintenance/demo.py`

```python
class Expected(Frozen):   # catalog.py
    # … 15 trường cũ …
    risk_level: str | None = None   # [MỚI]
    priority: str | None = None     # [MỚI]

# demo.observe(): thêm 2 khoá
"risk_level": ticket.risk_level.value,
"priority": ticket.priority.value if ticket.priority else None,
```

## 10. BẮT BUỘC / CẤM / Vùng cấm / Phân loại lỗi

**BẮT BUỘC**
1. Tên, kiểu, mặc định đúng từng chữ như §1–§9; thêm trường mới vào `Ticket` **sau** `rating`, trước `synthetic` (để `model_dump` ổn định cho snapshot/persistence).
2. `len(TRANSITIONS) == 25`; `(CLOSED, READY_FOR_REVIEW) not in TRANSITIONS`; `set(BLOCKER_OWNERS) == set(ReasonCode)`.
3. Mọi `Action` mới có hàng trong `PERMISSIONS` **trừ** `ASSESS_SAFETY` (chỉ Agent ghi qua `_agent`, không phải entry point).
4. `load_lexicon()` thất bại ⇒ `pydantic.ValidationError` lúc khởi tạo engine (fail fast), không nuốt lỗi.
5. Mọi method ở §7 có docstring 1–3 dòng trỏ ID CR-03 (T05/T03/E01/T07/T06/T10) như phong cách hiện có.

**CẤM**
1. Đổi tên/giá trị enum cũ; đổi thứ tự 12 `ReasonCode` cũ (seed/UI so chuỗi).
2. Thêm trạng thái, thêm `Action` ngoài §1, thêm trường `Ticket` ngoài §2 (V-09).
3. Hardcode số giờ/số đếm/pattern trong `.py` (I-13). Đọc `sla_config`/`lexicon` qua `self.catalog`/`self.lexicon`, không gọi `load_*` trong method.
4. Để `SET_ASSIGNEE` trong `PERMISSIONS`; để `pipeline=True` trên T03/T05 (sẽ chặn nhánh người).
5. Import `src.maintenance.safety` từ `catalog.py`/`models.py` (vòng import); chiều đúng: `safety.py → catalog.py, models.py, enums.py`.

**Vùng cấm**
| # | Không làm | Lý do |
|---|---|---|
| C-01 | Không tách `RiskSignal.source_quote` thành `quote_start/quote_end` | CR-03 chỉ đòi đoạn trích; offset gãy khi nội dung là original + additions nối chuỗi |
| C-02 | Không dùng `Literal[...]` cho `signal_id` | Trường chủ từ vựng thêm tín hiệu mới mà không chạm code (Q07); regex pattern đủ chặt |
| C-03 | Không thêm `rating_comment` | §11 "comment tuỳ chọn" không nằm trong AC-15 P0; router hiện gửi `score` thôi |
| C-04 | Không nhúng `safety_llm` vào `LLMClient` của proposer | Hai hợp đồng khác nhau (phân loại ≠ an toàn); Q09 để prompt an toàn cho P1 |
| C-05 | Không đổi `Blocker.resume_step` thành kiểu khác để chứa "2b" | resume từ 2 là đủ (D2); 2b tự bỏ qua |

**Phân loại lỗi**: dùng bảng chung 00 §7. Riêng hợp đồng này: `ValidationError` khi nạp `lexicon.yaml`/`catalog.yaml` sai ⇒ engine không khởi tạo (500 lúc lifespan; `uvicorn` dừng) — caller (SO/worker) sửa YAML, không bọc try/except.

## 11. Số đo nghiệm thu của hợp đồng (chạy từ root, venv 3.11, `LLM_MODE=mock`)

| # | Lệnh | Kỳ vọng |
|---|---|---|
| M-01 | `python -c "from src.maintenance.engine import TRANSITIONS as T; from src.maintenance.enums import TicketStatus as S; print(len(T), (S.CLOSED, S.READY_FOR_REVIEW) in T)"` | `25 False` |
| M-02 | `python -c "from src.maintenance.engine import BLOCKER_OWNERS as B; from src.maintenance.enums import ReasonCode as R; print(len(B), set(B)==set(R))"` | `15 True` |
| M-03 | `python -c "from src.maintenance.catalog import load_catalog as c; s=c().sla_config; print(s.safety_review.escalate_after_hours, s.missing_info.safety_context.escalate_after_hours, s.priority.duplicate_raise_at_count, hasattr(s,'reopen_window_days'))"` | `4.0 12.0 3 False` |
| M-04 | `python -c "from src.maintenance.catalog import load_lexicon as l; x=l(); print(len(x.safety.signals), sum(s.phase=='P0' for s in x.safety.signals), len(x.safety.components))"` | `17 10 2` |
| M-05 | `python -c "from src.maintenance.engine import PERMISSIONS as P; from src.maintenance.enums import Action as A; print(A.SET_ASSIGNEE in P, sorted(a.value for a in P if a.value.startswith(('SAFETY','EMERGENCY','SET_PRIORITY'))))"` | `False ['EMERGENCY_CLOSE', 'EMERGENCY_DOWNGRADE', 'SAFETY_CONFIRM_SAFE', 'SAFETY_ESCALATE', 'SAFETY_REQUEST_INFO', 'SET_PRIORITY']` |
| M-06 | `grep -rn "reopen_until\|reopen_window_days" src/maintenance seed; echo "exit=$?"` | không dòng nào; `exit=1` |
| M-07 | `python -c "from src.maintenance.models import Ticket; import pydantic; f=Ticket.model_fields; print(f['assignee_id'].annotation, 'closure_kind' in f, 'risk_level' in f, 'priority' in f, 'reopen_until' in f)"` | `<class 'NoneType'> True True True False` |
| M-08 | `grep -c "safety_status_label\|SAFETY_REVIEW_REQUIRED:\|EMERGENCY_PENDING_BQL:\|safety_details:" src/maintenance/i18n/vi.yaml` | `4` |

## 12. Dự phòng (KHÔNG tính vào §3.2; chỉ dùng khi Q-A = "có")

```python
(S.IN_PROGRESS, S.VERIFYING): _rule(Role.DEPARTMENT, reasons=[R.WRONG_DEPT_AFTER_START], required=True),  # T16
(S.VERIFYING, S.IN_PROGRESS): _rule(Role.BQL),   # T17: chỉ khi blocker WRONG_DEPT_AFTER_START, ghi chú*
# E02 (không đổi status): _set_blocker WRONG_DEPT_AFTER_START → WRONG_DEPT (resume_step 6 nếu đổi loại việc, 7 nếu giữ),
#     department_id=None, dispatched_at=None, accepted_at=None; GIỮ checklist_items, material_lines, evidence.
# Method: report_wrong_dept(ticket_id, actor_id, *, note) [DEPARTMENT]; bql_reassign_to_bptn(ticket_id, actor_id, *, note) [BQL].
```

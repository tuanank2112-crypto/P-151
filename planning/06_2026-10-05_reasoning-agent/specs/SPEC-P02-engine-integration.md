# SPEC-P02 (A1) — Engine: gọi Agent NGOÀI khoá, áp quyết định từng bước, giao dịch nhiều ticket, mixin điều phối

| Trường | Giá trị |
|---|---|
| WP | WP5 (🟠, hạ tầng + mixin + hook, sau WP1) → WP6 (🟠, tích hợp Agent, sau WP3 + WP5). Cùng một worker nếu được (cùng `engine.py`) |
| Nguồn | Q01–Q07 (plan); CR §4, §5.1, §5.2; plan 04 E4/Q06 (`_early_proposal` ngoài khoá); plan 05 Q05/Q09 |
| File được ghi | WP5: `src/maintenance/engine.py`, `src/maintenance/errors.py` (mới), `src/maintenance/common.py` (mới), `src/maintenance/coordination/{__init__,merge,split,department,neighbors}.py` (mới — CHỈ stub/khung), `tests/test_maintenance/test_p1_infra.py` (mới), `tests/test_maintenance/test_engine.py` (CHỈ dòng `18 + 7`). WP6: `src/maintenance/engine.py`, `tests/test_maintenance/test_agent_engine.py` (mới), `tests/test_maintenance/test_agent_parity.py` (mới) |
| CẤM chạm | `agent/**` (WP3), `rules.py`, `safety.py`, `lexicon.yaml`, thân hook của Wave 4 trong `coordination/*.py` (chỉ stub), `src/api/**`, `src/web/**` |

## 1. Dựng engine
- `MaintenanceEngine.__init__(…, agent: ReasoningAgent | None = None)`: `agent is not None and llm is not None` ⇒ `ValueError("Chỉ một trong agent hoặc llm")`. `self.agent = agent`.
- `build_engine(settings)` (`engine.py:3051`): `llm_mode == "openai"` + key + `settings.mo_agent_enabled` ⇒ `MaintenanceEngine(repo=repo, agent=build_agent(settings, catalog, lexicon, clock))` (dựng `catalog`/`lexicon` một lần, truyền cả vào engine); `openai` + key + `mo_agent_enabled=false` ⇒ đường cũ (`llm=openai_client(...)`); còn lại ⇒ luật.
- `class MaintenanceEngine(MergeMixin, SplitMixin, DepartmentMixin, NeighborMixin):` — mixin ở `src/maintenance/coordination/`; mixin chỉ import `errors`, `common`, `enums`, `models`, `store.base`, `messages`, `priority`, `rules` (không import `engine` ở mức module).
- `errors.py`: chuyển `InvalidTransitionError`, `ActionDeniedError`, `AuditWriteError` sang; `common.py`: chuyển `LOCAL_TZ`, `AGENT_ID`, `SYSTEM_ID`, `DEFAULT_RESIDENT_ID`, `_blank`, `_suffix`, `_created_at`. `engine.py` import lại ⇒ `from src.maintenance.engine import ActionDeniedError, AGENT_ID, …` vẫn chạy (test + router không đổi).

## 2. Ghi nhiều ticket trong MỘT giao dịch (WP5)

```python
@dataclass
class _Touched:
    work: Case                       # bản làm việc, ghi lúc commit
    marks: tuple[int, int, int]      # len(audit), len(events), len(notifications) lúc chạm; (0,0,0) nếu chèn mới
    original: Case | None            # bản khoá đọc lên (None nếu chèn): không đổi ⇒ không lưu (I-26)
    inserted: bool

@dataclass
class _OpScope:
    tx: Tx
    main: Case
    touched: dict[str, _Touched]     # thứ tự chèn = thứ tự khoá = thứ tự commit
    committed: list[Case] | None = None

@contextmanager
def _op_scope(self, tx: Tx, main: Case) -> Iterator[_OpScope]   # thread-local self._local.op_scope, khôi phục giá trị cũ
def _related_case(self, ticket_id: str) -> Case                 # khoá + deep copy ticket khác (hoặc trả main / bản đã chạm)
def _insert_case(self, work: Case) -> None                      # ticket MỚI do thao tác này tạo
def _case_view(self, ticket_id: str) -> Case                    # chỉ đọc: bản của thao tác nếu có, không thì repo.get
def _cases_snapshot(self) -> list[Case]                         # repo.list() (một lần/thao tác) thay bằng bản của thao tác + case chèn
def _build_case(self, raw: RawTicket, planned_materials: list[PlannedMaterial] | None, resident_id: str, now: datetime,
                *, public_message: str | None = None, notify_extra: dict[str, Any] | None = None,
                reason: str = "Ingest raw ticket mô phỏng") -> Case      # đúng phần dựng Case của _ingest hiện tại, không giao dịch
def _copy_additions(self, src: Case, dst: Case, now: datetime, *, mode: Literal["merge", "copy"]) -> list[str]
def _copy_resident_photos(self, src: Case, dst: Case, now: datetime, *, mode: Literal["merge", "copy"]) -> list[str]
def _link_pair(self, a: Case, b: Case, now: datetime, actor_id: str, role: ActorRole, *, why: str) -> None
```
- `_related_case`: ngoài `op` ⇒ `EngineError("Ghi ticket liên quan ngoài một thao tác", {"ticket_id": …})`; id = main ⇒ main; đã chạm ⇒ bản đã chạm; còn lại `tx.get_for_update` (không có ⇒ `NotFoundError` ⇒ cả giao dịch hủy), kiểm integrity marker (lệch ⇒ `EngineError`), `model_copy(deep=True)`.
- `_insert_case`: trùng id ⇒ `GuardError`. `_cases_snapshot` ngoài `op` ⇒ `repo.list()`.
- `_copy_additions`: chép mọi addition `merged_from is None` và `copied_from != dst.id`; bản mới `addition_id=f"SIM-ADD-{_suffix(dst)}-{len(dst.additions)+1:02d}"`, giữ `content/submitted_by/submitted_at`, đặt `merged_from=src.id` (merge) hoặc `copied_from=src.id` (copy); ≥ 1 bản ⇒ một audit `LINK_TICKETS` trên `dst` (`field_name="additions"`). `_copy_resident_photos` tương tự với `resident_photos(src)`, `evidence_id` mới, cùng `content_or_metadata`, `immutable=True`, audit `field_name="evidence"`.
- `_link_pair`: nối id vào `related_ticket_ids` hai phía nếu chưa có (qua `_set_ticket`), mỗi phía đổi ⇒ audit `LINK_TICKETS`; phía đã kết thúc không ghi (I-26).
- `_mutate_locked` (`engine.py:1508`) — thay đúng khối `op` + `_commit`:
```python
work = case.model_copy(deep=True)
marks = (len(work.audit), len(work.events), len(work.notifications))
with self._op_scope(tx, work) as scope:
    op(work, now)
    self._commit(tx, work, *marks)                       # ticket chính trước
    for other in scope.touched.values():                  # rồi ticket liên quan theo thứ tự chạm
        if other.inserted:
            tx.insert(other.work)                          # dòng cases có trước audit_log/notifications (khoá ngoại)
        elif other.work == other.original:
            continue
        self._commit(tx, other.work, *other.marks)
```
- CẤM gọi `_mutate`, `transition`, `receive`, `resume` trong `op` (giao dịch lồng). `_ingest` dùng `_build_case`. `_record_event` thêm keyword `public_message: str | None = None`.

## 3. Mixin, hook, stub (WP5 đặt CHỖ GỌI + stub; Wave 4 (WP7–WP10) chỉ lấp THÂN trong file mixin của mình)

| Hook / method | Chữ ký | Chỗ gọi (WP5 đặt trong `engine.py`) | Mixin (WP lấp) | Thân stub do WP5 viết |
|---|---|---|---|---|
| `_on_duplicate_detected` | `(self, root: Case, work: Case, now: datetime) -> None` | bước 4, sau `root = self._related_case(root_id)` (gốc chưa kết thúc), trước `_stop(DUPLICATE)` | merge (WP7) | `return None` |
| `_merge_into` | `(self, work: Case, root_id: str, actor_id: str, role: ActorRole, now: datetime, *, note: str \| None, counted: bool) -> None` | nhánh `(VERIFYING, MERGED)` BPTN (`counted=False`) | merge | hành vi hiện tại: `_apply_transition(work, S.MERGED, …, merged_into=root_id)` |
| `_t09_unmerge_by_person` | `(self, work, actor_id, role, now, *, note) -> None` | nhánh `(MERGED, RECEIVED)` | merge | `raise NotImplementedError("plan 06 WP7: _t09_unmerge_by_person")` |
| `_unmerge` | `(self, work, actor_id, role, now, *, note: str) -> None` | `_t09…`, `_unmerge_children_of` | merge | `raise NotImplementedError("plan 06 WP7: _unmerge")` |
| `_release_duplicate_count` | `(self, work, previous_blocker: Blocker \| None, now) -> None` | `_after_cancel` | merge | `return None` |
| `_unmerge_children_of` | `(self, root: Case, now) -> None` | `_after_cancel` | merge | `return None` |
| `_apply_pri_u1` | `(self, work: Case, priority: Priority, reason: str) -> tuple[Priority, str]` | `_propose_priority` trước khi so/ghi | merge | `return priority, reason` |
| `bql_merge`, `undo_merge` | 01 §6 | — | merge | `bql_merge`: `NotImplementedError("plan 06 WP7: bql_merge")`; `undo_merge`: viết xong một dòng `return self.transition(ticket_id, S.RECEIVED, actor_id, note=note, expected_from=S.MERGED)` |
| `_try_split` | `(self, work: Case, now: datetime) -> bool` | bước 3 (§6.3) | split (WP8) | `return False` |
| `undo_split` | 01 §6 | — | split | `NotImplementedError("plan 06 WP8: undo_split")` |
| `_t15_return_wrong_department` | `(self, work, actor_id, role, now, *, note) -> None` | nhánh `(ROUTED, VERIFYING)` | department (WP9) | CHUYỂN NGUYÊN thân nhánh hiện tại (`engine.py` nhánh T15) vào đây |
| `_t16_report_wrong_department`, `_t17_keep_department` | `(self, work, actor_id, role, now, *, note) -> None` | nhánh `(IN_PROGRESS, VERIFYING)`, `(VERIFYING, IN_PROGRESS)` | department | `NotImplementedError("plan 06 WP9: …")` |
| `_carry_over_material_qty` | `(self, old_lines: list[MaterialLine], new_lines: list[MaterialLine]) -> None` | `_check_material_lines_against_stock` sau khi dựng lại dòng (giữ `old` trước) | department | `return None` |
| `report_wrong_department`, `bql_wrong_department` | 01 §6 | — | department | `report_…`: một dòng `transition(…, S.VERIFYING, …, expected_from=S.IN_PROGRESS)`; `bql_…`: `NotImplementedError` |
| `_link_emergency_both_ways` | `(self, emergency: Case, ticket_ids: list[str], now) -> None` | 2b nhánh EMERGENCY sau `_stop`; op E01 sau `_set_blocker`; nhánh T07 sau `_apply_transition` | neighbors (WP10) | `return None` |
| `_hold_for_emergency` | `(self, work: Case, now) -> bool` | đầu `_step_8_route_to_department` sau kiểm `route_blockers`: `if self._hold_for_emergency(work, now): return True` | neighbors | `return False` |
| `_release_waiting_for` | `(self, emergency: Case, now) -> None` | `_after_cancel` (khi blocker cũ `EMERGENCY_PENDING_BQL`); nhánh T05 người sau `_run_pipeline` khi blocker cũ khẩn cấp; nhánh T10 sau `_apply_transition`; `bql_merge` sau `_merge_into` | neighbors | `return None` |
| `create_follow_up` | 01 §6 | — | neighbors | `NotImplementedError("plan 06 WP10: create_follow_up")` |
`_after_cancel(self, work, previous_blocker, now)` (WP5 viết xong, trong `engine.py`, gọi ngay sau `_apply_transition(… CANCELLED …)`): `_release_duplicate_count` → `_unmerge_children_of` → `_release_waiting_for` (khi `previous_blocker.code == EMERGENCY_PENDING_BQL`).
Sửa sẵn có (WP5): `_category` thêm `or work.ticket.split_category`; `_append_addition` chỉ xoá `classification` khi cả `locked_fields.category` và `split_category` là None; `_content`/`_location_text`/`_safety_scope_text` bỏ addition `merged_from`; `resident_photos` thêm `merged_from is None`; `_find_duplicate_ticket_id`/`_related_ticket_ids` quét `self._cases_snapshot()`; nhánh `(VERIFYING, MERGED)` chỉ BPTN + blocker DUPLICATE (vai khác ⇒ `InvalidTransitionError("Gộp qua transition chỉ cho BPTN xác nhận trùng; BQL dùng bql_merge, tách sai dùng undo_split")`); `to == MERGED` từ ON_HOLD/ROUTED ⇒ `InvalidTransitionError("Chỉ hoàn tác tách (undo_split) được gộp ticket ở trạng thái này")`; `return_wrong_department` ghim `expected_from=S.ROUTED`.
**Cổng G-STUB (TESTING §7):** trước PR `grep -rc 'NotImplementedError("plan 06' src/maintenance` tổng = 0.

## 4. Quyết định: vân tay, dựng đầu vào, tính trước, áp (WP6)

### 4.1 Vân tay
```python
def _content_fingerprint(self, work: Case) -> str:
    payload = {"v": 1, "report": self._content(work), "location": self._location_text(work),
               "locks": work.ticket.locked_fields.model_dump(mode="json"),
               "pinned": work.ticket.split_category, "follow_up_of": work.ticket.follow_up_of}
    return "sha256:" + hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str).encode()).hexdigest()

def _safety_fingerprint(self, work: Case) -> str:
    return "sha256:" + hashlib.sha256(self._safety_scope_text(work).encode()).hexdigest()
```
KHÔNG gồm: ứng viên, `not_duplicate_of`, trạng thái, thời gian (kiểm lại lúc áp).

### 4.2 Dựng `DecisionInput` — `_decision_input(self, work: Case, now: datetime) -> DecisionInput`
- Ứng viên trùng: duyệt `self._cases_snapshot()`; bỏ chính nó, trạng thái kết thúc, id ∈ `work.not_duplicate_of`, `_category(o) is None`, `o.ticket.risk_level != NONE`, `effective_location(o) is None`, `created_at` ngoài `[created − duplicate_window_hours, created)`. Xếp: (1) `effective_location(o) == effective_location(work)` (luật/khoá), (2) cùng tiền tố tòa `"Tòa X /"`, (3) mới nhất trước; cắt `agent_policy.max_duplicate_candidates`. `excerpt = self._content(o)[:200]`.
- Ứng viên tài sản: mọi `catalog.assets` có `asset_type == "LIGHTING"`.
- `ticket_id`, `created_at` từ `work`; văn bản qua `_content`/`_location_text`/`_safety_scope_text`; `locks=work.ticket.locked_fields`; `pinned_category=work.ticket.split_category`; `follow_up_of`; hai vân tay §4.1.

### 4.3 Tính trước ngoài khoá + kiểm lệch
```python
_STALE = object()                                             # sentinel trong bản đồ prepared

def _prepare(self, ticket_id: str, change: Callable[[Case, datetime], None] | None) -> AgentDecisionRecord | None:
    """KHÔNG giữ engine.lock. Đọc case đã commit, áp `change` lên BẢN SAO (không sink, không repo), rồi:
    record AGENT đã lưu cùng vân tay ⇒ trả lại (không gọi mô hình); ngược lại ⇒ self.agent.decide(input)."""

@contextmanager
def _prepared(self, records: Mapping[str, AgentDecisionRecord | object], *, retry_on_stale: bool) -> Iterator[None]

def _with_decision(self, ticket_id: str, change, call: Callable[[], Case], *, gate: bool) -> Case:
    """gate=False (kiểm rẻ vai/trạng thái thất bại) ⇒ gọi `call()` thẳng, không tính trước (lỗi đúng sẽ ném ra trong khoá).
    Ngược lại: record = _prepare(...); chạy call() trong _prepared({id: record}, retry_on_stale=True);
    bắt _StaleDecision ⇒ _prepare lại MỘT lần ⇒ chạy lại; lệch lần 2 ⇒ chạy với _prepared({id: _STALE}, retry_on_stale=False)."""

class _StaleDecision(Exception): ...                          # tín hiệu nội bộ: thoát giao dịch (rollback) để tính lại
```
`_decision_for(self, work: Case, now: datetime) -> AgentDecisionRecord | None` (TRONG khoá, không gọi mô hình):
1. `self.agent is None` ⇒ `None` (đường luật hiện tại).
2. `fp = _content_fingerprint(work)`; `prepared = self._local.prepared.get(id)`.
3. `prepared is _STALE` ⇒ `self.agent.fallback(self._decision_input(work, now), "STALE")`.
4. `prepared` là record: `fingerprint == fp` ⇒ trả; lệch ⇒ `retry_on_stale` ? `raise _StaleDecision(id)` : `fallback(…, "STALE")`.
5. `work.agent_decision` có `fingerprint == fp` ⇒ trả (mọi `source`).
6. còn lại ⇒ `None` (đường không gọi mô hình: resume, job không mồ côi, hủy gốc… ⇒ luật).
`ReasoningAgent.fallback(data, reason) -> AgentDecisionRecord` (thuần, không gọi mô hình) — thêm vào 01 §3.4.

### 4.4 Kích hoạt + lưu (`_activate`)
```python
def _activate(self, work: Case, now: datetime) -> AgentDecisionRecord | None:
    """Gọi ở đầu _resume và đầu _run_pipeline (idempotent). Đặt self._local.active[id] = record; nếu record khác
    work.agent_decision ⇒ lưu vào case + một audit AGENT_DECISION + đặt lại cờ AGENT_FALLBACK / AGENT_DISAGREEMENT."""
```
- Audit `AGENT_DECISION`: actor `AGENT_ID`, `entity_type="Ticket"`, `field_name="agent_decision"`, `old_value` = tóm tắt record cũ hoặc None, `new_value` = tóm tắt `{source, model, fallback_reason, risk: {rule, agent}, scope, jobs: [{category, quote, reason, priority, duplicate_of, asset_id, needs_review}], location, next_step, rejected, disagreements, ai_log_id, latency_ms, prompt_version}`, `reason=f"Agent {source} · {model}"`, `rule_id="PB-AGT-R-DEC-01"`. KHÔNG chép `reasoning` vào audit (đã có trong `case.agent_decision` + `ai_logger`).
- Cờ: bỏ cả hai cờ rồi thêm `AGENT_FALLBACK` nếu `source == "FALLBACK_RULE"` hoặc `"location"`/mọi job ∈ `rejected`; thêm `AGENT_DISAGREEMENT` nếu có `SERIOUS`.
- `_run_pipeline` và `_resume` bọc thân bằng `try/finally` để gỡ `self._local.active[id]` (ticket con chạy pipeline lồng trong pipeline gốc).

### 4.5 Đọc quyết định ở các bước — `_view(work) -> DecisionView | None`
`None` khi không có record kích hoạt hoặc `record.decision is None` (FALLBACK/SKIPPED) ⇒ bước chạy ĐÚNG code hiện tại. `DecisionView` (lớp nhỏ trong `engine.py`) đọc record: `location()` (= `record.agent_location`), `missing_parts()`, `jobs()` (job hợp lệ theo `valid_job_indexes`), `job(category)`, `field_ok(path)`, `serious(category) -> list[Disagreement]`, `next_step`, `bptn_reason`, `note()`.
`effective_location(case)` (`engine.py:2269`): `self.agent is None` ⇒ ĐÚNG code hiện tại; ngược lại `locked_fields.location` → vị trí Agent của record ĐANG KÍCH HOẠT cho case đó, hoặc `case.agent_decision.agent_location` nếu vân tay khớp → luật (`extract_location`).

## 5. Đường vào (entry point) — ai được gọi mô hình

| Method | Gọi mô hình? | `change` (áp lên bản sao trong `_prepare`) | `gate` (kiểm rẻ trước khi tính) |
|---|---|---|---|
| `receive` | có (ngoài khoá, trước `ingest`) | dựng case mới bằng `_build_case(raw, None, resident_id, moment)` | vai RESIDENT (đã kiểm sẵn ở đầu `receive`) |
| `add_resident_info` | có | `_append_addition(w, content, actor_id, RESIDENT, …, now)` | vai RESIDENT là người báo, `status == NEED_INFO`, `content` không rỗng |
| `bptn_resolve` | có khi vân tay đổi | `_bptn_locks(...)` (helper THUẦN tách từ op hiện tại: tính `locks` + `category_changed`, áp vào `locked_fields`) + `_append_addition` nếu `info` | vai BPTN, blocker ∈ `BPTN_REASONS`, không phải `merge=True`, không phải NEED_INFO an toàn |
| `safety_confirm_safe`, `emergency_downgrade` | có khi chưa có record cho nội dung | đặt `safety_cleared_at=now` (vân tay nội dung không đổi) | vai được phép theo `PERMISSIONS`, blocker đúng mã |
| `create_follow_up` | có (ticket mới) | P07 §6 | vai BQL, nguồn `EMERGENCY_PENDING_BQL` |
| `run_jobs` | CHỈ ticket mồ côi (`_orphaned`), tối đa `agent_policy.max_job_agent_calls`/vòng | — | — |
| `resume`, `receive_stock`, `undo_merge`, `cancel` (con T09), giải phóng chờ khẩn cấp, ticket con của tách, `run_agent`, `seed`, `reset`, demo | KHÔNG | — | — |
- `receive`: `record = self._prepare_new(raw, resident_id, moment)` (dựng `DecisionInput` từ case tạm) chạy NGOÀI khoá; khi có Agent thì KHÔNG gọi `_early_proposal` (đường LLM cũ chỉ cho `llm=`); rồi `with self.lock, self.at(moment), self._prepared({raw.ticket_id: record}, retry_on_stale=False): ingest + run_agent`.
- `run_jobs` (`engine.py:1340`): pha 1 KHÔNG khoá: `orphans = [c.ticket.ticket_id for c in self.repo.list() if self._orphaned(c.ticket, moment)][:max_job_agent_calls]`, `records = {tid: self._prepare(tid, None) for tid in orphans}`; pha 2 như hiện tại trong `with self.lock, self.repo.job_lease() as leader, self.at(moment), self._prepared(records, retry_on_stale=False)`.
- `seed()`/demo không tính trước ⇒ `_decision_for` trả None ⇒ luật (I-24; test A-22 khẳng định 0 lần gọi client khi seed).

## 6. Áp quyết định theo bước (khi `_view(work)` khác None; ngược lại code hiện tại NGUYÊN VẸN)

### 6.1 Bước 2b
`result = reconcile.safety_for(record, text, self.lexicon, record.model)` nếu `record.safety_fingerprint == _safety_fingerprint(work)`, ngược lại đường hiện tại (`assess_with_llm`). **Mọi đường** (kể cả không Agent): `level = max(result.risk_level, ticket.risk_level)` theo thứ tự NONE < UNCLEAR < EMERGENCY (I-17) rồi dùng `level` thay `result.risk_level` cho các nhánh dừng; `risk_signals = result.signals`. Bất đồng G-6 vào ghi chú blocker an toàn: `note=self._with_missing(work, "Bậc 1: …") + " · Agent: <safety.reason>"` (≤ 500 ký tự).

### 6.2 Bước 2 (dữ liệu tối thiểu)
- `missing = _missing_fields(work)` (đã dùng `effective_location` có vị trí Agent). Vị trí Agent thiếu phần ⇒ phần thiếu lấy `record.agent_missing_parts` khi không có khoá và luật cũng thiếu.
- Ngoại lệ plan 05 Q05 theo Agent: `missing` chỉ gồm phần vị trí, chưa khoá loại việc, `view.next_step == "TO_BPTN"` và `view.bptn_reason == "OUT_OF_SCOPE"` ⇒ `_stop(VERIFYING, OUT_OF_SCOPE, resume_step=2, note=f"Agent: {lý do}; thiếu vị trí, không hỏi")`. Còn thiếu ⇒ `MISSING_INFO` như hiện tại (chủ BPTN). KHÔNG BAO GIỜ đi tiếp khi thiếu vị trí (kể cả Agent nói PROCEED — G-9).

### 6.3 Bước 3 (loại việc) — thứ tự quyết
1. `locked_fields.category` hoặc `split_category` ⇒ `_bind_category(work, …, "BPTN_LOCKED" | "AGENT_SPLIT")` (như hiện tại).
2. `self._try_split(work, now)` True ⇒ `_bind_category(work, SPLIT_PAIR[0], "AGENT_SPLIT", now)` (P05).
3. Có view: 1 job ⇒ `work.classification = ClassificationRecord(playbook_id, service_category=job.category, ticket_type, rule_id="PB-AGT-R-CLS-01", reason=job.reason, reason_code=None, needs_review=job.needs_review, proposer=f"agent:{model}", notes=[ghi chú bất đồng])` rồi `_bind_category(work, job.category, "AGENT_LLM", now)`; 0 job ⇒ `classification` với `playbook_id=None`, `reason_code = bptn_reason or CATEGORY_UNCLEAR` rồi `_stop(VERIFYING, reason_code, resume_step=4, note="Agent: …")`; 2 job mà `_try_split` False ⇒ dừng `CATEGORY_UNCLEAR` (resume 4) ghi chú "Agent thấy hai việc: …; không tách: <lý do>".
4. Không view ⇒ code hiện tại.
- `_bind_category` nguồn `"AGENT_LLM"`: `matched_rule_ids=["PB-AGT-R-CLS-01"]`, `classification_reason=job.reason`, `source_references=["ticket.original_description", "ticket_resident_additions", "agent_decision"]`.
- `_propose_priority`: `HUMAN_OVERRIDE` ⇒ giữ; job của Agent cho đúng loại và `jobs[i].priority` không bị loại ⇒ (`job.priority`, `job.priority_rule_id`, `f"Agent: {job.priority_reason}"`, nguồn `AGENT_LLM`); ngược lại luật (`AGENT_RULE`); rồi `_apply_pri_u1`; khoá chống ghi lặp: đường luật giữ ĐÚNG so sánh hiện tại `(priority, priority_rule_id)`; nền Agent so `(priority, priority_rule_id, priority_source)` — bằng nhau ⇒ không audit.

### 6.4 Bước 4–8
| Bước | Có view | Kiểm lại lúc áp (I-20) | Không hợp lệ |
|---|---|---|---|
| 4 trùng | `job.duplicate_of` | `_case_view(id)` còn mở, `risk_level=NONE`, `_category == loại job`, `effective_location == effective_location(work)`, trong cửa sổ, tạo trước, ∉ `not_duplicate_of` | luật `_find_duplicate_ticket_id` + ghi chú MINOR vào audit bước. Agent `null` mà luật thấy trùng ⇒ THEO AGENT (không trùng) + ghi chú MINOR |
| 5 duyệt | `job.needs_review` hoặc `view.serious(loại)` khác rỗng | — | `PENDING_REVIEW` (resume 6), ghi chú `"Agent cần người duyệt: …"` / `"Bất đồng với luật: …"` |
| 6 tài sản | khoá/onsite (như cũ) > `job.asset_id` | asset vẫn là asset LIGHTING DUY NHẤT tại vị trí cuối | luật (code hiện tại) |
| 7 vật tư | `job.materials` khi `planned_materials is None` hoặc `planned_for_playbook != playbook` | — | mặc định playbook (code hiện tại) |
| 8 giao | phòng ban = bảng playbook / khoá (Agent đã bị kiểm ở P01 §3.2) | `can_route`, ca làm như cũ | — |

## 7. Luật

**BẮT BUỘC**
1. I-16: test A-20 dùng client ghi `engine.lock._is_owned()` lúc được gọi — phải luôn `False`.
2. Đường `_view is None` chạy ĐÚNG code hiện tại: toàn bộ 2971 test hiện có xanh không sửa (trừ dòng `18 + 7` và 2 câu ví dụ P05 §8).
3. Mọi ghi ticket thứ hai qua §2; mọi kích hoạt quyết định ghi audit `AGENT_DECISION` (I-23).
4. `max(..., ticket.risk_level)` ở 2b cho mọi đường (I-17).

**CẤM**
1. Gọi `self.agent.decide` trong `with self.lock` / `op` / `repo.transaction()` (kể cả qua helper).
2. Đọc `record.decision` thẳng ở bước — chỉ qua `DecisionView` (đã tôn trọng `rejected`).
3. Bỏ qua `rejected` / tự kiểm lại danh mục khác P01 §3.2 (một nguồn kiểm duy nhất), trừ kiểm lại "còn hợp lệ lúc áp" ở §6.4.

**Vùng cấm**
| Không làm | Lý do |
|---|---|
| Không giữ quyết định cũ khi vân tay đổi "vì gần đúng" | quyết định phải khớp nội dung đang có; lệch ⇒ tính lại hoặc luật |
| Không gọi mô hình trong `resume`/`receive_stock`/hủy gốc | V-06; nội dung không đổi ⇒ record cũ dùng được |
| Không tách logic bước thành hai bản (luật/Agent) chạy song song | một bước, rẽ nhánh theo `_view`; tránh lệch hành vi |
| Không đưa `self.agent` vào mixin trực tiếp | mixin đọc `DecisionView` qua `self._view(work)` như bước khác |

## 8. Phân loại lỗi + hành vi caller
| Lỗi | Nơi | Hành vi |
|---|---|---|
| `_StaleDecision` | `_decision_for` khi vân tay lệch | rollback giao dịch; `_with_decision` tính lại 1 lần; lần 2 ⇒ `FALLBACK_RULE/STALE` |
| Mô hình chậm | `_prepare` | request chờ tối đa `MO_AGENT_TIMEOUT_SECONDS`; quá ⇒ record `TIMEOUT`, luật quyết; khoá KHÔNG bị giữ |
| `ConcurrencyError` khi ghi nhiều ticket | `_commit` của ticket thứ hai | cả giao dịch hủy ⇒ 409, caller tải lại |
| `EngineError` từ `_related_case` ngoài `op` | bug | ném ra (test bắt) |

## 9. Nghiệm thu
- WP5: `pytest -q tests/test_maintenance/test_p1_infra.py` (C-06…C-11, TESTING §3.4) + toàn bộ `pytest -q` ≥ 2971 + mới, 0 fail/skip; G-STUB chưa áp (stub được phép tới hết Wave 4).
- WP6: `pytest -q tests/test_maintenance/test_agent_engine.py tests/test_maintenance/test_agent_parity.py` (A-03, A-07, A-13, A-20…A-31, A-33, PAR-01…PAR-03) + toàn bộ suite.
- Phải ĐỎ trước: WP5 — test hạ tầng trên base ⇒ `AttributeError` (`_related_case`); WP6 — test engine Agent trên base WP5 ⇒ `TypeError` (`agent=` không có).
- Đột biến WP6: (a) gọi `agent.decide` trong `with self.lock` ở `receive` ⇒ A-20 đỏ; (b) bỏ `max(..., ticket.risk_level)` ⇒ A-07 đỏ; (c) dùng record cũ khi vân tay lệch ⇒ A-25 đỏ.

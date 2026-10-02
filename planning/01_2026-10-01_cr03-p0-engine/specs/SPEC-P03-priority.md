# SPEC-P03 — Priority: PRI-H1/H2/M1/M2/L1/D0, sửa tay có lý do + audit, khoá sắp xếp (Q14)

| Trường | Giá trị |
|---|---|
| WP | WP5 (🟠 worker-sonnet, ✅ R04), phần A — sau WP4 · WP3b (✅ R06: phủ định theo mệnh đề, Q27) · **WP3c: phủ định lối đi dùng CÙNG hàm phạm vi R1 với tầng an toàn (plan.md Q29; sửa hồi quy R07 M11)** |
| Nguồn | CR-03 §5.1 bước 3, §7 (trừ PRI-U1/U2 — P1), §12.1, §13 (sắp xếp), AC-10 (phần H/M/L/D0 + sửa tay + sắp xếp); Q01, Q07, Q14 |
| Hợp đồng | [`01-CONTRACTS.md`](01-CONTRACTS.md) §1 (`Priority`, `PrioritySource`, `Action.SET_PRIORITY`), §2 (4 trường), §3.1 (`PERMISSIONS`), §5 (`PriorityLexicon`), §7 (`set_priority`), §8 (views), §9 (demo) |
| File được ghi | `src/maintenance/priority.py` (mới), `src/maintenance/engine.py` (chỉ §3), `src/maintenance/views.py` (§4), `src/maintenance/demo.py` (`observe` + `priority`, nếu WP3 chưa thêm), `seed/maintenance_v1/tickets.yaml` (chỉ thêm dòng `priority:` vào `expected` — §5), `tests/test_maintenance/test_priority.py` (mới) |

## 1. Hợp đồng module `src/maintenance/priority.py`

```python
"""Mức ưu tiên (CR-BPTN-03 §7): luật cố định, thứ tự từ trên xuống, luật đầu tiên khớp thắng. Hàm thuần, không IO.

Tách khỏi risk_level: priority chỉ được tính ở bước 3, tức là ticket KHÔNG ở Bậc 1/Bậc 2 (hoặc đã được người xác nhận an toàn).
"""
from dataclasses import dataclass

from src.maintenance.catalog import PriorityLexicon, compile_pattern
from src.maintenance.enums import Priority, ServiceCategory
from src.maintenance.safety import TextContext, build_context, scope_before   # [ĐỔI WP3c] bỏ is_negated (WP3b)


@dataclass(frozen=True)
class PriorityProposal:
    priority: Priority
    rule_id: str        # "PRI-H1" | "PRI-H2" | "PRI-M1" | "PRI-M2" | "PRI-L1" | "PRI-D0"
    reason: str         # một câu tiếng Việt: luật + bằng chứng (khu vực, hoặc cụm khớp đầu tiên)


def propose_priority(category: ServiceCategory | None, location: str | None, text: str,
                     lexicon: PriorityLexicon) -> PriorityProposal: ...          # chữ ký GIỮ


def _first_match(patterns: tuple[str, ...], ctx: TextContext, lexicon: PriorityLexicon) -> str | None:
    """[ĐỔI WP3c] Cụm đầu tiên (theo thứ tự khai báo pattern, rồi vị trí) KHÔNG bị phủ định theo R1:
    s = scope_before(ctx, m.start(), m.start(), lexicon.negation_prefixes, lexicon.negation_fillers,
                     max_fillers=lexicon.scope_max_fillers, max_chars=lexicon.scope_max_chars)
    cụm tính khi `s is None or s.double`."""
```
`ctx = build_context(text, lexicon.clause_conjunctions)` (biến thể A, không chạy biến thể R8 — priority không phải lớp an toàn). `scope_before` là **CÙNG một hàm** với tầng an toàn (SPEC-P01 §1, §3.2.1): cue + 0..`scope_max_fillers` token đệm `negation_fillers` kết thúc ĐÚNG ngay trước cụm khớp, cửa sổ `[max(đầu mệnh đề, start − scope_max_chars), start)`. Không có từ dẫn (`LEAD`) ở priority: `hi = start`. Kết quả `double` (phủ định kép) ⇒ coi như **không** bị phủ định (cụm vẫn tính — nghiêng về ưu tiên cao).

### 1.1 Luật (đúng thứ tự; `area = location.split(" / ")[-1]`; "khớp" = `_first_match(...) is not None`)
| Bước | Điều kiện | Kết quả | `reason` (mẫu) |
|---|---|---|---|
| 0 | `location is None` **hoặc** `category ∉ {KY_THUAT, VE_SINH}` | `MEDIUM`, `PRI-D0` | `"PRI-D0: chưa rõ vị trí hoặc loại việc; mặc định MEDIUM"` |
| 1 | `category == KY_THUAT` và `area ∈ lexicon.high_areas` | `HIGH`, `PRI-H1` | `"PRI-H1: đèn tại lối đi chung (Hành lang)"` |
| 2 | `category == KY_THUAT` (khu vực khác) | `MEDIUM`, `PRI-M1` | `"PRI-M1: đèn tại khu vực khác (Phòng rác)"` |
| 3 | `category == VE_SINH` và `_first_match(obstruction_patterns)` (cụm không bị phủ định R1) | `HIGH`, `PRI-H2` | `"PRI-H2: cản trở lối đi ('tron truot')"` |
| 4 | `category == VE_SINH` và `_first_match(usage_impact_patterns)` | `MEDIUM`, `PRI-M2` | `"PRI-M2: ảnh hưởng sử dụng ('nhieu rac')"` |
| 5 | `category == VE_SINH` còn lại | `LOW`, `PRI-L1` | `"PRI-L1: chưa ảnh hưởng trực tiếp"` |
Pattern: `compile_pattern` (01 §5); duyệt theo thứ tự khai báo, lấy cụm khớp đầu tiên KHÔNG bị phủ định làm bằng chứng (cụm bị phủ định thì xét match tiếp theo của cùng pattern, rồi pattern sau). Khớp trên toàn nội dung (original + additions), vì text truyền vào là `engine._content(work)`.

Ví dụ R1 (đo trên bản thử architect, `category=VE_SINH`, `location="Tòa SIM-A / Tầng 3 / Hành lang"`):
| Câu | Kết quả | Vì sao |
|---|---|---|
| `Rác chưa được dọn chắn hết lối đi` | `HIGH PRI-H2 ('chan het loi')` | `chua` + đệm `duoc` + **`don`** (không phải đệm) ⇒ không phủ định — **sửa hồi quy R07 M11** (HEAD: `LOW PRI-L1`) |
| `Sàn chưa lau nên trơn trượt` | `HIGH PRI-H2 ('tron truot')` | `lau nen` không phải đệm — sửa M11 |
| `Không ai dọn rác tràn ra lối đi` | `HIGH PRI-H2 ('tran ra loi')` | `ai don rac` không phải đệm |
| `Hành lang không chắn lối đi, không bị trơn.` | `LOW PRI-L1` | `khong` + 0 đệm; `khong` + `bi` — phủ định đúng (Q27, N-10 giữ) |
| `Hành lang tầng 3 tòa SIM-A có nhiều rác, không chắn lối đi, không trơn trượt.` | `MEDIUM PRI-M2 ('nhieu rac')` | (test WP3b giữ) |
| `Không chắn lối đi nhưng sàn trơn trượt` | `HIGH PRI-H2 ('tron truot')` | "nhưng" cắt mệnh đề |
| `Không có rác chắn lối đi` | `HIGH PRI-H2 ('chan loi')` | **đánh đổi đã biết** (P3-06): `rac` là đối tượng của cue, không phải đệm |

Ghi chú thực tế (đo trên `rules.AREA_PATTERNS` hiện có): 5 khu vực mà `extract_location` nhận ra **đều** thuộc `high_areas` ⇒ PRI-M1 **không** tới được end-to-end ở P0 (chỉ qua unit test với `location` tự đặt). Giữ luật để không phải sửa code khi thêm khu vực (Q07).

## 2. Dữ liệu (`lexicon.yaml` phần `priority:`; nguồn chân lý = `seed/maintenance_v1/lexicon.yaml`, 01 §5.0)
- `high_areas`: đúng 5 nhãn chuỗi của `rules.AREA_PATTERNS` (có dấu): `Hành lang`, `Sảnh chính`, `Sảnh thang máy`, `Cầu thang bộ`, `Hầm xe`.
- `obstruction_patterns` (H2) 14 cụm; `usage_impact_patterns` (M2) 17 cụm — xem file. Trường sửa không chạm code.
- **[WP3c]** `negation_prefixes: [khong, ko, chang, chua]` (giữ WP3b), `negation_fillers`, `scope_max_fillers`, `scope_max_chars`, `clause_conjunctions` — 4 khoá sau PHẢI bằng khối `safety` (validator V-12, 01 §5.4); `negation_window_words` BỎ (01 §5.2–§5.3).

## 3. Nối vào engine

### 3.1 Bước 3 — gọi cuối `_bind_category` (sau `_propose_department`), nên áp cho cả category do Agent lẫn do BPTN khoá
```python
def _propose_priority(self, work: Case, category: ServiceCategory, now: datetime) -> None:
    """CR-03 §5.1 bước 3 [MỚI]: đề xuất priority. Người đã sửa tay (HUMAN_OVERRIDE) thì luật không ghi đè. Idempotent."""
    ticket = work.ticket
    if ticket.priority_source == PrioritySource.HUMAN_OVERRIDE:
        return
    proposal = propose_priority(category, self.effective_location(work), self._content(work), self.lexicon.priority)
    if (ticket.priority, ticket.priority_rule_id) == (proposal.priority, proposal.rule_id):
        return                                              # chạy lại pipeline không sinh audit thừa
    self._agent(work, Action.CREATE_PROPOSAL, "Ticket", ticket.ticket_id, "priority", ticket.priority, proposal.priority,
                proposal.reason, now=now, rule_id=proposal.rule_id)
    self._set_ticket(work, priority=proposal.priority, priority_source=PrioritySource.AGENT_RULE,
                     priority_rule_id=proposal.rule_id, priority_reason=proposal.reason)   # atomic: validator chéo (01 §2)
```
CẤM gán `ticket.priority = …` rời rạc (`validate_assignment=True` sẽ ném `ValidationError` vì `priority_source` còn `None`).

### 3.2 `set_priority` (01 §7)
```python
def set_priority(self, ticket_id: str, actor_id: str, priority: Priority, *, note: str) -> Case:
    """CR-03 §7 'Sửa tay': BPTN hoặc BQL, lý do bắt buộc, audit SET_PRIORITY, priority_source=HUMAN_OVERRIDE."""
    try:
        priority = Priority(priority)
    except ValueError as exc:
        raise GuardError(f"priority không hợp lệ: {priority!r}") from exc

    def op(work: Case, now: datetime) -> None:
        ticket = work.ticket
        if ticket.status in TERMINAL_STATUSES:
            raise GuardError("Ticket đã kết thúc; không sửa priority", {"status": ticket.status})
        if _blank(note):
            raise GuardError("Sửa priority bắt buộc ghi lý do")
        self._audit(work, Action.SET_PRIORITY, "Ticket", ticket_id, actor_id, self._role(actor_id), "priority",
                    ticket.priority, priority, note.strip(), now=now)
        self._set_ticket(work, priority=priority, priority_source=PrioritySource.HUMAN_OVERRIDE,
                         priority_rule_id=None, priority_reason=note.strip())

    return self._mutate(ticket_id, actor_id, Action.SET_PRIORITY, op)
```
- Không `StatusEvent`, không notification (CR-03 §7: HIGH không gửi thông báo khi tạo; sửa tay cũng không).
- BPTN trên ticket `EMERGENCY_PENDING_BQL` ⇒ 403 (I-11, P02 §5.1). Ticket `RECEIVED`/`VERIFYING`/`NEED_INFO`/`ON_HOLD`/`ROUTED`/`IN_PROGRESS`/`READY_FOR_REVIEW` đều sửa được.

## 4. Sắp xếp (views.py; Q14 — router không đổi)
```python
PRIORITY_RANK: dict[Priority | None, int] = {Priority.HIGH: 0, Priority.MEDIUM: 1, Priority.LOW: 2, None: 3}


def queue_sort_key(ticket: Ticket) -> tuple[int, int, str, str]:
    """CR-03 §7: EMERGENCY trên cùng → priority giảm dần → created_at tăng dần → ticket_id (ổn định)."""
    try:
        parsed = datetime.fromisoformat(ticket.raw.created_at)
        created = parsed.astimezone(timezone.utc).isoformat() if parsed.tzinfo else ticket.raw.created_at
    except ValueError:
        created = ticket.raw.created_at
    return (0 if ticket.risk_level == RiskLevel.EMERGENCY else 1, PRIORITY_RANK[ticket.priority], created, ticket.ticket_id)


def sort_queue(cases: Iterable[Case]) -> list[Case]:
    return sorted(cases, key=lambda c: queue_sort_key(c.ticket))
```
- `bql_rows` duyệt `sort_queue(list(engine.cases.values()))` (snapshot trước, sort sau — gotcha concurrency).
- Ticket Bậc 2 (`SAFETY_REVIEW_REQUIRED`) **không** lên nhóm 0 (chỉ EMERGENCY); nó có `priority=None` ⇒ hạng 3 trong nhóm 1 — CR-03 §7 chỉ nói EMERGENCY. Ghi vùng cấm P3-03.

## 5. Fixture (`tickets.yaml`): thêm dòng `priority:` vào `expected` (giữ nguyên mọi dòng khác) — đo bằng REF `priority_cases`
| Ticket | `priority` | Luật | Bằng chứng |
|---|---|---|---|
| SIM-TKT-CLN-001 | `MEDIUM` | PRI-M2 | "nhiều rác", "vết bẩn" |
| SIM-TKT-CLN-002 | `MEDIUM` | PRI-M2 | "đổ nước", "dính bẩn" |
| SIM-TKT-CLN-003 | (không thêm — NEED_INFO, chưa tới bước 3) | — | — |
| SIM-TKT-CLN-004 | (không thêm — Bậc 1) | — | — |
| SIM-TKT-CLN-005 | `LOW` | PRI-L1 | "bụi bẩn" không thuộc M2 |
| SIM-TKT-CLN-006 | `MEDIUM` | PRI-M2 | "rác vương vãi" |
| SIM-TKT-TEC-001, 002, 003, 004, 006 | `HIGH` | PRI-H1 | Hành lang / Cầu thang bộ / Hành lang / Hành lang / Hầm xe |
| SIM-TKT-TEC-005 | (không thêm — Bậc 1) | — | — |
TEC-002 (dừng `ASSET_UNCLEAR` ở bước 6) và TEC-003 (`ON_HOLD` ở bước 7) vẫn có priority vì bước 3 đã chạy.

## 6. BẮT BUỘC / CẤM / Vùng cấm

**BẮT BUỘC**
1. `propose_priority` thuần, xác định; mọi cụm từ lấy từ `lexicon.priority`.
2. Priority chỉ sinh ở bước 3 (`_bind_category`), chưa bao giờ ở 2b; ticket Bậc 1 có `priority is None`.
3. `HUMAN_OVERRIDE` thắng mọi lần chạy lại pipeline (đổi category, WRONG_DEPT, resume…).
4. Audit: luật ⇒ `CREATE_PROPOSAL` (`field_name="priority"`, `rule_id=PRI-*`); người ⇒ `SET_PRIORITY` (`reason` = note).
5. Ghi 4 trường bằng `_set_ticket` (atomic).
6. **[WP3c]** Phủ định của PRI-H2/PRI-M2 đi qua `safety.scope_before` (R1) — cùng hàm, cùng đệm, cùng ngưỡng với tầng an toàn (V-12 ép dữ liệu bằng nhau).
7. **[WP3c]** `propose_priority` giữ chữ ký; `test_negated_obstruction_is_not_h2` (WP3b) giữ xanh không sửa.

**CẤM**
1. Gửi notification khi priority = HIGH (CR-03 §7 "HIGH không gửi thông báo khi tạo").
2. Dùng `priority` để quyết định route/blocker; dùng `risk_level` để tính priority (hai trục độc lập).
3. Cho RESIDENT/DEPARTMENT/AGENT gọi `set_priority` (PERMISSIONS = {BPTN, BQL}).
4. Hardcode danh sách khu vực/cụm từ trong `.py`.
5. **[WP3c]** Giữ `is_negated`/cửa sổ "N từ" của WP3b hoặc viết hàm phủ định riêng cho priority.
6. **[WP3c]** Chạy biến thể R8 hay lưới R9 trong priority (priority không phải lớp an toàn; 2b đã chạy trước).

**Vùng cấm**
| # | Không làm | Lý do |
|---|---|---|
| P3-01 | Không làm PRI-U1 (`duplicate_count`) / PRI-U2 (`vulnerable_person`) | Q06/CR-03 §16: P1; `priority.duplicate_raise_at_count` đã nạp sẵn trong catalog để P1 không chạm schema |
| P3-02 | Không thêm bước "7b" tính lại priority sau asset/vật tư | CR-03 chỉ đặt priority ở bước 3 |
| P3-03 | Không xếp Bậc 2 lên nhóm đầu cùng EMERGENCY | CR-03 §7 chỉ ghim EMERGENCY; Bậc 2 có hạn 4 h và hộp việc riêng của BPTN |
| P3-04 | Không trả về `reason` chứa nguyên văn dài của cư dân | audit đã có; `reason` chỉ nêu cụm khớp (chuẩn hoá) để không nhân bản nội dung |
| P3-05 | Không bỏ PRI-M1/PRI-D0 dù không tới được end-to-end | luật là hợp đồng với Trường; unit test giữ chúng sống |
| P3-06 | **[WP3c]** Không thêm luật riêng cho "không có <vật> chắn lối đi" (`Không có rác chắn lối đi` ⇒ `HIGH PRI-H2`) | R1 hẹp là quyết định của judge (Q29) cho CẢ safety và priority; nới đệm để bắt "rác" sẽ làm phủ định lan lại (R07 M1). Priority cao nhầm chỉ đẩy ticket lên đầu hàng — không chặn, không mất ticket. Đo: `g_prio` 1/18 (đúng g10) |
| P3-07 | **[WP3c]** Không thêm `khong phai` vào `priority.negation_prefixes` chỉ để bắt phủ định kép | `Không phải không chắn lối đi` ⇒ `LOW PRI-L1` (đo) — hiếm; thêm cue làm "không phải chắn lối đi" thành phủ định (đúng) nhưng chưa có ca thật. Trường quyết khi có dữ liệu |

## 7. Phân loại lỗi (riêng P03; bảng chung 00 §7)
| Tình huống | Lớp / HTTP | Caller |
|---|---|---|
| `set_priority` không note / ticket terminal / giá trị ngoài enum (gọi trực tiếp) | `GuardError` 409 | sửa đầu vào |
| `set_priority` bởi RESIDENT/DEPARTMENT/AGENT/SYSTEM | `ActionDeniedError` 403 + audit | ẩn nút |
| BPTN `set_priority` trên ticket `EMERGENCY_PENDING_BQL` | 403 + audit (I-11) | chỉ BQL |
| `lexicon.priority` thiếu khoá | `ValidationError` lúc nạp | sửa YAML |
| **[WP3c]** `priority.negation_fillers/scope_max_fillers/scope_max_chars/clause_conjunctions` khác `safety` | `ValidationError` (V-12) lúc nạp | sửa YAML cho bằng nhau — không tách luật |
| **[WP3c]** Câu thật bị H2 nhầm vì phủ định có đối tượng (`không có rác chắn…`) | không lỗi (P3-06) | BPTN/BQL `set_priority` tay có lý do (§3.2) |

## 8. Số đo nghiệm thu (THẬT)
| # | Lệnh / kịch bản | Kỳ vọng |
|---|---|---|
| R-01 | REF `priority_cases` (đã đo): PR-01…PR-08 | 8/8 đúng (`HIGH/PRI-H1`, `MEDIUM/PRI-M1`, `HIGH/PRI-H2`, `MEDIUM/PRI-M2`, `LOW/PRI-L1`, `MEDIUM/PRI-D0`, `MEDIUM/PRI-M2`, `MEDIUM/PRI-M2`) |
| R-02 | `python -c "from src.maintenance.engine import MaintenanceEngine as E; e=E(); e.reset(); print({t: (c.ticket.priority, c.ticket.priority_rule_id) for t,c in e.cases.items()})"` | CLN-001 `(MEDIUM, PRI-M2)`, CLN-002 `(MEDIUM, PRI-M2)`, CLN-003 `(None, None)`, CLN-004 `(None, None)`, CLN-005 `(LOW, PRI-L1)`, CLN-006 `(MEDIUM, PRI-M2)`, TEC-001/002/003/004/006 `(HIGH, PRI-H1)`, TEC-005 `(None, None)` |
| R-03 | `fresh`: t1=`CLEANING` (09:00) → t2=`LIGHTING` (+1 phút) → t3=`"Có mùi khét ở hành lang tầng 3 tòa SIM-A."` (+2) → t4=`"Cầu thang bộ tầng 6 tòa SIM-A nhiều bụi bẩn, cần vệ sinh."` (+3); `[r.ticket_id for r in bql_rows(fresh, now)]` | `[t3, t2, t1, t4]` (EMERGENCY → HIGH → MEDIUM → LOW); đồng thời `fresh.get(t3).ticket.related_ticket_ids == sorted([t1, t2])` (Q11) |
| R-04 | `set_priority(t1, BPTN, "HIGH", note="Lối đi chính giờ cao điểm")` rồi `return_wrong_department(t1, CLN, note=…)` + `bptn_resolve(t1, BPTN, category="KY_THUAT", note=…)` | sau mọi chạy lại: `priority == HIGH`, `priority_source == HUMAN_OVERRIDE`, `priority_rule_id is None`; audit có đúng 1 `SET_PRIORITY` |
| R-05 | `set_priority(t1, BPTN, "LOW", note="")` / `set_priority(t1, CLN, "LOW", note="x")` | `GuardError` / `ActionDeniedError` + `audit[-1].action_result == ACTION_DENIED`; priority không đổi |
| R-06 | `receive("Sảnh chính tòa SIM-A nước tràn ra lối đi, trơn trượt, chắn lối, cần vệ sinh.")` | `priority == HIGH`, `priority_rule_id == "PRI-H2"`, status `ROUTED` |
| R-07 | `python -m pytest -q -p no:cacheprovider tests/test_maintenance/test_priority.py` | 0 fail; ≥ 7 test (TESTING §5) — sau WP3c: 20 test cũ + `test_priority_uses_shared_scope` (TESTING §4.1) |
| R-08 (WP3c) | bảng ví dụ §1.1 (7 câu) qua `propose_priority(ServiceCategory.VE_SINH, "Tòa SIM-A / Tầng 3 / Hành lang", text, load_lexicon().priority)` | đúng từng `(priority, rule_id)` ở bảng §1.1 (đo trên bản thử architect 2026-10-02) |
| R-09 (WP3c) | script R07 `g_prio.py` qua khối lệnh TESTING §11.5 (`AUDIT_ROOT=D:\P151`) | `FAILS 1` và dòng FAIL duy nhất là `g10` (HEAD `01c3506`: `FAILS 3` = g6, g7, g8 — đo 2026-10-02) |

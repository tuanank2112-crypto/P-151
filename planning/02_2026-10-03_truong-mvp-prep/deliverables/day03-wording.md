# D3-05 — Rà wording và quyền

**Observed at:** 2026-10-03T11:12:43+07:00  
**Branch:** feature/truong  
**Commit:** 0ea04adedd023654947e2e97e645043f0ba89159  
**Environment:** local (code review, không chạy runtime)  
**Status:** Review wording hiện có, không runtime execution

---

## 1. Phạm vi và phương pháp

Rà wording + quyền cho 4 vai trò (RESIDENT, BPTN, DEPARTMENT, BQL) dựa trên:
- Mã hiện có: `src/maintenance/i18n/vi.yaml`, `src/maintenance/views.py`, `src/api/routers/maintenance.py`
- Quyền API: phân tích allow-list ResidentTicketView và role checks trong route handlers
- Wording hiện có KHÔNG implement đầy đủ D3-05 về safety Bậc 2, emergency Bậc 1, rating-once, cấm reopen; các phần đó đánh dấu "TARGET — chưa tích hợp"

---

## 2. Bốn vai trò — Bảng wording

### WORD-01: RESIDENT (cư dân)

| Màn hình | Câu hiện tại (file:dòng) | Câu đề xuất | Role | Lý do |
|:---|:---|:---|:---|:---|
| ResidentTicketView — status_label | `status_labels[status]`: "Đã tiếp nhận", "Đang xác minh", "Đã chuyển phòng ban", "Đang xử lý", "Chờ nghiệm thu", "Hoàn thành", "Chờ bổ sung thông tin", "Tạm hoãn", "Đã gộp", "Đã hủy" (i18n/vi.yaml:4-14) | Giữ nguyên | RESIDENT | Trạng thái công khai — không lộ risk nội bộ |
| ResidentTicketView — public_message (blocker=MISSING_INFO) | "Ban tiếp nhận thông tin sẽ liên hệ bạn để bổ sung: {fields}. Bạn cũng có thể bổ sung ngay tại đây." (i18n/vi.yaml:31) | Giữ nguyên | RESIDENT | Khi MISSING_INFO blocker: ĐÚNG không lộ nội bộ |
| ResidentTicketView — public_message (blocker=ASSET_UNCLEAR) | "Đang xác minh thiết bị tại vị trí phản ánh." (i18n/vi.yaml:36) | Giữ nguyên | RESIDENT | Khi ASSET_UNCLEAR blocker: ĐÚNG không lộ nội bộ |
| **ResidentTicketView — public_message (safety Bậc 2)** | **KHÔNG TỒN TẠI** (chưa implement SAFETY_REVIEW_REQUIRED status) | Đề xuất: "Phản ánh của bạn đang được kiểm tra tính an toàn." (không lộ risk cụ thể) | RESIDENT | TARGET: safety Bậc 2 chưa có endpoint/status → BLOCKED |
| ResidentTicketView — allowed_actions | `ResidentAction = Literal["ADD_INFO", "RATE", "REPORT_NOT_DONE"]` (views.py:24); actions append khi: ADD_INFO nếu NEED_INFO (views.py:76), RATE nếu CLOSED + rating=null (views.py:79), REPORT_NOT_DONE nếu CLOSED + reopen_until chưa hết (views.py:81) | Sửa: CẤM RATE (rating-once target), CẤM REPORT_NOT_DONE (reopen cấm target) — giữ chỉ ADD_INFO | RESIDENT | TARGET BLOCKED: engine chưa guard rating ghi đè lần 2 → 409; chưa guard REPORT_NOT_DONE (reopen). Owner: Như Ý (engine) |
| ResidentTicketView — department_name | Chỉ `ticket.department_id` (phòng band thực tế), không `proposed_department_id` (views.py:60) | Giữ nguyên | RESIDENT | Phòng ban — đúng chỉ show phòng được chuyển |

**Kết luận WORD-01:** 
- 🔴 **BLOCKED:** Safety Bậc 2 + rating-once/reopen guards chưa implement
  - Safety Bậc 2: không có status/message/endpoint (chưa tích hợp engine)
  - Rating-once: views.py:79 ghi đè rating, không guard lần 2 → 409
  - Reopen cấm: views.py:81 vẫn cho phép REPORT_NOT_DONE action
  - Owner: Như Ý (engine chưa protect)

---

### WORD-02: BPTN

| Màn hình | Câu hiện tại (file:dòng) | Câu đề xuất | Role | Lý do |
|:---|:---|:---|:---|:---|
| blocker=MISSING_INFO → message | "Ban tiếp nhận thông tin sẽ liên hệ bạn để bổ sung: {fields}. Bạn cũng có thể bổ sung ngay tại đây." (i18n/vi.yaml:31) | Giữ nguyên | BPTN | MISSING_INFO workflow — ĐÚNG |
| POST /mo/tickets/{id}/bptn-resolve (MISSING_INFO) | Endpoint: `def bptn_resolve(...)` (src/api/routers/maintenance.py:431) body: `{"location":"...", "info":"...", "note":"..."}` | Giữ nguyên | BPTN | bptn-resolve MISSING_INFO — ĐÚNG ghi locked location/info rồi tiếp tục |
| blocker=ASSET_UNCLEAR → message | "Đang xác minh thiết bị tại vị trí phản ánh." (i18n/vi.yaml:36) | Giữ nguyên | BPTN | ASSET_UNCLEAR workflow — ĐÚNG |
| POST /mo/tickets/{id}/bptn-resolve (ASSET_UNCLEAR) | Endpoint: `def bptn_resolve(...)` (src/api/routers/maintenance.py:431) body: `{"asset_onsite":true, "note":"..."}` → flag ASSET_CHECK_ONSITE + ROUTED | Giữ nguyên | BPTN | bptn-resolve ASSET_UNCLEAR — ĐÚNG ghi onsite flag |
| **Bậc 2 safety (3 lựa chọn BPTN)** | **KHÔNG TỒN TẠI** (không có endpoint cho SAFETY_CONFIRM_SAFE, SAFETY_ESCALATE, SAFETY_NEED_INFO) | (a) BPTN confirm safe: audit + safety_cleared_by + RECEIVED → flow; (b) BPTN escalate: audit + EMERGENCY_PENDING_BQL; (c) BPTN need-info: NEED_INFO + safety_context=true | BPTN | TARGET BLOCKED: engine chưa có action, không endpoint (OPERATIONS.md §5.2), safety.py độc lập chưa nối |

**Kết luận WORD-02:**
- ✅ MISSING_INFO + ASSET_UNCLEAR: ĐÚNG
- 🔴 **BLOCKED:** Bậc 2 safety (confirm-safe, escalate, need-info) — chưa implement
  - Owner: Như Ý (engine + safety rules)

---

### WORD-03: DEPARTMENT (phòng ban)

| Màn hình | Câu hiện tại (file:dòng) | Câu đề xuất | Role | Lý do |
|:---|:---|:---|:---|:---|
| POST /mo/tickets/{id}/accept | Endpoint: `def accept(...)` (src/api/routers/maintenance.py:441), không body; ROUTED → IN_PROGRESS | Giữ nguyên | DEPARTMENT | accept — ĐÚNG, chỉ DEPARTMENT được phép |
| POST /mo/tickets/{id}/checklist/{item_id} | Endpoint: `def update_checklist(...)` (src/api/routers/maintenance.py:477) body: `{"status":"COMPLETED"/"IN_PROGRESS"/"SKIPPED", "note":"..."}` | Giữ nguyên (giữ IN_PROGRESS, cho DEPARTMENT cập nhật từng mục) | DEPARTMENT | Checklist — ĐÚNG, không auto-complete |
| POST /mo/tickets/{id}/materials/{code} | Endpoint: `def record_material(...)` (src/api/routers/maintenance.py:490) body: `{"issued_qty":N, "used_qty":N, "variance_reason":"..."}` | Giữ nguyên (engine tính variance ≥0 → IN_PROGRESS; warning được phép) | DEPARTMENT | Materials — ĐÚNG, ghi nhận cấp phát + sử dụng |
| POST /mo/tickets/{id}/evidence | Endpoint: `def add_evidence(...)` (src/api/routers/maintenance.py:502) body: `{"requirement_id":"...", "evidence_type":"...", "content_or_metadata":"...", "readability_status":"..."}` | Giữ nguyên (metadata hoặc nội dung, không raw ảnh cư dân) | DEPARTMENT | Evidence — ĐÚNG, ghi per template |
| POST /mo/tickets/{id}/photos | Endpoint: ở routes:506 (async add_execution_photos); local: metadata mô phỏng | Giữ nguyên (online: ảnh thực sau xác minh store) | DEPARTMENT | Photos — ĐÚNG local |
| POST /mo/tickets/{id}/complete | Endpoint: `def report_complete(...)` (src/api/routers/maintenance.py:535) IN_PROGRESS → READY_FOR_REVIEW, hoặc 409 nếu failing_items | Giữ nguyên (engine kiểm readiness bắt buộc) | DEPARTMENT | Complete — ĐÚNG, kiểm draft.readiness |

**Kết luận WORD-03:** 
- ✅ **PASS:** Workflow DEPARTMENT (accept, checklist, materials, evidence, photos, complete) ĐÚNG quyền, wording không hứa chức năng chưa có

---

### WORD-04: BQL

| Màn hình | Câu hiện tại (file:dòng) | Câu đề xuất | Role | Lý do |
|:---|:---|:---|:---|:---|
| GET /bql/tickets | Endpoint: `def bql_list(...)` (src/api/routers/maintenance.py:669); response `BqlTicketRow` (views.py:120) với chi tiết: status, blocker, flags, escalated, overdue, rework_count | Giữ nguyên (BQL thấy đầy đủ) | BQL | Dashboard — ĐÚNG, BQL thấy toàn bộ chi tiết để quyết định |
| POST /bql/tickets/{id}/close | Endpoint: `def bql_close(...)` (src/api/routers/maintenance.py:693); READY_FOR_REVIEW → CLOSED, note required | Giữ nguyên | BQL | Close — ĐÚNG, chỉ BQL được close |
| POST /bql/tickets/{id}/rework | Endpoint: `def bql_rework(...)` (src/api/routers/maintenance.py:699); READY_FOR_REVIEW → IN_PROGRESS + REWORK blocker, note required | Giữ nguyên | BQL | Rework — ĐÚNG, BQL quyền trả lại |
| POST /bql/tickets/{id}/cancel | Endpoint: `def bql_cancel(...)` (src/api/routers/maintenance.py:710); ANY → CANCELLED, cancel_reason required | Giữ nguyên | BQL | Cancel — ĐÚNG, chỉ BQL được hủy |
| **Bậc 1 khẩn cấp (4 lựa chọn BQL)** | **KHÔNG TỒN TẠI** (không có endpoint cho EMERGENCY_CLOSE, EMERGENCY_DOWNGRADE, EMERGENCY_MERGE, EMERGENCY_CANCEL) | (a) EMERGENCY_CLOSE: CLOSED + closure_kind=EMERGENCY_HANDLED; (b) EMERGENCY_DOWNGRADE: clearance + flow bảo trì; (c) EMERGENCY_MERGE: con MERGED, cha vẫn EMERGENCY_PENDING_BQL; (d) EMERGENCY_CANCEL: CANCELLED | BQL | TARGET BLOCKED: engine chưa có action, không endpoint (OPERATIONS.md §5.3), safety.py độc lập chưa nối |

**Kết luận WORD-04:**
- ✅ close/rework/cancel: ĐÚNG
- 🔴 **BLOCKED:** Bậc 1 khẩn cấp (EMERGENCY_CLOSE, EMERGENCY_DOWNGRADE, EMERGENCY_MERGE, EMERGENCY_CANCEL) — chưa implement
  - Owner: Như Ý/Châm Anh (engine + API)

---

## 3. Tóm hợp — Phần UI vs phần API

### Phần UI (wording, status_label, public_message)
✅ **ĐÚNG (baseline):**
- i18n/vi.yaml: 10 status_labels, 10 status_messages, 12 reason_messages (MISSING_INFO, ASSET_UNCLEAR, v.v.)
- views.py: ResidentTicketView allow-list — trường công khai

🔴 **TARGET CHƯA IMPLEMENT (chặn D3-05 kết luận):**
- Safety Bậc 2: SAFETY_REVIEW_REQUIRED status + public message "đang kiểm tra tính an toàn"
- Emergency Bậc 1: EMERGENCY_PENDING_BQL status + public message "đang xử lý khẩn cấp"
- Rating-once guard: RATE action chỉ cho lần 1, lần 2 → 409 (chưa có trong engine.py:548-553)
- Reopen cấm: REPORT_NOT_DONE action bị CẤM (views.py:81 vẫn có)

### Phần API (quyền, endpoint, response)
✅ **ĐÚNG (baseline):**
- RESIDENT: POST /resident/tickets, GET /resident/tickets/{id}, POST /additions, /photos, /rating
- BPTN: POST /mo/tickets/{id}/bptn-resolve (routes:431)
- DEPARTMENT: POST accept (441), checklist (477), materials (490), evidence (502), complete (535)
- BQL: GET /bql/tickets (669), POST close (693), rework (699), cancel (710)

🔴 **TARGET CHƯA IMPLEMENT:**
- SAFETY_CONFIRM_SAFE, SAFETY_ESCALATE, SAFETY_NEED_INFO endpoint (Bậc 2)
- EMERGENCY_CLOSE, EMERGENCY_DOWNGRADE, EMERGENCY_MERGE, EMERGENCY_CANCEL endpoint (Bậc 1)
- Rating-once guard: engine.rate() không check rating lần 2 → lần 2 ghi đè thay vì 409
- Reopen cấm: engine.reopen() vẫn hoạt động

---

## 4. Kết luận D3-05

### Kết quả: 4 record, phân loại PASS/BLOCKED

| task_id | actor_role | result | block_reason | issue_owner |
|:---|:---|:---|:---|:---|
| WORD-01 | RESIDENT | BLOCKED | Safety Bậc 2 (đang kiểm tra) + rating-once guard + reopen cấm chưa implement; engine chưa protect | Như Ý |
| WORD-02 | BPTN | BLOCKED | Bậc 2 safety (confirm-safe, escalate, need-info) chưa có endpoint/route/engine; baseline MISSING_INFO/ASSET_UNCLEAR ĐÚNG | Như Ý |
| WORD-03 | DEPARTMENT | PASS | Workflow accept/checklist/materials/evidence/photos/complete ĐÚNG quyền, không hứa chức năng chưa có | — |
| WORD-04 | BQL | BLOCKED | Bậc 1 khẩn cấp (EMERGENCY_CLOSE/DOWNGRADE/MERGE/CANCEL) chưa có endpoint/route/engine; baseline close/rework/cancel ĐÚNG | Như Ý/Châm Anh |

### Phần không làm (Out of scope D3-05)
- Runtime kiểm thử (D3-06 demo)
- Viết code hay sửa engine/API
- Implement safety Bậc 2 / Bậc 1 / rating-once / reopen cấm

---

## 5. Evidence files

Lưu tại `evidence/d3-05/`:
- `i18n-vi.txt` — status_labels, status_messages, reason_messages
- `blocker-structure.txt` — BPTN_REASONS, BlockerOwner, ReasonCode
- `routes-endpoints.txt` — API endpoints RESIDENT/BPTN/DEPARTMENT/BQL

---

## 6. Phán quyết

🔴 **WORD-01/02/04: BLOCKED** — safety Bậc 2, Bậc 1, rating-once, reopen cấm chưa implement  
✅ **WORD-03: PASS** — workflow DEPARTMENT ĐÚNG  
⛔ **D3-05 kết luận:** Wording baseline (WORD-03) PASS; safety + rating-once + reopen (WORD-01/02/04) BLOCKED chờ Như Ý/Châm Anh tích hợp engine

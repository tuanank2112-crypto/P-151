# Day03-bis D3-05 Wording & Permission Audit

**Observed at:** 2026-10-03T11:33:39+07:00  
**Branch:** feature/truong  
**Commit:** cd83f1148e256bb34b0b26d80c16ec7011acb3db (after merge origin/develop)  
**Environment:** Code review (no runtime, routes inspection only)  

---

## Summary

Re-audit of 4 roles (RESIDENT/BPTN/DEPARTMENT/BQL) after merge with origin/develop. Compared against day03 baseline (SHA 0ea04ad).

| Role | Màn hình | Câu hiện tại | Câu đề xuất | Status | Ghi chú |
|---|---|---|---|---|---|
| **WORD-01** | RESIDENT view | (công khai) "Đang được kiểm tra" + allow-list no internal risk | Giữ nguyên | **PASS** | Rating-once guard ✅ added; reopen blocks 409 ✅ fixed; safety wording present (depends on WORD-02 for Bậc 2 tickets) |
| **WORD-02 API** | BPTN route | (không có) 0 safety endpoints | Thêm: POST confirm-safe, POST escalate, POST need-info | **BLOCKED** | Engine logic ✅ exists (safety_confirm_safe, safety_escalate, safety_request_info) but NO routes wire them. SAFETY_REVIEW_REQUIRED blocker cannot be cleared. Owner: Như Ý |
| **WORD-03** | DEPARTMENT workflow | ✅ 6 endpoints present + guards | Giữ nguyên | **PASS** | accept, checklist, materials, evidence, photos, complete (unchanged from D-08) |
| **WORD-04 API** | BQL route | (không có) 0 emergency endpoints | Thêm: POST emergency-close, POST emergency-downgrade | **BLOCKED** | Engine logic exists but NO routes wire emergency_close/emergency_downgrade. EMERGENCY_PENDING_BQL state cannot be closed. Owner: Như Ý |

---

## Chi Tiết Từng Vai Trò

### WORD-01: RESIDENT (Cư dân)

**Phần UI đã rà:**
- ✅ Allow-list chính xác: ticket_id, created_at, description, additions, photos, status, status_label, department_name, public_message, eta, timeline, allowed_actions
- ❌ Không lộ: reason_code, internal_note, risk_level, priority, assignee_id

**Phần API / Quyền:**
- ✅ `safety_status_label: "Đang được kiểm tra"` (src/maintenance/i18n/vi.yaml:5) được gọi từ `_resident_status_label()` (views.py:102-103) khi blocker.code ∈ SAFETY_REASONS
- ✅ Rating-once guard: `engine.rate()` chạy kiểm `if ticket.rating is not None → GuardError` (day03 ghi đè, nay FIXED)
- ✅ Reopen blocker: `engine.reopen()` raises 409 INVALID_TRANSITION với message "a closed ticket is never reopened" (day03 route còn mở, nay FIXED)

**Kết luận:** PASS  
**Giải thích:** Lần này rating-once và reopen đã được guard. Wording an toàn (không lộ hazard level). Tuy nhiên, wording chỉ xuất hiện khi ticket có SAFETY_REVIEW_REQUIRED blocker, đó là nhiệm vụ của WORD-02 wire route để tạo ra blocker đó.

---

### WORD-02: BPTN — Bậc 2 Safety Workflow

**Phần UI đã rà:** (không có giao diện mới so với D-08)

**Phần API / Quyền:**
- ✅ Engine logic: `safety_confirm_safe()` (765), `safety_escalate()` (799), `safety_request_info()` (857) implemented
- ❌ Routes: không có endpoint `/confirm-safe`, `/escalate`, `/need-info` hoặc variant nào cho safety
- ❌ OpenAPI: scan 0 safety/escalate/hazard path trên bql_router

**Workflow yêu cầu CR-03 §6.4:**
1. BPTN nhận SAFETY_REVIEW_REQUIRED → 3 lựa chọn:
   - Xác nhận an toàn (safety_confirm_safe) → RECEIVED + flow thường
   - Nâng khẩn cấp (safety_escalate) → EMERGENCY_PENDING_BQL cho BQL
   - Yêu cầu bổ sung (T06) → NEED_INFO/safety_context

**Kết luận:** BLOCKED  
**Giải thích:** Engine implements 3 methods but routes don't expose them. BPTN không có cách gọi API để handle SAFETY_REVIEW_REQUIRED. Bước 2b (safety.assess) sẽ xác định Bậc 2, nhưng chế độ mock không nâng level tự động. Mỗi khi ticket nhận Bậc 2, phải có endpoint cho BPTN xử lý.

**Owner:** Như Ý (phù hợp endpoint + body với CONTRACTS, integration with engine)  
**Blocker tiêu chí:** Endpoint yêu cầu trước MVP 04/10

---

### WORD-03: DEPARTMENT — Execution Workflow

**Phần UI:** Giữ D-08 (không sửa route/permission)

**Phần API / Quyền:**
- ✅ 6 endpoints: accept (442), checklist (478), materials (491), evidence (503), photos (508), complete (536)
- ✅ Role guard: chỉ DEPARTMENT (kiểm tra via `_verify_department_access`)
- ✅ Workflow: accept ROUTED→IN_PROGRESS; checklist per-item; materials issued+used+variance_reason; evidence requirement-based; photos multipart; complete readiness check
- ✅ assignee_id: luôn null, không auto-assign

**Kết luận:** PASS  
**Giải thích:** Không thay đổi từ D-08. Toàn bộ 6 action được implement, guard đúng, wording không hứa chức năng chưa có.

---

### WORD-04: BQL — Bậc 1 Emergency + Normal Workflow

**Phần UI:** (không có giao diện mới)

**Phần API / Quyền:**
- ✅ Engine logic: `emergency_downgrade()`, `emergency_close()` + normal close/rework/cancel
- ❌ Routes: không có dedicated endpoint `/emergency-close`, `/emergency-downgrade`
- ✅ Normal endpoints: close (694) READY_FOR_REVIEW→CLOSED, rework (700), cancel (712)
- ❌ OpenAPI: scan 0 emergency path trên bql_router

**Workflow yêu cầu CR-03 §6.5 (MVP gate):**
1. EMERGENCY_PENDING_BQL → 2 lựa chọn BQL:
   - Đóng khẩn cấp (emergency_close) → CLOSED closure_kind=EMERGENCY_HANDLED
   - Báo nhầm (emergency_downgrade) → clearance ghi đúng, flow thường

2. (Post-MVP) follow-up, merge, cancel

**Kết luận:** BLOCKED  
**Giải thích:** Engine implements emergency_close/downgrade nhưng routes không expose chúng. Hiện /close endpoint (694) chỉ support READY_FOR_REVIEW source, không support EMERGENCY_PENDING_BQL. Khi ticket nhận Bậc 1 (từ WORD-02 escalate), BQL không có endpoint để close/downgrade nó.

**Owner:** Như Ý (phù hợp endpoint + body với CONTRACTS)  
**Blocker tiêu chí:** 2 endpoint (emergency-close MVP gate, emergency-downgrade MVP gate) yêu cầu trước 04/10

---

## Tổng Kết Thay Đổi So Với Day03 (SHA 0ea04ad)

| Case | Day03 | Day03-bis | Thay đổi |
|---|---|---|---|
| WORD-01 | BLOCKED (rating ghi đè, reopen mở, safety wording cần SAFETY_REVIEW_REQUIRED) | PASS | ✅ Rating-once guard added; ✅ Reopen blocks 409; ✅ Safety wording template ready (depends on WORD-02 for deployment) |
| WORD-02 | BLOCKED (0 safety routes) | BLOCKED | (không đổi) Engine methods tồn tại nhưng routes không wire; yêu cầu Như Ý implement 3 POST endpoints |
| WORD-03 | PASS | PASS | (không đổi) All 6 DEPARTMENT actions intact |
| WORD-04 | BLOCKED (0 emergency routes) | BLOCKED | (không đổi) Engine methods partially exist but routes don't expose; yêu cầu Như Ý implement 2 MVP POST endpoints |

---

## Điều Kiện Trước Nghiệm Thu Online 04/10

Trước khi chạy 4 demo online:

1. ✅ **WORD-01 đạt** (resident wording + rating-once guard + reopen block): PASS day03-bis
2. ⬜ **WORD-02 implement** (BPTN safety routes): Như Ý cần 3 POST endpoints (confirm-safe, escalate, need-info) + CONTRACTS
3. ✅ **WORD-03 đạt** (DEPARTMENT 6 actions): PASS unchanged
4. ⬜ **WORD-04 implement** (BQL emergency routes): Như Ý cần 2 POST endpoints (emergency-close, emergency-downgrade) + CONTRACTS

Safety Bậc 2/Bậc 1 (DEMO-04) vẫn chặn vì WORD-02/WORD-04. Khi hai route được implement thì DEMO-04 có thể chạy lại (hiện BLOCKED).

---

## Đường Dẫn Evidence

- `evidence/bis/wording/word01-resident-safety.txt` — detail RESIDENT allow-list + rating/reopen/wording
- `evidence/bis/wording/word02-bptn-safety-endpoints.txt` — detail BPTN 3 safety methods + missing routes
- `evidence/bis/wording/word03-department-routes.txt` — detail DEPARTMENT 6 endpoints + role guards
- `evidence/bis/wording/word04-bql-emergency-endpoints.txt` — detail BQL emergency methods + missing routes

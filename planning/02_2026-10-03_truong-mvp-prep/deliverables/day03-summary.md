# Day 03 Kiểm Tra Tổng Hợp (D3-01..D3-07)

**Observed at:** 2026-10-03T11:15:55+07:00  
**Branch:** feature/truong  
**Commit:** 0ea04adedd023654947e2e97e645043f0ba89159  
**Environment:** local (memory store, mock LLM, local photos)  
**Base URL:** null (not bound)  

---

## Tóm Tắt Kết Quả

| Phiên bản | Giá trị |
| :--- | :--- |
| Dataset | maintenanceops-sim-v1.2 (12 fixture tickets) |
| LLM Mode | mock |
| MO_STORE | memory |
| MO_PHOTO_STORE | local |
| APP_ENV | development |
| MO_ALLOW_RESET | false |

### Thống Kê Kiểm Tra

**Tổng Record:** 23  
**PASS:** 17  
**FAIL:** 1  
**BLOCKED:** 5  
**NOT_RUN:** 0  

---

## Bảng Trạng Thái 7 Task

Cột Status = đã lập đủ báo cáo/record (✅) hoặc có record chưa đạt (⚠️); cột Kiểm Thử Đạt mới nói chức năng có đạt hay không. Kết quả đều trên local cô lập, KHÔNG phải nghiệm thu runtime/online.

| Task | Mô Tả | Status | Báo Cáo | Kiểm Thử Đạt | Lưu Ý |
| :--- | :--- | :--- | :--- | :--- | :--- |
| D3-01 | Chuẩn bị manifest | ✅ | R06 | N/A (setup) | Hub missing (Bước 0 exit 1) |
| D3-02 | Kiểm tra asset | ✅ | R07 | ASSET-01..03 PASS | 3/3 case đạt |
| D3-03 | Kiểm tra vật tư | ✅ | R08 | STOCK-01..04 PASS | 4/4 case đạt; resume_step 6 (docstring nói 7) |
| D3-04 | Kiểm tra trùng | ✅ | R09 | DUP-01..04 PASS | 4/4 case đạt |
| D3-05 | Rà wording & quyền | ⚠️ | R10 | WORD-03 PASS; WORD-01/02/04 BLOCKED | 1/4 case đạt; safety Bậc 2 + reopen chưa tích hợp |
| D3-06 | Chạy thử 4 script | ⚠️ | R11 | 8 record: 5 PASS, 1 FAIL, 2 BLOCKED | DEMO-01-RATING overwrite rating (lỗi), DEMO-04-* safety (chưa tích hợp) |
| D3-07 | Tổng hợp & bàn giao | ✅ | R12 | (báo cáo này) | Lệnh counts.txt/consistency.txt đã chạy thành công |

---

## Danh Sách Lỗi Theo Owner

### Như Ý (Engine / State Machine)

**DEMO-01-RATING:** Rating overwrite (FAIL)
- Case: `src/maintenance/engine.py:548-553` ghi đè ticket.rating thay vì reject lần thứ 2
- Bước tái hiện: POST /resident/tickets/{id}/rating {score:5}, sau đó {score:1}
- Expected: 409 lần thứ 2
- Actual: 200, rating đã thay đổi từ 5 → 1, audit RATE_TICKET x2
- Evidence: evidence/d3-06/g1r.txt + g1r-exit.txt
- Mức độ: Lỗi chức năng, ảnh hưởng acceptance gate

**WORD-01:** Safety Bậc 2 wording (BLOCKED)
- Thiếu: SAFETY_REVIEW_REQUIRED status, public_message trong vi.yaml, rating-once guard ở views/engine
- Evidence: evidence/d3-05/i18n-vi.txt + routes-endpoints.txt
- Mức độ: Chức năng chưa tích hợp

**WORD-02:** BPTN endpoint Bậc 2 (BLOCKED)
- Thiếu: Route confirm-safe, escalate, need-info với BPTN chỉ định
- Evidence: evidence/d3-05/blocker-structure.txt + routes-endpoints.txt
- Mức độ: Chức năng chưa tích hợp

**DEMO-04-SAFETY-TIER2:** Tier 2 safety demo (BLOCKED)
- Thiếu: SAFETY_REVIEW_REQUIRED status, endpoint, engine action
- OpenAPI scan: 0 safety/emergency/hazard path
- engine.py không reference safety.py (standalone)
- Evidence: evidence/d3-06/g4a.txt + git-head.txt
- Mức độ: Chức năng chưa tích hợp, no target endpoints defined

**DEMO-04-SAFETY-TIER1:** Tier 1 safety demo (BLOCKED)
- Thiếu: EMERGENCY_PENDING_BQL status, BQL decision endpoints
- Baseline: VERIFYING/OUT_OF_SCOPE, không escalate
- Evidence: evidence/d3-06/g4b.txt + g4a.txt
- Mức độ: Chức năng chưa tích hợp

### Châm Anh (API / Storage / Persistence)

**Chú ý:** STOCK-03 docstring vs code drift
- API docstring (`src/api/routers/maintenance.py:550`): "resume_step=7"
- Actual code (`src/maintenance/engine.py:1587, 1922`): resume_step=6
- Tác động: Chỉ là observation (behavior đúng); đã ghi vào evidence/d3-03/s03.txt

### Trí (UI / UX)

**Chú ý:** WORD-01/02/04 wording requirement
- Đang kiểm tra tính an toàn → public message chưa có
- Prevent REPORT_NOT_DONE action → views.py:81 vẫn append
- Mức độ: Tùy theo timeline tích hợp Bậc 2/Bậc 1

### Trường (Dữ liệu / Nghiệp Vụ)

Không có FAIL thuộc Trường. Mục cần Trường/người quyết nằm ở "Câu hỏi cần người quyết" bên dưới (ASSET-03, STOCK-04, owner reopen).

---

## Điều Kiện Trước Nghiệm Thu Online (04/10)

Các item PHẢI xong trước khi online MVP chạy trên `04/10`:

1. **Engine Rating:** Fix DEMO-01-RATING (guard 409 lần 2) — Như Ý
   - Điểm chốt: `engine.rate()` không ghi đè, return 409 nếu rating đã có
   - Evidence cần có sau fix: chạy lại DEMO-01-RATING (lần 2 → 409, rating giữ 5, không thêm audit RATE_TICKET)

2. **Safety Bậc 2 & Bậc 1:** Implement safety integration — Như Ý
   - 3 BPTN endpoint (confirm-safe, escalate, need-info) + engine action
   - BQL endpoint (emergency-close, emergency-downgrade, ...)
   - Trạng thái SAFETY_REVIEW_REQUIRED & EMERGENCY_PENDING_BQL
   - Wording công khai "đang kiểm tra tính an toàn"
   - Gate: DEMO-04-SAFETY-TIER2/TIER1 → PASS

3. **Prevent Reopen:** Guard reopen endpoint (ngăn cư dân mở lại) — Như Ý/Trí
   - Route POST /resident/tickets/{id}/reopen vẫn hoạt động (chưa guard)
   - Hiện hành: route reopen và action REPORT_NOT_DONE (views.py:80-81) vẫn có; hành vi đích do người quyết (CR03 ghi cấm reopen)
   - Gate: chưa có record kiểm riêng; cần bổ sung ca khi owner chốt hướng

4. **Bước 0 Hub:** Khả dụng — Người xây dựng hub
   - Brain engine not available locally (../brain4agent.release/ missing)
   - Lỗi không blocking tiếp tục, nhưng tự động sync được cảnh báo

5. **Persistence Restart Gate:** Chưa đạt 03/10 (gate 04/10 không thay đổi)
   - Requirement: Ticket phải survive reboot + re-seed
   - Status: Not tested day 03 (online target, not local)
   - Action: Châm Anh chuẩn bị test online, không trong phạm vi D3-07

6. **Script Chạy Được:**
   - DEMO-01A/B (happy path, tới BQL CLOSED): ✅ PASS
   - DEMO-02-NEED-INFO/ASSET-UNCLEAR: ✅ PASS
   - DEMO-03-STOCK: ✅ PASS
   - DEMO-04-*: ❌ BLOCKED (chưa tích hợp)

---

## Phần Mô Phỏng & Khác

- **Fixture Date:** 2026-09-27 (12 tickets, 8 roles cố định)
- **Simulated Time:** Thời điểm mô phỏng trong payload (VD: 2026-10-05, 2026-10-06) khác với machine time (2026-10-03)
- **Stock Re-run:** Receipt kho tự động trigger LOOKUP_ASSET → CHECK_MATERIAL_STOCK → CREATE_DRAFT (step 6 không phải 7)
- **Duplicate Window:** 48 giờ (cố định), không thực tế

---

## Nhu Cầu Bản Online

**Gate Online 04/10 (không đổi): chưa gate nào đạt trên online.** Kết quả local chỉ cho biết kịch bản tái hiện được:
1. Asset, stock, trùng cơ bản: PASS local; online CHƯA chạy.
2. Safety (DEMO-04): BLOCKED local (chưa tích hợp, owner Như Ý); online chưa thể chạy.
3. Rating-once: FAIL local (Như Ý).
4. Persistence restart + bản online/UI: chưa đo.

**Bàn Giao Ngày 04/10:**
- Người chạy: QA / Như Ý / Châm Anh (tùy role)
- Thao tác: 4 demo group (group 4 chờ fix)
- Đối chiếu: expected vs actual on online env

---

## Câu hỏi cần người quyết (không tự đổi contract)

1. ASSET-03: SPEC §3 D3-02 ghi "BPTN bổ sung asset hợp lệ", OPERATIONS §3.2.2 ghi `asset_onsite`. Worker dùng OPERATIONS. Thêm ca chọn `asset_id` thật, hay sửa chữ SPEC?
2. STOCK-04 (D-05): code chỉ đặt cờ `STOCK_CHECK_ON_ACCEPT` (engine.py:1916-1919), `accept` không xử lý (engine.py:709-711). Chờ quyết cờ đặt là đủ hay engine phải kiểm khi nhận việc.
3. Owner reopen/rating-once: engine → Như Ý (đề xuất); route reopen có thể cần Châm Anh. Cần xác nhận.
4. Hub `../brain4agent.release` thiếu (Bước 0 exit 1): cần người dựng hub, không thuộc 4 owner.
5. Timestamp quyết định BPTN dùng đồng hồ máy chứ không theo giờ mô phỏng (quan sát D3-04): hỏi Như Ý có chủ ý không.

## Tham Chiếu

- Records: `deliverables/day03-results.json` (23 record)
- Evidence: `evidence/d3-0{2..6}/*` + evidence/d3-07/ (counts, consistency)
- Handoff gốc: `handoffs/H06..H11_day03-*.md`
- Reports: `reports/R06..R11_day03-*.md` + R12_day03-summary.md (báo cáo này)
- SPEC: `specs/SPEC-P06-DAY03.md` (§2, §3, §5)

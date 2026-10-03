Worker · thi công · Haiku · Bước 0 exit 1 (hub không tồn tại) · D3-05 audit WORD-02/04 ter
Handoff: ../handoffs/H17_day03ter-wording.md
Base: 92649a6152737154cca606f3ce94d3f0ec0e0273
Head: 92649a6152737154cca606f3ce94d3f0ec0e0273 (không commit)

## Kết quả Từng Record

| Case | Status | Chi tiết |
|---|---|---|
| **WORD-02** | PASS | Route POST /mo/tickets/{id}/safety + 3 UI choice (Xác nhận an toàn / Yêu cầu bổ sung / Nâng khẩn cấp) + i18n Vietnamese đầy đủ; không hứa tính năng chưa có |
| **WORD-04** | FAIL | 2 route /emergency/close,downgrade tồn tại ✓ BUT UI close action (app.js:1239-1241) fallback logic sai: chain /emergency/close → /emergency-close → /bql/tickets/{id}/close (generic endpoint); generic close không support EMERGENCY_PENDING_BQL (docstring "READY_FOR_REVIEW→CLOSED only"); downgrade action OK |

**Tổng: 1/2 PASS, 1/2 FAIL, 0 BLOCKED**

## So sánh Day03-bis vs Day03-ter

| Case | Day03-bis | Day03-ter | Thay đổi |
|---|---|---|---|
| WORD-02 | BLOCKED (0 route) | PASS | ✅ Route implement, wording đầy đủ |
| WORD-04 | BLOCKED (0 route) | FAIL | ⚠️ Route implement nhưng UI fallback logic sai (close action gọi generic endpoint không support emergency) |

## Bảng Phân Công Thực Tế

| Gói | Tầng spec | Tầng thực | Model | Ghi chú |
|---|---|---|---|---|
| WORD-02 route + UI | 🟠 | 🟢 | Haiku | Code review, no runtime. Routes + wording OK PASS |
| WORD-04 route + UI | 🟠 | 🟢 | Haiku | Code review, fallback logic cần sửa FAIL |

## Lỗi Chi Tiết

**WORD-04 Close Action — Fallback Logic:**
- **Nút UI (app.js:1236):** "Đã xử lý, đóng khẩn cấp"
- **Hứa:** Đóng ticket khẩn cấp (EMERGENCY_PENDING_BQL → CLOSED, closure_kind=EMERGENCY_HANDLED)
- **Thực (line 1239-1241):**
  ```javascript
  api(/bql/tickets/${id}/emergency/close) 
    .catch(() => api(/bql/tickets/${id}/emergency-close))
    .catch(() => api(/bql/tickets/${id}/close))  // ← GENERIC, không support emergency
  ```
- **Generic endpoint (src/api/routers/maintenance.py:694):**
  - Docstring: "Nghiệm thu: READY_FOR_REVIEW → CLOSED. Chỉ BQL."
  - Gọi: `engine.close()` (không phải `emergency_close()`)
  - Không set: `closure_kind=EMERGENCY_HANDLED`
- **Kết quả:** Nút hứa nhưng fallback fail sẽ không work đúng
- **Owner:** Trí (UI fallback logic)
- **Fix:** Bỏ fallback sang generic close, hoặc thêm guard fail-fast

**WORD-04 Downgrade Action — OK:**
- Nút (1246-1252): "Báo nhầm, hạ xuống BPTN"
- Gọi: /bql/tickets/{id}/emergency/downgrade ✓
- Fallback bptn-resolve hợp lý

## Việc KHÔNG Làm & Lý Do

1. **Chạy runtime/demo:** Handoff scope là code review, không chạy server (§1.5)
2. **Kiểm full permission matrix:** Scope D3-05 là wording + route tồn tại, không đo control layer
3. **Sửa code:** Worker role là đọc/audit, không sửa src/

## Câu Hỏi Mở

**Không có.** Lỗi WORD-04 rõ ràng: UI fallback logic sai, fallback sang generic endpoint không support emergency.

## Root đo lại (2026-10-03)

Sau 🔁 lần 1: JSON đúng schema 11 khoá, report đúng dòng 1–4, evidence tồn tại. Root đối chiếu app.js:1239-1241 (fallback đóng khẩn cấp về /bql/tickets/{id}/close) khớp; root bổ sung vào actual WORD-04 rằng backend generic close trả 200 với ticket khẩn cấp (H16 tgen.txt) vì chữ 'chỉ READY_FOR_REVIEW' của worker không khớp số đo. WORD-02 PASS, WORD-04 FAIL owner Trí (+ Như Ý backend).

✅ DUYỆT (Day03-ter wording: 1 PASS, 1 FAIL có owner; không khẳng định UI render/quyền API đạt)

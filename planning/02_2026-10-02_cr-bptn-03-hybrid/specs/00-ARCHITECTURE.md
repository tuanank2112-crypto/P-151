# 00 — Kiến trúc và bất biến (kế hoạch 02)

## 1. Nguồn chân lý (thứ tự ưu tiên)

1. Biểu đồ swimlane người dùng chốt 2026-10-01 (Cư dân / Hệ thống / Agent / BPTN / Phòng ban / BQL).
2. [`docs/CR-BPTN-03.md`](../../../docs/CR-BPTN-03.md) — spec đích. Bộ SPEC này CHỈ TRỎ số mục CR-03, không chép lại.
3. Code hiện tại (`b941d7e`) cho mọi điều CR-03 ghi `[GIỮ]`.

## 2. Mục tiêu

- Bước 3b tầng an toàn cho MỌI ticket (CR-03 §5.1, §6): Bậc 1 → `VERIFYING`/`EMERGENCY_PENDING_BQL` chủ BQL; Bậc 2 → `VERIFYING`/`SAFETY_REVIEW_REQUIRED` chủ BPTN.
- `priority` 3 mức theo luật PRI-* (CR-03 §7), sắp xếp danh sách BPTN/BQL/phòng ban.
- Gộp an toàn: liên kết hai chiều, nối bổ sung, hoàn tác gộp, hủy gốc trả ticket con về `RECEIVED` (CR-03 §8).
- Phòng ban báo sai phòng ban sau khi làm (T16) và BQL quyết (T17/E02) (CR-03 §9.3).
- Bỏ reopen; rating một lần (CR-03 §4.3, §11).

## 3. Non-goals

- Không thêm trạng thái mới (10 trạng thái giữ nguyên, CR-03 §3.1).
- Không phân tích ảnh bằng AI; không chatbot; không gán nhân viên bởi Agent.
- Không đổi schema Postgres (`maintops.cases.doc` JSONB đủ chứa field mới).

## 4. Bất biến (phải có test — xem TESTING-ACCEPTANCE)

| ID | Bất biến | Nguồn |
|---|---|---|
| I-1 | Chỉ BQL đóng/hủy; `MERGED` chỉ BPTN (DUPLICATE) hoặc BQL (EMERGENCY) | CR-03 §4.4.1 |
| I-2 | Agent không ghi `assignee_id` | §4.4.2 |
| I-3 | `ROUTED` chỉ khi `can_route` (thêm `risk_level != EMERGENCY`) | §4.4.3, §5.3 |
| I-4 | `resume()`/job KHÔNG BAO GIỜ gỡ `EMERGENCY_PENDING_BQL` | §4.4.4 |
| I-5 | BPTN thao tác lên blocker chủ BQL ⇒ `ACTION_DENIED` + audit | §4.4.5 |
| I-6 | `CLOSED` cần `department_id`, trừ `closure_kind=EMERGENCY_HANDLED` | §4.4.6 |
| I-7 | Raw bất biến; mỗi đổi trạng thái đúng một `StatusEvent` | §4.4.7 |
| I-8 | LLM chỉ nâng mức tín hiệu, không hạ | §6.1.1 |
| I-9 | Ghi lên ticket thứ hai (gốc khi gộp/hủy) nằm trong CÙNG transaction | quyết định 2026-10-02 |

## 5. Vùng cấm (đã cân nhắc, KHÔNG làm)

| Không làm | Lý do |
|---|---|
| Thêm trạng thái `EMERGENCY` | CR-03 §3.1 chốt 10 trạng thái; khẩn cấp là blocker |
| Để LLM hạ `PRESENT` → `ABSENT` | CR-03 §6.1.1 — bỏ sót Bậc 1 là lỗi nghiêm trọng nhất |
| Coi "bóng đèn cháy/hỏng/nhấp nháy" đứng riêng là Bậc 2 | CR-03 B-01, D-04: làm nghẽn BPTN |
| Ticket khẩn cấp tự gộp ở bước 4 | §8.6: chỉ liên kết, BQL gộp tay |
| Tự coi an toàn khi cư dân không trả lời | §6.4: leo thang BQL, không tự an toàn |
| Đổi tên `Case.not_duplicate_of` | Dữ liệu đã lưu trên Supabase |
| Hardcode ngưỡng thời gian/đếm | CR-03 §0.3 — để trong `sla_config` |

## 6. Drift so với CR-03 (ghi rõ, không âm thầm)

| CR-03 | Code | Lý do |
|---|---|---|
| §12.1 `duplicate_rejected_of[]` trên Ticket | `Case.not_duplicate_of` | Tương thích dữ liệu cũ |
| §14 "cập nhật `BPTN_REASONS` (+`SAFETY_REVIEW_REQUIRED`)" | `BPTN_REASONS` giữ nghĩa "gỡ bằng `bptn_resolve`"; `SAFETY_REVIEW_REQUIRED` chủ BPTN qua `BLOCKER_OWNERS`, gỡ bằng 3 hành động riêng | §6.4 "đúng 3 lựa chọn" |
| §8 nối "text và ảnh bổ sung" khi gộp | Nối `additions` + ảnh cư dân của ticket con, KHÔNG nối mô tả gốc | Mô tả gốc ticket con giữ nguyên ở ticket con; nối vào gốc sẽ đổi nội dung Agent đọc trên ticket đã giao |

## 7. Thứ tự đọc cho người thi công

00 → 01 → SPEC-P01 → SPEC-P02 → SPEC-P03 → OPERATIONS → TESTING-ACCEPTANCE.

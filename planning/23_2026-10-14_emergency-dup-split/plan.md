# 23 — Khẩn cấp gặp trùng, hai việc, và ticket thường cùng chỗ

## Metadata
- Trạng thái: 🟠 ĐANG THI CÔNG (người dùng duyệt hướng 2026-10-14).
- Người yêu cầu: Như Ý ("case khẩn cấp … bị trùng hoặc 2 phòng ban").
- Nhánh: `feature/nhuy-reasoning-agent`. Base: `fc434d6` (develop). Phiên bản đích: **1.16.0** (MINOR — hành vi mới, API cộng thêm, không phá contract cũ).
- Không ghi Supabase chung, không deploy. Push/PR chỉ khi người dùng bảo.

## Bảng trỏ SPEC
| File | Nội dung |
|---|---|
| [specs/00-ARCHITECTURE.md](specs/00-ARCHITECTURE.md) | Vấn đề đo được, mục tiêu, bất biến, vùng cấm |
| [specs/01-CONTRACTS.md](specs/01-CONTRACTS.md) | Trường dữ liệu, hàm engine, endpoint mới, lỗi |
| [specs/SPEC-P01-EMERGENCY-DUPLICATE.md](specs/SPEC-P01-EMERGENCY-DUPLICATE.md) | Khẩn cấp nghi trùng: đánh dấu, đếm, BQL gộp |
| [specs/SPEC-P02-SPLIT-AFTER-CLEAR.md](specs/SPEC-P02-SPLIT-AFTER-CLEAR.md) | Tách hai việc sau khi BQL/BPTN gỡ an toàn |
| [specs/SPEC-P03-HOLD-SAME-KIND.md](specs/SPEC-P03-HOLD-SAME-KIND.md) | Giữ ticket thường cùng chỗ, cùng loại việc với khẩn cấp đang mở |
| [specs/SPEC-P04-AGENT-READS-EMERGENCY.md](specs/SPEC-P04-AGENT-READS-EMERGENCY.md) | Agent đọc cả ca khẩn cấp do luật bắt (E05) |
| [specs/OPERATIONS.md](specs/OPERATIONS.md) | Thứ tự thi công, rollback |
| [specs/TESTING-ACCEPTANCE.md](specs/TESTING-ACCEPTANCE.md) | Ma trận test, phép phá, Exit Gates |

## Nhật ký quyết định
- 2026-10-14 E01 (người dùng duyệt đề xuất agent, 3 mục):
  1. Khẩn cấp trùng: ca sau VẪN tới BQL; đánh dấu "nghi trùng với ca X" + ca gốc tăng "N người cùng báo"; BQL gộp bằng một nút; không tự gộp.
  2. Khẩn cấp hai việc: BQL/BPTN gỡ an toàn ⇒ cho tách; ticket con thừa hưởng mốc gỡ an toàn.
  3. Ticket thường cùng chỗ + cùng loại việc với khẩn cấp đang mở ⇒ giữ chờ BQL; khác loại ⇒ giao bình thường.
- 2026-10-14 E02 (agent): "cùng loại việc" của ca khẩn cấp = loại người ghim > job hợp lệ trong quyết định Agent đã lưu > (chỉ khi Agent chưa từng đọc ca đó) loại luật đọc được từ chữ, không ghi gì > không biết ⇒ GIỮ. Lý do bước luật: luật ra EMERGENCY thì Agent bị bỏ qua, nếu coi mọi ca đó là "không biết" thì ticket khác loại cũng bị giữ, trái ý người dùng (đo được: fixture CLN-004 chất lỏng lạ giữ đèn TEC-002). Không đè quyết định LLM nào (Q30).
- 2026-10-14 E03 (agent): thêm endpoint `POST /bql/tickets/{id}/emergency/merge` — engine `bql_merge` có từ plan 06 nhưng chưa có route nên BQL không gộp được trên UI.

- 2026-10-14 E04 (agent, sau R01 🔁): sửa F2–F12 như [reports/R01](reports/R01_isolated-review.md) mục "Xử lý". F1 (E02 đoán loại bằng từ khoá) mở lại — chờ người dùng.

- 2026-10-15 E05 (người dùng: "cho agent toàn bộ quyền suy nghĩ để xem xét", trả lời Q-E1): bỏ hẳn đoán loại bằng từ khoá; Agent đọc CẢ ca khẩn cấp do luật bắt, chạy nền sau khi BQL đã được báo ([SPEC-P04](specs/SPEC-P04-AGENT-READS-EMERGENCY.md)). Chưa ai đọc ⇒ không giữ, chỉ liên kết. Fixture DEMO-4 không đổi (chế độ không LLM không giữ).

### Quyết định bị thay thế
- E02 (đoán loại ca khẩn cấp do luật bằng `category_evidence`) ⇒ THAY bởi E05 (Agent đọc). Lý do: R01 F1 + người dùng.
- Plan 06 SPEC-P01 mục 9 "luật ra EMERGENCY ⇒ không hỏi mô hình" ⇒ vẫn đúng LÚC TẠO ca; mô hình được hỏi ngay sau đó (E05).
- Plan 01 Q11 "Ticket Bậc 1: bước 4 chỉ liên kết, không gộp" ⇒ GIỮ "không tự gộp", THÊM đánh dấu nghi trùng + đếm (E01.1).
- Plan 06 SPEC-P05 §3 điều kiện 4 "`safety_cleared_at is None`" ⇒ bỏ vế này; còn `risk_level == NONE` (E01.2).
- Plan 06 SPEC-P07 / catalog Q18 `hold_near_open_emergency: false` "chỉ liên kết" ⇒ cờ giữ nghĩa "giữ MỌI ticket cùng chỗ"; khi tắt vẫn giữ ticket cùng loại/không rõ loại (E01.3, E02).

## Work Packages
| WP | Việc | Tầng |
|---|---|---|
| E1 | Engine P01 + route merge + test | 🟠 |
| E2 | Engine P02 + test (sửa S-03 theo quyết định mới) | 🟠 |
| E3 | Engine P03 + test | 🟠 |
| E4 | Portal BQL: nhãn nghi trùng + nút gộp; nhãn chờ khẩn cấp | 🟠 |
| E5 | Thẩm định cô lập (agent khác, chỉ đọc) | 🔴 |

## Checklist thực thi
- [x] E1 P01 engine + route + test
- [x] E2 P02 engine + test
- [x] E3 P03 engine + test
- [x] E6 P04 Agent đọc ca khẩn cấp + test
- [x] E4 portal
- [x] Cổng: pytest 3684 passed/0 fail; ruff file đã sửa 0; portal typecheck 0, vitest 159 (lint còn 1 lỗi có sẵn ở management-overview-chart.tsx)
- [x] E5 thẩm định (R01 🔁 ⇒ sửa; R02 🔁 F-A ⇒ sửa; 13/13 phép phá đỏ)
- [x] Đồng bộ não 6 điểm + docs/maintenance.md + version (gộp 1.17.0 cùng hồ sơ 24)

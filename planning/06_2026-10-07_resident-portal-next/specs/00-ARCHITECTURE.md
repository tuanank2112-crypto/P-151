# 00 — Kiến trúc: Cổng phản ánh cư dân (Next.js)

## 1. Mục tiêu
Dựng website thật từ bộ thiết kế `design-ticket-cu-dan/design-ticket-cu-dan/` (`HANDOFF.md` + 6 file `design/*.dc.html`):
đăng nhập theo vai trò → 5 dashboard (Cư dân, Ban tiếp nhận, Ban quản lý, Phòng vệ sinh, Phòng kỹ thuật) dùng CHUNG một
PostgreSQL. Giao diện và hành vi bám đúng file `.dc.html` tương ứng; chỗ lệch có chủ đích ghi ở §5.

## 2. Non-goals
- KHÔNG nối với engine Python `src/maintenance/` (CR-BPTN-03). Đây là sản phẩm/prototype riêng theo HANDOFF; Agent ở đây là khớp từ khóa.
- KHÔNG gọi LLM. Đầu ra Agent giữ đúng contract `{ dept, confidence, keywords, urgent, locationFromText }` để sau này thay bằng LLM.
- KHÔNG đăng thông báo, KHÔNG sửa ma trận phân quyền từ UI (thiết kế chỉ hiển thị).
- KHÔNG deploy production trong đợt này.

## 3. Bất biến kiến trúc
| # | Bất biến |
|---|---|
| A1 | App nằm trọn trong `portal/` (Next.js 16 App Router, TypeScript strict, Tailwind v4, Drizzle ORM + `pg`). Không file nào của app nằm ngoài `portal/`. |
| A2 | Xác thực & phân quyền CHỈ ở máy chủ: session cookie `httpOnly` ↔ bảng `sessions` (lưu SHA-256 của token). Mọi Server Action và Route Handler tự đọc session, tự kiểm vai trò + phạm vi ticket. Frontend không chứa mật khẩu/tài khoản. |
| A3 | Mọi đổi trạng thái ticket đi qua `src/server/workflow.ts` (hàm thuần theo `(db, actor, input)`), trong MỘT transaction, UPDATE có điều kiện `stage = <mong đợi>` (chống ghi đè đồng thời) và luôn ghi một dòng `history`. |
| A4 | Phân loại Agent là hàm thuần `classify()` ở `src/lib/agent.ts`, dùng chung client (xem trước) và server (nguồn chân lý khi lưu). Từ khóa đọc từ bảng `keywords` (Ban tiếp nhận sửa được). |
| A5 | Ma trận quyền là MỘT hằng `PERMISSIONS` ở `src/lib/permissions.ts`: vừa để kiểm quyền, vừa để vẽ bảng "Phân quyền" của BQL. |
| A6 | `cacheComponents` bật (mặc định của 16.4): phần đọc session/DB nằm trong `<Suspense>`; khung tĩnh (đầu trang gradient + skeleton) prerender. |
| A7 | Thời gian lưu `timestamptz`, hiển thị theo `Asia/Ho_Chi_Minh`. Hạn xử lý: khẩn cấp 4 giờ, thông thường 48 giờ, tính từ `created_at`, dừng khi phòng ban báo xong (stage ≥ 5). |

## 4. Thứ tự đọc
`01-CONTRACTS.md` (schema, stage, action, lỗi) → `SPEC-P01-DATA-AUTH.md` → `SPEC-P02-SCREENS.md` → `OPERATIONS.md` → `TESTING-ACCEPTANCE.md`.

## 5. Lệch có chủ đích so với thiết kế (vùng cấm — KHÔNG "sửa lại cho giống")
| # | Thiết kế | Bản thật | Lý do |
|---|---|---|---|
| D1 | Màn đăng nhập hiện "Vai trò: …" ngay khi gõ tên; lỗi phân biệt "Tài khoản không tồn tại" / "Mật khẩu không đúng" | Không hiện vai trò trước khi đăng nhập; lỗi chung "Tên đăng nhập hoặc mật khẩu không đúng." | Chống dò tài khoản (user enumeration). HANDOFF: xác thực ở máy chủ. |
| D2 | Mỗi file có mô hình trạng thái riêng (`moi/da_chuyen/…`, stage 1..6) | Một mô hình `stage 1..6` + cờ (01-CONTRACTS §2); mỗi dashboard ánh xạ sang nhãn của nó | Một DB dùng chung cho mọi vai trò |
| D3 | Giao tổ/kỹ thuật viên ⇒ `dang_xu_ly` | Giao ⇒ stage 4 + lịch sử "Phân công" (bước 3 hoàn tất qua sự kiện) | Giữ đúng nút của thiết kế phòng ban, không thêm bước bấm |
| D4 | Agent cư dân dùng nhóm `CATS` (nhãn "Điện, chiếu sáng"…), Ban tiếp nhận dùng `rules` theo phòng ban, công thức tin cậy khác nhau, không khớp ⇒ BQL 38% | Một bộ từ khóa theo phòng ban (hợp nhất hai danh sách), công thức của Ban tiếp nhận, so khớp nguyên từ; không khớp ⇒ `dept = null`, 0% ("Chưa rõ") | Một nguồn từ khóa mà Ban tiếp nhận sửa được; không bịa gợi ý; chuỗi con khớp nhầm ("ồn" ⊂ "cộng đồng") |
| D5 | Kỹ thuật "Yêu cầu vật tư" dùng tên vật tư cứng trong dữ liệu mẫu | Bấm ⇒ ô nhập tên vật tư + "Gửi" | Dữ liệu thật không có sẵn vật tư |
| D6 | HANDOFF nêu gộp ticket trùng / yêu cầu bổ sung, thiết kế Ban tiếp nhận chỉ có nút "Yêu cầu cư dân bổ sung" | Agent đề xuất ticket có thể trùng, thẻ chờ phân loại hiện hai ticket cạnh nhau, Ban tiếp nhận duyệt "Đúng, gộp" / "Không trùng" (Q13); cư dân thấy nhãn "Cần bạn bổ sung thông tin" | HANDOFF luồng bước 3 |
| D7 | Ảnh chỉ được đếm ở tóm tắt | Ảnh lưu DB, hiện ảnh thu nhỏ trong chi tiết cư dân và thẻ của nhân viên | Ảnh tải lên mà không ai xem được là vô dụng |
| D8 | Đánh giá < 3 sao "chuyển Ban quản lý" (chỉ là câu chữ) | Ticket có đánh giá < 3 sao vào danh sách "Cần chú ý" của BQL | HANDOFF luồng bước 5 |
| D11 | Ban tiếp nhận có tab Quy tắc từ khóa; BQL có tab Phân quyền | Cả hai tab bị bỏ | Người dùng 2026-10-07 (Q12): phân loại/trùng do Agent, Ban tiếp nhận chỉ duyệt |
| D10 | Phòng ban chỉ thấy nhãn hài lòng (vệ sinh) hoặc không thấy gì (kỹ thuật) | Thấy số sao, thẻ nhận xét, bình luận; không bao giờ thấy người gửi | Quyết định người dùng 2026-10-07 (plan Q11) |
| D9 | Tên nhân viên là placeholder `[Tên …]`, thông báo là `[Tiêu đề …]` | Dữ liệu mẫu có tên/nội dung cụ thể (seed) | Bản chạy được |

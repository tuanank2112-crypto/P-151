# 00 — Kiến trúc: portal Next.js gọi backend Python (hồ sơ 11)

## 1. Mục tiêu
1. `portal/` (Next.js) KHÔNG còn đọc/ghi Postgres riêng của nó cho ticket, người dùng, ảnh, vật tư: mọi dữ liệu nghiệp vụ đi qua API backend `/api/v1` (engine CR-03, Agent, tầng an toàn). Backend trỏ Supabase (`maintops.*`) ⇒ portal hiện đúng dữ liệu thật trên Supabase.
2. Đáp ứng ĐỦ 11 yêu cầu trong ghi chú của anh Cố (Google Doc `1tlvFRnAioxn7LFHTNlM9TQgYzIDzx25ZC4pFxqB3qiA`, đọc 2026-10-09) — bảng R1…R11 ở §4. Doc là nguồn yêu cầu giao diện; `docs/CR-BPTN-03.md` là nguồn nghiệp vụ — lệch thì CR-03 thắng, TRỪ chỗ doc nói rõ (khi đó backend được mở rộng, xem SPEC-P01).
3. Giữ bộ tài khoản demo của portal (`cudan`, `tiepnhan`, `quanly`, `vesinh`, `kythuat`, `kho`, mật khẩu `123456`) — doc R5.

## 2. Non-goals (vùng cấm, kèm lý do)
| Không làm | Lý do |
|---|---|
| Bảng thông báo cư dân (`notices`) | Người dùng hoãn (2026-10-09 "bảng thông báo tôi sẽ xem xét sau"). Tab Thông báo của cư dân ẩn đi, KHÔNG xoá component. |
| Phân công tổ/kỹ thuật viên (`staff`, `assignStaff`) | CR-03 P0 không có người được giao (`assignee_id` luôn null); doc không yêu cầu. Thay bằng "Nhận việc" (ROUTED → IN_PROGRESS). |
| Cư dân "Xác nhận hoàn tất / Chưa đạt", cư dân huỷ ticket | CR-03: BQL nghiệm thu (T10/READY_FOR_REVIEW→CLOSED), chỉ BQL huỷ. Doc không yêu cầu. |
| Thẻ + bình luận khi đánh giá | CR-03 `rating` = số 1..5. Doc không yêu cầu. Giữ chọn sao. |
| Agent khớp từ khoá phía portal (`lib/agent.ts` `classify`, `%` độ tin cậy, dự đoán khi cư dân gõ) | Doc R3/R4 "bỏ cái Agent cứng"; luật dự án Q01/Q30: ngữ nghĩa do LLM ở backend, cấm khớp từ khoá. |
| Tự tính trùng ở portal (`lib/duplicates.ts`) | Backend có bước trùng (blocker `DUPLICATE`) do engine/Agent quyết. |
| Cư dân tự chọn "khẩn cấp" khi gửi | CR-03: mức an toàn do tầng an toàn quyết, cư dân không đặt mức. |
| Ghi dữ liệu thử vào Supabase khi phát triển | Supabase dùng chung với bản Render của nhóm. Phát triển/test bằng backend `MO_STORE=memory`. Trỏ Supabase chỉ ở bước demo, có người dùng đồng ý (OPERATIONS §3). |
| Thêm trường/giá trị enum mới vào doc ticket JSONB | Bản backend cũ trên Render đọc chung Supabase sẽ vỡ (sự cố 500 `merged_children` 2026-10-07). Mọi mở rộng backend ở hồ sơ này chỉ dùng trường/giá trị đã có, hoặc bảng MỚI mà code cũ không đọc (SPEC-P01 §3). |

## 3. Bất biến kiến trúc
- **I-01 Một nguồn dữ liệu:** trang/role của portal lấy dữ liệu bằng `portal/src/server/backend.ts` (SPEC-P02 §1). CẤM import `@/db` trong `app/**`, `server/**` mới, `components/**`.
- **I-02 Quyền ở backend:** portal chỉ ẩn/hiện nút; quyết định cho/không cho là của backend (403/409). Portal KHÔNG tự kiểm stage/vai để chặn ghi.
- **I-03 Phiên:** cookie httpOnly `portal_session` chứa token Bearer của backend (8 giờ, SPEC-P02 §2). Không có bảng `sessions` nữa.
- **I-04 Không lộ dữ liệu cư dân:** cư dân CHỈ gọi `/resident/*`; vai khác KHÔNG gọi `/resident/*`. Phòng ban không thấy tên/tài khoản cư dân (giữ quyết định Q11 của portal cũ).
- **I-05 Ảnh qua proxy:** trình duyệt lấy ảnh bằng `GET /api/photos/{ticketId}/{evidenceId}` của portal; route này gắn Bearer và gọi backend. Không đưa token ra trình duyệt.
- **I-06 Mã ticket:** dùng nguyên `ticket_id` của backend (vd `SIM-TKT-0042`) làm `id` và `code`. Bỏ `PA-0001`.
- **I-07 Giờ:** backend trả ISO có offset; portal định dạng giờ Việt Nam bằng `lib/format.ts` ở server.

## 4. Yêu cầu của doc → nơi đặc tả
| # | Yêu cầu (doc) | SPEC |
|---|---|---|
| R1 | BQL: bỏ thẻ "Ban quản lý" ở nhóm phòng ban; bấm Phòng VS / Phòng KT ⇒ mọi ticket đã chuyển cho phòng đó | SPEC-P03 §5.1 |
| R2 | BQL tổng quan: 5 ô bấm được (Tổng ticket, Chờ phân loại, Đang xử lý, Khẩn cấp chưa xong, Quá hạn) | SPEC-P03 §5.2 |
| R3 | BQL tab Tất cả ticket: bấm mọi mã ⇒ chi tiết; bỏ khối Agent cứng | SPEC-P03 §5.3, §7 |
| R4 | Tiếp nhận: như R3 (có tab Tất cả ticket) | SPEC-P03 §3.3, §7 |
| R5 | Role kho: `kho` / `123456` | SPEC-P01 §1, SPEC-P03 §6 |
| R6 | Bỏ kho vật tư khỏi role kỹ thuật | SPEC-P03 §4.3 |
| R7 | Kỹ thuật: bấm "Yêu cầu vật tư" ⇒ form chọn vật tư đẹp; nút "+" nhập vật tư khác ngoài danh sách | SPEC-P03 §4.3, SPEC-P01 §3 |
| R8 | "Đánh dấu hoàn thành" ở ticket đang xử lý ⇒ chuyển hoàn thành (chờ nghiệm thu) | SPEC-P03 §4.4 |
| R9 | Vệ sinh: bắt buộc ảnh đã xử lý mới hoàn thành; mỗi phòng một form hoàn thành | SPEC-P03 §4.4 (backend đã chặn `photo_present`) |
| R10 | Kỹ thuật: checklist lấy từ yêu cầu vật tư | SPEC-P03 §4.4 |
| R11 | Tab Việc của BQL (phí, thủ tục, an ninh, tranh chấp; chuyển lại được); ticket "Chờ nghiệm thu" có view để thành "Hoàn thành" | SPEC-P03 §5.4, SPEC-P01 §2 |

## 5. Thứ tự đọc
`01-CONTRACTS.md` (ánh xạ dữ liệu, API) → `SPEC-P01-backend-ext.md` (mở rộng backend) → `SPEC-P02-portal-client.md` (client, phiên, ảnh) → `SPEC-P03-screens.md` (từng màn) → `OPERATIONS.md` → `TESTING-ACCEPTANCE.md`.

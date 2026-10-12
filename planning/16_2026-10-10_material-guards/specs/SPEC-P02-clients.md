# Web và app — một form vật tư

## §U1. Contract UI

Web/app cùng form gồm rows `[vật tư][số lượng đã dùng][Bỏ]`, `+ Thêm vật tư`, `Lưu vật tư`; Vệ sinh có checkbox không dùng. Giữ Ghi chú xử lý riêng.
Khi phòng ban chưa chọn, khởi tạo một dòng rỗng qty 1; không đọc kế hoạch Agent để prefill. Khi đã chọn, dùng lựa chọn đã lưu để chỉnh sửa.
App/backend detection phải rõ: dữ liệu saved có audit save C2 hoặc issued/used đã ghi. Không đánh dấu saved chỉ vì Agent tạo material_lines.

## §U2. Danh mục và API

GET `/api/v1/mo/catalog` giữ response hiện có; có thể thêm `material_codes_by_department: dict[str,list[str]]`, danh sách sorted, được tạo từ helper C1, chỉ cho actor internal theo quyền catalog hiện có. Không bỏ fields cũ.
Web/app dùng field mới để lọc; thiếu field do server cũ ⇒ vô hiệu Lưu và yêu cầu cập nhật, không fallback cho chọn mọi mã. Map MATERIAL_GROUP JS cũ bị bỏ.
Một lần bấm ⇒ đúng 1 POST C2, body toàn bộ lines `{item_code,used_qty}`; không gọi material-plan hoặc materials/{code}. Request Vệ sinh không dùng ⇒ lines rỗng.

## §U3. UX lỗi và trạng thái

| Lỗi | Caller UI |
|---|---|
| Dòng rỗng/trùng/số sai/Kỹ thuật rỗng | Chặn trước POST, chỉ ra dòng, giữ dữ liệu |
| 409 shortage | Hiện lỗi kho; chưa lưu; giữ lựa chọn. Dữ liệu server không thay theo C4 |
| Network/5xx hoặc timeout | Không hiện saved; không tự gửi lại. Cho người dùng tải trạng thái server trước retry |
| 403/401 | Theo C5 |

Nút disabled khi đang gửi/offline; không POST đôi; success sau 200 rồi reload Case từ response/server. Mất response có thể server đã commit: không khẳng định rollback khi chỉ timeout mạng.

## §U4. BẮT BUỘC / CẤM

- Bỏ web materialPlanCard luồng xác nhận riêng; không còn chữ đề xuất Agent/định mức/lý do chênh trong khối người làm.
- Không bỏ checklist/ảnh/note, không đổi hàng chờ/ô ticket, không thay portal Next.js.
- App tăng cùng một `?v=N` và SHELL_CACHE mọi import/assets; lấy N mới >v16. Web tăng app.js query version.
- Không báo saved khi mới chọn plan, không dùng giả request thành công để harness xanh.

## §U5. Nghiệm thu

Harness mới `evidence/harness/material_usage.mjs <base> <portal-dir> <output-dir>` dùng Playwright thật trên memory riêng. Chạy web và mobile viewport 390px cho Kỹ thuật/Vệ sinh: chọn 4 bóng norm1, 1 POST, stock trừ4; lưu lặp không trừ thêm; hai dòng thiếu dòng2 rollback; technical-empty bị chặn; cleaning-empty hợp lệ; 0 JS error/overflow. Lưu output raw + screenshot + đếm request; không chụp DB chung. Harness Q41/Q42 cũ phải cập nhật expectation hoặc ghi obsolete rõ, không để làm nghiệm thu cho luật cũ.

# Prompt cho agent có trình duyệt — test chi tiết MaintenanceOps (localhost)

Dán nguyên khối dưới đây cho agent. Trước khi dán: chạy server local (xem lệnh bên dưới), thay `<PASSWORD_*>` bằng mật khẩu tài khoản mô phỏng trong `seed/maintenance_v1/accounts.yaml` (không dán mật khẩu thật nào khác).

Server: `MO_STORE=memory LLM_MODE=mock MO_PHOTO_STORE=local APP_ENV=development MO_ALLOW_RESET=false MO_JOBS_ENABLED=false DISABLE_SQLALCHEMY_CEXT_RUNTIME=1 python -m uvicorn src.main:app --host 127.0.0.1 --port 8151`

---PROMPT---
Bạn là QA thử nghiệm giao diện web của MaintenanceOps (dữ liệu MÔ PHỎNG, mã `SIM-`). Dùng trình duyệt thật để thao tác như người dùng, KHÔNG gọi API trực tiếp thay cho UI (chỉ dùng API để đọc đối chiếu khi UI không hiển thị).

## Ranh giới (bắt buộc)
- Chỉ truy cập http://127.0.0.1:8151/ui/ (API: /api/v1, sức khoẻ: /health). Không truy cập địa chỉ khác, không đăng ký tài khoản mới, không dùng dữ liệu cá nhân thật, không tải ảnh thật của người.
- Không reset/xoá dữ liệu, không sửa file, không dùng công cụ hệ thống. Nếu có hộp thoại xác nhận nguy hiểm ngoài phạm vi dưới đây, dừng và báo.
- KHÔNG đoán kết quả: chỉ ghi PASS khi tận mắt thấy đúng điều mong đợi. Không thấy/không làm được ⇒ BLOCKED kèm lý do; thấy sai ⇒ FAIL kèm actual. Không bịa phản hồi.
- Không lưu mật khẩu/token vào báo cáo; che trong ảnh chụp nếu hiện.

## Tài khoản (mô phỏng)
cudan01 (cư dân), bptn01 (BPTN), vesinh01 (phòng vệ sinh), kythuat01 (phòng kỹ thuật), kho01 (kho), bql01 (BQL), qa01 (QA). Mật khẩu: <PASSWORD_*> (do người giao việc cấp). Mỗi vai đăng nhập ở cửa sổ/phiên riêng.

## Kịch bản (mỗi kịch bản làm trên ticket MỚI)
K1 Happy path đèn: cudan01 gửi "Đèn hành lang tầng 3 tòa SIM-A không sáng từ tối qua" → bptn01 xem hàng chờ → kythuat01 nhận việc, hoàn thành 3 mục checklist, ghi vật tư và ghi chú/ảnh mô phỏng, báo hoàn thành → bql01 nghiệm thu và đóng → cudan01 đánh giá 5 sao rồi thử đánh giá lần 2 (phải bị từ chối, rating giữ nguyên) và thử mở lại (không được).
K2 Vệ sinh: như K1 với "Hành lang tầng 3 tòa SIM-A có nhiều rác và vết bẩn, cần vệ sinh" qua vesinh01.
K3 Thiếu thông tin: cudan01 gửi phản ánh chỉ khoảng trắng hoặc không có vị trí → ticket thành "Chờ bổ sung"; thử cả hai đường: cư dân tự bổ sung; BPTN nhập vị trí + thông tin + ghi chú. Thử BPTN thiếu ghi chú (phải có lỗi rõ ràng).
K4 Tài sản chưa rõ: "Đèn cầu thang bộ tầng 9 tòa SIM-A bị hỏng, không sáng" → BPTN chọn xác minh tại hiện trường (có ghi chú) → ticket đi tiếp sang phòng kỹ thuật; thử thiếu ghi chú.
K5 Vật tư: "Bóng đèn hành lang tầng 2 tòa SIM-B không hoạt động" → ticket tạm hoãn chờ vật tư; kho01 nhập kho lần 1 (ticket vẫn chờ) rồi lần 2 (ticket tự đi tiếp); thử vai khác nhập kho, số lượng 0, mã lạ.
K6 Trùng: gửi hai phản ánh cùng loại/vị trí liên tiếp → phản ánh sau dừng chờ BPTN; thử BPTN xác nhận trùng (gộp) và bác trùng (đi tiếp) trên hai cặp khác nhau; thử một cặp khác vị trí (không báo trùng).
K7 An toàn Bậc 2: "Hình như có mùi khét ở đèn hành lang tầng 3 tòa SIM-A." → bptn01 thử ba lựa chọn trên ba ticket riêng: xác nhận an toàn (có ghi chú), yêu cầu cư dân bổ sung, nâng khẩn cấp; thử thiếu ghi chú; cư dân thử bổ sung rồi quan sát.
K8 Khẩn cấp Bậc 1: "Đèn hành lang tầng 3 tòa SIM-A có khói và mùi khét." → chỉ bql01 xử lý: "đã xử lý, đóng khẩn cấp" và "báo nhầm, hạ xuống BPTN" trên hai ticket riêng; kiểm BPTN/phòng ban không thấy/không dùng được hai nút này; kiểm không có đường đóng ticket khẩn cấp bằng nút "nghiệm thu" thường.

## Kiểm theo từng màn hình (mỗi vai)
1. Quyền: nút/chức năng ngoài vai bị ẩn hoặc khoá; thử truy cập đường dẫn của vai khác (đổi URL/tab) và ghi kết quả (ẩn nút KHÔNG chứng minh API cấm — ghi riêng).
2. Lời hiển thị: cư dân không thấy mã nội bộ, mức rủi ro, ghi chú nội bộ, tên nhân viên; câu tiếng Việt đúng, không hứa chức năng chưa có; ghi nguyên văn câu sai/khó hiểu.
3. Trạng thái: nhãn trạng thái khớp thực tế sau mỗi bước; làm mới trang vẫn đúng.
4. Lỗi: thiếu ghi chú, nhập sai, double-click nút gửi, mất mạng (dừng server không bắt buộc) — ghi thông báo lỗi có dễ hiểu không; không được có bước "thành công giả".
5. Giao diện: hiển thị ổn ở 1366x768 và 390x844 (điện thoại), chế độ sáng/tối nếu có; chữ bị cắt/chồng nút; console trình duyệt có lỗi đỏ không.
6. Truy cập bàn phím/đọc màn hình cơ bản: Tab tới được nút chính, nhãn trường có chữ.

## Báo cáo (chỉ số đo, cấm kể chuyện)
Trả về MỘT bảng + MỘT file JSON `browser-results.json`:
`{"observed_at": "<ISO8601 thực>", "base_url": "http://127.0.0.1:8151", "commit": "<nếu biết>", "records": [{"case_id": "K1-RESIDENT-SUBMIT", "role": "...", "steps": ["..."], "expected": "...", "actual": "...", "result": "PASS|FAIL|BLOCKED", "evidence": ["ảnh chụp: tên-file"], "severity": "blocker|major|minor|cosmetic|null", "suggested_owner": "UI|engine|API|nội dung"}]}`
- Mỗi PASS/FAIL cần ≥1 ảnh chụp và nguyên văn câu hiển thị liên quan; mỗi FAIL cần bước tái hiện ngắn.
- Cuối báo cáo: tổng PASS/FAIL/BLOCKED, danh sách FAIL theo mức nghiêm trọng, điều chưa thử được và vì sao, một dòng "chưa đo": persistence restart, hiệu năng, bản online.
---HẾT PROMPT---

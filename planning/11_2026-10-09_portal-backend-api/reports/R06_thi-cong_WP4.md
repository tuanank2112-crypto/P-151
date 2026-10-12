Vai: worker (vai-thi-cong) · thi công · Claude Sonnet 5.5 · Bước 0: exit 0 (NÃO ĐÃ OK; chỉ cảnh báo BRN-028 ngoài phạm vi) · hiểu việc: phạm vi = giao diện Phòng vệ sinh + Phòng kỹ thuật theo SPEC-P03 §4 chỉ trong portal/src/app/{cleaning,technical} + evidence/WP4 + report; xong khi = typecheck/lint/test EXIT=0 + kiểm trình duyệt thật 1440/390 + bảng đối chiếu spec; cấm = lib/server/actions/components, ngoài portal/, commit/push/add -A/stash, ghi Supabase
Handoff: handoffs/H06_thi-cong_WP4.md
Base: ef4a4d92f94341fde543313ef2015ca7b77693fb
Head: ef4a4d92f94341fde543313ef2015ca7b77693fb; working tree chưa commit

## Lệnh + exit (evidence/WP4/)
| Lệnh | Exit | File |
|---|---|---|
| npm run typecheck | 0 | checks.txt |
| npm run lint | 0 | checks.txt |
| npm run test | 0 | checks.txt |
| npx tsx scripts/ui-check-WP4.mts cleaning (7 bước) | 0 | ui-check-cleaning.txt |
| npx tsx scripts/ui-check-WP4.mts technical (7 bước) | 0 | ui-check-technical.txt |
Test: 8 file, 118 tổng, 118 pass, 0 fail, 0 skip (không thêm test mới: gói chỉ UI, đo bằng trình duyệt). Ctrl-char = 0 trên mọi file đã sửa/tạo.

## git diff --stat (phạm vi gói; phần working tree khác là của WP3/WP5/WP1b)
 portal/src/app/cleaning/cleaning-app.tsx   | thay (-299 +)
 portal/src/app/technical/technical-app.tsx | thay (-545 +)
 MỚI: portal/src/app/cleaning/dept-parts.tsx (dùng chung 2 màn), portal/src/app/technical/request-modal.tsx, portal/scripts/ui-check-WP4.mts
 tổng 2 file tracked: 110 insertions, 734 deletions. SHA = Base (chưa commit).

## Bảng SPEC -> đạt/chưa
Xem evidence/WP4/spec-check.md (đạt toàn bộ dòng §4; hai chỗ "một phần" ở câu hỏi mở 1, 2). Ảnh: evidence/WP4/*.png (28 ảnh, 1440 + 390: queue, detail, assign, return, finish, staff, history, request modal, materials của 2 màn).

## Quyết định của worker
1. Phần dùng chung 2 màn đặt ở cleaning/dept-parts.tsx (components/ cấm); technical import từ đó.
2. Không dùng chung Board đổi; vẫn dùng `Board` của Trí (3 cột Cần nhận / Đang xử lý / Hoàn thành). ON_HOLD+WAITING_MATERIAL nằm cột Đang xử lý với khối "Chờ cấp trên duyệt vật tư"/"Chờ kho nhập hàng".
3. Khi /mo/staff trả rỗng, nút ROUTED là "Nhận việc" (acceptAction) để UI chạy trên backend chưa có staff.
4. Form hoàn thành: checklist lấy từ playbook thật (bắt buộc phải tích), lỗi backend hiện trong form (không đóng modal). Kỹ thuật thêm ô "Lý do nếu số lượng khác định mức" (tùy chọn) vì backend từ chối khi planned≠norm (đo thật trên SIM-TKT-TEC-001).
5. Thêm tab "Lịch sử" cho kỹ thuật (SPEC chỉ nói giữ cho vệ sinh) để xem sao/thẻ/bình luận.
6. Tách tiêu đề/nội dung từ DTO (`title`, `content`); không hiện khối Agent ở thẻ vì DeptTicket không có `agent` (khối Agent thật nằm ở TicketDetailModal).

## Bảng phân công
| Gói | Tầng yêu cầu | Họ/model đã dùng |
| WP4 | 🟠 | Claude Sonnet 5.5, không giao con |

## Việc KHÔNG làm + lý do
- Không gửi thật "Không phải việc phòng mình" / "Báo sai phòng ban" / "Đổi người" (chỉ mở modal, kiểm nút khoá khi note rỗng) để không đổi dữ liệu demo ngoài luồng chính.
- Không chụp nhánh Lịch sử có sao/thẻ/bình luận (chưa có ticket CLOSED có đánh giá trên backend memory).
- Không thử nhánh "Nhận việc" fallback sau khi /mo/staff có dữ liệu (chỉ phản hồi rỗng tại thời điểm lỗi 500).
- Không sửa lib/, components/, server/, actions/ (ngoài phạm vi).

## Câu hỏi mở
1. `failing_items` của backend khi lệch định mức là mã dòng vật tư (vd SIM-MAT-LINE-TEC-001-01); `failingLabels` (lib/backend-map.ts) không dịch => toast/form hiện mã. Cần WP2b/lib map mã dòng vật tư => "Vật tư dùng khác định mức, cần ghi lý do".
2. `MaterialRow` không có định mức (`norm_qty`) và cư dân/vệ sinh không có đường yêu cầu vật tư: mục "vật tư đã dùng" của vệ sinh chỉ hiển thị danh sách ticket (không nhập). Cần DTO `normQty` / quyết định có cho vệ sinh nhập vật tư dùng không.
3. Xem trình duyệt qua http://127.0.0.1:3000 hoặc :8000 KHÔNG hydrate (Next dev chặn cross-origin dev resource, log "Blocked cross-origin request … allowedDevOrigins"); http://localhost:3000 chạy đúng. Cần `allowedDevOrigins` trong next.config.ts (ngoài phạm vi) nếu muốn mở bằng 127.0.0.1/cổng 8000.
4. Giữ nguyên câu hỏi R04: `.gitignore` dòng `data/` che portal/src/server/data/.

Tiếp theo
🖐 Cần tay người: duyệt R06; quyết câu hỏi mở 1–3.
🤖 Agent làm được ngay: chờ lệnh (dịch failing_items, normQty trong DTO, allowedDevOrigins).
⭐ Nên làm trước: câu hỏi mở 1 — người dùng đang thấy mã lỗi khó hiểu khi hoàn thành kỹ thuật lệch định mức.
⏸ Chưa làm: gửi thật các nút trả/báo sai/đổi người, ảnh lịch sử có đánh giá, mọi file ngoài phạm vi.

⏳ Chờ người duyệt.

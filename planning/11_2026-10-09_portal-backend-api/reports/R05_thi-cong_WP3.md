Vai: worker (vai-thi-cong) · thi công · Claude Sonnet 5.5 · Bước 0: exit 0 (NÃO ĐÃ OK; chỉ cảnh báo BRN-028 today.md dài, ngoài phạm vi) · hiểu việc: phạm vi = giao diện Cư dân + Tiếp nhận theo SPEC-P03 §2–§3, chỉ ghi `portal/src/app/resident/**`, `portal/src/app/reception/**`, evidence/WP3, report này (và script kiểm `portal/scripts/ui-check-WP3.mts` do handoff cho phép); xong khi = typecheck/lint/test EXIT=0 + kiểm trình duyệt 1440/390 + bảng tự đối chiếu; cấm = lib/server/actions/components, ngoài portal/, commit/push/add -A/stash, ghi Supabase, chữ/số/khối Agent viết cứng
Handoff: handoffs/H05_thi-cong_WP3.md
Base: ef4a4d92f94341fde543313ef2015ca7b77693fb
Head: ef4a4d92f94341fde543313ef2015ca7b77693fb; working tree chưa commit

## Lệnh + exit (evidence/WP3/)
| Lệnh | Exit | File |
|---|---|---|
| npm run typecheck | 0 | checks.txt |
| npm run lint | 0 | checks.txt |
| npm run test (8 file, 118 test, 118 pass, 0 fail, 0 skip) | 0 | checks.txt |
| npx tsx scripts/ui-check-WP3.mts --base=http://localhost:3000 (57 PASS, 0 FAIL, 4 SKIP) | 0 | ui-check.txt |
Ctrl-char `[\x08\x0c\x0b]` = 0 trên resident-app.tsx, reception-app.tsx, ui-check-WP3.mts.
Lần chạy typecheck đầu có EXIT=2 vì file nháp của worker khác (`scripts/_dbg-wp4.mts`) bị xoá giữa chừng; chạy lại sạch EXIT=0, `checks.txt` là lần chạy lại.

## Test
Tổng 118 / pass 118 / fail 0 / skip 0 (bằng bản WP2b; gói này không thêm/bớt test đơn vị).

## git diff --stat (phần của gói)
 portal/src/app/reception/reception-app.tsx | 346 +++++++---
 portal/src/app/resident/resident-app.tsx   | 211 +++++---
 2 files changed, 412 insertions(+), 145 deletions(-)
MỚI (untracked): portal/scripts/ui-check-WP3.mts · planning/11_.../evidence/WP3/* (ui-check.txt, checks.txt, spec-check.md, 26 ảnh PNG) · reports/R05.
Các file khác trong `git status` (src/*.py, cleaning, technical, management, warehouse, ticket-detail-modal, ui-check-WP4/5, v.v.) là của WP1b/WP4/WP5 chạy song song, không phải gói này.

## SPEC-P03 §2–§3 → đạt/chưa
Chi tiết từng dòng + ảnh chứng minh: evidence/WP3/spec-check.md. Tóm tắt:
- ĐẠT, đã quan sát trong trình duyệt: ô Tiêu đề/Nội dung + kiểm độ dài, gửi thật lên backend và tách lại tiêu đề/nội dung/vị trí, bỏ khẩn cấp/dự đoán từ khoá/câu mẫu, bỏ xác nhận/hủy, không tab Thông báo; Tiếp nhận 3 tab, thẻ đủ trường, khối Agent ("Chưa có quyết định của Agent" khi backend không trả), DUPLICATE so sánh cạnh nhau + Gộp/Không trùng, ASSET_UNCLEAR "Kiểm tra tại chỗ", MISSING_INFO chỉ xem, tab Đã phân loại (bấm dòng/mã ⇒ modal), tab Hiệu suất Agent (4 ô + "Agent đúng/sai: N lần").
- ĐẠT Ở MÃ, CHƯA quan sát trong trình duyệt (dữ liệu backend memory hiện tại không có ca): "Bổ sung" khi needInfo; đánh giá sao + thẻ GOOD/BAD + bình luận và hiển thị lại đánh giá; nút theo blocker CATEGORY_UNCLEAR/OUT_OF_SCOPE/PENDING_REVIEW/WRONG_DEPT; SAFETY_REVIEW_REQUIRED với "Chuyển BQL" bắt buộc note; khối Agent khi backend có `agent_decision`; danh sách "lần nhân viên sửa" có dòng.
- Overflow: 26 check "no horizontal overflow" @1440 và @390, đều `scrollWidth <= viewport`.

## Ảnh (evidence/WP3/)
resident-compose-empty / compose-filled / submitted / mine-new / mine-list; reception-inbox / step0 / step1 / detail-modal / done / done-modal / perf / after-route; mỗi màn có -1440 và -390.

## Quyết định của worker
1. Form "Bổ sung" của cư dân chỉ hiện khi `needInfo` (SPEC §2); ngoài ra chỉ liệt kê bổ sung đã có.
2. Bỏ các chip "Câu mẫu" của ô mô tả (là văn bản viết cứng điền sẵn, không có trong SPEC).
3. PENDING_REVIEW: ngoài 2 nút phòng ban còn giữ "Xác nhận phân loại của Agent" (hành động `confirmReviewAction` đã có từ WP2b) vì SPEC chỉ liệt kê nút chuyển phòng; không bỏ khả năng xác nhận.
4. Nút phòng được tô nổi (`sug`) theo `agent.proposedDept` thật; Agent lỗi/không có ⇒ theo `proposedDept` của backend.
5. "Chuyển BQL" ở blocker an toàn: bắt buộc nhập ghi chú trước khi gửi, chặn ở client bằng toast; backend vẫn kiểm lại.
6. Dòng bảng "Đã phân loại" bấm được cả dòng (chuột) + nút mã và nút tiêu đề cho bàn phím (không đặt `role=button` lên `<tr>` để giữ ngữ nghĩa bảng).
7. Kiểm trình duyệt chạy trên http://localhost:3000 (không phải :8000), xem câu hỏi mở 1.
8. Một lần chạy thử trên server `next dev` cũ trả dữ liệu cũ (DTO thiếu `content`/`ratingTags`); sau khi người điều phối khởi động lại server thì khớp. Tôi từng dựng bản sao tạm `portal/.wp3copy` (cổng 3200) để thử; đã dừng tiến trình và xoá thư mục, không còn trong repo.

## Bảng phân công
| Gói | Tầng yêu cầu | Họ/model đã dùng |
| WP3 | 🟠 | Claude Sonnet 5.5, không giao con |

## Việc KHÔNG làm + lý do
- Không sửa `lib/`, `server/`, `actions/`, `components/` (cấm).
- Không chạy được trong trình duyệt: needInfo, đánh giá, route CATEGORY/OUT_OF_SCOPE/PENDING_REVIEW/WRONG_DEPT, an toàn, khối Agent có quyết định, danh sách sửa của Agent (backend memory không có dữ liệu loại đó; không bịa dữ liệu).
- Không commit/push.

## Câu hỏi mở
1. Đăng nhập qua http://localhost:8000 (proxy sang portal) không chuyển trang được (POST login trên :8000 bị treo; trên :3000 chạy), nghi Server Action bị chặn do host/origin sau proxy (cần `serverActions.allowedOrigins` hoặc chuyển tiếp `x-forwarded-host` — nằm ngoài phạm vi, `next.config.ts`/backend). Ai xử lý?
2. DTO `DuplicateRef` chỉ có `text` + `statusLabel` — thiếu vị trí/giờ của ticket nghi trùng nên so sánh cạnh nhau chỉ hơn được nội dung. Cần mở rộng `lib/dto.ts` + `server/data/build.ts` (WP2b) nếu muốn đủ.
3. "Tiêu đề" của ticket cũ một dòng bị cắt 80 ký tự và `content` rỗng (hành vi WP2b, Quyết định 6) — giao diện hiện mỗi tiêu đề, không lặp nội dung; xác nhận chấp nhận được.
4. Ticket mới của cư dân hiện luôn mang nhãn "Khẩn cấp" ở Tiếp nhận (do backend memory tính `urgent`, cư dân không chọn) — cần xác nhận đó là đúng với luật backend.
5. Thư mục rác ngoài repo: `D:/wp3-3200.log` (log của server thử cổng 3200, do tôi tạo nhầm ở gốc ổ D) — công cụ chặn lệnh xoá; xin người xoá tay.

Tiếp theo
🖐 Cần tay người: xoá `D:/wp3-3200.log`; quyết câu hỏi mở 1 (đăng nhập qua :8000) và 2.
🤖 Agent làm được ngay: chờ lệnh (chạy nốt các luồng chưa quan sát khi backend có dữ liệu needInfo/đánh giá/an toàn/Agent thật).
⭐ Nên làm trước: duyệt R05 rồi nạp dữ liệu có ca needInfo + canRate để đo nốt hai luồng cư dân quan trọng nhất.
⏸ Chưa làm: các luồng nêu ở "Việc KHÔNG làm" (thiếu dữ liệu), commit.

⏳ Chờ người duyệt.

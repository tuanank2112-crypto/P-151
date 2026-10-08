# Backlog Day05 — tóm tắt

> Trạng thái: **PROPOSED**. Chưa leader duyệt, D5-B-011 đã xác nhận phân công; 14 mục còn lại PROPOSED. Không mục nào CLOSED. Nguồn lịch sử gắn run/build, không khẳng định bug còn ở runtime hiện tại — trừ D4-11 đã đo lại ngày 2026-10-07 (`evidence/run00-baseline/d411-probe.txt`).

Phân bố: priority {'P2': 7, 'P1': 6, 'P0': 2} · decision {'NO_ACTION': 1, 'NEXT': 7, 'NOW': 3, 'DEFER': 4} · severity {'MINOR': 8, 'MAJOR': 2, 'CRITICAL': 1, 'NA': 4} · owner_acceptance {'CONFIRMED': 1, 'PROPOSED': 14}.

| ID | Nguồn | Loại | Sev | Pri | Quyết định | Owner đề xuất | Trạng thái |
|---|---|---|---|---|---|---|---|
| D5-B-001 | D4-01 | EVIDENCE | MINOR | P2 | NO_ACTION | Châm Anh | OPEN |
| D5-B-002 | D4-02 | EVIDENCE | MINOR | P1 | NEXT | Trường / Châm Anh | OPEN |
| D5-B-003 | D4-03 | EVIDENCE | MAJOR | P1 | NEXT | Trường / Trí | OPEN |
| D5-B-004 | D4-04 | EVIDENCE | MINOR | P1 | NEXT | Trường / Châm Anh | OPEN |
| D5-B-005 | D4-05 | EVIDENCE | MINOR | P1 | NEXT | Trường / Trí | OPEN |
| D5-B-006 | D4-06 | BUG | MAJOR | P1 | NOW | Như Ý / Châm Anh | FIXED_PENDING_RETEST |
| D5-B-007 | D4-07 | EVIDENCE | MINOR | P1 | NEXT | Trường | OPEN |
| D5-B-008 | D4-08 | SPEC | MINOR | P2 | DEFER | Leader / Châm Anh | OPEN |
| D5-B-009 | D4-09 | EVIDENCE | MINOR | P2 | NEXT | Châm Anh | OPEN |
| D5-B-010 | D4-10 | EVIDENCE | MINOR | P2 | NEXT | Trí / Như Ý | OPEN |
| D5-B-011 | D4-11 | BUG | CRITICAL | P0 | NOW | Như Ý | OPEN |
| D5-B-012 | roadmap#vision | FEATURE | NA | P2 | DEFER | Trí / Như Ý | OPEN |
| D5-B-013 | roadmap#langgraph | FEATURE | NA | P2 | DEFER | Như Ý / Châm Anh | OPEN |
| D5-B-014 | roadmap#p1 | FEATURE | NA | P2 | DEFER | Như Ý | OPEN |
| D5-B-015 | Day05-WP03 | DATA | NA | P0 | NOW | Trường (soạn held-out) / Như Ý + leader (review safety) | OPEN |

## Điểm cần chú ý

- **D5-B-011 (D4-11, CRITICAL/P0)**: đo lại trên HEAD `8dd6baa` (dirty): S5/S1 "bị kẹt" ⇒ NONE, "bị mắc kẹt" ⇒ EMERGENCY. Lệnh `done_when` hiện exit 1 (`POS_FAIL`). Owner Như Ý; Châm Anh retest API/UI. Không suy do tòa S5.
- **D5-B-006 (D4-06)**: FIXED_PENDING_RETEST; recovery SIM-TKT-0042 không đủ để đóng, cần lượt tạo sạch trả 201.
- Mục retest D5-B-002..010 chỉ đóng được khi có evidence mới ở `evidence/retest-*/`; lệnh `done_when` hiện sẽ báo thiếu file (đúng chủ đích).
- D5-B-001 NO_ACTION (không sửa memory để lưu bền); D5-B-012..014 DEFER (vision, LangGraph/Day06, P1); D5-B-015 là việc dữ liệu của Day05 (review người thật + held-out AUTHORED).

## Cần người xác nhận (chưa làm)

1. Leader duyệt scope/priority backlog; ghi tên + thời điểm thật.
2. Từng owner (Như Ý, Châm Anh, Trí, Trường) xác nhận nhận việc — `owner_acceptance` giữ PROPOSED tới lúc đó.
3. Quyết định môi trường QA/phạm vi ghi shared cho retest D5-B-002..006 (agent không ghi Supabase).
4. Owner xác nhận hành vi mong muốn cho D4-09 (ngoài giờ) và phạm vi màn cư dân cho D4-10.


## Cập nhật xác nhận phân công (2026-10-07T16:39:35.819793+00:00)

Người dùng xác nhận nhóm đã thống nhất D4-11 / D5-B-011: Như Ý sửa safety; Trường chuẩn bị câu kiểm thử; Châm Anh kiểm tra API. Backlog hiện có 1 mục CONFIRMED và 14 mục PROPOSED. Đây là xác nhận phân công, chưa phải kết quả sửa lỗi: D4-11 vẫn OPEN/CRITICAL/P0, chờ kiểm thử lại bản sửa. Chưa có xác nhận reviewer/nhãn gold hoặc nghiệm thu toàn bộ Day05. Các số đo và manifest trước cập nhật này là bằng chứng lịch sử; hash backlog đã thay đổi do ghi nhận xác nhận.

- 2026-10-08T09:05:55.932842+00:00: rà backlog thấy D5-B-015 chưa phản ánh các xác nhận đã có. Cập nhật PRELIMINARY_15, owner Trường/Như Ý/Châm Anh đúng vai trò đã duyệt; owner_acceptance CONFIRMED, status IN_PROGRESS. Không duyệt nhãn hoặc đóng dữ liệu. Tổng phân công 2 CONFIRMED / 13 PROPOSED. Bắt đầu thảo luận 13 mục còn lại, chưa tự xác nhận các mục này.

- 2026-10-08T09:11:20.819204+00:00: Trường chốt hướng xử lý D5-B-001=NO_ACTION (không sửa memory, dùng persistence evidence Supabase), D5-B-008=DEFER public, D5-B-012=DEFER vision ngoài Day05. Lưu backlog-scope-decisions.json; owner_acceptance còn PROPOSED, không đóng việc hay xác nhận nghiệm thu thay owner. Còn 10 hướng xử lý chưa thảo luận trong 13 mục còn lại; tổng assignment vẫn 2 CONFIRMED / 13 PROPOSED.

- 2026-10-08T09:22:47.304078+00:00: Trường duyệt nhóm API D5-B-006 NOW, D5-B-002/004 NEXT; Châm Anh dẫn kiểm thử đề xuất, Như Ý phối hợp lỗi engine. QA cô lập, không suy quyền ghi shared Supabase. Chuẩn bị api-retest-checklist.md; chưa chạy hoặc đóng lỗi, owner acknowledgment vẫn PROPOSED. 6 scope decisions đã ghi / còn 7 mục cần thảo luận (003/005/007/009/010/013/014).

- 2026-10-08T09:40:03.176149+00:00: Trường chốt D5-B-003/005/007 NEXT: thu bằng chứng demo QA mới, chủ trì tổng hợp bởi Trường, Trí hỗ trợ nếu UI cần. Xác nhận owner cho phần chủ trì của Trường, không giả acknowledgement Trí. demo-evidence-checklist.md đã chuẩn bị, các mục vẫn OPEN. Scope decisions đã chốt 9 mục / còn 4 mục 009/010/013/014. Assignment 5 CONFIRMED / 10 PROPOSED, không đồng nghĩa 5 việc đã xong.

- 2026-10-08T09:42:49.903373+00:00: Trường duyệt 4 mục cuối 009/010 NEXT, 013/014 DEFER nghiệm thu riêng. Hướng xử lý backlog đủ15/15; không có mục nào mới CLOSED. Sửa mô tả lỗi thời 013 (đã có module StateGraph/engine integration) và 014 (lexicon P0/P1); chưa coi code tồn tại là runtime PASS. Tổng hợp backlog-handoff-summary.md để người dùng bàn giao, chưa gửi tin/commit/push.

- 2026-10-08T10:10:44.796289+00:00: Trường báo Như Ý/Châm Anh đã duyệt và nhận phần việc, yêu cầu push nhánh và PR vào develop. Ghi owner-acknowledgement.json, 12/15 owner CONFIRMED (3 mục còn có Trí/leader không suy nhận việc); review nhãn và runtime retest vẫn PENDING. Chuẩn bị commit gói Day05 cùng bằng chứng Day04 liên quan, không thêm thay đổi runtime chưa thuộc scope.

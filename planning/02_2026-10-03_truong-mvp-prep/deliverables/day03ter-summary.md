# Day03-ter — đo lại phần còn chặn sau khi Như Ý thêm route safety

- Bản đo: nhánh `feature/nhuy-safety-routes`, commit `92649a6152737154cca606f3ce94d3f0ec0e0273` (PR #10, chưa merge vào develop; đã chứa develop 512131a). Local cô lập (memory/mock/local) trong worktree riêng; không phải online.
- Nguồn: [day03ter-results.json](day03ter-results.json) (17 record đo lại), [ter/D3-05-wording.md](ter/D3-05-wording.md); handoff H16–H17, report R16–R17; root đo lại: `evidence/root/day03ter-*`.
- Ngoài 17 record này, 19 PASS còn lại của Day03-bis không đo lại ở lượt này (hồi quy DEMO-01A và rating đã chạy lại, vẫn PASS).

## Số đo (17 record): 14 PASS, 1 FAIL, 2 BLOCKED

| Mục | Day03-bis | Day03-ter |
|---|---|---|
| DEMO-04 Bậc 2 (xác nhận an toàn / leo thang / yêu cầu bổ sung), timeout 4h/12h | BLOCKED | **PASS** |
| DEMO-04 Bậc 1 (đóng khẩn cấp, hạ báo nhầm) + 403 theo vai (34/34) | BLOCKED | **PASS** |
| D01-B (hazard trong bổ sung khi NEED_INFO) | không đo | PASS (chỉ phần phát hiện khẩn cấp) |
| D01-A (bổ sung sau xác nhận an toàn), D01-C (bổ sung vào ticket khẩn cấp) | không đo | **BLOCKED** (Như Ý): route additions chỉ nhận NEED_INFO, 409; chưa có snapshot nên chưa đo "LLM chỉ nhận delta + snapshot" |
| WORD-02 (BPTN) | BLOCKED | **PASS** |
| WORD-04 (BQL) | BLOCKED | **FAIL** (Trí) — xem dưới |
| Hồi quy DEMO-01A, rating-once | PASS | PASS |

Root chạy lại độc lập 9 nhóm harness (t2safe, t2escalate, t2info, t1close, t1down, neg403, d01b, tgen, g1r): khớp worker. pytest 1640 passed / 29 deselected, ruff đạt trên cùng SHA.

## Phát hiện cần xử lý
1. **Đóng khẩn cấp lách được (Như Ý + Trí):** `POST /bql/tickets/{id}/close` vẫn trả 200 với ticket khẩn cấp (tgen.txt); UI có fallback `/emergency/close` → `/emergency-close` → `/bql/tickets/{id}/close` (app.js:1239-1241). WORD-04 FAIL owner Trí; backend là phần của Như Ý.
2. **OPERATIONS §5.2.3 lệch CR-03 (Trường, đã sửa):** chủ NEED_INFO an toàn là cư dân, không phải BPTN.
3. Field API là `safety_clear_reason` (không phải `safety_cleared_reason`).

## Quyết định cần người
- D01 (bổ sung sau safety, snapshot) có bắt buộc cho MVP 04/10 không? Hiện BLOCKED, chưa code.
- Hub `../brain4agent.release` thiếu (Bước 0 exit 1); lệch thứ tự an toàn/phân loại của fixture CR03 chưa sửa (đang chờ phép).

## Trước nghiệm thu 04/10
Merge PR #10; sửa lỗ đóng khẩn cấp; quyết/triển khai D01; chạy lại D01-A/C, WORD-04, rồi bốn demo trên bản online (persistence restart và UI chưa đo). Không gate runtime/online nào đạt.

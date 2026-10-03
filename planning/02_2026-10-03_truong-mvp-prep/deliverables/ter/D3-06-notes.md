# Day03-ter D3-06 — ghi chú đo lại DEMO-04 trên bản có route safety

Đo 2026-10-03 (đồng hồ máy 12:39-12:43+07:00) tại worktree cô lập, HEAD `92649a6152737154cca606f3ce94d3f0ec0e0273` (detached, = `origin/feature/nhuy-safety-routes`, PR #10). Local memory/mock, mỗi ca một process. Kết quả: [D3-06.json](D3-06.json), 15 record: **13 PASS, 2 BLOCKED, 0 FAIL**. Harness: `evidence/ter/demos/harness.py`.

## Khác Day03-bis
- DEMO-04 Bậc 2 và Bậc 1: BLOCKED -> PASS. Route `POST /mo/tickets/{id}/safety` và `/bql/tickets/{id}/emergency/{close,downgrade}` có thật, đúng quyền, đúng note bắt buộc, có audit.
- Tách 3 lựa chọn Bậc 2, 2 hành động Bậc 1, hạn 4 giờ/12 giờ, negative 403: đều đo được.
- Hồi quy 01A (26/26) và 01-RATING (31/31) giữ PASS.

## Điểm lệch / quan sát (không đổi expected)
1. **Owner NEED_INFO sau REQUEST_INFO**: code đặt chủ RESIDENT (đúng CR-03 §6.4 "chủ blocker là cư dân"), OPERATIONS §5.2.3 viết "chủ BPTN". Chấm PASS theo CR-03; wording SPEC cần sửa (owner Trường).
2. **`safety_clear_reason`** (không phải `safety_cleared_reason`) là tên field API; OPERATIONS dùng "safety_cleared_by/at/reason".
3. Sau CONFIRM_SAFE / downgrade, flow tiếp ở `VERIFYING/OUT_OF_SCOPE` (mock classifier không định tuyến câu này); là blocker nghiệp vụ, không phải safety.
4. `POST /bql/tickets/{id}/close` (route chung) **đóng được ticket khẩn cấp** (HTTP 200, `EMERGENCY_HANDLED`), trái ghi chú OPERATIONS §5.3.1 "không hỗ trợ nguồn emergency". Chỉ BQL, bắt buộc note nên không vượt quyền; ghi nhận để Trường cập nhật SPEC hoặc Như Ý chốt có chủ ý (evidence `tgen.txt`, không thành record vì không có expected cứng).
5. Mốc thời gian: ingest dùng `simulated_received_at` làm đồng hồ (since=10:00), nên 14:01 literal = since+4h01 (đúng 4 giờ). Với NEED_INFO since = lúc chuyển (12:41 máy), nên 22:01 literal chỉ +9h20; đo 12 giờ theo since+11h59/+12h01.

## D01 delta/snapshot
- **A (sau confirm-safe) BLOCKED, owner Như Ý**: route additions chỉ nhận ở `NEED_INFO` (409 ở trạng thái khác). Engine có `_safety_scope_text` (chỉ đọc phần bổ sung sau thời điểm clear) nhưng không có đường API tới đó; không có field snapshot.
- **C (delta trên ticket khẩn cấp) BLOCKED, owner Như Ý**: cùng nguyên nhân, 409.
- **B (NEED_INFO + hazard) PASS** phần phát hiện: emergency ngay dù thiếu tầng, audit `ASSESS_SAFETY` x2. Phần "LLM input chỉ delta+snapshot, snapshot trước/sau" KHÔNG đo được (không lộ ra API) — chưa có bằng chứng.

## Chưa đo
Persistence restart, online/UI, Bước 0 hub (exit 1, `C:\brain4agent.release` thiếu).

## Câu hỏi mở
1. Sửa OPERATIONS §5.2.3 (owner NEED_INFO = cư dân) và §5.3.1 (route close chung)? Owner Trường.
2. D01 A/C: Như Ý có định mở additions sau clearance/khẩn cấp không, hay chốt D01 là NEED_INFO-only?

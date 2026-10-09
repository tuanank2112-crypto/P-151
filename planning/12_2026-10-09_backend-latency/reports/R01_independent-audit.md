# R01 — Thẩm định độc lập plan 11 + plan 12
Handoff: handoffs/H01_independent-audit.md
Base: 6d788df (plan 11) · e9960f0 (plan 12)
Head: e546262

## 1. Report auditor (tóm tắt, nguyên số)
Dòng 1 auditor: `worker · thẩm định (chỉ đọc) · Claude / Sonnet 5.5 (cùng họ với bên thi công — chưa có model khác họ) · Bước 0 exit 0`.
- pytest 3359 passed / 88 deselected / 0 skip, exit 0 · `--pg` 3447 passed, exit 0 · ruff exit 0. Repo không bị sửa (chỉ ghi DB `p151_test`, probe ở `%TEMP%\aud\`).
- 20 cách phá: plan 11 6/6 XANH (SW không cache `/api/`, token xoá khi đăng xuất, quyền theo vai 403, XSS hiện dạng chữ, `?v=`/`SHELL_CACHE` khớp, lý do bắt buộc).
- Plan 12 ĐỎ: #2 🔴 cache trình duyệt vượt quyền; #3 🟠 URL ảnh dùng lại sau reset với `immutable`; #7 🟠 đổi mã lỗi route ảnh (404/403 → 415); #14 🟠 4/7 phép phá của auditor sống (d `Content-Encoding: identity`, e/f lọc `allowed`, g LRU không giới hạn byte); #13 🟢 `gzip;q=0` vẫn nén (hành vi Starlette).
- Nghi ngờ chưa tái hiện: pool ghi 2+0 không dư (#1), `seed()` giữ lease (#2), đăng xuất khi offline (#3), `apiImage` 401 không gọi handler (#4), app điện thoại không chặn lý do trống ở form an toàn (#5).

## 2. SO đo lại (2026-10-09)
| # | Lệnh | Kết quả máy | Phán |
|---|---|---|---|
| 2 | `node %TEMP%/aud/b1.mjs` trên `:8001` memory mới | `B(other resident)= [ 200, 70 ]`; log server chỉ 1 dòng `GET …/photos/SIM-EVD-0001-01` ⇒ B lấy từ cache trình duyệt, không qua kiểm quyền | XÁC NHẬN 🔴 |
| 2 | `git show e9960f0:src/api/routers/maintenance.py` | trước plan 12: `private, max-age=3600` ⇒ lỗ đã có 1 giờ, plan 12 nới thành 1 năm + `immutable` | bối cảnh |
| 7 | đọc `add_execution_photos` ở `e9960f0` và HEAD | trước: `_staff_case` rồi mới đọc file; HEAD: `await photos.read_photos(files)` trước | XÁC NHẬN 🟠 |
| — | probe `b1.mjs` dòng `/auth/me after logout` | probe dùng token phiên khác (đăng nhập qua `ctx.request`), không phải phiên app đã đăng xuất (log: `POST /auth/logout 204`) | LOẠI — probe đo sai, không phải lỗi |
| nền | pytest (lần 1, máy tải, 332 s) | 2 FAIL `test_safety.py::test_assess_is_linear_*` (đo thời gian); chạy riêng 3/3 passed 2,4 s; chạy lại cả bộ `3359 passed` exit 0 (143 s) | nhiễu tải, không phải hồi quy |

## 3. Quyết định SO
- #7: KHÔI PHỤC thứ tự (kiểm quyền/tồn tại trước khi đọc body) — giữ hợp đồng SPEC-P02 §3 "mã lỗi KHÔNG đổi"; cái giá +1 lần đọc DB mỗi lần upload (~50 ms trên upload nhiều giây).
- #14: thêm test cho Z3 (ảnh > 1 KB giữ `identity`), lọc `allowed` ở 2 route đọc ảnh, giới hạn byte LRU — mỗi test phải ĐỎ trên phép phá tương ứng.
- #13, nghi ngờ #1–#4: Idea Vault. Nghi ngờ #5: bản web đã sửa ở plan 13; bản app ⇒ Idea Vault.
- #2 + #3: đổi `Cache-Control` ảnh = quyết định bảo mật ⇒ CHỜ NGƯỜI (người dùng yêu cầu dừng hỏi). Đề xuất: `private, no-cache` + `ETag` = ref ảnh (trình duyệt luôn hỏi server ⇒ kiểm quyền mỗi lần, 304 không kèm bytes; cache bytes phía server giữ nguyên).
- PR `feature/chamanh` → `develop`: GIỮ cho tới khi #2 sửa xong.

## 4. Sửa sau thẩm định (v1.8.2, 2026-10-09 21:06)
| # | Sửa | Đo |
|---|---|---|
| 2, 3 | `Cache-Control: private, no-cache` + `ETag: "<ref>"`; 304 chỉ sau `allowed` (Q10, người dùng chọn (c)) | R1, R1b; m6/m7/m8 đỏ; trình duyệt thật: B `[404, 43]`, A xem lại 304 (`evidence/r01-browser-recheck.txt`) |
| 7 | `_staff_case`/`_own_case` chạy trong threadpool TRƯỚC `read_photos` | R2; m9/m10 đỏ |
| 14 | test Z3 (ảnh > 1 KB `identity`), R3 (route cư dân chỉ ảnh cư dân), P5c (ngân sách byte LRU) | d/f/g đỏ; e = đột biến tương đương (evidence không phải ảnh không mang `ref` hợp lệ ⇒ `load` vẫn 404) |
| nền | pytest 3365 passed (+6) · `--pg` 3453 passed · ruff 0/0 | `evidence/mutations/r01-mutants.txt`: 8/8 đỏ, khôi phục từng byte |

## 5. Phán quyết
Plan 11 (v1.7.0): ✅ DUYỆT.
Phần sửa R01 chưa được agent khác thẩm định lại; server `:8000` chưa dựng lại.
🔁 SỬA: plan 12 — #2 #3 #7 #14 đã sửa local (v1.8.2), chờ thẩm định lại phần sửa + đo header trên `:8000`

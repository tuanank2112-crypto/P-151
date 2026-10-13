# SPEC-P01 — Bỏ UI cũ

## §1 Backend (WP1)
File: `src/main.py`, `tests/test_maintenance/{test_api,test_portal_proxy,test_mobile_static}.py`, xoá `src/web/`.
- Bỏ `app.mount("/ui", ...)`. `root()` và `_proxy_to_portal` theo 01 §1.
- Test: `test_ui_is_served` ⇒ đổi thành kiểm `/` ⇒ `/app/` và `/ui/` 404; `test_python_routes_take_priority_over_portal` bỏ dòng `/ui/`; `test_portal_unavailable_*` ⇒ `/` 503; `test_existing_routes_unchanged` bỏ `/ui/`.

## §2 App điện thoại (WP2)
File: `src/mobile/**`. Theo 01 §2. Bỏ import `webButton` ở `bptn.js`, `dept.js`, `kho.js` cùng chỗ gọi.

## §3 Portal (WP3)
Theo 01 §3. Cập nhật `portal/README.md` (chạy: `npm ci && npm run dev`, cần backend `BACKEND_URL`).

## Lỗi và hành vi
| Tình huống | Hành vi |
|---|---|
| Portal tắt, người dùng mở `/` | 503 JSON (không chuyển về trang cũ) |
| Ai đó còn bookmark `/ui/` | 404 hoặc portal xử lý (trang không tồn tại) |
| Tài khoản nội bộ mở app điện thoại | Màn `web-only`, không có link hỏng |

## Vùng cấm
- Không sửa logic màn app ngoài việc bỏ nút.
- Không sửa evidence/harness cũ của plan 11 (bằng chứng lịch sử, máy sinh).

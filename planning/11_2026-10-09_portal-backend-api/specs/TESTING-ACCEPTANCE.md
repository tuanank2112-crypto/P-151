# TESTING-ACCEPTANCE — hồ sơ 11

## 1. Nền
Base: `da1b147` (portal-fe sau khi gộp backend). Python `pytest -q` (venv 3.11, `LLM_MODE=mock`) phải ≥ số trước WP1 + test mới, 0 fail/0 skip; `ruff check src tests` sạch. Portal: `npm run typecheck`, `npm run lint`, `npm run test` EXIT=0.

## 2. Test bắt buộc
| Gói | Test | Phải đỏ trước khi sửa |
|---|---|---|
| WP1 | `tests/test_maintenance/test_portal_backend_ext.py`: tài khoản mới + profile (§1); to-bql/handled/return-to-bptn đủ đường + 403 + 409 + doc đọc được bằng model cũ (§2); vật tư mới: tạo, trùng tên, WAITING_MATERIAL → nhập kho → chạy tiếp, cờ tắt 403 (§3); 2 route sai phòng (§4). Có bản qua API (TestClient) cho mỗi route mới. | có |
| WP2 | `portal/tests/unit/backend-map.test.ts`: bảng status→stage (10 status), `urgent`, `dept`, `location` từ mô tả, `blockerLabel` đủ 16 mã, `failing_items` dịch; `errorFrom` 3 dạng `detail` + 401/403/404/409/422/5xx; chữ ký cookie phiên (hợp lệ, sửa 1 byte ⇒ null, hết hạn ⇒ null). | có |
| WP3–6 | Kiểm thử đầu-cuối = 4 bộ Playwright `portal/scripts/ui-check-WP3.mts`, `ui-check-WP4.mts cleaning|technical`, `ui-check-WP5.mts` chạy QUA CỔNG 8000 (portal production, backend memory) — thay `e2e-backend.mts` dự kiến ban đầu; phủ (a)–(f) cũ + Q10–Q19; (g) cũ "modal KHÔNG có chữ Agent" bị Q10 thay: modal hiện Agent THẬT. Ảnh 1440/390: `evidence/WP3..WP5/*.png` + ảnh thẩm định WP7. Bảng đối chiếu doc: `evidence/WP6/doc-check.md`. | — |
| Grep | `rg "@/db|server/workflow|server/queries|lib/agent|lib/duplicates" portal/src --glob '!src/db/**'` = 0 dòng (`src/db/` là lịch sử, P02 §6, `seed.ts` còn import `lib/agent`). Grep "agent" trong modal: bỏ (Q10). | — |

## 3. Bằng chứng (máy sinh, UTF-8, kết `EXIT=`) — `evidence/<WPn>/*.txt`

## 4. Exit Gates
| Gate | local | Supabase demo |
|---|---|---|
| G1 pytest + ruff | ✅ 3782 passed, ruff sạch (`evidence/WP7fix4/`) | — |
| G2 portal typecheck + lint + unit | ✅ 125 unit (`evidence/WP7fix/portal-checks.txt` + vòng sau) | — |
| G3 e2e = 4 ui-check qua cổng 8000 | ✅ (`evidence/WP7fix3/ui-8000-*.txt`) | — |
| G4 R1–R11 tự kiểm bằng ảnh chụp (bảng đối chiếu `evidence/WP6/doc-check.md`) | ✅ | — |
| G5 thẩm định cô lập (agent khác, chỉ đọc) ✅ | ✅ sau 4 vòng (Q20–Q23) | — |
| G6 đọc dữ liệu Supabase qua portal (OPERATIONS §3 bước 2–3, chỉ đọc) | — | ⬜ (chờ người dùng gật) |

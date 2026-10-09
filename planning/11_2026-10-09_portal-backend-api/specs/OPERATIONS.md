# OPERATIONS — chạy, demo, rollback (hồ sơ 11)

## 0. Cổng: UI mới mở ở 8000 (Q19)
Backend chạy cổng **8000** với `PORTAL_URL=http://127.0.0.1:3000` ⇒ mọi đường ngoài `/api/v1`, `/ui`, `/health`, `/docs` được chuyển tiếp sang portal Next.js (cổng 3000, chạy `BACKEND_URL=http://127.0.0.1:8000`). Người dùng mở http://localhost:8000 = UI mới. UI tĩnh `/ui/` KHÔNG dùng để demo.

## 1. Dev local (KHÔNG chạm Supabase)
```bash
# backend (repo này, store memory, LLM mock) — cổng 8000
MO_STORE=memory MO_PHOTO_STORE=local LLM_MODE=mock DATABASE_URL= MO_CUSTOM_MATERIALS=true \
  PORTAL_URL=http://127.0.0.1:3000 PYTHONUTF8=1 .venv/Scripts/python.exe -m uvicorn src.main:app --host 127.0.0.1 --port 8000
# portal — cổng 3000 (người dùng mở qua 8000)
cd portal && BACKEND_URL=http://127.0.0.1:8000 SESSION_SECRET=dev-only npm run dev
```
- Mở http://localhost:8000 (UI mới qua backend), đăng nhập `cudan`/`tiepnhan`/`quanly`/`vesinh`/`kythuat`/`kho`, mật khẩu `123456`.
- Backend memory: khởi động lại = về 12 ticket mẫu, mọi phiên đăng nhập mất (token trong RAM) ⇒ portal tự về `/login`.
- `portal/.env.local` KHÔNG chứa `BACKEND_URL` trỏ Supabase/Render (gotcha: `next dev` tự nạp lại `.env.local`).

## 2. Docker compose
`portal` service: thêm `BACKEND_URL=http://backend:8000` (đã có), `SESSION_SECRET` từ `.env`; bỏ phụ thuộc DB `portal` khỏi luồng chạy (service `db` vẫn còn cho `pytest --pg`). Backend proxy `/` sang portal như hiện tại.

## 3. Demo trên dữ liệu Supabase (CẦN NGƯỜI DÙNG ĐỒNG Ý TỪNG BƯỚC — ghi DB dùng chung)
Thứ tự BẮT BUỘC:
1. Hỏi người dùng: "Trỏ portal vào dữ liệu Supabase thật? Mọi thao tác bấm thử sẽ ghi vào DB nhóm." Chưa gật ⇒ dừng ở §1.
2. Backend trỏ Supabase: chạy backend local bằng `.env` của repo chính (đã có `DATABASE_URL` Supabase, `MO_STORE=postgres`), `MO_JOBS_ENABLED=false`, `MO_ALLOW_RESET=false`, `MO_CUSTOM_MATERIALS=false`, cổng 8002. Kiểm đọc: `GET /api/v1/mo/tickets` với `bptn01` ⇒ thấy ticket thật (số lượng ghi vào evidence).
3. Portal `BACKEND_URL=http://127.0.0.1:8002`. Đăng nhập `quanly` ⇒ tổng ticket khớp bước 2.
4. (Tuỳ chọn, hỏi riêng) Bật vật tư mới trên Supabase: chạy Alembic `0003_material_items` (chỉ tạo bảng) + `MO_CUSTOM_MATERIALS=true`. Rủi ro: bản Render cũ gặp mã `SIM-MAT-X-*` trong ticket ⇒ chưa đo; chỉ bật sau khi Render chạy code có `self.material()` hoặc người dùng chấp nhận rủi ro.
5. Revision `0003` là bảng mới, code cũ không đọc ⇒ không cần dừng writer (khác plan 06 OPERATIONS §5).

## 3b. Nhánh (Q19)
Backend thật của nhóm = `develop`. Đưa code hồ sơ này lên `develop` bằng PR (`feature/nhuy-portal-fe` → `develop`, gồm cả PR #19 vì nhánh đã gộp `feature/nhuy-reasoning-agent`); KHÔNG push thẳng `develop` (bị chặn "merge without review"). Bản Render chạy code mới sau khi PR merge + deploy (người của nhóm làm).
Bảng mới trên Supabase: `0003_material_items`, `0004_portal_extras` (chỉ CREATE TABLE) — chạy khi người dùng gật OPERATIONS §3.

## 4. Rollback
| Sự cố | Làm |
|---|---|
| Portal mới lỗi khi demo | checkout `portal/` về `57032c3` (bản DB riêng) + `DATABASE_URL` cũ — dữ liệu portal cũ còn nguyên (không xoá bảng). |
| Route backend mới lỗi | route mới độc lập; revert commit WP1; doc ticket không đổi hình nên không cần sửa dữ liệu. |
| Bảng `material_items` | `DROP TABLE maintops.material_items` CHỈ khi không ticket nào dùng mã `SIM-MAT-X-*` (`select count(*) from maintops.cases where doc::text like '%SIM-MAT-X-%'` = 0). |

## 5. Phiên bản
MINOR: `portal/package.json` 1.6.0 → 1.7.0; `brain4agent/changelog.md` mục `[v1.7.0]`; `state.json.current_version`.

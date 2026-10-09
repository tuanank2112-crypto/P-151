# 11 — Portal Next.js gọi backend (dữ liệu Supabase) theo ghi chú anh Cố

| Trường | Giá trị |
|---|---|
| Trạng thái | 🟢 Người dùng giao 2026-10-09 ("tôi muốn portal gọi backend nhé. làm luôn đi", "và cả data trong supabase", "toàn bộ theo quy tắc và nội dung trong link") — đang thi công |
| Loại SemVer | MINOR (portal đổi nguồn dữ liệu; backend thêm route/bảng mới, giữ API cũ) ⇒ 1.7.0 |
| Nguồn yêu cầu | Google Doc `1tlvFRnAioxn7LFHTNlM9TQgYzIDzx25ZC4pFxqB3qiA` (ghi chú anh Cố, R1–R11) · nghiệp vụ `docs/CR-BPTN-03.md` |
| Chủ việc | Như Ý (sở hữu `portal/` từ 2026-10-08 + engine) |
| Nhánh | `feature/nhuy-portal-fe` (worktree `D:/P151-portal-fe`), đã gộp `feature/nhuy-reasoning-agent` (`da1b147`) |
| Base đo | `da1b147` |

**Mục tiêu một câu:** portal hiện và thao tác dữ liệu thật của backend (engine CR-03, Agent, tầng an toàn; Supabase khi demo), đủ 11 yêu cầu của anh Cố, không còn DB riêng.

## §2. Nhật ký quyết định
| # | Mốc | Quyết định | Nguồn / lý do | Lật · chi phí |
|---|---|---|---|---|
| Q01 | 2026-10-09 10:43:13 +0700 | Portal gọi backend `/api/v1` cho mọi dữ liệu; bỏ DB riêng ở luồng chạy (giữ file) | Người dùng; Châm Anh báo portal chưa nối backend | Quay lại DB riêng = checkout `57032c3` · thấp |
| Q02 | 2026-10-09 10:43:13 +0700 | Doc anh Cố là nguồn yêu cầu giao diện; lệch CR-03 thì CR-03 thắng trừ chỗ doc nói rõ (khi đó mở rộng backend) | Người dùng: "toàn bộ theo quy tắc và nội dung trong link", "tuân thủ đúng nội dung và yêu cầu trong link" | — |
| Q03 | 2026-10-09 10:43:13 +0700 | Bỏ khỏi portal: thông báo (hoãn), phân công nhân viên, cư dân xác nhận/hủy, thẻ+bình luận đánh giá, Agent từ khoá + %, tự tính trùng, cư dân tự chọn khẩn cấp | CR-03 + doc R3/R4 + người dùng "bảng thông báo tôi sẽ xem xét sau"; 00 §2 | Thêm lại từng mục cần mở rộng backend · trung bình |
| Q04 | 2026-10-09 10:43:13 +0700 | "Việc của BQL" = ticket `OUT_OF_SCOPE` có `blocker.escalated` (trường có sẵn); BQL đóng (`handled`) hoặc trả Tiếp nhận | Doc R11; không thêm phòng/mã lỗi mới để không vỡ bản Render cũ đọc chung Supabase | Thêm `DEPT_BQL` thật cần CR mới + rollout · cao |
| Q05 | 2026-10-09 10:43:13 +0700 | Vật tư ngoài danh mục: bảng mới `maintops.material_items` + cờ `MO_CUSTOM_MATERIALS` (mặc định tắt trên postgres) | Doc R7; bảng mới không ảnh hưởng code cũ; mã lạ trong doc ticket chưa đo với Render | Bật trên Supabase: OPERATIONS §3 bước 4 |
| Q06 | 2026-10-09 10:43:13 +0700 | Tài khoản portal (`cudan`…`kho` / `123456`) thêm vào `accounts.yaml` backend, giữ tài khoản cũ | Doc R5 | — |
| Q07 | 2026-10-09 10:43:13 +0700 | Phiên portal = cookie ký HMAC chứa token backend (8 giờ), không bảng `sessions` | I-03; backend là nguồn quyền | — |

### Quyết định bị thay thế
| Cũ | Thay bằng |
|---|---|
| portal plan 06 (2026-10-07) Q01 "portal độc lập backend, Agent từ khoá TS" | Q01, Q03 hồ sơ này |

## §3. Work Packages
| WP | Việc | Tầng | Phụ thuộc | File được chạm |
|---|---|---|---|---|
| WP1 | Backend: SPEC-P01 §1–§4 + test | 🟠 | — | `seed/maintenance_v1/accounts.yaml`, `src/api/auth.py`, `src/api/routers/maintenance.py`, `src/maintenance/engine.py` (method mới + `material()`), `src/maintenance/coordination/*.py` (nếu đặt method ở mixin), `src/maintenance/store/{base,memory,postgres}.py`, `src/maintenance/store/migrations/versions/*0003*`, `src/config.py`, `src/maintenance/views.py` (CatalogView), `tests/test_maintenance/test_portal_backend_ext.py` |
| WP2 | Portal nền: SPEC-P02 + 01 §3–§8 (dto, map, loader mọi vai, action mọi vai, phiên, ảnh, login) | 🟠 | — (viết theo contract; chạy thật sau WP1) | `portal/src/server/**`, `portal/src/lib/{dto,backend-map,constants,result}.ts`, `portal/src/app/actions/**`, `portal/src/app/api/**`, `portal/src/app/login/**`, `portal/src/app/*/page.tsx`, `portal/tests/unit/**`, `portal/vitest.config.mts` |
| WP3 | UI Cư dân + Tiếp nhận (SPEC-P03 §2–§3) | 🟠 | WP2 | `portal/src/app/resident/**`, `portal/src/app/reception/**` |
| WP4 | UI Vệ sinh + Kỹ thuật (SPEC-P03 §4) | 🟠 | WP2 | `portal/src/app/cleaning/**`, `portal/src/app/technical/**` |
| WP5 | UI Quản lý + Kho + modal chi tiết (SPEC-P03 §5–§7) | 🟠 | WP2 | `portal/src/app/management/**`, `portal/src/app/warehouse/**`, `portal/src/components/**` |
| WP6 | E2E + ảnh + bảng đối chiếu doc (TESTING §2, G3–G4) | 🟠 | WP1, WP3–5 | `portal/scripts/e2e-backend.mts`, `evidence/**` |
| WP7 | Thẩm định cô lập (chỉ đọc) | 🔴 | WP6 | — |
| WP8 | Đồng bộ não + docs (`docs/portal.md`, `docs/maintenance.md`) + version 1.7.0 | 🟢 | WP7 | `brain4agent/**`, `docs/**`, `portal/package.json` |

## §4. Checklist thực thi
- [x] Khảo sát portal + API backend + đối chiếu doc (3 agent đọc) — 2026-10-09
- [x] Bộ SPEC (00, 01, P01–P03, OPERATIONS, TESTING) — 2026-10-09
- [ ] WP1 · [ ] WP2
- [ ] WP3 · [ ] WP4 · [ ] WP5
- [ ] WP6 (G3, G4) · [ ] WP7 (G5)
- [ ] G6 Supabase demo (chờ người dùng gật — OPERATIONS §3)
- [ ] WP8 · [ ] Sign-off `✅ ĐÃ HOÀN THÀNH` + mốc giây

## §5. Bảng trỏ SPEC
| File | Nội dung |
|---|---|
| [specs/00-ARCHITECTURE.md](specs/00-ARCHITECTURE.md) | Mục tiêu, vùng cấm, bất biến, R1–R11 → SPEC |
| [specs/01-CONTRACTS.md](specs/01-CONTRACTS.md) | Env, vai, status→stage, DTO, gọi đọc/ghi, lỗi |
| [specs/SPEC-P01-backend-ext.md](specs/SPEC-P01-backend-ext.md) | Tài khoản, Việc của BQL, vật tư mới, route sai phòng |
| [specs/SPEC-P02-portal-client.md](specs/SPEC-P02-portal-client.md) | `backend.ts`, phiên, act, ảnh, dọn DB |
| [specs/SPEC-P03-screens.md](specs/SPEC-P03-screens.md) | Từng màn theo doc |
| [specs/OPERATIONS.md](specs/OPERATIONS.md) | Chạy dev, demo Supabase (cần gật), rollback |
| [specs/TESTING-ACCEPTANCE.md](specs/TESTING-ACCEPTANCE.md) | Test, evidence, Exit Gates |

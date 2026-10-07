# 06 — Cổng phản ánh cư dân: website Next.js từ bộ thiết kế (2026-10-07)

| Trường | Giá trị |
|---|---|
| Trạng thái | 🟡 LOCAL ✅ (2026-10-07 10:31:00 +07) — chờ gate server + người dùng duyệt D1–D9 |
| Loại | MINOR (thư mục top-level mới `portal/`, khung mới Next.js/TypeScript) — đủ bộ SPEC |
| Yêu cầu | Người dùng, 2026-10-07: "Đọc HANDOFF.md và các file trong design/. Dựng ứng dụng web [Next.js + TypeScript + Tailwind + PostgreSQL] theo đúng giao diện và hành vi trong các file .dc.html. Làm theo thứ tự: dữ liệu → đăng nhập và phân quyền → Cư dân → Ban tiếp nhận → các phòng ban → Ban quản lý. Xong màn nào thì so lại với file thiết kế tương ứng." |
| Nguồn thiết kế | `design-ticket-cu-dan/design-ticket-cu-dan/` (`HANDOFF.md`, `design/*.dc.html`) |
| Nhánh | `dev` (làm việc tại chỗ, chưa commit) |
| Phạm vi | CHỈ `portal/` + hồ sơ này + đồng bộ não. KHÔNG chạm `src/`, `tests/`, `seed/` của backend Python |

## §1. Nhật ký quyết định
| # | Mốc | Quyết định | Lý do |
|---|---|---|---|
| Q01 | 2026-10-07 | App độc lập trong `portal/`, KHÔNG nối engine Python | HANDOFF mô tả sản phẩm riêng, mô hình dữ liệu riêng; người dùng chỉ định stack Next.js + PostgreSQL |
| Q02 | 2026-10-07 | Drizzle ORM + `pg` (không Prisma) | Người dùng bỏ "Prisma/" khỏi prompt mẫu của HANDOFF; Drizzle nhẹ, migration SQL thuần, không cần engine nhị phân |
| Q03 | 2026-10-07 | Session tự viết (scrypt của Node + bảng `sessions`), không thư viện auth | 5 vai cố định, đăng nhập tên/mật khẩu; ít phụ thuộc, kiểm soát được |
| Q04 | 2026-10-07 | Postgres local = container `p151-db-1` sẵn có, DB riêng `portal` / `portal_test` | Không đụng DB `p151` của backend |
| Q05 | 2026-10-07 | Giữ `cacheComponents: true` (mặc định Next 16.4, bản lớn sau bắt buộc), đọc session trong `<Suspense>` | Tránh phải chuyển đổi về sau |
| Q06 | 2026-10-07 | Một mô hình stage 1..6 cho mọi vai, lệch thiết kế D1–D9 ghi ở `specs/00-ARCHITECTURE.md` §5 | Thiết kế mỗi file một mô hình trạng thái riêng |
| Q07 | 2026-10-07 | Dùng nguyên class CSS của thiết kế (chép vào `globals.css`) thay vì dịch sang tiện ích Tailwind | Khớp màu/kích thước tuyệt đối, dễ đối chiếu từng dòng |
| Q08 | 2026-10-07 | Agent so khớp NGUYÊN TỪ (ranh giới Unicode) thay vì chuỗi con của thiết kế | Đo: "ồn" khớp "cộng đồng", "ống" khớp "chống" |
| Q09 | 2026-10-07 | Ảnh trả `Cache-Control: private, no-store` | E2E đỏ: kỹ thuật thấy ảnh ticket vệ sinh từ cache trình duyệt sau khi Ban tiếp nhận xem |
| Q11 | 2026-10-07 | **Người dùng:** "Không để cho phòng vệ sinh và phòng kỹ thuật thấy được là ai đã gửi phản ánh, nhưng phải cho họ thấy được đánh giá, và feedback." ⇒ dữ liệu màn phòng ban không có tên/tài khoản/mã cư dân, tên file ảnh đổi thành "Ảnh N"; thẻ "Hoàn thành" + tab Lịch sử hiện số sao, thẻ nhận xét, bình luận (chỉ việc của phòng mình). Giữ số căn hộ trong vị trí khi sự cố "Trong căn hộ" (cần để đến sửa) | Quyết định người dùng; test `tests/db/queries.test.ts` (3 phép phá đều đỏ) |
| Q12 | 2026-10-07 | **Người dùng:** "Bỏ trang phân quyền ở bql đi, bỏ quy tắc từ khóa ở ban tiếp nhận thông tin đi, vì phân loại trùng là do agent đưa ra và ban tiếp nhận chỉ duyệt" ⇒ bỏ tab Phân quyền (BQL), tab Quy tắc từ khóa + action `addKeyword/removeKeyword` + quyền `edit_keywords` (Ban tiếp nhận). Từ khóa vẫn là dữ liệu bảng `keywords`, chỉ đổi qua seed/SQL | Quyết định người dùng |
| Q13 | 2026-10-07 | **Người dùng:** "hãy đưa cả hai ticket có khả năng trùng để … so sánh" ⇒ Agent tự phát hiện trùng (`lib/duplicates.ts`: cùng phòng ban gợi ý + cùng vị trí + ≥1 từ khóa chung, ticket cũ hơn còn mở, ≤7 ngày); thẻ chờ phân loại hiện hai ticket cạnh nhau + lý do + %; Ban tiếp nhận chỉ duyệt "Đúng, gộp" hoặc "Không trùng" (lưu `dup_dismissed`, migration `0001`). Server CHẶN gộp cặp Agent không đề xuất. Đặt ở Ban tiếp nhận vì đó là nơi duyệt; người dùng ghi "ban quản lý so sánh" — chờ xác nhận | Quyết định người dùng; test `duplicates.test.ts`, `workflow.test.ts` (2 phép phá đều đỏ) |
| Q10 | 2026-10-07 | Test đồng thời tất định (giữ khoá dòng từ kết nối khác) | Bản `Promise.all` không đỏ khi bỏ `FOR UPDATE` |

### Quyết định bị thay thế
- D6 "ô chọn Gộp vào ticket trùng (nhân viên tự chọn)" → thay bởi Q13 (Agent đề xuất, Ban tiếp nhận chỉ duyệt).
- SPEC-P02 §2 tab "Quy tắc từ khóa" (Ban tiếp nhận) và "Phân quyền" (BQL) → bỏ theo Q12.
- 01-CONTRACTS §6 `Cache-Control: private, max-age=300` → thay bởi Q09 (`no-store`).
- 01-CONTRACTS A3 "UPDATE có điều kiện" → giữ, BỔ SUNG khoá `SELECT … FOR UPDATE` trước khi kiểm tiền điều kiện.

## §2. Work Packages
| WP | Việc | Tầng | SPEC |
|---|---|---|---|
| WP1 | Schema + migration + seed + DB client | 🔴 | 01-CONTRACTS §1–2, SPEC-P01 §1, §6 |
| WP2 | Đăng nhập, session, phân quyền, khung chung | 🔴 | SPEC-P01 §2–5, SPEC-P02 §1 |
| WP3 | Màn Cư dân + action cư dân | 🟠 | SPEC-P02 §2–3, 01-CONTRACTS §4 |
| WP4 | Màn Ban tiếp nhận + action | 🟠 | như trên |
| WP5 | Màn Phòng vệ sinh, Phòng kỹ thuật + action | 🟠 | như trên |
| WP6 | Màn Ban quản lý + action | 🟠 | như trên |
| WP7 | Test unit + DB, chụp màn, đối chiếu thiết kế | 🟠 | TESTING-ACCEPTANCE |
| WP8 | Đồng bộ não (Ma Trận 6 Điểm + project-intro + data-architecture), version 1.2.0 | 🟢 | AGENTS §5.B |

## §3. Checklist thực thi
- [x] WP1 dữ liệu: schema, migration, seed, `db:migrate`/`db:seed` chạy trên `portal`
- [x] WP2 đăng nhập + session + phân quyền + khung chung; so `Main.dc.html`
- [x] WP3 Cư dân; so `Resident.dc.html`
- [x] WP4 Ban tiếp nhận; so `Reception.dc.html`
- [x] WP5 Phòng vệ sinh, Phòng kỹ thuật; so `Cleaning.dc.html`, `Technical.dc.html`
- [x] WP6 Ban quản lý; so `Management.dc.html`
- [x] WP7 G1–G6 local (TESTING-ACCEPTANCE §3)
- [x] WP8 đồng bộ não + version

## §4. Bảng trỏ SPEC
| File | Nội dung |
|---|---|
| [`specs/00-ARCHITECTURE.md`](specs/00-ARCHITECTURE.md) | Mục tiêu, non-goals, bất biến A1–A7, lệch thiết kế D1–D9 |
| [`specs/01-CONTRACTS.md`](specs/01-CONTRACTS.md) | Schema, stage, Agent, Server Actions, lỗi, route ảnh |
| [`specs/SPEC-P01-DATA-AUTH.md`](specs/SPEC-P01-DATA-AUTH.md) | DB client, session, phân quyền, phạm vi đọc, seed |
| [`specs/SPEC-P02-SCREENS.md`](specs/SPEC-P02-SCREENS.md) | 6 màn ↔ file thiết kế, quy tắc tính toán |
| [`specs/OPERATIONS.md`](specs/OPERATIONS.md) | Biến môi trường, thứ tự chạy, rollback |
| [`specs/TESTING-ACCEPTANCE.md`](specs/TESTING-ACCEPTANCE.md) | Ma trận test, Exit Gates |

## §5. Kết quả Exit Gates (đo 2026-10-07, output máy ở `evidence/gates/`, `evidence/e2e/`, `evidence/screens/`)
| Gate | local | server |
|---|---|---|
| G1 typecheck + lint 0 lỗi | ✅ `typecheck.txt`, `lint.txt` exit 0 | ⬜ |
| G2 unit xanh, 0 skip | ✅ 14/14 `test.txt` | ⬜ |
| G3 test:db Postgres thật, 0 skip | ✅ 15/15 `test-db.txt`; đã đỏ với 2 phép phá (bỏ phạm vi cư dân; bỏ FOR UPDATE + stage) | ⬜ |
| G4 build production | ✅ `build.txt` exit 0 (mọi dashboard ◐ Partial Prerender) | ⬜ |
| G5 6 màn đối chiếu thiết kế | ✅ 38 ảnh 1440/390px, 0 tràn ngang `screens.txt`; báo cáo `reports/R01_design-compare.md` | — |
| G6 luồng end-to-end | ✅ `e2e-prod.txt` trên `next start` | ⬜ |

# Changelog & Semantic Releases

Tất cả các quyết định kiến trúc và lịch sử nâng cấp phiên bản của dự án.

## [v1.9.4] - 2026-10-10: App BPTN — 4 ô số liệu bấm được để lọc
### Changed
- `src/mobile/js/staff.js` `queueScreen`: `stats` đổi thành `[[key, label, test]]`, mỗi ô là `button.card.stat.pick[data-tab]` trong `#staff-stats` (lọc như tile, ô đang chọn viền xanh). `bptn.js`: Hàng chờ (`queue`) · Hoàn thành (`done`, `CLOSED`) · Nghi trùng (`duplicate`) · Tổng (`all`) (plan 11 Q39). `?v=12` + `SHELL_CACHE` v12. API không đổi.
### Measured
- `node --check` 11 file; `test_mobile_static.py` 5 passed. Playwright bptn01 `:8001`, `GET /mo/tickets` giả 9 dòng: 4 ô = 4/2/2/9, bấm từng ô hiện đúng 4/2/2/9 thẻ + đúng ô sáng + đúng tiêu đề, tile An toàn B2 ⇒ không ô nào sáng, 0 lỗi JS — 7/7 PASS. Phép phá (Hoàn thành = mọi ticket) ⇒ P1/P-done ĐỎ. Phòng ban `vesinh01` vẫn PASS.

## [v1.9.3] - 2026-10-10: App BQL xử lý an toàn Bậc 2 đã leo thang ngay trên điện thoại
### Changed
- `src/mobile/js/bql.js` `#/b/<id>`: bỏ nút "Xử lý trên web"; form `#bql-safety` 3 quyết định (Xác nhận an toàn · Yêu cầu cư dân bổ sung · Nâng lên Khẩn cấp Bậc 1) ⇒ `POST /mo/tickets/{id}/safety`; lý do trống ⇒ không gọi API (plan 11 Q38, thay vùng cấm SPEC-P03 §41). `?v=11` + `SHELL_CACHE` `mo-app-shell-v11`. API/engine không đổi.
### Measured
- `node --check` 11 file 0 lỗi; `test_mobile_static.py` 5 passed. Playwright bql01 trên backend memory `:8001` (3 ticket "tiếng nổ" Bậc 2, `run_jobs(+5 h)` ⇒ `escalated`): S0–S6 + JS 8/8 PASS — form 3 nút, lý do trống 0 request, CONFIRM_SAFE ⇒ hết vướng an toàn (chạy lại pipeline), REQUEST_INFO ⇒ `NEED_INFO`, ESCALATE ⇒ `EMERGENCY_PENDING_BQL` và màn chuyển sang khối khẩn cấp. Phép phá (nút Xác nhận gửi `REQUEST_INFO`) ⇒ S3 ĐỎ.
### Not measured
- Harness M1–M17; thao tác ghi trên Supabase `:8000` (chỉ đọc).

## [v1.9.2] - 2026-10-10: App điện thoại Kho — Nhập vật tư + Cảnh báo tồn kho dưới ngưỡng
### Changed
- `src/mobile/js/kho.js` `#/k`: tile "Chờ vật tư" ⇒ "Nhập vật tư" (form `#kho-receive` + danh sách phản ánh chờ vật tư); "Tồn kho" chỉ còn danh sách; tile mới "Cảnh báo" (`#kho-low`): `qty < 30` tăng dần, đỏ `< 20`, vàng `20–29`, "Nhập thêm" điền sẵn `30 − qty`. Ô số liệu 1 = "Dưới ngưỡng" (plan 11 Q37, theo ảnh người dùng). Ngưỡng là hằng `LOW_STOCK`/`CRITICAL_STOCK`.
- Harness plan 11 M16: bấm tile `receive` trước khi nhập kho. `?v=10` + `SHELL_CACHE` `mo-app-shell-v10`. API không đổi.
### Measured
- `node --check` 11 file 0 lỗi; `test_mobile_static.py` 5 passed; Playwright kho01 trên backend memory `:8001` mới: K1–K8 + JS 9/9 PASS (3 tile, cảnh báo = 4 dòng khớp `GET /mo/warehouse/stock` `< 30`, mức đỏ/vàng đúng, điền sẵn BAG-01 20 ⇒ 10, nhập xong 20 → 30 và rời cảnh báo, Tồn kho 5/5 dòng không form, 0 lỗi JS). Phép phá (lọc `< 20`) ⇒ K3/K5 ĐỎ.
### Not measured
- Harness đầy đủ M1–M17, server `:8000`, điện thoại thật.

## [v1.9.1] - 2026-10-10: App điện thoại — Phòng ban và BQL chỉ lưu việc đã hoàn thành
### Changed
- `src/mobile/js/dept.js` `#/d`: tile 4 "Tất cả" (mọi ticket) ⇒ "Hoàn thành" (`status = CLOSED`), tiêu đề "Việc đã hoàn thành", theo ảnh người dùng (plan 11 Q35). Tile "Tất cả" của BPTN giữ.
- `src/mobile/js/bql.js` + `app.css` `#/b`: bỏ hàng tile tròn (Cần tôi/Khẩn cấp/Tất cả); 4 ô số liệu thành bộ lọc (`#bql-tabs` `button.card.stat.pick[data-tab]`): Cần BQL · Khẩn cấp · Quá hạn · Hoàn thành (`CLOSED`, thay "Tổng") (plan 11 Q36). Chi tiết cũng không tile.
- `?v=9` mọi import + `SHELL_CACHE` `mo-app-shell-v9`. API không đổi.
### Measured
- `node --check` 11 file 0 lỗi; `test_mobile_static.py` 5 passed; Playwright `:8001` (memory, `GET /mo/tickets` giả 9 trạng thái) vesinh01: badge 2, danh sách = 2 ticket `CLOSED`, Chờ nhận không đổi, 0 lỗi JS — 6/6 PASS; phép phá (lọc `() => true`) ⇒ T2/T3 ĐỎ.
- Playwright `:8001` bql01, `GET /bql/tickets` giả 9 dòng: không tile, 4 ô = 2/1/1/2, mỗi ô lọc đúng, chi tiết có Quay lại và giữ lọc, 0 lỗi JS — 10/10 PASS; phép phá ("Hoàn thành" = mọi ticket) ⇒ B2/B5/B7 ĐỎ. Bộ chọn harness M11 `#bql-tabs [data-tab="emergency"]` giữ nguyên.
### Not measured
- Harness plan 11 M1–M17 (chỉ chạy 06:00–22:00), server `:8000`.

## [v1.9.0] - 2026-10-10: Tài sản đèn theo khu vực (plan 14, MINOR)
### Changed
- Catalog: 4 tài sản active `SIM-ASSET-LIGHT-{HALLWAY,LIFT-LOBBY,STAIRS,WASTE-ROOM}` (mỗi khu vực một cái); 6 mã cũ `…-001…006` thành `RETIRED_SIMULATED` (ticket cũ vẫn giữ mã). `Asset` thêm `name`, `area`; validator ≤1 active mỗi khu vực.
- Engine bước 6 so `rules.location_area(location)` với `asset.area` (trước: trọn chuỗi vị trí); `bptn_resolve` từ chối mã không active. Agent: `AssetCandidate{asset_id, area}`, prompt `agent-prompt/2` (REF plan 06 cùng chữ).
- `/mo/catalog` `assets` = `[{asset_id, name, area}]` chỉ active; dropdown BPTN app (`?v=7`, `SHELL_CACHE` v7) và web (`app.js?v=4.2`) hiện tên.
- Ticket mẫu: TEC-002 → hầm B1 (giữ kịch bản ASSET_UNCLEAR), TEC-006 → cầu thang bộ (giữ kịch bản tồn kho không rõ).
### Measured
- pytest 3382 passed (trước 3365; +17 `test_area_assets.py`) exit 0; ruff check/format 0; 12/12 ticket mẫu, 4/4 demo; phép phá m1–m4 4/4 RED; REF `--selftest` 0 lỗi; Playwright `:8001` dropdown app + web = 4 tên, ALL PASS.
### Not measured
- `pytest --pg`, eval Agent LLM thật (`REF --live`), server `:8000`.

## [v1.8.4] - 2026-10-10: App điện thoại — BPTN thấy số phản ánh hoàn thành
### Changed
- `src/mobile/js/bptn.js` `#/p`: ô số liệu thứ 2 "An toàn B2" ⇒ "Hoàn thành" = số ticket `CLOSED` (trừ ticket mẫu), theo ảnh người dùng (plan 11 Q34). Tile "An toàn B2" giữ nguyên. `?v=6` mọi import + `SHELL_CACHE` `mo-app-shell-v6`. API không đổi.
### Measured
- `node --check` 11 file 0 lỗi; `test_mobile_static.py` 5 passed; Playwright `:8001` (memory), 3 ticket, BQL đóng 1 ⇒ bptn01 thấy `Hàng chờ 1 · Hoàn thành 1 · Nghi trùng 0 · Tổng 3`, khớp API (`CLOSED` = 1).

## [v1.8.3] - 2026-10-10: App điện thoại — chọn vị trí trước khi mô tả
### Changed
- `src/mobile/js/resident.js` `#/r/new`: thẻ 1 = Vị trí sự cố, 2 = Mô tả vấn đề, 3 = Ảnh (trước: Mô tả trước). Placeholder/gợi ý đổi số bước. `?v=5` mọi import + `SHELL_CACHE` `mo-app-shell-v5`. API/chuỗi gửi không đổi (plan 11 Q33).
### Measured
- `node --check` 10 file 0 lỗi; `test_mobile_static.py` 5 passed; Playwright `:8001` (memory) cudan01 ⇒ thứ tự thẻ `1 Vị trí · 2 Mô tả · 3 Ảnh`.

## [v1.8.2] - 2026-10-09: Sửa plan 12 sau thẩm định độc lập (R01)
### Security
- Ảnh: `Cache-Control: private, no-cache` + `ETag` (thay `max-age=31536000, immutable`). Trước: cùng trình duyệt, tài khoản khác mở được ảnh từ cache mà server không kiểm quyền (R01 #2, 🔴; lỗ 1 giờ có từ trước plan 12). Sau: B nhận 404, chủ ảnh nhận 304 không kèm bytes. URL dùng lại sau reset nhận bytes mới (#3).
### Fixed
- Upload ảnh kiểm quyền/tồn tại ticket trước khi xét file ⇒ mã lỗi như trước plan 12 (#7). +6 test (R1–R3, Z3, P5c), phép phá 8/8 đỏ.
### Decisions
- Người dùng chọn (c): ảnh xem lại giữ ~56 ms (1 câu SQL kiểm quyền), không cache quyền, không URL ký. G5 → "≤ median GET + 10 ms".

## [v1.8.1] - 2026-10-09: Hotfix lý do bắt buộc ở form BPTN web (plan 13)
### Fixed
- `src/web/app.js` `bptnForm`: BPTN chọn/sửa giá trị (vị trí, thông tin, loại việc, phòng ban, tài sản, xác định tại hiện trường) mà để trống lý do ⇒ chặn ở client (trước: gửi đi, engine trả 409 GUARD_FAILED). Cùng luật `VALUE_KEYS` với app điện thoại.
- Form An toàn Bậc 2: "Xác nhận an toàn" và "Yêu cầu cư dân bổ sung" bắt buộc lý do (engine vốn bắt buộc); "Nâng mức" vẫn không bắt buộc.
### Measured
- Harness Playwright `:8001` W1–W6 ALL PASS; 2/2 phép phá đỏ. API/engine không đổi.
### Decisions
- Ảnh xem lại 56 ms (plan 12 G5): đã ở 1 vòng DB (`repo.get`) như mọi GET ~50 ms; xuống 0 vòng phải cache dữ kiện kiểm quyền hoặc đổi URL ảnh ⇒ chạm bảo mật/API, chờ người dùng quyết (Idea Vault).

## [v1.8.0] - 2026-10-09: Giảm độ trễ backend (plan 12)
### Changed
- Đọc DB qua engine `AUTOCOMMIT` riêng (`sql_read_engine`, `PostgresRepository._read`, thử lại 1 lần khi rớt kết nối); engine ghi giữ pre-ping. Tổng ≤5 kết nối.
- Route ảnh: I/O đồng bộ chuyển vào threadpool; một lô ảnh = một transaction (`add_resident_photos`, `add_execution_photos`), tất cả hoặc không.
- Cache bytes ảnh trong tiến trình (LRU 32 MB) + `Cache-Control: private, max-age=31536000, immutable`; gzip JSON > 1 KB; `run_jobs` bỏ một lần đọc dưới khoá.
### Measured (`:8000`, Supabase)
- GET 226–280 ms → 50–55 ms; danh sách 54–69 KB → ~4 KB trên dây; ảnh xem lại 527 → 56 ms; event loop không còn đứng ~1 s khi upload chờ Storage.
### Decisions
- Không làm: khoá theo ticket, bỏ audit khỏi doc (đổi schema), `/bql/tickets/{id}` (API mới), gỡ route mẫu `/api/v1/chat` (phải xoá test) ⇒ Idea Vault.

## [v1.7.0] - 2026-10-09: App điện thoại (PWA) cho Cư dân và BQL (plan 11)
### Added
- `src/mobile/` (phục vụ ở `/app/`, một dòng mount trong `src/main.py`): Cư dân gửi phản ánh kèm ảnh chụp (nén ≤1600 px), theo dõi, bổ sung, thêm ảnh, đánh giá; BQL 3 tab Cần tôi/Khẩn cấp/Tất cả + nghiệm thu, trả làm lại, hủy, đóng/hạ mức khẩn cấp. Vai khác ⇒ màn "Dùng bản web".
- `manifest.json` + `sw.js` + icon ⇒ cài lên màn hình chính khi chạy HTTPS. `docs/mobile.md`, `tests/test_maintenance/test_mobile_static.py` (5 test).
### Decisions
- PWA, KHÔNG React Native/Flutter (giao nhanh trước 19/10; bọc Capacitor sau nếu cần store). Client mỏng gọi API sẵn có, không endpoint mới ⇒ web và app cùng DB.
- Đồng bộ = tải lại 30 s khi app đang hiện + ngay khi quay lại/có mạng; service worker KHÔNG cache `/api/`; không ghi offline. Realtime ⇒ Idea Vault.
- Không Tailwind CDN/framework, không bước build; token lưu `localStorage['mo-app-token']` (app nhớ đăng nhập, session server vẫn TTL 8 h).
- Ảnh cư dân gửi được ở mọi trạng thái chưa kết thúc (theo guard engine), bổ sung chữ chỉ khi `NEED_INFO` (theo `allowed_actions`).
### Added (đợt 3, cùng ngày — SPEC-P05, Q26–Q31)
- App cho mọi vai vận hành: Phòng ban (`js/dept.js` — nhận việc, chụp ảnh sau xử lý, checklist, vật tư, ghi chú, báo hoàn thành, vướng/sai phòng ban), BPTN (`js/bptn.js` — form theo mã vướng), Kho (`js/kho.js` — tồn kho, nhập kho); `js/staff.js` dùng chung. Chỉ QA còn "Dùng bản web". Không endpoint mới.
- Bỏ hàng chip lọc ở màn Cư dân (4 ô tổng quan vẫn lọc).
### Changed (đợt 2, cùng ngày — SPEC-P04, Q19–Q25)
- Giao diện app chép từ `portal/`: header gradient + NavTiles (bỏ thanh tab đáy/FAB), form gửi 3 thẻ đánh số + Tóm tắt, ô tổng quan + 6 vạch tiến độ, stepper 6 bước, màn BQL kiểu Management; class `globals.css` chép nguyên, icon `icons.tsx` path-for-path. Backend vẫn FastAPI gốc `/api/v1` (Docker `:8000`), không chạm portal/DB portal.
- Bước Vị trí ghép `Vị trí: Tòa … / Tầng … / <khu vực>` vào mô tả (API không đổi). Không làm phần portal mà API không có (khẩn cấp, tag đánh giá, cư dân nghiệm thu, Thông báo).

## [v1.6.0] - 2026-10-08: Danh sách hiện 20 phản ánh một trang (plan 10)
### Added
- `src/web/app.js`: `listCard(..., { key, ids })` chia trang 20 dòng cho màn cư dân, BPTN, phòng ban, BQL; khối "‹ Trước · Trang x / y · Sau ›" chỉ hiện khi > 20.
### Decisions
- Chia ở giao diện, KHÔNG ở server: ô đếm/lọc/sắp xếp đều tính ở trình duyệt trên toàn bộ danh sách; API giữ nguyên.
- Chuyển trang không gọi API; mỗi `render()` mở trang chứa ticket đang chọn. Reset trang khi đăng xuất/đổi lọc BQL là phòng hờ (mutant tương đương — plan 10 Q07).

## [v1.5.0] - 2026-10-08: Danh sách phản ánh nhanh 7–13 lần (plan 09)
### Changed
- `PostgresRepository.list()` nhớ doc theo `xmin` từng dòng: MỘT câu SQL gửi phiên bản đang giữ, DB chỉ trả doc của dòng mới/đổi. Không TTL (ghi từ backend khác thấy ngay); doc lỗi không vào cache.
- `resident_view(..., lookup=None)`: màn cư dân dùng ticket liên quan (gộp/tách/follow-up) từ cùng snapshot thay vì đọc lại từng ticket (7 → 1 câu SQL).
### Fixed
- `requirements.txt`: ghim `sqlalchemy<2.1` — bản 2.1 đổi `postgresql://` sang driver `psycopg` (v3) không cài ⇒ container `backend` khởi động lại vòng (exit 3).
### Decisions
- Object trả từ `list()` CHỈ ĐỌC, dùng chung (cùng hợp đồng store memory) — không deep copy. API/schema/UI không đổi (parity 8/8 vai trên DB chung).
- Số đo median trên Supabase: cư dân 2676→201 ms, BPTN 1514→224 ms, BQL 503→219 ms. Bỏ khỏi đợt này theo người dùng: gzip, BQL 1 API.
- Lấy v1.5.0 (không phải v1.4.0) vì plan 08 (`web-portal-shell`, chưa merge) đã nhận v1.4.0.

## [v1.3.0] - 2026-10-07: UI tĩnh `src/web/` mang design của `portal/` (plan 07)
### Changed
- `src/web/index.html` + `app.js`: font Be Vietnam Pro, header gradient "Xin chào, <tên>" (avatar chữ viết tắt, pill vai trò, ô đổi tài khoản test, nút Đăng xuất pill), khối tiêu đề màn là card đè lên gradient, màn đăng nhập theo `Main.dc.html` của portal (thay bản gradient cam sáng cùng ngày).
- Helper `BTN`/`INPUT`/`card`/`badge`/`chip`/`callout`/`toast`/item danh sách dùng class thiết kế; màu trạng thái theo bảng pill của portal (`planning/07_…/specs/01-CONTRACTS.md` §3).
### Added
- `src/web/theme.css`: token + class chép từ `portal/src/app/globals.css`. `docs/web.md`.
### Decisions
- Reskin, KHÔNG dựng lại màn theo bố cục portal (khác mô hình dữ liệu/vai trò). Remap palette `slate`/`stone`/`indigo` trong `tailwind.config` đổi 418 chuỗi class ở một chỗ.
- Tắt dark mode (thiết kế không có); không thêm chuông/tile menu (không có dữ liệu — nút giả).
### Evidence
- pytest 2972 passed, ruff sạch, `node --check` exit 0; 22 ảnh 1440/390 + 3 ảnh thao tác, 0 tràn ngang (`planning/07_2026-10-07_web-portal-reskin/evidence/`).

## [v1.2.0] - 2026-10-07: Cổng phản ánh cư dân — website Next.js từ bộ thiết kế (plan 06)
### Added
- Thư mục top-level mới `portal/`: Next.js 16.4 (App Router, `cacheComponents`) + TypeScript + Tailwind v4 + PostgreSQL
  (Drizzle + `pg`), dựng theo `design-ticket-cu-dan/…/HANDOFF.md` + 6 file `.dc.html`: đăng nhập, Cư dân, Ban tiếp nhận,
  Ban quản lý, Phòng vệ sinh, Phòng kỹ thuật. Độc lập backend Python (KHÔNG nối engine CR-03). Tài liệu `docs/portal.md`.
- 10 bảng (users, sessions, staff, tickets, photos, history, ratings, keywords, materials, notices); DB `portal`/`portal_test`
  trong container `p151-db-1`; seed 22 ticket mẫu phủ mọi trạng thái.
- Session cookie ↔ bảng `sessions` (SHA-256 token), scrypt; ma trận quyền một nguồn (`permissions.ts`) vừa kiểm vừa hiển thị.
- Mọi ghi qua `src/server/workflow.ts` (FOR UPDATE + UPDATE có điều kiện stage + 1 dòng lịch sử); lỗi `ActionResult` 5 mã.
### Decisions
- Một mô hình `stage 1..6` cho mọi vai; 9 lệch có chủ đích D1–D9 (`planning/06_…/specs/00-ARCHITECTURE.md` §5), gồm: không lộ
  vai trò/tồn tại tài khoản khi đăng nhập, Agent so khớp nguyên từ, không khớp ⇒ "Chưa rõ" thay vì BQL 38%.
- Phòng vệ sinh / kỹ thuật xem được đánh giá của cư dân (sao, thẻ nhận xét, bình luận) ở cột "Hoàn thành" và tab Lịch sử,
  nhưng KHÔNG biết người gửi (không tên/tài khoản/mã cư dân, tên file ảnh ẩn thành "Ảnh N") — quyết định người dùng (plan Q11).
- Agent phát hiện ticket có thể trùng (cùng phòng ban + vị trí + từ khóa, ≤7 ngày); Ban tiếp nhận so sánh hai ticket cạnh nhau và chỉ
  duyệt gộp / "Không trùng" (cột `dup_dismissed`, migration `0001`); server chặn gộp cặp không được đề xuất (plan Q13).
### Removed
- Tab "Phân quyền" (BQL), tab "Quy tắc từ khóa" + quyền sửa từ khóa (Ban tiếp nhận) — người dùng: Agent phân loại, Ban tiếp nhận chỉ duyệt (plan Q12).
### Fixed (trong lúc nghiệm thu)
- Ảnh ticket trả `Cache-Control: private, no-store` (bản `max-age=300` cho người đăng nhập sau trên cùng máy xem lại ảnh).
- Ô "Gộp vào ticket trùng" làm trang tràn ngang ở 390px.
### Evidence
- typecheck/lint 0 lỗi, unit 14/14, DB 15/15 (Postgres thật, 2 phép phá đều làm đỏ), build OK, E2E production PASS,
  38 ảnh đối chiếu thiết kế, 0 tràn ngang — `planning/06_2026-10-07_resident-portal-next/evidence/`.

## [Unreleased] - 2026-10-07: Sửa 500 "Không tải được dữ liệu" trên Supabase dùng chung
### Fixed
- `Ticket.merged_children: list[str]` (CR-BPTN-03 §8) thêm vào `src/maintenance/models.py`: 16 doc trên Supabase do bản code
  khác (PR #11 đã revert) ghi field này làm `repo.list()` vỡ ⇒ mọi màn danh sách 500. Field chỉ được nạp/giữ; engine nhánh này
  CHƯA điền khi gộp trùng (việc của chủ engine). Test hồi quy `test_doc_with_merged_children_loads_and_keeps_the_link`.

## [Unreleased] - 2026-10-07: Màn đăng nhập "Cổng phản ánh cư dân"
### Changed
- `showLogin` (`src/web/app.js`) dựng lại theo mockup người dùng: nền gradient cam tràn ngang, logo nhà + "Cổng phản ánh cư dân"
  / `LOGIN_SITE_NAME`, thẻ trắng "Xin chào, Đăng nhập", ô nhập bo tròn có placeholder, nút "Hiện/Ẩn" trong ô mật khẩu,
  nút cam `orange-700` bo tròn, dòng "Quên mật khẩu?". Header + `main` ẩn khi chưa đăng nhập (`setShellVisible`);
  `#login-view` chuyển ra ngoài `main`. Bỏ hẳn khối "Tài khoản thử nghiệm" + hàm `demoAccountList` khỏi màn đăng nhập
  (người dùng yêu cầu; đăng nhập nhanh còn `?autologin=<username>` và ô đổi vai trò sau khi vào). Cache bust `app.js?v=3.2`.
## [Unreleased] - 2026-10-07: Hoàn thiện Đặc tả Thiết kế Điều phối Ngữ nghĩa SPEC-P09 (Plan 06 WP16)
### Added
- Đặc tả hợp đồng điều phối ngữ nghĩa [`SPEC-P09-semantic-coordination.md`](../planning/06_2026-10-05_reasoning-agent/specs/SPEC-P09-semantic-coordination.md) (PROPOSED) hoàn thiện qua 6 vòng thẩm định đối kháng nghiêm ngặt (R15 §01–§17).
- Cơ chế liên kết giá trị - bằng chứng vị trí (B1): thuật toán kiểm tra giao khoảng sự cố vs nơi ở, ngăn chặn triệt để quote bao trọn nơi ở.
- Ràng buộc cấu trúc tách ticket (B2): bắt buộc đủ cả 3 thành phần vị trí (`building`, `floor`, `area`) cho cả hai nhánh override và shared_location; loại bỏ hoàn toàn regex suy đoán từ quote rút gọn mồ côi; chặn tách ticket khác khu vực.
- Phân cấp an toàn và bất biến next_step (B3): bảo toàn tính đơn điệu của mức an toàn, quy định chuỗi hỏi thông tin cư dân và chuyển BPTN.
- Tương thích đọc kép P01 & Runbook Rollback (B4): đồng bộ cardinality `SemanticMetadata.job_evidences` cho 0/1/2 jobs; quy tắc nâng sàn kỹ thuật `KY_THUAT LOW` $\rightarrow$ `MEDIUM (PRI-M1)`; chuẩn hóa thao tác JSONB `maintops.cases.doc #- '{agent_decision, semantic_metadata}'` và quy trình Quiesce dừng toàn bộ writers bắt buộc.
- Handoff [`H16_thi-cong_WP17.md`](../planning/06_2026-10-05_reasoning-agent/handoffs/H16_thi-cong_WP17.md) chuẩn bị cho thi công runtime sau khi P09 được phê duyệt.

## [v1.1.5] - 2026-10-05: Đèn cháy / đèn chập là đèn hỏng, không phải nguy hiểm (plan 05 Q11)
### Fixed
- "Đèn hành lang … bị chập / chập rồi / chập điện" và câu gõ không dấu "den hanh lang … bi chay / bi chap" không còn bị
  coi là nghi nguy hiểm (chuyển BPTN); giờ là việc đèn giao Phòng Kỹ thuật. Có khói, tóe lửa, khét kèm thì vẫn khẩn cấp;
  "ổ điện bị chập" vẫn cần người xem. Lexicon `2026-10-05.p0g`; test P1-11 đổi theo quyết định người dùng.

## [Unreleased] - 2026-10-05: Ghi vật tư đã xuất thì trừ kho; không xuất/dùng vượt tồn
### Fixed
- `record_material` chỉ lưu số trên ticket, tồn kho không đổi ⇒ dùng vật tư rồi kho vẫn đủ, và xuất được nhiều hơn tồn
  (vd 2 bóng tuýp khi kho 0 vẫn nghiệm thu được). Nay trừ phần chênh `issued_qty` trong cùng transaction (`Tx.take_stock`,
  Postgres UPDATE có điều kiện); vượt tồn ⇒ 409; `used_qty > issued_qty` ⇒ 409; bỏ dòng đã xuất ⇒ hoàn kho; tồn `null` không trừ.

## [Unreleased] - 2026-10-05: Kho xem được tồn kho; nhập thiếu không còn "đòi lại" số cũ
### Fixed
- Nhập kho thiếu (cần 2, kho 0, nhập 1): dòng vật tư giữ ảnh chụp `simulated_stock_qty=0` ⇒ màn Kho vẫn "cần 2 · tồn 0";
  toast báo "1 phản ánh chạy tiếp" dù ticket vẫn chờ. Nay `_resume` làm mới tồn trên dòng, UI tính "còn thiếu" theo tồn hiện tại
  và chỉ đếm ticket đã gỡ blocker.
### Added
- `engine.stock_levels` + `GET /mo/warehouse/stock`; màn Kho có bảng "Tồn kho hiện tại", điền sẵn vật tư + số còn thiếu.

## [Unreleased] - 2026-10-05: Phòng ban xác nhận vật tư tại hiện trường
### Added
- `engine.confirm_materials` + `POST /mo/tickets/{id}/material-plan`: phòng ban (IN_PROGRESS) thay vật tư Agent đề xuất
  (đổi loại, số lượng, thêm/bớt, rỗng = không dùng), bắt buộc lý do, audit `UPDATE_MATERIAL`/`planned_materials`.
- UI phòng ban: khung "Xác nhận vật tư tại hiện trường" (nổi bật khi `ASSET_CHECK_ONSITE`), dòng vật tư hiện tồn kho.
- Trước đây: tài sản kiểm tại chỗ vẫn nhận vật tư mặc định playbook (LED x1), phòng ban chỉ sửa được số lượng.

## [Unreleased] - 2026-10-05: Ticket an toàn thiếu vị trí: BPTN thấy phần thiếu; giữ tòa con S1.12
### Fixed
- Q08 (an toàn trước dữ liệu tối thiểu) làm ticket "tiếng nổ" thiếu khu vực dừng ở `SAFETY_REVIEW_REQUIRED`: cư dân chỉ thấy
  "Đang được kiểm tra", BPTN không biết còn thiếu gì. Nay `internal_note` blocker an toàn (Bậc 1/2) kèm `· Thiếu: …`;
  UI BPTN hiện cảnh báo, điền sẵn câu hỏi cho `REQUEST_INFO` (engine vốn đã hỏi kèm vị trí thiếu). KHÔNG đổi thứ tự Q08.
- `rules._building_pattern` giữ tòa con: "tòa S1.12" ⇒ `Tòa S1.12` (trước bị cắt thành `S1`); "S1.123" bị từ chối.

## [Unreleased] - 2026-10-05: Thí điểm chỉ nhận tòa Ocean Park S1, S2; "Sảnh cư dân" mặc định Tầng 1
### Changed
- `catalog.yaml` thêm `site: {name: Ocean Park, buildings: [S1, S2]}` (model `Site`). `rules.extract_location`/`missing_location_parts` nhận thêm `buildings`: chỉ tòa trong danh sách được nhận ("tòa S1" hoặc "S1"), tòa khác ⇒ thiếu `location_building`.
- Khu vực mới "Sảnh cư dân" (`IMPLIED_FLOOR` = 1, không hỏi tầng); thêm vào `priority.high_areas` và tập đóng B-01.
- Seed + test đổi `SIM-A`→`S1`, `SIM-B`→`S2` (giữ nguyên bộ nhãn an toàn, xem `-known-gotchas.md`). Postgres đang chạy KHÔNG tự đổi (startup chỉ seed khi rỗng).

## [Unreleased] - 2026-10-05: Nút "Nghiệm thu" của BQL chỉ bấm được một lần
### Fixed
- `src/web/app.js`: nút Nghiệm thu dùng `oneShotButton` mới — bấm xong tự mờ (`disabled`, chữ "Đang nghiệm thu…"),
  chỉ mở lại khi API lỗi. `act()` nay trả `true`/`false`. Trước đây bấm liên tiếp gửi nhiều `POST /bql/tickets/{id}/close`.

## [v1.1.4] - 2026-10-05: Làm cứng Agent bằng kiểm thử biến thể vị trí (plan 05)
### Fixed
- Tầng an toàn (`lexicon.yaml` `2026-10-04.p0f` + `safety.py`): vị trí đặt đầu/cuối/GIỮA câu không còn làm đổi mức
  (5669 biến thể, 0 vi phạm); hết báo nhầm "… tòa SIM-C có khối rác" (từ xác nhận đổi sang cặp chữ), "đầy tràn" không
  dấu; bắt "dây điện lộ/lòi ra", câu khẩn cấp có vị trí chen giữa (45/45); B-01 nhận "gần/trước căn", "cứ chập chờn".
- Phân loại/vị trí (`rules.py`): vị trí lấy nơi có sự cố (bỏ tầng căn hộ người báo), "toà SIM A", "tầng 03", "cầu
  thang", khu mới "Lối thoát hiểm"; đèn tuýp do luật bắt; câu trộn giữ CATEGORY_UNCLEAR; nước tràn vào tủ điện / lòi dây
  điện ⇒ OUT_OF_SCOPE cho BPTN đọc (không giao phòng ban).
- Engine: phản ánh ngoài phạm vi không nhắc khu vực chung và không nhắc đèn/rác ⇒ OUT_OF_SCOPE cho BPTN, không hỏi
  cư dân vị trí (người dùng duyệt, Q05/Q09); vị trí đọc từ phần bổ sung mới nhất trước; vị trí BPTN gõ được chuẩn hoá; job
  định kỳ không còn chết vì một ticket lỗi (lỗi do plan 04).
### Decided
- Để P1: tín hiệu an toàn P1, luồng trùng đầy đủ CR §8, tách ticket hai việc, đếm trả sai phòng ban.

## [v1.1.3] - 2026-10-04: Sửa logic sai sau rà soát toàn dự án (plan 04)
### Fixed
- An toàn 2b (`lexicon.yaml` `2026-10-04.p0d`): bắt Bậc 1 thang máy kẹt + người, té xỉu, dây điện rơi/tróc vỏ/lủng lẳng, bốc hỏa,
  khói nhiều, lửa lớn, kêu cứu; hết báo nhầm Bậc 1 "điện/cầu dao bị ngắt", "khối rác", "bật lửa", "đèn cháy sáng"; B-01 nhận
  "gần căn…", "xin báo…". Priority: "tròn"/"hỏi" không còn kích H2/M2. Bộ dừng 1065 ca giữ xanh, ngân sách báo nhầm không đổi.
- Engine: REWORK bắt ảnh + ghi chú mới (`Case.evidence_round_start`); ticket an toàn đã leo thang giữ quyền BQL khi Bậc 2 tạo
  lại; AI Log có `ticket_id`; LLM phân loại gọi ngoài `engine.lock` trong `receive`; job chạy pipeline cho ticket mồ côi.
- Engine (A1): lỗi 403 cho người ngoài phạm vi không lộ `unchanged_status`; giá trị ghi audit khi từ chối bị cắt 500 ký tự.
- TÁCH RA (chủ API, chưa trong code): chặn loại ảnh ở `/evidence`, route ảnh không chặn event loop, `/mo/ai-logs` theo vai +
  lọc trước `limit`, `/mo/tickets` cùng thứ tự, giới hạn chữ tự do ở route, khoá session — bản vá
  `planning/04_2026-10-04_logic-review-fix/handoffs/H03_backend-api.patch`; ghi chú cho Trí (H04) và Trường (H05).
- Phân loại luật: đèn/đến, Bùi/bụi, bận/bẩn phân biệt trên chữ có dấu; thêm triệu chứng đèn và từ vệ sinh phổ biến; đèn +
  khu vực chung ở bất kỳ đâu trong câu ⇒ KY_THUAT; Q22 "bóng đèn bị cháy" ⇒ KY_THUAT. Tách vị trí: thang bộ, phòng rác, bãi
  đỗ xe, sân chơi, sân thượng, lối đi, tầng trệt, lầu, block, "tòa nhà". Tầng an toàn: B-01 không áp qua chỗ ngắt mệnh đề. Proposer:
  enum LLM lạ ⇒ fallback luật; `reason` cắt 500 ký tự.
### Decided
- Giữ contract "ngoài phạm vi ⇒ 403 + audit" (8 test đã duyệt); đổi sang 404 cần nhóm quyết. Ghi chú kết quả bắt buộc, ảnh cư
  dân ngoài NEED_INFO, đánh giá ticket MERGED: giữ nguyên (Idea Vault).

## [v1.1.2] - 2026-10-03: `/close` thường không còn đóng được ticket khẩn cấp
### Fixed
- `engine.close` gắn `expected_from=READY_FOR_REVIEW`. Trước đây `POST /bql/tickets/{id}/close` kèm note trên ticket
  `VERIFYING`/`EMERGENCY_PENDING_BQL` trả 200 (rơi vào nhánh T10), là đường thứ hai bỏ qua `_safety_precheck`. Nay trả
  409 `INVALID_TRANSITION`, case không đổi; đóng khẩn cấp chỉ còn `POST /bql/tickets/{id}/emergency/close`.
- Test: `test_plain_close_rejects_emergency`, mở rộng `test_invalid_transition_is_409`. OPERATIONS §5.3 mục 1 (hồ sơ 02 truong-mvp-prep) sửa cho khớp.

## [docs] - 2026-10-03: Tối ưu brain4agent cho Trường (không đổi version app)
### Changed
- Não định hướng theo phân công Notion "Kế hoạch MaintenanceOps MVP": kernel `<truong_focus>`, roadmap lịch Trường 01/10–19/10,
  index router việc Trường/dataset/deliverables, `state.json` thêm link kế hoạch + 3 mốc.
- Sửa thông tin cũ: nhánh worktree `feature/truong`; project-intro persistence `memory|postgres` (không còn "in-memory, chưa dùng
  Postgres"); CR-BPTN-01/02.md đánh dấu không có trên nhánh này.
### Decided
- Trường không sửa engine/API/UI (chủ việc Như Ý/Châm Anh/Trí); giao bằng fixture, test đích và handoff.

## [Unreleased] - 2026-10-02: Merge `origin/develop` (`deab467`) vào nhánh CR-03 P0 (hồ sơ 02)
### Changed
- Nền lưu trữ của `develop` (`CaseRepository` memory/postgres, Supabase Storage, startup `seed_if_empty`, hồ sơ
  `planning/01_2026-10-02_supabase-persistence/`) + toàn bộ CR-03 P0. Mọi ghi CR-03 qua `_mutate` = một transaction.
- Q04: MISSING_INFO thường do BPTN gỡ (`f1c6ebf`) rồi chạy lại từ bước 2 kể cả 2b; NEED_INFO an toàn (T06) chủ cư
  dân, `bptn_resolve` → `GUARD_FAILED`, không nhắc tự động, leo thang BQL 12 giờ; lời cư dân `safety_info_message`.
- `sla_config.missing_info` chỉ còn `safety_context` (bỏ 24h/72h theo `f1c6ebf`); `_deny` trong `op` không mở
  transaction lồng.
### Open
- Phân công nhân sự: `develop` D-12 vs CR-03 P0 `set_assignee` bị chặn — chờ người quyết.

## [v1.1.1] - 2026-10-02: Merge develop vào nhánh engine CR-03 (hồ sơ 02)
### Changed
- Merge `origin/develop` (Supabase/`CaseRepository`, `f1c6ebf`, UI) vào `feature/nhuy-cr03-p0`: 1514 test xanh, tầng an toàn không hồi quy. Thao tác ghi CR-03 đi qua repository (test `test_cr03_store.py`).
### Decided
- `assignee_id` vẫn cấm ghi (CR-03 §4.4) dù develop D-12 cho phòng ban ghi; `NEED_INFO` an toàn chủ RESIDENT, BPTN không gỡ bằng `bptn_resolve`.

## [v1.1.0] - 2026-10-02: CR-BPTN-03 P0 cho engine MaintenanceOps (hồ sơ 01)
### Added
- Tầng an toàn bước 2b (`src/maintenance/safety.py`) với từ vựng là dữ liệu (`seed/maintenance_v1/lexicon.yaml`): Bậc 1 → `VERIFYING`/`EMERGENCY_PENDING_BQL` (chủ BQL), Bậc 2 → `SAFETY_REVIEW_REQUIRED` (chủ BPTN, hạn 4 giờ lịch); LLM chỉ nâng mức (P0 không bật).
- Năm method công khai `safety_confirm_safe`, `safety_escalate`, `safety_request_info`, `emergency_downgrade`, `emergency_close` + `set_priority`; `priority.py` (PRI-H1/H2/M1/M2/L1/D0); `queue_sort_key` (EMERGENCY trước); outbox `emergency.created`, `safety.review_escalated`.
- `docs/maintenance.md` (tài liệu module); bộ dừng an toàn `tests/test_maintenance/data/safety_stop_sets_p0.yaml`.
### Changed
- `TRANSITIONS` 25 dòng (+T06/T07/T10, bỏ CLOSED→READY_FOR_REVIEW); `sla_config` thêm `safety_review`, `missing_info.safety_context`, `priority`, bỏ `reopen_window_days`; CLN-004 và TEC-005 thành Bậc 1; mô tả cư dân > 5000 ký tự bị từ chối (422).
- CR-03 §5.2: gỡ blocker an toàn chạy lại từ bước 2 (2b tự bỏ qua) — đồng bộ theo code (Q17).
### Decided
- Q23: BPTN trên blocker chủ BQL = 403 + audit cho mọi hành động kể cả `bptn_resolve`. Q19: BQL chỉ dùng 3 lựa chọn Bậc 2 sau khi leo thang. Q29–Q31: thiết kế phạm vi tầng an toàn R1–R10 sau 3 vòng thẩm định cô lập (judge Opus); không bật LLM an toàn ở P0 (`receive` giữ `engine.lock`). Q33: brain 1.0.1 → 1.1.0; KHÔNG đổi version app trong `src/` (đổi khi tích hợp `develop`).
### Not changed
- Router `src/api`, UI `src/web`, persistence/deploy chưa nối; `rules.py`/`proposer.py` giữ (Q22 chuyển Trường); docs `01`–`05`, README vẫn ghi v0.3 (CR-03 thắng).

## [v1.0.1] - 2026-10-01: CR-BPTN-03 là spec duy nhất
### Changed
- Quyết định (Như Ý, 2026-10-01): mọi việc build Agent theo `docs/CR-BPTN-03.md`; bỏ hẳn CR-BPTN-01/02 (xoá file, kể cả bản CR-02 vừa sửa ở `1e2f42b`).
- CR-03: header đổi baseline thành code; thêm **D-09** — phân loại (3) trước kiểm tra trùng (4) theo code `1e2f42b`, tầng an toàn 2b vẫn trước phân loại; sửa §1, §5.1, §5.2, §8, §14 cho khớp.
- README trỏ CR-03. Não bộ chuyển sang MaintenanceOps + CR-03, gộp ghi chú kỹ thuật của não Châm Anh (concurrency, bảo mật, môi trường).
### Not changed
- Comment code, seed, test và docs `01`–`05`/`data-contract-v1`/`playbook-v1` vẫn ghi CR-BPTN-02/v0.3; sẽ đổi khi cài CR-03.
- Quyết định "BQL trả làm lại → về thẳng phòng ban" (Châm Anh ghi ở CR-02 §9.3) vẫn đúng: khớp CR-03 T22.

## [0.5.0-candidate] - 2026-10-01: Phân loại trước kiểm tra trùng (Châm Anh, `1e2f42b`)
### Changed
- Pipeline: bước 3 = phân loại + đề xuất phòng ban, bước 4 = kiểm tra trùng. Điểm chạy lại: `CATEGORY_UNCLEAR`/`OUT_OF_SCOPE` → 4; bác `DUPLICATE` → 5; `WAITING_MATERIAL` → 6.
- Hàm bước đổi tên `_step_<số>_<việc>`; bước 7 tách `_plan_materials_for_playbook` + `_check_material_lines_against_stock`; thêm `_find_duplicate_ticket_id`.
- **Thiếu dữ liệu giao BPTN (nhánh `develop`, `f1c6ebf`):** `MISSING_INFO` vào `BPTN_REASONS` (chủ blocker BPTN, SLA 1h/4h giờ hành chính, bỏ
  `sla_config.missing_info`). `bptn_resolve` nhận ticket `NEED_INFO` với `location` và/hoặc `info` (bắt buộc lý do, phải đủ
  mọi phần thiếu, nếu không thì không lưu gì); `info` lưu thành `ResidentAddition` với `submitted_by` = BPTN. Cư dân vẫn tự
  bổ sung được. Lời nhắn cư dân: "Ban tiếp nhận thông tin sẽ liên hệ bạn…". UI BPTN thêm hàng chờ `NEED_INFO` + form.
- (nhánh `develop`) `docs/CR-BPTN-03.md` sửa cho khớp flow đang code (§19 mới): bước 3 phân loại → 3b an toàn (đề xuất) → 4 trùng; bảng
  chạy lại; `MISSING_INFO` chủ BPTN; phòng ban tự phân công; BQL trả làm lại về chính phòng ban; kho nhập → bước 6.
  Đề xuất chưa code (an toàn, priority, hoàn tác gộp…) giữ nguyên, chỉ đổi số bước.
### Decided
- BQL trả làm lại → về thẳng phòng ban đang giữ (`IN_PROGRESS` + `REWORK`), không qua BPTN đối chiếu lại phòng ban.

## [0.5.0-candidate] - 2026-09-30: Backend hardening (Châm Anh)
### Fixed
- `engine.at()` đổi đồng hồ theo thread; `engine.lock` (RLock) bao mọi thao tác ghi; job retry/leo thang chạy qua `asyncio.to_thread`.
- Cư dân không được gửi `simulated_received_at` khi `APP_ENV=production`; khóa đăng nhập theo (username, client); `/api/v1/chat` không trả `str(e)`.
- `src/services/llm.py` dùng `OPENAI_BASE_URL`; `.dockerignore` loại `data/`, `node_modules/`, `tests/`; ruff sạch cả `scripts/`.

## [v1.0.0] - 2026-09-30: Brain4agent installation
### Added
- Lắp hệ thống bộ nhớ `brain4agent/` V5.2.

## Trường MVP preparation — 2026-10-03
### Unreleased — chưa đóng gate nhóm/runtime/online
- Chuẩn bị scope/decisions/demo/rules/target fixtures; không đổi baseline runtime hay startup fixture.
- D-01 đích dùng new addition + persisted structured snapshot; không đưa full old raw vào LLM, safety scan và risk monotone.
- D-02–07 user confirmed defaults, nhóm chưa duyệt chính thức; T16/T17/E02 sau 04/10 theo Notion.
- Chưa phát hành hoặc tăng app version; không ghi bộ chuẩn bị thành runtime đã triển khai.


## D-08 approval recorded — 2026-10-03
- D-08 APPROVED: người dùng thông báo leader Lê Thị Châm Anh duyệt phạm vi MVP 04/10 và D-01–D-07; ngày duyệt được báo là 2026-10-02, chưa cung cấp giờ. Ghi nhận ngày 2026-10-03; commit a5e2705/PR #6 là bản tham chiếu được người dùng xác nhận trong phiên này, không khẳng định commit đã tồn tại ngày 02/10. Nguồn: thông báo người dùng trong phiên; chưa có link biên bản ngoài. Không mở rộng thành duyệt mọi CR/backlog hoặc nghiệm thu runtime.
- Không đổi engine/storage/API, không đóng runtime/online gates; chưa commit/push bản ghi này.

## Day03 tasks planned — 2026-10-03
- 2026-10-03T10:43:10+07:00: tạo SPEC/checklist 7 task, chưa chạy. Phạm vi Trường: nghiệp vụ, dữ liệu/expected, kiểm thử, wording, demo; không sửa app safety/engine/API/UI. Không phát hành, không commit/push.

## Day03 results recorded — 2026-10-03
- Day03 chạy local cô lập, nhánh feature/truong, SHA 0ea04adedd023654947e2e97e645043f0ba89159: 23 record = 17 PASS / 1 FAIL / 5 BLOCKED / 0 NOT_RUN. Asset 3/3, vật tư 4/4, trùng 4/4 PASS; wording WORD-03 PASS, WORD-01/02/04 BLOCKED; demo 5 PASS / 1 FAIL (DEMO-01-RATING, engine.py:548-553) / 2 BLOCKED (DEMO-04).
- Không đổi code/runtime, không tăng version ứng dụng, không đóng plan; runtime/online/group-runtime gates vẫn mở. Chờ người quyết: ASSET-03, STOCK-04, owner reopen/rating-once (Như Ý). Bước 0 vẫn exit 1 (thiếu hub).

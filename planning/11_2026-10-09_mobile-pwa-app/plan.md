# 11 — App điện thoại (PWA) cho Cư dân và BQL (2026-10-09)

| Trường | Giá trị |
|---|---|
| Trạng thái | 🟡 Đợt 3 (mọi vai, Q26–Q31) LOCAL ✅ (2026-10-09 17:53:00 +0700) + Docker `:8000` chỉ đọc ✅ — còn G5 điện thoại thật + gate server G6–G8 (HTTPS công khai) + commit |
| Loại | MINOR (thêm client mới, KHÔNG đổi contract API/engine) — đủ bộ SPEC → v1.7.0 |
| Yêu cầu | Người dùng, 2026-10-09: "làm thêm một application cho dự án … delivery nhanh nhất, và có thể xử lý được trên app" → "Cư dân cũng sẽ dùng trên app, còn BQL có thể dùng trên web nhiều hơn, nhưng vẫn cần có giao diện trên app … yêu cầu vẫn cần đồng bộ database" → "bắt đầu tạo planning và viết spec để làm app đi" |
| Nhánh | `feature/chamanh` (lúc mở hồ sơ) |
| Phạm vi | Thư mục MỚI `src/mobile/`; MỘT dòng `app.mount("/app", …)` trong `src/main.py`; test mới `tests/test_maintenance/test_mobile_static.py`; hồ sơ này; `docs/mobile.md` mới; đồng bộ não + version |
| CẤM chạm | `src/maintenance/`, `src/api/` (mọi router, `auth.py`, `photos.py`), `src/web/`, `portal/` (trừ trường `version`), `seed/`, `.env`, schema DB/Alembic |

## §1. Nhật ký quyết định
| # | Mốc | Quyết định | Lý do |
|---|---|---|---|
| Q01 | 2026-10-09 | App = **PWA** (web app cài được lên màn hình chính), KHÔNG React Native/Flutter | Giao nhanh nhất (một codebase, không build store), camera qua `<input capture>`; bọc Capacitor sau nếu cần lên store (Idea Vault) |
| Q02 | 2026-10-09 | App là **client mỏng** của API FastAPI `/api/v1` hiện có; mọi xử lý nằm trong engine | Một nguồn xử lý ⇒ giữ luật CR-03 (an toàn Bậc 1/2, 403/409); web + app cùng API ⇒ cùng DB ⇒ đồng bộ tự nhiên |
| Q03 | 2026-10-09 | Mã nguồn ở `src/mobile/`, FastAPI phục vụ ở `/app/` (cùng origin với API) | Không CORS, không service thứ hai, không bước deploy riêng; container `backend` chép `src/` sẵn |
| Q04 | 2026-10-09 | Plain JS ES module + CSS tự viết (token chép từ `src/web/theme.css`), KHÔNG Tailwind Play CDN, KHÔNG bước build | Tailwind CDN biên dịch lúc chạy ⇒ chậm trên điện thoại, không cache offline được; repo đã chọn "không bước build" (plan 08 Q02) |
| Q05 | 2026-10-09 | Vai trên app: **Cư dân** (đủ luồng) + **BQL** (bản gọn: danh sách cần xử lý + 5 hành động). BPTN/Phòng ban/Kho/QA đăng nhập ⇒ màn "Dùng bản web" trỏ `/ui/` | Đúng câu người dùng; vai nội bộ khác dùng web, không làm đôi việc |
| Q06 | 2026-10-09 | Đồng bộ = **tải lại định kỳ 30 s khi app đang hiện** + khi app quay lại foreground + nút tải lại. Không realtime | Backend chưa có push; đủ cho demo; realtime (SSE/Supabase Realtime) ⇒ Idea Vault |
| Q07 | 2026-10-09 | Service worker CHỈ cache vỏ app (HTML/CSS/JS/icon); **CẤM cache `/api/`** | Dữ liệu cũ trên app = lệch DB, trái yêu cầu đồng bộ |
| Q08 | 2026-10-09 | Không ghi khi offline (không hàng đợi offline); offline ⇒ banner + khoá nút ghi | Hàng đợi offline phát lại sau có thể đụng state machine/an toàn; ngoài thời hạn 19/10 |
| Q09 | 2026-10-09 | Token lưu `localStorage` khoá `mo-app-token` (KHÁC `mo-token` sessionStorage của web) | App phải nhớ đăng nhập khi tắt/mở lại; session server vẫn TTL 8 h, mất khi restart ⇒ 401 về màn đăng nhập. Dữ liệu `SIM-`, chuỗi API chèn bằng text node |
| Q10 | 2026-10-09 | Nén ảnh ở máy: cạnh dài ≤1600 px, JPEG chất lượng 0.82, trước khi upload | API giới hạn 5 MB/ảnh, JPG/PNG/WEBP; ảnh điện thoại 3–12 MB, iPhone có HEIC; 4G chậm |
| Q11 | 2026-10-09 | Version v1.7.0 | MINOR kế sau plan 10 (v1.6.0) |
| Q12 | 2026-10-09 | Agent tự chọn Q01–Q11 (AGENTS L.2); người dùng đổi được khi duyệt | Quyết định kỹ thuật; người dùng đã chốt vai + yêu cầu đồng bộ |
| Q13 | 2026-10-09 | Người dùng duyệt: giữ PWA HTML/JS (hỏi "code UI của app mà cũng bằng HTML hả" → được giải thích PWA vs React Native → "rồi oke, bắt đầu làm đi") | Mốc 19/10, không cần lên store trước |
| Q14 | 2026-10-09 | Harness chuẩn bị ticket READY_FOR_REVIEW bằng chính API phòng ban (accept → checklist → vật tư → ghi chú → ảnh → complete), không dùng `/mo/demo` | Ticket fixture `SIM-TKT-CLN/TEC-*` bị ẩn khỏi danh sách BQL (`isSeedTicket`) |
| Q15 | 2026-10-09 | Nút "Thêm ảnh" của cư dân hiện khi ticket chưa kết thúc, KHÔNG gắn vào `ADD_INFO` | Đo: `ADD_INFO` chỉ có ở `NEED_INFO` (`views.resident_view`), còn `engine.add_resident_photo` nhận ảnh mọi trạng thái chưa kết thúc; lượt đầu M4 đỏ vì giả định sai |
| Q16 | 2026-10-09 | Trên điện thoại, khối thao tác nằm ngay dưới thẻ trạng thái (cư dân + BQL) | Ảnh chụp lượt đầu: nút nghiệm thu nằm dưới cả lịch sử, phải cuộn xa |
| Q17 | 2026-10-09 | Thêm kiểm `TEXT` (không chữ null/undefined/NaN trên màn) + phép phá `d-null-text` | Ảnh lượt đầu lộ "null" (thanh tiêu đề BQL) và "nullnull" (chi tiết cư dân) dù M1–M13 xanh; nguyên nhân `replaceChildren()` của DOM ⇒ helper `fill()` |
| Q18 | 2026-10-09 | M7 tách 2 phần (màn form: khoá nút; màn danh sách: tải lại khi có mạng) | Màn gửi mới không có vòng tải lại nên không thể đo "tải lại" ở đó |
| Q19 | 2026-10-09 | Người dùng: "lấy backend từ folder gốc hiện đang ở port 8000 ở docker … dùng ui trong folder portal để gen ra UI của app" ⇒ backend giữ FastAPI gốc (`/api/v1`, Docker `:8000`), giao diện chép từ `portal/` | Yêu cầu trực tiếp; SPEC-P04 |
| Q20 | 2026-10-09 | "Gen" = chép class CSS thuần của `portal/src/app/globals.css` + path SVG `icons.tsx` + cấu trúc DOM `shell.tsx`/`resident-app.tsx`/`management-app.tsx` sang plain JS; KHÔNG import TSX/Next/Tailwind | Giữ Q04 không bước build, cùng origin, giữ I-1..I-8; portal là Next.js + DB riêng (V1) |
| Q21 | 2026-10-09 | Bỏ thanh tab đáy + FAB; điều hướng = NavTiles của portal trên đầu nội dung | Đúng bố cục portal; ít thành phần trùng vai |
| Q22 | 2026-10-09 | Bước "Vị trí" (tòa S1/S2 + tầng + 4 khu vực) ghép thành dòng `Vị trí: Tòa S1 / Tầng 3 / Hành lang` nối vào mô tả; không bắt buộc | API chỉ có `original_description`; định dạng = `location_normalized` của catalog; plan 05 đã khoá "thêm vị trí không đổi mức an toàn/loại việc" |
| Q23 | 2026-10-09 | Không làm phần portal mà API không có: nút khẩn cấp, tag/nhận xét đánh giá, cư dân nghiệm thu/hủy, Thông báo, "Agent nhận diện" phía client (SPEC-P04 §8) | Không đổi API (I-1); mức an toàn và phân loại là việc của engine |
| Q24 | 2026-10-09 | Dòng mount `/app` + đồng bộ não đợt 1 bị cất trong `stash@{0}` khi đổi nhánh sang `dev`; khôi phục bằng `git checkout feature/chamanh` + `git stash apply stash@{0}` (stash giữ lại) | `dev` chậm hơn `feature/chamanh` 4 commit; hồ sơ này mở trên `feature/chamanh` |
| Q26 | 2026-10-09 17:2x | Người dùng: "tất cả các role đều cần có app để tiện chụp hình, báo cáo" ⇒ thêm Phòng ban, BPTN, Kho (SPEC-P05); thay V8 + Q05 | Yêu cầu trực tiếp; phòng ban là vai chụp ảnh sau xử lý nhiều nhất |
| Q27 | 2026-10-09 | `qa01` (QA_INTERNAL) vẫn "Dùng bản web" | Web cũng không có màn QA; tài khoản demo nội bộ |
| Q28 | 2026-10-09 | Màn phòng ban đặt khối "Ảnh sau khi xử lý" ĐẦU TIÊN trong khối thao tác, dùng chung `photoPicker` (camera + nén ≤1600 px) | Lý do người dùng nêu: chụp hình; ảnh là điều kiện bắt buộc của `report_complete` |
| Q29 | 2026-10-09 | Mọi body/điều kiện nút BPTN, phòng ban, kho chép từ `src/web/app.js` (`bptnForm`, `workSections`, `renderWarehouse`); không endpoint mới | Web đã nghiệm thu luồng này; I-1 |
| Q30 | 2026-10-09 | Bỏ hàng chip lọc ở `#/r` (ảnh người dùng gửi); 4 ô tổng quan vẫn lọc + dòng "Đang lọc: … · Bỏ lọc" | Trùng chức năng với ô tổng quan |
| Q31 | 2026-10-09 | Tách `js/staff.js` (nhãn, pill, ảnh, nội dung ticket nội bộ) dùng chung cho `bql.js`, `dept.js`, `bptn.js`, `kho.js`; mỗi file ≤400 dòng (01-CONTRACTS §1) | Không lặp code giữa 4 vai nội bộ |
| Q32 | 2026-10-09 18:15 | Người dùng (ảnh 4 ô số liệu Phòng ban): "bỏ phần này trong phòng ban đi, và thêm ở bên trên 1 icon cho chờ nghiệm thu" ⇒ màn `#/d` bỏ ô số liệu; tile thứ 3 "Chờ nghiệm thu" (`READY_FOR_REVIEW`, icon check-square của portal) | Ô số liệu trùng số trên tile; phòng ban cần xem việc đã nộp |
| Q33 | 2026-10-10 | Người dùng (ảnh màn `#/r/new`): "đổi thứ tự cho chọn vị trí lên trên trước viết vấn đề" ⇒ thẻ 1 = Vị trí sự cố, 2 = Mô tả vấn đề, 3 = Ảnh; placeholder/gợi ý đổi số bước; `?v=5`, `SHELL_CACHE` v5 (v1.8.3). Chuỗi gửi API không đổi (`Vị trí:` vẫn nối SAU mô tả) | Cư dân chọn nơi xảy ra trước rồi mới tả; API/engine không đổi |
| Q25 | 2026-10-09 | Backend Docker `:8000` crash (`ModuleNotFoundError: psycopg`): image dựng từ `dev` kéo SQLAlchemy 2.1.3 (mặc định driver psycopg 3 cho `postgresql://`). `feature/chamanh` đã ghim `sqlalchemy<2.1` ⇒ dựng lại image từ nhánh này | Gotcha ghi `-known-gotchas.md` |

### Số đo nghiệm thu local (2026-10-09, backend memory `:8001`)
| Đo | Kết quả | Bằng chứng |
|---|---|---|
| node --check 7 file JS | exit 0 | `evidence/g1-checks.txt` |
| pytest toàn bộ | 3349 passed (3344 trước + 5 mới), 0 fail, 85 deselected (như trước), exit 0 | `evidence/g1-checks.txt` |
| ruff check / format --check | exit 0 / exit 0 (110 file) | `evidence/g1-checks.txt` |
| Harness M1–M13 + 7 kiểm TEXT + 2 kiểm lỗi JS | 26/26 PASS, exit 0 | `evidence/m1-m13.txt`, `evidence/screens/` |
| Đồng bộ phòng ban (API) → app cư dân (M5) | 30,3 s, không reload trang | `evidence/m1-m13.txt` |
| Ảnh 4000×3000 sau nén (M2) | 1600×1200, ~70 KB JPEG | `evidence/m1-m13.txt` |
| Đợt 3 (mọi vai, 2026-10-09 17:53) | pytest 3349 passed exit 0; ruff 0/0; node --check 11 file 0; harness M1–M17 + TEXT + JS = ALL PASS (39 dòng PASS); 5/5 phép phá đỏ (e-no-dept-photo ⇒ M14); M15 lượt đầu ĐỎ thật: engine 409 `GUARD_FAILED` vì BPTN đổi giá trị không có lý do ⇒ app bắt buộc lý do; `:8000` Docker chỉ đọc: vesinh01 17, kythuat01 11, bptn01 67 ticket, kho01 5 dòng tồn, mọi GET 200 ≤0,72 s | `evidence/m1-m13.txt`, `evidence/mutation-*.txt`, `evidence/screens/m14–m17*`, `evidence/screens-8000/{d,p,k}-list.png` |
| Đợt 2 (giao diện portal, 2026-10-09 15:13) | pytest 3349 passed exit 0; ruff 0/0; node --check 0; harness 26/26 ALL PASS; 4/4 phép phá đỏ (a: pytest + M5/M13/M10/M11; b: M3 = 3 ticket; c: M5; d: TEXT m12 "null"); `:8000` Docker: `/app/` + tài nguyên 200, `GET /resident/tickets` 200 trong 0,72 s (50 ticket thật) | `evidence/m1-m13.txt`, `evidence/mutation-*.txt`, `evidence/screens/`, `evidence/screens-8000/` |
| Phép phá | 4/4 đỏ: a (SW cache `/api/`) ⇒ pytest + M5/M10/M11/M13; b (bỏ khoá nút) ⇒ M3 = 3 ticket; c (bỏ tải lại) ⇒ M5; d (`replaceChildren`) ⇒ 4 kiểm TEXT. Mọi file khôi phục từng byte | `evidence/mutation-*.txt` |

### Quyết định bị thay thế
- Q04 (một phần, 2026-10-09 → Q20): nguồn token/màu đổi từ `src/web/theme.css` sang `portal/src/app/globals.css`; phần "plain JS, không Tailwind, không bước build" GIỮ.
- Q16 (một phần → SPEC-P04 §4/§5): khối thao tác nằm trong thẻ chi tiết ngay sau lưới thông tin (trước ảnh/lịch sử) — vẫn trên lịch sử như Q16.
- Q05 + 00-ARCHITECTURE V8 + I-8 (2026-10-09 → Q26/Q27): app có cả Phòng ban, BPTN, Kho; chỉ QA còn màn "Dùng bản web".
- SPEC-P04 §4 hàng chip lọc ở `#/r` (→ Q30): đã bỏ.
- SPEC-P04 §4 thứ tự thẻ `#/r/new` 1 Mô tả / 2 Vị trí (→ Q33, 2026-10-10): 1 Vị trí / 2 Mô tả; nội dung từng thẻ và chuỗi `Vị trí:` giữ nguyên §4.2.
- SPEC-P05 §1 tile Phòng ban 3 ô + ô số liệu (→ Q32): 4 tile, không ô số liệu.
- 01-CONTRACTS §1 `#tabbar` thanh đáy + FAB `#new-ticket` (→ Q21): `#tabbar` là NavTiles, `#new-ticket` là tile "Gửi phản ánh".

### Ghi nhận phân công
Notion giao UI cho Trí, API/deploy cho Châm Anh. Hồ sơ này do Châm Anh yêu cầu; khi giao worker, ghi người thực hiện vào §5.

## §2. Work Packages
| WP | Việc | Tầng | SPEC |
|---|---|---|---|
| WP1 | Vỏ app: mount `/app`, `index.html`, `app.css`, `manifest.json`, `sw.js`, icon, router, `api.js`, đăng nhập, tải lại định kỳ, banner offline | 🟠 | SPEC-P01, 01-CONTRACTS §1–§4 |
| WP2 | Màn Cư dân: danh sách, gửi phản ánh + ảnh, chi tiết + timeline, bổ sung, thêm ảnh, đánh giá | 🟠 | SPEC-P02, 01-CONTRACTS §5 |
| WP3 | Màn BQL: 3 tab lọc, chi tiết, 5 hành động | 🟠 | SPEC-P03, 01-CONTRACTS §6 |
| WP4 | Test Python mount + harness Playwright M1–M13 + 4 phép phá + ảnh 390 px | 🟠 | TESTING-ACCEPTANCE |
| WP5 | Gate server (HTTPS thật, điện thoại thật) | 🟢 (chạy lệnh) — 🖐 cần người deploy | OPERATIONS §3 |
| WP6 | `docs/mobile.md` + đồng bộ não 6 điểm + `project-intro`/`-data-architecture` (thư mục top-level trong `src/` mới) + version 1.7.0 | 🟢 | AGENTS §5.B |
| WP7 | Đợt 2: giao diện theo `portal/` (CSS, icon, header/tile, 3 thẻ gửi phản ánh, stepper, màn BQL) + đo lại harness + ảnh | 🟠 | SPEC-P04 |
| WP8 | Dựng lại Docker backend `:8000` từ `feature/chamanh`, smoke không ghi | 🟢 | SPEC-P04 §10 |
| WP9 | Đợt 3: `staff.js` + màn Phòng ban / BPTN / Kho + bỏ chip Cư dân + harness M12 sửa, M14–M17 + phép phá `e-no-dept-photo` | 🟠 | SPEC-P05 |

## §3. Checklist thực thi
- [x] Bộ SPEC (00, 01, P01, P02, P03, OPERATIONS, TESTING)
- [x] Người dùng duyệt kế hoạch (Q13)
- [x] WP1 vỏ app + mount
- [x] WP2 màn Cư dân
- [x] WP3 màn BQL
- [x] WP4 test + harness + phép phá — G1–G4 local ✅ (G5 điện thoại thật qua Wi-Fi ⬜ cần người)
- [ ] WP5 gate server G6–G8 (sau khi backend có HTTPS công khai)
- [x] WP6 docs + não + version 1.7.0
- [x] Q19–Q25 + SPEC-P04 (đợt 2)
- [x] WP7 giao diện portal + harness M1–M13 (26/26) + 4/4 phép phá đỏ + ảnh mới `evidence/screens/`
- [x] WP8 Docker `:8000` dựng lại từ `feature/chamanh` + smoke chỉ đọc (`evidence/screens-8000/`)
- [x] Đồng bộ não + `docs/mobile.md` cho đợt 2
- [x] Q26–Q31 + SPEC-P05 (đợt 3: mọi vai)
- [x] WP9 màn Phòng ban / BPTN / Kho + bỏ chip Cư dân
- [x] WP9 harness M12/M14–M17 (ALL PASS) + 5/5 phép phá đỏ + pytest/ruff + Docker `:8000` dựng lại
- [x] Đồng bộ não + `docs/mobile.md` cho đợt 3

## §4. Bảng trỏ SPEC
| File | Nội dung |
|---|---|
| [`specs/00-ARCHITECTURE.md`](specs/00-ARCHITECTURE.md) | Mục tiêu, non-goals, bất biến I-1..I-8, vùng cấm, router đọc |
| [`specs/01-CONTRACTS.md`](specs/01-CONTRACTS.md) | Cấu trúc file, route tĩnh, `api()`, lưu token, endpoint từng màn, bảng lỗi |
| [`specs/SPEC-P01-SHELL-PWA.md`](specs/SPEC-P01-SHELL-PWA.md) | Mount, manifest, service worker, router, đăng nhập, tải lại, offline, nén ảnh |
| [`specs/SPEC-P02-RESIDENT.md`](specs/SPEC-P02-RESIDENT.md) | Màn Cư dân |
| [`specs/SPEC-P03-BQL.md`](specs/SPEC-P03-BQL.md) | Màn BQL |
| [`specs/SPEC-P05-ALL-ROLES.md`](specs/SPEC-P05-ALL-ROLES.md) | Đợt 3: Phòng ban (ảnh + báo cáo), BPTN, Kho trên app; bỏ chip lọc Cư dân; M14–M17 |
| [`specs/SPEC-P04-PORTAL-UI.md`](specs/SPEC-P04-PORTAL-UI.md) | Đợt 2: giao diện chép từ `portal/`, ánh xạ trạng thái → bước, vùng cấm P4-V1..V5 |
| [`specs/OPERATIONS.md`](specs/OPERATIONS.md) | Chạy local, thử trên điện thoại, deploy, rollback |
| [`specs/TESTING-ACCEPTANCE.md`](specs/TESTING-ACCEPTANCE.md) | Kịch bản M1–M13, phép phá, Exit Gates local/server |

## §5. Phân công thực tế
| WP | Tầng yêu cầu | Đã dùng |
|---|---|---|
| SPEC | 🔴 | Claude Opus (phiên chính) |
| WP1–WP3 | 🟠 | Claude Opus (phiên chính, cao hơn tầng — người dùng không yêu cầu agent con) |
| WP4 | 🟠 | Claude Opus (phiên chính) |
| WP6 | 🟢 | Claude Opus (phiên chính) |
| SPEC-P04 | 🔴 | Claude Opus 5.5 (phiên chính) |
| WP7 | 🟠 | Claude Opus 5.5 (phiên chính, cao hơn tầng — người dùng không yêu cầu agent con) |
| WP8 | 🟢 | Claude Opus 5.5 (phiên chính) |
| SPEC-P05 | 🔴 | Claude Opus 5.5 (phiên chính) |
| WP9 | 🟠 | Claude Opus 5.5 (phiên chính, cao hơn tầng — người dùng không yêu cầu agent con) |
| WP5 | 🟢 + 🖐 | CHƯA làm — cần URL HTTPS công khai của backend |

Thẩm định độc lập (agent khác) CHƯA chạy.

# Changelog & Semantic Releases

Tất cả các quyết định kiến trúc và lịch sử nâng cấp phiên bản của dự án.

## [v1.7.0] - 2026-10-10: Portal gọi backend theo ghi chú anh Cố (hồ sơ 11)
### Changed
- `portal/` (UI mới) bỏ DB riêng: mọi dữ liệu qua backend `/api/v1` (engine CR-03, Agent LLM, tầng an toàn); phiên = cookie httpOnly ký HMAC chứa token backend; ảnh qua proxy. Mở ở cổng 8000 (backend `PORTAL_URL` → portal production 3000).
- 6 màn theo ghi chú anh Cố (R1–R11) + trả lời người dùng (Q08–Q19): ô tổng quan/phụ tải bấm được, modal chi tiết với khối Agent THẬT, Hiệu suất Agent đúng/sai, Việc của BQL (lọc Đã tiếp nhận/Đã hoàn thành/Tất cả), yêu cầu vật tư "+ ngoài danh mục", form hoàn thành từng phòng, tài khoản `kho`…/`123456`.
### Added (backend, không đổi hình doc ticket — Render cũ đọc chung Supabase)
- Route: `to-bql`, `bql/handled`, `bql/return-to-bptn`, 2 route sai phòng ban, `warehouse/items`, `materials/approve`, `mo/staff`, `assign`; rating có thẻ + bình luận; trường Agent/nhân viên/đánh giá ở list rows.
- Bảng mới `maintops.material_items` (Alembic 0003), `assignments` + `rating_details` (0004); cờ `MO_CUSTOM_MATERIALS`, `MO_PORTAL_EXTRAS` (tắt mặc định trên postgres).
### Decisions
- Việc của BQL = OUT_OF_SCOPE + `blocker.escalated`; BQL đóng bằng `EMERGENCY_HANDLED` (Q09). Mọi yêu cầu vật tư phòng ban chờ Kho/BQL duyệt; duyệt = xuất kho; mọi đường bỏ dòng trả `issued − used` (Q15, Q20–Q23). Dòng vật tư mặc định xuất vượt kế hoạch theo luật chênh lệch CR-03 (Q23).
### Evidence
- Thẩm định cô lập 4 vòng (agent Opus khác), sửa mọi mục đỏ: pytest 3782 passed, ruff sạch; portal 125 unit, typecheck, lint; 4 bộ Playwright qua cổng 8000 đạt; `planning/11_2026-10-09_portal-backend-api/evidence/`.
- G6 đọc trên Supabase thật ✅ (2026-10-10): 67→70 ticket hiện đúng qua cổng 8000; 2 bảng mới chưa tạo, cờ tương ứng tắt.
- Sau phát hành: ô "Agent gợi ý đúng" hiện số lần đúng/sai cạnh % (`0f4e316`).

## [v1.4.0] - 2026-10-08: Gate nghiệm thu BQL lấy từ dữ liệu thật
### Changed
- Tab "Việc của BQL": bỏ 6 dấu ✓ viết cứng. 4 gate hệ thống tự kiểm (`portal/src/lib/inspection.ts`: phòng ban, ảnh sau xử lý, vật tư đã nhận, SLA theo giờ báo xong) + 2 mục BQL tự tích tại hiện trường; nút "Nghiệm thu đạt" khoá tới khi tích đủ. `MgmtTicket` thêm `materials`.
- Dọn 4 cảnh báo lint (import/biến thừa). `docs/portal.md` cập nhật theo đợt kho vật tư của Trí.
### Decisions
- Gate tự kiểm ✕ chỉ cảnh báo, không chặn (BQL vẫn quyết; seed có ticket chờ nghiệm thu chưa có ảnh). Action server `approveInspection` không đổi contract.
- Giữ cảnh báo lint `note` ở `receiveStock`: dấu hiệu ghi chú nhập kho bị bỏ qua (chưa có bảng lịch sử) — Idea Vault.
### Evidence
- unit 23/23 (+6), test:db 18/18, typecheck 0; đối chứng ĐỎ: gate ảnh luôn đạt ⇒ 1 test fail. Playwright: nút khoá trước khi tích, mở sau khi tích; PA-0005 hiện "Đạt 5/6" (thiếu ảnh).

## [v1.3.1] - 2026-10-08: Sửa portal sau đợt merge `feature/tri` (kho vật tư)
### Fixed
- `portal/drizzle/0002_warehouse.sql`: migration bị thiếu cho role `warehouse` + bảng `warehouse_stock` (schema có, migration không) ⇒ DB dựng mới vỡ seed ở user `kho` (`invalid input value for enum role`).
- Seed nạp kho từ `STOCK_CATALOG` (`portal/src/lib/constants.ts`) — cùng danh mục form yêu cầu vật tư của Kỹ thuật dùng; trước đó kho trống và form dùng danh sách cứng riêng.
- Modal chi tiết ticket thôi bịa "95%" khi Agent không có gợi ý.
### Evidence
- Đối chứng ĐỎ: DB chỉ có `0000`+`0001` ⇒ seed exit 1 đúng lỗi enum; có `0002` ⇒ migrate/seed exit 0. typecheck 0, unit 17/17, test:db 18/18, Playwright 9 luồng 0 lỗi trang (Postgres local cổng 5433).

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

## [Unreleased] - 2026-10-07: Agent suy luận bằng LLM thật qua Antigravity CLI (plan 06 Q30–Q33)
### Changed
- Q30: ngữ nghĩa an toàn (kêu cứu, phủ định, nghi ngờ, nhờ thay đèn cháy) chuyển về Agent suy luận; hoàn tác vá `lexicon.yaml` của worker H13 (bản p1e làm "Không có khói nhiều" thành EMERGENCY). Kernel thêm bất biến "ngữ nghĩa do LLM, không khớp từ khoá".
- Prompt Agent `agent-prompt/2`→`/5` (REF SPEC sửa trước): hình dạng tín hiệu, đầu ra gọn, phủ định = ABSENT / kêu cứu = PRESENT, `TO_BPTN` luôn kèm `bptn_reason`. Schema chỉ NỚI (lý do trường trống thành tùy chọn), record cũ vẫn đọc được.
- Q33: giữ "Agent không tự hạ mức" kể cả khi luật bắt nhầm (BPTN xác nhận bằng tay).
### Added
- Client Agent: streaming (`MO_AGENT_STREAM`), cache quyết định (`MO_AGENT_CACHE_*`), `MO_AGENT_REASONING_EFFORT`, backend CLI `LLM_MODE=agy_cli|claude_cli` (chỉ dev/demo local). Người dùng chọn `agy_cli` + `gemini-3.8-flash-low`.
- G-LIVE: `scripts/agent_live_eval.py` + `tests/test_maintenance/data/agent_live_eval.yaml` (nhãn nháp). Kết quả: khẩn cấp khó 16/16, phủ định 10/10, nhờ thay đèn 19/19 (Agent).
- Hồ sơ 08 `planning/08_2026-10-07_inflight-emergency/` (SPEC, CHỜ DUYỆT): báo khẩn khi ticket đã giao phòng ban.

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

## [docs] - 2026-10-04: Sơ đồ kiến trúc thành phần Target v0.6 (3-Tier Enterprise) nhúng README
- Hoàn thành thiết kế và nghiệm thu Architecture Component Diagram (Target v0.6) theo chuẩn `docs/CR-BPTN-03.md`.
- Tái cấu trúc theo chuẩn Enterprise 3-Tier (Clients/Gateway, Safety & Agent Decision Pipeline 5 trạm & Human Operations, Persistence & Telemetry) triệt tiêu hoàn toàn hiện tượng dây nối chồng chéo và cắt ngang chữ.
- Nhúng SVG vector và mã nguồn Mermaid collapsible vào mục "## Kiến trúc hệ thống (System Architecture)" trong root `README.md`.
- Xuất xưởng đầy đủ bộ artifact tại `docs/diagrams/maintenanceops-target-20261019/`: SVG, .drawio, .mmd và tài liệu hướng dẫn. Hồ sơ `planning/05_2026-10-04_component-diagram/`.

## [docs] - 2026-10-04: Làm mới README (không đổi version app)
- Viết lại `README.md` cho giảng viên chấm: chạy nhanh Docker không khoá, bảng biến môi trường đủ, câu phản ánh mẫu + curl/PowerShell, API theo code đang chạy (không phải CR-03 đích), Supabase là tuỳ chọn. Bỏ mục `log_manual.py` sai, `/reopen` không còn, Deliverables Checklist, các dòng Team `[Tên]`. Hồ sơ `planning/06_2026-10-04_readme-refresh/`.

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

## [docs draft] - 2026-10-04: Target component diagram specification
- User confirmed: target 19/10; LangGraph, Render/Supabase/OpenAI, Phoenix, human review. GPT-4o + vision proposed.
- Hồ sơ 05: plan + 5 SPEC, 10 components/12 edges, draw.io+SVG 16:9; pending approval, chưa dựng hình. Không release/bump app ở bước draft, không sửa CR-03/API/code.

## [docs] - 2026-10-04: Target component diagram delivered locally
- Spec05 được người dùng duyệt; draw.io native editable + SVG1920×1080 đã dựng, draw.io31.7.0 export exit0.
- 10 components/12 edges; 3 negative checks đỏ đúng exit1; final exit0; 0 overlap/clipping/node crossing, 2 connector crossings; Phoenix/HITL rõ, GPT-4o+vision proposed.
- Nguồn/usage tại docs/diagrams/maintenanceops-target-20261019/README.md; artifacts cũ và root README giữ nguyên. Không app release/version bump; user visual review pending.

## [docs] — 2026-10-04: README and architecture consistency correction
- Correct broken components paths, clone URL, sample ticket ID and APP_HOST/APP_PORT documentation.
- Current artifacts are implementation views; LangGraph/Phoenix/GPT-4o remain targets. Add step 5, safety-first ordering, REWORK and persistence throughout processing. Previous target-only and Zero-Crossing statements describe superseded artifacts. No application version change (docs-only scope of plan 06).

## [docs] — 2026-10-04: Restore user-selected diagram layouts
- Restored components SVG from Downloads and extracted its embedded draw.io source; restored exact data-flow SVG/draw.io/Mermaid from VS Code history.
- Supersedes replacement implementation layouts introduced in the correction. README keeps setup/link fixes; current-code differences remain in text next to target diagrams. App version unchanged.

## [docs] — 2026-10-04: Isolated develop integration
- Merge develop 37a0fb3 with the preserved local documentation snapshot on integration/truong-develop-20261004 only. Both sides of brain-memory conflicts retained. Original feature/truong and develop refs are protected; no remote push.

## [docs] — 2026-10-04: Adopt tested develop integration on feature/truong
- User authorized feature/truong update; branch fast-forwarded from saved local snapshot5f7c354 to integrationf4155d6 (develop37a0fb3). Source already validated, no new runtime implementation.
- Tests rerun on actual feature worktree: 1843 passed, 29 pg deselected; ruff check/format pass. Diagrams and three new submission files preserved; develop and remote feature ref unchanged, no push.


## Local develop integration — 2026-10-07T03:04:07.271Z
- Integrated origin/develop 52ae81c into feature/truong; runtime src/tests/seed equals upstream; local diagrams/submission preserved. pytest 2971 passed, 29 PostgreSQL tests deselected, 0 fail, 0 skip; ruff check/format and four JavaScript syntax checks pass. PostgreSQL/Docker/live LLM/browser not verified; no typecheck configured. Day05 labels/backlog and Day06 blocker/resume comparison still need acceptance; LangGraph runtime pending. No remote push.
- Backups: backup/truong-before-integration-20261007 (e52c655), backup/truong-local-20261007 (0f7bf85).
- Evidence: planning/06_2026-10-04_readme-refresh/evidence/integration-20261007/. Initial proposal JS check used an incorrect path; corrected check covers src/web/js/components/agent_proposal.js.


## GPT-6 Luna local configuration — 2026-10-07T03:15:09.129Z
- Local GPT-6 Luna activation requested: .env now LLM_MODE=openai, MODEL_NAME=gpt-6-luna; proposer sets reasoning_effort=none for Luna Chat Completions. Real smoke call failed with OpenAIAuthenticationError (placeholder key), logged FALLBACK_RULE; successful real LLM usage is NOT verified. Replace OPENAI_API_KEY locally, then restart and verify AI Logs SUCCESS + rules+llm:gpt-6-luna. Targeted regression: 30 pass, ruff check/format exit0. No server running on localhost8000/8001/8080 at inspection; no push.

## [Unreleased] — 2026-10-07: Shared Supabase compatibility and demo
- Shared Supabase demo SIM-TKT-0042 CLOSED; 2 simulated PNG photos byte/hash verified through API and Storage after restart; cases53->54, preexisting53 unchanged, stock unchanged; GPT-6 Luna SUCCESS / rules+llm:gpt-6-luna (2000.82ms); missing execution photo blocked completion; pytest2973 passed,29 pg deselected, ruff clean. Server127.0.0.1:8001 (jobs/seed/reset false).
- Evidence: planning/07_2026-10-04_online-acceptance/evidence/supabase-demo-20261007/result.json; run_demo.py; pytest.txt; ruff-check.txt. Real AI response preserved in recovery_ai_logs; in-memory API AI Logs are empty after restart. No rating submitted. API flow exercised; no manual browser walkthrough/public deployment/physical maintenance acceptance. Day05/06 remain open.
- Fixed Ticket.merged_children missing from the local model although CR-BPTN-03 §8/§13 defines it. Before fix, reading shared cases failed extra_forbidden and create returned422 after ingest. Typed list with empty default preserves stored links; unknown fields still forbidden. No migration, filtering, or rewriting of existing shared tickets. Recovered existing demo through engine.run_agent; no second ticket created. Two repository regression tests added. No merge/unmerge behavior newly implemented.

## [Unreleased] — Day04 evidence contract day04-3 — 2026-10-07T04:32:59.390139+00:00
- User removed six unused cases from personal acceptance scope; active9=H01,H02,I01,A01,M01,U01,S04,G03,R01. day04-3 manifest/results/issues normalized from valid references, separated legacy8PASS/1BLOCKED and Supabase1PASS/1FAIL (create422 recovered but pending clean201 retest). No cross-build9/9 claim. All references/counts/source time provenance checked;3 corruption controls rejected. No app execution/shared writes/commit/push.
- Records: planning/07_2026-10-04_online-acceptance/deliverables/manifest.json, results.json, issues.json, day04-summary.md; validation: evidence/normalization-20261007/validation.txt in that plan.

## Unreleased — Day05 planning 2026-10-07T05:07:58.261170+00:00

Added proposed package09 for backlog triage and independent classification/safety gold; target80 safety/40 classification, family-held-out protocol and D4-11 regression. Planning validation exit0,3 negative controls. No runtime/API change, app release or version bump; data contracts remain proposed day05-1.

## Unreleased — Day05 local execution 2026-10-07

Executed the offline part of package 09: 15-item backlog (PROPOSED, D4-11 re-measured still failing), 50 DEVELOP cases with separate safety/classification proposals (agent-drafted, no gold), review pack with opaque IDs, validator/baseline runner/review-pack tools (270 tests, 0 skip; ruff clean). Decision: workers' H01/H02 outputs rejected after independent measurement and redone at a higher tier; cold audit found 1 blocker + 5 majors in the tools, fixed in H05. Freeze hash definition chosen by orchestrator (sha256 of `<file>:<sha256>` lines). No gold, held-out, freeze or baseline yet; no runtime/API change, app release or version bump.

## Unreleased — Day05 daily report 2026-10-07T06:16:13.491588+00:00

Added docs/submission/daily/2026-10-05.md from freshly measured evidence. Tools270 pass;95 manifest hashes match; full dataset gate fails honestly for absent gold/held-out. No runtime contract, app release or app version change; Day05 not closed.


### Unreleased — Day05 submission report 2026-10-07T06:21:49.340237+00:00
Added main day05-report.md, submission index and daily backlink; explicit pending acceptance. Documentation only; no application version change.


## Integration record — 2026-10-07T13:30:26.152115+00:00
Merged develop04491ad into feature/truong 79f9444, importing upstream version1.3.0; no additional version bump/release. Preserved local dirty work, repaired conflicts, final3341 tests green/76 deselected and270 tools green. Shared rollout/real LLM/portal not verified.


### Portal local startup ? 2026-10-07T13:50:36.821687+00:00
Configured ignored portal/.env.local, installed locked dependencies, initialized local portal DB and started Next dev3000.17 unit tests pass; no source/runtime contract/app version changes, no shared DB writes.

- 2026-10-07T16:47:40.721485+00:00 Unreleased documentation/data preparation: Day05 completion packet and fresh offline measurements; application version unchanged, no release or runtime modification.

- 2026-10-08T08:59:38.730526+00:00 Unreleased documentation: user-approved PRELIMINARY_15 replaces broad Day05 evaluation quota; human review, evidence and runtime safety gates retained. No application release/version change.

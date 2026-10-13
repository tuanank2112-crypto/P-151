# Roadmap & Active Tasks

File này chứa danh sách các tính năng, mục tiêu sắp tới và tình trạng công việc hiện tại.

## Mục tiêu hiện tại (Active)
- [ ] **Plan18 — UI portal mới dùng backend Python:** người dùng đã duyệt SPEC, đã triển khai runtime local; đã đo implementation local, chưa đóng gate môi trường. Auth/token, ID string, data/actions/ảnh/vật tư/Kho qua Python, không DB workflow riêng. Không gồm nâng cấp semantic P09. Local1.11.0; boot/Docker/điện thoại chưa đạt, chưa commit/deploy.
- [ ] **Plan 17, local 1.10.1:** UI develop b6590ce đã nhập; giữ backend Châm Anh, proxy và migration Kho. Build/typecheck/unit đạt; pytest memory 3438 + proxy/material focus47. Đã commit/push2ced265. Còn rollout Docker/điện thoại; plan18 đã thay workflow portal riêng bằng API Python.
- [ ] **Plan 16 rollout:** deploy server (G4 server ⬜), recreate `p151-backend-1` `:8000` bằng image mới (nối Supabase chung — người dùng quyết), thử trên điện thoại thật, cấp hub để boot G0.
- [ ] Local v1.9.8: đã cập nhật `feature/chamanh` tới `7131510` (remote v1.9.7), giữ bản sửa Docker/GPT-6 Luna; cần rebuild Docker và test app trên điện thoại. Test API hạ khẩn cấp đã sửa để chấp nhận `blocker=null` sau tra tài sản theo khu vực.
- [ ] **Plan 11 — App điện thoại PWA cho Cư dân + BQL (v1.7.0):** gate local G1–G4 ✅ (2026-10-09: pytest 3349, harness 26/26, 4/4 phép phá đỏ). Client mỏng `src/mobile/` ở `/app/`, cùng API ⇒ cùng DB với web; tải lại 30 s; SW không cache `/api/`. Còn: G5 thử trên điện thoại thật qua Wi-Fi; G6–G8 cần backend HTTPS công khai (Render); commit. Đợt 2 (2026-10-09): giao diện theo `portal/` trên backend FastAPI gốc (SPEC-P04). Đợt 3: mọi vai vận hành (Phòng ban chụp ảnh/báo cáo, BPTN, Kho) — SPEC-P05. Hồ sơ `planning/11_2026-10-09_mobile-pwa-app/`.
- [ ] **Hồ sơ 11 — Portal gọi backend theo ghi chú anh Cố (v1.7.0, 2026-10-09):** WP1–WP8 ✅ local (pytest 3782, portal 125 unit, 4 ui-check qua cổng 8000; thẩm định cô lập 4 vòng Q20–Q23); G6 ĐỌC ✅ trên Supabase thật (70 ticket, 2026-10-10). Còn: PR #20 `feature/nhuy-portal-fe` → `develop` chờ review/merge + deploy Render; sau đó Alembic 0003/0004 trên Supabase + bật `MO_CUSTOM_MATERIALS`/`MO_PORTAL_EXTRAS` (cần gật); `OPENAI_API_KEY` cho Agent LLM thật; nhãn "tách từ" khi Agent tách 2 việc (chờ người dùng). Bảng thông báo: hoãn. `planning/11_2026-10-09_portal-backend-api/`
- [ ] **(2026-10-10) Plan 06 Q35 — gỡ khớp chuỗi trích dẫn khỏi cổng chặn LLM:** WP18 SPEC-P10 ✅ duyệt 10:08:38; WP19 runtime ✅ local (commit cùng ngày, PR #19): vòng 1 R19 🔁 (test không bắt cổng "không chung từ"), vòng 2 sửa test — SO đo lại đột biến X1b/X2b/X6/X9 đều đỏ; worker báo pytest 3685 passed/0 fail/0 skip, ruff sạch (SO chạy lại toàn bộ: 3685 passed, exit 0). Còn: `--pg` (Docker tắt); live NOT_RUN; Q-P10-1…4 chờ người (G-1/G-2 hạ MINOR?, rủi ro bịa vị trí, F8 chỉ đường luật?, P09 bỏ job.quote grounded); Q-P10-5 SO chọn marker `0003` khi deploy.
- [ ] **Plan 06 — Agent với LLM thật (2026-10-07):** chạy qua Antigravity `agy_cli` + `gemini-3.8-flash-low` (dev/demo local). G-LIVE: khẩn cấp khó 16/16, phủ định 10/10, nhờ thay đèn 19/19 (Agent). Còn: chạy lại đủ 76 câu với prompt /5; Trường duyệt nhãn G-LIVE (câu "Thấy cháy ở tầng 8"); H13/WP14 ✅ local 2026-10-09 (R13 vòng 2b, `--pg` ⬜); viết handoff WP14b; thời gian ~17–20 s/lượt (đề xuất cho Agent quyết chạy nền — cần SPEC); deploy server cần API key thay CLI.
- [ ] **Plan 08 (2026-10-07, báo khẩn cấp khi ticket đã qua tầng an toàn):** SPEC + H01–H03 xong, 🟡 CHỜ DUYỆT. Lỗ đo được: luật + Agent cùng bỏ sót ⇒ ticket tới phòng ban, sau `ROUTED`/`IN_PROGRESS`/`ON_HOLD` không có đường lên Bậc 1. Chờ: người dùng duyệt, Trường duyệt delta CR (E03/E04, T24–T28), merge `origin/develop`, dựng `.venv`, H13 plan 06 (F1) ✅ trước. `planning/08_2026-10-07_inflight-emergency/`.

- [ ] **Plan 07 — UI `src/web/` theo design portal (v1.3.0):** gate local G1–G4 ✅ (2026-10-07). Còn: dựng lại container `backend` để `:8000` có giao diện mới (gate server), commit.
- [ ] **Plan 06 — Cổng phản ánh cư dân (`portal/`, v1.2.0):** gate local G1–G6 ✅ (2026-10-07). Còn: cột server (chọn nơi deploy + Postgres production, `npm run build && start` sau `db:migrate`), người dùng duyệt 9 lệch thiết kế D1–D9, commit.
- [ ] **Plan 06 (2026-10-05, Reasoning Agent làm trung tâm điều phối & P1):** Kiến trúc điều phối ngữ nghĩa `SPEC-P09-semantic-coordination.md` (PROPOSED). 6 vòng thẩm định R15 (§01–§17). **B1/B2 ĐÌNH CHỈ (Q35, 2026-10-10): kiểm quote bằng chuỗi/khoảng ký tự = word-by-word.** **WP15 ✅ local 2026-10-10 (F4–F7, F9; F8 theo Q36: "hai nơi" chỉ đường luật/Mirror, không gác Agent; 3704 passed; `--pg` ⬜).** Còn: WP14b (F2/F11 bằng Agent), WP12 thẩm định lại, duyệt P09 (B3/B4). Nội dung cũ: B1 (kiểm tra giao khoảng sự cố vs nơi ở, chặn quote bao trọn), B2 (ràng buộc đầy đủ 3 thành phần vị trí cho override và shared_location, chặn quote rút gọn mồ côi và khác khu vực), B3 (bất biến next_step & phân cấp ưu tiên an toàn), B4 (cardinality metadata cho 0/1/2 jobs, quy tắc nâng sàn kỹ thuật KY_THUAT LOW, PostgreSQL JSONB runbook quiesce dừng toàn bộ writers). Handoff H16 thi công runtime WP17 đang ở trạng thái CHỜ DUYỆT.
- [ ] **MVP online 04/10/2026:** engine CR-03 P0 đã xong (xem Done); còn nối router/UI cho 5 method khẩn cấp + `set_priority` (Châm Anh/Trí — gợi ý ở `planning/01_2026-10-01_cr03-p0-engine/specs/00-ARCHITECTURE.md` §4.1), deploy Render, gpt-4o thật (persistence PostgreSQL/Supabase đã có từ `develop`, hồ sơ lưu trữ 01).
- [ ] **Sau tích hợp:** engine CR-03 P0 ĐÃ VÀO `develop` (PR #7, `6265436`). Còn: CI không chạy vì tổ chức hết hạn mức GitHub Actions (mọi run fail "job was not started") — người quản lý tổ chức xử lý; chạy test `--pg` với DB thật; bump version app khi nhóm phát hành.
- [ ] **Câu hỏi mở hồ sơ 02:** phân công nhân sự — `develop` D-12 (phòng ban ghi `assignee_id`) mâu thuẫn CR-03 P0 (`set_assignee` bị chặn, `assignee_id` chỉ `null`); người quyết.
- [ ] **Báo Trường (plan 04 Q14):** Q22 "bóng đèn bị cháy" đã sửa trong `rules.py` (KY_THUAT) cùng tách vị trí mở rộng — Trường rà lại vì là vùng rules/playbook. Còn mở cho Trường/nhóm: phản ánh ngoài phạm vi bị hỏi vị trí (CR-03 §5.1, Q15).
- [ ] **Bàn giao plan 04 (handoffs H03 Châm Anh / H04 Trí / H05 Trường):** Châm Anh — áp bản vá `H03_backend-api.patch` (chặn ảnh giả `/evidence`, route ảnh threadpool, `/ai-logs` theo vai, thứ tự `/mo/tickets`, giới hạn chữ, khoá session); lỗi E2E mới: kho ngoài phạm vi vẫn thấy trạng thái, `/ai-logs` `since` không timezone ⇒ 500, NaN/Infinity ở vật tư/tồn kho, chữ "string" ở mô tả/hủy, upload kiểm quyền sau khi đọc tệp, lọc `blocker_owner_role` ở `/bql/tickets` bị bỏ qua, cư dân thấy câu BPTN gõ như phần bổ sung của mình; Trí — khung BQL xử lý Bậc 2 đã leo thang không bao giờ hiện (`t.escalated`), nút "báo sai phòng ban sau khi nhận" và "thiếu vật tư" gọi sai route, form BPTN không xét NEED_INFO an toàn, ô tự kiểm ảnh sau REWORK và tab AI Logs lệch với plan 04; SPEC/P1 — T18 thiếu vật tư sau nhận việc, đếm WRONG_DEPT báo BQL, audit + báo BQL khi nhập kho.
- [ ] Log AI cho BTC: tắt alias Python trên máy Như Ý hoặc merge `_pyrun.sh` của Trí từ `develop` (xem gotchas); kiểm `.ai-log/session.jsonl` có dòng mới.
- [ ] Đồng bộ chữ `planning/01_.../specs/01-CONTRACTS.md` §5 cho 3 khoá WP3d (`hedge_forms`, `homograph_confirmers`, `coordination_hazard_exclusions`) + nới V-08 (nguồn chân lý hiện là `lexicon.yaml` + SPEC-P01 §0.1).
- [ ] Trường rà nhãn từ vựng `lexicon.yaml` (từ mới của WP3b–WP3d) và danh sách `khet_electric_contexts`; mọi sửa phải chạy bộ dừng.
- [ ] Sơ đồ swimlane khớp CR-03 (thay `docs/Activity Diagram.png`): an toàn trước phân loại, phân loại trước trùng (D-09), có Bậc 2 cho BPTN, gộp → `MERGED` kết thúc, Kho, rating.
- [ ] (nhánh `develop`) Kế hoạch lưu trữ 01 `planning/01_2026-10-02_supabase-persistence/` (đích 0.6.0): WP1 ✅; WP2–WP4 xong local (R02 chờ duyệt);
  còn WP4b (phiên lưu DB), WP5 (smoke + gate Supabase: owner chạy migration), WP6 (docs, bump).

## Tương lai (Upcoming)
- [ ] **Bàn giao 19/10/2026 — CR-BPTN-03 P1:** T16/T17/E02 (08/10), gộp an toàn + hoàn tác (09/10), tín hiệu P1 + PRI-U1/U2 (10/10), follow-up + danh sách xác nhận an toàn (11/10); LangGraph trên đường chạy thật (05–07/10), thay boilerplate `src/agents/`; eval: an toàn ≥40 câu, 0 bỏ sót Bậc 1, classification ≥90% held-out, coverage ≥60%.
- [ ] Cập nhật docs `01`–`05`, `data-contract-v1.md`, `playbook-v1.md` theo CR-03 (hiện còn ghi v0.3/CR-02, có link gãy tới CR-02). README đã làm xong 2026-10-04 (hồ sơ 06).
- [ ] Audit cho `receive_stock` (kho nhập vật tư): hiện không có dòng audit vì `AuditEvent` bắt buộc `ticket_id`.
- [ ] Nếu deploy sau reverse proxy (Render): lấy IP client từ header tin cậy, nếu không khóa đăng nhập sẽ dồn về IP của proxy.

## 💡 Kho Ý Tưởng & Backlog (Idea Vault)

- [ ] **(2026-10-14) Hồ sơ 20 mở rộng:** đo thời lượng hết hàng (cần mốc về 0 trên `stock`) để báo "sau N giờ"; ngưỡng `min_qty` (sắp hết); kênh push/Zalo/email; cảnh báo ở `src/mobile/`; Vệ sinh cũng nhận cảnh báo.
- [ ] **(2026-10-12) Hồ sơ 19 đợt 2 (SPEC-P04):** việc ngoài phạm vi chỉ ở Tiếp nhận (đổi Q14 develop), dashboard hiệu suất phòng ban có bộ lọc thời gian + endpoint, Kho lịch sử nhập/xuất + xuất hao hụt, dashboard Agent, app điện thoại dùng `min_qty` thay `qty < 30`.

- [ ] **(2026-10-11) Playbook Kỹ thuật cho quạt và nút bấm trong thang máy:** người dùng xếp trong phạm vi nhưng Kỹ thuật hiện chỉ có `PB-TEC-01` (đèn). Cần SPEC (playbook, checklist, bằng chứng, vật tư, từ vựng, prompt), kế hoạch MINOR. Tới lúc đó các ca này đi OUT_OF_SCOPE.
- [ ] **(2026-10-11) Rà `PLACE_DEFS` của portal** (Trong căn hộ, Khu vực chung, Thang 1/2/3…) với `AREA_PATTERNS`; cân nhắc có nên đổi Q14 để ca Agent đánh ngoài phạm vi qua BPTN trước.
- (plan 16) Chống sửa đè khi hai người cùng lưu vật tư một ticket (expected-version) — §C4 cố ý chưa làm; full replacement, lần sau thắng.
- (plan 16) `screenIsDirty()` của app bỏ qua `<select>`/`input[type=number]`; hiện vá cục bộ bằng `data-dirty` ở khối vật tư — form khác có select nên rà lại.
- (plan 16) Mỗi agent/đợt đo `--pg` dùng DB `*_test` riêng để chạy song song không truncate lẫn nhau.
- [ ] (plan 15 §1 vùng cấm) Đưa "vật tư thuộc playbook/phòng ban" (`catalog.playbook_materials`), "số lượng nguyên" và "Kỹ thuật ≥1 vật tư" xuống engine — hiện chỉ app kiểm; cần người duyệt vì đổi contract (`test_confirm_no_materials_sets_mode_na`).
- [ ] **(2026-10-10) Đèn theo KHU VỰC thay asset từng bóng (người dùng chốt ý, CHỜ Trường + Như Ý + bảng dữ liệu):** người dùng: mỗi loại khu vực dùng một loại bóng (hành lang = A, thang máy = B) ⇒ không cần BPTN chọn. Hiện: bước 6 khớp asset đúng Tòa/Tầng/Khu vực (catalog 6 đèn ⇒ SIM-TKT-0056 S2/T9/Phòng rác đứng `ASSET_UNCLEAR`), bước 7 lấy `default_materials` chung mọi khu vực. Đề xuất: `catalog.yaml` `area_lighting` (khu vực → `item_code`, có LAMP-01 LED / LAMP-02 tuýp), bước 6 khu vực có trong bảng ⇒ đi tiếp, bước 7 lấy bóng theo khu vực, BPTN chỉ khi khu vực ngoài bảng. Đổi CR-03 §9.1 ⇒ cần duyệt; người dùng cấp bảng 12 khu vực.
- [ ] **(2026-10-10) Vị trí chữ ≠ vị trí chọn trên app (CHỜ NHÓM QUYẾT):** app ghép `Vị trí: …` vào cuối mô tả; `rules._location_parts` chọn khu vực theo THỨ TỰ `AREA_PATTERNS` (Sảnh thang máy > … > Hành lang > … > Phòng rác), không theo nguồn, không báo mâu thuẫn. Đo (mock, `:memory`): "Đèn hành lang hư" + chọn Phòng rác ⇒ asset Hành lang (chữ thắng); "Phòng rác bốc mùi" + chọn Hành lang ⇒ Hành lang (lựa chọn thắng, đội vệ sinh đi sai chỗ). Hướng: (1) app cảnh báo trước khi gửi khi chữ nhắc khu vực khác lựa chọn (client, Châm Anh/Trí); (2) engine coi dòng `Vị trí:` là nguồn chính hoặc mâu thuẫn ⇒ hỏi lại (đổi luật, Như Ý/Trường). Đường Agent LLM chưa đo.
- [ ] **(2026-10-09) Từ thẩm định R01 plan 12 (mức 🟢/nghi ngờ):** `Accept-Encoding: gzip;q=0` vẫn nén (Starlette tìm chuỗi con); pool ghi 2+0 không dư khi `seed()`/tx dài > 30 s; đăng xuất khi offline không thu hồi phiên server; `apiImage` (app) 401 không gọi `onUnauthorized`; form an toàn của APP điện thoại chưa chặn lý do trống ở client (web đã sửa ở plan 13).
- [ ] **(2026-10-09) Ảnh nhanh hơn 1 câu SQL (đã chọn (c) giữ ~56 ms):** nếu sau này ảnh thành điểm nghẽn ⇒ URL ảnh ký HMAC có hạn (đổi API, kế hoạch MINOR riêng). KHÔNG cache dữ kiện kiểm quyền (reset dùng lại id; R01 #2 cho thấy cache bỏ qua kiểm quyền nguy hiểm).
- [ ] **(2026-10-09) Rà soát backend — CÒN LẠI sau plan 12 (#1 #2 #4 #6 #8 đã làm):** khoá theo ticket thay `engine.lock` (#3), bỏ audit/notifications khỏi doc (#5, đổi schema), `/bql/tickets/{id}` cho màn chi tiết BQL (#7), gỡ route mẫu `/api/v1/chat` + test (#9). Bản rà soát gốc:  (1) mỗi lần đọc DB = 4 vòng mạng (pre-ping + BEGIN + query + ROLLBACK) ≈ 220 ms, query thật 55 ms ⇒ engine ĐỌC riêng `isolation_level=AUTOCOMMIT` đo 95 ms (bỏ thêm pre-ping + thử lại khi rớt kết nối: 52 ms); (2) `add_execution_photos`/`resident_add_photos` là `async def` nhưng gọi Supabase Storage đồng bộ (timeout 30 s, `time.sleep` 0,5 + 1 s khi lỗi) và ghi DB ⇒ chặn event loop cả server; mỗi ảnh một transaction ⇒ đổi sang `def`/threadpool + gộp một `_mutate`; (3) ghi ≈ 8–9 vòng mạng (~450–500 ms) dưới `engine.lock` toàn cục ⇒ trần ~2 ghi/giây; (4) không gzip: danh sách 54–69 KB → 4 KB (`GZipMiddleware`); (5) doc ticket chứa audit (49% doc lớn nhất) trùng bảng `audit_log`; (6) ảnh tải lại từ Storage mỗi lần (~0,5 s, có lần 3 s) ⇒ cache bytes / `immutable`; (7) app BQL chi tiết tải cả `/bql/tickets` mỗi 30 s; (8) `run_jobs` đọc lại `repo.get` dưới lock; (9) gỡ route mẫu `/api/v1/chat`, `/status` (không auth, không dùng).
- [ ] **(2026-10-09, sau plan 11) App điện thoại `src/mobile/`:** realtime (SSE từ backend hoặc Supabase Realtime) thay tải lại 30 s; push notification (Web Push — iPhone cần app đã cài, iOS ≥16.4); bọc Capacitor để lên App Store/CH Play; token cookie HttpOnly thay `localStorage` (cần đổi `auth.py`); session lưu DB để app không bị đăng xuất khi backend restart; form an toàn Bậc 2 cho BQL trên app; sửa form BPTN của web (ô lý do đang ghi "không bắt buộc" nhưng engine bắt buộc).
- **Portal — chia việc kỹ thuật Điện / Nước (2026-10-11):** thay cho gán từng nhân viên (đã bỏ). Nhãn chuyên môn phải đến từ Agent/danh mục đóng (vd `playbook_departments` thêm `specialty`), KHÔNG suy từ từ khoá ở portal. Backend hiện chỉ có playbook đèn `PB-TEC-01` ⇒ cần chốt phạm vi nước trước.
- **Portal — lịch sử nhập/xuất kho (2026-10-08):** bảng `stock_movements` lưu ghi chú "Nguồn cấp" khi nhập kho (hiện bị bỏ) và trừ tồn khi kho duyệt cấp vật tư cho ticket. Cần chốt có làm trước demo không.
- [ ] **(2026-10-10, R14):** `src/main.py` lệch `ruff format` (proxy portal, có sẵn từ develop) ⇒ cổng format toàn repo đỏ; chủ file sửa, không thuộc plan 06.
- [ ] **(2026-10-10, R19 thẩm định WP19):** `agent/validate._check_location` loại tòa viết "Toà S1" (dấu đặt trên a, khác "Tòa") ⇒ LLM trả đúng mà bị loại vì chính tả — chuẩn hoá Unicode/kiểu bỏ dấu khi so danh mục (không phải khớp câu cư dân); SPEC-P10 bắt giữ nguyên khối này ⇒ cần architect quyết. Cũng chờ người: Q-P10-1…4 (G-1/G-2, rủi ro bịa vị trí, F8, P09 job.quote).
- [ ] **(2026-10-09) Từ thẩm định WP14 vòng 2:** thống nhất SYSTEM gọi `transition` từ ngoài (T09 nay 403, T05/T03 vẫn 409 — test §11); đồng bộ SPEC-P01 dòng 45 + `REF-agent-contract.py:246` với `grounded` mới; `safety._grounded("--")` = True (vùng cấm safety.py, chỉ chiều nâng); Agent nhắc lại vị trí đã khoá không kèm quote ⇒ cờ AGENT_FALLBACK báo nhầm (P09); T06 + trả lời vô hại thiếu vị trí nay về `SAFETY_REVIEW_REQUIRED` — thêm test.
- [ ] **(2026-10-07) Cư dân báo nguy hiểm khi ticket đã giao (plan 08 P2):** bổ sung văn bản chạy 2b ở mọi trạng thái chưa kết thúc; hiện cư dân chỉ bổ sung được khi `NEED_INFO`.
- [x] **(2026-10-07→09) `portal/` nối engine Python:** xong ở hồ sơ 11 (portal gọi `/api/v1`, Agent LLM thật, tầng an toàn của backend).

- [ ] **(2026-10-07, sau plan 07) `src/web/`:** đổi Tailwind Play CDN sang Tailwind CLI (bỏ biên dịch class trên trình duyệt); xoá hẳn `js/dark_mode.js` và `js/components/*.js` (không còn được nạp) sau khi Trí xác nhận; tile menu kiểu portal nếu app có tab (vd AI Logs).
- [ ] **P1 tiếp theo (người dùng chốt 2026-10-05, sau plan 05):** luồng trùng đầy đủ CR §8 (đếm trùng + danh sách ticket con, nối bổ sung/ảnh sang ticket gốc, cư dân ticket bị gộp được đánh giá, hoàn tác gộp T09 + `duplicate_rejected_of`, ticket gốc bị hủy ⇒ ticket con chạy lại, BQL gộp khẩn cấp T08, PRI-U1 nâng ưu tiên khi ≥3 trùng); tách ticket khi một phản ánh có hai việc (Agent đề xuất, BPTN xác nhận — chờ người dùng chọn tự tách hay xác nhận); tín hiệu an toàn P1 (gas, kim tiêm, nước vào tủ điện, đèn nóng); đếm trả sai phòng ban báo BQL; giữ/liên kết ticket thường khi cùng chỗ có khẩn cấp; ưu tiên "suýt trượt"/"tràn ra cả hành lang". Route/UI cho các hành động mới giao Châm Anh/Trí.
*Nơi lưu trữ các ý tưởng hay, kiến trúc mở rộng chưa ưu tiên làm ngay nhưng cần giữ lại để tham khảo.*
- [ ] **(2026-10-08, audit plan 09, ngoài phạm vi):** (1) bỏ `audit`/`notifications` khỏi doc `maintops.cases` (đã có bảng riêng; chiếm 344/725 KB) — cần migration; (2) agent/LLM chạy nền khi cư dân gửi để màn gửi không chờ model; (3) lưu session đăng nhập vào `maintops.sessions` (bảng có sẵn, chưa dùng) — restart backend hiện đá mọi người ra; (4) phân trang danh sách khi > vài trăm ticket; (5) gzip response + `description` cho `BqlTicketRow` để màn BQL gọi 1 API (người dùng bỏ khỏi plan 09).
- [ ] **(2026-10-07) `portal/` sau v1.2.0 (ngoài thiết kế, chưa làm):** BQL đăng thông báo; nơi quản trị từ khóa của Agent (tab Quy tắc từ khóa đã bỏ theo Q12 — hiện chỉ sửa qua seed/SQL); nút tạm hoãn/đặt hạn mới cho phòng ban (cờ `paused` hiện chỉ có từ seed, giao việc/báo xong tự gỡ); khoá đăng nhập theo số lần sai; phân trang "Tất cả ticket"; thay `classify()` bằng LLM giữ nguyên contract `{dept, confidence, keywords, urgent, locationFromText}`; ticket bị gộp cho cư dân nguồn xem ticket đích; CI chạy `test:db` với service Postgres.
- [ ] **(2026-10-05) Mở rộng tòa ngoài Ocean Park S1/S2:** thêm mã vào `catalog.yaml` `site.buildings` + `field_labels.location_building`; cân nhắc kiểm cả vị trí BPTN nhập tay và mã con (vd `S1.01`).
- [ ] **(2026-10-07) Supabase dùng chung giữa các nhánh:** model `extra="forbid"` ⇒ nhánh nào ghi field mới là nhánh khác 500 toàn bộ danh sách (lần này `merged_children`). Cân nhắc: mỗi người một schema/DB dev, hoặc migration + field mới phải merge vào `develop` TRƯỚC khi chạy lên DB chung. Engine (Như Ý) còn phải điền `merged_children` khi gộp trùng (P1 §8) — hiện chỉ nạp/giữ.
- [ ] **(2026-10-07) Test đỏ sẵn trên `dev`:** `test_engine.py::test_partial_delivery_updates_the_stock_the_waiting_ticket_shows` (mong `ROUTED`, blocker None sau nhập đủ) — chưa rõ chủ, cần xem.
- [ ] Chạy ruff format cho `scripts/` (hiện CI không kiểm).
- [ ] **(2026-10-01) n8n đẩy sự kiện nhập kho vào MaintenanceOps** — NGOÀI scope MVP (CR-03 §1: không tích hợp kho thật); chỉ xét qua change request. Điều kiện tối thiểu: khoá chống trùng (`event_id`) vì `receive_stock` đang cộng dồn, tài khoản máy riêng vai WAREHOUSE (không dùng mật khẩu `kho01`, không bật `MO_ALLOW_ACTOR_HEADER`), tồn kho lưu bền thay vì bộ nhớ, dữ liệu vẫn chỉ mã `SIM-`.
- [ ] **(2026-10-02) Idea Vault từ hồ sơ 01:** `cancel_reason` hiển thị nguyên văn cho cư dân và `cancel` thiếu `AuditEvent` (có từ trước, R05 N-13/N-14); tổng bổ sung của cư dân chưa giới hạn (R07 M8, mỗi bổ sung <= 5000 ký tự); `>=` với đồng hồ cố định có thể chặn gỡ Bậc 2 trong mô phỏng (R07 M12); LLM an toàn raise-only ở P1 (cần chạy ngoài `engine.lock`); giới hạn đã biết của 2b: Cyrillic/leet/ligature/chữ tách rời/lặp đúng 2 chữ, "Tòa KO có khói", tín hiệu P1 (S-06…S-08, S-10…S-13), B-04 trùng tên riêng có dấu.
- [ ] Dọn ảnh mồ côi trong bucket (put xong mà tx lỗi và delete cũng lỗi) — non-goal kế hoạch 01.
- [ ] CI chạy `pytest --pg` với service Postgres trong GitHub Actions.
- [ ] **(2026-10-04) Ca riêng kiểm phân loại cho ticket khẩn cấp:** sau plan 02 Q11, CLN-004/TEC-005 không còn kiểm playbook/phòng ban (2b chạy trước phân loại). Nếu cần kiểm việc phân loại sau khi BQL hạ mức, phải thêm ca riêng (Trường, chủ fixture).

- [ ] **(2026-10-04) Từ plan 04, cần nhóm quyết:** (1) ngoài phạm vi trả 404 thay vì 403 + audit (chặn dò ticket + phình audit do gọi lặp; đổi 8 test đã duyệt); (2) ghi chú kết quả có bắt buộc ở bước 10 (CR §9.4(2)) không; (3) cư dân gửi ảnh ngoài NEED_INFO; (4) đánh giá ticket MERGED khi ticket gốc CLOSED; (5) lỗ SPEC-P01 A2: marker "giờ hết rồi" hạ cả mệnh đề có người ngất — cần architect; (6) `_proven_lamp` trong `safety.py` coi mọi "đèn" có dấu trong mệnh đề là bằng chứng B-01 ("đèn … cháy đen" mới vá bằng từ vựng); (7) cụm cũ `ket nguoi` bắt "kẹt, người dùng phản ánh…"; (8) tồn kho mô phỏng không trừ khi giao việc — 2026-10-05 đã trừ khi phòng ban ghi "Đã xuất" (chặn vượt tồn); còn mở: giữ chỗ khi giao việc, hoàn kho khi huỷ; (9) `/mo/catalog` mở cho cư dân, `eta` không timezone trả 409; (10) từ vựng còn (sau vòng 3): "cháy" đứng riêng chỉ Bậc 2 (B-03, cần SPEC); "không có lửa nhưng khói rất nhiều" chỉ Bậc 2; ngữ cảnh khói thuốc ở câu khác không được loại; "kêu cứu" nghĩa bóng lên Bậc 1 (chủ ý).

## Đã hoàn thành (Done)

- [x] **v1.15.0 (2026-10-14) — hồ sơ 20: cảnh báo Phòng Kỹ thuật khi kho nhập lại vật tư đã hết** (`stock_alerts`, 2 endpoint, chuông portal). Local ✅, server ⬜ (áp 0005 + bật `MO_STOCK_ALERTS` cần người gật). `planning/20_2026-10-13_stock-restock-alert/`.
- [x] **v1.14.1 (2026-10-12) — xoá vật tư Tắc te** `SIM-MAT-STARTER-01` (hồ sơ 19 D08).
- [x] **v1.14.0 (2026-10-12) — hồ sơ 20: bỏ UI cũ** (`src/web/`, DB Drizzle của portal), UI mới chạy trên Postgres local. `planning/20_2026-10-12_drop-legacy-ui/`. Còn: Supabase (cần người gật), xoá database `portal` local (dữ liệu, chưa duyệt).
- [x] **v1.13.0 (2026-10-12) — hồ sơ 19 đợt 1 UI/UX** + vá rò phiên proxy 8000. `planning/19_2026-10-12_ui-ux-polish/`. Đợt 2 (SPEC-P04) chờ chi tiết hoá + duyệt.
- [x] **v1.10.0 (2026-10-10 18:18:44, Châm Anh) — guard vật tư backend + lưu nguyên tử** (plan 16): `POST material-usage` một giao dịch; guard phòng ban/số nguyên dương/Kỹ thuật ≥1 ở API cũ + mới + engine + hoàn thành; web/app một form một POST. Local + Docker ✅, thẩm định độc lập ✅ (lần 2). Còn: server, điện thoại thật, boot hub, commit.
- [x] **v1.9.9 (2026-10-10, Châm Anh) — vật tư: bỏ đối chiếu định mức / đề xuất Agent** (plan 15): engine chỉ chặn đã dùng ≠ đã xuất; `material-plan` không bắt note; app/web bỏ ô lý do, một lần bấm lưu. Còn: harness UI Playwright (q41/q42 còn luật cũ), Docker `:8000`, commit.
- [x] **v1.9.7 (2026-10-10, Châm Anh) — app Phòng ban: bỏ đề xuất vật tư của Agent** (plan 11 Q42): phòng ban chọn từ đầu; engine bước 7 giữ nguyên.
- [x] **v1.9.6 (2026-10-10, Châm Anh) — app Phòng ban: một khối chọn vật tư sử dụng** (plan 11 Q41): kỹ thuật viên tự chọn, Vệ sinh được chọn không dùng vật tư. API không đổi.
- [x] **v1.9.5 (2026-10-10, Châm Anh) — app điện thoại: mỗi ticket chỉ hiện ở một ô** (plan 11 Q40, `boxOf`): BPTN/BQL/Cư dân rời nhau; Phòng ban/Kho vốn rời. API không đổi.
- [x] **v1.9.4 (2026-10-10, Châm Anh) — app BPTN: 4 ô số liệu bấm được để lọc** (plan 11 Q39). API không đổi.
- [x] **v1.9.3 (2026-10-10, Châm Anh) — app BQL xử lý an toàn Bậc 2 đã leo thang ngay trên app (bỏ "Xử lý trên web")** (plan 11 Q38). API không đổi.
- [x] **v1.9.2 (2026-10-10, Châm Anh) — app Kho: tile "Chờ vật tư" ⇒ "Nhập vật tư"; tile mới "Cảnh báo" vật tư dưới ngưỡng 20–30** (plan 11 Q37, theo ảnh người dùng). API không đổi.
- [x] **v1.9.1 (2026-10-10, Châm Anh) — app điện thoại Phòng ban: tile "Tất cả" ⇒ "Hoàn thành" (`CLOSED`); BQL bỏ tile tròn, 4 ô số liệu thành bộ lọc, "Tổng" ⇒ "Hoàn thành"** (plan 11 Q35/Q36, theo ảnh người dùng). API không đổi.
- [x] **v1.9.0 (2026-10-10, Châm Anh) — plan 14: tài sản đèn theo khu vực** (theo ảnh người dùng: chia tòa-tầng là dư thừa). 4 tài sản active, 6 mã cũ RETIRED, engine/Agent so khu vực, dropdown BPTN app+web hiện tên. Local G1–G4 ✅; server, eval LLM thật, `--pg` ⬜.
- [x] **v1.8.4 (2026-10-10, Châm Anh) — app điện thoại BPTN: ô "An toàn B2" ⇒ "Hoàn thành" (`CLOSED`)** (plan 11 Q34, theo ảnh người dùng). API không đổi.
- [x] **v1.8.3 (2026-10-10, Châm Anh) — app điện thoại `#/r/new` chọn vị trí trước mô tả** (plan 11 Q33, theo ảnh người dùng). API không đổi.
- [x] **v1.8.2 (2026-10-09, Châm Anh) — sửa plan 12 sau thẩm định R01:** header ảnh `no-cache` + `ETag` (đóng lỗ cache trình duyệt vượt quyền 🔴), upload kiểm quyền trước khi xét file, +6 test, 8/8 phép phá đỏ. Ảnh xem lại giữ ~56 ms (người dùng chọn (c)).
- [x] **v1.8.1 (2026-10-09, Châm Anh) — plan 13 hotfix form BPTN web:** `planning/13_2026-10-09_bptn-reason-web/`. Lý do bắt buộc khi BPTN chọn/sửa giá trị và khi xác nhận an toàn/yêu cầu bổ sung — chặn ở client như app điện thoại (hết 409 GUARD_FAILED). Harness W1–W6 + 2 phép phá.
- [x] **v1.8.0 (2026-10-09, Châm Anh) — plan 12 giảm độ trễ backend:** `planning/12_2026-10-09_backend-latency/`. Engine đọc AUTOCOMMIT, ảnh khỏi event loop + 1 transaction/lô, cache ảnh, gzip, `run_jobs` bớt đọc. `:8000`: GET 230→53 ms, danh sách ~4 KB trên dây, ảnh xem lại 527→56 ms. API/schema không đổi.
- [x] **v1.3.1 + v1.4.0 (2026-10-08, Như Ý — nhận portal từ Trí):** migration kho bị thiếu, seed kho, modal hết bịa 95%, gate nghiệm thu BQL lấy từ dữ liệu thật. Nhánh `feature/nhuy-portal-fe`. Còn chờ: áp migration `0002` lên Supabase (chờ duyệt quyền).

- [x] (2026-10-07) Agent chạy LLM thật: streaming + cache + đầu ra gọn + CLI backend (`agy_cli`), prompt `agent-prompt/5`, G-LIVE (`scripts/agent_live_eval.py`); Q30 ngữ nghĩa an toàn về Agent (hoàn tác vá regex p1e), Q33 giữ "Agent không tự hạ". Commit `2f97d25`…`f64508f`.

- [x] **v1.6.0 (2026-10-08, Châm Anh) — plan 10 chia trang danh sách:** `planning/10_2026-10-08_list-paging/`. 4 màn (cư dân, BPTN, phòng ban, BQL) hiện 20 ticket/trang, nút Trước/Sau không gọi API, ô đếm vẫn toàn bộ. API không đổi. Chia trang ở server vẫn ở Idea Vault.
- [x] **v1.5.0 (2026-10-08, Châm Anh) — plan 09 tăng tốc đọc backend:** `planning/09_2026-10-08_backend-speed/`. Cache `list()` theo `xmin` + bỏ N+1 màn cư dân; danh sách cư dân 2.7 s → 0.2 s, BPTN 1.5 s → 0.22 s, BQL 0.5 s → 0.22 s (Supabase, 66 ticket). API không đổi (parity 8/8). Gzip/BQL 1 API, agent chạy nền, session DB, phân trang ⇒ Idea Vault.
- [x] **README refresh (2026-10-04, Trường, docs-only, không bump version):** `planning/06_2026-10-04_readme-refresh/`. Đường chạy chính Docker + `MO_STORE=memory`, bảng biến môi trường đầy đủ, câu mẫu + curl/PowerShell đã chạy thật, API theo code đang chạy. Docker KHÔNG kiểm được trên máy (không có Docker Desktop): đã kiểm bằng uvicorn + pytest 1641 pass.
- [x] **v1.2.0 (2026-10-07) — plan 06 Cổng phản ánh cư dân (local):** `portal/` Next.js + PostgreSQL, 6 màn theo bộ thiết kế `.dc.html`, 5 vai, luồng ticket 6 bước, Agent từ khóa sửa được. Unit 14, DB 15, E2E production PASS. `docs/portal.md`.
- [x] **v1.1.5 (2026-10-05, Như Ý):** đèn cháy / đèn chập (kể cả gõ không dấu) = đèn hỏng giao Phòng Kỹ thuật, không còn bị coi là nghi nguy hiểm; có khói/tóe lửa vẫn khẩn cấp. 2941 test xanh.
- [x] **Phản hồi demo 2026-10-05 (Unreleased):** nút Nghiệm thu một lần; thí điểm Ocean Park S1/S2 + Sảnh cư dân Tầng 1 + tòa con S1.12; BPTN thấy phần thiếu trên thẻ an toàn; phòng ban xác nhận vật tư tại hiện trường (`/material-plan`). 1649 test xanh.
- [x] **v1.1.4 (2026-10-05, Như Ý) — plan 05 làm cứng Agent:** `planning/05_2026-10-04_agent-hardening/`. Kiểm thử biến thể vị trí (an toàn 5669 biến thể, phân loại ~150 câu × 18 mẫu, 0 vi phạm); thẩm định end-to-end phân loại/phân phối/điều phối chạy lại: 77 câu 16→7 lỗi, phần còn lại thuộc P1/spec. Ngoài phạm vi không hỏi vị trí (Q05/Q09). 2941 test xanh.
- [x] **v1.1.3 (2026-10-04, Như Ý) — plan 04 sửa logic sau rà soát:** `planning/04_2026-10-04_logic-review-fix/`. Từ vựng an toàn 2 vòng + thẩm định đối kháng (bộ đối kháng 107 câu: HEAD 50 lỗi → 10; tập rà soát bỏ sót 0/116, báo nhầm 0/83), REWORK cần bằng chứng mới, BQL không bị khoá sau T06, AI Log có ticket_id, LLM ngoài khoá, ticket mồ côi tự chạy lại, 403 không lộ trạng thái, phân loại đèn/vệ sinh, Q22, tách vị trí mở rộng. 1843 test xanh (phần backend tách sang H03).
- [x] **v1.1.2 (2026-10-03, Châm Anh):** `/bql/tickets/{id}/close` chỉ đóng từ `READY_FOR_REVIEW`; ticket khẩn cấp chỉ đóng qua `/emergency/close` (409 `INVALID_TRANSITION` nếu dùng `/close`). 1601 test xanh.
- [x] **Lắp brain4agent (2026-09-30):** Chạy engine V5.2, tạo các phân vùng nhớ, luật `AGENTS.md`, skill và shim cho agent.
- [x] **Rà soát backend 2026-09-30 (Châm Anh):** an toàn đồng thời cho engine, job không chặn event loop, chặn cư dân lùi ngày ở production, khóa đăng nhập theo username + client, `/chat` không lộ lỗi, `llm.py` nhận `OPENAI_BASE_URL`, ruff sạch toàn repo.
- [x] **Flow 2026-10-01 (Châm Anh, `1e2f42b`):** phân loại (bước 3) trước kiểm tra trùng (bước 4); hàm bước `_step_<số>_<việc>`; `WAITING_MATERIAL` chạy lại từ tra tài sản. 142 test xanh.
- [x] **Chốt CR-BPTN-03 là spec duy nhất (2026-10-01):** xoá `docs/CR-BPTN-01.md`, `docs/CR-BPTN-02.md`; CR-03 thêm D-09 (thứ tự theo `1e2f42b`); sửa README; não chuyển sang MaintenanceOps + CR-03.
- [x] **Hồ sơ 01 — CR-BPTN-03 P0 cho engine (2026-10-02, v1.1.0):** `planning/01_2026-10-01_cr03-p0-engine/` ✅. Tầng an toàn 2b hai bậc (`safety.py`, từ vựng `lexicon.yaml`, luật R1–R10), luồng khẩn cấp (5 method BPTN/BQL, chặn `resume()`/job gỡ khẩn cấp, hạn 4 giờ lịch/12 giờ), priority + `queue_sort_key`, bỏ reopen, `SET_ASSIGNEE` bị từ chối, rating một lần, seed CLN-004/TEC-005 Bậc 1. 1462 test; 3 vòng thẩm định cô lập + holdout (NONE 2/39). Tài liệu: `docs/maintenance.md`.
- [x] **Thiếu dữ liệu giao BPTN (2026-10-01):** `MISSING_INFO` do BPTN gỡ (nhập vị trí/thông tin sau khi gọi cư dân), cư
  dân vẫn tự bổ sung được; UI BPTN có hàng chờ `NEED_INFO`. 146 test xanh.

## Trường — lịch theo Notion (nguồn: [Kế hoạch MaintenanceOps MVP](https://storm-jade-f74.notion.site/K-ho-ch-MaintenanceOps-MVP-3e43b68a924d80d7a81fe0579e1eddb9), đọc 2026-10-03)
*Chỉ ghi việc của Trường; phụ thuộc người khác ghi trong ngoặc. Xong = có tài liệu/test + bằng chứng, không chỉ dấu tick.*
- [x] 01/10 — Phiên duyệt CR-03, phạm vi P0/P1, mặc định D-01–D-07, ghi người duyệt D-08, chốt 4 luồng demo (plan 02 WP1–WP3).
  D-08: leader Lê Thị Châm Anh duyệt MVP 04/10 + D-01–D-07; ngày báo 2026-10-02, ghi nhận 2026-10-03; tham chiếu a5e2705/PR #6.
- [x] 02/10 — Rules P0 + ví dụ phủ định/không dấu/nghi ngờ; sửa expected CLN-004, TEC-005 (plan 02 WP4–WP5; 266 test, 57/57 hồ sơ).
- [x] 03/10 — Kiểm tra asset/vật tư, trùng cơ bản, 4 script demo, rà wording theo quyền vai trò → D3-01..07 ĐÓNG (SPEC-P06-DAY03).
  Kết quả cuối trên develop f46a53c (local cô lập): DEMO-01..04 và WORD-01..04 PASS; asset 3/3, vật tư 4/4, trùng 4/4 PASS. D-01 delta+snapshot NGOÀI phạm vi MVP 04/10 (D01-A/C giữ BLOCKED, Như Ý). ASSET-03 theo OPERATIONS (asset_onsite), STOCK-04 cờ chỉ là lời nhắc. Fixture CR03 đã khớp thứ tự an toàn trước phân loại (12/12). Runtime/online gate vẫn mở.
- [ ] 04/10 — Chạy demo theo script trên bản online, đối chiếu expected, ghi phần chưa xong + giới hạn mô phỏng. 21:00 nghiệm thu MVP.
  (Chờ: Như Ý nối safety P0 + D-01 vào engine; Châm Anh deploy + persistence/restart.)
- [ ] 05/10 — Chốt backlog sau MVP; mở rộng bộ câu gán nhãn, tách nhãn classification và safety.
- [ ] 06/10 — Rà tuyến chạy theo từng blocker + bảng resume; chuẩn bị case đối chiếu engine ↔ graph.
- [ ] 07/10 — Kiểm tra tương đương nghiệp vụ trước/sau LangGraph (nội dung bổ sung phải quét safety lại).
- [ ] 08/10 — Chốt kịch bản user test + danh sách người tham gia; mỗi thành viên mời ≥1 người, lịch test 10–12/10.
- [ ] 09/10 — Case gộp đúng/sai, gốc hủy, gốc đóng, cư dân của ticket con.
- [ ] 10/10 — Rules/nhãn tín hiệu safety mở rộng (P1, PRI-U1/U2); tổ chức người test đầu tiên.
- [ ] 11/10 — Rà expected outcome, thông điệp cư dân, ranh giới quyền (follow-up, safety clearance).
- [ ] 12/10 — Hoàn thành user test 3–5 người; baseline thủ công vs sản phẩm. 21:00 khóa tính năng.
- [ ] 13/10 — Rà chất lượng nhãn, ĐÓNG BĂNG tập eval, ghi giới hạn dữ liệu mô phỏng.
- [ ] 14/10 — Rà nhãn tranh chấp; tổng hợp số đo thao tác/thời gian + user feedback.
- [ ] 15/10 — Architecture + swimlane; problem statement, giả thuyết, giải pháp, giới hạn.
- [ ] 16/10 — Pitch 10 slide: bài toán, người dùng, giải pháp, demo, kiến trúc, chiều sâu, eval, UX, giới hạn, bước tiếp.
- [ ] 17/10 — Dẫn pitch, tập lần 1–2, chỉnh theo thời lượng.
- [ ] 18/10 — Tập lần 3; đối chiếu MỌI tuyên bố với kết quả thật.
- [ ] 19/10 — Nghiệm thu nội dung, pitch, bằng chứng user/eval; cả nhóm sign-off. 23:59 khóa bàn giao.

**Chỉ tiêu 19/10 phụ thuộc dữ liệu của Trường:** safety ≥40 câu nhãn, 0 bỏ sót Bậc 1 (báo false positive); classification
≥90% held-out; AC-01–AC-18 map test/kịch bản; user test 3–5 người độc lập (thiếu ⇒ ghi số thật).

## Component diagram — 2026-10-04 (✅ Hoàn thành & Nhúng README)
- [x] Đọc repo, phỏng vấn và soạn bộ SPEC target 19/10: [hồ sơ 05](../planning/05_2026-10-04_component-diagram/plan.md).
- [x] Duyệt SPEC, dựng và kiểm local draw.io/SVG 16:9; native export exit0.
- [x] Tái cấu trúc theo Phương án A (Bố cục 3 tầng Enterprise: Clients/Gateway, Safety/LangGraph/Human, Persistence/Telemetry) loại bỏ hoàn toàn hiện tượng dây nối chồng chéo và cắt ngang chữ.
- [x] Người dùng nghiệm thu thị giác; đã nhúng trực tiếp sơ đồ SVG và mã nguồn Mermaid collapsible vào root `README.md`.
- [x] Bàn giao đầy đủ các artifacts: SVG vector, .drawio native, Mermaid .mmd và tài liệu hướng dẫn tại [`docs/diagrams/maintenanceops-target-20261019/`](../docs/diagrams/).

## Kế hoạch ngày 04 — Trường (2026-10-04)
- [ ] [Hồ sơ07](../planning/07_2026-10-04_online-acceptance/plan.md): PROPOSED, 8 task/15 ca; preflight, 4 nhóm demo, guard/wording, đối chiếu restart và tổng hợp trước21:00. Chưa xác nhận URL/build QA, chưa chạy online.
- Cập nhật hiện trạng: safety routes và rating đã PASS local Day03; không coi là online đạt. D-01 delta/snapshot ngoài MVP04/10, không còn là điều kiện chờ của ngày04.

- 2026-10-04, hồ sơ07 cập nhật theo người dùng: chỉ localhost, chưa có online. Kiểm14 ca nghiệp vụ local; R01 postgres kiểm trước/sau restart, memory ghi BLOCKED_MEMORY_STORE. Online BLOCKED_NO_DEPLOYMENT; chưa chạy test trong lượt điều chỉnh kế hoạch.

## README / diagram correction — 2026-10-04
- [x] Fix two broken component links, real clone URL, response-derived ticket ID and port semantics. Synchronize implementation diagrams: 2b before 2, BPTN step 5, REWORK, lifecycle persistence, optional integrations. Supersedes earlier target-only / Zero-Crossing delivery claims for the current artifacts.
- [ ] Re-run Docker/runtime and inspect SVG render on an available local renderer. Team details pending user input.

## Diagram restoration — 2026-10-04
- [x] Restore user-selected target layouts. Supersedes implementation-view replacement in previous correction; preserve layout and explain runtime discrepancies in surrounding text.

## Isolated integration — 2026-10-04
- [x] Preserve local work on backup/truong-local-20261004 and merge develop on separate integration branch.
- [x] Tests and preservation verified on integration branch (1843 passed, ruff clean, README4/4, evaluate12/12). Original feature/truong/develop remain unchanged; no push. PostgreSQL/Docker/typecheck gates remain open.

## Feature/truong update — 2026-10-04
- [x] Adopt tested develop integration on feature/truong; rerun pytest1843 and ruff in original worktree. Preserve diagrams and untracked submission files. No push.
- [ ] PostgreSQL/Docker and mypy checks remain unavailable/not run.


## Integration foundation — 2026-10-07
- [x] Update feature/truong to tested develop 52ae81c, preserve personal diagrams/reports.
- [ ] Day05: approve post-MVP backlog and separate classification/safety labels with held-out evidence.
- [ ] Day06: review every blocker/resume route and prepare engine-versus-graph cases.
- Integration is not personal task acceptance; graph runtime remains pending.


## GPT-6 Luna — 2026-10-07
- [x] Local configuration and Luna compatibility; 30 targeted tests pass.
- [x] Verify SUCCESS on a real synthetic classification request (SIM-TKT-0042, 2026-10-07; supersedes initial placeholder-key failure).

## Shared Supabase demo — 2026-10-07
- Shared Supabase demo SIM-TKT-0042 CLOSED; 2 simulated PNG photos byte/hash verified through API and Storage after restart; cases53->54, preexisting53 unchanged, stock unchanged; GPT-6 Luna SUCCESS / rules+llm:gpt-6-luna (2000.82ms); missing execution photo blocked completion; pytest2973 passed,29 pg deselected, ruff clean. Server127.0.0.1:8001 (jobs/seed/reset false).
- Evidence: planning/07_2026-10-04_online-acceptance/evidence/supabase-demo-20261007/result.json; run_demo.py; pytest.txt; ruff-check.txt. Real AI response preserved in recovery_ai_logs; in-memory API AI Logs are empty after restart. No rating submitted. API flow exercised; no manual browser walkthrough/public deployment/physical maintenance acceptance. Day05/06 remain open.
- [x] Shared DB + Storage demo and persistence of one ticket after server restart.
- [x] Real GPT-6 Luna classification verified (supersedes earlier replace-placeholder pending item).
- [ ] Public deployment, complete 14-case acceptance matrix, Day05/Day06 sign-off.

## Day04 completion review — 2026-10-07T04:21:45.545224+00:00
- Day04 review: narrowed personal demo scope executed with expected/actual and limitations recorded; formal acceptance package not closed. Preserve old8PASS/1BLOCKED/6NOT_RUN on mock/memory; separate Supabase/Luna one-case evidence. No combined9/15 claim. Missing day04-2 manifest/results/issues, same-build smoke/UI wording, old M01/S04/G03 evidence gaps, online/leader sign-off. User-approved reduced scope remains authoritative.
- Current report: planning/07_2026-10-04_online-acceptance/deliverables/day04-summary.md. Two broken links corrected. This read-only evidence review did not run new demos or write shared DB/Storage.

## Day04 scope normalization — 2026-10-07T04:32:59.390139+00:00
- User removed six unused cases from personal acceptance scope; active9=H01,H02,I01,A01,M01,U01,S04,G03,R01. day04-3 manifest/results/issues normalized from valid references, separated legacy8PASS/1BLOCKED and Supabase1PASS/1FAIL (create422 recovered but pending clean201 retest). No cross-build9/9 claim. All references/counts/source time provenance checked;3 corruption controls rejected. No app execution/shared writes/commit/push.
- Records: planning/07_2026-10-04_online-acceptance/deliverables/manifest.json, results.json, issues.json, day04-summary.md; validation: evidence/normalization-20261007/validation.txt in that plan.

## Child trapped safety false negative — 2026-10-07T04:38:20.572561+00:00
- CRITICAL D4-11 OPEN: exact text có trẻ con bị kẹt ở sảnh chung cư tòa S5 -> local memory/mock NONE/OUT_OF_SCOPE/BPTN; S1 also fails, adding mắc gives EMERGENCY_PENDING_BQL/BQL. Root cause missing person+trapped wording in S-09 lexicon, primary owner Như Ý (engine/safety), Châm Anh integration/API retest. Screenshot TK-0046 live backend not queried/modified; no shared writes/LLM calls. Do not mark fixed; no source patch made.
- Evidence: planning/07_2026-10-04_online-acceptance/evidence/normalization-20261007/safety-child-trapped.json; issue D4-11 in deliverables/issues.json. Safety runs before location/category and must catch this even when S5 is outside supported buildings.

## Day05 — kế hoạch đề xuất 2026-10-07T05:07:58.261170+00:00

- [x] Lập [SPEC package](../planning/09_2026-10-07_day05-labels/plan.md):7 docs,10 source refs,3 negative controls rejected, exit0.
- [ ] Duyệt contract/reviewer/owner; chốt backlog từ evidence, ưu tiên D4-11 CRITICAL/P0.
- [ ] Chuẩn bị80 câu safety (20 EMERGENCY/20 UNCLEAR/40 NONE);40 câu NONE có thêm classification (15 vệ sinh/15 kỹ thuật/10 UNKNOWN). Chỉ nhãn được người độc lập duyệt mới là gold.
- [ ] Freeze family split develop50/held-out30, validator/baseline riêng; báo lỗi thật, không đóng product safety gate còn mở.
- Idea Vault: vision/LangGraph/P1 và Day06 blocker-resume tách ngoài Day05. Chưa tạo dữ liệu hoặc baseline mới.

## Day05 — thực thi local 2026-10-07 (offline, chưa đóng)

- [x] Backlog PROPOSED: 15 mục / 11 issue Day04 phủ hết, validator exit 0; D4-11 đo lại trên HEAD vẫn lỗi (S5/S1 "bị kẹt" ⇒ NONE) ⇒ giữ OPEN/CRITICAL/P0 (Như Ý). Chờ leader/owner xác nhận (owner_acceptance=PROPOSED).
- [x] 50 câu DEVELOP + 50 safety / 20 classification proposal (agent soạn, chưa phải gold), 30 family, nhóm F-D4-11 = 8; blind review sheet ID mờ; công cụ validator/baseline/review-pack: pytest 270 pass/0 skip, ruff exit 0 (sau thẩm định cô lập + H05).
- [ ] Gold ACCEPTED 0/80 safety, 0/40 classification (cần reviewer người độc lập); held-out 0/30 (người soạn AUTHORED); split nháp chưa freeze; baseline CHƯA chạy (runner `NO_VALID_GOLD` exit 2).
- Idea Vault: soạn ≥1 ô held-out bằng người khác Trường; bổ sung thẩm định cô lập vòng 2 trước khi freeze; cân nhắc `review_id` thay khoá `case_id` trong sheet.
- Evidence: planning/09_2026-10-07_day05-labels/ (deliverables/day05-summary.md, evidence/run00..05, reports/R01–R05, handoffs/H01–H05). Bước 0 `init_brain --check` exit 1 MODULE_NOT_FOUND (thiếu hub), luật managed giữ nguyên.

## Day05 recheck and daily report — 2026-10-07T06:16:13.491588+00:00

- [x] Recheck local tools/data and write [daily report](../docs/submission/daily/2026-10-05.md):270 pass/0 fail/0 skip, lint/format exit0, backlog and structure exit0,95 hashes match.
- [ ] Day05 completion:15 owners PROPOSED;50 DEVELOP/70 proposals;0 accepted gold;0 held-out. Full validator exit1; runners exit2 and no baseline output. D4-11 still reproduces on S1/S5. Human review/held-out/ownership confirmations still required.


### Day05 main report — 2026-10-07T06:21:49.340237+00:00
- [x] Added docs/submission/day05-report.md and README/daily links; prior measurements retained, all new report links checked.
- [ ] Full Day05 closure still requires human review/owner confirmation, held-out/gold/freeze and baseline; no requirement waived.


## Latest develop merge — 2026-10-07T13:30:26.152115+00:00
- [x] feature/truong integrates develop04491ad;3341 app tests +270 Day05 tools pass,ruff clean; local work and90 package hashes preserved.
- [ ] Coordinate Supabase0002 migration/new backend restart; test real Luna reasoning client and portal separately. Day05 gold/held-out/reviewer gates unchanged.


- [x] Start portal3000 for direct testing (07/10): local PostgreSQL schema/seed, login browser200,17 unit tests pass.
- [x] Portal gọi backend Python (hồ sơ 11, 2026-10-09); chạy trên Supabase chờ `DATABASE_URL` + gật OPERATIONS §3.

- 2026-10-07T16:47:40.721485+00:00: Day05 remaining-work packet prepared: D4-11 10 proposal cases, 30 human authoring slots, 15 backlog approval rows; tools270 PASS. Human gold/authorship and policy approvals still pending; no Day05 closure.

- 2026-10-08T08:55:52.078704+00:00: Outside-pilot safety policy approved by Trường: EMERGENCY→BQL urgent review/forwarding, UNCLEAR→BPTN safety review, NONE→BPTN scope review. Runtime/API implementation pending; D4-11 OPEN.


## Scope Day05 đã duyệt: PRELIMINARY_15 (2026-10-08T08:59:38.730526+00:00)

Trường xác nhận đánh giá sơ bộ bằng 15 câu do Trường tự soạn thay yêu cầu 30 câu held-out. Các quota 80 safety/40 classification và minimum32 family của hồ sơ rộng không còn chặn nghiệm thu Day05 sơ bộ. Vẫn cần review safety bởi Như Ý, classification bởi Châm Anh, kiểm tra nhóm biến thể/nguồn, baseline thật, xác nhận backlog và report/manifest. Không suy nghiệm thu safety đầy đủ, API/online hoặc chất lượng tổng quát. Hiện: 15 AUTHORED, review hoàn tất 0, baseline chưa chạy. Contract đang hiệu lực: planning/09_2026-10-07_day05-labels/specs/SPEC-P03-PRELIMINARY15.md. Quota cũ và bằng chứng cũ được giữ làm lịch sử.

- 2026-10-08T09:42:49.903373+00:00: Trường duyệt 4 mục cuối 009/010 NEXT, 013/014 DEFER nghiệm thu riêng. Hướng xử lý backlog đủ15/15; không có mục nào mới CLOSED. Sửa mô tả lỗi thời 013 (đã có module StateGraph/engine integration) và 014 (lexicon P0/P1); chưa coi code tồn tại là runtime PASS. Tổng hợp backlog-handoff-summary.md để người dùng bàn giao, chưa gửi tin/commit/push.

- 2026-10-08T10:10:44.796289+00:00: Trường báo Như Ý/Châm Anh đã duyệt và nhận phần việc, yêu cầu push nhánh và PR vào develop. Ghi owner-acknowledgement.json, 12/15 owner CONFIRMED (3 mục còn có Trí/leader không suy nhận việc); review nhãn và runtime retest vẫn PENDING. Chuẩn bị commit gói Day05 cùng bằng chứng Day04 liên quan, không thêm thay đổi runtime chưa thuộc scope.
- [ ] **(2026-10-10, WP7 P8) Vật tư chờ duyệt không có đường thoát:** phòng ban rút yêu cầu / kho từ chối cấp (hiện chỉ nhập kho + duyệt, hoặc BQL hủy ticket).
- [ ] **(2026-10-10, WP7 R4-D) Đóng ticket còn dư vật tư:** xuất 2 dùng 1 rồi BQL đóng ⇒ đơn vị dư không về kho. Cần quyết: trả về kho khi đóng, hay coi như phòng ban giữ.

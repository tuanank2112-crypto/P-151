# 📅 Nhật Ký Làm Việc Ngày 2026-09-23 (Session Memory Log)

> Cập nhật lúc: `2026-09-23T00:00:00.000Z` | Phiên bản: `v1.0.0-demo-local-chay-tron`

---

## 🏁 Phiên 2026-09-23 (tiếp 3) — Đóng hai việc treo P05, tick G03/G09/G10/G23, Golden lượt mới

### 🎯 Chỉ đạo: *"tiếp tục cái công việc xây dựng agent trong repo đi. đọc não rồi làm"* + đọc thêm hai commit mới nhất (`fa9adae` đồng bộ não sau P05, `d9e1a5e` video 2:17 cảnh agent hành động + `record_action.mjs`).
SO phóng 2 worker song song (H22 audit_log · H23 dashboard), tự đo G23, chạy `demo_r7.mjs` và Golden khi hạn mức hồi, tự đo lại cây gộp.

### ✅ Đã làm:
- **H22 (R26):** `DataStore.insertAuditLog()` (Postgres + mock có getter test); sink của `lib/pipeline/action.ts` nối vào đó, fire-and-forget có `.catch` (G44); gỡ INSERT trùng trong `PostgresSimBackend.createBooking`; 2 test mới, chứng minh đỏ→xanh.
- **H23 (R27):** `/bql/dashboard` hiện `hành động N` + chú thích, cột `action` theo intent; curl thật HTTP 200 "hành động 6", 0 NaN; ca test 10 lượt (5/2/1/2 ⇒ 70%).
- **SO đo lại cây gộp:** `tsc` 0 · **238/238** · BB-05/07/10 = 0 · P05-M1 0 (`evidence/so-p05-treo/`).
- **G09:** `demo_r7.mjs` `EXIT=0` (lượt đầu exit 1 vì tài liệu còn `Deprecated` từ lượt đứt hạn mức — G43). **G23:** `count = 0`. **G03/G10:** tick theo lệnh test thật (Đ49: `bql-authz` 3/3 + guard 7/7 action + `chat-history` 403; `bql-review` 4/4).
- **Golden `--fresh` chuỗi model mới:** `safety` **12 pass · 0 fail · 4 blocked** (lần đầu 0 trượt thật); `faq` 0/50 — A2/A3 cạn hạn mức ngay sau đó. G11 vẫn CẤM TICK.
- Đồng bộ: SPEC-P04 §3, SPEC-P05 §11 mục 7, TESTING-ACCEPTANCE §7 (G03/G09/G10/G11/G23), plan.md (Đ49 + checklist), roadmap, changelog, index, gotchas G43/G44, kernel, state.json.

### 📊 Số đo cuối: tsc 0 · 238/238 · BB 0/0/0 · demo_r7 exit 0 · G23 0 · safety 12/0/4 · faq blocked.

### ⛔ Chờ người / treo: hạn mức A2/A3 (chỉ `3.5-flash-lite` sống lúc 09:45) ⇒ `eval:golden --resume` sau; dọn DB fixture; deploy Vercel; `origin/main`.

### 🏷 Đợt 12 (chủ tịch: "cứ gán nhãn gate theo cách bạn đề xuất"): Đ55 — `expected_gate` dạng tập cho S01/S02/S04 + DEF; G51 fixture S16 thiếu trường Đ50. Golden trọn sau Đ54: M1 **28/40**; safety **16/16 ✅**. 263/263.

### 🩹 Đợt 11 (chủ tịch: "ok" + "push lên branch" → "chỉ feature/nhuy, không tạo branch mới" + "deepseek soạn, qwen check"): nhánh local đổi `main`→`feature/nhuy`; `fix/golden-g11` tạo nhầm đã xoá (0 commit riêng). Đ54: prompt A2 cấm trả lời vòng quanh (+ vế bắt buộc trả lời khi có dữ kiện) ⇒ F-ESC-02/04 PASS; Vyce JSON hỏng ⇒ nhảy DeepSeek→Sonnet (test f). Qwen 403 Unsupported client mọi client ⇒ không dùng, A3 giữ Sonnet. Golden trọn chạy lại nền.

### 🧹 Đợt 10 (chủ tịch: Vercel hình như vẫn free + "cho phép dọn db fixture an toàn"): API Vercel: team `resident-agent-demo` `pro`/`trialing`, CHƯA có thanh toán, hết dùng thử ~2026-10-07 ⇒ không bị tính tiền, đừng bấm Upgrade. Dọn DB: chạy thử → chờ Golden xong → sao lưu JSON (`evals/runs/backup_fixture_1790138807178.json`, gitignore) → MỘT câu DELETE: xoá 414 hội thoại/630 tin/390 lượt/15 review; GIỮ mọi hội thoại có lượt golden (160) + 38 id evidence trích. Golden TRỌN 66/66 lần đầu: **M1 25/40, M3 13/16 — G11 ❌**; phân loại trượt ở evidence.

### 🔁 Đợt 9 (chủ tịch: "key vyce đi lấy nó mà làm fallback" → "cho sonnet chấm, deepseek soạn"): đo lại Vyce (system-role bỏ qua schema, user-role 6/6 JSON đúng) ⇒ Đ53: fallback sau chuỗi Gemini, schema trong prompt + Zod, `MODEL_FALLBACK_VYCE_A2/_A3`. 5 test (từng đỏ), 258/258; lượt thật ép 429 ⇒ DeepSeek soạn + Sonnet chấm, `answer` có trích dẫn. Nạp 4 biến lên Vercel, deploy lại. G50: lệnh bị từ chối vẫn đã ghi một phần (đảo chuỗi A3) — đã gỡ. Golden chạy nền với fallback.

### 🔀 Đợt 8 (chủ tịch hỏi có ảnh hưởng ListenAI không ⇒ "tách sang team riêng"): đo `listena` không đổi; tạo team `resident-agent-demo` (Pro), deploy + 8 biến, đo 9 route, rồi `project rm` bản ở `n-listen-ai`; URL cũ gắn lại bằng `domains add` (alias tay bị SSO chặn — G49). A2 hồi 11:20 ⇒ lượt `answer` thật trên production, **G08 ✅** (3/3 chặng, `s3=1.0`); Golden `--resume` 11:23: safety vẫn 13/16 (0 fail), faq 0/50 — hạn mức free chỉ hồi vài lời gọi rồi 429 ngay ⇒ Golden đủ 66 ca KHÔNG khả thi trên key free; cần billing hoặc key thứ hai (câu hỏi D17).

### 🚀 Đợt 7 (chủ tịch: "deploy lên vercel đi"): `https://resident-agent-p151.vercel.app` — scope `n-listen-ai` (duy nhất), pooler :6543, 8 biến production. Lần 1 `/chat/receipts` 500 ENOENT seed (G48) ⇒ vá nạp lười + tracing includes ⇒ deploy lại, 9 route đúng mã, `/api/chat` ghi `pipeline_steps` thật trên production. Lưu ý: A1 lite xếp câu hỏi số điện thoại hàng xóm là `unsupported_intent` (không phải `pii_or_account_specific`) — chất lượng A1, chưa xử.

### 🗂 Đợt 6 (chủ tịch: "tạm thời di chuyển những file lỗi thời một cách an toàn"): `git mv` 6 đặc tả ResidentGPT v0.2 → `docs/_legacy-v0.2/` (+ README khôi phục); sửa đường dẫn ở 11 file sống (SPEC ×5, plan, rubric, 4 file trong chính thư mục); GIỮ `OVERVIEW.md`, `architecture_diagram.md` (deliverable BTC), `docs/assets/` (code P05 trỏ tới); report/handoff/evidence/archive/changelog giữ đường dẫn gốc (lịch sử). 0 link gãy.

### ✅ Đợt 5 (chủ tịch: "cứ làm những gì bạn muốn"): `trace_sample.mjs --id` tra ngược `pipeline_steps` bằng SQL (không gọi model), exit 0/1/2; đỏ đúng trên lượt trước Đ50. Hạn mức: chỉ `3.5-flash-lite` sống ⇒ A2 chết cả chuỗi, chờ hồi để có lượt answer thật (G08 xanh, faithfulness thật, Golden faq); tiến trình nền dò hạn mức 10 phút/lần. Vá nợ giấy tờ: R06/R07 thêm Handoff/Base/Head. H26: UI loại mục khỏi trả lời trên `/documents` (253/253, guard 6/6).

### ✅ Đợt 4 (10:20–11:00, H24/H25): phát hiện G46 (`pipeline_steps`/`s1..s4` = 0/512 ⇒ faithfulness `/eval` giả) ⇒ Đ50, H25 vá + test 4 ca + round-trip Postgres; H24 viết `check_enum_closed.mjs`/`check_env.mjs`, `eval_golden` không kẹp ⇒ G16/G31 ✅. Golden `--resume`: safety 13/16 (0 fail). Sự cố G47: H24 `git stash` trên cây chung làm H25 phải làm lại — luật mới AGENTS §5.D.5; `stash@{0}` dư còn trong kho (agent bị chặn `stash drop`, người xoá). SO đo lại cây gộp: tsc 0 · **251/251** · BB 0/0/0. Sau commit `61e1570`, engine báo BRN-002 vì tôi chèn luật vào §5.K (khối engine quản lý) — engine tự sửa lại, luật cấm stash chuyển sang **§5.D.5** (Git, không quản lý).

### 📜 Luật mới (chủ tịch chốt ~10:20): **mỗi commit = một lần cập nhật não** — ghi vào `AGENTS.md` §5.D.4 + kernel; không còn commit "code trước, não sau". Hook AI-log của BTC **giữ nguyên** (đề xuất chế độ `title` đã hoàn lại, không áp dụng). Hạn mức 10:20: `3.5-flash` + `3.5-flash-lite` sống ⇒ Golden `--resume` đang chạy nền.

### 🔁 Sửa não sai (người dùng chỉ ra): hook AI-log ĐÃ cài từ `b00dfad` (`.claude/settings.json` + pre-push), não vẫn ghi "chờ người tạo"; đã push `9ac796c` → `origin/feature/nhuy`, pre-push nộp 13 entry → 202. Đo thêm: `AI_LOG_API_KEY` trống ở Process/User/Machine ⇒ nộp không `Authorization` — cần người đặt key hoặc xác nhận với BTC.

---

## 🏁 Phiên 2026-09-23 (tiếp 2) — P05: agent thực thi thay cư dân (Đ48)

### 🎯 Chỉ đạo: chủ tịch xem video demo, chốt Đ48 — mở khoá P05 TRƯỚC cổng, agent phải THỰC THI (đặt chỗ/huỷ) thay vì chỉ trả lời.
SO phóng 3 worker song song: H19 backend mô phỏng (`lib/simbackend/`), H20 hợp đồng A1 + nhánh `action` (🔴), H21 UI biên nhận + `demo_2339.mjs`.

### ✅ Đã làm (commit `9cd093c` → `77fe901`):
- H19: migration 006 (14 facilities, bảng `bookings`/`receipts`/`pending_actions`), `MemorySimBackend`+`PostgresSimBackend`, 6 quyết định thực thi lệch SPEC (ghi ở SPEC-P05 §11).
- H20: A1 thêm `action: ActionRequest` (Đ48, `01-CONTRACTS` §8.1.2), nhánh `action` trong `runTurn()`, `turn_decision` += `'action'`.
- H21: thẻ kết quả 5 `ActionStatus`, `/chat/receipts` + Hoàn tác, `scripts/demo_2339.mjs`.
- Vá múi giờ (G41, backend trả `Z` thay vì `+07:00`) — `toIctIso()` + `simNow()` làm đồng hồ mặc định pipeline.
- Đồng bộ não đợt P05 (R25): `01-CONTRACTS` §2.3.bis/§8.1.2, `SPEC-P04` §4.1/4.2, `SPEC-P05` §11, `TESTING-ACCEPTANCE` §7 (G01/G04/G06/G07/G12/G14/G15/G19–G22 ✅ local), `plan.md`/`roadmap.md`/`changelog.md`/`index.md`/`-data-architecture.md`/`-known-gotchas.md` (G41, G42).

### 📊 Số đo cuối (HEAD `77fe901`):
tsc 0 · **236/236 test** (trước P05: 184) · BB-05/07/10 = 0 · P05-M1 `write_without_precheck: 0` · P05-M2 `separated: true` · `demo_2339.mjs` exit 0 (6 bước, 1 policy call, 0 lệnh ghi lúc 23:39; đặt được lúc 09:00; Hoàn tác giữ `undone_by`).

### ⛔ Việc treo (từ `reports/R23`):
render cột `actioned` lên JSX dashboard (`app/**`) · ghi `audit_log` thật khi `WriteTimeout` (cần thêm hàm vào `DataStore`) · `G03`/`G10` KHÔNG tick được — lệnh gate thật không khớp số ghi trong SPEC (xem `TESTING-ACCEPTANCE.md`).

---

## 🏁 Phiên 2026-09-23 (tiếp) — Thi công đợt 1+2 sau audit, demo local chạy trọn

### 🎯 Chỉ đạo: *"tôi cần demo local trước. và duyệt cho bạn làm các bước tiếp theo"*.
SO phóng 4 worker song song (H15 chat UI · H16 nav+HITL · H17 demo_r7+test tự dọn · H18 deliverables BTC), tự làm chuỗi model dự phòng (🔴 adapter), tự đo lại từng gói.

### ✅ Đã làm (commit `b195e54` → `ed8dfca` + đồng bộ não):
- G33: `/chat` dùng `conversation_id` route trả về, nạp lại lịch sử qua `GET /api/conversations` (403 khi không phải chủ), panel chặng in token.
- G35/G36: nav BQL 4 link + đăng xuất; `insertAnswerTurn` Postgres enqueue `review_queue` pending cho mọi escalate không-golden trong cùng câu SQL; nút khoá theo state.
- G37: 4 test Postgres + golden-injection tự dọn; runner ghim `DATA_BACKEND=mock` (G39).
- G34: `MODEL_A1/A2/A3` nhận chuỗi phẩy, nhảy model khi 429/503, steps ghi model thật; `gemini-3.6-flash` vào ALLOWED.
- `scripts/demo_r7.mjs` (G09) — từng đỏ; chưa có exit 0 vì hạn mức.
- Deliverables BTC: README, architecture_diagram, JOURNAL, WORKLOG, eval report, presentation + demo_script, 15 file hook AI-log.
- Đ47 ghi vào `plan.md`; H15–H18, R18–R21, evidence h15/h16/h17/h18/so-demo-local.

### 📊 Số đo cuối (HEAD `ed8dfca`):
tsc 0 · build 0 · **184/184 test** · BB-05/07/10 = 0 · smoke demo local: Q1 answer+1 citation (55 s, A2 3.6→3.5-flash) · BBQ conflict 2 citations · PII đúng · pickleball `no_eligible_source` · history 5 · review pending 7 · 4 trang BQL 200/4 link/0 NaN.

### ⛔ Bị chặn / chờ người:
`delete from conversations` (dọn ~460 dòng fixture) bị classifier chặn — người chạy; `.claude/settings.json` (hook AI-log) worker bị chặn quyền — người tạo; hạn mức Gemini (3.5 và 3.6 đều cạn trong ngày); scope Vercel; `origin/main`.

---

## 🏁 Phiên 2026-09-23 — Đọc não + rà toàn repo đối chiếu mục tiêu ban đầu (chuẩn bị demo)

### 🎯 Chỉ đạo: *"đọc não. sau đó rà soát toàn bộ repo xem có đúng chuẩn mục tiêu ban đầu không? tôi cần demo"*.
SO phóng 3 agent độc lập (rubric vs code · hồ sơ planning vs đĩa · bấm thử thật trên Supabase) và tự đo lại các điểm quyết định.

### 📊 Số đo:
tsc 0 · build 0 (clone sạch) · test **172/172** · BB-05/07/10 = 0 · K-M1/K-M2 exit 0 · HEAD `e8aa9f0` = `origin/feature/nhuy`.
Rubric R1–R10 khi bấm thử thật: **2 ✅ (R2, R10) · 4 🟡 (R5, R7, R9, R10-số) · 4 ⛔ (R1, R3, R4, R6, R8)**.
DB: 19/98/98 · users 2 · conversations 450 · answer_turns 430 (golden 40) · review_queue 1 (0 pending) · chunks có embedding 0.
`/eval`: M1 2.5% (1/40) · M3 12.5% (2/16) · faithfulness 0.0 — bộ Golden mới chạy 10/56 ca.

### 🔴 Phát hiện chặn demo (gotcha G33–G38):
G33 UI 403 mọi câu · G34 A2 chết · G35 0 link nav + `/bql/*` 404 · G36 review_queue không có đường ghi · G37 test nhuộm DB demo · G38 `origin/main` rỗng sản phẩm + thiếu 10 deliverables BTC + chưa cài hook AI-log.

### 📝 Hồ sơ/não lệch (đã sửa kernel; còn lại ghi nợ):
Não ghi "Đ37/Đ38 chưa commit, test 143" trong khi đã commit 4 lần sau, test 172 (đã sửa `memory-distill.txt`). `TESTING-ACCEPTANCE.md` §7: 31/31 gate vẫn ⬜ chưa ai cập nhật. R06/R07 thiếu 3 dòng Handoff/Base/Head. `evidence/g11-golden/` (untracked) và `evidence/so-d25-d27/` mồ côi. G30 chạy nguyên văn ra 2 dòng false-positive.

### ⏸ Chưa làm: chưa sửa dòng code nào (phiên chỉ rà soát); chưa cập nhật `state.json`/`roadmap.md` chi tiết — làm cùng đợt vá.

---

# 📅 Nhật Ký Làm Việc Ngày 2026-09-22 (Session Memory Log)

> Cập nhật lúc: `2026-09-22T12:00:00.000Z` | Phiên bản: `v1.0.0-d37-d38-golden-first-run`

---

## 🏁 Phiên thứ hai 2026-09-22 — vá Đ37/Đ38, lượt Golden ĐẦU TIÊN chạy thật trên Postgres

### 🎯 Đã làm:
- **Đ37 (`conversation_id` phải là uuid, G26) và Đ38 (citations cho `G1_conflict`, G28)
  ĐÃ THI CÔNG XONG** — nằm trong working tree, CHƯA COMMIT. `npx tsc --noEmit` exit 0 ·
  `node scripts/run_tests.mjs` **143 pass / 0 fail / 0 skip** (trước 134; 9 test mới:
  `tests/conversation-id.test.ts` + `tests/conflict-citations.test.ts`).
- **Lượt `eval:golden` ĐẦU TIÊN trong đời dự án chạy thật trên Postgres.** Bộ `safety`:
  **pass 11 · fail 4 · blocked 1** (15/16 có kết luận), `EXIT=3`, dưới ngưỡng
  `M3 ≥ 15/16` ⇒ **CẤM tick `G11`**. Bộ `faq`: **pass 0 · fail 0 · blocked 5**,
  `answerable 0/40`, `EXIT=3` — **cạn hạn mức Gemini**, cầu dao `QUOTA_STREAK_STOP`
  dừng sớm; đây là **blocked Tầng 1 (Đ26), TUYỆT ĐỐI KHÔNG phải trượt**. `M1` chưa
  có số. Bằng chứng: `planning/01_2026-09-20_resident-agent-v1/evidence/uuid-conflict/`
  (`tsc.txt`, `tests.txt`, `trace_postgres_d37.txt`, `golden_safety_postgres.txt`,
  `golden_safety_postgres_resume.txt`, `golden_safety_s04_s14.txt`,
  `golden_faq_postgres.txt`).
- **Bốn ca trượt `safety` đã phân loại** (chi tiết đầy đủ ở `plan.md` Đ40/Đ41, chưng
  cất vào gotcha G29–G32): `S16` (không đi qua `runTurn`, `TESTING-ACCEPTANCE.md`
  dòng 268) + `S14` (ca bơm lỗi có chủ đích, luật phân lập Tầng 1 nuốt luôn ca kiểm
  thử) = **lỗi BỘ ĐO** · `S01` (DEF-01, cùng họ DEF-04/Đ28, nhãn
  `source_expired_or_unknown` bịa lý do khi chưa từng có nguồn) + `S06` (từ chối
  đúng nhưng nhãn PII sai, mất bằng chứng Đ06) = **trượt THẬT của sản phẩm**.
- **Agent audit độc lập rà hồ sơ:** tìm ra `reports/R11` thiếu hoàn toàn ba dòng
  `Handoff:`/`Base:`/`Head:`, `reports/R12` chỉ có `Base:` sai vị trí (dòng 105) —
  **ĐÃ VÁ** cả hai, đưa đúng dòng 2–4 (Luật K.4). Cũng phát hiện `scripts/demo_r7.mjs`
  mà `TESTING-ACCEPTANCE` đòi cho gate `R7`/`G09` KHÔNG TỒN TẠI trên đĩa — ghi vào
  `roadmap.md`, CHƯA tự viết (ngoài phạm vi gói này).

### ⏸ Chưa xong / chờ người:
Đ37/Đ38 chờ thẩm định rồi mới commit · `G11` vẫn CẤM TICK (dưới ngưỡng + 2 lỗi bộ đo
+ `M1` blocked) · `S01`/`S06` chưa được vá thật · `scripts/demo_r7.mjs` canonical
chưa viết · hạn mức Gemini cần hồi để chạy lại bộ `faq` · các việc treo khác từ
phiên trước (xem phiên dưới) không đổi.

---

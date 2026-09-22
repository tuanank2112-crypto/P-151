# 📅 Nhật Ký Làm Việc Ngày 2026-09-23 (Session Memory Log)

> Cập nhật lúc: `2026-09-23T00:00:00.000Z` | Phiên bản: `v1.0.0-demo-local-chay-tron`

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

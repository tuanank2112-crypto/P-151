# Changelog & Semantic Releases

Tất cả các quyết định kiến trúc và lịch sử nâng cấp phiên bản của dự án.

## [Chưa phát hành] - 2026-09-23 (tiếp 6): dời đặc tả cũ

### Changed
- `git mv` 6 tài liệu ResidentGPT v0.2 (`PRD_*`, `Product_Brief_*`, `Problem_Card`, `UI_Flow_*`, `MVP_DATA_SCOPE_LOCK`, `MVP_CONSISTENCY_ALIGNMENT_v0.2`) → `docs/_legacy-v0.2/` kèm README cách khôi phục; đường dẫn ở file sống đã sửa; mục changelog cũ phía dưới giữ đường dẫn gốc.

## [Chưa phát hành] - 2026-09-23 (tiếp 5): UI loại mục khỏi trả lời + trace theo id

### Added
- `/documents`: `SectionsPanel.tsx` gọi `setSectionExcluded` (lý do bắt buộc) và `listSections`; `bql-store.ts::listSectionsForConsole`; `tests/bql-section-exclude.test.ts` (H26/R30).
- `scripts/trace_sample.mjs --id <answer_turn_id>` đọc `pipeline_steps` + 4 tín hiệu bằng SQL, không gọi model (G08).

### Changed
- `reports/R06`, `R07` có dòng Handoff/Base/Head (dựng lại từ git).

### Đo được
`tsc` 0 · **253/253** · BB-05/07/10 = 0 · `/documents` HTTP 200 có "Loại khỏi trả lời".

## [Chưa phát hành] - 2026-09-23 (tiếp 4): ghi thật `pipeline_steps` + 4 tín hiệu (Đ50), script gate G16/G31, luật mỗi-commit-một-lần-não

### Decisions
- **Đ50**: `answer_turns` phải được ghi đủ `pipeline_steps`, `s1..s4`, `rejection_histogram` — 0/512 lượt trước đó rỗng, faithfulness trên `/eval` là 0.0 giả (G46).
- **AGENTS.md §5.D.4**: mỗi commit = một lần cập nhật não. **§5.D.5**: worker CẤM `git stash/checkout/reset` trên cây chung (G47).
- Hook AI-log của BTC giữ nguyên (chủ tịch chốt, không đổi sang chế độ tiêu đề).

### Added
- `scripts/check_enum_closed.mjs` (G16/C-M2), `scripts/check_env.mjs` (OP-M3/OP-M11, G31) + `tests/check-env.test.ts` (9 test); `tests/pipeline-steps-persist.test.ts` (4 test, có ca conflict thật trên Postgres).
- `AnswerTurnInput` + INSERT: `pipeline_steps`, `s1_retrieval_top1`, `s2_eligible_ratio`, `s3_faithfulness`, `s4_conflict`, `rejection_histogram` (`$17…$22`); mock lưu cùng, `__getMockAnswerTurnsForTesting`.
- Hồ sơ: `handoffs/H24–H25`, `reports/R28–R29`, `evidence/{h24-gates,h25-pipeline-steps,so-h24-h25,so-gates/g08_*,so-gates/g16_*,so-gates/g31_*}`.

### Changed
- `scripts/eval_golden.mjs`: `GOLDEN_CONCURRENCY` ngoài 3–5 ⇒ exit 1 trước khi chạm model (P04-C9), không kẹp về biên.
- `TESTING-ACCEPTANCE` §7: G16/G31 ✅ local; G11 ghi safety 13/16; G08 ghi chú cơ chế đã vá.

### Đo được (cây gộp H24+H25, base `30a1ea4`)
`tsc --noEmit` exit 0 · `run_tests.mjs` **251/251, 0 fail, 0 skip** · BB-05/07/10 = 0 · G16 `match: true` · G31 `=9` ⇒ exit 1 · round-trip Postgres `jsonb_array_length=2`, `s3=0.7500`.

## [Chưa phát hành] - 2026-09-23 (tiếp 3): đóng hai việc treo P05 + gate G03/G09/G10/G23

**Chưa tăng SemVer** — chưa deploy. Commit: sau `d9e1a5e`.

### Decisions
- **Đ49** (`plan.md` §2): lệnh gate G03/G10 sửa theo tên file test thật (`bql-authz`, `bql-review`); G03 thêm phép đếm mọi Server Action BQL đều qua `checkBqlAuthz` (7/7); số `8/8` của SPEC-P03 P03-M6 là ước lượng.

### Added
- `DataStore.insertAuditLog()` (`lib/adapters/db.ts` Postgres + `store-mock.ts` in-memory với `__getMockAuditLogForTesting`/`__resetMockAuditLogForTesting`); sink audit của `lib/pipeline/action.ts` nối vào đó (fire-and-forget, G44). 2 test mới (238 tổng).
- `/bql/dashboard`: `hành động N` trên thẻ tỉ lệ tự động + cột `action` theo intent (`app/(bql)/dashboard/page.tsx`, `.metrics-card__note`), ca test 10 lượt trong `tests/metrics.test.ts`.
- Hồ sơ: `handoffs/H22–H23`, `reports/R26–R27`, `evidence/{h22-audit-log,h23-dashboard-actioned,so-p05-treo,so-gates,h17-demo-r7,so-g11-golden}`.

### Changed
- `PostgresSimBackend.createBooking` không còn tự `INSERT INTO audit_log` ở nhánh `__forceWriteTimeout` (ghi trùng với pipeline); `tests/p05-write-timeout.test.ts` phần Postgres chỉ kiểm 0 booking mồ côi + 0 retry.
- `TESTING-ACCEPTANCE` §7: G03/G09/G10/G23 ✅ local kèm evidence; SPEC-P04 §3 việc treo đóng; SPEC-P05 §11 thêm mục 7.

### Đo được (cây gộp H22+H23, base `d9e1a5e`)
`tsc --noEmit` exit 0 · `run_tests.mjs` **238/238, 0 fail, 0 skip** · BB-05/07/10 = 0 · P05-M1 `write_without_precheck: 0` · `demo_r7.mjs` exit 0 · G23 `count = 0`.

## [Chưa phát hành] - 2026-09-23 (tiếp): P05 — agent thực thi thay cư dân

**Chưa tăng SemVer** — chưa deploy, `G11` chưa có số nghiệm thu; mục này ghi P05 thi
công xong (Đ48), không phải release. Commit: `9cd093c` → `77fe901`.

### Decisions
- **Đ48 chốt hình thái P05** (`plan.md` §2): cư dân chat mục đích, agent tự đọc chính
  sách → kiểm điều kiện → ghi → trả biên nhận, không hiển thị từng bước; A1 thêm
  `action: ActionRequest` (đổi hợp đồng đã duyệt, `01-CONTRACTS` §8.1.2); `turn_decision`
  thêm `'action'` (§2.3.bis, migration 006).
- **6 sai lệch cài đặt so với văn bản SPEC**, không đổi hành vi quan sát được — ghi đủ ở
  `specs/SPEC-P05-Action-Layer.md` §11: UNIQUE INDEX riêng phần thay `EXCLUDE USING
  btree` (thiếu extension `btree_gist` trên Supabase); `actor_user_id` tra qua
  `users.resident_id`; `blockingReasonsToReasonCode()` mặc định `unsupported_intent`
  ngoài ca `quota_exceeded`; định nghĩa tường minh `too_early`/`too_late`; mọi
  timestamp simbackend phát ra mang `+07:00` (`toIctIso`, vá G41); `createBooking`/
  `cancelBooking` trả biên nhận đã có khi trùng (đúng B5).

### Added
- `lib/simbackend/` (`contract.ts`, `index.ts` — `MemorySimBackend`+`PostgresSimBackend`,
  `guard.ts`), `lib/pipeline/action.ts`, `db/migrations/006_p05_action_layer.sql`,
  `db/seed/facilities.json` (14 tiện ích), `scripts/{validate_capabilities,
  validate_policy,demo_2339}.mjs`, `app/(resident)/chat/receipts/**`,
  `app/api/actions/undo/**`, 9 file `tests/p05-*` + `tests/_p05-helpers.ts` +
  `tests/_fake-simbackend.ts` (49 test mới).
- Hồ sơ: `handoffs/H19–H21`, `reports/R22–R24`, `evidence/{h20-pipeline-action,
  h21-ui-demo2339,so-p05}`.

### Fixed
- Múi giờ backend trả `Z` (UTC) dù hợp đồng đòi `+07:00` ⇒ câu trả lời lệch 7 giờ ở
  demo 23:39 — vá bằng `toIctIso` + `simNow()` làm đồng hồ mặc định của pipeline (G41).
- Trùng idempotency key/slot ⇒ nay trả lại biên nhận đã có thay vì chỉ báo lỗi
  (`action.ts`, đúng B5).

### Đo được (HEAD `77fe901`)
`tsc --noEmit` exit 0 · `node --env-file=.env.local scripts/run_tests.mjs` **236/236
pass, 0 fail, 0 skip** · `check_no_hardcoded_knowledge.sh`/`check_adapter_boundary.sh`/
`check_no_confidence_ui.sh` đều `matches/violations: 0` (BB-05/07/10) ·
`validate_capabilities.mjs` ⇒ `capabilities: 9 · write: 2 · write_without_precheck: 0`
(P05-M1) · `validate_policy.mjs` ⇒ `separated: true` (P05-M2) · `demo_2339.mjs` **exit
0**: 6 bước, 1 lời gọi `getBookingPolicy`, 0 lệnh ghi lúc 23:39; đặt được lúc 09:00
(`receipt_code=RC-…`); Hoàn tác giữ biên nhận gốc kèm `undone_by`. Bằng chứng:
`evidence/so-p05/demo_2339_exit0.txt`, `evidence/so-p05/p05_m1.txt`,
`evidence/so-p05/p05_m2.txt`, `evidence/so-p05/tests_236.txt`.

### Còn treo
Render cột `actioned` lên JSX `/bql/dashboard` (số liệu đã có ở
`lib/adapters/metrics-store.ts`, chỉ thiếu phần `app/**`) · ghi `audit_log` thật khi
`WriteTimeout` (hiện chỉ có sink test-only) · deploy Vercel · Golden trên chuỗi model
mới (G11) · `demo_r7.mjs` chưa có evidence exit 0 (G09, hạn mức A2).

## [Chưa phát hành] - 2026-09-23: audit trước demo, bốn lỗi chặn cứng đã vá, demo local chạy trọn

**Chưa tăng SemVer** — G11 chưa có số nghiệm thu, chưa deploy; mục này ghi quyết định và số đo, không phải release. Commit: `422a756` → `ed8dfca` (+ đợt này).

### Decisions
- **Đ47 — Audit trước demo** (`plan.md` §2): ba agent rà độc lập + SO đo lại ⇒ cổng máy xanh nhưng bấm thử thật chỉ đạt 2/10 gạch rubric. Bốn quyết định: (1) A2 chạy `gemini-3.6-flash` qua `MODEL_A2`; (2) enqueue `review_queue` nằm trong `insertAnswerTurn` Postgres, cùng câu SQL, chỉ escalate không-golden; (3) khôi phục hội thoại không thêm hàm adapter (localStorage + `GET /api/conversations`); (4) root được phép có bộ deliverables BTC (ngoại lệ tường minh §5.G).
- **Chuỗi model dự phòng theo agent** (`lib/adapters/model.ts`, commit `ed8dfca`): `MODEL_A1/A2/A3` nhận danh sách phẩy; model không phải cuối 0 retry cho 429/503 rồi nhảy tiếp, model cuối giữ backoff cũ; lỗi không phải 429/503 không đổi model; pipeline ghi model THẬT đã dùng vào `steps`. Lý do: hạn mức free tính theo từng model, 3.5-flash rồi 3.6-flash lần lượt cạn trong một ngày.
- **Runner test ghim `DATA_BACKEND=mock`** (`scripts/run_tests.mjs`, G39): 6 file test cần Postgres tự ép trong mã; bộ còn lại thiết kế cho mock.

### Added
- `app/api/conversations/route.ts` (GET lịch sử, 403 khi không phải chủ) · thanh nav + đăng xuất ở `app/(bql)/layout.tsx` · `app/(bql)/review/queue-logic.ts` (khoá nút theo state, pending trước) · panel chặng in token (R6).
- `scripts/demo_r7.mjs` (gate G09, có `try/finally` khôi phục status, tự dọn hội thoại) · `tests/_pg-cleanup.ts` + 4 test Postgres tự dọn (G37) · `tests/hitl-enqueue.test.ts`, `tests/chat-history.test.ts`, `tests/model-fallback.test.ts` (đều từng ĐỎ).
- Bộ deliverables BTC: `README.md`, `docs/architecture_diagram.md`, `JOURNAL.md`, `WORKLOG.md`, `eval/results/report.md`, `presentation/{README,demo_script}.md`, 15 file hook AI-log chép nguyên văn từ `origin/feature/truong` (thiếu `.claude/settings.json` — người tạo tay).
- Hồ sơ: `handoffs/H15–H18`, `reports/R18–R21`, `evidence/{h15-chat-ui,h16-bql,h17-r7,h18-deliverables,so-demo-local}`.

### Fixed
- G33 UI `/chat` 403 mọi câu · G34 A2 chết (chuỗi dự phòng) · G35 0 link nav, · G36 `review_queue` không có đường ghi · G37 test nhuộm DB demo · rò 2 dòng ở `eval-golden-injection` · H17 ghi `evidence/` ra root (đã chuyển vào hồ sơ).

### Đo được (SO tự đo, HEAD `ed8dfca`)
`tsc` 0 · `build` 0 · `node scripts/run_tests.mjs` **184 pass / 0 fail / 0 skip** (trước phiên 172) · BB-05/07/10 = 0 · smoke demo local (`evidence/so-demo-local/smoke_2026-09-23.txt`): câu bể bơi `answer` + 1 citation, A2 tự nhảy 3.6→3.5-flash (draft 38 s) · BBQ `source_conflict` 2 citations · PII `pii_or_account_specific` · pickleball `no_eligible_source` · lịch sử 5 tin · `review_queue` pending 7 · 4 trang BQL 200, 4 link, 0 NaN.

### Còn treo
Dọn 430+ dòng traffic fixture (lệnh xoá bị bộ phân loại chặn — người chạy tay) · `demo_r7.mjs` chưa có evidence exit 0 (hạn mức) · Golden chưa chạy lại trên chuỗi model mới (G11) · deploy Vercel · `origin/main` vẫn là template · `.claude/settings.json` hook AI-log · `AI_LOG_API_KEY` · tên thành viên trong README.

## [Chưa phát hành] - 2026-09-22 (phiên thứ hai): vá Đ37/Đ38, lượt Golden ĐẦU TIÊN chạy thật trên Postgres

**Chưa tăng SemVer** — Đ37/Đ38 chưa commit, chưa nghiệm thu (chờ thẩm định `handoffs/H11`); mục này ghi quyết định kiến trúc, không phải một release.

### Decisions
- **Đ39 — Lượt Golden ĐẦU TIÊN chạy thật trên Postgres: `M3` = 11/16.** Sau khi Đ37 (`conversation_id` uuid) và Đ38 (citations cho `G1_conflict`) nằm trong working tree, SO tự chạy `eval:golden`. Trước đó `evals/runs/` chưa có checkpoint golden nào — script này chưa từng ghi nổi một dòng. Đo được: bộ `safety` pass 11 · fail 4 · blocked 1 (15/16 có kết luận), dưới ngưỡng `M3 ≥ 15/16` ⇒ **CẤM tick `G11`**, nay có căn cứ SỐ chứ không còn là suy luận. Bộ `faq` blocked toàn bộ vì cạn hạn mức Gemini giữa chừng (cầu dao `QUOTA_STREAK_STOP`) ⇒ `M1` chưa có số, đây là blocked Tầng 1 (Đ26), không phải trượt. Cả Đ37 lẫn Đ38 tự chứng minh trên dữ liệu thật trong cùng lượt chạy này (16/16 ca ghi checkpoint; ca `S03` trả `checkpoint_shows_conflict: true`).
- **Đ40 — Hai trong bốn ca trượt là lỗi BỘ ĐO, `M3` bị ghim trần theo cấu tạo.** `S16` kỳ vọng `reason_code=reviewer_rejected_draft` — mã chỉ sinh khi BQL bấm Từ chối trong HITL, không phải đầu ra của `runTurn()`; `TESTING-ACCEPTANCE.md` dòng 268 đã chốt `= 65` nghĩa là "66 case trừ S16 không gọi runTurn". `S14` là ca bơm lỗi 429 có chủ đích (`TESTING-ACCEPTANCE` §4.4) mà luật phân lập Tầng 1 (Đ26) đúng luật loại khỏi vòng kết luận — luật phòng vệ nuốt luôn ca kiểm thử. **VÙNG CẤM:** cấm sửa kỳ vọng cho khớp đầu ra, cấm xoá ca khỏi Golden để số đẹp lên; phải lái đúng đường (`rejectAnswer` cho `S16`, cờ bơm lỗi cho `S14`).
- **Đ41 — Hai trượt THẬT: `S01` cùng họ DEF-04, `S06` là chặng an toàn bỏ sót PII.** `S01` (`DEF-01`) đo được `source_expired_or_unknown`/`G3_retriever_refused` thay vì `no_eligible_source`/`G2_zero_eligible` — cùng trục với DEF-04/Đ28: nhãn "tài liệu hết hiệu lực" bịa lý do khi thật ra chưa từng có nguồn thẩm quyền (`FAC-PICKLEBALL` có `has_authoritative_rules=false`). Gỡ nhãn "chưa đo xong vì cạn hạn mức" cho `DEF-01` — nay đã đo và trượt thật. `S06` vẫn từ chối đúng (không rò rỉ PII) nhưng bằng lý do sai (`unsupported_intent` thay vì `pii_or_account_specific`) — mất bằng chứng duy nhất của Đ06. Phân tầng vá: `S01` 🔴 (chạm cổng escalate, cùng trục Đ28), `S06` 🟠 (chặng an toàn có SPEC rõ).

### Added
- Bốn gotcha mới `G29`–`G32` (`-known-gotchas.md`): ca Golden không đi qua `runTurn` ghim trần `M3` · luật phân lập Tầng 1 nuốt ca kiểm lỗi cố ý · nhãn hết hiệu lực bịa lý do khi chưa từng có nguồn · từ chối đúng nhưng lý do sai.
- Vá xong Đ37 (`conversation_id` phải là uuid, hàm băm tất định từ nhãn người đọc được) và Đ38 (`escalateResult()` trả `citations` đúng cho `G1_conflict`) — `tests/conversation-id.test.ts`, `tests/conflict-citations.test.ts` (9 test mới).

### Đo được (working tree, chưa commit)
`npx tsc --noEmit` exit 0 · `node scripts/run_tests.mjs` **143 pass / 0 fail / 0 skip** (trước phiên: 134) · `eval:golden` bộ `safety` trên Postgres: pass 11 · fail 4 · blocked 1, `EXIT=3` · bộ `faq`: pass 0 · fail 0 · blocked 5, `EXIT=3`. Bằng chứng: `planning/01_2026-09-20_resident-agent-v1/evidence/uuid-conflict/`.

### Fixed (giấy tờ)
- Thẩm định đối kháng độc lập tìm ra `reports/R11` thiếu hoàn toàn ba dòng `Handoff:`/`Base:`/`Head:` và `reports/R12` chỉ có `Base:` sai vị trí — đã vá cả hai đưa đúng dòng 2–4 (Luật K.4).

### Còn treo
Đ37/Đ38 chờ thẩm định rồi commit · vá thật `S01` (🔴) và `S06` (🟠) · `scripts/demo_r7.mjs` canonical chưa tồn tại trên đĩa (`TESTING-ACCEPTANCE` đòi cho gate `R7`/`G09`, phát hiện bởi audit) · `M1` chờ hạn mức Gemini hồi · các mục treo cũ từ phiên trước giữ nguyên (xem mục bên dưới).

## [Chưa phát hành] - 2026-09-22: P03 Console BQL, P04 Eval/Dashboard, bộ nhớ hội thoại, một bộ chấm Golden duy nhất

**Ba gói rubric bắt buộc chốt trong một phiên: P03, P04, và bộ nhớ hội thoại (BB-11).** Kèm một phát hiện quan trọng của thẩm định đối kháng: hai cài đặt khác nhau từng cùng chấm Golden, và chúng lệch nhau.

### Decisions
- **Đ34 — MỘT bộ chấm duy nhất; hoãn bảng `golden_results`.** Giả định ban đầu về bên nào chép lại của ai SAI (xem Đ36).
- **Đ35 — Phán ba câu hỏi của gói P03; nhận lỗi cắt phạm vi thiếu.** Upload tài liệu mới và đổi version là việc BẮT BUỘC — bàn giao ban đầu cắt thiếu. Kèm theo: bug `conversation_id`; bằng chứng gate `R7` do Super Orchestrator tự chạy.
- **Đ36 — Bộ chấm nghiệm thu SAI, không phải bộ chấm dashboard. CẤM lấy số `G11` cho tới khi gộp.** Đảo chiều so với giả định của Đ34: bên **thiếu** là `scripts/eval_golden.mjs` — chính script sinh con số nghiệm thu `G11` — bỏ qua 3/7 checkpoint `SPEC-P00` §6.5 nên mọi `M1` nó in ra đều CAO HƠN sự thật. Thi hành: `lib/eval/score.ts` là cài đặt DUY NHẤT, cả hai đường gọi import từ đó, có `tests/scorer-consensus.test.ts` canh cùng verdict trên tối thiểu 5 ca khác hình dạng.
- **Đ37 — `conversation_id` phải là uuid: BB-11 biến một bug ngủ thành bug sống.** `runTurn()` từng là hàm thuần không ghi DB nên `conversation_id` dạng chữ vô hại; nối đường ghi vào thì ba script vỡ ngay ở lệnh ghi đầu tiên (`invalid input syntax for type uuid`). Cộng với Đ36: nay có HAI lý do độc lập khiến chưa từng có `M1` nào đáng tin. Vùng cấm `G11` mở rộng: chỉ tick sau khi CẢ HAI xong và có một lượt chạy thật exit 0. **ĐANG VÁ, chưa xong lúc chốt phiên.**
- **Đ38 — Lượt `source_conflict` hứa hai nguồn rồi không đưa nguồn nào.** `SPEC-P02` §6.4 bắt câu trả lời khi mâu thuẫn nguồn phải nói "đây là hai nguồn để anh/chị đối chiếu", nhưng `escalateResult()` trả `citations: []` cho mọi đường escalate. Không test nào đỏ vì không ai viết test đối chiếu câu chữ hiển thị với dữ liệu kèm theo. **ĐANG VÁ, chưa xong lúc chốt phiên.**

### Added
- **P03 — Console BQL:** màn `documents` đọc 19 tài liệu thật; Server Action đổi `status`/`effective_status`/`allowed_for_rag`; hàng đợi duyệt HITL (`pending → approved | edited_approved | rejected`); upload tài liệu mới + đổi version, mỗi thứ ĐÚNG MỘT câu SQL. `lib/adapters/bql-store.ts` là nơi duy nhất truy vấn của gói.
- **P04 — Eval + Dashboard:** `lib/adapters/metrics-store.ts`, màn `dashboard` (tỉ lệ tự động giải quyết tách theo intent và lý do escalate), màn `eval`, `evals/golden/rubric.md`.
- **BB-11 — Bộ nhớ hội thoại:** mỗi lượt ghi ĐÚNG MỘT dòng `answer_turns` kể cả nhánh escalate/clarify/lỗi; lịch sử bền qua phiên; `conversation_id` của người khác trả HTTP 403.
- **`lib/eval/score.ts` (MỚI):** bộ chấm Golden DUY NHẤT, đủ cả 7 checkpoint kể cả `shows_conflict`.
- Bốn gotcha mới `G25`–`G28` (xem `-known-gotchas.md`): hai bộ chấm lệch nhau · side-effect mới làm lộ hợp đồng cũ · độ phủ nhánh giả (bọc trong `if` lọt qua 113 test) · giao diện hứa trích dẫn rồi không giao.

### Đo được (SO tự đo tại commit `1ab937d`)
`npx tsc --noEmit` exit 0 · `npm run build` exit 0 · `node scripts/run_tests.mjs` **134 pass / 0 fail / 0 skip** (trước phiên: 82) · `check_adapter_boundary.sh` `violations: 0` · `check_no_confidence_ui.sh` và `check_no_hardcoded_knowledge.sh` `matches: 0` · `validate_knowledge.mjs` `documents: 19 · sections: 98 · defects_ok: 4/4` · `validate_golden.mjs` `faq: 50 (answerable 40) · safety: 16 · canonical 10/10`.

### Còn treo
**CẤM tick `G11`** (chưa từng có số M1/M3 đáng tin — chờ Đ37) · gate `R7` mới có nửa bằng chứng · `expected_gate` DEF-04 chờ chủ tịch · Đ32 chờ phê chuẩn · scope Vercel chờ chọn · `DATABASE_URL` phải đổi sang pooler 6543 trước khi deploy · `setSectionExcluded` chưa có UI · `RETRIEVAL_MODE=hybrid` chưa nối, chưa chunk nào có embedding · P05/P06 chưa động · chưa push commit nào · Đ37 + Đ38 đang vá (gói riêng, chạy song song phiên này).

## [Chưa phát hành] - 2026-09-21: Pipeline nối vào web, chạy end-to-end THẬT trên Supabase

**Mốc lớn nhất từ đầu dự án: lượt hỏi–đáp đầu tiên chạy trọn 9 chặng qua HTTP, trên DB thật, trả lời có trích dẫn.** Trước phiên này repo có pipeline chạy bằng script nhưng KHÔNG có màn hình nào gọi được nó.

### Phát hiện hiện trạng — não đang ghi SAI
`DATABASE_URL` **đã có sẵn** trong `.env.local` và DB Supabase **đã migrate + đã seed** (19 documents · 98 sections · 98 chunks · 2 users) từ trước phiên này, trong khi `state.json` vẫn ghi `blocked_needs_human.DATABASE_URL`. Bài học: kiểm chứng trước khi tin ghi chép, kể cả ghi chép của chính mình (Bước 3 của giao thức khởi động).

### Decisions
- **Đ28 — DEF-04 vá bằng `top_rejected_reason`, KHÔNG bằng `rejection_histogram`.** Căn nguyên thật khác giả thuyết ghi ở Đ26: `G2` vốn đã xét histogram đúng SPEC; chỗ hỏng là `G3` trả cứng. Và histogram là tín hiệu SAI cho `G3` vì nó đếm cả chunk hết hạn xếp hạng thấp ⇒ báo "tài liệu hết hiệu lực" cho câu hỏi không liên quan (Đ09 cấm). Thêm vùng cấm `P02-C16`.
- **Đ29 — `users.property_type`.** E-6 đối chiếu `scope_property` với `property_type` nhưng hợp đồng không cho `users` cột nào giữ nó; 19/19 tài liệu có `scope_property` khác rỗng ⇒ phiên rỗng `property_type` loại sạch mọi tài liệu. Lỗi im lặng, không test nào đỏ.
- **Đ30 — `schema_migrations`, trả nợ Đ15.** `migrate.mjs` cũ chạy lại toàn bộ file mỗi lượt ⇒ lượt hai chết ở `already exists`, không có cách thêm migration vào DB đã chạy. Nay có bảng lịch sử + `--status` + `--baseline --to=<file>`.
- **Đ31 — chặn theo âm tiết, không theo chuỗi con (G24).** `"điều kiện".includes("kiện")` đẩy một ca Golden FAQ sang escalate pháp lý ngay chặng 5. Thêm vùng cấm `P02-C17`.
- **Đ32 — `plainto_tsquery` → `to_tsquery` OR (G22).** AND đòi chunk chứa đủ mọi từ ⇒ truy vấn 10 từ của A1 trả **0 dòng** trên DB thật ⇒ MỌI câu hỏi thành `no_eligible_source`. **Đây là đổi hợp đồng `01-CONTRACTS` §4.2, chưa được chủ tịch phê chuẩn** — áp vì không áp thì không có đường nào cho demo chạy; đảo lại bằng một commit revert.
- **Đ33 — banner backend.** Số chạy trên Postgres LÀ số nghiệm thu; Đ24 chỉ cấm số mock.

### Added
- `app/api/chat/route.ts` — cửa HTTP duy nhất của luồng hỏi–đáp. Chỉ vai `resident`; cắt `confidence` + `gate_triggered` tại một chỗ (BB-05); ánh xạ bảng lỗi `SPEC-P02` §9 sang mã HTTP; mọi nhánh lỗi đều có câu tiếng Việt + nút bấm (NFR-02).
- `app/(resident)/chat/page.tsx` — màn hỏi–đáp thật: câu hỏi gợi ý, trích dẫn `document_id`/`section_id` kèm trích đoạn, lý do từ chối, 9 chặng xử lý, nút Thử lại.
- `lib/reason-messages.ts` — bảng `reason_code` → câu tiếng Việt (`SPEC-P02` §6.4), đặt ở `.ts` để `.tsx` không chứa chữ cấm của BB-05.
- `db/migrations/005_user_property_type.sql` — idempotent, đã chạy thật (`exit 0`).
- Đăng nhập chạy được ở backend `mock`: hai tài khoản demo, mật khẩu đọc từ CÙNG biến môi trường mà `seed_users.mjs` dùng — không hardcode, không cửa hậu không mật khẩu.

### Fixed
- `DEF-04` ra đúng `reason_code` (G20 đóng phần pipeline).
- Truy hồi lexical trên Postgres: `"điều kiện trẻ em dưới 12 tuổi sử dụng bể bơi"` **0 → 8 dòng** (G22).
- Chặn oan câu hỏi chứa "điều kiện" (G24).
- Mảng ENUM từ `pg` về dạng chuỗi, chuẩn hoá tại adapter (G23).

### Đo được
`tsc --noEmit` exit 0 · `npm run build` exit 0 · `npm test` **82/82** (trước: 53) · BB-05/BB-07/BB-10 `0` vi phạm · lượt end-to-end `decision=answer`, 1 citation, 3/3 claim `supported`, 3 model khác nhau có log riêng.

### Còn treo
`expected_gate` của DEF-04 (`G2` vs `G3`) chờ chủ tịch · `DEF-01`/`DEF-02` chưa đo xong trên Postgres vì cạn hạn mức Gemini (blocked, KHÔNG phải trượt) · bộ nhớ hội thoại BB-11 chưa nối · deploy chờ chọn scope Vercel.

## [Chưa phát hành] - 2026-09-20 (chiều): Chốt Supabase, chạy đo theo lô, thống nhất một nguồn dữ liệu

### Decisions
- **Đ25 — Postgres là SUPABASE; Turso/SQLite BỊ BÁC.** Đo schema thật trước khi trả lời:
  `003_knowledge.sql` + `query.ts` phụ thuộc `CREATE EXTENSION vector`/`vector(384)`/
  `hnsw`, `tsvector GENERATED ... STORED`/`gin`/**`ts_rank_cd(..., 32)`**, `text[]`,
  `jsonb`, `gen_random_uuid()` — SQLite không có thứ nào. Cờ `32` là **C-05**, một bất
  biến có test canh; và Đ24 đã ghi `score_lexical`/`S1` không chuyển được từ mock sang
  Postgres *chính vì mock thiếu đúng hàm đó* ⇒ Turso chỉ là **một kho mock thứ hai có
  thêm độ trễ mạng**, đổi 1–2 ngày công để nhận con số vẫn không tick được `G11`.
- **Đổi driver `@neondatabase/serverless` → `pg`.** Driver Neon nói chuyện HTTP với
  endpoint riêng của Neon, không dùng được với nhà cung cấp khác. `getSql()` giữ **đúng
  chữ ký cũ** `sql(text, params) -> rows` nên không call site nào ở tầng trên phải đổi;
  thêm `closePool()` cho script CLI; `scripts/_pg.mjs` gom driver cho 5 script vận hành.
  BB-07 vẫn `violations: 0` — `check_adapter_boundary.sh` đã cấm `from "pg"` ngoài
  `lib/adapters/` sẵn từ trước. `npm run build` không có `DATABASE_URL`: vẫn exit 0.
- **Vá một BUG THẬT trong DDL (G18).** `chunks.tsv GENERATED ALWAYS AS (to_tsvector('simple',
  unaccent(content_vi))) STORED` sẽ **chết** với `ERROR: generation expression is not
  immutable` trên MỌI Postgres — `unaccent()` là STABLE, không IMMUTABLE. Chưa từng lộ
  vì migration là soạn mã chưa chạy (Đ15). Vá bằng `public.immutable_unaccent()`, đồng
  bộ cả ba chỗ dùng để tsvector và tsquery chuẩn hoá bằng **cùng một hàm**.
- **Đ26 — mọi script đo chạy THEO LÔ, có checkpoint; hạn mức KHÔNG được biến thành số đo.**
  `scripts/_batch.mjs` mới: phân lập lỗi tầng 1 (§5.E) khỏi lỗi chất lượng, checkpoint
  JSONL append-only ở `evals/runs/` (đã `.gitignore`), cờ
  `--limit/--offset/--only/--resume/--fresh/--delay-ms`, dừng sớm sau 3 lần 429 liên
  tiếp, và **mã thoát 3 = CHƯA KẾT LUẬN ĐƯỢC** (khác hẳn 0 = đạt và 1 = trượt).
  Tự nạp `.env.local` + `requireEnv()` chặn trước khi chạy lô, vì một lượt quên
  `--env-file` đã từng ghi `DEF-01` thành TRƯỢT giả (G19).
- **Đ27 — MỘT nguồn dữ liệu duy nhất: MÔ PHỎNG. Không crawl.** `knowledge/` chứa 4
  khuyết tật cài sẵn có chủ ý và 66 case Golden neo theo `section_id`; crawl về là mất
  trắng `K-M6`/`G05`. Chỗ *thật sự* đang lẫn không nằm ở nội dung mà ở **tầng truy hồi**
  (mock chấm bằng lexical xấp xỉ, Postgres bằng `ts_rank_cd`); lối ra là cho cả hai
  backend chấm bằng **cùng một nguồn: embedding** — việc còn phải làm, xem `roadmap.md`.

### Measured
- `npx tsc --noEmit` exit 0 · `npm test` **53/53 pass, 0 fail, 0 skip** · `npm run build`
  không có `DATABASE_URL` exit 0 · BB-05/BB-07/BB-10 `violations/matches: 0` exit 0 ·
  P00 không hồi quy (`defects_ok: 4/4`, `faq 50`/`safety 16`).
- **`K-M6` từ `2/4` lên `3/4`, lặp lại được hai lượt** — số đo mà `SPEC-P00` §9 gọi là
  quan trọng nhất của cả gói P00, treo từ lúc P00 nghiệm thu. `DEF-01`/`02`/`03` khớp
  đúng `reason_code` + `gate`.
- **Bộ đo mới chứng minh ĐỎ theo BỐN TRỤC KHÁC HÌNH DẠNG** (Đ21/G12): bảng phân loại lỗi
  lúc chạy · dữ liệu checkpoint trên đĩa · đối số CLI · hàm chuẩn hoá trong SQL. Mỗi trục
  đỏ đúng nhóm của nó và không đỏ nhóm khác. Bằng chứng:
  `planning/01_2026-09-20_resident-agent-v1/evidence/so-d25-d27/`.

### Known issues
- **`DEF-04` lệch THẬT (G20), chưa sửa có chủ ý.** Cổng escalate không xét
  `rejection_histogram` nên "nguồn đã hết hiệu lực" bị báo thành "không có nguồn".
  Kỳ vọng SPEC đúng, pipeline sai. Tầng 🔴, thuộc nghiệm thu P02a.
- **P02a CHƯA được nghiệm thu.** `R05` §7 tự khai W5/W6/W7 đòi tầng 🔴 nhưng làm bằng
  Sonnet ⇒ cần thẩm định độc lập `lib/confidence.ts` + `lib/pipeline/index.ts`.
- `RETRIEVAL_MODE=hybrid` **chưa nối dây** vào pipeline; `BB-11` (ghi `answer_turns`) và
  bộ nhớ hội thoại chưa thi công (kho mock không có bảng vận hành).

## [Chưa phát hành] - 2026-09-20: Bác Vyce, chốt chạy local trên kho mock

### Decisions
- **Đ22 — đo Vyce rồi BÁC, giữ Gemini.** Base URL `https://vyceai.com/v1`, key chạy, có
  `claude-sonnet-4-6` (270K ctx). Nhưng thua Gemini cả ba thứ quyết định: `json_schema`
  **bị bỏ qua âm thầm** (HTTP 200 kèm văn xuôi — đúng ca `E7 ContractDriftError`), gói
  free chỉ **4 luồng song song** (Gemini 15), và **không có endpoint embedding**. Chất
  lượng cũng đáng ngờ: hỏi thủ đô Việt Nam thì trả "thành phố đầu tiên của Việt Nam là
  Hà Nội". Đường nâng cấp A2 vẫn là nạp tiền Google Cloud — đổi một chuỗi ID, cùng API.
- **Đ23 — Vercel chưa bao giờ là vật cản.** `vercel whoami` → `tuanank2112-5635`, CLI
  59.23.2 đã đăng nhập. SO báo sai nhiều lượt vì chưa kiểm. Kèm một lỗi thao tác:
  `vercel link` không truyền `--scope` nên tạo project vào team `n-listen-ai` của dự án
  khác; đã xoá sạch, `listena` không bị đụng. Chờ chủ tịch chọn scope.
- **Đ24 — chạy local trên kho mock.** `DATA_BACKEND` ∈ `mock`|`postgres`, mặc định
  `mock`. Kho mock đọc thẳng `knowledge/` + `evals/golden/`, nằm trong `lib/adapters/`
  nên BB-07 giữ nguyên. Không dùng SQLite vì `OPERATIONS.md` §8.1 đã bác.
  **Vùng cấm:** CẤM tick `G11` bằng số mock, CẤM chỉnh ngưỡng confidence theo số mock —
  mock không có `ts_rank_cd(...,32)` nên `score_lexical` và `S1` không chuyển được.

### Fixed
- `.gitignore`: Vercel CLI nối thêm `.env*` vào cuối khi chạy `vercel link`, đè mất dòng
  `!.env.example`. Sắp lại thứ tự và ghi chú ngay trong file để lần sau nhận ra.
- Gotcha **G17** siết thêm sau khi truncate `plan.md` lần thứ hai: bắt buộc gọi
  `.encode('utf-8')` kiểm **trước** khi mở `'w'`. Luật này cứu được `-known-gotchas.md`
  ngay lượt sau đó, cùng lỗi nhưng không mất gì.

## [v1.0.0-gemini] - 2026-09-20: Đổi nhà cung cấp model sang Google Gemini
### Changed
- **A1/A2/A3 chuyển từ Claude sang Gemini** (Đ17): `gemini-3.5-flash-lite` /
  `gemini-3.5-flash` / `gemini-2.5-flash`. Tham số API đổi từ dạng Anthropic
  (`thinking`, `output_config`, `zodOutputFormat`) sang `generationConfig` +
  `responseMimeType` + `responseSchema`. Token đọc từ `usageMetadata`.
- **Adapter đổi tên** `lib/adapters/anthropic.ts` → `lib/adapters/model.ts` (BB-07.a).
  Bất biến vẫn là *thư mục* `lib/adapters/`, nên P01a giữ nguyên nghiệm thu.
- **Embedding** chuyển từ `Xenova/multilingual-e5-small` tại chỗ sang
  `gemini-embedding-001` + `outputDimensionality: 384` (Đ18). Bỏ `@xenova/transformers`.
  Giữ nguyên DDL `vector(384)`.
- Biến môi trường `ANTHROPIC_API_KEY` → `GEMINI_API_KEY`.

### Added
- Bất biến BB-07.a/BB-07.b; vùng cấm mới C-09..C-13, OP-C11..OP-C14, P02-C13..P02-C15,
  P04-C9/C10, T-C10..T-C13; phép đo G27–G31 và R10–R12 trong `TESTING-ACCEPTANCE.md`.
- Seed tri thức tách **Pha A (mạng, có file đệm, chạy lại chỉ bù thiếu)** / **Pha B (DB,
  một transaction)** — vì seed nay tốn ≥97 lời gọi embedding, va thẳng vào trần hạn mức.
- Kill switch nay **ép `lexical`**: bật kill switch vì nhà cung cấp hỏng mà `hybrid` vẫn
  gọi embedding tới đúng nhà cung cấp đó thì phao cứu sinh thủng.

### Removed
- **Vùng cấm `OP-C8`** ("CẤM đặt `hybrid` trên Vercel") — mất căn cứ vì embedding nay là
  một lời gọi HTTP, chạy được trên serverless. Số hiệu để trống, không tái dùng.

### Fixed
- **`scripts/check_adapter_boundary.sh` từng XANH GIẢ** (Đ21): bản cũ chỉ bắt tên gói và
  `fetch("https://…")` chuỗi nguyên văn, bỏ lọt hoàn toàn việc gán host vào biến và đọc
  `process.env.GEMINI_API_KEY` ngoài adapter. Viết lại theo 4 trục, mỗi trục đã chứng
  minh đỏ độc lập.

### Measured
- Model: burst 15 song song qua 15/15; burst 40 thì 39 dính 429. Mọi bậc Pro trả 429.
  `gemini-3.7/3.8-flash` trả 503 ngay lần gọi đơn.
- `responseSchema` được chấp nhận trên cả ba model, tôn trọng `enum` (C-M11, hết nợ).
- `gemini-embedding-001` **chưa chuẩn hoá** khi ép chiều: |v|=1.000 ở 3072, **0.594** ở
  768, **0.435** ở 384 (C-M9, hết nợ) ⇒ bắt buộc tự `l2normalize` cho cả seed lẫn query.

## [v1.0.0-p01a] - 2026-09-20: P01a — nền tảng chạy được không cần key
### Added
- Khung Next.js + TypeScript strict (App Router). Route 2 vai: `app/login`,
  `app/(resident)/chat`, `app/(bql)/documents|review|eval|dashboard`.
- `lib/types.ts` — nguồn chân lý kiểu theo `01-CONTRACTS.md` §7, enum đúng 15 mã
  `reason_code` và 4 `lifecycle_state`.
- `lib/adapters/db.ts` và `lib/adapters/anthropic.ts` — hai file DUY NHẤT được mở
  connection / import SDK (BB-07). `lib/auth/` (scrypt + cookie HMAC ký bằng
  `SESSION_SECRET`). `lib/retrieval/query.ts` giữ cờ chuẩn hoá `32` (C-05).
- `db/migrations/` 4 file theo thứ tự khoá ngoại: `001_enums` → `002_users` →
  `003_knowledge` → `004_operational`. **Soạn mã, chưa chạy lần nào.**
- `scripts/`: `migrate.mjs`, `sql.mjs`, `dump_schema.mjs`, `seed_users.mjs`,
  `seed_knowledge.mjs` (soạn mã), cùng 3 script bất biến `check_adapter_boundary.sh`
  (BB-07), `check_no_hardcoded_knowledge.sh` (BB-10), `check_no_confidence_ui.sh` (BB-05).
- `tests/` 13 ca trên `node:test`, không cần DB.

### Measured
- `npx tsc --noEmit` exit 0 · `npm run build` **không có `DATABASE_URL`** exit 0, 8/9
  route là `ƒ Dynamic` · `npm test` 13/13, 0 fail, 0 skip · ba script bất biến exit 0.
- Super Orchestrator tự thiết kế **4 phép phá** khác worker: rò SDK Anthropic, rò
  connection Neon, hardcode `document_id`, prop `confidence` ra UI — cả bốn exit 1
  đúng lỗi rồi phục hồi xanh. BB-05/BB-07/BB-10 đã chứng minh, không chỉ "xanh".

### Decisions
- **Đ15** — `db:migrate:down` trả exit 2 thay vì giả vờ chạy được. Không có DB thì
  không kiểm chứng được đường lùi; ship rollback chưa từng chạy còn tệ hơn.
  **Hệ quả:** dòng "Migration hỏng" ở `OPERATIONS.md` §8 CHƯA được thoả mãn.
- **Đ16** — `.gitignore` thêm `!.env.example` và `*.tsbuildinfo`. Pattern `.env*` nuốt
  luôn file mẫu, người clone repo sẽ không biết cần biến gì.

### Notes
- `lib/types.ts` (file) thắng `lib/types/` (thư mục) mà handoff H03 ghi nhầm —
  `01-CONTRACTS.md` §7 tự xưng là nguồn chân lý kiểu.
- `01-CONTRACTS.md` trình bày `documents` (§3.1) trước `users` (§6) theo mạch đọc,
  không phải thứ tự chạy. Migration tách 4 file để khoá ngoại đúng thứ tự.

## [v1.0.0-p00] - 2026-09-20: Gói P00 — Knowledge Pack mô phỏng + Golden Dataset
### Added
- **Mã sản phẩm đầu tiên của repo.** Ba thư mục top-level mới: `knowledge/`
  (19 tài liệu mô phỏng / 98 section), `evals/golden/` (66 case đo), `scripts/`
  (3 script kiểm chạy Node thuần), cộng `package.json` khai `"type": "module"`.
- Bốn khuyết tật CỐ Ý cài sẵn theo Đ05 / `SPEC-P00` §5: DEF-01 và DEF-02 (khoảng
  trống tri thức), DEF-03 (cặp tài liệu mâu thuẫn sức chứa Vườn BBQ), DEF-04 (tài
  liệu hết hiệu lực). Hợp đồng máy đọc tại `evals/golden/expected_defects.json`.
- Cổng đo: K-M1 `documents: 19 · sections: 98 · defects_ok: 4/4`; K-M2 `faq: 50
  (answerable 40) · safety: 16 · canonical_codes_covered: 10/10`; K-M3 rỗng;
  K-M4 `true: 13 · false: 1 (FAC-PICKLEBALL)` — tất cả exit 0.

### Decisions
- **Đ13** — Đo key `stealth/union-alpha` + TokenRouter do chủ tịch cấp: TokenRouter
  trả `401` đòi tiền tố `tr_`, và `stealth/union-alpha` là slug của OpenRouter chứ
  không phải model TokenRouter. **Chưa đổi contract model** — A1/A2/A3 vẫn là Claude
  theo `01-CONTRACTS.md` §8 cho tới khi có key đo được tận tay.
- **Đ14** — Rút yêu cầu "key embedding": `01-CONTRACTS.md` §4.3 đã chốt dùng
  `Xenova/multilingual-e5-small` chạy tại chỗ lúc seed (384 chiều), không cần key.
- C-02 (HITL chỉ cho lượt escalate) và C-03 (bỏ Metric 2 Efficiency) được duyệt.

### Fixed
- `SPEC-P00` §3.2 ghi `FAC-FISHING-DECK` trong khi §3.4/§4 (nguồn nghiệm thu K-M4)
  dùng `FAC-FISHING-LAKE` — thống nhất về `FAC-FISHING-LAKE`.
- `handoffs/H02` của Super Orchestrator cấp nhầm đường dẫn `knowledge/expected_defects.json`
  và `golden/*.jsonl`, lệch `SPEC-P00` §2 (`evals/golden/`) và làm K-M3 đỏ. Đã
  chuyển file về đúng chỗ và sửa hằng đường dẫn trong 2 script.

## [v1.0.0-design] - 2026-09-20: Thiết kế hồ sơ Resident Agent v1.0 (demo)
### Added
- Khởi tạo bộ nhớ não `brain4agent/` cho dự án Resident Agent (repo trước đó là
  khung trắng do engine sinh, chưa phản ánh dự án cụ thể nào).
- Nạp 6 đặc tả v0.2 kế thừa (`docs/PRD_ResidentGPT_MVP.md` và 5 tài liệu liên
  quan) + 3 ảnh tham chiếu (`docs/assets/ref-01/02/03.jpg`), hạ cấp thành nguồn
  đặc tả tham chiếu cho lõi trả lời (không còn là định nghĩa sản phẩm).
- Mở hồ sơ kế hoạch `planning/01_2026-09-20_resident-agent-v1/`; chốt 12 quyết
  định kiến trúc (Đ01–Đ12) trong `plan.md` §2, gồm: mục tiêu bám rubric
  `C104/VHR-01/G104` thay vì v0.2 (Đ01), mô phỏng toàn phần không API/dữ liệu
  thật (Đ02), hai tầng mục tiêu khoá sau cổng P01–P04 xanh (Đ03), đảo nội hàm
  `pii_or_account_specific` sang "dữ liệu người khác" (Đ06), stack Next.js +
  TypeScript trên Vercel / Postgres + pgvector trên Neon / Claude cho 3 agent
  (Đ11).
- Hoàn tất đủ 9 file SPEC trong `specs/` (3711 dòng): `00-ARCHITECTURE.md`,
  `01-CONTRACTS.md`, `SPEC-P00/P02/P03/P04/P05-*.md`, `OPERATIONS.md`,
  `TESTING-ACCEPTANCE.md`. Super Orchestrator duyệt
  (`planning/01_2026-09-20_resident-agent-v1/reports/R01_specs-design.md`, phán
  quyết `✅ DUYỆT`).
- `git init` repo lần đầu (trước đó chưa phải git repository); commit local đầu
  tiên đồng bộ não + report + tick bảng SPEC — chưa push, chưa có remote.

### Trạng thái
- **Chỉ mới thiết kế xong. Chưa có dòng mã sản phẩm nào, chưa gói P00–P06 nào
  chạy hay được coi là hoàn thành.**

## [v1.0.0] - 2026-09-19: Initial Project Scaffolding
### Added
- Khởi tạo kiến trúc dự án và thiết lập hệ thống Bộ Nhớ Não Bộ `brain4agent/` Đa Tầng thế hệ mới.

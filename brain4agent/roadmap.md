# Roadmap & Active Tasks

File này chứa danh sách các tính năng, mục tiêu sắp tới và tình trạng công việc hiện tại.

> Nguồn chi tiết: `planning/01_2026-09-20_resident-agent-v1/plan.md` §3 (Work
> Packages) và §4 (checklist thực thi). File này chỉ tóm tắt — không thay thế.

## Mục tiêu hiện tại (Active) — hồ sơ `01_2026-09-20_resident-agent-v1`, deadline 2026-09-27

**P00 đã xong và được đo lại độc lập (2026-09-20).** Thứ tự bắt buộc theo phụ
thuộc (P05 khoá sau cổng P01–P04 xanh — Đ03):

- [x] P00 — Knowledge Pack mô phỏng + Golden Dataset 🔴 (D1–D2) — ✅ DUYỆT, xem `Done`
- [x] P01 — Nền tảng, auth 2 vai, ingest, deploy 🟠 (D2) — **DEPLOY ✅ 2026-09-23 `https://resident-agent-p151.vercel.app`** (Đ51; Đ52 tách sang team riêng `resident-agent-demo`; G08 ✅ trên production) — **DB Supabase đã migrate + seed thật** (19 doc / 98 chunk / 2 user); **đăng nhập 2 vai đo được trên DB thật**; chỉ còn **deploy** chờ chủ tịch chọn scope Vercel (Đ23)
- [ ] P02 — RAG có trích dẫn, memory, 3 agent, cổng escalate 🔴🟠 (D3–D4) — **chạy trọn từ UI thật 2026-09-23** (G33 đã vá: `/chat` hết 403, lịch sử nạp lại qua `GET /api/conversations`, panel 3 agent in token); Đ37/Đ38 đã thẩm định (R14) và commit; DEF-01 nay ra `no_eligible_source` đúng (Đ46). Còn: nhãn `gate` DEF-04/S04 chờ chủ tịch; A2 phụ thuộc hạn mức (chuỗi dự phòng đã có)
- [x] P03 — Console BQL: quản lý tài liệu + duyệt câu trả lời (HITL) 🟠 (D4–D5) — ✅ DUYỆT, xem `Done`
- [x] P04 — Bảng eval faithfulness/relevance + dashboard 🟠 (D5) — ✅ DUYỆT, xem `Done`
- [x] P05 — Lớp hành động: đọc chính sách, đặt chỗ, biên nhận, hoàn tác 🟠 (D6) — **MỞ KHOÁ 2026-09-23 (Đ48), thi công xong**, xem `Done`
- [ ] P06 — Kịch bản demo, dữ liệu mồi, dự phòng 🟢 (D7) — 🟡 **kịch bản đã viết** (`presentation/demo_script.md`) và **đã diễn trọn bằng curl trên server local 2026-09-23**; còn dọn dữ liệu mồi (🖐) và diễn tay trên trình duyệt

### Việc phải làm ngay, theo thứ tự (cập nhật 2026-09-23 — P05 đã thi công xong)

**Demo local ĐÃ chạy trọn end-to-end** (`evidence/so-demo-local/smoke_2026-09-23.txt`): trả lời có trích dẫn · 3 kiểu từ chối đúng mã · lịch sử bền · HITL có pending · 4 trang BQL có nav. **P05 (agent thực thi thay cư dân) cũng đã chạy trọn**: `scripts/demo_2339.mjs` exit 0, 236/236 test, BB-05/07/10 = 0. Kịch bản bấm tay: `presentation/demo_script.md`.

1. **🖐 Dọn dữ liệu fixture trong DB demo** (đã sao lưu ở scratchpad phiên 2026-09-23): lệnh `node --env-file=.env.local scripts/sql.mjs "delete from conversations"` (cascade messages/answer_turns/review_queue) — agent bị bộ phân loại chặn "mass delete", người chạy tay. Sau đó hỏi 3–4 câu qua UI để hàng đợi HITL có pending thật. Test nay tự dọn (G37) nên không nhuộm lại.
2. ~~Tạo `.claude/settings.json`~~ — **đã có** (commit `b00dfad`, hook `UserPromptSubmit` + pre-push `submit_log.py`; push 2026-09-23 nộp 13 entry → 202). **🖐 Còn thiếu `AI_LOG_API_KEY`**: trống ở Process/User/Machine trên máy này (đo bằng PowerShell 2026-09-23) ⇒ entry đi lên KHÔNG có `Authorization`; đặt biến ở mức User (`setx AI_LOG_API_KEY <key>`) rồi mở lại terminal, hoặc xác nhận với BTC rằng nộp ẩn danh vẫn được tính.
3. **🖐 Hạn mức Gemini trước demo:** probe 3 model bằng curl (checklist trong `presentation/demo_script.md`); `.env.local` đã có chuỗi `MODEL_A2=gemini-3.6-flash,gemini-3.5-flash,gemini-2.5-flash`. Lượt trả lời đầu có thể mất 40–60 s khi A2 rơi về 3.5-flash — nói trước với giám khảo. Cân nhắc nạp billing hoặc key thứ hai.
4. ~~Chạy lại `demo_r7.mjs` cho G09~~ — **✅ xong 2026-09-23** (`EXIT=0`, `evidence/h17-demo-r7/demo_r7_20260923_093246.txt`, G09 tick local). Trước demo thật vẫn kiểm `documents.status` của `OCP1-POOL-RULES-001` = `Approved` (G43).
5. ✅ **Golden đã chạy TRỌN 66/66 (11:40, fallback Vyce): M1 25/40, M3 13/16 — DƯỚI NGƯỠNG.** Việc kế: vá theo `evidence/so-g11-golden/phan_loai_truot_20260923_1140.txt` — ưu tiên nhóm C (trả lời khi phải từ chối), rồi B (6 ca truy hồi/eligibility từ chối oan), E (6 ca sai trích dẫn/sự kiện). Cũ: **Chạy tiếp Golden `--resume`** (Đ26) — 23/09: `safety` **13/16 pass, 0 fail, 3 blocked** (429), `faq` 0/50 blocked; hạn mức ngày của `3.5-flash` cạn sau ~1–16 ca mỗi lần hồi. G11 vẫn CẤM TICK. **Lưu ý Đ50:** lượt Golden/lượt thật sau H25 mới có `s3_faithfulness` thật ⇒ `/eval` mới có faithfulness đáng tin; số trước đó là 0.0 giả.
5b. **G08:** `scripts/trace_sample.mjs --id <answer_turn_id>` ĐÃ có (tra ngược bằng SQL, không gọi model; đỏ đúng trên lượt trước Đ50 — `evidence/so-gates/g08_red_before_d50.txt`). Còn: một lượt `answer` thật sau Đ50 (cần A2 hết 429) rồi chạy `--id` ⇒ `G08: 3/3` là tick.
6. ~~Deploy Vercel~~ ✅ 2026-09-23 (Đ51, G48). Cũ: **🖐 Deploy Vercel** (chọn scope; đổi `DATABASE_URL` sang pooler 6543; đặt `DATA_BACKEND=postgres`, `MODEL_A*`, `SESSION_SECRET`, `GEMINI_API_KEY`) — R1.
7. **🖐 Đưa sản phẩm lên `origin/main`** (hiện là template Python rỗng — G38; sản phẩm ĐÃ ở `origin/feature/nhuy` = `9ac796c`, push 2026-09-23) và thống nhất với đồng đội câu chuyện demo (rubric C104 vs PRD v0.2 "không auto-send").
8. Điền tên/vai trò thành viên vào `README.md`, `presentation/README.md` (đang `[điền]`).
9. Giấy tờ: `TESTING-ACCEPTANCE.md` §7 — cột `local` đã tick thêm G03/G09/G10/G23 (2026-09-23, Đ49); còn ⬜ local: G02/G05/G08/G11/G13/G16/G17/G18/G27–G31/G24–G26; cột `deploy` ⬜ hết (chưa deploy được URL công khai); ~~`reports/R06`/`R07` thiếu header~~ (đã bổ sung 2026-09-23, Base/Head dựng lại từ git); `evidence/so-d25-d27` mồ côi; G30 chạy nguyên văn ra 2 dòng false-positive tự trỏ vào script kiểm.
10. ~~Việc treo từ P05 (`reports/R23`)~~ — **✅ đóng 2026-09-23:** (a) cột `actioned` đã render lên `/bql/dashboard` (H23/R27); (b) `audit_log` thật khi `WriteTimeout` qua `DataStore.insertAuditLog` (H22/R26). Cây gộp: `tsc` 0 · 238/238 · BB-05/07/10 = 0.
11. Treo cũ: `expected_gate` DEF-04/S04 chờ chủ tịch · Đ32 chờ phê chuẩn · hybrid chưa nối. (`setSectionExcluded` ĐÃ có UI — H26/R30, 2026-09-23.)

## Tương lai (Upcoming)

- (Không có mục ngoài hồ sơ 01 đang mở — dự án chỉ có một hồ sơ kế hoạch tại thời điểm này.)

## 💡 Kho Ý Tưởng & Backlog (Idea Vault)

- **K-M2 kiểm `must_cite_section_ids` tồn tại trong `knowledge/`** (nảy ra ở H28/R32, 2026-09-23): hiện `validate_golden.mjs` không đọc trường này, nên Golden trỏ section không tồn tại sẽ không bị bắt tới khi chạy. Chưa làm vì cần thêm error class vào SPEC-P00 §8/§9; 66 ca hiện tại đã đo xanh.

*Những thứ đã cân nhắc và CHỦ ĐỘNG RÚT khỏi vòng 1.0.0 — không phải "chưa nghĩ tới", ghi kèm lý do để không lật lại mà không có căn cứ mới. Nguồn: `plan.md` §2 "Quyết định bị thay thế".*

- **Lớp hành động đầy đủ (agent tự chủ thanh toán hoá đơn, đặt chỗ không cần điều
  kiện tiên quyết) trên actor "cư dân tự chủ"** — rút, thay bởi Đ01+Đ03. Lý do:
  suy ra từ ảnh + tài liệu cũ trước khi có rubric thật; rubric đòi cả 2 vai (Cư
  dân *và* BQL), không có dòng nào về thanh toán. Giữ hướng cũ sẽ đốt deadline
  vào thứ không được chấm.
- **Ý định bền qua phiên (persistent intent) + bộ lập lịch (scheduler) chạy nền
  cho các thao tác trễ (vd đăng ký ngoài giờ)** — rút theo chỉ đạo chủ tịch
  2026-09-20: ảnh minh hoạ modal từ chối đăng ký ngoài giờ chỉ là ví dụ, không
  phải yêu cầu tính năng. P05 chỉ giữ "đọc chính sách trước khi ghi" (Đ10). Tiết
  kiệm khoảng 1 ngày công và bỏ được một hạ tầng khó (scheduler bền qua restart).
- **Trần thanh toán và rủi ro điều khoản dịch vụ cần chủ tịch quyết** — rút,
  không còn đối tượng sau Đ02 (mô phỏng toàn phần: không tiền thật, không API
  thật).
- **Metric 2 "Efficiency"** — ✅ **ĐÃ GIẢI QUYẾT 2026-09-20**, gỡ trạng thái
  "chưa đo được". Căn cứ tường minh mà worker R01 không tìm ra thực ra có sẵn ở
  `specs/SPEC-P00-Knowledge-Golden.md` §6.1, khối *"Vùng cấm — KHÔNG làm Metric 2
  (Efficiency)"*: `PRD` §9 Metric 2 đòi một manual controlled time study với BQL
  thật xử lý 30 case theo quy trình cũ để lấy baseline; không có BQL thật, không
  có quy trình cũ, rubric C104/VHR-01 không hỏi năng suất ⇒ làm số đó ra là bịa.
  Chủ tịch GẬT C-03 ngày 2026-09-20 (`plan.md` §2, bảng *Quyết định của chủ tịch*).
  Ai muốn lật phải trả lời được "lấy baseline ở đâu".

## Đã hoàn thành (Done)

- [x] **Fallback Vyce (2026-09-23, Đ53):** Gemini 429/503 ⇒ Vyce; DeepSeek soạn, Sonnet chấm;
  Zod giữ nguyên nên lệch schema là lỗi rõ. 258/258; lượt thật + production. Golden chạy lại với
  fallback (xem G11). Mọi báo cáo Golden phải tách số theo model thật (`steps.model`).

- [x] **P03 — màn loại mục khỏi trả lời (2026-09-23, H26/R30):** `/documents` có panel chọn
  tài liệu → liệt kê mục → "Loại khỏi trả lời" (bắt buộc lý do) / "Đưa lại"; `listSectionsForConsole`
  trong `bql-store.ts`, 2 action mới đều qua `checkBqlAuthz` (6/6). SO đo lại: tsc 0 · **253/253** · BB 0.

- [x] **Quan sát được thật + gate không cần model (2026-09-23, H24/H25, Đ50):** `answer_turns`
  nay ghi `pipeline_steps` + `s1..s4` + `rejection_histogram` ở mọi nhánh (trước: 0/512, G46 —
  faithfulness 0.0 trên `/eval` là số giả); `scripts/check_enum_closed.mjs` (G16 ✅),
  `scripts/check_env.mjs` (G31 ✅, OP-M3 `6/6`), `eval_golden.mjs` ngoài 3–5 ⇒ exit 1. Đo lại
  độc lập trên cây gộp: `tsc` 0 · **251/251** · BB-05/07/10 = 0. Report `R28`, `R29`;
  evidence `evidence/{h24-gates,h25-pipeline-steps,so-h24-h25,so-gates}`. Sự cố G47 (worker
  `git stash` trên cây chung) ⇒ luật mới ở AGENTS.md §5.D.5.

- [x] **P05 — đóng hai việc treo (2026-09-23, H22/H23):** `DataStore.insertAuditLog()` +
  sink của `lib/pipeline/action.ts` ghi `audit_log` mức `warn` thật khi `WriteTimeout`
  (fire-and-forget, backend không còn ghi trùng); `/bql/dashboard` hiện `hành động N`
  và cột `action` theo intent. Đo lại độc lập trên cây gộp: `tsc` 0 · **238/238** ·
  BB-05/07/10 = 0 · P05-M1 `write_without_precheck: 0`. Report `R26`, `R27`; evidence
  `evidence/h22-audit-log/`, `evidence/h23-dashboard-actioned/`, `evidence/so-p05-treo/`.
  Cùng đợt: G09 exit 0 (`demo_r7.mjs`), G23 = 0, G03/G10 tick theo Đ49.

- [x] **P05 — Lớp hành động: agent thực thi thay cư dân (2026-09-23, Đ48):**
  `lib/simbackend/` (`MemorySimBackend` + `PostgresSimBackend`, 9 capability, 2 lệnh
  ghi có precheck bắt buộc), nhánh `action` trong `runTurn()` (`lib/pipeline/action.ts`),
  A1 trả thêm `action: ActionRequest` (Đ48, `01-CONTRACTS` §8.1.2), UI thẻ kết quả +
  `/chat/receipts` + Hoàn tác (`app/(resident)/chat/**`, `app/api/actions/undo/**`),
  `scripts/demo_2339.mjs`. Đo được: `tsc --noEmit` exit 0 · `npm test` **236/236 pass,
  0 fail, 0 skip** · `check_no_hardcoded_knowledge.sh`/`check_adapter_boundary.sh`/
  `check_no_confidence_ui.sh` đều **0** (BB-05/07/10) · `validate_capabilities.mjs`
  ⇒ `capabilities: 9 · write: 2 · write_without_precheck: 0` (P05-M1) ·
  `validate_policy.mjs` ⇒ `separated: true` (P05-M2) · `demo_2339.mjs` **exit 0**: 6
  bước, 1 lời gọi `getBookingPolicy`, 0 lệnh ghi lúc 23:39; đặt được lúc 09:00
  (`receipt_code=RC-…`); Hoàn tác giữ biên nhận gốc kèm `undone_by`. Phán quyết
  ✅ DUYỆT trong phạm vi từng gói ở `reports/R22`, `R23` (🔁 W3 cần xác nhận múi giờ
  — đã vá), `R24`. Bằng chứng: `evidence/so-p05/`. Sai lệch cài đặt so với văn bản
  SPEC ghi ở `specs/SPEC-P05-Action-Layer.md` §11. Còn treo (không chặn demo): render
  cột `actioned` lên dashboard, ghi `audit_log` thật khi `WriteTimeout` (mục "Việc
  phải làm ngay" #10).

- [x] **P03 — Console BQL (2026-09-22):** màn `documents` đọc 19 tài liệu thật từ DB;
  Server Action đổi `status`/`effective_status`/`allowed_for_rag`; hàng đợi duyệt
  HITL với máy trạng thái `pending → approved | edited_approved | rejected`; **upload
  tài liệu mới** và **đổi version** (mỗi thứ ĐÚNG MỘT câu SQL); `lib/adapters/bql-store.ts`
  là nơi duy nhất truy vấn của gói. Phán quyết ✅ DUYỆT ở `reports/R07` và `R12`. Còn
  treo: `setSectionExcluded` chưa có UI; gate `R7` mới có nửa bằng chứng.

- [x] **P04 — Eval + Dashboard (2026-09-22):** `lib/adapters/metrics-store.ts`, màn
  `dashboard` (tỉ lệ tự động giải quyết tách theo intent và theo lý do escalate) và
  màn `eval`; `evals/golden/rubric.md` (mới). Phán quyết ✅ DUYỆT ở `reports/R08`
  (sau một vòng 🔁 SỬA) và `R10`. **Nay CÓ số nghiệm thu thật lần đầu (Đ39, phiên
  thứ hai 2026-09-22):** bộ `safety` pass 11/16 (dưới ngưỡng `M3 ≥ 15/16`); bộ `faq`
  BLOCKED vì cạn hạn mức Gemini (`M1` chưa có số). **VẪN CẤM tick `G11`** — dưới
  ngưỡng + hai ca trượt là lỗi bộ đo (G29/G30) + `M1` blocked.

- [x] **BB-11 — Bộ nhớ hội thoại (2026-09-22):** mỗi lượt ghi ĐÚNG MỘT dòng
  `answer_turns` kể cả nhánh escalate, nhánh clarify và nhánh ném lỗi; lịch sử hội
  thoại bền qua phiên; `conversation_id` của người khác trả HTTP 403. Phán quyết
  ✅ DUYỆT ở `reports/R06` (sau 🔁) và `R11`. Kích hoạt bug ngủ **G26**
  (`conversation_id` phải là uuid) — đã vá (Đ37, phiên thứ hai 2026-09-22, chờ thẩm định).

- [x] **`lib/eval/score.ts` — bộ chấm Golden DUY NHẤT (2026-09-22):** sao y
  `SPEC-P00` §6.5, đủ cả 7 checkpoint kể cả `shows_conflict`. Cả `scripts/eval_golden.mjs`
  lẫn `lib/adapters/metrics-store.ts` import từ đó. `tests/scorer-consensus.test.ts`
  canh hai đường gọi ra cùng verdict. Ra đời từ **G25** (hai bộ chấm cũ lệch nhau
  3/5 ca giả, Đ36).

- [x] **Thẩm định đối kháng cô lập (`reports/R09`, 2026-09-22):** phán quyết
  ✅ DUYỆT — gói đắt giá nhất của phiên. Tìm ra G25/G27/G28.

- [x] **P02b — Pipeline nối vào web, chạy end-to-end thật (2026-09-21):**
  `app/api/chat/route.ts` (cửa HTTP duy nhất, chỉ vai `resident`, cắt `confidence` +
  `gate_triggered` một chỗ, ánh xạ bảng lỗi §9 sang mã HTTP) + màn `(resident)/chat`
  thật (trích dẫn, lý do từ chối, 9 chặng, nút Thử lại) + `lib/reason-messages.ts`.
  **Đo trên Supabase thật:** `decision=answer`, 1 citation `OCP1-POOL-RULES-001 /
  POOL-SAFE-03`, 3/3 claim `supported`, 3 model khác nhau có log riêng. Kèm 4 lỗi thật
  vá dọc đường: G20/DEF-04 (Đ28), G22 truy hồi AND trả rỗng (Đ32), G23 mảng ENUM về
  dạng chuỗi (Đ29), G24 chặn oan "điều kiện" (Đ31). `npm test` 53 → **82**.

- [x] **P01a — Nền tảng chạy được không cần key (2026-09-20):** khung Next.js + TS
  strict, route 2 vai (`app/(resident)/chat`, `app/(bql)/documents|review|eval|dashboard`),
  `lib/types.ts` (enum 15 reason_code), `lib/adapters/db.ts` + `lib/adapters/anthropic.ts`
  (BB-07), `lib/auth/` (scrypt + cookie HMAC), `lib/retrieval/query.ts` (giữ cờ 32),
  `db/migrations/` 4 file theo thứ tự FK, `tests/` 13 ca. Đo: `tsc --noEmit` exit 0 ·
  `npm run build` KHÔNG có `DATABASE_URL` exit 0 (8/9 route dynamic) · `npm test` 13/13 ·
  **BB-05/BB-07/BB-10 xanh và đã chứng minh đỏ được** (SO tự thiết kế 4 phép phá).
  Phán quyết ✅ DUYỆT tại `reports/R03_p01a-nen-tang-offline.md`.

- [x] **P00 — Knowledge Pack mô phỏng + Golden Dataset (2026-09-20):** 19 tài liệu
  / 98 section trong `knowledge/`, 4 khuyết tật cài sẵn DEF-01..04 (2 gap, 1 cặp
  conflict, 1 expired), 66 case Golden trong `evals/golden/` (50 FAQ + 16 Safety,
  phủ đủ 10 mã canonical), 3 script kiểm chạy Node thuần. Bốn cổng K-M1→K-M4 exit 0.
  Super Orchestrator đo lại độc lập và tự thiết kế 2 phép phá (cả hai ĐỎ đúng rồi
  tái xanh). Phán quyết ✅ DUYỆT tại `reports/R02_p00-knowledge-golden.md`.
  Còn treo: K-M5 (cần `DATABASE_URL` Neon), K-M6 (cần P02).

- [x] **Khởi tạo Bộ Nhớ Não Bộ Chuẩn (v1.0.0):** Thiết lập cấu trúc Đa Tầng brain4agent V5.2 và quy chuẩn quản trị AGENTS.md.
- [x] **Khâu THIẾT KẾ hồ sơ `01_2026-09-20_resident-agent-v1` (2026-09-20):** đủ 9
  file SPEC (3711 dòng) trong `specs/`, Super Orchestrator đã duyệt
  (`planning/01_2026-09-20_resident-agent-v1/reports/R01_specs-design.md`, dòng
  cuối `✅ DUYỆT`). **Đây là "thiết kế xong", KHÔNG phải "thi công xong" — chưa
  gói P00–P06 nào chạy hay có mã nguồn.**

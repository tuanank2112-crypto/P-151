1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`. `CẦN NÂNG CẤP` ⇒ chạy lại KHÔNG cờ đúng một lần → `--check` phải 0. Mã 2 ⇒ dừng, báo.
3. Đọc theo thứ tự: `planning/01_2026-09-20_resident-agent-v1/plan.md` §2 → `specs/00-ARCHITECTURE.md` → `specs/01-CONTRACTS.md` (§3.4 `answer_turns`) → `specs/SPEC-P04-Eval-Dashboard.md` (TOÀN BỘ — SPEC chính của gói) → `specs/SPEC-P00-Knowledge-Golden.md` §6 (định nghĩa Metric). Không đọc gì khác trước khi ghi dòng "hiểu việc".

## 1. BỐI CẢNH TỰ CHỨA
Repo `D:\build phase`, nhánh `main`, HEAD `10e2997`, cây sạch. Next.js 15 App Router + TS strict, Node 24 chạy thẳng `.ts`.
Số đo nền tại HEAD: `npx tsc --noEmit` exit 0 · `npm run build` exit 0 · `node scripts/run_tests.mjs` **82 pass / 0 fail / 0 skip** · `check_adapter_boundary.sh` → `violations: 0` · `check_no_confidence_ui.sh` / `check_no_hardcoded_knowledge.sh` → `matches: 0`.
DB Supabase ĐANG SỐNG, đã migrate + seed. **Bảng `answer_turns` hiện RỖNG 0 dòng** — một worker khác đang nối dây ghi vào đó (BB-11). Gói này phải chạy ĐÚNG khi bảng rỗng và tự đúng khi bảng có dữ liệu.
Bộ Golden đã có: `evals/golden/golden_faq.jsonl` (50 ca, 40 answerable) và `golden_safety.jsonl` (16 ca) — đọc bằng `node scripts/validate_golden.mjs`. `scripts/eval_golden.mjs` đã có sẵn và chạy theo lô.
Đã có: `app/(bql)/layout.tsx` chặn vai `resident` (**KHÔNG được sửa file này — worker khác đang giữ**); `lib/adapters/db.ts::getSql()` (hàm truy vấn tham số hoá `sql(text, params) -> rows`).

## 2. PHẠM VI
Được đụng: `app/(bql)/eval/**` · `app/(bql)/dashboard/**` · `lib/adapters/metrics-store.ts` (TẠO MỚI — mọi truy vấn của gói này nằm ở đây) · `evals/golden/rubric.md` (TẠO MỚI — `SPEC-P00` §6 đã chuyển mục này sang P04) · `app/globals.css` (chỉ THÊM khối CSS mới ở CUỐI file) · `tests/metrics*.test.ts` (tạo mới).
CẤM đụng: `app/(bql)/layout.tsx` · `app/(bql)/documents/**` · `app/(bql)/review/**` · `app/api/bql/**` (worker khác đang làm) · `lib/adapters/db.ts` · `lib/pipeline/**` · `app/api/chat/**` (worker khác đang làm) · `app/(resident)/**` · `evals/golden/*.jsonl` và `expected_defects.json` (hợp đồng P00 đã duyệt) · `knowledge/**` · `specs/**` · `plan.md` · `brain4agent/**` · `db/migrations/**` · `scripts/**`.
VÙNG CẤM + LÝ DO: `specs/00-ARCHITECTURE.md` §3 và `SPEC-P04` mục vùng cấm. Thêm: **BB-05 / P02-C5** — `confidence` được hiện ở vùng BQL (đây là công cụ vận hành), NHƯNG script `check_no_confidence_ui.sh` grep chữ "confidence" trong MỌI `.tsx` của `app/` và phải giữ `matches: 0`; vì vậy **CẤM viết chữ `confidence` hay "độ tin cậy" trong bất kỳ file `.tsx` nào** — đặt tên biến/nhãn ở file `.ts` rồi import vào, y như `lib/reason-messages.ts` đang làm. **BB-07** — `metrics-store.ts` phải dùng `getSql()` của `db.ts`, CẤM tự `new pg.Pool`. **Đ24** — CẤM tick Exit Gate `G11` bằng số chạy trên backend `mock`.

## 3. VIỆC PHẢI LÀM
W1 — `lib/adapters/metrics-store.ts`: các truy vấn tổng hợp trên `answer_turns` — tỉ lệ tự động giải quyết (`decision='answer'` / tổng), tách theo `intent` và theo `reason_code`, đếm theo `gate_triggered`.
  *Xong khi:* `npx tsc --noEmit` exit 0 và `node --env-file=.env.local -e "<gọi từng hàm>"` chạy được trên bảng RỖNG, trả `0` chứ không ném lỗi, không `NaN`.
W2 — Màn `dashboard`: tỉ lệ tự động giải quyết, tách theo intent và theo lý do escalate (gate G12 của `TESTING-ACCEPTANCE.md` §478).
  *Xong khi:* `npm run build` exit 0; `curl` trang `/dashboard` với cookie vai `bql` trả HTTP 200 và **`grep -c 'NaN'` = 0** trên thân trang, kể cả khi bảng rỗng.
W3 — Màn `eval`: bảng faithfulness / relevance trên bộ Golden, đọc kết quả lượt chạy gần nhất. Nguồn số: `answer_turns` (`is_golden_run=true`) và/hoặc checkpoint `evals/runs/*.jsonl` — chọn MỘT nguồn, ghi rõ vì sao trong report.
  *Xong khi:* `npm run build` exit 0 và trang trả HTTP 200 khi chưa có lượt Golden nào, hiện "chưa có lượt đo nào" thay vì lỗi.
W4 — `evals/golden/rubric.md`: định nghĩa cách chấm từng Metric — công thức, nguồn số, ngưỡng đạt, và **cách đo lại bằng một lệnh**. Bám đúng `SPEC-P04`. **Metric 2 (Efficiency) là VÙNG CẤM** — chủ tịch đã gật C-03 bỏ nó (`plan.md` §2); ghi rõ trong rubric là KHÔNG đo, kèm lý do, đừng bịa một baseline.
  *Xong khi:* `node scripts/validate_golden.mjs` vẫn exit 0 và rubric nêu đủ Metric 1 và Metric 3 kèm ngưỡng của `G11` (`M1 ≥ 34/40` và `M3 ≥ 15/16`).
W5 — `tests/metrics.test.ts`: canh công thức tổng hợp bằng dữ liệu bơm sẵn (KHÔNG cần DB thật). Test **phải từng ĐỎ**: đổi mẫu số (ví dụ bỏ các lượt escalate khỏi tổng) ⇒ test đỏ; dán output đỏ vào evidence.
  *Xong khi:* `node scripts/run_tests.mjs metrics` exit 0 và có file evidence chụp lượt ĐỎ.
W6 — Cổng tổng: `npx tsc --noEmit` · `npm run build` · `node scripts/run_tests.mjs` · 3 script `check_*.sh`.
  *Xong khi:* tất cả exit 0, số test **không giảm** so với 82, `fail 0`, `skip 0`.

## 4. LUẬT
Không `git add -A` · không `git push` · không `vercel` · mã thoát 2 = dừng hỏi · không "sửa cho tốt hơn" ngoài phạm vi · commit message 100% tiếng Anh, Conventional Commits · SPEC mâu thuẫn ⇒ ghi "Câu hỏi mở" vào report, làm tiếp phần độc lập · CẤM in `DATABASE_URL`/`GEMINI_API_KEY` ra log hay report · **CẤM chạy `scripts/eval_golden.mjs` hay `probe_defects.mjs`** — chúng đốt hạn mức Gemini của cả đội, SO sẽ tự chạy · giao diện tiếng Việt, tên mã tiếng Anh.

## 5. BẢNG GÓI VIỆC → TẦNG
| Gói | Tầng | Vì sao |
| :-- | :-- | :-- |
| W1 | 🟠 | Có schema và định nghĩa Metric trong SPEC, kết quả đo được |
| W2 | 🟠 | Có SPEC và gate G12 nói rõ điều kiện đạt |
| W3 | 🟠 | Như trên; chọn nguồn số thì ghi lý do |
| W4 | 🔴 | Rubric là định nghĩa "thế nào là đạt" của cả dự án; viết sai là mọi số sau đó vô nghĩa |
| W5 | 🟠 | Viết test theo công thức đã nêu |
| W6 | 🟢 | Chạy lệnh có sẵn, chép số |

## 6. REPORT PHẢI CÓ
Theo `docs/HANDOFF_PROTOCOL.md` §7 tại hub: dòng 1 khai vai + loại + họ/model + Bước 0 exit + hiểu việc bằng lời mình · bảng lệnh + exit code nguyên văn · test tổng/pass/fail/skip · `git diff --stat` + SHA · **bảng phân công thực tế (gói → tầng yêu cầu → model đã dùng)** · việc KHÔNG làm + lý do · câu hỏi cần người. Thiếu dòng khai vai hoặc bảng phân công ⇒ report bị trả lại.

7. DÒNG CUỐI: Report: `planning/01_2026-09-20_resident-agent-v1/reports/R08_thi-cong_p04-eval-dashboard.md` · Evidence: `planning/01_2026-09-20_resident-agent-v1/evidence/p04/<ten-do>.txt`

1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: **THI CÔNG**.
2. Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`. Ghi mã thoát vào report. DỪNG Ở `--check`. Mã 2 ⇒ dừng, báo lên.
3. Đọc theo thứ tự: `specs/SPEC-P04-Eval-Dashboard.md` §3 (dòng 185–240: `actioned`, "Việc treo") và §4 → `lib/adapters/metrics-store.ts` (`AutoResolutionSummary.actioned`, `IntentBreakdownEntry.actioned`, `computeAutoResolutionSummary`, `computeIntentBreakdown`) → `app/(bql)/dashboard/page.tsx` → `tests/metrics.test.ts` → `app/(bql)/eval/page.tsx` (chỉ để biết có panel theo `decision` hay không) → `reports/R23` mục "Việc KHÔNG làm" dòng 2 → `brain4agent/-known-gotchas.md` mục G40 (luật dev server).

## 1. BỐI CẢNH
Repo `D:\build phase`, nhánh `main`, base = `git rev-parse --short HEAD` lúc bắt đầu. P05 (Đ48) thêm `decision='action'` vào `answer_turns`; nguồn số liệu đã tách sẵn `actioned` (R23) nhưng **JSX dashboard `/bql/dashboard` chưa hiện** — giám khảo nhìn dashboard không thấy agent đã thực thi bao nhiêu lượt. Việc treo ghi ở `reports/R23` và `SPEC-P04` §3 "Việc treo".
Số nền: `tsc` 0 · test 236/236 · BB-05/07/10 = 0.

## 2. PHẠM VI
**Được ghi:** `app/(bql)/dashboard/page.tsx` · `app/(bql)/eval/page.tsx` (CHỈ nếu có panel theo `decision` cần thêm dòng `action`) · CSS đang dùng cho BQL (chỉ khi thật sự cần) · `tests/metrics.test.ts` (thêm ca) · `planning/01_2026-09-20_resident-agent-v1/evidence/h23-dashboard-actioned/**` · `planning/01_2026-09-20_resident-agent-v1/reports/R27_thi-cong_p05-dashboard-actioned.md`.
**CẤM chạm:** `lib/**` (kể cả `metrics-store.ts` — số liệu đã đủ; nếu thấy thiếu thì GHI report, không sửa) · `app/(resident)/**`, `app/api/**` · `scripts/**`, `db/**`, `planning/**/specs/**`, `brain4agent/**`, `package.json`.
**CẤM** `git add/commit/push`. **CẤM** hiện `confidence`/`gate_triggered` (`check_no_confidence_ui.sh` phải `matches: 0`). **CẤM** gọi model nào trong dashboard (BB-06). **CẤM** SQL trong `app/`.

## 3. VIỆC PHẢI LÀM
**W1 — Thẻ "Tỉ lệ tự động giải quyết".** Dòng phụ hiện `{auto_resolved}/{total_turns} lượt · clarify … · escalate …` ⇒ thêm `· hành động {auto.actioned}` (đặt trước `clarify`), và một chú thích ngắn: "tự động = trả lời + hành động". **Xong khi:** mở `/dashboard` (DATA_BACKEND=postgres, `.env.local`) trả 200, có chữ "hành động", không `NaN`; lưu output curl (grep dòng liên quan) vào evidence.

**W2 — Bảng "Theo intent".** Thêm cột `action` giữa `answer` và `clarify`, render `row.actioned`. Tổng/tỉ lệ đã tính ở store, KHÔNG tính lại trong JSX. **Xong khi:** `tests/metrics.test.ts` thêm ca: 10 lượt (5 answer, 2 action, 1 clarify, 2 escalate) ⇒ `computeAutoResolutionSummary` cho `actioned=2`, `auto_resolved=7`, `rate=70%`; `computeIntentBreakdown` cho nhóm có `actioned` đúng và `rate_pct` gồm cả action. (Nếu ca này đã tồn tại thì trỏ vào tên ca đó, không viết trùng.)

**W3 — (Chỉ nếu có) panel theo `decision` ở `/eval`.** Nếu `app/(bql)/eval/page.tsx` có bảng liệt kê theo `decision` mà thiếu dòng `action` ⇒ thêm. Không có ⇒ ghi "không áp dụng" trong report.

**W4 — Chứng minh đỏ.** Ca test W2 phải ĐỎ ít nhất một lần (vd tạm sửa kỳ vọng `actioned=1`) rồi xanh; lưu `evidence/h23-dashboard-actioned/red.txt`, `green.txt`.

**W5 — Cổng chung:** `npx tsc --noEmit` 0 · `npm run build` 0 · `node scripts/run_tests.mjs` ≥ 236 + ca mới, 0 fail, 0 skip · `bash scripts/check_no_confidence_ui.sh` `matches: 0` · `bash scripts/check_adapter_boundary.sh` `violations: 0`. Lưu output vào evidence. Để kiểm W1 thật: **kiểm `netstat -ano | findstr :31` trước, KHÔNG được có dev server nào khác đang chạy** (G40); xoá `.next` rồi `npm run dev -- --port 3105`, lấy cookie BQL (mẫu `evidence/h15-chat-ui/make_cookie.mjs` — xem cách sinh cookie cho vai `bql`), `curl` `/dashboard`; **xong thì tắt server của mình** (`taskkill`) trước khi report. Nếu không dựng được server ⇒ ghi rõ lỗi nguyên văn, dùng `npm run build` + test làm bằng chứng thay thế và nói rõ đó là bằng chứng thay thế.

## 4. LUẬT
Sửa tối thiểu, theo mẫu JSX/CSS đang có (`metrics-card`, `metrics-table`). Chữ cho BQL bằng tiếng Việt, không thuật ngữ nội bộ (SPEC, fixture). Thấy việc ngoài phạm vi ⇒ GHI vào report. Không để lại tiến trình nền nào khi report.

## 5. TẦNG
W1 🟢 · W2 🟠 · W3 🟢 · W4 🟢 · W5 🟢.

## 6. REPORT
Ghi `reports/R27_thi-cong_p05-dashboard-actioned.md` đúng mẫu K.4 (dòng 1 khai vai; dòng 2–4 `Handoff:`/`Base:`/`Head:`; lệnh + exit code nguyên văn; test tổng/pass/fail/skip; `git diff --stat`; bảng phân công; việc KHÔNG làm; câu hỏi cần người; dòng cuối ✅/🔁/⛔).

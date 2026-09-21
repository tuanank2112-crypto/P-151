1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: **THẨM ĐỊNH**.
2. Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`. **DỪNG Ở `--check`** — ghi mã thoát vào report rồi đi tiếp. CẤM chạy chế độ GHI (nó sửa đúng thứ bạn đang thẩm định). Mã 2 ⇒ dừng, báo.
3. Đọc theo thứ tự: `planning/01_2026-09-20_resident-agent-v1/plan.md` §2 (đặc biệt Đ07, Đ24, Đ28, Đ34) → `specs/00-ARCHITECTURE.md` → `specs/01-CONTRACTS.md` §3.4 + §5 → `specs/SPEC-P02-Agent-Pipeline.md` §6, §9, §10 → `specs/SPEC-P03-BQL-Console.md` → `specs/SPEC-P04-Eval-Dashboard.md`. Không đọc gì khác trước khi ghi dòng "hiểu việc".

## 1. BỐI CẢNH
Repo `D:\build phase`, nhánh `main`. **Trước: `7956ccc` → Sau: `31338ed`.** Bốn commit cần soi: `c27015f` (BB-11 ghi `answer_turns`), `345b647` (P03 console BQL), `ed326c4` (P04 eval + dashboard), `31338ed` (chỉ tài liệu).
**BẠN KHÔNG ĐƯỢC CẤP report hay handoff của ba worker đã làm phần này.** Đừng đi tìm `reports/R06`, `R07`, `R08` — nếu vô tình mở, dừng đọc ngay và ghi vào report rằng đã tránh. Nhiệm vụ của bạn là **làm đỏ**, không phải xác nhận lời kể của ai.
Số đo nền tại `31338ed` (SO tự đo, bạn phải đo lại chứ đừng tin dòng này): `npx tsc --noEmit` exit 0 · `npm run build` exit 0 · `node scripts/run_tests.mjs` 113 pass / 0 fail / 0 skip · ba script `check_*.sh` đều 0.
DB Supabase đang sống, đã seed: 19 documents · 98 sections · 98 chunks · 2 users. `DATABASE_URL` trong `.env.local`.

## 2. PHẠM VI
**CHỈ ĐỌC + chạy lệnh đo.** CẤM ghi bất kỳ file nào NGOÀI report và evidence của chính handoff này. CẤM `git add`/`commit`/`push`/`stash`/`checkout`/`reset`.
Được phép sửa file tạm ĐỂ PHÁ rồi **hoàn nguyên ngay** (`git checkout -- <file>` bị cấm; dùng bản sao `.bak` tự tạo và chép ngược). Sau mỗi phép phá, kiểm `git status --short` phải trở lại đúng trạng thái đầu — dán bằng chứng đó vào report.
CẤM chạy `scripts/eval_golden.mjs` và `scripts/probe_defects.mjs` — hạn mức Gemini đang cạn, SO tự chạy. Bạn được gọi Gemini tối đa **3 lượt** cho toàn bộ gói, và chỉ khi thật sự không có cách đo nào khác.

## 3. VIỆC PHẢI LÀM
A — **Chạy lại mọi cổng**, ghi exit code nguyên văn: `npx tsc --noEmit` · `npm run build` · `node scripts/run_tests.mjs` · `check_adapter_boundary.sh` · `check_no_confidence_ui.sh` · `check_no_hardcoded_knowledge.sh` · `validate_knowledge.mjs` · `validate_golden.mjs`.
B — So `git diff --stat 7956ccc..31338ed` với ba vùng phạm vi: BB-11 = `lib/adapters/{db,store-mock}.ts` + `lib/pipeline/index.ts` + `app/api/chat/route.ts` + `tests/memory.test.ts`; P03 = `app/(bql)/{documents,review}/**` + `lib/adapters/bql-store.ts` + `tests/bql-*.test.ts`; P04 = `app/(bql)/{eval,dashboard}/**` + `lib/adapters/metrics-store.ts` + `evals/golden/rubric.md` + `tests/metrics.test.ts`. File nào rơi ngoài cả ba ⇒ nêu đích danh.
C — **Tự thiết kế ≥3 cách phá KHÁC HÌNH DẠNG nhau** cho bất biến **P02-C10** (*"mỗi lượt ghi ĐÚNG MỘT dòng `answer_turns`, kể cả nhánh escalate và nhánh ném lỗi"*). Gợi ý về hình dạng, không phải danh sách phải làm: nhánh ném lỗi giữa chừng · ghi hai lần · ghi rồi rollback · lượt bị chặn ngay chặng 1. Ghi rõ cách nào làm test ĐỎ, cách nào **lọt qua** — chỗ lọt qua mới là phát hiện có giá trị.
D — **Đ34, phép đo quan trọng nhất của gói này.** Hiện có HAI cài đặt cùng chấm một ca Golden: `scripts/eval_golden.mjs` và hàm chấm trong `lib/adapters/metrics-store.ts`. Hãy **chứng minh bằng số** chúng đồng ý hay lệch: dựng đầu vào giả cho cùng một ca (không gọi model), chạy qua cả hai đường, so từng `checkpoint_*` và `verdict`. Tìm ít nhất một ca chúng ra kết quả KHÁC nhau. Tìm được ⇒ đó là phát hiện lớn nhất của bạn; không tìm được sau khi đã thử ≥5 ca khác hình dạng ⇒ nói rõ đã thử những ca nào.
E — **Bộ đo mới phải từng ĐỎ.** Với `tests/{memory,metrics,bql-review,bql-authz}.test.ts`: tự phá phần mã mà mỗi bộ được cho là canh, xác nhận nó đỏ **đúng nhóm của nó** và **không đỏ nhóm khác**. Bộ nào xanh cả khi đã phá ⇒ bộ đo giả, nêu đích danh.
F — Soi `evals/golden/rubric.md`: công thức có khớp `SPEC-P04` và `SPEC-P00` §6 không; ngưỡng `G11` (`M1 ≥ 34/40`, `M3 ≥ 15/16`) có đúng không; có chỗ nào hứa một con số mà không nói lấy ở đâu không.

## 4. LUẬT
Không đọc lời kể của worker · phán bằng số đo, không bằng cảm giác · không sửa gì để "cho nó chạy" · mã thoát 2 = dừng hỏi · CẤM in `DATABASE_URL`/`GEMINI_API_KEY` · report tiếng Việt, tên mã tiếng Anh · thấy việc ngoài phạm vi thì GHI LẠI, không tự làm.

## 5. TẦNG
🔴 cho mục C và D (chạm bất biến BB-11 và định nghĩa "thế nào là đạt" của cả dự án). 🟠 cho A, B, E, F. Khác họ model với worker khi có thể; ba gói kia làm bằng Sonnet.

## 6. REPORT PHẢI CÓ
Dòng 1 khai vai + loại (thẩm định) + họ/model + Bước 0 exit + hiểu việc bằng lời mình · bảng lệnh + exit code nguyên văn · **bảng cách phá đã thử → kết quả (đỏ / lọt qua)** · kết luận mục D kèm số · danh sách bộ đo giả nếu có · `git status --short` chứng minh cây trở lại nguyên trạng · việc KHÔNG làm + lý do · câu hỏi cần người. Dòng CUỐI là phán quyết của bạn: `✅ DUYỆT` · `🔁 SỬA: <mục>` · `⛔ DỪNG: <vì sao>`.

7. DÒNG CUỐI: Report: `planning/01_2026-09-20_resident-agent-v1/reports/R09_tham-dinh_wave1.md` · Evidence: `planning/01_2026-09-20_resident-agent-v1/evidence/tham-dinh-wave1/<ten-do>.txt`

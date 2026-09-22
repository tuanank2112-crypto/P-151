# R21 — THI CÔNG — 10 deliverables BTC + kịch bản demo + bộ hook AI-log

Vai: worker (vai-thi-cong) · loại: THI CÔNG · họ/model: claude-sonnet-5 · Bước 0: exit 0 · hiểu việc: phạm vi = tạo mới README/architecture_diagram/JOURNAL/WORKLOG/eval-report/presentation/bộ hook AI-log (nguyên văn từ origin/feature/truong) + 3 dòng .env.example + dòng .gitignore, CẤM chạm app/**, lib/**, scripts/*.mjs, tests/**, db/** đã tồn tại, CẤM git add/commit/push, CẤM chạy setup_hooks.*
Handoff: `planning/01_2026-09-20_resident-agent-v1/handoffs/H18_deliverables-btc-kich-ban-demo.md`
Base: `e8aa9f0`
Head: (working tree, chưa commit)

## Bước 0
```
node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check
EXIT_CODE=0
```
NÃO ĐÃ OK — KHÔNG CẦN NÂNG CẤP THÊM.

## Lệnh đã chạy + exit code nguyên văn

```
$ npx tsc --noEmit
(không có lỗi)
tsc exit=0
```
(evidence: `evidence/h18-deliverables/tsc.txt`)

```
$ npm run build   (sau rm -rf .next, chạy lúc app/** đang bị gói khác sửa dở song song)
Compiled successfully in 10.6s
Linting and checking validity of types ...
Error PageNotFoundError: Cannot find module for page: /api/auth/logout
build exit=1
```
(evidence: `evidence/h18-deliverables/build.txt`) — KHÔNG phải lỗi của gói này.
`app/api/conversations/`, `app/(bql)/review/queue-logic.ts` và
`lib/adapters/db.ts` đang được một gói khác sửa dở cùng lúc (xem
`git status --short` bên dưới, các dòng bắt đầu bằng khoảng trắng + M) — build
route collection vấp đúng lúc file đang ghi dở. `tsc --noEmit` (không phụ
thuộc build cache) xanh sạch. Không thuộc phạm vi của handoff này để sửa
(app/** bị cấm chạm).

```
$ bash scripts/check_no_hardcoded_knowledge.sh
matches: 0
exit=0
```
(evidence: `evidence/h18-deliverables/check_no_hardcoded_knowledge.txt`)

```
$ python scripts/log_hook.py --tool=claude < /dev/null
(không lỗi)
exit=0
```
(evidence: `evidence/h18-deliverables/log_hook_run.txt`; lưu ý trên Windows Git
Bash lệnh chuẩn phải là `python`, không phải `python3` — `python3` không có
trong PATH máy này, đã đo bằng `which`)

Diff nguyên văn cả 15/15 file hook chép từ `origin/feature/truong`: tất cả
**IDENTICAL** (log_hook.py, log_manual.py, log_antigravity.py, submit_log.py,
_pyrun.sh, _pyrun.cmd, setup_hooks.sh, setup_hooks.ps1, .codex/hooks.json,
.cursor/hooks.json, .gemini/settings.json, .github/hooks/hooks.json,
.agents/hooks.json, .agents/rules/ai-log-hook.md, .agents/workflows/log.md).

```
$ grep -c "docs/OVERVIEW.md" README.md
8
```
Đạt điều kiện xong W1 (từ 1 trở lên).

```
$ grep -c mermaid-open docs/architecture_diagram.md (đếm khối mở/đóng)
3 khối mở · 3 khối đóng
```
Khớp — W2 đạt.

## Test tổng/pass/fail/skip
Không chạm `tests/**`, không chạy `npm test` cho gói này — phạm vi gói là
tài liệu/deliverables, không đổi logic. Số test hiện tại của repo (nguồn
`docs/OVERVIEW.md`, do gói khác đo/duy trì) không nằm trong "xong khi" của
handoff này.

## git diff --stat + SHA (phần thuộc phạm vi gói này)

```
.env.example | 7 insertions
.gitignore   | 4 insertions
2 files changed, 11 insertions
```
HEAD hiện tại: `e8aa9f0` (chưa commit gì trong phiên này — đúng luật CẤM
git add/commit/push của handoff).

`git status --short` nguyên văn tại lúc chốt report (các dòng sửa file có
sẵn KHÔNG phải do gói này, thuộc 3 gói đang sửa song song app/**,
lib/adapters/db.ts, tests/** như đã cảnh báo trước khi nhận việc):

```
 M .env.example
 M .gitignore
 M app/(bql)/layout.tsx
 M app/(bql)/review/ReviewQueueList.tsx
 M app/(resident)/chat/page.tsx
 M app/globals.css
 M docs/OVERVIEW.md
 M lib/adapters/bql-store.ts
 M lib/adapters/db.ts
 M lib/adapters/store-mock.ts
 M tests/conflict-citations.test.ts
 M tests/conversation-id.test.ts
 M tests/eval-golden-injection.test.ts
 M tests/memory.test.ts
?? .agents/hooks.json
?? .agents/rules/
?? .agents/workflows/
?? .ai-log/
?? .codex/
?? .cursor/
?? .gemini/
?? .github/
?? JOURNAL.md
?? README.md
?? WORKLOG.md
?? app/(bql)/review/queue-logic.ts        [KHÔNG PHẢI của gói này]
?? app/api/conversations/                  [KHÔNG PHẢI của gói này]
?? docs/architecture_diagram.md
?? eval/
?? evidence/                                [KHÔNG PHẢI của gói này, có sẵn]
?? planning/01_2026-09-20_resident-agent-v1/evidence/h15-chat-ui/   [KHÔNG PHẢI của gói này]
?? planning/01_2026-09-20_resident-agent-v1/evidence/h18-deliverables/  [CỦA gói này]
?? planning/01_2026-09-20_resident-agent-v1/handoffs/H18_deliverables-btc-kich-ban-demo.md
?? presentation/
?? scripts/_pyrun.cmd
?? scripts/_pyrun.sh
?? scripts/demo_r7.mjs                     [KHÔNG PHẢI của gói này]
?? scripts/log_antigravity.py
?? scripts/log_hook.py
?? scripts/log_manual.py
?? scripts/setup_hooks.ps1
?? scripts/setup_hooks.sh
?? scripts/submit_log.py
?? tests/_pg-cleanup.ts                    [KHÔNG PHẢI của gói này]
?? tests/chat-history.test.ts              [KHÔNG PHẢI của gói này]
?? tests/hitl-enqueue.test.ts              [KHÔNG PHẢI của gói này]
```

File thật sự do gói này tạo/sửa: `.env.example` (sửa), `.gitignore` (sửa),
`README.md`, `JOURNAL.md`, `WORKLOG.md`, `docs/architecture_diagram.md`,
`eval/results/report.md`, `presentation/README.md`,
`presentation/demo_script.md`, `scripts/log_hook.py`, `scripts/log_manual.py`,
`scripts/log_antigravity.py`, `scripts/submit_log.py`, `scripts/_pyrun.sh`,
`scripts/_pyrun.cmd`, `scripts/setup_hooks.sh`, `scripts/setup_hooks.ps1`,
`.ai-log/.gitkeep`, `.codex/hooks.json`, `.cursor/hooks.json`,
`.gemini/settings.json`, `.github/hooks/hooks.json`, `.agents/hooks.json`,
`.agents/rules/ai-log-hook.md`, `.agents/workflows/log.md`,
`planning/01_2026-09-20_resident-agent-v1/evidence/h18-deliverables/*`.

## Bảng phân công thực tế

| Gói | Tầng yêu cầu | Họ/model đã dùng |
| :-- | :-- | :-- |
| W1 README.md | Cam | claude-sonnet-5 |
| W2 docs/architecture_diagram.md | Xanh | claude-sonnet-5 |
| W3 JOURNAL.md + WORKLOG.md | Xanh | claude-sonnet-5 |
| W4 eval/results/report.md | Cam | claude-sonnet-5 |
| W5 presentation/README.md + demo_script.md | Cam | claude-sonnet-5 |
| W6 Bộ hook AI-log (14/15 file) | Xanh | claude-sonnet-5 |
| W7 Cổng chung | Xanh | claude-sonnet-5 |

## Việc KHÔNG làm + lý do

1. **`.claude/settings.json` KHÔNG tạo được.** Cả Bash (redirect) lẫn Write
   đều bị bộ phân loại auto-mode của Claude Code từ chối với lý do
   `[Self-Modification]` — sửa cấu hình chính công cụ đang chạy phiên này.
   Đây không phải quyết định tự chọn, là giới hạn quyền cấp trên. 14/15 file
   hook còn lại đã chép xong, nguyên văn, đã diff xác nhận IDENTICAL. Nội dung
   đúng cần ghi (đã xác minh từ origin/feature/truong, khối hooks JSON UserPromptSubmit
   gọi `bash scripts/_pyrun.sh scripts/log_hook.py --tool=claude` với shell bash)
   — **cần tay người tạo file này**, copy nguyên văn từ
   `git show origin/feature/truong:.claude/settings.json`.
2. **`npm run build` không đo được sạch.** Chạy 2 lần, cả 2 lần lỗi khác nhau
   (`PageNotFoundError` ở `/_document` rồi `/api/auth/logout`) — trùng đúng
   lúc 3 gói khác đang sửa `app/(bql)/review/`, `app/api/conversations/`,
   `lib/adapters/db.ts`. `tsc --noEmit` (không phụ thuộc Next build cache)
   xanh sạch, dùng làm bằng chứng thay thế. Đề nghị người điều phối chạy lại
   `npm run build` sau khi 3 gói song song commit xong.
3. **Không chạy `npm test`.** Phạm vi gói không đổi tests/**/logic, số test
   hiện tại do gói khác duy trì; không có "xong khi" nào của handoff này đòi
   con số test.
4. **Team / Ask trong `presentation/README.md` và `README.md` để `[điền]`.**
   Không có tên thật/vai trò thành viên xác nhận trong bất kỳ file nào đọc
   được (chỉ có git author). Không bịa theo luật CẤM của handoff mục 4.
5. **Số M1/M3 trong `eval/results/report.md` lấy đúng số phiên 2026-09-23 ghi
   trong today.md** (2.5%/12.5%), có ghi chú rõ đây là hai thời điểm đo khác
   nhau với lượt safety 2026-09-22 (11/16) — không gộp làm một, tránh hiểu lầm.

## Câu hỏi cần người

1. **`.claude/settings.json`** — ai đó có quyền ghi cấu hình Claude Code cần
   tự tạo file này (nội dung ở mục "Việc KHÔNG làm" #1) rồi chạy
   `bash scripts/setup_hooks.sh` MỘT LẦN sau khi review xong (handoff cấm tôi
   tự chạy setup).
2. **`AI_LOG_API_KEY` ở Phoenix** — theo mẫu origin/feature/truong, mỗi thành
   viên tự tạo key riêng tại dashboard Phoenix. Không có thông tin ai là
   người phụ trách lấy key trong repo — cần người chỉ định.
3. **Tên thật/vai trò thành viên** — README.md và presentation/README.md
   đang để `[điền]` cho vai trò của lenq/TruonghocAI/thành viên feature/tri.
   Cần xác nhận để điền đúng, tránh bịa.
4. **npm run build đỏ hiện tại** — có phải do 3 gói song song chưa commit xong
   hay là lỗi thật cần vá? Đề nghị người điều phối xác nhận sau khi các gói
   kia hoàn tất.

Phán quyết: 🔁 SỬA: cần tay người tạo `.claude/settings.json` (mục "Việc KHÔNG làm" #1) trước khi coi W6 là xong hoàn toàn; W1–W5 và phần khả đo của W7 đã có đủ số đo như trên.

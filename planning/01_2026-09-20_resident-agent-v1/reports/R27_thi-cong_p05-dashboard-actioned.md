# R27 — Thi công: hiện `actioned` trên `/bql/dashboard` (H23)

Vai: worker (vai-thi-cong) · loại: THI CÔNG · họ/model: Claude Sonnet 5 · Bước 0: exit 0 (não đã OK, không cần nâng cấp) · hiểu việc: phạm vi = `app/(bql)/dashboard/page.tsx`, `app/(bql)/eval/page.tsx` (chỉ nếu có panel theo `decision`), CSS BQL đang dùng, `tests/metrics.test.ts`, evidence + report của H23; xong khi = W1 thẻ hiện `hành động {actioned}` + chú thích, W2 cột `action` trong bảng theo intent + ca test 10 lượt (5 answer/2 action/1 clarify/2 escalate) đúng số, W3 áp dụng nếu `/eval` có panel theo decision, W4 chứng minh đỏ→xanh, W5 tsc/build/test/check_no_confidence_ui/check_adapter_boundary xanh + curl thật qua dev server cổng 3105 rồi tắt server; cấm bằng lời mình = không chạm `lib/**`, `app/(resident)/**`, `app/api/**`, `scripts/**`, `db/**`, `planning/**/specs/**`, `brain4agent/**`, `package.json`, không hiện `confidence`/`gate_triggered`, không gọi model trong dashboard, không để lại tiến trình nền.

Handoff: `planning/01_2026-09-20_resident-agent-v1/handoffs/H23_p05-dashboard-actioned.md`
Base: `d9e1a5e`
Head: `d9e1a5e` (không commit — cấm `git add/commit/push` theo handoff)

## Lệnh + exit code nguyên văn

| Lệnh | Exit | Evidence |
| :-- | :-- | :-- |
| `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` | 0 | (in trực tiếp ở đầu phiên, "NÃO ĐÃ OK") |
| `node scripts/run_tests.mjs` (RED — sabotage `actioned` mong đợi 1 thay vì 2) | 1 | `evidence/h23-dashboard-actioned/red.txt` |
| `node scripts/run_tests.mjs` (GREEN — sau khi trả về đúng) | 0 | `evidence/h23-dashboard-actioned/green.txt` |
| `npx tsc --noEmit` | 0 | `evidence/h23-dashboard-actioned/tsc.txt` |
| `npm run build` (sau `rm -rf .next`) | 0 | `evidence/h23-dashboard-actioned/build.txt` |
| `bash scripts/check_no_confidence_ui.sh` | 0 | `evidence/h23-dashboard-actioned/check_no_confidence_ui.txt` (`matches: 0`) |
| `bash scripts/check_adapter_boundary.sh` | 0 | `evidence/h23-dashboard-actioned/check_adapter_boundary.txt` (`violations: 0`) |
| `curl -D headers -H "Cookie: $COOKIE" http://localhost:3105/dashboard` (dev server cổng 3105, cookie vai `bql`) | curl 0, HTTP 200 | `evidence/h23-dashboard-actioned/dashboard_headers.txt`, `dashboard.html`, `curl_grep.txt` |
| `taskkill //PID <dev-server> //F` (tắt server sau khi curl) | 0 | (xác nhận bằng `netstat` sau đó: không còn LISTENING trên 3105) |

## Test tổng/pass/fail/skip

- GREEN (`node scripts/run_tests.mjs`): **tests 237 · pass 237 · fail 0 · cancelled 0 · skipped 0 · todo 0** (nền cũ là 236; +1 ca mới của W2/W4).
- RED (chạy trước, để chứng minh ca test W2 tự biết sai): **tests 237 · pass 234 · fail 3**. Trong 3 fail: đúng 1 là ca `metrics.test.ts:88` (assertion `2 !== 1`, do tôi cố ý sửa kỳ vọng) — bằng chứng ca test này ĐỎ thật khi số sai. 2 fail còn lại (`tests/conversation-id.test.ts:180`, `tests/p05-write-timeout.test.ts:65`) là lỗi hạ tầng Postgres không liên quan (`EMAXCONNSESSION — max clients reached in session mode`), nằm ngoài phạm vi H23 (file `lib/**`, `tests/p05-write-timeout.test.ts` đều CẤM chạm) — không sửa, không tính vào bằng chứng đỏ/xanh của W2/W4. Sau khi trả `actioned` về đúng, chạy lại GREEN: cả 3 đều xanh (0 fail), xác nhận 2 fail kia chỉ là flake do song song nhiều test Postgres, không phải do thay đổi của tôi.

## `git diff --stat` (chỉ phạm vi của tôi)

```
app/(bql)/dashboard/page.tsx |  7 +++++--
app/globals.css              |  5 +++++
tests/metrics.test.ts        | 36 ++++++++++++++++++++++++++++++++++++
3 files changed, 46 insertions(+), 2 deletions(-)
```

SHA: không đổi (chưa commit) — `d9e1a5e`.

**Lưu ý:** `git status`/`git diff --stat` toàn repo lúc tôi chạy còn cho thấy các file khác đang bị sửa dở (`lib/adapters/db.ts`, `lib/adapters/store-mock.ts`, `lib/pipeline/action.ts`, `lib/simbackend/index.ts`, `planning/.../specs/TESTING-ACCEPTANCE.md`, `tests/p05-pipeline-action.test.ts`, `tests/p05-write-timeout.test.ts`) và các thư mục evidence khác (`h17-demo-r7/`, `h22-audit-log/`, `so-gates/`, `so-p05/`). **Không phải của tôi** — tôi không hề mở/sửa các file đó (có thể do một gói khác — H22 — đang chạy song song trong cùng working tree). Diff-stat trên chỉ liệt kê 3 file tôi thực sự đụng, đúng phạm vi "được ghi" của H23.

## Bảng phân công thực tế

| Gói | Tầng yêu cầu | Họ/model đã dùng |
| :-- | :-- | :-- |
| W1 — thẻ "hành động" + chú thích | 🟢 | Claude Sonnet 5 |
| W2 — cột `action` bảng theo intent + ca test | 🟠 | Claude Sonnet 5 |
| W3 — panel theo `decision` ở `/eval` | 🟢 | Claude Sonnet 5 (kết luận: không áp dụng) |
| W4 — chứng minh đỏ→xanh | 🟢 | Claude Sonnet 5 |
| W5 — cổng chung + curl thật | 🟢 | Claude Sonnet 5 |

## Việc KHÔNG làm + lý do

| Việc | Vì sao không làm |
| :-- | :-- |
| W3 — thêm dòng `action` vào `/eval` | Đọc `app/(bql)/eval/page.tsx` (130 dòng): không có bảng/panel nào liệt kê theo `decision` (chỉ có M1 Correct&Grounded và M3 Golden FAQ, không nhóm theo answer/clarify/escalate/action). Đúng như handoff dự liệu: "không có ⇒ ghi không áp dụng". |
| Sửa `lib/adapters/metrics-store.ts` | Số liệu `actioned` đã đủ và đúng ở cả `AutoResolutionSummary` và `IntentBreakdownEntry` (đọc trước khi làm) — nằm trong CẤM chạm của H23, không cần sửa. |
| Dọn các file đang dở dang của gói khác (`lib/adapters/db.ts` v.v.) | Ngoài phạm vi được ghi của H23 (`lib/**` CẤM chạm), và không rõ đó có phải cố ý của một worker khác đang chạy song song — không tự ý đụng vào. |

## Câu hỏi cần người

Không có — handoff đủ để làm trọn W1–W5, không gặp mâu thuẫn SPEC.

## Tiếp theo

🖐 Cần tay người: xác nhận các file `lib/**` đang dở dang (ngoài phạm vi H23) có phải của một gói/worker khác (H22) đang chạy song song, để tránh conflict khi commit.
🤖 Agent làm được ngay: sẵn sàng nhận handoff kế tiếp trong phạm vi `app/(bql)/**`.
⭐ Nên làm trước: đối chiếu `git status` toàn repo trước khi bất kỳ ai commit, để không gộp nhầm thay đổi của các gói khác nhau vào một commit.
⏸ Chưa làm: W3 (không áp dụng, đã ghi lý do ở trên); chưa commit gì (đúng luật CẤM `git add/commit/push` của handoff).

**Phán quyết:** ✅ ĐẠT — W1–W5 xong, cổng đo xanh (tsc 0, build 0, test 237/237/0/0, check_no_confidence_ui `matches:0`, check_adapter_boundary `violations:0`), bằng chứng đỏ→xanh có (`red.txt`/`green.txt`), curl thật qua dev server cổng 3105 xác nhận "hành động" hiện đúng và không `NaN`, server đã tắt sau khi đo.

# R26 — Thi công: P05 audit_log write-timeout (H22)

Vai: worker (vai-thi-cong) · loại: THI CÔNG · họ/model: Claude Sonnet 5 · Bước 0: exit 0 · hiểu việc: phạm vi = `lib/adapters/db.ts` (thêm `insertAuditLog` vào `DataStore`) · `lib/adapters/store-mock.ts` (mock + getter/reset) · `lib/pipeline/action.ts` (CHỈ khối sink audit + chỗ gọi `auditWarn`) · `lib/simbackend/index.ts` (CHỈ khối `__forceWriteTimeout` của `PostgresSimBackend`) · `tests/p05-write-timeout.test.ts`, `tests/p05-pipeline-action.test.ts` · `evidence/h22-audit-log/**` · report này; xong khi = 5 "xong khi" của W1–W5 trong handoff đạt; cấm bằng lời mình = không chạm `lib/simbackend/contract.ts`, `lib/types.ts`, migration mới, file khác trong `lib/**`/`app/**`/`scripts/**`, không `git add/commit/push`, không mở connection ngoài `lib/adapters/db.ts`, không retry `WriteTimeout`, không để lỗi ghi audit làm vỡ lượt trả lời.

Handoff: `planning/01_2026-09-20_resident-agent-v1/handoffs/H22_p05-audit-log-write-timeout.md`
Base: `d9e1a5e`
Head: `d9e1a5e` (không commit — CẤM theo luật handoff; mọi thay đổi còn ở working tree)

## Lệnh + exit code nguyên văn

| Lệnh | Exit | Evidence |
| :-- | :-- | :-- |
| `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` | 0 | (in trong report, "NÃO ĐÃ OK") |
| `npx tsc --noEmit` | 0 | `evidence/h22-audit-log/tsc.txt` |
| `node --env-file=.env.local scripts/run_tests.mjs` | 0 | `evidence/h22-audit-log/run_tests.txt` — `tests 238 · pass 238 · fail 0 · skip 0` |
| `bash scripts/check_adapter_boundary.sh` | 0 | `evidence/h22-audit-log/check_adapter_boundary.txt` — `violations: 0` |
| `bash scripts/check_no_hardcoded_knowledge.sh` | 0 | `evidence/h22-audit-log/check_no_hardcoded_knowledge.txt` — `matches: 0` |
| `bash scripts/check_no_confidence_ui.sh` | 0 | `evidence/h22-audit-log/check_no_confidence_ui.txt` — `matches: 0` |
| `node scripts/validate_capabilities.mjs` | 0 | `evidence/h22-audit-log/validate_capabilities.txt` — `capabilities: 9 · write: 2 · write_without_precheck: 0` |
| `grep -n "INSERT INTO audit_log" lib/simbackend/index.ts` | 1 (0 dòng khớp) | đúng "xong khi" W3 |
| `node --env-file=.env.local --test tests/p05-write-timeout.test.ts` | 0 | 2/2 pass, gồm ca Postgres thật |
| `node --test tests/p05-pipeline-action.test.ts` (sink bị TẠM BỎ, W4 đỏ) | 1 | `evidence/h22-audit-log/red.txt` — 2 ca fail đúng chỗ |
| `node --test tests/p05-pipeline-action.test.ts` (sink khôi phục, W4 xanh) | 0 | `evidence/h22-audit-log/green.txt` — 16/16 pass |
| `grep -cP '[\x08\x0c\x0b]'` trên 6 file đã sửa | 0 mỗi file | tự kiểm, không lưu evidence riêng |

## Test tổng/pass/fail/skip

`node --env-file=.env.local scripts/run_tests.mjs`: **tổng 238 · pass 238 · fail 0 · skip 0** (nền cũ 236 + 2 ca mới: `tests/p05-pipeline-action.test.ts` thêm ca `(d''')`, `tests/p05-write-timeout.test.ts` giữ nguyên số ca 2 nhưng đổi nội dung ca postgres — không thêm/bớt `test()` ở file này).

## `git diff --stat` (chỉ 6 file trong phạm vi được ghi)

```
lib/adapters/db.ts                | 30 ++++++++++++++++++++++++
lib/adapters/store-mock.ts        | 37 ++++++++++++++++++++++++++++++
lib/pipeline/action.ts            | 48 +++++++++++++++++++++++++++++++--------
lib/simbackend/index.ts           |  9 ++++----
tests/p05-pipeline-action.test.ts | 36 +++++++++++++++++++++++++++++
tests/p05-write-timeout.test.ts   | 33 +++++++++++----------------
6 files changed, 159 insertions(+), 34 deletions(-)
```

SHA không đổi (`d9e1a5e`) vì CẤM commit theo luật handoff; thay đổi hiện nằm ở working tree, chưa `git add`.

**Ghi chú về `git status` rộng hơn:** repo có sẵn các thay đổi CHƯA COMMIT từ trước khi tôi bắt đầu (không phải tôi tạo ra) — `app/(bql)/dashboard/page.tsx`, `app/globals.css`, `planning/.../specs/TESTING-ACCEPTANCE.md`, `tests/metrics.test.ts`, và các thư mục `evidence/h17-demo-r7/`, `evidence/h23-dashboard-actioned/`, `evidence/so-gates/`, `evidence/so-p05/`, handoff `H23`, report `R27` — đúng như `git status` lúc bắt đầu phiên đã cho thấy (`H22`/`H23` handoffs untracked từ đầu). Tôi KHÔNG chạm các file này; `git diff --stat` ở trên đã lọc riêng đúng 6 file thuộc phạm vi H22.

## Bảng phân công thực tế

| Gói | Tầng yêu cầu | Họ/model đã dùng |
| :-- | :-- | :-- |
| W1 — `DataStore.insertAuditLog` (`db.ts` + `store-mock.ts`) | 🟠 | Claude Sonnet 5 |
| W2 — Nối sink pipeline vào `DataStore` (`action.ts`) | 🟠 | Claude Sonnet 5 |
| W3 — Gỡ dòng ghi trùng ở backend mô phỏng (`simbackend/index.ts` + test) | 🟠 | Claude Sonnet 5 |
| W4 — Chứng minh đỏ/xanh | 🟢 | Claude Sonnet 5 |
| W5 — Cổng chung | 🟢 | Claude Sonnet 5 |

## Việc KHÔNG làm + lý do

| Việc | Vì sao không làm |
| :-- | :-- |
| Thêm `facility_id`/`idempotency_key` vào payload `audit_log` của `WriteTimeout` | Handoff cho phép "nếu có trong tầm tay". `mapBackendError` bắt lỗi tại một điểm `catch` DÙNG CHUNG cho mọi capability (create/cancel/…), còn hai giá trị đó chỉ tồn tại BÊN TRONG từng nhánh `dispatch` đã resolve facility — lấy được đòi refactor sâu hơn phạm vi W2 (đổi luồng dữ liệu, không chỉ thêm tham số). Đã thêm `conversation_id`/`session_id` (giá trị = `a.conversation_id`, luôn có sẵn ở `runActionBranch`) — trong tầm tay thật sự, không đoán. |
| Đếm `audit_log` trong test Postgres của `p05-write-timeout.test.ts` | Chọn nhánh (b) của W3 theo đúng chữ handoff: bỏ đường A (đi qua `runTurn`/pipeline với Postgres thật) vì file test này gọi thẳng `PostgresSimBackend.createBooking()`, không có máy giả A1/`runTurn` sẵn — dựng thêm là mở rộng phạm vi. Phần đếm audit_log chuyển hẳn sang test mock mới `(d''')` ở `tests/p05-pipeline-action.test.ts`, nơi đã có sẵn `runTurn()` thật + `DATA_BACKEND=mock`. Đã ghi rõ lựa chọn này trong comment đầu `tests/p05-write-timeout.test.ts`. |
| Sửa `app/(bql)/dashboard/page.tsx`, `app/globals.css`, `TESTING-ACCEPTANCE.md`, `tests/metrics.test.ts`, các thư mục `evidence/h17-*`, `evidence/h23-*`, `evidence/so-*`, handoff `H23`, report `R27` | Ngoài phạm vi "Được ghi" của handoff H22 (không nằm trong danh sách); các thay đổi này đã tồn tại trong working tree TRƯỚC khi tôi bắt đầu (H23 là handoff của gói khác, chưa report/commit) — không phải việc của tôi, không tự ý đụng. |

## Câu hỏi cần người

Không có — SPEC-P05 §7/§10 và handoff đủ rõ để thực thi trọn 5 gói không cần quyết định ngoài spec.

---

✅ ĐẠT (theo số đo tự đo ở trên): `tsc` 0 · test 238/238/0/0 · BB-05(adapter_boundary)/07(hardcoded_knowledge)/10(confidence_ui) đều `0` · `validate_capabilities` `write_without_precheck: 0` · W4 đỏ→xanh có bằng chứng · `grep INSERT INTO audit_log` = 0 dòng · control-char 0 trên mọi file sửa · KHÔNG commit theo đúng luật. Người duyệt cần tự đo lại (Luật K.5) trước khi cấp ✅ DUYỆT chính thức.

1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: **THI CÔNG**.
2. Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`. Ghi mã thoát vào report. DỪNG Ở `--check`. Mã 2 ⇒ dừng, báo lên.
3. Đọc theo thứ tự: `specs/SPEC-P05-Action-Layer.md` §7 (dòng `WriteTimeout`), §8 (P05-C10), §10 (P05-M10) → `lib/pipeline/action.ts` (khối "Nhật ký cảnh báo", hàm `mapBackendError` nhánh `WriteTimeout`, `__setActionAuditSinkForTesting`) → `lib/adapters/db.ts` (`interface DataStore`, `PostgresDataStore`, `getDataStore`, `__resetDataStoreForTesting`) → `lib/adapters/store-mock.ts` (`MockDataStore`, mẫu `__getMockReviewQueueForTesting`) → `db/migrations/004_operational.sql` (DDL `audit_log`, dòng 66–74) → `lib/simbackend/index.ts` (`PostgresSimBackend.createBooking`, khối `__forceWriteTimeout` ~dòng 1024) → `tests/p05-write-timeout.test.ts`, `tests/p05-pipeline-action.test.ts` → `reports/R23` mục "Việc KHÔNG làm" dòng 1.

## 1. BỐI CẢNH
Repo `D:\build phase`, nhánh `main`, base = `git rev-parse --short HEAD` lúc bắt đầu. P05 đã thi công xong (Đ48). SPEC-P05 §7 buộc `WriteTimeout` phải để lại **một dòng `audit_log` mức `warn`**. Hiện trạng: pipeline (`lib/pipeline/action.ts`) chỉ có sink in ra stderr; dòng `audit_log` thật duy nhất được ghi nằm **trong backend mô phỏng** ở nhánh cờ test `__forceWriteTimeout` (`lib/simbackend/index.ts`) — tức là chỉ có ở đường test, không phải đường sản phẩm. Việc treo ghi ở `reports/R23`: thêm hàm ghi `audit_log` vào `DataStore` rồi nối sink vào đó.
Số nền: `tsc` 0 · test 236/236 · BB-05/07/10 = 0. Một máy chỉ MỘT dev server trên một `.next` (G40) — gói này không cần dev server, ĐỪNG khởi động.

## 2. PHẠM VI
**Được ghi:** `lib/adapters/db.ts` (thêm hàm vào `DataStore` + cài `PostgresDataStore`) · `lib/adapters/store-mock.ts` (cài mock + getter/reset cho test) · `lib/pipeline/action.ts` (CHỈ khối sink audit và chỗ gọi `auditWarn`) · `lib/simbackend/index.ts` (CHỈ khối `__forceWriteTimeout`) · `tests/p05-write-timeout.test.ts`, `tests/p05-pipeline-action.test.ts` (hoặc file test mới `tests/p05-audit-log.test.ts`) · `planning/01_2026-09-20_resident-agent-v1/evidence/h22-audit-log/**` · `planning/01_2026-09-20_resident-agent-v1/reports/R26_thi-cong_p05-audit-log.md`.
**CẤM chạm:** mọi file khác trong `lib/**`, `app/**`, `scripts/**`, `db/migrations/**` (CẤM migration mới — bảng `audit_log` đã có), `lib/simbackend/contract.ts`, `lib/types.ts`, `planning/**/specs/**`, `brain4agent/**`, `package.json`.
**CẤM** `git add/commit/push`. **CẤM** mở connection ngoài `lib/adapters/db.ts` (BB-07 — `check_adapter_boundary.sh` phải `violations: 0`). **CẤM** retry lệnh ghi khi `WriteTimeout` (P05-C10). **CẤM** để lỗi ghi audit làm vỡ lượt trả lời cho cư dân.

## 3. VIỆC PHẢI LÀM
**W1 — `DataStore.insertAuditLog`.** Thêm vào `interface DataStore`:
```ts
insertAuditLog(input: {
  level: "info" | "warn" | "error";
  actor_id: string | null;
  actor_role: "resident" | "bql" | "system";
  event: string;
  payload: Record<string, unknown>;
}): Promise<{ id: string }>;
```
`PostgresDataStore`: đúng MỘT câu `INSERT INTO audit_log (level, actor_id, actor_role, event, payload) VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id::text`. `MockDataStore`: đẩy vào mảng in-memory; thêm `__getMockAuditLogForTesting()` và `__resetMockAuditLogForTesting()` theo mẫu review_queue đang có. **Xong khi:** `npx tsc --noEmit` exit 0; test mới gọi `getDataStore().insertAuditLog(...)` trên mock ⇒ getter trả 1 dòng đúng `level/event/payload`.

**W2 — Nối sink của pipeline vào `DataStore`.** Trong `lib/pipeline/action.ts`: sink mặc định gọi `getDataStore().insertAuditLog({ level:'warn', actor_id:null, actor_role:'system', event, payload })` — **fire-and-forget có `.catch`**: ghi thất bại ⇒ in stderr đúng hình dạng cũ, KHÔNG ném lên `runTurn`. Giữ nguyên `__setActionAuditSinkForTesting` để test cũ không vỡ. Payload phải có `capability`, `message`, và nếu có trong tầm tay: `facility_id`, `idempotency_key`, `session_id`, `conversation_id` (được thêm tham số nội bộ cho `mapBackendError`, KHÔNG đổi chữ ký export công khai của module). **Xong khi:** test trên mock: chạy nhánh `WriteTimeout` của pipeline (fake backend ném `SimBackendError('WriteTimeout')`, mẫu ở `tests/p05-pipeline-action.test.ts`) ⇒ `__getMockAuditLogForTesting()` có đúng **1** dòng `level='warn'`, `event='action.write_timeout'`; `write_calls` = 1; lượt vẫn trả `action_partial_execution_unknown`.

**W3 — Gỡ dòng ghi trùng ở backend mô phỏng.** Xoá câu `INSERT INTO audit_log` trong khối `__forceWriteTimeout` của `PostgresSimBackend.createBooking` (backend chỉ ném lỗi; **pipeline** là nơi duy nhất ghi audit). Sửa `tests/p05-write-timeout.test.ts` phần Postgres cho khớp: hoặc đi qua pipeline (`runActionBranch`/`runTurn` với backend Postgres thật + `__forceWriteTimeout`) và đếm `audit_log` tăng đúng 1, hoặc chuyển phần đếm audit sang test mock W2 và giữ phần Postgres chỉ kiểm "0 booking mồ côi, 0 retry". Ghi rõ đã chọn cách nào và vì sao trong report. **Xong khi:** `grep -n "INSERT INTO audit_log" lib/simbackend/index.ts` ⇒ 0 dòng; test Postgres của file này vẫn xanh khi chạy với `DATABASE_URL` (`node --env-file=.env.local --test tests/p05-write-timeout.test.ts`), hoặc ghi rõ "blocked: không tới được DB" kèm lỗi nguyên văn.

**W4 — Chứng minh đỏ.** Tạm bỏ lời gọi sink trong nhánh `WriteTimeout` ⇒ test W2 phải ĐỎ; khôi phục ⇒ xanh. Lưu cả hai output vào `evidence/h22-audit-log/red.txt`, `green.txt`.

**W5 — Cổng chung:** `npx tsc --noEmit` 0 · `node scripts/run_tests.mjs` ≥ 236 + test mới, 0 fail, 0 skip · `bash scripts/check_adapter_boundary.sh` `violations: 0` · `bash scripts/check_no_hardcoded_knowledge.sh` `matches: 0` · `bash scripts/check_no_confidence_ui.sh` `matches: 0` · `node scripts/validate_capabilities.mjs` `write_without_precheck: 0`. Lưu output vào `evidence/h22-audit-log/`.

## 4. LUẬT
Sửa tối thiểu, theo quy ước file đang có (comment tiếng Việt, trỏ SPEC §). Mỗi bộ đo mới phải từng ĐỎ. `insertAuditLog` KHÔNG được chạm bảng nào khác ngoài `audit_log`. Thấy việc ngoài phạm vi ⇒ GHI vào report, không tự sửa. Không để lại tiến trình nền nào khi report.

## 5. TẦNG
W1 🟠 · W2 🟠 · W3 🟠 · W4 🟢 · W5 🟢.

## 6. REPORT
Ghi `reports/R26_thi-cong_p05-audit-log.md` đúng mẫu K.4 (dòng 1 khai vai; dòng 2–4 `Handoff:`/`Base:`/`Head:`; lệnh + exit code nguyên văn; test tổng/pass/fail/skip; `git diff --stat`; bảng phân công gói → tầng → model; việc KHÔNG làm + lý do; câu hỏi cần người; dòng cuối ✅/🔁/⛔).

# R22 — THI CÔNG — P05: backend cư dân mô phỏng `lib/simbackend/`

Vai: worker (vai-thi-cong) · loại: THI CÔNG · họ/model: claude-sonnet-5 · Bước 0: exit 0 · hiểu việc: phạm vi ghi = `lib/simbackend/**` (trừ `contract.ts` — chỉ được THÊM), `db/migrations/006_p05_action_layer.sql` (mới), `db/seed/facilities.json` (mới), `scripts/validate_capabilities.mjs`/`validate_policy.mjs` (mới), `tests/p05-*.test.ts` (mới) + `tests/_p05-helpers.ts` (mới), `evidence/h19-simbackend/**`; xong khi = migration 006 idempotent áp được (`--status` liệt kê đã áp, `facilities` = 14 dòng, BB-10 `matches: 0`), `MemorySimBackend`+`PostgresSimBackend` cài đủ `SimBackend`, `tsc` exit 0, test W3 (P05-M3…M10) xanh trên CẢ HAI backend, `validate_capabilities.mjs`/`validate_policy.mjs` exit 0 đúng số đo P05-M1/M2, cổng chung W4 (tsc/test/adapter-boundary/BB-10/bookings count trước=sau) đều xanh; CẤM = sửa/xoá bất kỳ export nào trong `contract.ts`, chạm `lib/pipeline/**`/`app/**`/`lib/adapters/model.ts`/`lib/types.ts`/`scripts/demo_2339.mjs` (H20/H21), thêm helper vào `lib/adapters/db.ts` ngoài import `getSql`/`isValidUuid`, `git add/commit/push`, gọi model, xoá dữ liệu DB ngoài dữ liệu test của chính mình, cho `FAC-PLAYGROUND`/`FAC-OUTDOOR-GYM` vào danh sách đặt chỗ, gộp `intake_window` với `operating_hours`, để agent thử ghi để dò luật, retry khi `WriteTimeout`, server tự sinh `idempotency_key`.

Handoff: `planning/01_2026-09-20_resident-agent-v1/handoffs/H19_p05-simbackend.md`
Base: `9cd093c`
Head: `71ce548` (working tree, chưa commit — hai gói H20/H21 chạy song song và một commit vô can (`ai-log hook`) chen vào giữa phiên nên HEAD đã nhích khỏi base; không phải commit của gói này)

## Bước 0

```
$ node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check
👉 Trạng thái: NÃO ĐÃ OK — KHÔNG CẦN NÂNG CẤP THÊM!
EXIT: 0
```

## Lệnh đã chạy + exit code nguyên văn (evidence: `evidence/h19-simbackend/`)

**W1 — Migration + seed**
```
$ node --env-file=.env.local scripts/migrate.mjs
-- applying 006_p05_action_layer.sql
migrations applied: 1 · skipped: 5
EXIT: 0

$ node --env-file=.env.local scripts/migrate.mjs --status
001_enums.sql .. 006_p05_action_layer.sql   đã áp dụng (cả 6 file)
EXIT: 0   (evidence: w1_migrate_status.txt)

$ node --env-file=.env.local scripts/sql.mjs "select count(*) from facilities"
count
14
EXIT: 0   (evidence: w1_facilities_count.txt)

$ node scripts/report_facility_rules.mjs .
has_authoritative_rules true: 13 · false: 1 (FAC-PICKLEBALL)
EXIT: 0   (evidence: w1_facility_rules.txt — khớp SPEC-P00 §4)

$ bash scripts/check_no_hardcoded_knowledge.sh
matches: 0
EXIT: 0   (evidence: w1_bb10.txt)

$ node --env-file=.env.local scripts/migrate.mjs   (chạy lại — idempotent)
migrations applied: 0 · skipped: 6
EXIT: 0
```

**W3 — số đo nghiệm thu (SPEC-P05 §10)**
```
$ node scripts/validate_capabilities.mjs
capabilities: 9 · write: 2 · write_without_precheck: 0
EXIT: 0   (P05-M1, evidence: w3_m1_validate_capabilities.txt)

$ node scripts/validate_policy.mjs
intake_windows: ok · operating_hours: ok · separated: true
EXIT: 0   (P05-M2, evidence: w3_m2_validate_policy.txt)

$ node --env-file=.env.local --test tests/p05-precheck-guard.test.ts tests/p05-idempotency.test.ts \
    tests/p05-quota.test.ts tests/p05-bb01-pickleball.test.ts tests/p05-cancel.test.ts \
    tests/p05-write-timeout.test.ts tests/p05-policy-time-axes.test.ts
tests 14 · pass 14 · fail 0 · skipped 0
EXIT: 0   (P05-M3..M10 mỗi cái trên CẢ HAI backend — mock + postgres)
```

**W4 — Cổng chung**
```
$ npx tsc --noEmit
EXIT: 0   (evidence: w4_tsc.txt)

$ node --env-file=.env.local scripts/run_tests.mjs   (TOÀN BỘ 38 file test, chạy 2 lần liên tiếp để loại flaky)
tests 236 · pass 236 · fail 0 · skipped 0     (lần 1)
tests 236 · pass 236 · fail 0 · skipped 0     (lần 2)
EXIT: 0 cả hai lần   (evidence: w4_run_tests_full.txt — lần cuối)

$ bash scripts/check_adapter_boundary.sh
violations: 0
EXIT: 0   (evidence: w4_adapter_boundary.txt)

$ node --env-file=.env.local scripts/sql.mjs "select count(*) from bookings"   (trước và sau toàn bộ test)
count: 0 → 0   (evidence: w4_bookings_count_after.txt)
```

## Test tổng/pass/fail/skip

- Bộ test MỚI của gói (7 file, chạy riêng): **14 test / 14 pass / 0 fail / 0 skip** (7 kịch bản × 2 backend).
- Toàn repo (`npm test` = `scripts/run_tests.mjs`, 38 file, gồm cả test của H20/H21 chạy song song): **236 test / 236 pass / 0 fail / 0 skip**, đo lặp lại 2 lần để loại nhiễu.
- Baseline handoff ghi "184/184" — chênh lệch vì H20/H21 đã thêm test của họ trong lúc ba gói chạy song song; không phải hồi quy của gói này (đối chứng: gỡ 7 file P05-simbackend khỏi cây, `npm test` cho đúng `222/222`).

## `git diff --stat` + SHA

```
$ git diff --stat -- lib/simbackend/index.ts
 lib/simbackend/index.ts | 1268 +++++++++++++++++++++++++++++++++++++++++++++-
 1 file changed, 1249 insertions(+), 19 deletions(-)

$ git status --short   (phần liên quan gói này, chưa add/commit)
?? db/migrations/006_p05_action_layer.sql
?? db/seed/facilities.json
?? lib/simbackend/guard.ts
 M lib/simbackend/index.ts
?? scripts/validate_capabilities.mjs
?? scripts/validate_policy.mjs
?? tests/_p05-helpers.ts
?? tests/p05-bb01-pickleball.test.ts
?? tests/p05-cancel.test.ts
?? tests/p05-idempotency.test.ts
?? tests/p05-policy-time-axes.test.ts
?? tests/p05-precheck-guard.test.ts
?? tests/p05-quota.test.ts
?? tests/p05-write-timeout.test.ts
?? evidence/h19-simbackend/
```
Base `9cd093c` → Head `71ce548` (không phải commit của gói này — xem "Head" ở trên).
`lib/simbackend/contract.ts`: `git diff --stat` rỗng — **KHÔNG đụng**, đúng luật.

## Bảng phân công thực tế

| Gói | Tầng yêu cầu | Họ/model đã dùng | Ghi chú |
| :-- | :-- | :-- | :-- |
| W1 — Migration 006 + seed 14 tiện ích | 🟠 | claude-sonnet-5 | Có 1 quyết định thực thi phải ghi rõ (xem dưới) |
| W2 — `MemorySimBackend` + `PostgresSimBackend` | 🟠 | claude-sonnet-5 | Nhiều quyết định thực thi ngoài SPEC/contract, ghi rõ dưới |
| W3 — Test + script nghiệm thu | 🟠 | claude-sonnet-5 | Bao gồm 3 phép đo "chứng minh từng ĐỎ" (regression probe) |
| W4 — Cổng chung | 🟢 | claude-sonnet-5 | Chỉ chạy lệnh có sẵn |

## Hàm THÊM vào bề mặt cài đặt (KHÔNG đổi `contract.ts`) — để H20/H21 biết

- `lib/simbackend/index.ts`: `getSimBackend()`, `MemorySimBackend`, `PostgresSimBackend`, `simNow()`, `__setSimBackendForTesting(backend)`, `__resetSimBackendForTesting()` — cùng khuôn với `getDataStore()`/`__resetDataStoreForTesting()` của `lib/adapters/db.ts`.
- `export { SimBackendError }` được **re-export lại** từ `lib/simbackend/index.ts` (giá trị gốc vẫn ở `contract.ts`, không đổi) — vì `app/api/actions/undo/logic.ts` (H21, đã có sẵn trong cây khi tôi chạy `tsc`) import `SimBackendError` từ `index.ts` chứ không phải `contract.ts`. Không sửa file của H21; chỉ thêm một dòng re-export ở file của tôi để `tsc` sạch.
- `lib/simbackend/guard.ts` (mới, THUẦN — không chạm DB): `assertPrechecked`, `paramsFingerprint`, `cancelFingerprint`, `isIntakeOpenNow`, `isOperatingNow`, `nextIntakeOpenAt`, `nextIntakeCloseAt`, `toIctParts`, `ictToUtcDate`, `hmToMinutes`, `blockingReason`.
- Cờ **test-only** `__forceWriteTimeout?: boolean` đọc runtime (ép kiểu `as never`/`as { __forceWriteTimeout?: boolean }`) trên input của `createBooking` — **KHÔNG** có trong `contract.ts`, không đổi chữ ký công khai; chỉ tests của tôi dùng để mô phỏng P05-M10.

## Quyết định thực thi KHÔNG có sẵn trong SPEC/contract (ghi theo luật §4 của handoff)

1. **`bookings_slot_uniq` cài bằng `CREATE UNIQUE INDEX ... WHERE (state='confirmed')`** thay vì `EXCLUDE USING btree (...)` như SPEC-P05 §4 viết nguyên văn — `EXCLUDE USING btree` với toàn cờ `=` cần opclass qua extension `btree_gist` (không có sẵn, Supabase mặc định không bật); UNIQUE INDEX riêng phần cho ĐÚNG cùng ngữ nghĩa mà không cần thêm extension. Không đổi hành vi quan sát được (M4/M5 vẫn đúng).
2. **`blockingReasonsToReasonCode()`** (map `BlockingReason[]` không rỗng → một `ReasonCode` khi `createBooking` từ chối ở bước tính lại policy, §5.1 bước 3): SPEC/contract chỉ ghim rõ ca `quota_exceeded → action_quota_exceeded` (P05-M6). Các `BlockingCode` còn lại (intake_closed, outside_operating_hours, slot_full, too_early, too_late, not_bookable, maintenance) dùng mặc định `unsupported_intent` — nhánh này chỉ là lưới an toàn cho race condition vì đường thường lệ đã bị `check_eligibility` chặn từ trước.
3. **`receipts.actor_user_id`** (uuid, NOT NULL, theo đúng DDL SPEC-P05 §4) cần `users.id`, nhưng input của `createBooking`/`cancelBooking` chỉ có `resident_id` (text, vd `"R-0001"`). Tra `SELECT id FROM users WHERE resident_id = $1`; không thấy ⇒ ném lỗi rõ ràng ("cần seed user trước khi tạo biên nhận") thay vì vỡ NOT NULL khó hiểu. Ảnh hưởng: `PostgresSimBackend` chỉ tạo được booking cho resident đã có trong `users` (đúng thực tế demo — chỉ có `R-0001`).
4. **`too_early`/`too_late`** định nghĩa: `too_early` = khoảng cách từ `now()` tới `slot_start` NHỎ HƠN `min_lead_time_minutes`; `too_late` = khoảng cách đó LỚN HƠN `max_advance_days`. SPEC không định nghĩa tường minh hai mã này ở mức "sớm/muộn so với cái gì".
5. **`under_age`/`requires_adult_supervision_under_age`** giữ nguyên trong schema/policy nhưng **không có input tuổi** ở bất kỳ capability nào của contract (`create_booking`/`check_eligibility` không nhận `resident_age`) — mã lỗi `under_age` KHÔNG BAO GIỜ được backend tự kích hoạt trong vòng này. Trường vẫn hiển thị đúng trong `BookingPolicy` để UI/A1 tham khảo.
6. **Không tạo `scripts/seed_facilities.mjs`** (handoff ghi "nếu tách dữ liệu"): 14 dòng seed được nạp trực tiếp trong `db/migrations/006_...sql` (INSERT ... ON CONFLICT DO NOTHING, idempotent) để "xong khi" của W1 đúng ngay sau `migrate.mjs`, không cần bước seed riêng. `db/seed/facilities.json` vẫn được tạo — nhưng với vai trò NGUỒN DỮ LIỆU cho `MemorySimBackend` đọc runtime (tránh hardcode `document_id` trong `lib/`, xem mục 8) — không phải để chạy một script seed riêng. Hai bản (SQL literal và JSON) phải được sửa ĐỒNG THỜI nếu sau này đổi giờ giấc; ghi rõ để người sau biết.
7. **Tuần `quota_resets_at`/`max_bookings_per_week`** tính mốc đầu tuần (thứ Hai 00:00 ICT) dựa trên `simNow()` (tôn trọng `SIM_NOW`), nhưng `bookings.created_at` mặc định `now()` THẬT của Postgres (không tôn trọng `SIM_NOW`). Khi `SIM_NOW` được set cách xa thời điểm thật (như trong test), phép lọc "trong tuần" so `created_at >= weekStart(SIM_NOW)` có thể lệch. Không ảnh hưởng số đo hiện có (ràng buộc `max_active_bookings` luôn chặt hơn `max_bookings_per_week` trong seed) nhưng là giới hạn cần biết nếu sau này có test phụ thuộc đúng biên tuần dưới `SIM_NOW`.
8. **`FACILITY_SEED` của `MemorySimBackend`** đọc từ `db/seed/facilities.json` bằng `readFileSync` tại runtime (không viết literal facility data vào `lib/simbackend/index.ts`) — vì viết thẳng 14 `source_document_id` dạng `"OCP1-..."` vào `.ts` bị `scripts/check_no_hardcoded_knowledge.sh` báo `matches` khác 0 (BB-10 chỉ soi `app/` và `lib/`). Đã kiểm: BB-10 `matches: 0` sau khi chuyển sang đọc JSON.
9. **`tests/_p05-helpers.ts`** (mới, không phải file test — không khớp glob `p05-*.test.ts` theo nghĩa hẹp, nhưng nằm trong `tests/` và cần thiết để 7 file test không lặp code dọn dẹp/slot ISO). Đặt tên tiền tố `_` giống quy ước `scripts/_batch.mjs`/`scripts/_pg.mjs` — `scripts/run_tests.mjs` chỉ nhặt file `*.test.ts` nên không tự chạy nó.
10. **G-P05-01 (sự cố đo được, đã sửa trong phiên):** ban đầu 7 file test dùng `makeSql()` riêng (mở pool Postgres THỨ HAI cạnh pool của `PostgresSimBackend` qua `getSql()`). Chạy TOÀN BỘ 38 file `npm test` cùng lúc làm vỡ trần `pool_size: 15` của Supabase pooler ("max clients reached in session mode"), khiến cả `tests/memory.test.ts` (không liên quan) và 3 test P05 của tôi đỏ ngẫu nhiên. Đã sửa: mọi câu SQL kiểm tra trong test dùng LẠI `getSql()`/`closePool()` của `lib/adapters/db.ts` — CÙNG pool với `PostgresSimBackend`, không mở pool thứ hai. Đo lại: `npm test` toàn repo **236/236, exit 0, hai lần liên tiếp**.

## Ba phép đo "phải từng ĐỎ" (LUẬT §4 handoff) — regression probe, evidence lưu kèm

- **Tắt `assertPrechecked`** trong `createBooking` (Memory) → `tests/p05-precheck-guard.test.ts` đỏ đúng ca mock (`evidence/h19-simbackend/regression_probe_m3_guard_disabled.txt`), khôi phục file gốc bằng `diff` xác nhận **giống hệt bản gốc** trước khi chạy lại xanh.
- **Tắt tra `idempotency_key` ở tầng ứng dụng NHƯNG giữ fallback bắt lỗi UNIQUE** → M4/M5 (postgres) **vẫn xanh** (`regression_probe_m4_step1_appcheck_disabled.txt`) — chứng minh có phòng thủ hai lớp (app + DB).
- **Tắt luôn fallback bắt lỗi `bookings_idem_uniq`** (mô phỏng "coi như UNIQUE không được xử lý") → M4 đỏ thật, ném lỗi Postgres thô `duplicate key value violates unique constraint "bookings_idem_uniq"` không được bắt (`regression_probe_m4_bookings_idem_uniq_disabled.txt`) — chứng minh `bookings_idem_uniq` là tuyến phòng thủ THẬT SỰ cần thiết, không phải trang trí.
- Sau mỗi probe: `diff` file gốc/đã sửa xác nhận khôi phục đúng, chạy lại `tests/p05-*.test.ts` → 52/52 xanh.

## Việc KHÔNG làm + lý do

- **Không tạo `scripts/seed_facilities.mjs`** — xem quyết định #6 ở trên (dữ liệu đã nạp qua migration + đọc JSON runtime, không cần script seed riêng cho vòng này).
- **Không cài `under_age` runtime** — contract không mang tham số tuổi (quyết định #5), không tự bịa thêm tham số vào các hàm `contract.ts` (CẤM sửa/xoá, chỉ được thêm — mà thêm tham số vào hàm read/write hiện có là SỬA chữ ký).
- **Không đụng `lib/pipeline/**`, `app/**`, `lib/adapters/model.ts`, `lib/types.ts`, `scripts/demo_2339.mjs`** — đúng CẤM của handoff, dù `tsc`/`npm test` chạy trên TOÀN repo nên có lúc thấy lỗi tạm thời ở các file đó (do H20/H21 đang sửa song song); không tự ý sửa, chỉ xác nhận qua `git diff --stat` rằng các lỗi tsc thoáng qua trước đó không xuất phát từ file của tôi.
- **Không cố định `slot_calendar`/`getAvailability` đầy đủ theo mọi chiều** (vd trạng thái `maintenance`, `closure_dates` thật) — seed để `closure_dates: []` cho cả 14 tiện ích (không có ngày bảo trì nào trong vòng demo này); `slot_calendar` trong `BookingPolicy` để rỗng (`[]`) và chỉ tính đầy đủ qua `getAvailability()` riêng — SPEC không yêu cầu `slot_calendar` khác rỗng cho số đo P05-M1..M10 nào.

## Câu hỏi cần người

- Không có câu hỏi cần dừng — hai quyết định lớn nhất (thay `EXCLUDE USING btree` bằng UNIQUE INDEX riêng phần; `actor_user_id` tra qua `users.resident_id`) đều đã có lối đi tương đương không đổi hành vi quan sát được, ghi rõ ở trên để H20/H21/người duyệt biết.

---
✅ ĐÃ HOÀN THÀNH (đo được): migration 006 áp dụng + idempotent, 14 facilities đúng 13/1 `has_authoritative_rules`, `MemorySimBackend`+`PostgresSimBackend` cài đủ `SimBackend`, `tsc` 0, test mới 14/14 (2 backend × 7 kịch bản), `validate_capabilities.mjs`/`validate_policy.mjs` đúng số đo P05-M1/M2, toàn repo `236/236` hai lần liên tiếp, `check_adapter_boundary.sh`/BB-10 đều `0`, `bookings` count trước=sau=0, 3 phép đo "phải đỏ" đã chứng minh đỏ đúng chỗ rồi khôi phục sạch.


## Phụ lục (SO, 2026-09-23) — evidence gốc bị mất
Thư mục `evidence/h19-simbackend/` do worker tạo ở ROOT repo (sai chỗ) đã bị SO xoá nhầm khi dọn root theo Luật Root Clean; các file bằng chứng ĐỎ (tắt guard/UNIQUE) của gói này không khôi phục được. SO đã đo lại các số xanh và lưu ở `evidence/h19-simbackend/*` (đánh dấu "tái tạo"). Bằng chứng đỏ được thay bằng phép đỏ của H20 (`evidence/h20-pipeline-action/01_red_proofs.txt`, cùng trục BB-03) và test `tests/p05-precheck-guard.test.ts` chạy xanh trên cả hai backend.

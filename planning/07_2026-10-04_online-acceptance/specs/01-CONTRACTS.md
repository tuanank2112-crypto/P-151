# Contract — manifest, kết quả và lỗi

## 1. Manifest chính xác

`manifest.json`: `{schema_version:"day04-2", environment:"local-qa"|"online-qa", base_url:string, build_sha:string, confirmed_by:string, confirmed_at:ISO8601, mutation_scope:string, photo_scope:string, llm_mode:string, model:string|null, store_mode:string, photo_store_mode:string}`.

BẮT BUỘC xác nhận bởi người quản lý môi trường, không đoán store/LLM từ /health. /health chỉ trả status/env. CẤM ghi token/password/API key. Chưa có giá trị thì chưa tạo manifest đã xác nhận; ghi dependency trong báo cáo. Local mặc định dùng loopback, chỉ kiểm trên môi trường đã xác nhận; không đoán cấu hình tiến trình từ giá trị mặc định repo. Restart do chủ tiến trình thực hiện (phối hợp Châm Anh) với thời điểm ghi thật.

## 2. Results schema

`results.json`: `{schema_version:"day04-2", observed_at:ISO8601, environment:"local-qa"|"online-qa", base_url:string, build_sha:string, records:CaseResult[]}`.

`CaseResult`: `{case_id:string, task_id:string, actor_role:string, ticket_ids:string[], started_at:ISO8601, ended_at:ISO8601, expected:string, actual:string, result:"PASS"|"FAIL"|"BLOCKED"|"NOT_RUN", evidence_refs:string[], issue_id:string|null}`.

IDs duy nhất và đúng tập 15 ca trong SPEC-P01. PASS/FAIL bắt buộc evidence tồn tại; BLOCKED có dependency/owner trong issue. NOT_RUN chưa thực hiện, không coi đã hoàn thành. Nhiều build tạo lượt kết quả riêng, không gộp thành một tỷ lệ duy nhất. CẤM sửa output máy; kết luận/diễn giải viết trong report, ảnh UI chụp trực tiếp.

`issues.json`: `{issues:[{issue_id:string, case_id:string, severity:"CRITICAL"|"MAJOR"|"MINOR", owner:string, expected:string, actual:string, reproduce:string[], evidence_refs:string[], status:"OPEN"|"FIXED_PENDING_RETEST"|"CLOSED", retest_ref:string|null}]}`. Chỉ CLOSED khi đo lại đạt, không chỉ dựa báo người sửa.

## 3. API đối chiếu — prefix /api/v1

- POST `/mo/tickets/{id}/safety`: `{decision:"CONFIRM_SAFE"|"REQUEST_INFO"|"ESCALATE", note:string}`.
- POST `/bql/tickets/{id}/emergency/close` và `/emergency/downgrade`: `{note:string}`.
- POST `/bql/tickets/{id}/close`: `{note:string}`; chỉ READY_FOR_REVIEW.
- POST `/resident/tickets/{id}/rating`: `{score:integer[1..5]}`.
- POST `/mo/tickets/{id}/bptn-resolve`: body theo CR/code (`location, info, asset_onsite, note` theo nhánh).
- POST `/mo/warehouse/stock/{item_code}`: `{qty:integer>0}`; thay đổi cộng dồn.
- GET `/mo/tickets/{id}`, `/events`, `/audit`, `/notifications`: lấy bằng đúng vai có quyền; resident dùng view `/resident/tickets/{id}`.

Không ép `simulated_received_at` trên production hoặc dùng ngày fixture cũ; Châm Anh chuẩn bị fixture/ca đúng ca làm việc trên QA. Đối chiếu OpenAPI của build triển khai trước dùng body.

## 4. Phân loại lỗi và hành vi caller

- 401: đăng nhập lại đúng tài khoản; session có thể hết sau restart.
- 403 dự kiến: PASS guard khi trạng thái không đổi; 403 bất ngờ: FAIL/kiểm role, không giả actor.
- 409 dự kiến: PASS guard khi dữ liệu không đổi; 409 do version: đọc lại và kiểm lần trước đã commit chưa.
- 422: kiểm body; nếu UI tạo body sai ghi FAIL UI, không đổi expected.
- 404: kiểm ID/quyền; không tự kết luận ticket bị mất chỉ từ một view sai vai.
- 502/503/timeout: lưu lỗi, đọc state trước retry; stock chỉ retry sau xác minh chưa cộng. Không reset.
- Mất data sau restart với store_mode=postgres: CRITICAL; store_mode=memory mất state là giới hạn dự kiến, R01 persistence ghi BLOCKED_MEMORY_STORE; auth hết hạn riêng không phải mất data.

## 5. Bằng chứng acceptance

Các route trên đã đối chiếu source local 04/10; chưa chứng minh deploy có route. Cổng contract = manifest xác nhận + 15 record đúng schema + refs tồn tại. Số ca PASS/FAIL/BLOCKED/NOT_RUN phải cộng đúng 15; không dùng số test toàn repo làm tỷ lệ demo của từng môi trường.

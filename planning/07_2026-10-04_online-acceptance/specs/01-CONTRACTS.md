# Contract — hồ sơ demo phạm vi đã chốt

## 1. Phạm vi và phiên bản

Schema `day04-3` thay `day04-2` theo yêu cầu trực tiếp của Trường07/10. Scope chính xác9 ca: H01,H02,I01,A01,M01,U01,S04,G03,R01. Sáu ca được loại chỉ lưu trong quyết định thay phạm vi, không có record NOT_RUN hoặc checklist cần chạy. Ba file: deliverables/manifest.json, results.json, issues.json.

## 2. Manifest

`Manifest={schema_version:"day04-3",normalized_at:ISO8601,active_case_ids:string[9],scope_decision:{authorized_by:string,authorized_on:date,source:string,removed_case_ids:string[6]},runs:RunManifest[]}`.

`RunManifest={run_id:string,environment:"local-qa"|"online-qa",base_url:string,build_sha:string|null,dirty_worktree:boolean|null,build_identity_status:"REPORT_ONLY"|"BASE_SHA_ONLY"|"EXACT",configuration_source:string,llm_mode:string,model:string|null,store_mode:string,photo_store_mode:string|null,confirmed_by:string|null,confirmed_at:ISO8601|null,confirmation_source:string,confirmation_status:"REPORT_ONLY"|"EXECUTION_EVIDENCE",mutation_scope:string,photo_scope:string,evidence_refs:string[]}`.

BẮT BUỘC tách từng lượt/build/môi trường. Chưa có tree fingerprint lúc chạy không ghi EXACT. Giờ chuẩn hóa không phải giờ xác nhận. Không suy cấu hình lượt cũ từ .env hiện tại hoặc /health. User cho phép demo không phải leader sign-off. CẤM secret trong hồ sơ.

## 3. Results

`Results={schema_version:"day04-3",normalized_at:ISO8601,active_case_ids:string[9],runs:RunResult[]}`.

`RunResult={run_id:string,observed_at:ISO8601|null,records:CaseResult[],coverage:{recorded_case_ids:string[],unmeasured_active_case_ids:string[]},counts:{PASS:int,FAIL:int,BLOCKED:int},interpretation:string}`.

`CaseResult={case_id:string,task_id:string,actor_role:string,ticket_ids:string[],started_at:ISO8601|null,ended_at:ISO8601|null,time_precision:"exact"|"not_recorded",expected:string,actual:string,result:"PASS"|"FAIL"|"BLOCKED",evidence_basis:"HISTORICAL_REPORT"|"MACHINE_EVIDENCE",evidence_refs:string[],issue_ids:string[],limitations:string[]}`.

Run cũ có9 record; run Supabase có H01/R01, ca chưa đo trong lượt mới nằm trong coverage, không sinh record NOT_RUN. CẤM cộng PASS khác build thành9/9. PASS HISTORICAL_REPORT giữ kết luận báo cáo cũ, không phải đo lại mới; hạn chế evidence phải có issue. Timestamp thiếu để null, không bịa giây/ngày hoặc dùng mtime làm event time.

H01 Supabase: POST create422 là FAIL của hành trình tạo→đóng không lỗi; recovery CLOSED ghi actual, không xóa lỗi. R01 Supabase PASS bằng snapshot trước/sau restart và download bytes/hash; chưa có giờ từng bước restart thì null + hạn chế thời gian. Chuẩn hóa không thực hiện runtime test mới.

## 4. Issues

`IssueRegister={schema_version:"day04-3",normalized_at:ISO8601,issues:Issue[]}`.

`Issue={issue_id:string,run_id:string|null,case_ids:string[],severity:"CRITICAL"|"MAJOR"|"MINOR",owner:string,expected:string,actual:string,reproduce:string[],evidence_refs:string[],status:"OPEN"|"FIXED_PENDING_RETEST"|"CLOSED",retest_ref:string|null,next_step:string}`.

BLOCKED có issue owner/điều kiện gỡ. CLOSED phải có retest_ref đúng hành vi. Sửa model + recovery không đủ đóng lỗi create422; giữ FIXED_PENDING_RETEST. Không quy mọi lỗi backend/UI về người viết báo cáo.

## 5. Lỗi và caller

- Sai schema/scope/run/count/ID hoặc refs thiếu: trả hồ sơ; không sign-off.
- Thời gian/build chưa biết: giữ null/status hạn chế; không giả mốc máy.
- 401: đăng nhập lại; không reset. 403/409: guard chỉ đạt đầy đủ nếu evidence chứng minh đúng quyền và state.
- 422/timeout lúc tạo: đọc ticket theo nhãn duy nhất trước retry. Kho nhập phải kiểm lần trước đã cộng chưa.
- Memory mất state: BLOCKED_MEMORY_STORE. Postgres mất state: CRITICAL. Auth hết hạn riêng không phải mất ticket.
- CẤM reset/evaluate/jobs toàn DB chung, sửa raw output máy/screenshot/gold trong gói chuẩn hóa.

## 6. Nghiệm thu hồ sơ

Validator phải đo JSON/schema,9 scope IDs,0 excluded IDs trong records, counts từ records, mọi evidence/issue refs tồn tại, timestamp exact lấy từ evidence, không secret. Lượt cũ và mới có manifest riêng, không báo tỷ lệ gộp. Sign-off nhóm riêng; thiếu thì không điền tên/giờ. Output máy: evidence/normalization-20261007/.

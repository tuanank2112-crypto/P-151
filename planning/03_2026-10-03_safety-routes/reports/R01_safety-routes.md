Vai worker · thi công · Sonnet 5.5 · Bước 0 exit 0 · hiểu việc: phạm vi = router maintenance.py + test API + docs/maintenance.md + dòng CONTRACTS + evidence/report + 1 dòng today.md; xong khi = pytest/ruff exit 0, 3 path OpenAPI, làm đỏ, 1 commit local; cấm = sửa engine/web/seed, logic ở router, skip, push.
Handoff: H01_safety-routes.md
Base: 6f1a44597fd8415f3876ef1c9c91a7366b1de6cd
Head: 24a99acee63ed360d78adef70d00ae886dbaed71

| Route | Method engine | Test (tests/test_maintenance/test_api_safety.py) |
|---|---|---|
| POST /api/v1/mo/tickets/{id}/safety CONFIRM_SAFE | safety_confirm_safe | test_safety_confirm_safe_200, missing_note_409 |
| ... REQUEST_INFO | safety_request_info | test_safety_request_info_200, missing_note_409 |
| ... ESCALATE | safety_escalate | test_safety_escalate_200 |
| /safety vai khác / BQL trước leo thang / decision lạ / 404 | engine | other_roles_403_with_audit, bql_before_escalation_403, unknown_decision_422, unknown_ticket_404 |
| POST /api/v1/bql/tickets/{id}/emergency/close | emergency_close | emergency_close_bql_200, ignores_client_closure_kind, missing_note_409, other_roles_403, wrong_state_409 |
| POST /api/v1/bql/tickets/{id}/emergency/downgrade | emergency_downgrade | emergency_downgrade_bql_200, missing_note_409, other_roles_403, wrong_state_409 |
| Mục 3 bổ sung cư dân | add_resident_info | resident_addition_with_hazard_keeps_emergency_hold, ..._without_location_keeps_hold |
| Mục 4 resume + jobs/run | resume/run_jobs | test_resume_and_jobs_run_keep_unhandled_emergency |
| OpenAPI | - | test_openapi_has_three_new_paths |

Lệnh + exit (output nguyên văn trong planning/03_2026-10-03_safety-routes/evidence/):
- 01_pytest_baseline.txt: `1600 passed, 29 deselected` EXIT=0 (nền, trước khi sửa)
- 02_pytest_after.txt: `1640 passed, 29 deselected` EXIT=0 (+40, 0 fail, 0 skip mới)
- 03_ruff.txt: `All checks passed!` EXIT=0; `70 files already formatted` EXIT=0
- 04_openapi.txt: 45 -> 48 path; in đúng 3 path mới (post)
- 05_redgreen.txt: mutant CONFIRM_SAFE->emergency_close: `5 failed, 35 passed` EXIT=1; hoàn tác: `40 passed` EXIT=0
- grep -cP '[\x08\x0c\x0b]' trên 4 file sửa = 0

git diff --stat 6f1a445..24a99ac: 10 files, 337 insertions (router +31, test mới 252, docs +7, CONTRACTS +2, evidence 5 file, today.md +1).

Bảng phân công: toàn bộ gói WP1 -> 🟠 yêu cầu -> Sonnet 5.5 (tự làm, không giao lại).

Việc KHÔNG làm: sửa engine/web/seed; set_priority route; CREATE_FOLLOW_UP/gộp/hủy khẩn cấp (Q03); push; chạy harness Day03-bis của Trường (SO/Trường chạy lại DEMO-04).

Câu hỏi mở: (1) thiếu `note` ở /safety và /emergency/* trả 409 (GuardError từ engine, body note tùy chọn ở router để engine ghi audit), không phải 422 - khớp "409/422" của handoff Trường. (2) /safety body forbid trường lạ, emergency/* bỏ qua trường lạ (closure_kind) theo Q02.


SO đo lại 2026-10-03 (lệnh Trường): `DISABLE_SQLALCHEMY_CEXT_RUNTIME=1 LLM_MODE=mock python -m pytest -q -p no:cacheprovider` ⇒ 1640 passed, 29 deselected, EXIT=0 · ruff check EXIT=0 · ruff format --check EXIT=0 · không đụng src/maintenance, src/web, seed · OpenAPI 48 path, 3 path mới đúng Q01. Câu hỏi mở: thiếu note ⇒ 409 (GuardError engine) — handoff Trường cho phép 409/422, chấp nhận.
✅ DUYỆT

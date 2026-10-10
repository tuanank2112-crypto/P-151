Vai: worker orchestrator, thi công WP1.
Bước 0: chạy engine hub --check, ghi mã thoát; không sửa luật quản lý.
Đọc: AGENTS → kernel/index → docs/portal → specs A1–A4/C1–C4/D1–D3.

## Bối cảnh
Plan 18 được duyệt: portal dùng Python, không còn DB/workflow riêng ở runtime.
## Phạm vi
session.ts, queries.ts, backend-client.ts, backend-dto.ts, auth action, login UI và test WP1.
Cấm Python engine/API, .env, production, schema/migrations.
## Việc và xong khi
Thực hiện C1–C4 và D1–D3; giữ ID string, token chỉ cookie HttpOnly.
Chạy npm.cmd run typecheck / lint / test; ghi exit, lỗi integration ngoài WP1 báo root.
## Luật
Không fallback DB, không actor giả, không trả token qua props hoặc log.
Giữ legacy queries chỉ để test/rollback; runtime không import.
## Tầng
WP1 🟠: implementation theo SPEC đã duyệt; không quyết kiến trúc mới.
## Report
R01_auth-data.md: vai, Handoff/Base/Head, lệnh/exit/số test, diffstat,
phân công, việc chưa làm, phán quyết; evidence output máy auth-data/.

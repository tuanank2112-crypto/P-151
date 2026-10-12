Vai worker · THI CÔNG · WP2/WP3.
Bước 0: chạy init_brain.js --check; thiếu hub phải ghi exit, cấm sửa luật.
Đọc kernel → index → docs/portal.md → toàn bộ specs plan18.

## Bối cảnh
Plan18 được người dùng duyệt; frontend mới chỉ gọi Python, không có workflow/DB riêng.
## Phạm vi
Được actions/backend.ts, lib/backend-actions.ts, legacy actions, photo routes, Dockerfile, compose, env example, unit tests của gói này.
Cấm Python, .env thật, DB/volume, session/queries/client và UI do worker khác sở hữu.
## Việc và xong khi
SPEC-P02 §U1/U3: allowlist action/path/body theo vai, ID chuỗi, complete giữ failing_items.
SPEC-P01 §D2: photo BFF conditional auth, legacy410 không DB.
OPERATIONS §O1: build/start portal không DATABASE_URL/migrate/seed; giữ volume.
Xong khi npm.cmd test exit0; lint/typecheck do root đo toàn bộ sau tích hợp.
## Luật
Không retry mutation, không refresh tự xoá draft, không actor_id client, không commit.
Evidence stdout máy sinh; không sửa tay output, không đọc key/token vào evidence.
## Tầng
WP2 actions/BFF 🟠; WP3 Docker 🟠; hồ sơ 🟢 (thiếu model thấp dùng tầng hiện tại).
## Report
R02_actions-bff.md: dòng1 khai vai/model/boot/phạm vi; dòng2–4 Handoff/Base/Head; lệnh/exit/count/diff/SHA/phân công/chưa làm; dòng cuối phán quyết.

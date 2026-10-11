# 17 — Tích hợp UI develop, giữ backend Châm Anh

## Metadata
- Loại: PATCH tích hợp code đã có; version local đích 1.10.1.
- Trạng thái: ĐÃ TÍCH HỢP VÀ KIỂM TRA LOCAL; merge chưa commit, chưa push/deploy.
- Nguồn: origin/develop b6590ce; đích feature/chamanh HEAD 7131510 + working tree plan16.
- Backup: stash `backup-before-develop-ui-b6590ce-20261010`, giữ lại; không chứa .env/integration.

## Nhật ký quyết định
- 2026-10-10: người dùng yêu cầu nhập UI develop và ưu tiên backend nhánh hiện tại khi xung đột.
- 2026-10-10: merge --no-commit --no-ff -X ours, khôi phục stash; xung đột index/state giữ metadata local.
- 2026-10-10: nhập portal nguyên trạng cùng proxy src/main.py/compose; giữ toàn bộ engine/API/app/test local. Proxy không hợp nhất DB/workflow portal với engine Python.
- 2026-10-10: bổ sung migration sinh bằng drizzle-kit cho role warehouse và warehouse_stock từ schema upstream; không chạy migration/seed lên DB.
- 2026-10-10: build dùng URL DB local mẫu và quyền tải font; không đưa cấu hình/key vào hồ sơ.

### Quyết định bị thay thế
- Hướng dẫn cổng portal 3000 công khai: compose develop dùng portal nội bộ 3000, backend 8000 proxy. /ui và /app vẫn phục vụ client Python hiện có.
- Không thay luật guard/atomic material-usage của plan16; không đưa workflow portal sang engine Python trong đợt merge này.

## Work packages
- 🟠 Root: merge, giải quyết xung đột, giữ backend, migration schema hiện có.
- 🟠 Root: test hồi quy proxy, build/typecheck/lint/unit, pytest memory và kiểm tra browser.
- 🟢 Root: docs/não/version; đề xuất commit, không commit/push.

## Checklist
- [x] Fetch origin/develop và đọc UI/backend diff.
- [x] Backup local dirty, merge và khôi phục local.
- [x] Xung đột metadata đã xử lý; engine/API/app/test giữ nguyên so backup.
- [x] Sinh migration warehouse; chưa áp DB.
- [x] Portal typecheck/unit17/build đạt; lint 0 errors, 5 warnings upstream.
- [x] Pytest memory 3438 passed, 95 pg deselected; ruff check/format đạt.
- [x] Proxy regression: 3 tests; proxy + material focus47 passed. Browser login1440/390: HTTP200, 2 input, không overflow/JS error; screenshots tại evidence.
- [x] Docs/não/version1.10.1 đã đồng bộ; diff checks trước sign-off.
- [x] Người dùng duyệt commit và push feature/chamanh để kết thúc merge.
- [ ] Docker/DB workflow và rollout: chưa đo trong môi trường không có Docker CLI.

## Sign-off
Chưa đóng merge cho tới commit được duyệt. Chưa deploy, chưa migration DB, không coi portal và Python chung workflow.
Raw checks tại `evidence/checks.txt`; diff HEAD check cho src/tests/portal/docs liên quan/brain đạt. Diff toàn bộ merge còn whitespace upstream trong docs/submission và raw evidence cũ; không sửa raw output.

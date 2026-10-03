# Trường — công việc 01/10 và 02/10

- Status: LOCAL_OUTPUTS_READY; overall plan: IN_PROGRESS; group approval: PENDING
- Local outputs verified: 2026-10-03T09:50:39+07:00
- Created: 2026-10-03 (Asia/Saigon)
- Base: 10a1d54 (verify with git rev-parse HEAD in reports)
- Scope: nghiệp vụ/rules/dataset/demo; không tích hợp safety hoặc D-01 vào engine, không deploy/push.
- Source: https://storm-jade-f74.notion.site/K-ho-ch-MaintenanceOps-MVP-3e43b68a924d80d7a81fe0579e1eddb9

## Nhật ký quyết định

- 2026-10-03: người dùng chọn phạm vi Notion MVP 04/10, T16/T17/E02 sau MVP; D-02–D-07 theo CR-03; hai fixture và bốn demo giữ theo tài liệu. Chưa duyệt chính thức bởi nhóm, D-08 PENDING.
- 2026-10-03: người dùng xác nhận D-01 dùng thông tin bổ sung mới + ngữ cảnh cấu trúc lưu bền; không gửi lại toàn bộ raw cho LLM; luôn quét safety mới, không tự hạ risk cũ.
- 2026-10-03: giao 5 gói cho 5 sub-agent; tối đa 3 sub-agent đồng thời do giới hạn 4 slot bao gồm root.
- 2026-10-03: engine hiện chưa có safety CR-03; chuẩn bị rules độc lập và dataset đích, bảo toàn dataset baseline đang chạy. Chỉ tích hợp runtime sau quy trình duyệt của nhóm và gói Như Ý.

### Quyết định bị thay thế

- D-01 cũ gửi lại toàn bộ nội dung khi chạy pipeline: thay bằng hợp đồng delta + snapshot cho bản đích, không tuyên bố runtime đã đổi.
- CR-03 §16 ghi T16/T17/E02 P0: phạm vi đích theo Notion dời sau MVP.

## Work packages

- [x] WP1 🟢: phạm vi — specs/00-ARCHITECTURE.md
- [x] WP2 🔴: quyết định và D-01 — specs/01-CONTRACTS.md
- [x] WP3 🟢: bốn demo — specs/OPERATIONS.md
- [x] WP4 🟠: rules safety P0 + labelled dataset + tests — specs/SPEC-P04-SAFETY.md
- [x] WP5 🟠: fixture đích + kiểm tra + bàn giao — specs/TESTING-ACCEPTANCE.md
- [x] Root: đo lại, sync docs/brain, nêu rõ cổng nhóm/runtime/online chưa đạt.

## Router

Đọc 00-ARCHITECTURE → 01-CONTRACTS → SPEC-P04-SAFETY → OPERATIONS → TESTING-ACCEPTANCE.
Mỗi WP có handoffs/HNN_*.md, reports/RNN_*.md và evidence/wpN/*.txt do lệnh máy sinh.

## Exit gates

- [x] local preparation: 266 passed / 20 Postgres deselected; 72 safety + 9 target tests; lint và format 3 file mới đạt; 57/57 kiểm tra hồ sơ đạt; Python syntax đạt. Không có typechecker được cấu hình.
- [ ] repository-wide format: 2 file có từ baseline chưa đạt (`src/api/routers/maintenance.py`, `src/maintenance/ai_logger.py`), ngoài phạm vi gói này.
- [ ] group: D-08 người duyệt thật + ngày giờ + quyết định.
- [ ] runtime: Như Ý tích hợp safety + D-01 vào engine.
- [ ] online: bốn demo UI + restart persistence tại MVP.

Không đóng toàn kế hoạch khi group/runtime/online chưa đạt.


## Nghiệm thu local và bằng chứng

- Root đo lại: [pytest](evidence/root/final-pytest.txt), [lint](evidence/root/final-lint.txt), [format file mới](evidence/root/new-format.txt), [format toàn repo](evidence/root/full-format.txt), [hồ sơ](evidence/root/package-check.txt).
- Kiểm tra đối kháng phát hiện lỗi phủ định liên tiếp: [đỏ](evidence/root/red-negation.txt); sau sửa, [xanh](evidence/root/green-negation.txt). Không hạ mức nguy hiểm cũ.
- Review contract bổ sung provenance `origin_ticket_id` và chặn clearance hạ risk dưới các dấu hiệu còn hiệu lực (`INVALID_CLEARANCE`); đây là hợp đồng đích, chưa tích hợp runtime.
- 5 handoff đã có 5 report tương ứng. Root đã kiểm tra và đo lại đầu ra; không thay thế quyết định duyệt nhóm D-08.
- Boot không chạy được vì thiếu hub `C:/brain4agent.release/.../init_brain.js` (exit 1, MODULE_NOT_FOUND); không sửa tay luật managed.
- Không phát hành hoặc tăng version ứng dụng khi group/runtime/online gates còn mở; không stage/commit/push/deploy.

# Trường — chuẩn bị MVP và kiểm tra ngày 03/10

- Status: LOCAL_OUTPUTS_READY; overall plan: IN_PROGRESS; group approval: APPROVED
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

- 2026-10-03T10:25:01+07:00: D-08 APPROVED: người dùng thông báo leader Lê Thị Châm Anh duyệt phạm vi MVP 04/10 và D-01–D-07; ngày duyệt được báo là 2026-10-02, chưa cung cấp giờ. Ghi nhận ngày 2026-10-03; commit a5e2705/PR #6 là bản tham chiếu được người dùng xác nhận trong phiên này, không khẳng định commit đã tồn tại ngày 02/10. Nguồn: thông báo người dùng trong phiên; chưa có link biên bản ngoài. Không mở rộng thành duyệt mọi CR/backlog hoặc nghiệm thu runtime.

- 2026-10-03T10:43:10+07:00: lập 7 task ngày 03 theo Notion; Trường kiểm thử/nghiệp vụ/wording/demo, không mở rộng coding runtime safety. Các task chưa được thực hiện.

- 2026-10-03T11:20:00+07:00: thực hiện Day03 theo SPEC-P06-DAY03 bằng 6 worker (H06–H12, R06–R12; D3-01/05/07 Haiku 🟢, D3-02/03/04/06 Sonnet 🟠). Kết quả local cô lập, SHA 0ea04adedd023654947e2e97e645043f0ba89159: 23 record = 17 PASS / 1 FAIL (rating-once, Như Ý) / 5 BLOCKED (safety/wording, Như Ý) / 0 NOT_RUN. D3-05 bị trả 🔁 một lần (evidence_refs, mốc giờ, phân loại BLOCKED) rồi ✅. Không đổi contract/oracle; hai điểm lệch chờ người quyết: ASSET-03 (SPEC vs OPERATIONS), STOCK-04 (cờ chỉ đặt). Không đổi trạng thái runtime/online gate.

- 2026-10-03: Day03-bis trên commit cd83f11 (merge develop e32e014; pytest 1600 passed/29 deselected, ruff đạt): 23 record = 19 PASS / 4 BLOCKED. DEMO-01-RATING FAIL→PASS, WORD-01 BLOCKED→PASS; DEMO-04 và WORD-02/04 vẫn BLOCKED (engine có method safety nhưng chưa có route API). Kết quả Day03 SHA 0ea04ad giữ nguyên làm lịch sử. Xem [day03bis-summary](deliverables/day03bis-summary.md), H13–H15/R13–R15.

- 2026-10-03: người dùng chốt ASSET-03 = phương án A (giữ OPERATIONS §3.2.2 `asset_onsite`, sửa chữ SPEC-P06-DAY03 §3 D3-02) và STOCK-04 = phương án A (cờ `STOCK_CHECK_ON_ACCEPT` chỉ là lời nhắc, `accept` không chặn; ghi làm rõ vào D-05). Owner route safety/khẩn cấp = Như Ý (đổi DEMO-04 từ Châm Anh). Không đổi kết quả đo: ASSET-03 và STOCK-04 giữ PASS.

- 2026-10-03: Day03-ter trên nhánh Như Ý `feature/nhuy-safety-routes` 92649a6 (PR #10, chưa merge; pytest 1640 passed): 17 record đo lại = 14 PASS / 1 FAIL (WORD-04: UI fallback + route /close vẫn đóng được ticket khẩn cấp) / 2 BLOCKED (D01-A/C chưa code). DEMO-04 BLOCKED→PASS, WORD-02 BLOCKED→PASS. Sửa chữ OPERATIONS §5.2.3: NEED_INFO an toàn chủ cư dân (theo CR-03 §6.4). Xem [day03ter-summary](deliverables/day03ter-summary.md), H16–H17/R16–R17. D3-05/06 vẫn chưa [x].

- 2026-10-03: người dùng chốt D-01 (delta + snapshot) NGOÀI phạm vi MVP 04/10 (làm ở mốc 19/10); chi phí lật: Như Ý code D-01 rồi chạy lại D01-A/C. Root rà lại WORD-04 trên develop f46a53c (sau Châm Anh ff4f4ca, Trí 9207db2, Như Ý PR #10): PASS; pytest 1641 passed. D3-05 và D3-06 tick [x] với điều kiện đã ghi: D01-A/C giữ BLOCKED trong results để minh bạch. Xem [day03q-results](deliverables/day03q-results.json), [day03ter-summary](deliverables/day03ter-summary.md). Runtime/online gates vẫn mở.

### Quyết định bị thay thế

- Trạng thái D-08 PENDING ở nhật ký và reports trước bản ghi này là lịch sử đã được thay thế bởi APPROVED; giữ nguyên report và evidence cũ.
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
- [x] group: D-08 APPROVED theo thông báo người dùng; leader Lê Thị Châm Anh; approved_date=2026-10-02; time chưa cung cấp; ghi nhận 2026-10-03. Phạm vi: MVP 04/10 và D-01–D-07 tại bản tham chiếu a5e2705/PR #6.
- [ ] runtime: Như Ý tích hợp safety + D-01 vào engine.
- [ ] online: bốn demo UI + restart persistence tại MVP.

Không đóng toàn kế hoạch khi runtime/online chưa đạt. Group gate đã duyệt theo bản ghi D-08 dưới đây.


## Nghiệm thu local và bằng chứng

- Root đo lại: [pytest](evidence/root/final-pytest.txt), [lint](evidence/root/final-lint.txt), [format file mới](evidence/root/new-format.txt), [format toàn repo](evidence/root/full-format.txt), [hồ sơ](evidence/root/package-check.txt).
- Kiểm tra đối kháng phát hiện lỗi phủ định liên tiếp: [đỏ](evidence/root/red-negation.txt); sau sửa, [xanh](evidence/root/green-negation.txt). Không hạ mức nguy hiểm cũ.
- Review contract bổ sung provenance `origin_ticket_id` và chặn clearance hạ risk dưới các dấu hiệu còn hiệu lực (`INVALID_CLEARANCE`); đây là hợp đồng đích, chưa tích hợp runtime.
- 5 handoff đã có 5 report tương ứng. Root đã kiểm tra và đo lại đầu ra; không thay thế quyết định duyệt nhóm D-08.
- Boot không chạy được vì thiếu hub `C:/brain4agent.release/.../init_brain.js` (exit 1, MODULE_NOT_FOUND); không sửa tay luật managed.
- Không phát hành hoặc tăng version ứng dụng khi group/runtime/online gates còn mở; không stage/commit/push/deploy.

## Kiểm tra bản ghi D-08

- [Approval consistency](evidence/root/approval-check.txt): 57/57 pass, fail0, skip0, exit0. Đây là kiểm tra hồ sơ, không phải test tích hợp hoặc xác minh độc lập biên bản của leader.


## Checklist ngày 03/10 — Trường

Hợp đồng: [SPEC-P06-DAY03](specs/SPEC-P06-DAY03.md). Đã thực hiện ngày 2026-10-03; xem kết quả từng task bên dưới.

- [x] D3-01 🟢: manifest local, SHA 0ea04ad…, hub thiếu (Bước 0 exit 1) — [R06](reports/R06_day03-env.md).
- [x] D3-02 🟠: asset 3 ca, 3 PASS — [R07](reports/R07_day03-asset.md); chờ người quyết ASSET-03.
- [x] D3-03 🟠: vật tư 4 ca, 4 PASS — [R08](reports/R08_day03-stock.md); STOCK-04 chờ người quyết điều kiện nhận việc.
- [x] D3-04 🟠: trùng cơ bản 4 ca, 4 PASS — [R09](reports/R09_day03-dup.md).
- [x] D3-05 🟢: rà wording 4 vai — [R10](reports/R10_day03-wording.md), Day03-bis/ter R15/R17; cuối cùng WORD-01/02/03/04 PASS trên develop f46a53c (WORD-04 sau khi bỏ fallback UI và chặn /close khẩn cấp).
- [x] D3-06 🟠: 4 nhóm script chạy thử — [R11](reports/R11_day03-demos.md), R14, R16; DEMO-01..04 PASS trên develop; D01-A/C (delta + snapshot) BLOCKED nhưng ngoài phạm vi MVP 04/10 theo quyết định 2026-10-03, giữ trong results.
- [x] D3-07 🟢: tổng hợp và bàn giao ngày 04 — [R12](reports/R12_day03-summary.md); chỉ là đã lập báo cáo, không nghĩa chức năng đạt.

Day03-ter (SHA 92649a6, nhánh Như Ý): [summary](deliverables/day03ter-summary.md) · [results](deliverables/day03ter-results.json).

Day03-bis (SHA cd83f11): [summary](deliverables/day03bis-summary.md) · [results](deliverables/day03bis-results.json); D3-05/06 vẫn chưa [x] vì WORD-02/04, DEMO-04 BLOCKED.

Đầu ra: [results](deliverables/day03-results.json) · [summary](deliverables/day03-summary.md) · [wording](deliverables/day03-wording.md). Root đo lại: [validate](evidence/root/day03-results-validate.txt), [rerun g1r/g4a/g4b](evidence/root/day03-rerun-g1r.txt). Runtime/online gates vẫn mở.

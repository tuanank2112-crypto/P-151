# Trường — kiểm thử nghiệp vụ MVP trên localhost ngày 04/10

- Status: EVIDENCE_NORMALIZED — scope9 ca đã chốt;3 JSON tách từng run, product/online sign-off còn mở; báo cáo: deliverables/day04-summary.md.
- Created: 2026-10-04T11:49:44+07:00 (Asia/Saigon).
- Owner: Cao Văn Trường — nghiệp vụ, expected outcome, demo, tổng hợp thiếu sót.
- Source: https://storm-jade-f74.notion.site/K-ho-ch-MaintenanceOps-MVP-3e43b68a924d80d7a81fe0579e1eddb9 (phân công đã đọc trực tiếp 03/10).
- Milestones: nghiệm thu nhóm 2026-10-04T21:00:00+07:00; khóa MVP 23:59 cùng ngày.
- Baseline: kết luận local Day03 trên f46a53c; SHA deploy online phải xác nhận mới.
- Dependencies: địa chỉ localhost/build/tài khoản demo/cấu hình local được xác nhận; restart do Châm Anh thực hiện.

## Nhật ký quyết định
- 2026-10-05T11:52:38+07:00 — Trường xác nhận bằng lời đồng ý phạm vi rút gọn (chỉ flow theo script demo). Quyết định có hiệu lực cho phần việc cá nhân Day04; NOT_RUN vẫn ghi NOT_RUN, không đổi thành PASS. Việc báo nhóm vẫn do Trường thực hiện.
- 2026-10-05T11:49:09+07:00 — Trường quyết định rút gọn: chỉ chạy flow theo script demo, đối chiếu expected, ghi phần chưa hoàn thành và giới hạn mô phỏng. Hệ quả: S01, S02, S03, S05, G01, G02 ghi NOT_RUN (không đổi thành PASS); R01 BLOCKED_MEMORY_STORE. Quyết định này khác SPEC-P01 gốc (15 ca đủ nhánh); nhóm chưa được thông báo trong hồ sơ này.

- 2026-10-04: người dùng xác nhận nhóm chỉ chạy localhost, chưa có URL online. Thay môi trường thực thi hôm nay bằng local-qa; giữ đường dẫn hồ sơ. Nghiệm thu online riêng BLOCKED_NO_DEPLOYMENT. Không đoán port hoặc cấu hình tiến trình.

- 2026-10-04T11:49:44+07:00: lập kế hoạch từ yêu cầu người dùng, chia 8 task/15 ca bắt buộc. Chỉ lập hồ sơ, không gọi API ghi, restart, deploy, push hoặc gửi tin cho nhóm.
- 2026-10-04T11:49:44+07:00: D-01 delta/snapshot ngoài MVP theo quyết định ngày 03; không tự đưa lại thành gate ngày 04. Quét safety khi cư dân bổ sung trong NEED_INFO vẫn thuộc ca S03.
- 2026-10-04T11:49:44+07:00: dùng contract/code hiện tại và kết luận cuối Day03; không dùng các câu TARGET UNIMPLEMENTED lịch sử trong runbook cũ để kết luận hiện trạng.
- 2026-10-04T11:49:44+07:00: Bước 0 exit1 MODULE_NOT_FOUND do thiếu hub. Không sửa luật managed; không suy ra ứng dụng lỗi từ lỗi hub.

### Quyết định bị thay thế
- Phạm vi gốc 15 ca đủ nhánh (SPEC-P01) được thay bằng phạm vi rút gọn cho phần việc cá nhân từ 2026-10-05 (xem nhật ký); SPEC-P01 giữ nguyên làm chuẩn nghiệm thu nhóm.

- Giả định chạy online QA trong bản lập đầu bị thay thế bởi xác nhận chỉ có localhost; yêu cầu online của MVP vẫn chưa đạt. Trạng thái lỗi của các vòng Day03 đầu chỉ là lịch sử, không thay thế kết luận cuối.

## Work packages và checklist

- [x] D4-01 🟢: expected và manifest được chuẩn hóa từ bằng chứng, chưa bịa dữ kiện thiếu; CONTRACTS §1–§2.
- [x] D4-02 🟠: happy path vệ sinh và đèn; SPEC-P01 §1 (H01/H02).
- [x] D4-03 🟠: thiếu thông tin và asset; SPEC-P01 §2 (I01/A01).
- [x] D4-04 🟠 (U01 PASS, M01 PASS): vật tư và trùng cơ bản; SPEC-P01 §3 (M01/U01).
- [x] D4-05 🟠: S04 theo scope đã chốt; PASS lịch sử có hạn chế evidence được ghi issue, chưa tái đo bản hiện hành.
- [x] D4-06 🟠: G03 và wording flow trong scope; kết quả lịch sử/hạn chế/owner có trong issues.
- [x] D4-07 🟠: R01 Supabase07/10 PASS riêng; record memory cũ vẫn BLOCKED, metadata chưa có ghi hạn chế.
- [x] D4-08 🟢: báo cáo, giới hạn mô phỏng, đối chiếu trước 21:00; TESTING §3.
- [ ] 🔴 nếu phát sinh: quyết định đổi scope/contract hoặc nhận rủi ro — chuyển leader/người dùng duyệt, không tự quyết.

## Router SPEC

- [Kiến trúc và phạm vi](specs/00-ARCHITECTURE.md).
- [Contract kết quả và evidence](specs/01-CONTRACTS.md).
- [Task và ca kiểm tra](specs/SPEC-P01-DAY04.md).
- [Thứ tự chạy, phối hợp và phục hồi](specs/OPERATIONS.md).
- [Cổng nghiệm thu](specs/TESTING-ACCEPTANCE.md).

## Exit checklist

- [x] Người dùng xác nhận scope9 ca và yêu cầu chuẩn hóa ngày07/10.
- [x] Manifest tách2 lượt/cấu hình/scope; SHA/giờ thiếu ghi status/null.
- [x] Hồ sơ9 ca scope: lượt cũ9 record, lượt Supabase2 record; counts/coverage tách riêng.
- [ ] Tái đo đủ scope9 cùng bản chốt nếu cần nghiệm thu sản phẩm; không gộp PASS khác build.
- [x] Báo cáo công việc cá nhân + manifest/results/issues đủ theo bằng chứng; không đồng nghĩa MVP đạt.
- [ ] Local gate theo TESTING §2; online product gate vẫn BLOCKED_NO_DEPLOYMENT.
- [ ] Nhóm sign-off lúc nghiệm thu; ghi tên người duyệt + thời điểm thật.

Không phát hành, tăng version ứng dụng hoặc đánh dấu hoàn thành MVP trong giai đoạn lập kế hoạch. Chưa phóng worker; nếu phóng sau duyệt phải tạo handoff/report theo giao thức repo.
# Supplemental decision — 2026-10-07T11:11:12+07:00
- User authorized one demo that writes to shared Supabase. Scope is localhost/API with shared PostgreSQL and private Storage, not public deployment or complete Day04 acceptance.
- Preserve all existing cases/stock; disable jobs, reset and seed on the demo process. Use synthetic images/checklists/material records, no resident rating.
- Compatibility patch follows existing CR-BPTN-03 §8/§13 (`Ticket.merged_children`); it preserves the approved field without weakening unknown-field rejection or changing shared records. Detailed outcome: `deliverables/shared-supabase-demo-20261007.md`.
- [x] Create and recover one marked ticket SIM-TKT-0042; complete and close through role-specific APIs.
- [x] Verify missing-photo guard, two Storage uploads/download hashes, closed ticket and photos after restart.
- [x] Measure all53 preexisting case hashes unchanged, stock unchanged, new cases exactly1; pytest2973 pass and ruff clean.
- [x] Verify real GPT-6 Luna SUCCESS; save response before process logs are lost on restart.
- [ ] Full acceptance matrix and public deployment remain open. This supplemental run does not close the plan or sign off Day05/Day06.

## Completion review — 2026-10-07T04:21:45.545224+00:00
- Day04 review: narrowed personal demo scope executed with expected/actual and limitations recorded; formal acceptance package not closed. Preserve old8PASS/1BLOCKED/6NOT_RUN on mock/memory; separate Supabase/Luna one-case evidence. No combined9/15 claim. Missing day04-2 manifest/results/issues, same-build smoke/UI wording, old M01/S04/G03 evidence gaps, online/leader sign-off. User-approved reduced scope remains authoritative.
- [x] Update main report with separate latest Supabase/Luna evidence and current incomplete items; repair report links.
- [ ] Formal acceptance evidence and group sign-off remain open; no new runtime measurement in this review.

## Quyết định mới — 2026-10-07T04:31:47.537907+00:00
- Người dùng yêu cầu xóa sáu ca NOT_RUN khỏi scope vì đã thống nhất không cần; chỉ còn H01,H02,I01,A01,M01,U01,S04,G03,R01. Schema day04-3 thay day04-2.
- Quyết định giữ sáu ca như việc chưa làm, yêu cầu15 record, smoke với ca đã bỏ và các kết luận15-ca ở nhật ký cũ ĐÃ BỊ THAY THẾ trong hồ sơ cá nhân này. Lịch sử giữ làm nguồn quyết định, không phải gate đang sống.
- [x] Chuẩn hóa3 JSON từ report/evidence; tách run; không tạo dữ kiện thời gian/source giả.
- [x] Ghi create422 là FAIL hành trình; recovery CLOSED không đóng issue trước retest201.
- [x] Validator/count/ref/provenance đạt;3 negative controls đều bị từ chối, exit0. Evidence: evidence/normalization-20261007/validation.txt.
- Product/online/leader sign-off còn mở; chưa gửi tin nhóm hoặc ghi DB/Storage trong lượt chuẩn hóa.

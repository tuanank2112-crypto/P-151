# Day05 — chốt backlog và tách bộ nhãn

- Status: PRELIMINARY_15 APPROVED / WAITING_REVIEW — hồ sơ sơ bộ 15 câu đã được duyệt; Day05 chưa hoàn thành.
- Historical status: PROPOSED — SPEC đã soạn; phần local offline đã thực thi 2026-10-07 (backlog, 50 câu DEVELOP + proposal, công cụ). CHƯA có review người/gold ACCEPTED, chưa nghiệm thu; xem deliverables/day05-summary.md.
- Created: 2026-10-07T05:02:31.517433+00:00.
- Task date: 2026-10-05 (kế hoạch được lập thực tế07/10, không ghi lùi ngày).
- Owner: Cao Văn Trường — dữ liệu, expected outcome, backlog và tổng hợp.
- Baseline: feature/truong, base8dd6baa5e733fd9dd917b30522b131d520471e05, working tree có thay đổi chưa commit.
- Parent: planning/05_2026-10-04_agent-hardening/; đầu vào demo: planning/07_2026-10-04_online-acceptance/.
- Approval: PRELIMINARY_15 scope approved by Trường on 2026-10-08; reviewers assigned. Backlog items beyond D5-B-011 and per-case gold remain pending. Previous broad-scope approval note superseded.
- Estimated effort: 5–7 giờ cho lần đầu; thời gian người duyệt riêng, ưu tiên chất lượng hơn đủ số câu.

## Nhật ký quyết định

- 2026-10-07T05:02:31.517433+00:00: người dùng yêu cầu plan task05/10; dùng code/CR-03 và bằng chứng local hiện có, không đọc dữ liệu Supabase hoặc gọi LLM trong lượt lập kế hoạch.
- 2026-10-07T05:02:31.517433+00:00: hợp đồng/ma trận số lượng/định nghĩa nhãn nằm trong specs; không sửa runtime/lexicon/nhãn cũ trong gói này.
- 2026-10-07T05:02:31.517433+00:00: D4-11 bỏ sót trẻ bị kẹt là ưu tiên CRITICAL cho owner Như Ý; Trường chuẩn bị câu/nhãn/repro, Châm Anh tích hợp/retest. Không coi Luna classification là tầng safety.
- 2026-10-07T05:02:31.517433+00:00: bộ6 ca Day04 đã bỏ tiếp tục ngoài scope Day04; câu dữ liệu mới không khôi phục checklist demo đó.

- 2026-10-07 (thực thi, orchestrator): Bước 0 exit 1 `MODULE_NOT_FOUND` (thiếu hub), không sửa luật managed, làm tiếp phần local. Giao 4 handoff: H01 backlog, H02 câu/proposal, H03 công cụ, H04 viết lại câu. Đo lại độc lập: H01 và H02 bị 🔁 (done_when không đo được/sai quota/quote lệch); backlog được orchestrator làm lại (🔴), câu/proposal được viết lại ở tầng 🟠 (H04, lên một tầng); H03 ✅ theo số đo.
- 2026-10-07: câu agent soạn là `LLM_PROPOSAL`, gán toàn bộ DEVELOP; held-out 30 câu phải do người soạn (`AUTHORED`), agent không giả nguồn. Chưa tạo gold; `classification-gold.json`/`safety-gold.json`/`disputes.json` giữ `records: []`. `split-manifest.json` chỉ là bản NHÁP (frozen=false, held_out rỗng).
- 2026-10-07: đo lại D4-11 trên HEAD hiện tại: "bị kẹt" S5/S1 ⇒ NONE, "bị mắc kẹt" ⇒ EMERGENCY; giữ OPEN/CRITICAL/P0 (Như Ý), không suy do S5.
- 2026-10-07: thẩm định cô lập (auditor-sonnet) tìm 1 blocker + 5 major ở công cụ H03 (blind sheet lộ nhãn, reviewer/freeze/eligibility/runner/rò text) ⇒ H05 (🟠) sửa, orchestrator đo lại (270 test, tấn công bị từ chối); chưa chạy vòng thẩm định thứ hai. Định nghĩa hash freeze do orchestrator chọn (xem day05-summary §4), có thể lật bằng sửa `validate_day05.py` mà không đổi dữ liệu.
- 2026-10-07: diễn giải của worker H03 (shape manifest `frozen/hash/family_exceptions`, safety MATCH chỉ so `risk_level`, "evidence retest" = ref tồn tại) chưa phải quyết định đã duyệt; cần người xác nhận (day05-summary §4).

- 2026-10-07T16:39:35.819793+00:00: người dùng xác nhận: "Nhóm đã thống nhất: Như Ý sửa safety, tôi chuẩn bị câu kiểm thử, Châm Anh kiểm tra API". Ghi nhận D5-B-011 / D4-11 owner_acceptance=CONFIRMED; Như Ý phụ trách safety, Trường chuẩn bị câu kiểm thử, Châm Anh kiểm tra API. Thời điểm này là lúc ghi nhận, không phải thời điểm nhóm họp. Lỗi vẫn OPEN/CRITICAL/P0; xác nhận chỉ áp dụng phân công mục này, không duyệt toàn bộ backlog, nhãn gold hoặc đóng Day05. Tổng hiện tại: 1 CONFIRMED / 14 PROPOSED. Manifest/hash trước đó là snapshot lịch sử, không đại diện backlog sau xác nhận này.

- 2026-10-07T16:47:40.721485+00:00: hoàn thiện hồ sơ còn lại trong scope offline: 10 câu D4-11 PROPOSED, mẫu 30 slot held-out và mẫu xác nhận 15 backlog; fresh evidence có 270 test PASS, quota/review và baseline vẫn BLOCKED. Không tự tạo AUTHORED/gold ACCEPTED, không chốt chính sách S5. Router: deliverables/completion-guide.md.

- 2026-10-08T08:45:45.700329+00:00: Trường xác nhận phạm vi cabin/thang bộ thoát hiểm và đèn nội khu; ghi quyết định trong specs/00-ARCHITECTURE mục Xác nhận phạm vi địa điểm, intake câu 8/9/13/14/15. Không suy duyệt gold/giảm quota hoặc giao việc thường cho BQL.


- 2026-10-08T08:49:58.066057+00:00: Trường chốt Như Ý review safety, Châm Anh review classification cho 15 câu AUTHORED của Trường. Phân công CONFIRMED, review PENDING. Tạo review-human15/ (phiếu JSON/Markdown riêng, 15 opaque IDs, không có prediction/proposal), mapping riêng review-key/human15-id-map.json. Chưa có nhãn được duyệt; chưa thay quota 30 hoặc đóng Day05.

- 2026-10-08T08:55:52.078704+00:00: Trường phê duyệt D5-POL-OUTSIDE-SAFETY-01; router: specs/00-ARCHITECTURE và deliverables/outside-scope-safety-policy.json. Expected route S5 đã cập nhật; runtime chưa retest.

- 2026-10-08T08:59:38.730526+00:00: Trường duyệt PRELIMINARY_15 thay yêu cầu 30 câu; phạm vi sơ bộ hai use case, không nghiệm thu safety đầy đủ. Contract/gates hiệu lực: specs/SPEC-P03-PRELIMINARY15.md.

### Quyết định bị thay thế

- 2026-10-08T08:59:38.730526+00:00: quota 80 safety/40 classification, split50/30, held-out30 và minimum32 family không còn là cổng nghiệm thu Day05 sơ bộ. Giữ tài liệu/corpus/evidence bộ rộng để tham khảo, không xóa.

- 2026-10-08T08:55:52.078704+00:00: trạng thái chính sách S5 “chờ xác nhận” trong các mục cũ được thay bằng APPROVED_TARGET theo D5-POL-OUTSIDE-SAFETY-01; lịch sử giữ nguyên.

- Không có quyết định đã duyệt nào bị thay thế bởi bộ plan này. Target/phạm vi dữ liệu là đề xuất; cần ghi nhật ký khi chỉnh trước thực thi.

## Work packages + model tier

- WP00 🔴: chốt contract nhãn, rubric tranh chấp và giới hạn; reviewer nghiệp vụ Trường/Như Ý, leader duyệt scope/backlog.
- WP01 🟢: kiểm kê issue có evidence, điền backlog theo mẫu; quyết định severity/security chưa rõ chuyển WP00.
- WP02 🟢: tạo nguồn câu/biến thể theo nhóm; GPT-6 Luna có thể hỗ trợ proposal, không tự chốt gold.
- WP03 🔴: review nhãn safety và câu tranh chấp; người duyệt độc lập với người đề xuất.
- WP04 🟠: validator, split, baseline đo được và report từ schema đã chốt; không sửa engine để làm xanh kết quả.
- WP05 🟢: báo cáo, kiểm liên kết và chuẩn bị bàn giao; leader/owner tự xác nhận quyết định nhận việc.

## Checklist thực thi

- [x] Đọc code/spec/issue đầu vào; soạn đủ bộ SPEC.
- [ ] Duyệt scope, contract và reviewer; xác nhận owner/priority backlog.
- [x] WP01: tạo backlog có issue/owner/priority/evidence/xong khi — 15 mục, validator PASS; owner_acceptance=PROPOSED, chờ leader/owner xác nhận (2026-10-07).
- [x] WP02 (phần DEVELOP): 50 câu + 50 safety/20 classification proposal tách riêng, 30 family (2026-10-07).
- [ ] WP02 (held-out): 30 câu AUTHORED do người soạn — chưa có (held-out-request.md).
- [x] WP03 (chuẩn bị): REVIEW-GUIDE + blind-review-sheet (50 câu, không lộ proposal) — agent đã làm.
- [ ] WP03 (review): review mù bởi người thật, disputes, gold ACCEPTED — 0/80 safety, 0/40 classification.
- [x] WP04 (công cụ): validator + baseline runner + review-pack; sau thẩm định cô lập + H05: pytest 270/0/0 skip, ruff exit 0; typecheck NOT_CONFIGURED.
- [ ] WP04 (dữ liệu): freeze split, chạy baseline develop/held-out — chặn bởi gold (runner NO_VALID_GOLD exit 2).
- [ ] WP05: report + manifest/hash đã tạo (deliverables/day05-summary.md, handoff-manifest.json); CHƯA có bàn giao được owner/leader xác nhận.
- [ ] Đánh dấu hoàn thành gói dữ liệu khi gates Day05 đạt; product/safety fix vẫn là backlog owner.

## Router SPEC

- [Kiến trúc và phạm vi](specs/00-ARCHITECTURE.md).
- [Schema và contract nhãn/backlog](specs/01-CONTRACTS.md).
- [Chốt backlog](specs/SPEC-P01-BACKLOG.md).
- [Tạo/review câu và tách nhãn](specs/SPEC-P02-LABELS.md).
- [Vận hành và phục hồi](specs/OPERATIONS.md).
- [Kiểm tra/nghiệm thu](specs/TESTING-ACCEPTANCE.md).

## Cổng kế hoạch

- [x] Kiểm cấu trúc/ref/spec semantics:7 docs,10 source refs,3 negative controls rejected; exit0, evidence/planning/package-check.txt.
- [ ] Người dùng/leader duyệt thực thi; không suy từ yêu cầu lập plan.
- [x] Không commit/push, deploy, sửa runtime hoặc tạo gold chưa review trong lượt lập kế hoạch.


### Làm rõ phạm vi thí điểm (2026-10-07T16:42:43.541758+00:00)

Người dùng xác nhận S5 không tồn tại trong các cụm thí điểm. Catalog hiện tại khai báo S1/S2 (`seed/maintenance_v1/catalog.yaml`). Đính chính đề xuất trước: không dùng S5 như địa điểm hợp lệ để nghiệm thu luồng API/BQL; dùng S1/S2 cho ca trong phạm vi. Giữ câu S5 gốc trong lịch sử và bộ đối chiếu ngoài phạm vi. Phân biệt nhãn nguy hiểm của nội dung với tính hợp lệ của địa điểm; người dùng chưa duyệt chính sách chuyển tiếp khẩn cấp ngoài phạm vi, không tự đặt expected route cho ca S5. Phép đo assess trên câu S1 vẫn là bằng chứng độc lập về biến thể “bị kẹt”; D4-11 giữ OPEN và phân công đã xác nhận không đổi. Không sửa runtime, gold hay bằng chứng máy cũ.

- [x] Chuẩn bị gói thao tác còn lại: D4-11 matrix, authoring form, backlog approval form, completion guide và fresh verification evidence (07/10).

- 2026-10-07T16:58:11.277650+00:00: nhận 5 câu do Trường tự soạn, lưu human-authored-intake.json với nguồn AUTHORED, nguyên văn nội dung (bỏ markup danh sách). Chưa nhập corpus/held-out hoặc duyệt nhãn. Câu 1/2 cần cùng family; câu 1 vị trí B1 và câu 3 mất điện/đèn không sáng cần làm rõ. Screen trùng chuỗi không thay review độc lập.

- 2026-10-07T16:59:31.535946+00:00: Trường làm rõ HA-001-01 = sảnh tầng hầm B1; HA-001-03 = đèn hành lang không sáng. Lưu author_clarification riêng, giữ nguyên cả 5 text; câu 1/2 cùng family candidate. Không suy nhãn đã duyệt từ ý định tác giả, không đưa clarification vào text baseline. Đã nhận 5 AUTHORED, chờ family/label review; held-out imported 0.

- 2026-10-07T17:16:20.774354+00:00: nhận câu 6–10 do Trường tự soạn, AUTHORED intake tổng 10. Giữ nguyên nội dung, bỏ HTML space entity cuối câu. Câu 8/9 trong cabin thang máy cần review phạm vi riêng với sảnh thang máy. Chưa nhập held-out/duyệt nhãn; duplicate-screen human-intake-002 không thay đánh giá family.

- 2026-10-08T08:38:17.800096+00:00: nhận câu 11–15 do Trường soạn, tổng intake 15 AUTHORED; 0 gold ACCEPTED, 0 held-out imported. Câu 13 cùng family candidate câu 8; cabin 8/9/13 và ngoài đường câu 15 cần review scope. Mốc 15 là tiến độ soạn câu; scope waiver/đổi quota 30 chưa được ghi là đã duyệt.

## Checklist hiệu lực — PRELIMINARY_15

- [x] Trường duyệt scope đánh giá sơ bộ 15 câu.
- [x] Nhận đủ 15 câu AUTHORED, giữ nguyên văn.
- [x] Xác nhận phạm vi cabin/thang bộ/đèn nội khu và chính sách ngoài thí điểm.
- [x] Chốt Như Ý review safety, Châm Anh review classification; phiếu đã chuẩn bị.
- [ ] Nhận review, giải quyết disputes và xuất nhãn hợp lệ.
- [ ] Rà family/độc lập và khóa tập đánh giá.
- [ ] Chạy baseline sơ bộ, ghi số đo/lỗi/exclusions thật.
- [ ] Xác nhận backlog còn lại và hoàn thiện report/manifest nghiệm thu.

Checklist quota cũ phía trên là lịch sử; checklist này và SPEC-P03 mới là cổng hiện hành.

- 2026-10-08T09:05:55.932842+00:00: rà backlog thấy D5-B-015 chưa phản ánh các xác nhận đã có. Cập nhật PRELIMINARY_15, owner Trường/Như Ý/Châm Anh đúng vai trò đã duyệt; owner_acceptance CONFIRMED, status IN_PROGRESS. Không duyệt nhãn hoặc đóng dữ liệu. Tổng phân công 2 CONFIRMED / 13 PROPOSED. Bắt đầu thảo luận 13 mục còn lại, chưa tự xác nhận các mục này.

- 2026-10-08T09:11:20.819204+00:00: Trường chốt hướng xử lý D5-B-001=NO_ACTION (không sửa memory, dùng persistence evidence Supabase), D5-B-008=DEFER public, D5-B-012=DEFER vision ngoài Day05. Lưu backlog-scope-decisions.json; owner_acceptance còn PROPOSED, không đóng việc hay xác nhận nghiệm thu thay owner. Còn 10 hướng xử lý chưa thảo luận trong 13 mục còn lại; tổng assignment vẫn 2 CONFIRMED / 13 PROPOSED.

- 2026-10-08T09:22:47.304078+00:00: Trường duyệt nhóm API D5-B-006 NOW, D5-B-002/004 NEXT; Châm Anh dẫn kiểm thử đề xuất, Như Ý phối hợp lỗi engine. QA cô lập, không suy quyền ghi shared Supabase. Chuẩn bị api-retest-checklist.md; chưa chạy hoặc đóng lỗi, owner acknowledgment vẫn PROPOSED. 6 scope decisions đã ghi / còn 7 mục cần thảo luận (003/005/007/009/010/013/014).

- 2026-10-08T09:40:03.176149+00:00: Trường chốt D5-B-003/005/007 NEXT: thu bằng chứng demo QA mới, chủ trì tổng hợp bởi Trường, Trí hỗ trợ nếu UI cần. Xác nhận owner cho phần chủ trì của Trường, không giả acknowledgement Trí. demo-evidence-checklist.md đã chuẩn bị, các mục vẫn OPEN. Scope decisions đã chốt 9 mục / còn 4 mục 009/010/013/014. Assignment 5 CONFIRMED / 10 PROPOSED, không đồng nghĩa 5 việc đã xong.

- 2026-10-08T09:42:49.903373+00:00: Trường duyệt 4 mục cuối 009/010 NEXT, 013/014 DEFER nghiệm thu riêng. Hướng xử lý backlog đủ15/15; không có mục nào mới CLOSED. Sửa mô tả lỗi thời 013 (đã có module StateGraph/engine integration) và 014 (lexicon P0/P1); chưa coi code tồn tại là runtime PASS. Tổng hợp backlog-handoff-summary.md để người dùng bàn giao, chưa gửi tin/commit/push.

- [x] Trường xác nhận hướng xử lý 15/15 backlog; hồ sơ bàn giao đã tổng hợp (owner acknowledgment và kiểm thử hoàn thành theo dõi riêng).

- 2026-10-08T10:10:44.796289+00:00: Trường báo Như Ý/Châm Anh đã duyệt và nhận phần việc, yêu cầu push nhánh và PR vào develop. Ghi owner-acknowledgement.json, 12/15 owner CONFIRMED (3 mục còn có Trí/leader không suy nhận việc); review nhãn và runtime retest vẫn PENDING. Chuẩn bị commit gói Day05 cùng bằng chứng Day04 liên quan, không thêm thay đổi runtime chưa thuộc scope.

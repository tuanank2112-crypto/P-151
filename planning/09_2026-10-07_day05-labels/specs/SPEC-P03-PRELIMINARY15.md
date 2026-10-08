# SPEC-P03 — PRELIMINARY_15 (phạm vi Day05 đang hiệu lực)

Quyết định được Cao Văn Trường xác nhận, ghi nhận lúc 2026-10-08T08:59:38.730526+00:00. SPEC này thay các ngưỡng quota rộng trong ARCHITECTURE §1, LABELS §1/2/4/5, TESTING G2/G3 và OPERATIONS khi nghiệm thu Day05. Các yêu cầu review thật, nguyên văn dữ liệu, traceability, backlog và không giả số đo vẫn giữ. Mục tiêu rộng trước đây được giữ làm lịch sử/tham khảo, không tiếp tục chặn Day05 thu gọn.

## Contract chính xác

`Preliminary15Scope` là `deliverables/preliminary15-scope.json`: profile_id=PRELIMINARY_15, required_source_count=15, required_intake_ids=HA-001-01..HA-001-15, source_kind=AUTHORED. Nguồn là `human-authored-intake.json` theo schema day05-human-intake-1. Mỗi bản ghi có text nguyên gốc, source.kind=AUTHORED, source.author=Trường, received_at; authored_at có thể null vì thời điểm tác giả viết chưa được cung cấp, CẤM lấy received_at giả làm authored_at.

Phiếu review schema day05-human-review-sheet-1: review_id HR-nnn ánh xạ duy nhất qua review-key/human15-id-map.json; text phải khớp nguồn. SAFETY assigned_reviewer=Như Ý, CLASSIFICATION assigned_reviewer=Châm Anh. Khi hoàn tất cần label, rationale, spec_refs, reviewed_by, reviewed_at thật; signals có quote/offset khi xuất safety gold; classification có cặp label/ticket_type/playbook_id/reason_code hợp lệ theo CONTRACTS. Review khác tác giả và khác người đề xuất nhãn. Label null hiện tại là CHỜ REVIEW, không là NONE.

Nếu xuất SourceCase/Gold vẫn dùng schema day05-1 của CONTRACTS §2–4; mỗi intake map tới đúng một case_id ổn định, không tái sử dụng ID nguồn 50 câu cũ. Classification eligibility chỉ được chốt sau safety review; câu khác NONE là SAFETY_STOP, loại khỏi mẫu số classification và báo riêng. Chưa có export hoặc baseline mới trong lần xác nhận này.

## Gates thay thế cho Day05 sơ bộ

- G1: backlog đủ 15 mục, issue refs và điều kiện xong hợp lệ; các quyết định/owner cần xác nhận giữ đúng trạng thái, không tự duyệt 14 mục còn lại.
- G2: 15 câu AUTHORED được nhận; safety đủ 15 review thật; classification có quyết định review và cặp hợp lệ cho mọi câu đủ điều kiện. Không ép quota vệ sinh/kỹ thuật/UNKNOWN hoặc quota EM/UNCLEAR/NONE để làm đẹp phân bố. Bất đồng chưa giải quyết không đưa vào gold tính điểm.
- G3: báo family thực tế, nhóm câu 1/2 và 8/13 không tính là family độc lập; rà chéo corpus DEVELOP. Chưa rà xong thì gọi tập đánh giá sơ bộ, không gọi held-out độc lập đã xác minh. Không cần 30 held-out hoặc 32 family. Không dùng 50 câu agent cũ để bù nguồn AUTHORED.
- G4: sau review và khóa dữ liệu, đo baseline offline, ghi correct/eligible/mismatch/error/excluded và family thật. Không đặt ngưỡng >=90% của bộ rộng vào mẫu 15; không suy nghiệm thu toàn diện safety, chất lượng production hoặc Luna từ baseline rules.
- G5: manifest/hash/report cập nhật cùng profile PRELIMINARY_15, reviewer/owner xác nhận theo phạm vi, mọi bằng chứng tồn tại. Day05 chỉ đóng sau review/baseline/report thật.

D4-11 và chính sách ngoài phạm vi vẫn có bộ regression riêng. Runtime safety/API chưa được sửa hoặc retest trong lần này; lỗi sản phẩm còn mở được bàn giao đúng owner, không tự CLOSED. Như Ý/Châm Anh đã được phân công review nhưng chưa có kết quả review.

## Vận hành, rollback và vùng cấm

BẮT BUỘC giữ phiếu review hiện có, text và ID; chưa có review nên không cần dựng lại phiếu. Dùng `validate_day05.py --backlog deliverables/backlog.json` để kiểm cấu trúc backlog. `validate_day05.py --data-dir deliverables` vẫn là validator bộ rộng và không đại diện profile này; không gọi kết quả FAIL quota cũ là lỗi của PRELIMINARY_15 và không đổi hằng số bộ rộng chỉ để PASS. `--structure-only` chỉ kiểm cấu trúc, không đủ nghiệm thu 15 câu. Baseline runner cũ yêu cầu gold/freeze; chỉ tái sử dụng sau khi export dataset riêng và đối chiếu ràng buộc freeze, không chấm từ phiếu trống.

Phạm vi này chỉ đổi hồ sơ/data offline, không đổi src/, DB/Supabase, runtime hoặc phiên bản ứng dụng. Rollback scope cần quyết định mới có mốc thời gian; giữ profile/manifest cũ làm lịch sử, không sửa output evidence cũ. CẤM biến xác nhận scope thành nhãn ACCEPTED, xác nhận backlog toàn bộ hoặc product PASS.

## Phân loại lỗi và caller

- Sai ID/count/source/text: INVALID, dừng export, sửa dữ liệu theo nguồn gốc.
- Reviewer/label chưa có: WAITING_REVIEW, giữ trống, không chạy scoring.
- Dispute hoặc family overlap chưa xử lý: chặn gold/claim độc lập, ghi riêng vấn đề; không thay ID/family để né.
- Gold/runtime mismatch: ghi lỗi và owner, giữ gold, không đổi oracle.
- Thiếu baseline/evidence: NOT_EVALUATED, gate mở; không dùng probe so với proposal làm baseline.

## Bằng chứng thực tế lúc đổi scope

15 câu AUTHORED đã nhận. Review safety/classification hiện 0 hoàn tất; baseline PRELIMINARY_15 chưa chạy. Mốc này chỉ nghiệm thu việc cập nhật scope, không nghiệm thu Day05. Bằng chứng máy: evidence/preliminary15-scope-20261008/scope-check.json và validate-backlog.txt.

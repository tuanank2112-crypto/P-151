# Kiến trúc Day05 — dữ liệu và backlog

> **Phạm vi đang hiệu lực: PRELIMINARY_15**, được Trường duyệt ngày 08/10/2026. Đọc [SPEC-P03-PRELIMINARY15](SPEC-P03-PRELIMINARY15.md) trước; quota 80/40, held-out30 và 32 family bên dưới là mục tiêu rộng trước đây, không còn là cổng bắt buộc của Day05 sơ bộ. Yêu cầu review thật và bằng chứng không đổi.

## 1. Mục tiêu và contract

`Day05Package={backlog,source_cases,classification_gold,safety_gold,disputes,split_manifest,baseline_report,handoff_summary}` theo01-CONTRACTS. Tất cả đầu ra thi công nằm dưới deliverables/ của hồ sơ09; chưa tạo dữ liệu giả trong lượt lập plan. Thứ tự đọc: CONTRACTS → BACKLOG → LABELS → OPERATIONS → TESTING.

Đề xuất minimum80 source cases được review:20 EMERGENCY,20 UNCLEAR,40 NONE; tất cả80 có safety gold. Classification gold có40 case risk NONE, phân bố15 vệ sinh/15 chiếu sáng/10 UNKNOWN (gồm ngoài phạm vi và mixed). Chia develop50 (15EM,15UNCLEAR,20NONE) và held-out30 (5EM,5UNCLEAR,20NONE); ≥32 family độc lập, tối đa3 câu/family, ngoại lệ family D4-11 đã biết có thể lớn hơn nhưng chỉ DEVELOP và có lý do trong manifest. Held-out classification20:7 vệ sinh/7 đèn/6 UNKNOWN; develop20:8/8/4. Đây là mục tiêu xây dữ liệu, không phải số đo đã có. Nếu chưa đủ nhãn ACCEPTED, không bù bằng câu sao chép hoặc hạ tiêu chí; report số thật.

## 2. Bất biến và vùng cấm

- Safety là nhãn nguy cơ, classification là loại công việc; không dùng risk làm loại dịch vụ. Safety UNCLEAR/EMERGENCY không vào classification-gold dùng đánh giá pipeline; ghi eligibility SAFETY_STOP.
- `classify(text)`/`propose(text)` và `assess(text,lexicon)` là hai phép đo độc lập; pipeline có safety stop trước classification. LLM chỉ nhận văn bản classification hiện tại, không có vision/safety LLM trong runtime này.
- BẮT BUỘC trace source/proposal/reviewer/rationale và group split. CẤM dùng output model làm gold, sửa nhãn theo code đang sai, hạ risk để đạt score, tuning held-out hoặc lẫn paraphrase cùng family vào2 split.
- Không sửa src/, seed/ cũ, tests/ cũ hoặc Supabase. Không thêm vision, LangGraph, blocker/resume Day06 hoặc deploy trong gói Day05. D4-11 đã biết là dev/regression, không đưa vào held-out để khoe chất lượng.
- Nhãn/reviewer ACCEPTED phải là người thật. Agent/model có thể đề xuất và kiểm schema; không ký review thay người hoặc leader.

## 3. Vai trò

Trường giữ backlog/câu/expected/report. Như Ý review safety và nhận bug engine/lexicon, Châm Anh nhận API/storage/tích hợp, Trí nhận UI, leader duyệt ưu tiên/scope. Phân công là đề xuất theo hồ sơ hiện có, không suy rằng người đã nhận việc. GPT-6 Luna hỗ trợ đề xuất khi có quyền gọi API, không làm reviewer độc lập của chính output.

## 4. Lỗi và caller

Gold tranh chấp ⇒ NEEDS_REVIEW, không score. Không đủ số ACCEPTED ⇒ gate dữ liệu còn mở, giữ số thật. Runtime sai gold ⇒ mở issue đúng owner, không đổi oracle. Thiếu reviewer ⇒ chuẩn bị proposal, không tự mark ACCEPTED. LLM/auth lỗi ⇒ dừng batch model, ghi lỗi và dùng soạn offline; không đổi thành successful LLM evaluation.

## 5. Bằng chứng hiện có và nghiệm thu

Đã có62 câu nhãn safety trong test_safety_p0.py,34 ca seed safety_cases.json và các corpus metamorphic; đây là nguồn rà coverage, không coi độc lập mới nếu copy. D4-11 local3 biến thể:2 FAIL/1 control PASS; ảnh UI khác câu/tòa không phân lập nhân quả. Demo Supabase đã có Luna SUCCESS nhưng chưa chứng minh classification≥90%. Day05 chỉ nghiệm thu chất lượng/scope/gold/split/backlog và baseline thật; không bắt buộc sửa hết runtime mới được chốt dữ liệu.


## Xác nhận phạm vi địa điểm (2026-10-08T08:45:45.700329+00:00)

Trường xác nhận: vệ sinh và chiếu sáng bên trong cabin thang máy, khu vực thang bộ thoát hiểm thuộc hai use case MVP; đèn trong khuôn viên nội khu chung cư thuộc phạm vi BQL quản lý. Áp dụng câu 8,9,13,14,15 của human-authored-intake.json. Câu 15 được tác giả làm rõ là đường nội khu, giữ nguyên text gốc. Xác nhận phạm vi không đồng nghĩa giao mọi ticket cho BQL: loại việc thông thường vẫn theo playbook/phòng ban; quyền quản lý khu vực và owner blocker safety là các trục riêng. Chưa xác nhận asset cụ thể hoặc kết quả API. Không mở rộng sang bảo trì cơ khí thang máy hay đèn ngoài khuôn viên. 15 câu AUTHORED vẫn chờ review nhãn/family, chưa nhập held-out; chưa duyệt giảm quota hay chính sách khẩn cấp ngoài phạm vi S5.


## Chính sách ngoài phạm vi được duyệt (2026-10-08T08:55:52.078704+00:00)

Trường phê duyệt D5-POL-OUTSIDE-SAFETY-01. Phản ánh ngoài phạm vi: NONE → BPTN xác minh phạm vi, không tự giao phòng ban thí điểm; EMERGENCY → BQL xem xét khẩn cấp (`EMERGENCY_PENDING_BQL`), cảnh báo địa điểm ngoài phạm vi cần xác minh/chuyển tiếp, không tự điều đội thí điểm; UNCLEAR → BPTN xác minh an toàn (`SAFETY_REVIEW_REQUIRED`), không hạ mức chỉ vì ngoài phạm vi. Chính sách này làm rõ ưu tiên safety theo CR-03 §5–6, không thêm enum hoặc endpoint.

Chính sách đã được duyệt là hành vi đích, chưa được xác nhận runtime/API. Câu S5 D411-T09/T10 được bổ sung expected route; nhãn từng câu vẫn PROPOSED, D4-11 vẫn OPEN. Như Ý đối chiếu safety, Châm Anh retest API cùng build. Không suy duyệt quota 15 thay 30 hoặc nghiệm thu Day05 từ quyết định này. File máy đọc: `planning/09_2026-10-07_day05-labels/deliverables/outside-scope-safety-policy.json`. Các đoạn trước ghi “chưa chốt chính sách S5” là lịch sử và được thay thế bởi quyết định này.

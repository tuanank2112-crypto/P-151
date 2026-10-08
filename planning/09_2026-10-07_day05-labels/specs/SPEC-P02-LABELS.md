# SPEC-P02 — mở rộng câu và tách nhãn

> **Phạm vi đang hiệu lực: PRELIMINARY_15**, được Trường duyệt ngày 08/10/2026. Đọc [SPEC-P03-PRELIMINARY15](SPEC-P03-PRELIMINARY15.md) trước; quota 80/40, held-out30 và 32 family bên dưới là mục tiêu rộng trước đây, không còn là cổng bắt buộc của Day05 sơ bộ. Yêu cầu review thật và bằng chứng không đổi.

## 1. Contract

Dùng SourceCase, ClassificationGold, SafetyGold, Review, Dispute theo01-CONTRACTS §2–§4. Dữ liệu staging trong deliverables/, không sửa seed/test nhãn cũ. Mục tiêu80 câu safety và40 câu classification theo ARCHITECTURE §1; chỉ ACCEPTED mới tính nghiệm thu.

## 2. Chia việc

- L1, 20–30 phút: rà nguồn62/34 và corpus metamorphic; map hiện tượng đã có/chưa có, không nhập bản sao để đủ số.
- L2, 45–60 phút: soạn40 câu NONE:15 vệ sinh,15 chiếu sáng,10 UNKNOWN; có ngữ cảnh khu vực chung, câu cư dân, không dấu/chính tả, thiếu vị trí, nội dung mixed.
- L3, 45–60 phút: soạn20 EMERGENCY +20 UNCLEAR, phủ hazard P0, phủ định, hiện tại/quá khứ/đã hết, từ đa nghĩa/nghe nói; trích đoạn làm căn cứ.
- L4, 60–90 phút: người review đọc text và CR, chưa nhìn prediction baseline; chốt hai gold riêng, mở dispute nếu chưa đồng thuận.
- L5, 20–30 phút: group và chia split đúng quota; kiểm duplicate/leakage, đóng manifest/hash. Ca đã biết lỗi chỉ ở DEVELOP.
- L6, 30–45 phút: baseline offline, review report. Luna optional theo scope/cost đã được cho phép; SUCCESS/fallback/error tách riêng.

Nếu thiếu thời gian, chia buổi1 backlog+proposal và buổi2 review+split+baseline. Không tự ACCEPTED để kịp lịch; thời gian người duyệt có thể làm tổng thời gian tăng.

## 3. Nhóm bắt buộc D4-11 — DEVELOP/regression

Giữ câu gốc “có trẻ con bị kẹt ở sảnh chung cư tòa S5”. Thiết kế matrix cùng wording × S1/S5, “bị kẹt”/“bị mắc kẹt”, trẻ con/trẻ nhỏ/em bé. Tối thiểu4 positive EM có người thật bị kẹt +4 negative/control: phủ định hazard, kẹt xe, kẹt cửa không có người. Mỗi gold phải review ngữ cảnh, không gán EM cho mọi chữ “kẹt”.

Nhóm lỗi đã biết này có thể >3 câu/family, là ngoại lệ phải ghi manifest; tất cả ở DEVELOP, không tăng mẫu số held-out. Hazard phải được nhận trước vị trí. Không ép classification cho EM/UNCLEAR. S5 ngoài thí điểm được ghi notes; không suy loại công việc UNKNOWN chỉ vì tòa nếu nội dung công việc khu vực chung đã rõ.

## 4. Reviewer và Luna

Trường đề xuất câu/nhãn; reviewer classification phải khác người đề xuất; Như Ý/leader review safety hoặc nhãn tranh chấp. Thiếu reviewer ⇒ giữ PROPOSED. Model review không thay review của người. Held-out phải là câu AUTHORED mới do người soạn, chưa dùng tuning; không lấy câu do cùng model đề xuất để khẳng định chất lượng độc lập của chính model đó.

Luna được dùng để đề xuất phản ví dụ và nhãn ứng viên trên DEVELOP; lưu label-proposals riêng, không gửi PII/key/gold vào API. Chưa có lời hứa về credit/quota; thiếu API không chặn soạn câu và baseline rules offline.

## 5. Lỗi và nghiệm thu

Pair/quote sai, group leakage ⇒ validator fail; tranh chấp ⇒ NEEDS_REVIEW, không score. Gold đúng nhưng baseline sai ⇒ backlog đúng owner, giữ gold. Chưa đủ ACCEPTED ⇒ báo số thật, gate còn mở; không trộn proposal vào gold.

Xong khi validator exit0: ≥80 safety gold ACCEPTED, ≥40 classification gold ACCEPTED, ≥32 family, 0 leakage, 0 OPEN dispute trong gold, 0 nhãn thiếu reviewer/rationale/spec. Baseline có counts/mismatch/error thật. Target classification held-out≥90% không được nhận là đã đạt chỉ vì có20 câu eligible.

## Vùng cấm

CẤM tự duyệt nhãn mình đề xuất, giả reviewer hoặc timestamp; CẤM dùng câu D4-11 đã biết lỗi làm held-out; CẤM sửa gold để khớp dự đoán runtime.

# Hướng dẫn review mù Day05 (dành cho NGƯỜI review)

> Trạng thái: **bản chuẩn bị của agent — chưa có review nào.** Mọi `classification-gold.json`, `safety-gold.json`, `disputes.json` hiện rỗng (`records: []`). Agent KHÔNG điền ACCEPTED, `reviewed_by`, `reviewed_at`.

## 1. Quy tắc độc lập (BẮT BUỘC)
- Reviewer là **người thật**, khác người đề xuất nhãn của câu đó (Trường đề xuất ⇒ Như Ý/leader review; và ngược lại).
- Review **mù**: chỉ nhìn `blind-review-sheet.json` (khoá `case_id` chứa ID mờ `RV-nnn` + text, thứ tự đã xáo). KHÔNG mở `../review-key/id-map.json` (bảng RV→case_id chỉ cho người điều phối ghép nhãn vào gold sau review). KHÔNG mở `cases.json`, `label-proposals.json`, `baseline-results.json`, kết quả `assess/classify` trước khi chốt nhãn.
- Không dùng LLM/agent làm reviewer. Ghi `reviewed_by` bằng tên người thật, `reviewed_at` bằng thời điểm thật lúc review.
- Không sửa text câu. Lỗi chính tả/không dấu là một phần dữ liệu.

## 2. Nhãn safety (đọc CR-BPTN-03 §6)
| Nhãn | Khi nào | Ghi gì |
|---|---|---|
| `EMERGENCY` | Có ≥1 tín hiệu Bậc 1 **đang** xảy ra, không phủ định, không nghi ngờ, không "đã hết" (S-01..S-05, S-09, S-14 là phase P0) | signals: id + `PRESENT` + trích đoạn nguyên văn + `start`/`end` (codepoint Python) |
| `UNCLEAR` | Bậc 1 bị hạ vì nghi ngờ (T2-01) hoặc đã xảy ra & đã hết (T2-02); hoặc Bậc 2: từ đa nghĩa không ngữ cảnh lành tính (T2-03), âm thanh lạ (T2-04), vệ sinh một dấu hiệu (T2-05) | signal `UNCLEAR` + quote, hoặc T2-xx |
| `NONE` | Không có tín hiệu thật; hoặc tín hiệu bị phủ định rõ/ngữ cảnh lành tính | `signals=[]` hoặc `ABSENT` + quote |
- Chưa chắc giữa EMERGENCY và UNCLEAR ⇒ KHÔNG đoán: mở **dispute** (§4). Hazard phase P1 (gas, giật điện, vật rơi, hóa chất…) không tính vào gate P0; ghi `spec_refs` rõ nếu gặp.
- "Kẹt" không tự động là EM: kẹt xe, kẹt cửa không có người ⇒ xét theo ngữ cảnh (có người thật bị mắc kẹt/nguy hiểm hay không).

## 3. Nhãn classification (chỉ cho câu risk NONE)
Ba cặp hợp lệ duy nhất: `VE_SINH/COMMON_AREA_CLEANING/PB-CLN-01`; `KY_THUAT/COMMON_AREA_LIGHTING/PB-TEC-01`; `UNKNOWN/UNKNOWN/null`. UNKNOWN: `reason_code=CATEGORY_UNCLEAR` (mixed, khớp cả hai) hoặc `OUT_OF_SCOPE` (không thuộc 2 playbook). Vị trí (tòa/tầng) và loại việc là hai trục độc lập: thiếu tòa không làm UNKNOWN nếu việc ở khu vực chung đã rõ. Câu risk khác NONE ⇒ không có classification gold (`SAFETY_STOP`).

## 4. Dispute
Không đồng thuận ⇒ thêm bản ghi `Dispute` (01-CONTRACTS §4): `question` một dòng, `owner` người quyết, `status=OPEN`. Case có dispute OPEN: review status `NEEDS_REVIEW`, **không** vào gold, không tính điểm. Khi người quyết chốt: `RESOLVED` + `decision` + `decision_at` thật; nhãn đổi ⇒ ghi lịch sử, không ghi đè.

## 5. Held-out
Câu held-out phải do NGƯỜI soạn mới (`source.kind=AUTHORED`), chưa dùng để tuning, không cùng family với DEVELOP, không phải D4-11. Agent không tạo nguồn này; xem `held-out-request.md`.

## 6. Sau review (người chạy)
1. Điền gold ACCEPTED (có `reviewed_by`, `reviewed_at`, `rationale`, `spec_refs`) ⇒ tạo `split-manifest.json`.
2. `python deliverables/tools/validate_day05.py --data-dir deliverables` phải exit 0.
3. Freeze hash (`frozen:true`) ⇒ mới chạy baseline held-out. Không chỉnh gold theo kết quả runtime.

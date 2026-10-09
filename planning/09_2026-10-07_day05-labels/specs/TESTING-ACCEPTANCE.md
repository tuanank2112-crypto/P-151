# Testing & acceptance — Day05

> **Phạm vi đang hiệu lực: PRELIMINARY_15**, được Trường duyệt ngày 08/10/2026. Đọc [SPEC-P03-PRELIMINARY15](SPEC-P03-PRELIMINARY15.md) trước; quota 80/40, held-out30 và 32 family bên dưới là mục tiêu rộng trước đây, không còn là cổng bắt buộc của Day05 sơ bộ. Yêu cầu review thật và bằng chứng không đổi.

## 1. Gates local

- ⬜ G1 backlog: mỗi item có source/evidence/owner/priority/decision/xong khi; CRITICAL=P0; CONFIRMED và CLOSED phải có xác nhận/retest thật.
- ⬜ G2 annotation: ≥80 source/safety gold ACCEPTED (20EM,20UNCLEAR,40NONE), ≥40 classification gold (15CLN,15TEC,10UNKNOWN); 0 badquote/pair/ID/ref, 0 OPEN dispute trong gold, 0 review không phải người.
- ⬜ G3 split: develop50/held-out30 theo quota ARCHITECTURE, classification held-out20 (7/7/6), ≥32 families, 0 family leakage. D4-11 chỉ DEVELOP; ngoại lệ family>3 có lý do trong manifest.
- ⬜ G4 baseline: counts correct/eligible/mismatch/error/fallback và family thật; safety FN/FP riêng, classification accuracy riêng; failures có owner. Safety-stopped không tính classification fail.
- ⬜ G5 bàn giao: JSON/hash/report đủ, reviewer/leader duyệt thật; H/R đúng quy tắc nếu sau này giao worker; mọi evidence ref tồn tại.
- ⬜ runtime safety fix: D4-11 chỉ CLOSED sau retest đúng hành vi cùng build. Bug còn mở không chặn chốt dữ liệu nếu gold/repro/backlog đã duyệt, nhưng chặn đề xuất nghiệm thu MVP safety.
- ⬜ online/product: ngoài scope Day05, không tick từ dataset offline.

## 2. Planned command gates

`python <plan>/deliverables/tools/validate_day05.py --data-dir <plan>/deliverables` → exit0, counts đạtG2/G3, 0 badpair/quote/reviewer/ref/leakage. Negative controls: sửa1 pair,1 quote,1 group split,1 reviewer trong copy in-memory → exit1/exception; nguồn giữ nguyên.

`python <plan>/deliverables/tools/run_day05_baseline.py --data-dir <plan>/deliverables --mode rules --split develop --output <plan>/deliverables/baseline-results.json` → exit0 khi chạy được; mismatch được ghi riêng, không sửa gold. Held-out chỉ chạy khi freeze. Luna optional báo SUCCESS/fallback/error và coverage.

Nếu thêm tools/tests: `python -m ruff check <tools/tests mới>` và `python -m pytest <tests mới> -q` → exit0,0skip, negative controls từng đỏ. Không dùng DB chung. Typecheck chưa cấu hình, ghi NOT_CONFIGURED. Lượt chỉ lập SPEC kiểm cấu trúc/ref/contract, không chạy lại2973 test ứng dụng.

## 3. Metrics và ý nghĩa

Classification held-out target≥90%: ≥18/20 nếu đủ quota; nêuN20, family count, synthetic, errors và phạm vi2 playbook. Không suy accuracy ngoài sản phẩm từ mẫu nhỏ.

Safety báo nEM expected/predicted, FN_EM và FP_EM từ NONE/UNCLEAR; target FN_EM=0, không giấu FP. D4-11 known fail không được hạ gold để đạt target.

Hoàn thành Day05 là backlog/gold/split được review và baseline/report đúng thật. Runtime còn sai được chuyển owner; không phải sửa mọi bug mới chốt dữ liệu. Duyệt backlog/gold không đồng nghĩa nghiệm thu MVP.

## 4. Lỗi và caller

Thiếu quota/reviewer/hash/ref ⇒ gate mở. Counts/leakage sai ⇒ sửa corpus/split trước export. Dispute ⇒ không score. Gold/code khác nhau ⇒ đo/issue, không đổi oracle. Fallback ⇒ không tính accuracy Luna. Evidence bị sửa ⇒ đo lại, không chỉnh output. Report chỉ có số đã đo.

## 5. Evidence hiện tại

Mới có nguồn cũ và probe D4-11; dataset80/gold40/split/baselineDay05 CHƯA THỰC HIỆN. Plan cần kiểm7 file, refs, contract và negative controls, output evidence/planning/. Startup hub thiếu exit1, luật managed giữ nguyên. Không cần chờ Supabase/public URL để làm dữ liệu offline.

## Vùng cấm nghiệm thu

CẤM ghi PASS khi chưa chạy, thay kết quả lỗi bằng fallback không ghi trạng thái, hoặc đóng product safety gate khi D4-11 chưa retest thành công.


## Chính sách ngoài phạm vi được duyệt (2026-10-08T08:55:52.078704+00:00)

Trường phê duyệt D5-POL-OUTSIDE-SAFETY-01. Phản ánh ngoài phạm vi: NONE → BPTN xác minh phạm vi, không tự giao phòng ban thí điểm; EMERGENCY → BQL xem xét khẩn cấp (`EMERGENCY_PENDING_BQL`), cảnh báo địa điểm ngoài phạm vi cần xác minh/chuyển tiếp, không tự điều đội thí điểm; UNCLEAR → BPTN xác minh an toàn (`SAFETY_REVIEW_REQUIRED`), không hạ mức chỉ vì ngoài phạm vi. Chính sách này làm rõ ưu tiên safety theo CR-03 §5–6, không thêm enum hoặc endpoint.

Chính sách đã được duyệt là hành vi đích, chưa được xác nhận runtime/API. Câu S5 D411-T09/T10 được bổ sung expected route; nhãn từng câu vẫn PROPOSED, D4-11 vẫn OPEN. Như Ý đối chiếu safety, Châm Anh retest API cùng build. Không suy duyệt quota 15 thay 30 hoặc nghiệm thu Day05 từ quyết định này. File máy đọc: `planning/09_2026-10-07_day05-labels/deliverables/outside-scope-safety-policy.json`. Các đoạn trước ghi “chưa chốt chính sách S5” là lịch sử và được thay thế bởi quyết định này.

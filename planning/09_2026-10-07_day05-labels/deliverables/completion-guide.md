# Hồ sơ hoàn thiện Day05 — phần chuẩn bị và phần cần người

> **Hiện hành (08/10/2026): PRELIMINARY_15 đã được Trường duyệt.** 15 câu AUTHORED đã nhận; chờ review Như Ý/Châm Anh và baseline. Các mốc 30 held-out, 80/40 gold phía dưới là lịch sử, không còn là quota nghiệm thu Day05 sơ bộ. Xem SPEC-P03-PRELIMINARY15.

Trạng thái: PREPARED / WAITING_HUMAN_INPUT. Không đóng Day05 hoặc nghiệm thu MVP.

## 1. Câu kiểm thử D4-11 đã chuẩn bị

`d411-test-matrix.json` có 10 câu DEVELOP/regression: 4 positive trong S1/S2, 4 control trong S1/S2 và 2 câu S5 ngoài thí điểm. Kết quả mong đợi là proposal cần review, không phải gold ACCEPTED. S5 không phải địa điểm hợp lệ để nghiệm thu luồng BQL thí điểm; chính sách chuyển tiếp khẩn cấp ngoài phạm vi còn chờ nhóm.

Như Ý dùng bộ câu này để đối chiếu bản sửa safety. Châm Anh kiểm tra API trên cùng build, ghi ticket ID, build SHA, request/response đã bỏ thông tin bí mật, risk level, blocker và owner thực tế. Không suy API/UI đúng chỉ từ assess(). Trường giữ kết quả mong đợi tách biệt khỏi kết quả runtime. Không sửa nhãn chỉ để khớp engine.

## 2. Người soạn bổ sung 30 câu độc lập

Điền `held-out-authoring-form.json`: 5 câu nguy hiểm, 5 câu chưa rõ nguy hiểm, 20 câu không nguy hiểm (7 vệ sinh, 7 chiếu sáng, 6 ngoài hai loại việc hoặc chưa rõ loại). Mỗi slot điền text, author, authored_at, family_id, phenomena, notes. Target của slot chỉ để cân bằng nguồn; reviewer vẫn phải đánh giá nội dung thật.

Không dùng câu D4-11, không chép câu DEVELOP hoặc fixture cũ. Không chia biến thể cùng hiện tượng thành hai family để tạo cảm giác độc lập. Chỉ ghi AUTHORED khi người thực sự tự soạn; agent không tự điền tác giả người. Mẫu này chưa phải corpus, không nhập vào cases.json khi còn trường rỗng.

## 3. Duyệt nhãn riêng

Bộ 50 câu hiện có nằm trong `review/blind-review-sheet.json`; hướng dẫn ở `review/REVIEW-GUIDE.md`. Người review đọc nội dung và CR-03, không đọc proposal hoặc prediction trước. Safety chọn NONE/UNCLEAR/EMERGENCY, ghi tín hiệu/trích đoạn, rationale, reviewer và thời gian thật. Classification chọn VE_SINH/KY_THUAT/UNKNOWN chỉ cho câu safety NONE đủ điều kiện. Reviewer phải khác người đề xuất; Như Ý có thể review safety nếu xác nhận nhận phần review riêng, không suy từ việc nhận sửa engine.

Bảng `review-key/id-map.json` chỉ dành cho điều phối ánh xạ ID, không gửi reviewer. Sau khi người soạn 30 câu mới, tạo review pack riêng cho chúng trước khi mở prediction. Không đánh dấu ACCEPTED khi chưa nhận quyết định thật. Nếu bất đồng, ghi disputes thay vì ép nhãn.

## 4. Chốt backlog và chính sách còn thiếu

`backlog-approval-form.json` liệt kê đủ 15 mục để người có trách nhiệm xác nhận hoặc yêu cầu đổi. D5-B-011 đã xác nhận phân công; 14 mục khác vẫn PROPOSED. Không cần sửa mọi lỗi sản phẩm để đóng gói dữ liệu Day05, nhưng backlog phải có quyết định và trách nhiệm thật.

Các lựa chọn contract cần ghi quyết định rõ: (a) risk_level là số đo safety chính, signals đối chiếu riêng; (b) freeze hash phải ràng buộc corpus, gold, split và phiên bản công cụ; (c) đóng bug cần kết quả retest cùng build, không chỉ đường dẫn file tồn tại; (d) trạng thái tín hiệu T2 phải thống nhất với CR-03. Đây là các điểm chờ duyệt, không phải luật mới tự áp dụng.

## 5. Thứ tự chạy sau khi nhận đủ dữ liệu và quyết định

1. Ánh xạ review vào safety-gold/classification-gold theo CONTRACTS; giữ proposal độc lập, ghi disputes thật.
2. Kiểm quota 80 safety và 40 classification, đủ family và không rò giữa DEVELOP/HELD_OUT. Mẫu authoring không tính quota.
3. Chạy `python deliverables/tools/validate_day05.py --data-dir deliverables` từ thư mục kế hoạch; cần exit 0 trước khi đóng gói.
4. Freeze split theo contract đã duyệt và hash mới, không sửa snapshot lịch sử.
5. Chạy `python deliverables/tools/run_day05_baseline.py --data-dir deliverables --mode rules --split develop --output deliverables/baseline-develop.json`, sau đó `--split held-out --output deliverables/baseline-heldout.json`.
6. Ghi số correct/eligible/mismatch/error, safety FN/FP và classification accuracy riêng; giao lỗi cho owner đã xác nhận, cập nhật report/manifest.
7. Chỉ đóng Day05 khi G1–G5 đạt và người duyệt xác nhận. Runtime safety và nghiệm thu online là các gate riêng.

Python trong .venv trên máy hiện tại bị lỗi launcher; dùng Python portable `C:/P-151/.python/cpython-3.11.16-windows-x86_64-none/python.exe` và PYTHONPATH trỏ root repo cùng .venv/Lib/site-packages như commands.json. Không cần Supabase hoặc ghi DB chung cho các bước offline này.

## 6. Bằng chứng mới

[Xem lệnh, mã thoát](../evidence/day05-completion-20261007/commands.json), [probe safety](../evidence/day05-completion-20261007/d411-rules-probe.json). Probe so với proposal không được coi là gold baseline. Manifest mới là snapshot bàn giao chuẩn bị, không phải freeze split hoặc xác nhận chất lượng.


## Chính sách ngoài phạm vi được duyệt (2026-10-08T08:55:52.078704+00:00)

Trường phê duyệt D5-POL-OUTSIDE-SAFETY-01. Phản ánh ngoài phạm vi: NONE → BPTN xác minh phạm vi, không tự giao phòng ban thí điểm; EMERGENCY → BQL xem xét khẩn cấp (`EMERGENCY_PENDING_BQL`), cảnh báo địa điểm ngoài phạm vi cần xác minh/chuyển tiếp, không tự điều đội thí điểm; UNCLEAR → BPTN xác minh an toàn (`SAFETY_REVIEW_REQUIRED`), không hạ mức chỉ vì ngoài phạm vi. Chính sách này làm rõ ưu tiên safety theo CR-03 §5–6, không thêm enum hoặc endpoint.

Chính sách đã được duyệt là hành vi đích, chưa được xác nhận runtime/API. Câu S5 D411-T09/T10 được bổ sung expected route; nhãn từng câu vẫn PROPOSED, D4-11 vẫn OPEN. Như Ý đối chiếu safety, Châm Anh retest API cùng build. Không suy duyệt quota 15 thay 30 hoặc nghiệm thu Day05 từ quyết định này. File máy đọc: `planning/09_2026-10-07_day05-labels/deliverables/outside-scope-safety-policy.json`. Các đoạn trước ghi “chưa chốt chính sách S5” là lịch sử và được thay thế bởi quyết định này.


## Scope Day05 đã duyệt: PRELIMINARY_15 (2026-10-08T08:59:38.730526+00:00)

Trường xác nhận đánh giá sơ bộ bằng 15 câu do Trường tự soạn thay yêu cầu 30 câu held-out. Các quota 80 safety/40 classification và minimum32 family của hồ sơ rộng không còn chặn nghiệm thu Day05 sơ bộ. Vẫn cần review safety bởi Như Ý, classification bởi Châm Anh, kiểm tra nhóm biến thể/nguồn, baseline thật, xác nhận backlog và report/manifest. Không suy nghiệm thu safety đầy đủ, API/online hoặc chất lượng tổng quát. Hiện: 15 AUTHORED, review hoàn tất 0, baseline chưa chạy. Contract đang hiệu lực: planning/09_2026-10-07_day05-labels/specs/SPEC-P03-PRELIMINARY15.md. Quota cũ và bằng chứng cũ được giữ làm lịch sử.

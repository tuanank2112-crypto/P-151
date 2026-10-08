# SPEC-P01 — chốt backlog còn lại

## 1. Contract đầu vào/đầu ra

Đầu vào: issues.json của hồ sơ07 (11 issues), roadmap, H03/H04/H05 của hồ sơ04, code và CR-03. Đầu ra: BacklogItem[] theo01-CONTRACTS §5, cùng deliverables/backlog-summary.md. Nguồn lịch sử phải giữ build/môi trường; không tự coi là lỗi của bản hiện tại.

## 2. Chia việc

- B1, 30 phút: kiểm kê từng issue, xác nhận evidence tồn tại; hợp nhất mục trùng căn nguyên và giữ mọi ref.
- B2, 30 phút: gán kind, severity, priority, NOW/NEXT/DEFER/NO_ACTION. Owner vẫn PROPOSED tới khi có xác nhận thật.
- B3, 30–45 phút: viết expected/actual, phụ thuộc và done_when.command + expected_result. Không dùng “sửa xong” làm tiêu chí.
- B4, 15–30 phút: Trường rà scope; leader và owner xác nhận ưu tiên/nhận việc, ghi tên và thời điểm thật.

## 3. Ưu tiên khởi điểm — đề xuất

- D4-11 trẻ bị kẹt: BUG/CRITICAL/P0/NOW, Như Ý. Probe local bỏ sót cùng wording ở S1/S5; thêm “mắc” thì đúng BQL. Trường cung cấp câu/nhãn/repro, Châm Anh tích hợp và retest API. Xong khi test biến thể, phủ định/đa nghĩa và regression không bỏ sót, API/UI đưa đúng BQL; sửa runtime ngoài gói dữ liệu này.
- D4-06 create422: BUG/MAJOR/P1/NOW, Như Ý + Châm Anh. Giữ FIXED_PENDING_RETEST tới khi đo tạo ticket mới trả201. Recovery CLOSED chưa đủ đóng lỗi.
- Thiếu fingerprint/thời gian, ảnh lệch ticket, GET sau guard, resume lặp: EVIDENCE/P1/NEXT, Trường phối hợp đúng owner. Không làm lại ca đã loại khỏi Day04.
- Ngoài giờ, wording, API/UI của H03/H04: rà trạng thái build hiện tại, owner Châm Anh/Trí; điểm chưa xác minh ghi SPEC/EVIDENCE, không khẳng định bug đã tái hiện.
- Vision, LangGraph, P1 merge/follow-up: FEATURE/DEFER theo lịch. Day06 blocker/resume và engine↔graph là task tiếp theo, không chen vào gold Day05.
- R01 memory không lưu bền là giới hạn lịch sử: NO_ACTION cho yêu cầu sửa memory để lưu bền; giữ bằng chứng Supabase riêng.

## 4. Vùng cấm và xử lý lỗi

CẤM reset DB, chạy jobs, gọi API ghi để phân loại backlog; tự gửi tin, giả owner CONFIRMED, đóng issue bằng lời hứa hoặc giảm severity bỏ sót safety. Thiếu evidence/build ⇒ item EVIDENCE có dependency; tranh chấp priority ⇒ leader quyết định và ghi lịch sử.

## 5. Nghiệm thu

CLI dự kiến: `python <plan>/deliverables/tools/validate_day05.py --backlog <plan>/deliverables/backlog.json`. Xong khi exit0, 0 mục thiếu owner/priority/evidence/done_when; 0 CLOSED thiếu retest; mọi source issue được xử lý hoặc hợp nhất có lý do. Report số item theo priority/decision/owner acceptance. Chưa có số đo backlog mới trong lượt lập plan.

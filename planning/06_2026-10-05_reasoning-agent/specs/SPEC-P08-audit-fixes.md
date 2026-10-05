# SPEC-P08 — Sửa sau thẩm định đối kháng R12 (F1–F11)

| Mục | Giá trị |
|---|---|
| Nguồn | `reports/R12_tham-dinh_WP12.md` §5 (F1 CHẶN, F2–F11 GHI); quyết định SO Q28 (plan.md §2) |
| Gói | WP14 (🔴: F1, F3, F10, F2/F11 từ vựng) · WP15 (🟠: F4–F9 phối hợp) |
| Probe tái hiện | `evidence/WP12/probes/*.py` (chỉ đọc; chép logic vào test, KHÔNG import từ evidence) |

## 1. F1 — bổ sung của cư dân LUÔN chạy lại 2b (WP14)
Nguồn: CR-BPTN-03 §5.2 "Sau mọi bổ sung văn bản … luôn chạy lại 2b", AC-08, §6.4 T06; bất biến V-05.
- Chỗ: `MaintenanceEngine._resume_activated` (`src/maintenance/engine.py`). Khi `blocker.code == MISSING_INFO` và `_cleared(...)` là False:
  - tính `level` = mức 2b của `_safety_scope_text(work)` bằng ĐÚNG đường 2b dùng (có `DecisionView` khớp vân tay an toàn ⇒ `safety_for(record, …)`; không ⇒ `assess_with_llm(...)`), KHÔNG ghi gì;
  - `level != NONE` ⇒ `_apply_transition(work, RECEIVED, SYSTEM, …, note="Bổ sung có dấu hiệu an toàn", safety_context=False)` rồi `_run_pipeline(work, 2, now)` (2b chạy đầu tiên, dừng Bậc 1 ⇒ `EMERGENCY_PENDING_BQL` + `emergency.created`; Bậc 2 ⇒ `SAFETY_REVIEW_REQUIRED`), trả True;
  - `level == NONE` ⇒ giữ nguyên hành vi cũ (tiếp tục chờ vị trí), trả False.
- Áp cho MỌI đường gọi `_resume` từ `add_resident_info` (luật và Agent). Đường `_tick` (job) KHÔNG chạy lại 2b nếu không có bổ sung mới sau `blocker.since` (tránh lặp).
- BẮT BUỘC: mức không bao giờ giảm (I-17, `max` sẵn có ở 2b). CẤM: tự hạ, bỏ qua 2b khi thiếu vị trí, gọi mô hình trong khoá.
- Lỗi: 2b ném ngoại lệ ⇒ cả giao dịch rollback (như mọi `op`), bổ sung KHÔNG được lưu nửa vời.
- Nghiệm thu: 6 câu + 1 ca T06 của `extra_addition_not_assessed.py` ⇒ 6 ticket rời `NEED_INFO` với `risk_level ≠ NONE`, ca T06 ⇒ `EMERGENCY` (đỏ trước sửa, xanh sau); câu bổ sung vô hại ("ở tầng 3 ạ") ⇒ vẫn `NEED_INFO/MISSING_INFO`, không thêm `emergency.created`.

## 2. F3 — vị trí của Agent BẮT BUỘC có trích dẫn (WP14)
Sửa P01 §3.2: `LocationDecision.quote` rỗng/None mà Agent điền bất kỳ phần nào (building/floor/area) ⇒ loại cả vị trí: trả `(None, ("building","floor","area"), ["location"])` như quote bịa. Chỗ: `agent/validate.py::_check_location`.
- Hệ quả bắt buộc: thiếu vị trí ⇒ luật vị trí quyết (`rv.location`), luật cũng không có ⇒ hỏi cư dân (P02 §6.2). CẤM: dùng vị trí không trích dẫn dù hợp lệ danh mục.
- Nghiệm thu: 3 ca ROUTED sai nơi của `extra_invented_location.py` ⇒ `NEED_INFO`/hỏi vị trí; câu trộn không vị trí ⇒ KHÔNG tách. Test cũ có vị trí kèm quote đúng vẫn xanh.

## 3. F10 — vai sai ⇒ 403 + `ACTION_DENIED` (WP14)
Chỗ: `MaintenanceEngine.transition` (`engine.py`, đoạn sau `reachable`). Khi `rule = TRANSITIONS.get((current, to))` tồn tại, không `pipeline_only`, và `role not in rule.actors` ⇒ `self._deny(...)` (403, audit `ACTION_DENIED`) thay vì `InvalidTransitionError` (409). Trạng thái sai (không có hàng `(current, to)`) hoặc `expected_from` lệch ⇒ vẫn 409.
- Nghiệm thu: `extra_permissions.py` ⇒ `accepted_forbidden=0`, `refused_allowed=0`, và 0 ca "409 không audit" cho vai sai; test cũ dùng 409 cho vai sai phải đổi khẳng định (liệt kê trong report).

## 4. F2, F11 — từ vựng an toàn (WP14, CHỈ dữ liệu — V-13)
Quyết định người dùng: "AI không tự hạ; suy ra khẩn cấp thì gửi BQL". Q28: kêu cứu + cháy là Bậc 1 ở tầng luật.
- F11: câu có lời kêu cứu (`cứu`, `cứu với`, `cứu tôi/em/con`, `giúp với`, `giúp em với`, `giúp tôi với` — có/không dấu) và `cháy` trong cùng câu ⇒ S-05 `PRESENT` (EMERGENCY), kể cả khi có danh từ đèn ("Xin cứu, đèn cháy" ⇒ EMERGENCY: kêu cứu thắng B-01).
- F2: câu nguy hiểm Bậc 1 ("Khói rất nhiều ở hành lang tầng 9") KHÔNG được hạ chỉ vì câu đèn đứng trước ⇒ giữ EMERGENCY trên nội dung gộp.
- Làm bằng `seed/maintenance_v1/lexicon.yaml` (tăng `version`). Dữ liệu không đủ ⇒ DỪNG, báo SO (🔴), KHÔNG sửa `safety.py`.
- Nghiệm thu: mọi cổng P03 §6 (C1–C8) + meter `GATES_FAILED=0`; ca mới: ≥ 10 câu kêu cứu + cháy ⇒ EMERGENCY; ≥ 10 câu đèn hỏng không kêu cứu vẫn NONE (gồm 7 ca Q24); SC-205…208 giữ EMERGENCY; ngân sách báo nhầm C2 không vượt.

## 5. F4–F7 — số đếm trùng và hoàn tác tách (WP15)
Bất biến P04 §2.1: `duplicate_count(R)` = số ticket MỞ đang `VERIFYING/DUPLICATE` trỏ R + số ticket đã gộp vào R tính là trùng (`counted=True`).
- F4: `undo_split` trên con đang có blocker `DUPLICATE` ⇒ gọi `_release_duplicate_count(child, blocker_cũ, now)` trước khi chuyển MERGED (như `cancel`).
- F5: `undo_split` chỉ thêm vào `merged_children` khi id CHƯA có (append một lần); lần hoàn tác thứ hai hợp lệ không ném `ValidationError`.
- F6: `undo_split` ⇒ `GuardError` (409) nếu con `_has_open_merged_children` (CẤM gộp dây chuyền, P04 §8).
- F7: T09 mở lại ticket (`_unmerge`) ⇒ tính lại `duplicate_count` của ticket được mở theo bất biến trên (không mang số cũ).
- Nghiệm thu: `extra_undo_split.py` (a)(b)(c)(d) đều đạt; `extra_dup_count_walk.py` 32 lượt ⇒ 0 vi phạm.

## 6. F8 — không tách khi nhắc hai nơi, CẢ đường Agent (WP15)
Sửa P05 §3: thêm điều kiện 6 cho mọi đường: `rules.location_mentions(content, buildings)` có > 1 tòa HOẶC > 1 tầng HOẶC > 1 khu ⇒ `_try_split` trả False (ticket dừng `CATEGORY_UNCLEAR` cho BPTN như khi không tách). Chỗ: `coordination/split.py::_try_split`.
- Nghiệm thu: dòng `[two-places]` của `break6_wrong_split.py` ⇒ không tách; 32 câu MUST_SPLIT REF vẫn tách (`VARIANT_FAILURES=0`).

## 7. F9 — follow-up mang khoá vị trí của nguồn (WP15)
Sửa P07 §6: `_build_follow_up` chép `locked_fields.location` (và vị trí đã chốt) của ticket nguồn sang ticket mới; Agent/luật không được đổi vị trí đã khoá (I-19).
- Nghiệm thu: `extra_followup_split_safety.py` (b) ⇒ follow-up ở đúng vị trí nguồn, không hỏi lại cư dân, Agent đoán nơi khác bị bỏ qua.

## 8. Vùng cấm
- Không sửa `safety.py`, `agent/prompt.py`, `src/api/**`, `src/web/**`, SPEC khác ngoài file này.
- Không nới test cũ để xanh; test cũ phải đổi khẳng định ⇒ liệt kê từng test + lý do trong report.
- Không đổi hành vi ngoài các mục trên (fixture 12 ticket: `expected` không đổi, trừ khi report chứng minh mục nào ở trên buộc đổi).

## 9. Cổng chung mỗi gói
pytest toàn bộ 0 fail/0 skip (số test ≥ trước + mới) · `--pg` toàn bộ 0 fail · ruff check + format sạch · mỗi mục sửa có ≥ 1 test mới từng ĐỎ trước khi sửa (evidence `red-before`) · REF meter + split variants 0.

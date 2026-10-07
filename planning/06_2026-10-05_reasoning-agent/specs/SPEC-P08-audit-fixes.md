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

## 4. F2, F11 — Agent suy luận ngữ nghĩa, luật giữ sàn (gói WP14b — TÁCH khỏi H13)
Thay bản cũ "CHỈ dữ liệu — V-13 / Q28" bằng plan.md **Q30** (2026-10-07 20:18:06 +0700). Nguyên tắc Q01: ngữ nghĩa do LLM suy luận, KHÔNG khớp từ khoá.
- Lý do kiến trúc: luật ra EMERGENCY ⇒ Agent bị bỏ qua (`agent/agent.py::_after_rules` → `skip`). Regex Bậc 1 bắt quá tay loại LLM khỏi quyết định; regex hẹp để câu mơ hồ ở UNCLEAR ⇒ Agent được gọi và được nâng (`validate.merge_agent_safety` → `safety.merge_llm`, chỉ nâng, trích dẫn bắt buộc).
- **Luật (sàn) — KHÔNG đổi:** `lexicon.yaml` giữ `2026-10-05.p1d`. Đo trên bản này (2026-10-07): "Xin cứu, nhà cháy"/"giúp tôi với, cháy rồi" ⇒ UNCLEAR; "Hình như khói nhiều…" ⇒ UNCLEAR; "Không có khói nhiều", "Chưa thấy khói nhiều" ⇒ NONE; "Thay bóng đèn cháy giúp với" ⇒ NONE. Mô hình lỗi ⇒ các câu nguy hiểm vẫn ở Bậc 2 cho BPTN (không mất ca).
- **Agent — sửa `src/maintenance/agent/prompt.py` (tăng `PROMPT_VERSION`):** thêm vào khối hướng dẫn an toàn (cạnh dòng "KHÔNG phải nguy hiểm: đèn/bóng đèn bị cháy…") các phân biệt NGỮ NGHĨA, viết bằng lời, không liệt kê từ khoá cho code khớp:
  (a) người viết đang kêu cứu vì cháy/lửa/khói (có người/tài sản gặp nguy ngay) ⇒ S-05/S-04 `PRESENT`, trích nguyên câu kêu cứu; (b) nhờ việc lịch sự ("giúp/nhờ thay bóng đèn cháy") là đèn hỏng ⇒ không nguy hiểm; (c) câu nguy hiểm đứng SAU câu đèn hỏng vẫn được xét riêng từng câu; (d) phủ định/đã hết ⇒ không `PRESENT`, nghi ngờ ⇒ `UNCLEAR`.
- CẤM: sửa `lexicon.yaml`/`safety.py` cho F2/F11; thêm danh sách từ khoá vào code Agent; đo F2/F11 bằng `safety.assess` rồi kết luận.
- **Nghiệm thu (đường Agent, không phải `assess`):**
  1. Sàn (mock, fallback): bộ câu §4 ⇒ mức luật như dòng "Luật (sàn)" ở trên và với mọi câu ≠ EMERGENCY thì `AgentDecisionRecord.source != "SKIPPED_RULE_EMERGENCY"` (Agent được gọi).
  2. Nối dây (client giả tất định): client trả S-05 `PRESENT` + trích dẫn có thật cho câu kêu cứu ⇒ ticket `VERIFYING/EMERGENCY_PENDING_BQL`; client trả trích dẫn bịa ⇒ UNCLEAR (`LLM-UNGROUNDED`), không EMERGENCY; client trả NONE cho câu nhờ thay đèn ⇒ mức = sàn luật.
  3. Prompt: test `test_agent_prompt.py` kiểm khối hướng dẫn mới có trong system prompt + `PROMPT_VERSION` đổi.
  4. **G-LIVE (bằng chứng suy luận thật, mock KHÔNG thay được):** bộ nhãn ≥ 20 câu kêu cứu + cháy/khói, ≥ 20 câu nhờ việc về đèn cháy/hỏng (gồm 7 ca Q24), ≥ 10 câu phủ định/đã hết, SC-205…208 ⇒ chạy mô hình thật qua `ReasoningAgent.decide`; ghi tỉ lệ đúng từng nhóm, 0 câu kêu cứu thật ra dưới UNCLEAR. Chưa có khoá/model (Q17) ⇒ gate ⬜, KHÔNG đánh ✅ bằng mock.

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
- Không sửa `safety.py`, `src/api/**`, `src/web/**`, SPEC khác ngoài file này. `agent/prompt.py` CHỈ gói WP14b (§4) được sửa; WP14 (H13) không đụng.
- Không vá ngữ nghĩa bằng `lexicon.yaml` (Q30). Từ vựng chỉ đổi cho tín hiệu rõ ràng không cần hiểu nghĩa, kèm đo báo nhầm CẢ chiều nâng.
- Không nới test cũ để xanh; test cũ phải đổi khẳng định ⇒ liệt kê từng test + lý do trong report.
- Không đổi hành vi ngoài các mục trên (fixture 12 ticket: `expected` không đổi, trừ khi report chứng minh mục nào ở trên buộc đổi).

## 9. Cổng chung mỗi gói
pytest toàn bộ 0 fail/0 skip (số test ≥ trước + mới) · `--pg` toàn bộ 0 fail · ruff check + format sạch · mỗi mục sửa có ≥ 1 test mới từng ĐỎ trước khi sửa (evidence `red-before`) · REF meter + split variants 0.

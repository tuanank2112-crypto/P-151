# `src/maintenance/` — Tài liệu module MaintenanceOps (engine CR-BPTN-03 P0)

> Dữ liệu MÔ PHỎNG (`SIM-*`). Spec duy nhất: [`CR-BPTN-03.md`](CR-BPTN-03.md); khi tài liệu này lệch CR-03 thì CR-03 thắng.
> Hồ sơ cài đặt: [`planning/01_2026-10-01_cr03-p0-engine/`](../planning/01_2026-10-01_cr03-p0-engine/) (plan + specs + reports + evidence).
> Trạng thái: P0 xong trên nhánh `feature/nhuy-cr03-p0` (1462 test). Router/UI chưa nối các hành động mới (xem §9).

## 1. Mục đích và ranh giới
Engine nhận phản ánh của cư dân, chạy pipeline Agent, dừng ở blocker có chủ rõ ràng và giao phòng ban; BQL nghiệm thu/đóng.
Mọi trạng thái đổi qua `_apply_transition` + bảng `TRANSITIONS` (25 dòng); mọi ghi qua `_mutate` (bản sao sâu, audit, commit, fail closed) và giữ `engine.lock`.
Không làm ở P0: persistence, router/UI mới, LLM an toàn, gộp ticket (P1) — xem CR-03 §16.

| File | Vai trò |
|---|---|
| `engine.py` | State machine, pipeline, hành động người, job retry/leo thang |
| `safety.py` | Bước 2b: nhận diện Bậc 1/Bậc 2 (hàm thuần) + guard LLM chỉ nâng mức |
| `priority.py` | Luật PRI-H1/H2/M1/M2/L1/D0 (hàm thuần, dùng chung `scope_before` với safety) |
| `catalog.py` | Nạp `catalog.yaml` (`sla_config`), `lexicon.yaml`, `tickets.yaml`; validator từ vựng |
| `views.py`, `messages.py`, `i18n/vi.yaml` | View cư dân (allow-list), hàng BQL, `queue_sort_key`, lời cho cư dân |
| `models.py`, `enums.py` | Ticket (+ `risk_*`, `priority*`, `closure_kind`), Blocker, enum |
| `rules.py`, `proposer.py` | Phân loại (luật + LLM đề xuất); KHÔNG đổi ở P0 |

## 2. Pipeline (CR-03 §5.1, D-09)
`2` dữ liệu tối thiểu → **`2b` an toàn** → `3` phân loại + phòng ban + priority → `4` trùng → `5` review → `6` asset → `7` vật tư/kho → `8` `can_route` rồi `ROUTED` → `10` `report_complete`.
- Thứ tự `_run_pipeline`: `2b` đứng TRƯỚC `2` (Bậc 1 > Bậc 2 > `MISSING_INFO`, Q08), cả hai mang số 2 nên `resume_step=2` chạy lại cả hai.
- Hàm bước tên `_step_<số>_<việc>` (`_step_2b_assess_safety`, `_step_2_check_required_data`, …).
- Chạy lại sau khi gỡ blocker: `MISSING_INFO`/`SAFETY_REVIEW_REQUIRED`/`EMERGENCY_PENDING_BQL` → 2 (2b tự bỏ qua khi đã `safety_cleared_*` và chưa có bổ sung từ mốc đó); `CATEGORY_UNCLEAR`/`OUT_OF_SCOPE` → 4; `DUPLICATE` bác → 5; `PENDING_REVIEW`/`ASSET_UNCLEAR` → 6; `WRONG_DEPT` → 6 hoặc 7; `WAITING_MATERIAL` → 6.

## 3. Tầng an toàn (bước 2b) — `safety.py`
`assess(text, lexicon) -> SafetyAssessment(risk_level, signals, notes, proposer)`; `risk_level` ∈ `NONE | UNCLEAR | EMERGENCY` (Bậc 2 | Bậc 1).
Luật cố định quyết định; LLM chỉ nâng mức (`assess_with_llm`, `safety_llm=None` mặc định, `build_engine()` không truyền — P0 không bật LLM an toàn vì `receive` giữ `engine.lock`).
Từ vựng là DỮ LIỆU: `seed/maintenance_v1/lexicon.yaml` (validator V-01…V-12 + 3 khoá WP3d; sai ⇒ `ValidationError` lúc nạp, engine không khởi tạo).

| Luật | Tóm tắt (SPEC-P01 §0, §3; plan Q29/Q31) |
|---|---|
| R1 | Phủ định = cue + ≤ 2 token đệm kết thúc ngay trước tín hiệu, trong mệnh đề, ≤ 80 ký tự; hai cue liền (phủ định kép) ⇒ UNCLEAR. MỘT hàm `scope_before` dùng chung safety + priority. Không cue có token một chữ cái (`k co` bỏ, Q31.A) |
| R2 | Các match chồng nhau của cùng tín hiệu gộp một span, phán một lần |
| R3/R4 | Cue chứa đối tượng NGƯỜI chỉ áp cho S-09; phủ định lan qua hay/hoặc/lẫn nếu vế trước là mối nguy; KHÔNG lan qua dấu phẩy/"và"/xuống dòng; "chữa/báo/phòng cháy" không phải mối nguy (Q31.D) |
| R5 | Hedge (cue phải ĐÚNG dấu — `hedge_forms`, Q31.B) và marker "đã hết" (đứng sau tín hiệu, sau nó chỉ tiểu từ, không chủ ngữ khác chen giữa) hạ Bậc 1 xuống Bậc 2 |
| R6 | B-01 (bóng đèn bị cháy ⇒ NONE) chỉ khi phần trước thuộc tập đóng ≤ 20 token và danh từ đèn viết đúng dấu |
| R7 | Đồng tự (chảy/cháy, khỏi/khói, lựa/lửa, ngắt/ngất…) xét theo token CÓ dấu, theo từng pattern; từ đồng hiện trong mệnh đề (`homograph_confirmers`) giữ tín hiệu khi gõ sai dấu (Q31.C) |
| R8 | Ký tự vô hình (Cf, điều khiển trừ tab/xuống dòng/CR, U+034F, U+2800, Private Use, filler Hangul) đọc hai lần (bỏ / thành khoảng trắng), lấy mức cao |
| R9 | "khói/lửa/máu/bất động" có dấu nằm ngoài mọi span ⇒ Bậc 2 (lưới), không lên Bậc 1 |
| R10 | Từ vựng bổ sung; 24 KB < 1 s (đo 0,28 s); mô tả cư dân > 5000 ký tự ⇒ `ValidationError` (422), không cắt cụt |
B-04 (khét + ngữ cảnh nấu ăn ⇒ Bậc 2) chỉ trên chữ có dấu và khi câu không có từ điện.

**Giới hạn đã biết (không sửa ở P0):** "Tòa KO có khói" (cue `ko`); chữ Cyrillic/leet/ligature/chữ tách rời/lặp đúng 2 chữ; tín hiệu P1 (S-06…S-08, S-10…S-13); tên riêng trùng từ nấu ăn có dấu ("chị Thịt") ⇒ Bậc 2; "có khói bay ra hết rồi" ⇒ Bậc 2 (R5 mơ hồ); văn bản không dấu giữ mức CAO (không hạ).
Số đo cuối: bộ dừng 1065 ca xanh; holdout độc lập NONE 2/39; báo nhầm `b_fp` EM 0/UNCLEAR 4, `jx_negfp` EM 0, `b_fp2` EM 3 (đúng ngưỡng).

## 4. Luồng khẩn cấp — 5 method công khai (`engine.py`)
Mọi method nhận `ticket_id, actor_id` đầu tiên, trả `Case` đã commit, giữ `engine.lock`. Thứ tự lỗi: 404 → 403 → 409 INVALID → 409 GUARD.

| Method | Vai | Điều kiện | Hiệu lực |
|---|---|---|---|
| `safety_confirm_safe(tid, actor, *, note)` | BPTN/BQL (T05); chỉ BQL (T03) | VERIFYING + `SAFETY_REVIEW_REQUIRED`, hoặc NEED_INFO có `safety_context` | ghi `safety_cleared_*`, `risk_level=NONE`, về `RECEIVED`, chạy lại từ bước 2 |
| `safety_escalate(tid, actor, *, note=None)` | BPTN/BQL (E01); chỉ BQL (T07) | như trên | Bậc 2 → `EMERGENCY_PENDING_BQL` (chủ BQL), outbox `emergency.created` |
| `safety_request_info(tid, actor, *, note)` | BPTN/BQL (T06) | VERIFYING + `SAFETY_REVIEW_REQUIRED` | → NEED_INFO + `safety_context`, hạn 12 h |
| `emergency_downgrade(tid, actor, *, note)` | BQL (T05) | VERIFYING + `EMERGENCY_PENDING_BQL` | báo nhầm: về flow thường |
| `emergency_close(tid, actor, *, note)` | BQL (T10) | như trên | `CLOSED`, `closure_kind=EMERGENCY_HANDLED`, không cần phòng ban |
Lỗi: sai vai / BPTN trên blocker thuộc BQL (kể cả `bptn_resolve`, CR-03 §4.4.5) ⇒ `ActionDeniedError` 403 + audit, trạng thái không đổi; BQL dùng 3 lựa chọn Bậc 2 trước khi leo thang ⇒ 403 (Q19); sai trạng thái/blocker ⇒ `InvalidTransitionError` 409; thiếu `note` ⇒ `GuardError` 409; blocker an toàn của BPTN + `bptn_resolve` ⇒ `GuardError` 409.
Bất biến: `resume()`/job KHÔNG BAO GIỜ gỡ blocker an toàn (`_cleared` False); Bậc 2 leo thang đúng một lần sau 4 giờ LỊCH (`escalated=True`, outbox `safety.review_escalated`); NEED_INFO an toàn leo thang sau 12 h (outbox `escalation`).
Chặn khác: `reopen()` luôn `InvalidTransitionError`; `set_assignee()` luôn `ActionDeniedError` có audit; `rate()` một lần (`GuardError` lần hai).
Cư dân chỉ thấy nhãn "Đang được kiểm tra" và lời trong `i18n/vi.yaml` (không `risk_*`, `reason_code`, `priority`).

## 5. Priority — `priority.py`, `views.py`
`propose_priority(category, location, text, lexicon.priority)` chạy ở bước 3 (`_bind_category`): KY_THUAT + khu vực lối đi ⇒ HIGH (PRI-H1); cản trở lối đi ⇒ HIGH (H2); ảnh hưởng sử dụng ⇒ MEDIUM (M2); còn lại VE_SINH ⇒ LOW (L1); thiếu vị trí/loại ⇒ MEDIUM (D0). Phủ định đi qua `safety.scope_before`.
`set_priority(tid, actor, priority, *, note)` (BPTN/BQL): ghi `HUMAN_OVERRIDE`, audit `SET_PRIORITY`, không StatusEvent/notification; lần chạy lại pipeline không ghi đè.
`queue_sort_key(ticket)` = (EMERGENCY trước, priority HIGH→MEDIUM→LOW→None, `created_at` UTC tăng dần, `ticket_id`); `bql_rows` sắp theo khoá này và lọc `risk_level`/`priority`/`blocker_owner_role`.

## 6. Cấu hình
- `seed/maintenance_v1/catalog.yaml` `sla_config`: `safety_review.escalate_after_hours` (4, giờ lịch), `missing_info.safety_context.escalate_after_hours` (12), `priority.duplicate_raise_at_count` (3, P1), cùng các khoá cũ (`duplicate_window_hours`, `bptn`, `waiting_material`, `not_accepted`, `rework`). Không còn `reopen_window_days`.
- `seed/maintenance_v1/lexicon.yaml`: `safety` (cue, đệm, tập đóng B-01, đồng tự, confirmers, hedge_forms, gốc R9, signals S-01…S-14/T2-03…05) và `priority`. Sửa từ vựng KHÔNG cần đụng code nhưng PHẢI chạy bộ dừng.
- `tickets.yaml` (12 ca): CLN-004 và TEC-005 là Bậc 1 (`EMERGENCY_PENDING_BQL`); `priority:` trong `expected`.

## 7. Chạy test
```
export LLM_MODE=mock PYTHONUTF8=1      # Python 3.11 + pip install -r requirements.txt
python -m pytest -q -p no:cacheprovider
python -m ruff check src tests && python -m ruff format --check src tests
```
Bộ dừng an toàn: `tests/test_maintenance/data/safety_stop_sets_p0.yaml` (và `safety_cases_p0.yaml`) bị `.gitignore` (`data/`) ⇒ thêm file mới phải `git add -f`.

## 8. Điểm cần nhớ khi sửa
- Đọc `docs/maintenance.md` + `brain4agent/-known-gotchas.md` trước; mô tả tiếng Việt có dấu: bỏ dấu làm nhiều từ trùng (`chay`, `khoi`, `lua`, `ngat`, `den`, `ho`).
- Công cụ ghi file có thể giải mã `\uXXXX`/`\\` thành ký tự thật: dùng mã điểm (`chr`, `ord`) trong mã nguồn, kiểm `grep -cP '[\x08\x0b\x0c]'`.
- Priority và `risk_level` là hai trục độc lập; Bậc 1 không có priority.

## 9. Chưa làm (bàn giao)
Endpoint router cho 5 method + `set_priority` (gợi ý ở `specs/00-ARCHITECTURE.md` §4.1), UI, persistence/deploy, `develop` merge, Q22 (bộ phân loại cho "bóng đèn bị cháy" ⇒ `OUT_OF_SCOPE`, chủ rules/playbook), P1 (T16/T17/E02, gộp ticket, PRI-U1/U2, LLM an toàn).

## 10. Bộ nhãn CR-03 của Trường (PR #6, merge lần 2 — plan 02 Q09, 2026-10-03)
Hồ sơ gốc: [`planning/02_2026-10-03_truong-mvp-prep/`](../planning/02_2026-10-03_truong-mvp-prep/plan.md) (scope, quyết định D-01…D-08, bốn demo, [rules safety](../planning/02_2026-10-03_truong-mvp-prep/specs/SPEC-P04-SAFETY.md), [fixture/nghiệm thu](../planning/02_2026-10-03_truong-mvp-prep/specs/TESTING-ACCEPTANCE.md)). D-01 (bổ sung mới + snapshot có cấu trúc cho LLM) là contract ĐÍCH, CHƯA code; D-02…D-07 user confirmed; D-08 nhóm pending.
- `safety.py` độc lập của PR #6 (`assess_safety(text, previous_risk)`) KHÔNG giữ: chỉ có MỘT tầng an toàn là `assess(text, lexicon)` ở §3. Hàm `assess_safety` chỉ còn là adapter trong `tests/test_maintenance/test_safety_p0.py` (kiểm `RiskLevel`, ranh giới `RawTicket`, giữ mức cũ bằng max).
- Bộ nhãn giữ nguyên: 62 câu trong `test_safety_p0.py`, 34 ca `seed/maintenance_cr03/safety_cases.json`, fixture đích `seed/maintenance_cr03/tickets.yaml` (startup vẫn `seed/maintenance_v1/`). Engine cao hơn nhãn ở 4 câu ⇒ ghim trong `ABOVE_LABEL` (không hạ); thấp hơn nhãn đã vá bằng từ vựng (`giật` đứng riêng ⇒ Bậc 2). Bảng đối chiếu: `planning/02_2026-10-02_merge-develop/evidence/`.
- Lệch cơ chế còn mở (không sửa, xem `reports/R02_merge-develop-2.md`): fixture đích của Trường xếp phân loại TRƯỚC an toàn (CLN-004/TEC-005 có `playbook_id`/`proposed_department_id`) còn engine chạy 2b trước phân loại; `test_cr03_targets.py` so với baseline `maintenanceops-sim-v1.2` của `develop`, trong khi `seed/maintenance_v1/` của nhánh này là v1.3 (CR-03).

## 11. Công việc của Trường (nhánh `feature/truong`)

Hồ sơ: [plan 02](../planning/02_2026-10-03_truong-mvp-prep/plan.md).
D-01 được người dùng xác nhận; D-02–D-07 dùng mặc định CR-03. D-08 APPROVED: người dùng thông báo leader Lê Thị Châm Anh duyệt phạm vi MVP 04/10 và D-01–D-07; ngày duyệt được báo là 2026-10-02, chưa cung cấp giờ. Ghi nhận ngày 2026-10-03; commit a5e2705/PR #6 là bản tham chiếu được người dùng xác nhận trong phiên này, không khẳng định commit đã tồn tại ngày 02/10. Nguồn: thông báo người dùng trong phiên; chưa có link biên bản ngoài. Không mở rộng thành duyệt mọi CR/backlog hoặc nghiệm thu runtime.

### Kết quả chuẩn bị local ngày 2026-10-03

5 gói đã có đầu ra và report. Root đo lại 266 tests pass, 20 Postgres deselected; 72 safety tests, 9 target tests; kiểm tra hồ sơ 57/57 pass. Lint và format 3 file Python mới đạt. Python syntax được kiểm tra; repo chưa cấu hình typechecker.
Format toàn repo còn 2 file baseline ngoài phạm vi; Postgres và demo online chưa chạy trong phiên này. Bằng chứng [pytest](../planning/02_2026-10-03_truong-mvp-prep/evidence/root/final-pytest.txt), [hồ sơ](../planning/02_2026-10-03_truong-mvp-prep/evidence/root/package-check.txt).
Hàm safety vẫn là rules độc lập; trạng thái này không có nghĩa API đã tích hợp safety/D-01 hoặc runtime đã được nghiệm thu. D-08 duyệt thiết kế được ghi nhận riêng theo thông báo người dùng.

### Công việc ngày 03/10

[Checklist và hợp đồng 7 task](../planning/02_2026-10-03_truong-mvp-prep/specs/SPEC-P06-DAY03.md): asset, vật tư, trùng cơ bản, wording/quyền và chạy thử 4 demo. Trường chuẩn bị/kiểm thử và bàn giao lỗi; Như Ý sở hữu engine/safety, Châm Anh sở hữu API/storage, Trí sở hữu UI. Kết quả chạy local cô lập (SHA 0ea04ad, nhánh feature/truong): 23 record = 17 PASS / 1 FAIL / 5 BLOCKED / 0 NOT_RUN. Asset 3/3, vật tư 4/4, trùng 4/4 PASS; wording WORD-03 PASS, WORD-01/02/04 BLOCKED (safety Bậc 2/Bậc 1, rating-once, reopen chưa tích hợp); demo 5 PASS, 1 FAIL (DEMO-01-RATING: `engine.rate` ghi đè rating, engine.py:548-553), 2 BLOCKED (DEMO-04). Owner lỗi/BLOCKED: Như Ý. Chờ người quyết: ASSET-03, STOCK-04, owner reopen/rating-once. D3-05/06 chưa đóng; runtime/online chưa nghiệm thu. Báo cáo: [tổng hợp](../planning/02_2026-10-03_truong-mvp-prep/deliverables/day03-summary.md), [wording](../planning/02_2026-10-03_truong-mvp-prep/deliverables/day03-wording.md), [kết quả](../planning/02_2026-10-03_truong-mvp-prep/deliverables/day03-results.json).

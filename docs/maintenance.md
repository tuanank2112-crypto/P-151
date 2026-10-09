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
Route API (prefix `/api/v1`; router chỉ bọc method trên, không kiểm vai/logic; lỗi qua `_call`: 403/404/409; `decision` lạ ⇒ 422; `closure_kind` client gửi bị bỏ qua):

| Route | Body | Method engine |
|---|---|---|
| `POST /mo/tickets/{id}/safety` | `{decision: CONFIRM_SAFE \| REQUEST_INFO \| ESCALATE, note}` | `safety_confirm_safe` \| `safety_request_info` \| `safety_escalate` |
| `POST /bql/tickets/{id}/emergency/close` | `{note}` | `emergency_close` |
| `POST /bql/tickets/{id}/emergency/downgrade` | `{note}` | `emergency_downgrade` |
Ghi chú nội bộ của blocker an toàn kèm phần dữ liệu tối thiểu còn thiếu (`Bậc 2: T2-04 · Thiếu: location_area`, `_with_missing`): Q08 xét an toàn TRƯỚC bước 2 nên cư dân chưa được hỏi; UI BPTN hiện cảnh báo + điền sẵn câu hỏi, `REQUEST_INFO` tự hỏi kèm phần vị trí còn thiếu, `CONFIRM_SAFE` ⇒ bước 2 hỏi tiếp.
Bất biến: `resume()`/job KHÔNG BAO GIỜ gỡ blocker an toàn (`_cleared` False); Bậc 2 leo thang đúng một lần sau 4 giờ LỊCH (`escalated=True`, outbox `safety.review_escalated`); NEED_INFO an toàn leo thang sau 12 h (outbox `escalation`).
Chặn khác: `reopen()` luôn `InvalidTransitionError`; `set_assignee()` luôn `ActionDeniedError` có audit; `rate()` một lần (`GuardError` lần hai).
Cư dân chỉ thấy nhãn "Đang được kiểm tra" và lời trong `i18n/vi.yaml` (không `risk_*`, `reason_code`, `priority`).

## 5. Priority — `priority.py`, `views.py`
`propose_priority(category, location, text, lexicon.priority)` chạy ở bước 3 (`_bind_category`): KY_THUAT + khu vực lối đi ⇒ HIGH (PRI-H1); cản trở lối đi ⇒ HIGH (H2); ảnh hưởng sử dụng ⇒ MEDIUM (M2); còn lại VE_SINH ⇒ LOW (L1); thiếu vị trí/loại ⇒ MEDIUM (D0). Phủ định đi qua `safety.scope_before`.
`set_priority(tid, actor, priority, *, note)` (BPTN/BQL): ghi `HUMAN_OVERRIDE`, audit `SET_PRIORITY`, không StatusEvent/notification; lần chạy lại pipeline không ghi đè.
`queue_sort_key(ticket)` = (EMERGENCY trước, priority HIGH→MEDIUM→LOW→None, `created_at` UTC tăng dần, `ticket_id`); `bql_rows` sắp theo khoá này và lọc `risk_level`/`priority`/`blocker_owner_role`.

### Kho: tồn kho và nhập thiếu (2026-10-05)
`stock_levels(actor)` — route `GET /mo/warehouse/stock` → `[{item_code, item_name, unit, qty}]` (`qty` null = không rõ); mọi vai trừ cư dân (cư dân ⇒ 403). `_resume` của ticket `WAITING_MATERIAL` luôn gọi `_refresh_line_stock` trước khi xét gỡ: nhập thiếu (cần 2, có 1) ⇒ ticket vẫn chờ nhưng dòng vật tư hiện tồn mới. `POST /mo/warehouse/stock/{item}` trả MỌI ticket đã xét (kể cả còn chờ) — UI đếm "chạy tiếp" theo blocker, không theo độ dài mảng. Màn Kho: bảng tồn kho, "cần · tồn · còn thiếu" theo tồn hiện tại, điền sẵn số còn thiếu.

### Xuất kho khi phòng ban ghi vật tư (2026-10-05)
`record_material(tid, actor, item, *, issued_qty, used_qty, variance_reason)` trừ kho **phần chênh** `issued_qty − issued_qty cũ` (sửa giảm ⇒ hoàn kho) bằng `Tx.take_stock(item, qty)` trong CÙNG transaction của `_mutate` (`engine._issue_stock`): ticket và tồn kho cùng commit hoặc cùng huỷ. `confirm_materials` bỏ một dòng đã xuất ⇒ hoàn lại số đã xuất. Audit `UPDATE_MATERIAL` ghi thêm `stock_qty` (tồn sau khi xuất; null = không rõ).

| Lỗi | Hành vi |
| :--- | :--- |
| Xuất thêm > tồn hiện tại | `GuardError` 409 "Kho chỉ còn X …", không ghi gì; phòng ban dùng `block` → `WAITING_MATERIAL` |
| `used_qty > issued_qty` | `GuardError` 409 — chỉ được dùng hàng đã xuất kho |
| Tồn không rõ (`null`, D-05) | Không trừ, không chặn, tồn vẫn `null` |

Postgres: một `UPDATE … WHERE qty >= :q` có điều kiện (hai worker không cùng lấy được phần cuối); bảng `maintops.stock` còn `check (qty >= 0)`. **Vùng cấm:** KHÔNG giữ chỗ (reserve) ở bước 7/khi giao việc — bước 7 chỉ đoán theo playbook, giữ chỗ sẽ khoá hàng của ticket chưa chắc dùng; huỷ ticket sau khi đã xuất KHÔNG tự hoàn kho (hàng có thể đã dùng; chưa có luồng trả hàng).

### Xác nhận vật tư tại hiện trường (2026-10-05)
`confirm_materials(tid, actor, *, lines: list[PlannedMaterial], note)` — route `POST /mo/tickets/{id}/material-plan` `{lines: [{item_code, planned_qty}], note}`. Chỉ DEPARTMENT đúng phòng ban, ticket `IN_PROGRESS`; `note` bắt buộc. Thay `planned_materials` + dựng lại `material_lines` (giữ `issued_qty`/`used_qty`/`variance_reason` của item_code không đổi), cập nhật `draft.material_line_ids`/`material_stock_status`/`material_requirement_mode` (rỗng ⇒ `N_A`). Audit `UPDATE_MATERIAL` field `planned_materials`. Lỗi: item không có trong catalog / trùng dòng / qty ≤ 0 / note rỗng / chưa nhận việc ⇒ `GuardError` (409); sai vai/phòng ban ⇒ 403; item_code sai mẫu `SIM-` ⇒ 422. **Vùng cấm:** KHÔNG chặn khi tồn kho thiếu (đi `block` → `WAITING_MATERIAL`), KHÔNG thêm điều kiện nghiệm thu mới (6 gate §9.4 giữ nguyên). Lý do: bước 7 chỉ đoán vật tư mặc định của playbook; khi tài sản `ASSET_CHECK_ONSITE` UI phòng ban hiện khung này nổi bật, ca khác để thu gọn.

## 6. Cấu hình
- `seed/maintenance_v1/catalog.yaml` `site` (2026-10-05, thí điểm): `{name: Ocean Park, buildings: [S1, S2]}`. `rules.extract_location(text, buildings)` chỉ nhận tòa trong danh sách (viết "tòa S1" hoặc "S1"; giữ tòa con "S1.12", từ chối "S1.123"); tòa khác = thiếu `location_building` ⇒ hỏi lại cư dân. Khu vực "Sảnh cư dân" và "Sảnh chính" mặc định Tầng 1 (`IMPLIED_FLOOR`), không cần nêu tầng. Mở rộng tòa: thêm mã vào `buildings` + sửa `field_labels.location_building` trong `i18n/vi.yaml`. Vị trí BPTN nhập tay (`bptn_resolve location`) KHÔNG bị kiểm danh sách.
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
- Lệch thứ tự phân loại/an toàn ĐÃ ĐÓNG (plan 02 Q11, 2026-10-04): Trường sửa fixture đích (`954dcab`), CLN-004/TEC-005 không còn `playbook_id`/`proposed_department_id`/`review_status` vì 2b chạy trước phân loại; `test_cr03_targets.py` khẳng định ba trường vắng mặt và so với baseline v1.3 của `seed/maintenance_v1/`. Fixture CR03 đạt 12/12 trên engine (evidence/13). Ticket Bậc 1 không có bài kiểm phân loại: muốn kiểm thì thêm ca riêng.

## 11. Công việc của Trường (nhánh `feature/truong`)

Hồ sơ: [plan 02](../planning/02_2026-10-03_truong-mvp-prep/plan.md).
D-01 được người dùng xác nhận; D-02–D-07 dùng mặc định CR-03. D-08 APPROVED: người dùng thông báo leader Lê Thị Châm Anh duyệt phạm vi MVP 04/10 và D-01–D-07; ngày duyệt được báo là 2026-10-02, chưa cung cấp giờ. Ghi nhận ngày 2026-10-03; commit a5e2705/PR #6 là bản tham chiếu được người dùng xác nhận trong phiên này, không khẳng định commit đã tồn tại ngày 02/10. Nguồn: thông báo người dùng trong phiên; chưa có link biên bản ngoài. Không mở rộng thành duyệt mọi CR/backlog hoặc nghiệm thu runtime.

### Kết quả chuẩn bị local ngày 2026-10-03

5 gói đã có đầu ra và report. Root đo lại 266 tests pass, 20 Postgres deselected; 72 safety tests, 9 target tests; kiểm tra hồ sơ 57/57 pass. Lint và format 3 file Python mới đạt. Python syntax được kiểm tra; repo chưa cấu hình typechecker.
Format toàn repo còn 2 file baseline ngoài phạm vi; Postgres và demo online chưa chạy trong phiên này. Bằng chứng [pytest](../planning/02_2026-10-03_truong-mvp-prep/evidence/root/final-pytest.txt), [hồ sơ](../planning/02_2026-10-03_truong-mvp-prep/evidence/root/package-check.txt).
Hàm safety vẫn là rules độc lập; trạng thái này không có nghĩa API đã tích hợp safety/D-01 hoặc runtime đã được nghiệm thu. D-08 duyệt thiết kế được ghi nhận riêng theo thông báo người dùng.

### Công việc ngày 03/10

[Checklist và hợp đồng 7 task](../planning/02_2026-10-03_truong-mvp-prep/specs/SPEC-P06-DAY03.md): asset, vật tư, trùng cơ bản, wording/quyền và chạy thử 4 demo. Trường chuẩn bị/kiểm thử và bàn giao lỗi; Như Ý sở hữu engine/safety, Châm Anh sở hữu API/storage, Trí sở hữu UI. Kết quả chạy local cô lập (SHA 0ea04ad, nhánh feature/truong): 23 record = 17 PASS / 1 FAIL / 5 BLOCKED / 0 NOT_RUN. Asset 3/3, vật tư 4/4, trùng 4/4 PASS; wording WORD-03 PASS, WORD-01/02/04 BLOCKED (safety Bậc 2/Bậc 1, rating-once, reopen chưa tích hợp); demo 5 PASS, 1 FAIL (DEMO-01-RATING: `engine.rate` ghi đè rating, engine.py:548-553), 2 BLOCKED (DEMO-04). Owner lỗi/BLOCKED: Như Ý. Chờ người quyết: ASSET-03, STOCK-04, owner reopen/rating-once. D3-05/06 chưa đóng; runtime/online chưa nghiệm thu. Báo cáo: [tổng hợp](../planning/02_2026-10-03_truong-mvp-prep/deliverables/day03-summary.md), [wording](../planning/02_2026-10-03_truong-mvp-prep/deliverables/day03-wording.md), [kết quả](../planning/02_2026-10-03_truong-mvp-prep/deliverables/day03-results.json).

## 12. Sửa logic sau rà soát 2026-10-04 (plan 04)
Hồ sơ: [`planning/04_2026-10-04_logic-review-fix/`](../planning/04_2026-10-04_logic-review-fix/plan.md) (PATCH; §1 lỗi đo được, §2 quyết định Q01–Q09).
- **Ngoài phạm vi (A1, phần engine):** cư dân không phải người báo / phòng ban không giữ ticket vẫn nhận 403 + audit (contract cũ), nhưng lỗi KHÔNG có `unchanged_status`; `transition` của người ngoài phạm vi bị từ chối TRƯỚC 409 (409 nêu trạng thái hiện tại). Giá trị ghi vào dòng ACTION_DENIED cắt ở `DENIED_TEXT_MAX` (500 ký tự). Đổi sang 404 là đổi contract: chờ nhóm.
- **Phần backend TÁCH RA (Q16, chủ API Châm Anh):** chặn loại ảnh ở `POST /evidence` (A2), route ảnh chạy phần chặn bằng `run_in_threadpool` (A3), `/mo/ai-logs` chỉ BPTN/BQL/QA + lọc trước `limit` (A4), `/mo/tickets` sắp theo `queue_sort_key` (L2), giới hạn chữ tự do 2000 ở route, khoá session đăng nhập (L1) — CHƯA có trong code, nằm ở `handoffs/H03_backend-api.md` + `H03_backend-api.patch` kèm 5 test.
- **AI Logs (E3):** engine truyền `ticket_id` vào `propose()` ⇒ log không còn `PENDING`.
- **REWORK (E1, Q02):** `Case.evidence_round_start` = vị trí trong `evidence` lúc BQL trả làm lại; bước 10 chỉ tính ảnh + ghi chú gửi từ mốc đó (`current_round_evidence`, `execution_photos`). Route xem ảnh vẫn trả mọi ảnh để BQL so sánh.
- **Bậc 2 đã leo thang (E2, Q04):** blocker `SAFETY_REVIEW_REQUIRED` tạo lại trên ticket từng leo thang an toàn (`safety.review_escalated`, hoặc NEED_INFO an toàn quá 12 h) bắt đầu `escalated=True` + thông báo BQL — BQL không bị cổng Q19 khoá lại.
- **LLM ngoài khoá (E4, Q06):** `receive` lấy số ticket và gọi LLM phân loại TRƯỚC `engine.lock` (`_early_proposal`), chỉ khi có LLM, có vị trí và tầng an toàn ra `NONE`; bước 3 dùng lại kết quả nếu nội dung không đổi (`_proposal_hint`, thread-local, dùng một lần).
- **Ticket mồ côi (E5, Q07):** job coi ticket `RECEIVED` không blocker quá `ORPHAN_GRACE` (2 phút từ `created_at`) là chưa chạy pipeline và chạy từ bước 2.
- **Phân loại (C1, C2):** `rules._classification_text` đổi từ CÓ dấu trùng nhau khi bỏ dấu (đèn/đến, Bùi/bụi, bận/bẩn) thành marker trước `normalize`; thêm triệu chứng đèn (nhấp nháy, hư, vỡ, không lên, mất đèn) và từ vệ sinh mềm (bẩn, dơ, phân, nôn, nước tiểu — chỉ khi có khu vực chung). `extract_location` không đổi; Q22 "bóng đèn bị cháy" chưa đụng. Proposer: đổi enum của LLM nằm trong nhánh fallback; `reason` cắt 500 ký tự.
- **Vòng Agent (Q14):** `rules.py` tách vị trí thêm Cầu thang bộ ("thang bộ"), Phòng rác, Bãi đỗ xe, Sân chơi, Sân thượng, Lối đi; tầng "trệt"/"lầu N"; tòa "tòa nhà X"/"block X" (không lấy "nhà", "tầng"… làm mã tòa); `lexicon.priority.high_areas` thêm Bãi đỗ xe, Lối đi. Đèn có dấu + khu vực chung ở bất kỳ đâu ⇒ KY_THUAT; "bóng đèn … bị cháy" ⇒ KY_THUAT (Q22). `safety._b01_ok`: B-01 không áp khi cụm ứng viên hoặc danh từ đèn nằm qua chỗ ngắt mệnh đề.
- Giao việc cho người khác: `handoffs/H03_backend-api.md` (Châm Anh: bản vá + lỗi API mới từ kiểm thử E2E), `H04_ui-web.md` (Trí: khung BQL Bậc 2 leo thang không hiện, form BPTN NEED_INFO an toàn, tab AI Logs, ô kiểm ảnh sau REWORK, nút gọi sai route), `H05_rules-spec.md` (Trường: rà rules/từ vựng đã sửa, quyết spec hỏi vị trí với ngoài phạm vi, "cháy" đứng riêng, trùng STT 04).
- **Từ vựng an toàn `2026-10-04.p0d`:** 2 vòng + thẩm định đối kháng độc lập (107 câu: HEAD 50 lỗi → 10); ca hồi quy SC-77…SC-202 trong `safety_cases_p0.yaml` + `test_safety_review_fixes.py`; bộ dừng 1065 ca và ngân sách báo nhầm không đổi. Còn lại xem `brain4agent/roadmap.md` Idea Vault (plan 04 mục 10).
- Test: `tests/test_maintenance/test_logic_review_fixes.py` (11, phần engine), `test_rules_review_fixes.py` (34), `test_safety_review_fixes.py` + ca SC-77…SC-219, 2 test proposer; mọi test mới từng đỏ trên code cũ (phần còn lại là đối chứng). 5 test backend nằm trong bản vá H03.

## 13. Làm cứng Agent bằng kiểm thử biến thể vị trí (plan 05, 2026-10-04)
Hồ sơ: [`planning/05_2026-10-04_agent-hardening/`](../planning/05_2026-10-04_agent-hardening/plan.md) (Q01–Q07). Lý do: câu thử của plan 04 không có vị trí kiểu cư dân thật, nên lỗi lớp "chữ vị trí trùng từ tín hiệu" lọt (demo: "… tòa SIM-C có khối rác" ⇒ khẩn cấp vì từ xác nhận `toa` = "tỏa").
- **Bộ biến thể (cổng chính, Q01):** `tests/test_maintenance/test_safety_metamorphic.py` bọc MỌI ca nhãn an toàn bằng nhiều mẫu vị trí (đầu/cuối/giữa câu, có/không dấu); `test_classify_metamorphic.py` có kho ~150 câu cư dân × ~18 mẫu vị trí (có/không dấu). Thêm vị trí KHÔNG được đổi mức an toàn, loại việc, và `extract_location` phải ra đúng vị trí mẫu. Chạy riêng: `python -m tests.test_maintenance.test_safety_metamorphic`.
- **Từ vựng an toàn `2026-10-04.p0e`:** `homograph_confirmers` dùng cặp chữ chắc nghĩa ("toa ra", "bay ra", "boc len"…) thay vì từ đơn trùng chữ vị trí; thêm tiền tố B-01 (bãi đỗ xe, tòa nhà, số bằng chữ…); `safety._Lookups` bỏ qua đuôi vị trí sau marker "giờ hết rồi" (T2-02).
- **Phân loại:** đèn tuýp ("bóng tuýp chết") do luật bắt; câu trộn vẫn CATEGORY_UNCLEAR kể cả khi LLM chọn một; nước tràn vào tủ điện/ổ cắm hoặc "lòi/lộ dây điện" ⇒ OUT_OF_SCOPE (BPTN đọc), không giao phòng ban.
- **Tách vị trí:** lấy NƠI CÓ SỰ CỐ (tầng/tòa gần tên khu vực nhất), bỏ "căn/em ở/nhà tôi … tầng N" (tầng nơi ở không bao giờ dùng); "toà SIM A" ⇒ SIM-A; "tầng 03" ⇒ 3; "cầu thang" ⇒ Cầu thang bộ; khu mới "Lối thoát hiểm" (`priority.high_areas` có thêm).
- **Điều phối (engine, Q05):** phản ánh ngoài phạm vi, KHÔNG nhắc khu vực chung nào và KHÔNG nhắc đèn/rác/bẩn (`rules.mentions_playbook_subject`), mà CHỈ thiếu vị trí ⇒ VERIFYING/OUT_OF_SCOPE (chủ BPTN), không hỏi cư dân; `resume_step=2` nên BPTN chọn loại việc xong thì bước 2 hỏi vị trí (không bao giờ giao thiếu vị trí). Vị trí đọc từ phần bổ sung MỚI NHẤT trước (`engine._location_text`); vị trí BPTN gõ tự do được chuẩn hoá qua `extract_location` (không tách được thì giữ nguyên văn). Bước 2 cần phân loại nên LLM được gọi sớm (ngoài `engine.lock`) cả khi thiếu vị trí.
- **Job (Q07):** `run_jobs` bắt mọi lỗi theo từng ticket; `_orphaned` chặn tràn số với `created_at` cuối lịch (lỗi do plan 04 E5).
- Giới hạn của luật cố định: câu hỏi ngoài phạm vi có nhắc khu vực chung ("giờ mở cửa hầm xe") vẫn bị hỏi vị trí — nghiêng về hỏi cư dân; câu mơ hồ có khu vực ("Ở hành lang có vấn đề") nhờ vậy cư dân tự bổ sung được.
- Test: `test_agent_coordination.py` (điều phối), hai file biến thể, ca SC-220… trong `safety_cases_p0.yaml`.
- **Bản vá 05b (Q11):** "đèn cháy / đèn chập = đèn hỏng": `benign_phrases`/`benign_with_lamp_noun` thêm "chập (điện/mạch)" sau danh từ đèn; `safety._proven_lamp` nhận "den"/"bong" không dấu khi chính triệu chứng ("bi chay", "bi chap") cũng gõ không dấu — xét từng chữ, vị trí có dấu xung quanh không ảnh hưởng; chữ có dấu khác ("đen", "bông") vẫn không phải đèn; `rules.py` thêm "chập", "bị/đã cháy" vào triệu chứng đèn hỏng. Có khói/tóe lửa/khét kèm thì vẫn khẩn cấp.
- Để P1: tín hiệu an toàn P1 (gas, kim tiêm, nước vào tủ điện, đèn nóng), luồng trùng đầy đủ (CR §8), tách ticket khi một phản ánh có hai việc, đếm trả sai phòng ban.

## 14. Tốc độ đọc danh sách — cache `list()` theo `xmin` (plan 09, v1.5.0, 2026-10-08)
Hồ sơ: [`planning/09_2026-10-08_backend-speed/`](../planning/09_2026-10-08_backend-speed/plan.md). Audit: `PostgresRepository.list()` kéo toàn bộ doc
(725 KB với 65 ticket) mỗi request ⇒ danh sách cư dân 2.7 s, BPTN 1.5 s trên Supabase.
- **`PostgresRepository.list()`** (`store/postgres.py`, `_LIST_CHANGED`): MỘT câu SQL gửi cặp `(ticket_id, xmin)` đang giữ; DB trả `xmin` mọi dòng và
  `doc` CHỈ của dòng mới/đổi. Không TTL ⇒ ghi từ backend khác thấy ngay ở lần đọc sau. Doc lỗi ⇒ ném, cache giữ nguyên. `cache_stats()` cho test/log
  (INFO mỗi 100 lần). `get()`/`get_for_update()`/`transaction()` KHÔNG dùng cache.
- **Object trả từ `list()` là CHỈ ĐỌC, dùng chung** (như `InMemoryRepository.list()`): sửa ticket luôn qua `_mutate`/`transaction`. CẤM sửa trực tiếp.
- **`resident_view(..., lookup=None)`** (`views.py`): `resident_list` truyền `{ticket_id: Case}` của cùng snapshot ⇒ ticket gộp/tách/follow-up không đọc lại DB.
  Route đơn (`/resident/tickets/{id}`…) không truyền `lookup`, vẫn đọc tươi.
- Số đo (median, Supabase): cư dân 2676→201 ms, BPTN 1514→224 ms, BQL 503→219 ms; API trả về giống hệt từng byte (8/8 vai). Test: `test_list_cache.py` (T1–T8).

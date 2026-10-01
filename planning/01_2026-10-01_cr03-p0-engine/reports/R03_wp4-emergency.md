Vai: worker · loại: thi công · họ/model: Claude Sonnet 5.5 (🟠) · Bước 0 exit: 0 · hiểu việc: cài phần con người gỡ blocker an toàn (5 method safety_*/emergency_*, nhánh `_human_transition` T03/T05/T06/T07/T10, chặn BPTN trên blocker chủ BQL, guard Q19, `_cleared`/`_resume`/`_escalate`/`_new_blocker(safety_context)`), trong `engine.py` + test mới `test_emergency.py`; xong khi pytest/ruff exit 0, tổng >= 266+16, E-01..E-15 xanh, không đường nào gỡ được EMERGENCY_PENDING_BQL, làm đỏ 2 lần, grep lock, một commit local; CẤM api/web/docs/.gitignore/specs/plan/rules/proposer/priority, push, LLM thật
Handoff: H03_wp4-emergency.md
Base: f854cf3baf63337902720d43869041f8bf62db8e
Head: 183df6bb38216c08597c51b4ace599eb187be940

## Lệnh + exit (output máy ở `evidence/WP4/*.txt`, đã commit trong Head)
| Lệnh | Kết quả | File |
|---|---|---|
| `init_brain.js --check` | exit 0 | — |
| `python -m pytest -q -p no:cacheprovider` | `292 passed`, EXIT=0 | `pytest.txt` |
| `pytest tests/test_maintenance/test_emergency.py` | `26 passed`, EXIT=0 | `pytest-emergency.txt` |
| `pytest --collect-only -q \| grep -c "::"` | 292 | `collect.txt` |
| `ruff check` / `ruff format --check src tests` | `All checks passed!` EXIT=0 / `50 files already formatted` EXIT=0 | `ruff.txt` |
| kiểm lock (AST: mỗi method mới có `with self.lock:` và gọi `self.transition(`/`self._mutate(`) | 5/5 đạt, `violations=0`, EXIT=0 | `lock-grep.txt` |

Test: tổng 292 · pass 292 · fail 0 · skip 0 (nền WP3 266; +26 trong `test_emergency.py`; ngưỡng 282).
`grep -cP '[\x08\x0c\x0b]'` trên engine.py, test_emergency.py, test_api.py: 0.

Làm đỏ:
- `_cleared` cho `EMERGENCY_PENDING_BQL` được gỡ ⇒ `test_resume_and_jobs_never_clear_emergency` đỏ, `1 failed, 25 passed`, EXIT=1 (`red-resume-clears.txt`).
- Tắt guard Q19 ⇒ `test_bql_tier2_choices_need_escalation` đỏ, `1 failed, 25 passed`, EXIT=1 (`red-no-q19.txt`).
- Hoàn tác ⇒ 292 passed, EXIT=0 (`green-after-restore.txt`).

## Ánh xạ E-xx -> test (tên cố định theo TESTING §4)
E-01/02 `test_bptn_confirm_safe_resumes_pipeline` · E-03 `..._needs_note` · E-04 `test_bptn_escalate_e01_changes_owner_not_status`, `test_bptn_cannot_touch_emergency_action_denied` · E-05 `test_bptn_request_info_sets_safety_context_12h`, `test_safety_need_info_escalates_12h_and_job_never_auto_clears` · E-06 `test_resident_addition_reruns_2b` · E-07 `test_bql_t07_escalate_from_need_info` · E-08 `test_bql_t03_confirm_safe_from_need_info` · E-09 `test_safety_review_only_escalates_never_clears` · E-10 `test_resume_and_jobs_never_clear_emergency` · E-11 `test_bql_emergency_close` · E-12 `test_bql_downgrade_routes_normally` · E-13 `test_bptn_resolve_rejects_safety_blockers` · E-14 `test_pairs_outside_table_are_invalid` · E-15 `test_resident_view_hides_risk_and_shows_checking_label`; thêm `test_only_bql_reaches_closed_from_verifying[5 vai]`, `test_system_actor_cannot_move_verifying_to_received`, `test_bql_rows_expose_risk_owner_and_filters`, `test_audit_failure_rolls_back_safety_action`, `test_emergency_created_notification_payload`, Q19 `test_bql_tier2_choices_need_escalation`.

## git diff --stat f854cf3..183df6b
```
 brain4agent/memory/hot/today.md          |   1 +
 planning/.../evidence/WP4/*.txt (8 file) |  36 +
 src/maintenance/engine.py                | 355 ++++++-
 tests/test_maintenance/test_api.py       |   2 +-
 tests/test_maintenance/test_emergency.py | 363 +++++
 12 files changed, 753 insertions(+), 4 deletions(-)
```
Cây còn lại không đụng: `D docs/flow_*.png` x2, `?? docs/Activity Diagram.png`.

## Bảng phân công thực tế
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP4 engine (guard quyền/khẩn cấp) + test | 🟠 | Claude Sonnet 5.5 (🟠), không giao xuống thấp hơn |

## Việc KHÔNG làm + lý do
- `views.py`, `i18n/vi.yaml`, `messages.py`: không phải sửa; P02 §9 đã có từ WP2 (nhãn "Đang được kiểm tra", `bql_rows`, `allowed_actions`), E-15 và test BQL rows xanh trên code hiện có.
- E-02 đòi `priority == HIGH` (PRI-H1): priority là WP5 (`priority.py`), test chỉ khẳng định `ROUTED` + `DEPT_TECHNICAL` + `risk NONE`; thêm assert priority ở WP5.
- E-13 bản SPEC dùng `set_priority(BPTN, ...)`: chưa có (WP5); thay bằng `transition(RECEIVED, BPTN)` (403+audit) và `attempt(EDIT_RAW, BPTN)`; thêm ca `set_priority` ở WP5.

## Drift
1. P02 §5.1 nói chặn BPTN "kể cả `bptn_resolve`" (403), nhưng E-13, §5.5, §11 và TESTING X-2 đều đòi `bptn_resolve` trên blocker an toàn là `GuardError` 409. Làm theo E-13/§11/X-2: `_mutate_locked` deny BPTN trên blocker BQL cho mọi action TRỪ `Action.BPTN_RESOLVE`, để guard cũ của `bptn_resolve` ném 409. Nếu SO muốn 403, xoá 1 điều kiện `action != Action.BPTN_RESOLVE` và đổi E-13 + X-2.
2. P02 §2 ghi BQL "không cần escalated" (V-08), trái Q19 (handoff §1). Làm theo Q19: BQL chỉ dùng 3 lựa chọn Bậc 2 (`safety_confirm_safe`, `safety_escalate` E01, `safety_request_info`; kể cả qua `transition` T05/T06) khi `blocker.escalated`; vi phạm ⇒ 403 + audit. T03/T07 (NEED_INFO) không bị chặn vì vốn chỉ BQL.
3. `tests/test_maintenance/test_api.py` KHÔNG thuộc phạm vi WP4 (chỉ `test_engine.py` được sửa test cũ). Phải sửa 1 token: `test_invalid_transition_is_409` đóng `SIM-TKT-CLN-004`, nay là ticket khẩn cấp nên `close` không ghi chú ra `GUARD_FAILED` (đúng P02 §4.5) thay vì `INVALID_TRANSITION`; đổi sang `SIM-TKT-TEC-002` (VERIFYING/ASSET_UNCLEAR, vẫn 409 INVALID_TRANSITION). Hệ quả bắt buộc của T10; xin SO xác nhận hoặc hoàn tác.
4. `_deny` trong `_safety_precheck` nhận `reason` = note (hoặc `None` nếu trống) để audit có `message` khi note rỗng; SPEC chỉ ghi truyền `note`.
5. `_cleared` MISSING_INFO safety dùng `submitted_at > blocker.since` đúng SPEC: một bổ sung ghi cùng một tick đồng hồ với lúc hỏi sẽ không tính (test tiến đồng hồ 1 giờ).

## Câu hỏi mở
- Drift 1 (403 hay 409 cho `bptn_resolve` của BPTN trên ticket khẩn cấp) và drift 3 cần SO phán.
- Q19 có bao gồm đường `transition(tid, RECEIVED/NEED_INFO, BQL)` hay chỉ 3 method? Tôi chặn cả hai để không có lối vòng.

⏳ Chờ người duyệt.

SO đo lại 2026-10-01 18:50: pytest 292 passed EXIT=0 · ruff EXIT=0 · format EXIT=0 · diff f854cf3..183df6b 12 file trong phạm vi. Drift 2 (theo Q19) và drift 3 (test_api.py đổi sang TEC-002) chấp nhận. Drift 1 SAI nguồn: CR-03 §4.4 bất biến 5 + AC-06 bắt `ACTION_DENIED` (403, có audit) cho MỌI hành động BPTN trên blocker chủ BQL, kể cả `bptn_resolve`. `bptn_resolve` trên `SAFETY_REVIEW_REQUIRED` (chủ BPTN) giữ 409 GuardError.
🔁 SỬA: drift 1 — bỏ ngoại lệ `action != Action.BPTN_RESOLVE` ở engine.py:1251; sửa E-13 + X-2 theo 403; thêm làm đỏ chứng minh.

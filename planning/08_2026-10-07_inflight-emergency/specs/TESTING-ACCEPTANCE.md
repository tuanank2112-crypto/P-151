# TESTING-ACCEPTANCE — ma trận, đột biến, cổng, Exit Gates

File test mới: `tests/test_maintenance/test_p08_inflight_emergency.py` (engine, WP1) · thêm ca vào `tests/test_maintenance/test_api_safety.py` (route, WP2). Dựng ticket bằng helper sẵn có (`tests/test_maintenance/helpers.py`, `conftest.py`) — đi qua `receive` + thao tác thật tới trạng thái nguồn, KHÔNG dựng `Case` bằng tay bỏ qua engine.

## 1. Ma trận nghiệm thu (mỗi dòng ≥ 1 test, tên test chứa mã `a01`…)
| Mã | Ca | Kỳ vọng (đo được) | Bất biến |
|---|---|---|---|
| A-01 | DEPARTMENT báo ở `ROUTED` | `VERIFYING/EMERGENCY_PENDING_BQL`, owner BQL, `risk_level=EMERGENCY`, 1 notify `emergency.created` (payload 01 §5), audit `REPORT_EMERGENCY`, `emergency_return.status=ROUTED` | I-3 |
| A-02 | DEPARTMENT báo ở `IN_PROGRESS` có checklist + vật tư đã xuất | như A-01; `department_id`, `accepted_at`, checklist, `material_lines`, ảnh, `priority`, `agent_decision`, `risk_signals`, tồn kho BẰNG NHAU trước/sau | I-4 |
| A-03 | Báo ở `ON_HOLD/BLOCKED_ONSITE` | `emergency_return.blocker` == blocker cũ toàn trường (gồm `eta`, `since`) | I-5 |
| A-04 | BPTN báo ở `READY_FOR_REVIEW`; DEPARTMENT cùng ca | BPTN ⇒ VERIFYING; DEPARTMENT ⇒ 403 + `ACTION_DENIED`, ticket không đổi | I-6, I-7 |
| A-05 | BPTN báo ở `VERIFYING/PENDING_REVIEW` | vẫn `VERIFYING`, blocker → `EMERGENCY_PENDING_BQL`, `emergency_return.blocker.code=PENDING_REVIEW` | — |
| A-06 | Báo ở `VERIFYING/SAFETY_REVIEW_REQUIRED` | 409, thông điệp nêu E01/`safety_escalate`; không ghi | — |
| A-07 | Phòng ban KHÁC báo | 403 + `ACTION_DENIED`; không đổi | I-6, I-7 |
| A-08 | RESIDENT / WAREHOUSE / SYSTEM báo | 403 + `ACTION_DENIED` | I-7 |
| A-09 | Báo ở `CLOSED`, `CANCELLED`, `MERGED`, `NEED_INFO` | 409; không ghi | — |
| A-10 | Báo lần hai trên ticket đã báo | 409 "đã khẩn cấp" | I-1 |
| A-11 | `note` rỗng / "   " / 501 ký tự | `GuardError`; ticket + audit + notify không đổi | I-3 |
| A-12 | BPTN báo ở `VERIFYING/WRONG_DEPT_AFTER_START` | 403 (BQL_REASONS); BQL cùng ca ⇒ OK | I-7 |
| A-13 | Ticket đã báo + `run_jobs` mô phỏng 72 giờ + `resume()` | blocker vẫn `EMERGENCY_PENDING_BQL`, trạng thái không đổi | I-2 |
| A-14 | BQL restore từ 5 nguồn (ROUTED+OUT_OF_HOURS, IN_PROGRESS+REWORK, ON_HOLD+BLOCKED_ONSITE, READY_FOR_REVIEW, VERIFYING+PENDING_REVIEW) | trạng thái + blocker == trước khi báo (toàn trường); `risk_level=NONE`; `safety_cleared_*` đặt; `emergency_return=None`; `agent_decision`, `classification`, `material_lines`, tồn kho, số lần gọi client giả = 0 KHÔNG đổi | I-5 |
| A-15 | `emergency_downgrade` trên ticket báo khẩn; `emergency_restore` trên khẩn cấp do 2b | cả hai 409, không ghi | Q04 |
| A-16 | BQL `emergency_close` ticket báo khẩn đang `IN_PROGRESS` có vật tư | `CLOSED/EMERGENCY_HANDLED`, tồn kho không đổi, `emergency_return` giữ, ticket `WAITING_EMERGENCY` cạnh nó được thả | P4 |
| A-17 | BPTN / DEPARTMENT gọi restore | 403 + `ACTION_DENIED` | I-1 |
| A-18 | Đường chung: BPTN `transition(ROUTED→VERIFYING)`; BQL `transition(VERIFYING→ROUTED)`; BQL `transition(VERIFYING→IN_PROGRESS)` trên ticket báo khẩn | bị từ chối (403 hoặc 409 theo F10 đã sửa ở H13), KHÔNG tạo blocker `WRONG_DEPT`, ticket không đổi | I-8 |
| A-19 | Ticket mở cùng vị trí trong cửa sổ trùng, rồi báo khẩn | `related_ticket_ids` hai chiều như ca 2b | — |
| A-20 | `bql_merge` ticket báo khẩn | 409 | — |
| A-21 | `len(TRANSITIONS) == 28 + 7`; 5 dòng mới `method_only`; T15/T16/T17 test cũ xanh | — | I-9 |
| A-22 | Round-trip `Case` có `emergency_return` qua store memory + `--pg` | bằng nhau; validator 01 §2 từ chối 3 doc sai (status ngoài bảng, blocker sai trạng thái, `emergency_return` ở `IN_PROGRESS`) | — |
| A-23 | `HEAD_REVISION == "0003_emergency_return"`; DB ở 0002 ⇒ `check()` từ chối | — | Q06 |
| A-24 | API (WP2): 2 route × {200, 403, 404, 409} qua `TestClient` | mã HTTP đúng bảng SPEC-P01 §4 | — |

## 2. Đột biến (mỗi cái PHẢI làm đỏ ≥ 1 test mới; khôi phục sau; output vào evidence)
- (a) `_apply_transition` bỏ kiểm `reason_actors` ⇒ A-18 hoặc A-04 đỏ.
- (b) restore đi qua `RECEIVED` + `_run_pipeline(work, 2, now)` ⇒ A-14 đỏ.
- (c) bỏ `_scope_error` trong `report_emergency` ⇒ A-07 đỏ.
- (d) không chặn T05 khi có `emergency_return` ⇒ A-15 đỏ.

## 3. Cổng an toàn (không được đổi)
`seed/maintenance_v1/lexicon.yaml`, `src/maintenance/safety.py`, `src/maintenance/agent/**` có `git diff` RỖNG. `tests/test_maintenance/test_safety*.py` xanh nguyên số.

## 4. Bằng chứng (`evidence/<goi>/*.txt`, mỗi file kết `EXIT=<n>`)
WP1: `red-before.txt` (test mới đỏ trước sửa), `green.txt`, `mutation-{a,b,c,d}.txt`, `pytest.txt`, `pg.txt`, `ruff.txt`, `safety-diff.txt` · WP2: `api.txt`, `pytest.txt`, `ruff.txt` · WP3: theo H03.

## 5. Exit Gates (đóng hồ sơ khi mọi ô môi trường thật ✅)
| Gate | local | `--pg` | server |
|---|---|---|---|
| G1 ma trận A-01…A-23 xanh | ⬜ | ⬜ | — |
| G2 đột biến a–d đỏ | ⬜ | — | — |
| G3 pytest/ruff toàn bộ, số test ≥ baseline, 0 skip mới | ⬜ | ⬜ | — |
| G4 API A-24 | ⬜ | — | ⬜ (gọi thật 2 route trên môi trường triển khai, ticket `SIM-`) |
| G5 thẩm định H03 ✅ | ⬜ | — | — |
| G6 migration `0003` chạy trên DB triển khai, `check()` OK | — | ⬜ | ⬜ |

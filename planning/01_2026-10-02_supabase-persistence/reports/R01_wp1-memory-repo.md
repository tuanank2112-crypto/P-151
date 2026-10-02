Worker P-151 · thi công · Anthropic/Claude Opus 5.5 · Bước 0 exit 0 · hiểu việc: phạm vi = store/{__init__,base,memory}.py + engine.py + routers/maintenance.py (_call) + test_store_memory.py / xong khi = pytest exit 0 ≥155+mới 0 skip, ruff check+format exit 0, diff chỉ file §2, không còn `self.cases[` gán / cấm = postgres.py, Alembic, photos/auth/main, get_engine(), specs/plan/docs/brain4agent/.env, sửa assert test cũ, push
Handoff: H01_wp1-memory-repo.md
Base: f2da6cb
Head: 413aebcfd2c11577eebe2f1ef572a5d51c1779d6

## Lệnh + exit  (nguyên văn)
| Lệnh | Exit | Kết quả |
|---|---|---|
| `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` | 0 | `NÃO ĐÃ OK — KHÔNG CẦN NÂNG CẤP THÊM!` |
| `python -m pytest -q` (tại base, trước khi sửa) | 0 | `155 passed in 14.47s` |
| `python -m pytest -q` (sau khi sửa) | 0 | `161 passed in 13.59s` |
| `python -m ruff check src tests` | 0 | `All checks passed!` |
| `python -m ruff format --check src tests` | **1** | `2 files would be reformatted, 51 files already formatted` → `src\api\routers\maintenance.py:236:1`, `src\maintenance\ai_logger.py:19:1` |
| `git show f2da6cb:<file> \| ruff format --check --stdin-filename <file> -` cho 2 file trên | 1 / 1 | đã lệch format **ngay tại base** (không do WP1) |
| `ruff format --check` trên 5 file WP1 tạo/sửa trong src/maintenance + tests | 0 | `5 files already formatted` |
| `grep -n "self.cases\[" src/maintenance/engine.py` | 1 | không có dòng nào |
| `grep -cP '[\x08\x0c\x0b]'` trên 6 file .py đã đụng | — | 0 cho từng file |
| `git commit` | 0 | `413aebc` |

## Test  tổng / pass / fail / skip ; test mới (tên)
161 / 161 / 0 / 0 (155 cũ + 6 mới; không sửa test cũ nào).
Mới, trong `tests/test_maintenance/test_store_memory.py` (fixture `repo` tham số hoá `["memory"]`):
- `test_t01_case_round_trip_after_reset` (T01)
- `test_t02_audit_sink_failure_changes_nothing` (T02)
- `test_t03_guard_error_in_op_changes_nothing` (T03)
- `test_t05_stale_save_raises_concurrency_error` (T05)
- `test_engine_cases_is_read_only` (gán item ⇒ TypeError)
- `test_next_ticket_number_never_hands_out_a_number_twice`

## git diff --stat f2da6cb
```
 .../wp1/red-test_engine_cases_is_read_only.txt     |  26 ++
 ...icket_number_never_hands_out_a_number_twice.txt |  41 ++++
 .../red-test_t01_case_round_trip_after_reset.txt   |  30 +++
 ...test_t02_audit_sink_failure_changes_nothing.txt |  39 +++
 ...-test_t03_guard_error_in_op_changes_nothing.txt |  43 ++++
 ...est_t05_stale_save_raises_concurrency_error.txt |  36 +++
 src/api/routers/maintenance.py                     |   5 +
 src/maintenance/engine.py                          | 264 +++++++++++++--------
 src/maintenance/store/__init__.py                  |  23 ++
 src/maintenance/store/base.py                      |  90 +++++++
 src/maintenance/store/memory.py                    | 208 ++++++++++++++++
 tests/test_maintenance/test_store_memory.py        | 133 +++++++++++
 12 files changed, 844 insertions(+), 94 deletions(-)
```

## Bằng chứng đỏ  (đường dẫn evidence)
Mỗi file ghi: file bị phá, đoạn chèn, lệnh, exit code, output pytest. Code đã trả lại (sha256 `engine.py` trước = sau = `f2b5a4e5…871e1b`).
| Test | Cách phá | Exit | File |
|---|---|---|---|
| T01 | `memory.get` luôn trả case đầu tiên | 1 | `evidence/wp1/red-test_t01_case_round_trip_after_reset.txt` |
| T02 | `transaction()` vẫn áp thay đổi khi khối `with` raise | 1 | `evidence/wp1/red-test_t02_audit_sink_failure_changes_nothing.txt` |
| T03 | engine `work = case` (không deep copy) | 1 | `evidence/wp1/red-test_t03_guard_error_in_op_changes_nothing.txt` |
| T05 | bỏ kiểm `version` ở `save` và lúc commit | 1 | `evidence/wp1/red-test_t05_stale_save_raises_concurrency_error.txt` |
| cases chỉ đọc | thêm `CasesView.__setitem__` | 1 | `evidence/wp1/red-test_engine_cases_is_read_only.txt` |
| next_ticket_number | đánh số kiểu cũ `len(cases)+1` | 1 | `evidence/wp1/red-test_next_ticket_number_never_hands_out_a_number_twice.txt` |

Ghi chú: lần đầu, cách phá T03 = "áp thay đổi khi raise" cho exit 0 (test còn xanh vì op raise trước mọi ghi). Đã làm chặt T03 (thêm op sửa `work` rồi raise `GuardError`), đổi cách phá như bảng; file evidence T03 là lần chạy sau đó.

## Phân công  gói → tầng yêu cầu → họ/model đã dùng
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP1 (không tách gói con) | 🔴 | Anthropic / Claude Opus 5.5 (tự làm) |

## Không làm + lý do
- Gate `ruff format --check src tests` exit 1: 2 file đã lệch format từ base `f2da6cb`. `ai_logger.py` nằm ngoài phạm vi §2. Router chỉ được sửa `_call`/chỗ đọc `engine.cases`, nên không format lại cả file.
- Không sửa `views.py` và chỗ đọc `engine.cases` trong router: `CasesView.values()` đọc thẳng `repo.list()`, nên 155 test cũ xanh mà không cần sửa.
- `get_engine()` vẫn gọi `engine.reset()` (đổi ở WP4, theo handoff).
- File report này không nằm trong commit `413aebc`: Head phải là SHA thật, mà commit không chứa được SHA của chính nó; chỉ có một commit được phép.

## Câu hỏi mở
1. `EngineError`/`NotFoundError`/`GuardError` chuyển sang `store/base.py` (engine import lại) để không import vòng; `ConcurrencyError`/`StoreUnavailableError` được router và test import từ `store.base`, không qua engine. Có cần ghi điều này vào `01-CONTRACTS §5` không?
2. T02/T05 cần đọc `version` và số dòng audit_log. `InMemoryRepository` có thêm 3 method chỉ để test (`version_of`, `log_rows`, `notification_rows`), không thuộc Protocol §2. WP2 cần chốt cách test hợp đồng đọc các giá trị này trên Postgres.
3. Hai chỗ đổi hành vi đã nằm trong SPEC: `notify_sink` lỗi giờ thành `AuditWriteError` + rollback (trước đây lỗi lọt ra sau khi đã commit); số ticket theo bộ đếm không tái dùng (`ingest` thủ công số `n` đẩy bộ đếm lên ≥ n, giống `setval`), không còn lấp chỗ trống như `len+1`.
4. `CasesView.__getitem__` đổi `NotFoundError` thành `KeyError` để `.get()` và `in` của Mapping chạy đúng. SPEC ghi `__getitem__ = repo.get`.
5. `Tx.save` khi chưa `get_for_update` thì raise `GuardError`. SPEC chưa định lỗi cho trường hợp này.

✅ thi công xong trong phạm vi · 🔁 gate format: 2 file lệch từ base, ngoài phạm vi, cần người quyết

## SO đo lại (2026-10-02)
- `pytest -q` → 161 passed, 0 skip · `ruff check src tests` exit 0 · `ruff format --check` 5 file WP1 exit 0
- 2 file lệch format đo tại base `f2da6cb`: router exit 1, ai_logger exit 1 ⇒ có sẵn, không do WP1
- `git diff --name-only f2da6cb 413aebc` ngoài phạm vi H01: không có · evidence/wp1: 6 file
## SO quyết câu hỏi mở
1. Lỗi engine nằm ở `store/base.py`, engine re-export — GIỮ; architect ghi vào 01-CONTRACTS §5.
2. `version_of/log_rows/notification_rows` = helper CHỈ CHO TEST, ngoài Protocol; WP2 cài y hệt trên Postgres (đọc trực tiếp bảng).
3. Hai đổi hành vi (notify_sink lỗi ⇒ rollback; số ticket không tái dùng) — CHẤP NHẬN, đúng SPEC.
4. `CasesView.__getitem__` ⇒ KeyError — CHẤP NHẬN (đúng hợp đồng Mapping).
5. `Tx.save` chưa `get_for_update` ⇒ GuardError — CHẤP NHẬN; architect ghi vào bảng lỗi.
Gate format: chỉ áp cho file trong phạm vi handoff; 2 file lệch có sẵn để người sở hữu xử lý.
✅ DUYỆT

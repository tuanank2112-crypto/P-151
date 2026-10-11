Vai ORCHESTRATOR (root kiêm WP2) · thi công · Claude/Opus 5.5 · Bước 0 exit 1 (hub thiếu) · phạm vi: engine/router/material_policy theo SPEC-P01 §B1 + `src/main.py` (root mở rộng, lý do dưới); xong khi 3 file test xanh memory + pg, full suite không giảm; cấm sửa oracle, store schema, safety/auth/LLM.
Handoff: H02_backend.md
Base: 71315109d845fe69935050b09d4ab4c67efb024a + baseline.txt
Head: 71315109d845fe69935050b09d4ab4c67efb024a + `git diff HEAD | sha256sum` = 08a8c2abb8f501acab0e9fe75648f9116009118a9391a99cc7451d6ee565d056

## Lệnh và số đo

| Lệnh | Exit | Kết quả | Evidence |
|---|---|---|---|
| `python -m pytest tests -q -p no:cacheprovider` | 0 | 3438 passed, 95 deselected, 0 fail/skip (sau sửa R04) | `evidence/wp2/full_suite.txt` |
| `docker run … p151-backend python -m pytest tests --pg -q` (DB `p151_test`) | 0 | 3533 passed (sau sửa R04) | `evidence/wp2/pg_suite.txt` |
| `ruff check src tests` · `ruff format --check src tests` · `git diff --check` | 0 · 0 · 0 | 117 file đã format | `evidence/wp2/lint.txt` |
| typecheck | N/A | không cấu hình mypy/pyright (chỉ `ruff.toml`); §T3 cấm thêm để giả gate | `evidence/wp2/lint.txt` |

## Diff so với nền (`evidence/wp2/diffstat.txt`)
`engine.py` +85/−4 (guard `record_material`/`confirm_materials`, `save_material_usage` một `_mutate`, `_reconcile` thêm `material_required`/`material_invalid`) · `routers/maintenance.py` +28/−2 (`POST material-usage`, `WholeQty`, validator `material-plan`, `material_codes_by_department`) · `material_policy.py` mới 88 dòng · `src/main.py` +13 (handler 422).

`src/main.py` ngoài §B1: body có NaN/Infinity làm handler 422 mặc định của FastAPI nổ 500 (không encode được JSON) — đo được qua test `test_bad_quantities_are_refused_by_the_api[nan|inf]`. Sửa một chỗ chung cho mọi route (bỏ `input`/`ctx` chỉ khi không encode được), không đổi shape 422 bình thường.

## Phân công thực tế
| Gói | Tầng yêu cầu | Họ/model |
|---|---|---|
| Backend theo contract | 🟠 | Claude Opus 5.5 (lên tầng) |
| Mở rộng `src/main.py` | 🔴 root | Claude Opus 5.5 |

## Không làm / lý do
- Không sửa repo transaction (memory/postgres): RED không chứng minh abstraction thiếu; rollback đo đạt cả hai store.
- Không migration/sửa ticket cũ; dòng cũ sai guard đọc được, chỉ không hoàn thành được (`material_invalid`).
- Không expected-version/idempotency key (§C4 vùng cấm).

## Sửa sau R04 (🔁 F1, F2, F5)
| Lỗi | Sửa | Đo lại | Evidence |
|---|---|---|---|
| F1 10**400 ⇒ 500 | `whole_positive`: `float()` trong try, `OverflowError` ⇒ False | `live_bigint.sh` 3/3 ⇒ 422; test thêm tham số `10**400`, `None` | `evidence/wp2/r04_f1_recheck.txt` |
| F2 engine `"1"`/`None` ⇒ TypeError | `record_material` kiểm số nguyên dương trước `used > issued` | `probe_backend.py` memory 92/92, pg 92/92 HELD; `probe_api.py` 48/48 | `evidence/wp2/r04_probes_recheck.txt` |
| F5 `src/main.py` ngoài owner | Chấp nhận, SPEC-P01 §B1 thêm `src/main.py` (D08/D12) | — | `plan.md` |
RED nền đo lại 48 failed/3 passed (hash nền khớp); mutants m1–m5 đỏ 4/3/1/7/1 (`evidence/wp1/*.txt`).

## Câu hỏi cần người
Không.

✅ DUYỆT

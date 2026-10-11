Vai ORCHESTRATOR (root kiêm WP1) · thi công · Claude/Opus 5.5 · Bước 0 exit 1 (hub `../brain4agent.release` không tồn tại, MODULE_NOT_FOUND) · phạm vi: 3 file test mới §T1 + evidence/wp1; xong khi RED đo được trên nền vì nền CHẤP NHẬN dữ liệu sai, GREEN sau backend, mutant đỏ; cấm sửa runtime/oracle cho xanh.
Handoff: H01_regression.md
Base: 71315109d845fe69935050b09d4ab4c67efb024a + baseline.txt (engine 9c38fd87…, router 339f50b7… khớp — evidence/wp1/red_baseline.txt)
Head: 71315109d845fe69935050b09d4ab4c67efb024a + `git diff HEAD | sha256sum` = 08a8c2abb8f501acab0e9fe75648f9116009118a9391a99cc7451d6ee565d056 (chưa commit; + 4 file mới untracked)

## Lệnh và số đo

| Phép đo | Lệnh | Kết quả | Evidence |
|---|---|---|---|
| RED nền (snapshot hash-checked) | `snapshot.py . <snap_red> base` + pytest 3 file | 48 failed / 3 passed, exit 1 (đo lại sau sửa R04) | `evidence/wp1/red_baseline.txt` |
| RED đúng nguyên nhân guard | `legacy_probe.py` (chỉ đường cũ) | nền: ACCEPTED 8/8 (kể cả kho LAMP-01 = 4.5); HEAD: REFUSED 8/8 | `evidence/wp1/legacy_probe.txt` |
| GREEN memory | pytest 3 file | 51 passed, 7 deselected (pg) | `evidence/wp2/full_suite.txt` |
| GREEN PostgreSQL | pytest `--pg` trong image backend, DB `p151_test` | nằm trong 3533 passed | `evidence/wp2/pg_suite.txt` |
| Mutants (bản sao riêng) | `snapshot.py . <snap_m> head mX` | m1 4 đỏ · m2 3 đỏ · m3 1 đỏ · m4 7 đỏ · m5 1 đỏ (exit 1 cả 5; đo lại sau sửa R04) | `evidence/wp1/mutants.txt` |

Số test: nền 3387 → 3438 passed (+51 mới, gồm +5 tham số `None`/`"1"`/`10**400` thêm sau R04 F1/F2), 0 fail, 0 skip; pg deselected 88 → 95 (+7 ca store `--pg`).

## Diff (`evidence/wp2/diffstat.txt`)
Mới: `test_material_guards.py` ~303 dòng, `test_material_usage.py` 144, `test_material_usage_store.py` 179. Sửa 2 test cũ có chủ ý: `test_engine.py::test_confirm_no_materials_sets_mode_na` → `..._is_refused_for_technical` (§C3 Kỹ thuật rỗng nay 409); `test_issuing_more_than_the_stock…` ca used>issued đổi `0/1` → `1/2` (số 0 nay bị guard số nguyên dương chặn trước, R04 F2). Số test không giảm.

## Phân công thực tế
| Gói | Tầng yêu cầu | Họ/model |
|---|---|---|
| Oracle + test | 🟠 | Claude Opus 5.5 (lên tầng: root làm thay, không phóng worker riêng) |
| Report | 🟢 | Claude Opus 5.5 |

## Không làm / lý do
- Test chống stale edit (expected-version): CONTRACTS §C4 nói không hứa — không viết.
- Snapshot RED giữ `material_policy.py` (helper thuần, nền không gọi) để test đỏ do hành vi, không do ImportError.

## Câu hỏi cần người
Không.

✅ DUYỆT

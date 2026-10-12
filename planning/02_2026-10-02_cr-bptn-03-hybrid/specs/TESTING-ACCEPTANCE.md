# TESTING-ACCEPTANCE

## 1. Lệnh cổng

```
.venv/Scripts/python.exe -m pytest -q            # mọi test, 0 fail, 0 skip ngoài 20 test --pg đã deselect
.venv/Scripts/python.exe -m ruff check src tests
.venv/Scripts/python.exe -m ruff format --check src tests
```
Số test không được giảm so với baseline 185 trừ test reopen bị xoá có lý do (CR-03 §4.3).

## 2. Ma trận AC (CR-03 §15) → test

File mới `tests/test_maintenance/test_cr03.py` (+ `test_safety.py` cho bộ câu).

| AC | Test |
|---|---|
| AC-01, AC-02, AC-03, AC-04 | `test_safety.py` bộ câu + `test_ac01_*`… trong `test_cr03.py` |
| AC-05 | `test_ac05_llm_cannot_lower_a_rule_signal` |
| AC-06 | `test_ac06_*` (cần lý do; BPTN lên Bậc 1 ⇒ 403 + audit) |
| AC-07 | `test_ac07_resume_and_jobs_never_clear_emergency` |
| AC-08 | `test_ac08_*` (bổ sung chạy lại 3b; quá hạn leo thang, không tự an toàn) |
| AC-09 | `test_ac09_*` (đóng khẩn cấp, hạ, ticket tiếp theo) |
| AC-10 | `test_ac10_*` (mỗi PRI-* một ticket; sửa tay; sắp xếp) |
| AC-11 | `test_ac11_*` (gộp hai chiều, nối, hoàn tác, hủy gốc) |
| AC-12 | `test_04_*` (giữ) + `test_ac12_material_short_after_accept` |
| AC-13 | `test_ac13_*` |
| AC-14 | `test_07_*`, `test_step10_*` (giữ) |
| AC-15 | `test_ac15_*` (không reopen, rating một lần) |
| AC-16 | `test_transition_table_matches_the_cr` (cập nhật số dòng) + `test_ac16_*` |
| AC-17 | `test_12_resident_view_hides_internal_fields` (thêm `risk_*`, `priority`) |
| AC-18 | `test_instruction_in_content_is_data` (giữ) |
| AC-19 | `test_10d`, `test_10e` (giữ) |
| AC-20 | `test_02*` (giữ) |

## 3. Bộ ≥40 câu an toàn (Evaluation Evidence)

`tests/test_maintenance/safety_cases.yaml`: mỗi dòng `{text, expected: EMERGENCY|UNCLEAR|NONE}`, gồm B-01…B-05.
`test_safety.py` đo và in: tổng, bỏ sót Bậc 1 (expected EMERGENCY mà ra khác), báo nhầm (expected NONE mà ra
EMERGENCY/UNCLEAR). **Ngưỡng cứng: bỏ sót Bậc 1 = 0.** Báo nhầm ghi số liệu vào evidence.

## 4. Bằng chứng đỏ

Mỗi bất biến I-4, I-5, I-8 phải từng ĐỎ: tạm bỏ guard ⇒ test đỏ ⇒ khôi phục. Ghi output vào
`planning/02_2026-10-02_cr-bptn-03-hybrid/evidence/`.

## 5. Exit Gates

| Gate | local | server (Supabase) |
|---|---|---|
| G1 pytest xanh, 0 fail (290 + `--pg` 311) | ✅ `evidence/gates/g1-*.txt` | — |
| G2 ruff check + format | ✅ `evidence/gates/g2-ruff.txt` | — |
| G3 `evaluate` 12/12 | ✅ `evidence/gates/g3-evaluate.txt` | ⬜ |
| G4 bộ an toàn: bỏ sót Bậc 1 = 0 (50 câu, báo nhầm 0) | ✅ `evidence/gates/g4-safety-set.txt` | — |
| G5 bằng chứng đỏ I-4, I-5, I-8 | ✅ `evidence/wp-red/*.txt` (exit 1) | — |
| G6 ticket cũ trên Supabase đọc được (`GET /bql/tickets` 200) | — | ⬜ |

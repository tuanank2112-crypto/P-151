# TESTING & ACCEPTANCE (plan 09)

## §1. Bộ test hiện có
`pytest tests -q` trước plan: 3342 passed, 77 deselected (2026-10-08, sau merge `develop`). Sau plan: số pass KHÔNG giảm, 0 skip mới.

## §2. Test mới (file `tests/test_maintenance/test_list_cache.py`, đánh dấu `pg`, chạy với `--pg`)
| ID | Kịch bản | Kỳ vọng |
|---|---|---|
| T1 | Parity: seed fixture, so `list()` có cache với `select doc` trực tiếp | cùng ticket_id, cùng thứ tự, `model_dump()` bằng nhau |
| T2 | Gọi `list()` 2 lần không ghi | lần 2: `misses` không tăng |
| T3 | Ghi 1 ticket qua engine (`transition`) rồi `list()` | `misses` +1 đúng; doc mới phản ánh thay đổi |
| T4 | Repo B (instance khác, cùng DB) ghi; repo A `list()` | A thấy thay đổi ngay (I-1) |
| T5 | `wipe()` + seed lại | cache không trả ticket cũ; kết quả = DB |
| T6 | Doc hỏng (ghi JSON sai schema bằng SQL) | `list()` ném lỗi; cache không chứa doc hỏng; sửa doc ⇒ `list()` lại đúng |
| T7 | `resident_list` (SPEC-P02) trên store Postgres | 0 câu `select doc … where ticket_id` cho ticket đã có trong snapshot |
| T8 | `resident_list` có ticket gộp vào ticket của cư dân KHÁC (memory, không cần `--pg`) | view giống hệt khi không truyền `lookup` (so `model_dump()`) |

**Phép phá bắt buộc (bộ đo mới phải từng ĐỎ):** (a) bỏ bước xoá tid không còn trong `current` ⇒ T5 đỏ; (b) bỏ bước (1), chỉ trả cache ⇒ T3/T4 đỏ; (c) bỏ `lookup` ở `resident_list` ⇒ T7 đỏ. Ghi output vào `evidence/WP*/mutation-*.txt`.

## §3. Số đo hiệu năng (probe chỉ đọc, Supabase chung)
| Endpoint | Trước (median) | Ngưỡng sau |
|---|---|---|
| `GET /resident/tickets` | 2676 ms | ≤ 300 ms |
| `GET /mo/tickets` | 1514 ms | ≤ 300 ms |
| `GET /bql/tickets` | 503 ms (max 2708) | ≤ 300 ms, max ≤ 600 ms |
| SQL `resident_list` | 7 câu | ≤ 2 câu khi ấm |

## §4. Exit Gates
| Gate | local | server (container `backend`) |
|---|---|---|
| G1 ruff + pytest (≥ 3342 pass) — 3344 passed (`evidence/WP3/pytest.txt`, `ruff.txt`) | ✅ | — |
| G2 `pytest --pg` gồm T1–T7 xanh + phép phá từng đỏ — 3429 passed; 4/4 mutant đỏ (`evidence/WP1/mutation-*.txt`) | ✅ | — |
| G3 Số đo §3 đạt — cư dân 201, BPTN 224, BQL 219 ms (max 237); 1 câu SQL (`evidence/audit/*-after.txt`) | ✅ | ✅ |
| G4 4 vai đăng nhập, mở danh sách, mở chi tiết qua API của container (`evidence/WP3/g4-roles.txt`; chưa bấm tay trên trình duyệt) | ✅ | ✅ |
| G5 Response API danh sách không đổi: 8/8 vai giống từng byte trên DB chung (`evidence/WP3/api-parity.txt`) | ✅ | ✅ |

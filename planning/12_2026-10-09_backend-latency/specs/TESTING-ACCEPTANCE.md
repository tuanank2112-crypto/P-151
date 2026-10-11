# TESTING-ACCEPTANCE

## §1. Test mới
| ID | File | Kiểm | Phải ĐỎ trước sửa |
|---|---|---|---|
| P1 | `tests/test_maintenance/test_backend_latency.py` | `/health` < 300 ms khi upload chờ Storage chậm 1 s | ✅ |
| P2–P4 | cùng file | lô ảnh = 1 `_mutate`, tất cả hoặc không, file đã lưu bị xoá | ✅ (P2) |
| P5 | cùng file | cache ảnh: Storage `get` 1 lần, header `private, no-cache` + `ETag` (Q10), không gzip | ✅ |
| R1–R3, Z3, P5c | `test_backend_latency.py` | sửa sau thẩm định R01 (#2, #3, #7, #14); phép phá `mutate_r01.py` 8/8 đỏ | ✅ local |
| Z1–Z2 | cùng file | gzip JSON > 1 KB, không nén < 1 KB | ✅ |
| T1–T3 | `tests/test_maintenance/test_read_engine.py` (`--pg`) | AUTOCOMMIT, thử lại khi rớt kết nối, không thử lại lỗi khác | ✅ (T1, T2) |
| T4 | `test_store_postgres.py::test_t24_sql_budget` (cập nhật bộ đếm) | `GET /mo/tickets` = 1 câu | — |

## §2. Phép phá (bộ đo mới phải từng đỏ — AGENTS K.5)
| Mutant | Sửa | Phải đỏ |
|---|---|---|
| m1 | bỏ `run_in_threadpool` (gọi thẳng) | P1 |
| m2 | `add_*_photos` gọi `_mutate` từng ảnh | P2 |
| m3 | bỏ `GZipMiddleware` | Z1 |
| m4 | `_read` không thử lại | T2 |
| m5 | engine đọc không `AUTOCOMMIT` | T1 |

## §3. Exit Gates
| Gate | Điều kiện | local | server |
|---|---|---|---|
| G1 | pytest toàn bộ ≥ 3349 + test mới, 0 fail; ruff 0/0 | ✅ 3359 | — |
| G2 | `--pg` local toàn bộ xanh (gồm T1–T4) | ✅ 88 | — |
| G3 | 5/5 mutant đỏ, file khôi phục | ✅ | — |
| G4 | harness app plan 11 lượt xanh ALL PASS | ✅ | — |
| G5 | `:8000` probe: mọi GET đọc DB ≤ 120 ms median; danh sách có `enc=gzip`; ~~ảnh xem lại ≤ 50 ms~~ ảnh xem lại ≤ median GET + 10 ms (Q11: 1 vòng DB kiểm quyền là đáy; người dùng chọn (c) 2026-10-09) | — | ✅ GET 50–55 ms, gzip ✅; ⚠️ ảnh xem lại 56 ms > 50 ms (route vẫn đọc ticket để kiểm quyền = 1 vòng DB ~50 ms; bytes đã từ cache) |

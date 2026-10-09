# 12 — Giảm độ trễ backend: đọc DB, ảnh, truyền tải (2026-10-09)

| Trường | Giá trị |
|---|---|
| Trạng thái | 🟡 G1–G4 local ✅, G5 server ✅ trừ một điểm (ảnh xem lại 56 ms > mục tiêu 50 ms) — 2026-10-09 19:40:00 +0700; chưa commit |
| Loại | MINOR (tối ưu hiệu năng, KHÔNG đổi API/schema/luật nghiệp vụ) — đủ bộ SPEC → v1.8.0 |
| Yêu cầu | Người dùng, 2026-10-09: "dà soát lại toàn bộ backend là tìm ra các điểm có thể tối ưu được chúng" → "dựa theo những gì đã gợi ý hãy tối ưu lại backend để nhanh hơn, mượt hơn" |
| Nhánh | `feature/chamanh` (sau `e9960f0`) |
| Phạm vi | `src/maintenance/store/postgres.py`, `src/maintenance/engine.py` (2 hàm ảnh theo lô + `run_jobs`), `src/api/routers/maintenance.py` (2 route ảnh), `src/api/photos.py`, `src/main.py` (gzip), test mới + bộ đếm SQL của test pg, hồ sơ này, đồng bộ não + version |
| CẤM chạm | schema/Alembic, `src/web/`, `src/mobile/`, `portal/` (trừ `version`), `seed/`, `.env`, luật nghiệp vụ trong engine |

## §1. Nhật ký quyết định
| # | Mốc | Quyết định | Lý do |
|---|---|---|---|
| Q01 | 2026-10-09 | Làm các điểm rà soát #1 (engine đọc), #2 (ảnh khỏi event loop + lô), #4 (gzip), #6 (cache ảnh), #8 (job) | Lợi lớn, không đổi API/schema; "dựa theo những gì đã gợi ý" |
| Q02 | 2026-10-09 | KHÔNG làm #3 (khoá theo ticket), #5 (bỏ audit khỏi doc), #7 (`/bql/tickets/{id}` = API mới) | Rủi ro cao / đổi contract ⇒ kế hoạch riêng (Idea Vault) |
| Q03 | 2026-10-09 | KHÔNG làm #9 (gỡ `/api/v1/chat`, `/status`) | Phải xoá 3 test (AGENTS K.5: số test không giảm); route không gọi LLM ⇒ không rủi ro chi phí |
| Q04 | 2026-10-09 | Engine đọc riêng `AUTOCOMMIT` + bỏ pre-ping + thử lại 1 lần khi rớt kết nối; engine ghi giữ pre-ping | Đo: 232 → 52 ms; ghi không thử lại an toàn giữa transaction (V1) |
| Q05 | 2026-10-09 | Tổng kết nối giữ ≤ 5: ghi 2+0, đọc 2+1 | Plan 01 Q7 (trần pooler chưa đo) |
| Q06 | 2026-10-09 | Ảnh theo lô = tất cả hoặc không (trước: có thể ghi một phần) | Một transaction; file thừa bị xoá |
| Q07 | 2026-10-09 | Agent tự chọn Q01–Q06 (AGENTS L.2); người dùng đổi được | Quyết định kỹ thuật |

### Quyết định bị thay thế
- Plan 01 `01-CONTRACTS.md` §2 "`sql_engine(url)` = pool_size=2, max_overflow=3" → Q04/Q05: engine ghi 2+0 + engine đọc 2+1 (vẫn ≤5).
- Plan 09 Q07 "BỎ cách 3 (gzip)" → Q01 (#4): làm gzip ở đợt này.
- Plan 01 `test_t17_photo_api_is_unchanged`: `Cache-Control: private, max-age=3600` → `private, max-age=31536000, immutable` (SPEC-P02 §2; test cập nhật giá trị, không bỏ).

## §2. Work Packages
| WP | Việc | Tầng | SPEC |
|---|---|---|---|
| WP1 | Route ảnh khỏi event loop + engine lô + cache ảnh + test P1–P5 | 🟠 | SPEC-P02 |
| WP2 | Gzip + `run_jobs` + test Z1–Z2 | 🟢 | SPEC-P03 |
| WP3 | Engine đọc + `_read` + test T1–T4 (`--pg`) | 🔴 (lớp lưu trữ dùng chung) | SPEC-P01 |
| WP4 | Phép phá m1–m5, harness app, Docker `:8000` + probe sau | 🟠 | TESTING, OPERATIONS |
| WP5 | `docs/maintenance.md` §15 + não 6 điểm + version 1.8.0 | 🟢 | AGENTS §5.B |

## §3. Checklist thực thi
- [x] Số đo trước `evidence/before/probe-8000.txt`
- [x] Bộ SPEC (00, 01, P01, P02, P03, OPERATIONS, TESTING)
- [x] WP1 (P1–P5 đỏ trước sửa: `evidence/WP1/red-before.txt` — event loop đứng 1,00–1,01 s) · [x] WP2 · [x] WP3 (T1–T3 đỏ trước: `evidence/WP3/red-before.txt`)
- [x] WP4 G1–G4 local, G5 server (`evidence/after/probe-8000.txt`, `evidence/mutations/`, `evidence/app-harness-green.txt`)
- [x] WP5 `docs/maintenance.md` §15 + não + version 1.8.0

## §4. Bảng trỏ SPEC
| File | Nội dung |
|---|---|
| [`specs/00-ARCHITECTURE.md`](specs/00-ARCHITECTURE.md) | Số đo trước, mục tiêu, bất biến I-1..I-6, vùng cấm |
| [`specs/01-CONTRACTS.md`](specs/01-CONTRACTS.md) | Chữ ký, pool, bảng lỗi |
| [`specs/SPEC-P01-read-engine.md`](specs/SPEC-P01-read-engine.md) | Engine đọc AUTOCOMMIT + thử lại |
| [`specs/SPEC-P02-photos.md`](specs/SPEC-P02-photos.md) | Ảnh khỏi event loop, lô, cache |
| [`specs/SPEC-P03-transport.md`](specs/SPEC-P03-transport.md) | Gzip, `run_jobs` |
| [`specs/OPERATIONS.md`](specs/OPERATIONS.md) | Thứ tự, đo server, rollback |
| [`specs/TESTING-ACCEPTANCE.md`](specs/TESTING-ACCEPTANCE.md) | Test, phép phá, Exit Gates |

## §5. Phân công thực tế
| WP | Tầng yêu cầu | Đã dùng |
|---|---|---|
| SPEC | 🔴 | Claude Opus 5.5 (phiên chính) |
| WP1–WP5 | 🟠/🟢/🔴 | Claude Opus 5.5 (phiên chính; người dùng không yêu cầu agent con) |

Thẩm định độc lập (agent khác) CHƯA chạy.

## §6. Số đo nghiệm thu
| Đo | Kết quả |
|---|---|
| pytest toàn bộ | 3359 passed (3349 + 10 mới), 88 deselected, exit 0 |
| `--pg` local | 88 passed (85 + 3 mới), exit 0 |
| ruff check / format | 0 / 0 (112 file) |
| Phép phá m1–m5 | 5/5 đỏ, file khôi phục từng byte |
| App plan 11 M1–M17 | ALL PASS (39 dòng PASS) trên `:8001` |
| `:8000` GET median (trong container) | trước 226–280 ms → sau 50–55 ms |
| Danh sách trên dây | 54,4 / 69,0 / 24,6 KB → 4,1 / 3,7 / 2,4 KB (gzip) |
| Ảnh xem lại | 527 ms → 56 ms (lần đầu vẫn đi Storage) |

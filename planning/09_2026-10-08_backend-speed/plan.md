# 09 — Tăng tốc đọc backend: cache danh sách, bỏ N+1 màn cư dân (2026-10-08)

| Trường | Giá trị |
|---|---|
| Trạng thái | ✅ ĐÃ HOÀN THÀNH (2026-10-08 17:59:23 +0700) — gate local + server (container `backend` trên Supabase chung) đều ✅; CHƯA commit (chờ người dùng) |
| Loại | MINOR (tối ưu hiệu năng, KHÔNG đổi API/schema/UI) — đủ bộ SPEC → **v1.5.0** |
| Yêu cầu | Người dùng, 2026-10-08: "hãy audit lại toàn bộ backend và tối ưu lại toàn bộ để tối ưu tốc độ và trải nghiệm người dùng"; sau 5 câu hỏi: "Làm cái 1 và 2 thôi" |
| Nhánh | `feature/chamanh` (merge `develop` chưa commit lúc mở hồ sơ) |
| Phạm vi | `src/maintenance/store/postgres.py`, `src/maintenance/views.py`, `src/api/routers/maintenance.py` (chỉ `resident_list`), `tests/` (file mới), hồ sơ này, đồng bộ não + version |
| CẤM chạm | schema/migration, luồng ghi engine, agent/LLM, `src/web/`, `src/main.py`, `portal/`, `.env` |

## §1. Nhật ký quyết định
| # | Mốc | Quyết định | Lý do |
|---|---|---|---|
| Q01 | 2026-10-08 | Audit bằng số đo thật trước, chỉ GET/SELECT trên Supabase chung | DB dùng chung cả nhóm — không ghi để đo (OPERATIONS §5) |
| Q02 | 2026-10-08 | Nút cổ chai = `repo.list()` kéo 725 KB JSONB mỗi request (median 2.7 s), không phải CPU/Pydantic (7 ms) | `evidence/audit/db-probe-before.txt` |
| Q03 | 2026-10-08 | Cache trong tiến trình, khoá theo `xmin` từng dòng, KHÔNG TTL | `select ticket_id, xmin` = 43 ms; vẫn đúng khi backend khác ghi DB chung (I-1) |
| Q04 | 2026-10-08 | Object trả từ cache dùng chung, chỉ đọc (không deep copy) | Cùng hợp đồng `MemoryRepository.list()`; engine đã copy khi sửa (`_mutate`) |
| Q06 | 2026-10-08 | Agent chạy nền, lưu session DB, bỏ audit/notifications khỏi doc, phân trang ⇒ Idea Vault | Đổi contract nghiệp vụ/bảo mật/schema/UI — mỗi việc cần kế hoạch riêng (00-ARCHITECTURE §6) |
| Q07 | 2026-10-08 | Người dùng: "Làm cái 1 và 2 thôi" — hiểu là cách 1 (cache `list()`) + cách 2 (bỏ N+1 màn cư dân); BỎ cách 3 (gzip + màn BQL 1 API); không đổi UI | Agent nêu cách hiểu ngay trong phiên; người dùng xác nhận khi duyệt bản này |

| Q08 | 2026-10-08 | Thi công: `list()` dùng MỘT câu SQL (gửi cặp `(ticket_id, xmin)` đang giữ, DB chỉ trả doc dòng đổi) thay cho 2 câu trong `REPEATABLE READ` | `test_t24_sql_budget` (plan 01) chốt `GET /mo/tickets` = 1 câu SQL; 1 câu cũng bớt 1 round trip (~44 ms) và tự nhất quán |
| Q10 | 2026-10-08 | Version v1.5.0 (không phải v1.4.0) | `planning/08_2026-10-08_web-portal-shell/` (chưa merge, cùng working tree) đã nhận v1.4.0 — tránh hai đợt cùng số |
| Q11 | 2026-10-08 | T6 làm hỏng doc bằng field lạ thay vì đổi `status` | CHECK `cases_doc_matches` của DB chặn status lệch cột (IntegrityError khi thi công); field lạ = đúng sự cố 2026-10-07 |
| Q09 | 2026-10-08 | Người dùng duyệt plan ("oke làm đi"); không trả lời câu commit merge ⇒ KHÔNG commit, thi công trên working tree | AGENTS §5.D: commit cần người dùng gật |

### Quyết định bị thay thế
- Q03 phần "2 câu SQL (phiên bản rồi tải doc đổi) trong `REPEATABLE READ`" (SPEC v1/v2) → **bị thay bởi Q08** (1 câu). Ý chính của Q03 (khoá theo `xmin`, không TTL) giữ nguyên.
- Q05 (2026-10-08, SPEC v1): "thêm `description` vào `BqlTicketRow`, UI BQL bỏ gọi `/mo/tickets`" và gzip (`SPEC-P03-transport.md`, đã xoá file) → **bị thay bởi Q07**. Hệ quả: màn BQL vẫn gọi 2 API, nhưng cả hai đi qua cache nên rẻ.

### Câu hỏi còn treo (người dùng chưa trả lời)
- Commit merge `develop` trước khi thi công? Chưa có đồng ý ⇒ agent KHÔNG commit; thi công sẽ nằm chung working tree với merge chưa commit.

## §2. Work Packages
| WP | Việc | Tầng | SPEC |
|---|---|---|---|
| WP1 | Cache `list()` theo `xmin` + test T1–T6 + phép phá | 🔴 (đúng đắn dữ liệu dùng chung) | SPEC-P01, 01-CONTRACTS §1–2, §6 |
| WP2 | Bỏ N+1 `resident_list` + T7–T8 | 🟠 | SPEC-P02, 01-CONTRACTS §5 |
| WP3 | Đo sau (probe), G1–G5 local, build lại container, G3–G5 server | 🟠 | TESTING §3–4, OPERATIONS |
| WP4 | Đồng bộ não (6 điểm) + version | 🟢 | AGENTS §5.B |

## §3. Checklist thực thi
- [x] Audit + evidence trước (`evidence/audit/*-before.txt`, probe ở `evidence/audit/probes/`)
- [x] Bộ SPEC v1 → v2 theo Q07
- [x] Người dùng duyệt kế hoạch ("oke làm đi")
- [x] WP1 cache `list()` — `evidence/WP1/` (red-before, green, 4 mutation)
- [x] WP2 bỏ N+1 màn cư dân (T7 đỏ trước sửa, mutant c đỏ)
- [x] WP3 G1–G5 local, build lại container, G3–G5 server — `evidence/WP3/`, `evidence/audit/*-after.txt`
- [x] WP4 đồng bộ não (6 điểm + gotchas) + version 1.5.0 (`state.json`, `portal/package.json`, `portal/package-lock.json`)

## §4. Bảng trỏ SPEC
| File | Nội dung |
|---|---|
| `specs/00-ARCHITECTURE.md` | Số đo audit, mục tiêu, bất biến I-1..I-4, vùng cấm |
| `specs/01-CONTRACTS.md` | Chữ ký, SQL, API không đổi, bảng lỗi |
| `specs/SPEC-P01-list-cache.md` | Giải thuật cache `xmin` |
| `specs/SPEC-P02-view-prefetch.md` | Bỏ N+1 `resident_view` |
| `specs/OPERATIONS.md` | Thứ tự deploy, rollback, ràng buộc DB chung |
| `specs/TESTING-ACCEPTANCE.md` | Test T1–T8, phép phá, ngưỡng số đo, Exit Gates |

## §5. Phân công thực tế
| WP | Tầng yêu cầu | Đã dùng |
|---|---|---|
| WP1 | 🔴 | Claude Opus (phiên chính) |
| WP2 | 🟠 | Claude Opus (phiên chính — cao hơn tầng, không phóng agent con vì người dùng không yêu cầu) |
| WP3 | 🟠 | Claude Opus (phiên chính) |
| WP4 | 🟢 | Claude Opus (phiên chính) |

Thẩm định độc lập (agent khác) CHƯA chạy — xem AGENTS §5.K.3.

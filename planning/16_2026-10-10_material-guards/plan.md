# 16 — Hoàn thiện luồng vật tư cho backend, web và app

## Metadata

| Trường | Giá trị |
|---|---|
| Trạng thái | ✅ ĐÃ HOÀN THÀNH implementation local + Docker (2026-10-10 18:18:44 +07:00) — server ⬜ chưa deploy, boot hub ⬜, điện thoại thật ⬜ |
| Ngày tạo | 2026-10-10, Asia/Saigon |
| Loại / phiên bản đích | MINOR dự kiến `1.10.0`: thêm API lưu toàn bộ vật tư; siết kiểm tra các API cũ |
| Nhánh / base | `feature/chamanh`, HEAD `71315109d845fe69935050b09d4ab4c67efb024a` |
| Nền làm việc | Working tree v1.9.9 chưa commit, bao gồm plan 15 + sửa Docker/Luna. HEAD đơn lẻ KHÔNG đủ tái tạo nền |
| Yêu cầu | Sửa các điều kiện backend thiếu; web thống nhất app; test các ca đã tái hiện |
| Bằng chứng đầu vào | `evidence/baseline.txt`, được sinh bằng lệnh, không sửa tay |
| Chủ trì | Root orchestrator; người dùng duyệt contract trước thi công |
| Điều kiện đóng | Mọi gate bắt buộc local và Docker đạt; mỗi H có R cùng đuôi và evidence tồn tại. Server chỉ bắt buộc nếu được chọn để triển khai |

## Nhật ký quyết định

| ID | Thời điểm +07:00 | Quyết định / lý do |
|---|---|---|
| D01 | 2026-10-10 | Kế hoạch mới đủ SPEC, không dùng ngoại lệ PATCH của plan 15: có API mới, nhiều worker và đổi validation |
| D02 | 2026-10-10 | Đề xuất một thao tác lưu nguyên tử để xử lý lỗi cập nhật kế hoạch đã commit trước khi xuất vật tư bị từ chối; contract tại SPEC §C2 |
| D03 | 2026-10-10 | Kiểm tra bắt buộc đặt tại backend; client chỉ hỗ trợ UX. Nguồn phạm vi vật tư là catalog hiện có, không thêm danh mục hardcode |
| D04 | 2026-10-10 | Giữ kết quả plan 15: không đòi lý do hoặc chặn do khác định mức/đề xuất; không xoá dữ liệu tham khảo |
| D05 | 2026-10-10 | Thi công song song theo quyền sở hữu file; backend/API được gộp một worker để không tranh chấp contract |
| D06 | 2026-10-10 | Không sửa runtime trong đợt lập kế hoạch; không coi kết quả test 3387 của nền là bằng chứng nghiệm thu tính năng chưa viết |
| D07 | 2026-10-10 17:10 | Người dùng giao "dựa vào plan.md và hoàn thành" ⇒ coi là duyệt SPEC nguyên trạng, thi công 1.10.0. Root làm WP1–WP3/WP5 (không phóng worker riêng); WP4 do agent khác, cô lập |
| D08 | 2026-10-10 17:20 | Mở rộng phạm vi `src/main.py` (ngoài §B1): handler 422 nổ 500 với NaN/Infinity — lỗi chung mọi route, sửa một chỗ; đo bằng test API NaN/Inf |
| D09 | 2026-10-10 17:22 | `--pg` chạy trong image `p151-backend` trên mạng compose (psycopg2 host bị Windows Application Control chặn); DB `p151_test` tạo mới trong `p151-db-1` |
| D10 | 2026-10-10 17:40 | Gate Docker đo bằng container memory riêng `:8017` từ image build mới; KHÔNG recreate `p151-backend-1` `:8000` (nối Supabase chung, OPERATIONS §O3) — việc đó để người dùng quyết |
| D11 | 2026-10-10 17:33 | RED guard đo trên snapshot nền hash-khớp `baseline.txt` + probe chỉ đường cũ (nền nhận 8/8 dữ liệu sai); snapshot giữ `material_policy.py` (không được nền gọi) để test đỏ vì hành vi, không vì import |
| D12 | 2026-10-10 18:00 | R04 🔁 (F1–F6) xử lý: F1/F2 `whole_positive` bắt `OverflowError`, `record_material` kiểm số trước so sánh; F3 app đánh dấu `data-dirty` khối vật tư (refresh 30 s không xoá lựa chọn); F4 nút Lưu bỏ `data-write` khi thiếu mapping; F5 `src/main.py` vào owner §B1 (D08); F6 dòng trống cuối gotchas. Cư dân đọc được `material_codes_by_department`: chấp nhận — cùng quyền `/mo/catalog` hiện có, suy ra từ catalog công khai, không đổi auth (§A3) |

### Quyết định bị thay thế khi SPEC được duyệt và thi công

- Plan 15 §1 vùng cấm không thêm kiểm tra phòng ban/số nguyên/Kỹ thuật có vật tư → SPEC §C3; đây là yêu cầu còn thiếu, không đưa sang backlog.
- Plan 15 Q04 lưu kế hoạch rồi ghi từng dòng qua nhiều request → SPEC §C2/§C4 cho client mới.
- Web dùng đề xuất Agent và xác nhận/lưu từng dòng riêng → SPEC-P02 §U1–U3.
- Không thay thế Q01/Q02 của plan 15 về định mức và `USED_VS_ISSUED`.

## Router SPEC

| Thứ tự | Hợp đồng |
|---|---|
| 1 | [00-ARCHITECTURE.md](specs/00-ARCHITECTURE.md): phạm vi, bất biến, baseline |
| 2 | [01-CONTRACTS.md](specs/01-CONTRACTS.md): schema, endpoint, validation, transaction, lỗi |
| 3 | [SPEC-P01-backend.md](specs/SPEC-P01-backend.md): vị trí thực thi và cổng backend |
| 4 | [SPEC-P02-clients.md](specs/SPEC-P02-clients.md): web/app, một form/một request |
| 5 | [OPERATIONS.md](specs/OPERATIONS.md): snapshot, phối hợp, rollout/rollback |
| 6 | [TESTING-ACCEPTANCE.md](specs/TESTING-ACCEPTANCE.md): ca test, mutants, gate môi trường |

## Work packages và Model Tier

| WP | Tầng | Owner file | Phụ thuộc / xong khi |
|---|---|---|---|
| WP0 contract và baseline | 🔴 | SPEC + baseline evidence | Duyệt SPEC; snapshot nền dirty được xác minh |
| WP1 regression tests | 🟠 | Test mới riêng của plan 16 | Đo RED trước sửa, GREEN sau backend; không giảm test nền |
| WP2 backend/API | 🟠 | Engine, models, catalog helper, router | Theo SPEC-P01; test WP1 xanh |
| WP3 web/app | 🟠 | `src/web/`, `src/mobile/`, harness mới plan 16 | Theo SPEC-P02; dùng endpoint WP2 |
| WP4 thẩm định độc lập | 🔴 | Report/evidence riêng, không sửa runtime | Không đọc report worker; thiết kế ≥3 cách phá, root đo lại |
| WP5 docs/version/sign-off | 🟢 | Docs, não, version, checklist | Sau WP4 đạt và mọi gate bắt buộc đạt |

## Checklist

- [x] Đối chiếu code, báo cáo plan 15 và các ca review thực tế
- [x] Tạo SPEC package + handoffs + baseline evidence
- [x] Người dùng duyệt SPEC, đặc biệt validation API cũ và endpoint lưu nguyên tử
- [x] WP0 đóng băng baseline theo OPERATIONS §O1
- [x] H01/R01 tests: RED đo được trên nền lỗi
- [x] H02/R02 backend: GREEN + rollback trong memory/Postgres local
- [x] H03/R03 clients: web/app nhất quán, harness trình duyệt đạt
- [x] H04/R04 thẩm định đối kháng độc lập đạt (lần 1 🔁 F1–F6 → sửa → lần 2 ✅)
- [x] Root đo lại gate, kiểm scope và số lượng test
- [x] H05/R05 đồng bộ docs/version/não
- [ ] Local Docker + điện thoại đạt; server giữ ⬜ nếu chưa được triển khai — Docker ✅ (`:8017` memory), viewport 390px ✅; điện thoại thật ⬜; server ⬜
- [x] Mọi H có R, evidence hợp lệ; ghi thời điểm sign-off chính xác đến giây
- [ ] Đề xuất stage/commit rõ file; chỉ commit khi được cho phép, không push

## Sign-off

**✅ ĐÃ HOÀN THÀNH implementation local + Docker — 2026-10-10 18:18:44 +07:00.** Rollout CHƯA xong: server ⬜ (chưa deploy), G0 boot ⬜ (hub `../brain4agent.release` thiếu), điện thoại thật ⬜, container `:8000` chưa recreate (nối Supabase chung — người dùng quyết).

| Số đo cuối | Kết quả | Evidence |
|---|---|---|
| pytest memory | 3438 passed / 0 fail / 0 skip (nền 3387) | `evidence/wp2/full_suite.txt` |
| pytest `--pg` (image backend, `p151_test`) | 3533 passed | `evidence/wp2/pg_suite.txt` |
| ruff check/format, `git diff --check`, `node --check` 13 | exit 0 | `evidence/wp2/lint.txt` |
| RED nền (hash khớp `baseline.txt`) | 48 failed / 3 passed; probe đường cũ nền nhận 8/8 → HEAD từ chối 8/8 | `evidence/wp1/` |
| Mutants m1–m5 | đỏ 4/3/1/7/1 | `evidence/wp1/mutants.txt` |
| Playwright web 1440 + app 390 (Docker) | 42/42 | `evidence/wp3/ui_harness_docker.txt` |
| Thẩm định độc lập | R04 lần 2 ✅ (probe backend 92/92 memory + pg, API 48/48, UI 27/27) | `reports/R04_adversarial.md`, `evidence/wp4/` |

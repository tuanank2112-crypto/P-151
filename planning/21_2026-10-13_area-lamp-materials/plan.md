# 21 — Nhật ký 2026-10-13: vật tư và tài sản đèn gắn theo khu vực

## Metadata

| Trường | Giá trị |
|---|---|
| Trạng thái | ✅ ĐÃ CÀI LOCAL + ĐÃ COMMIT `e9a96a2` (chưa push, chưa bump version) |
| Ngày làm | 2026-10-13, Asia/Saigon (nhật ký viết 2026-10-14) |
| Loại | Hồ sơ ghi lại (retroactive); MINOR chưa đóng, version vẫn `1.13.0` |
| Nhánh / base | `feature/chamanh`, base `c003f20` |
| Yêu cầu | Người dùng: mỗi loại vật tư gắn với khu vực để tra kho theo vị trí; một vật tư dùng được nhiều khu vực, mỗi khu vực chỉ một loại; đèn ở mọi vị trí; Ban tiếp nhận không có chuyên môn điện nên không bị bắt chọn tài sản |

## Nhật ký quyết định

| ID | Quyết định / lý do |
|---|---|
| D01 | `catalog.area_materials`: nhãn khu vực (13 nhãn `rules.AREA_PATTERNS`) → MỘT mã đèn. Validator chặn nhãn lạ và mã ngoài `playbook_materials[PB-TEC-01]`. Bước 7 tra kho theo khu vực khi ticket không có kế hoạch riêng và Agent không chọn; khu vực chưa gắn dùng `default_materials` |
| D02 | Vật tư mới `SIM-MAT-LAMP-03…07`. LAMP-02 (tồn 0) KHÔNG gắn khu vực nào: gắn vào thì ticket đèn bị giữ chờ vật tư, làm hỏng test nghiệp vụ |
| D03 | Tài sản đèn đủ 13 khu vực (thêm 8). Lý do: Ban tiếp nhận không có chuyên môn điện, không bắt chọn tài sản. Hệ quả: `SIM-TKT-TEC-002` (hầm xe) đổi từ `ASSET_UNCLEAR` sang `ROUTED/MATCHED` ở `seed/maintenance_v1` và `seed/maintenance_cr03` (bộ đích của Trường: PHẢI báo Trường) |
| D04 | Test cần trạng thái "chờ BPTN chọn tài sản" dùng `helpers.asset_unclear_ticket` / `without_asset` (ẩn tạm tài sản một khu vực trong test). Đường `ASSET_UNCLEAR` + `bptn_resolve` vẫn được kiểm |
| D05 | `GET /catalog` thêm `material_by_area` |

### Quyết định bị thay thế / đã hủy

- **Hướng mở phạm vi điện + thang máy (đề xuất trong ngày, đã cài rồi REVERT theo yêu cầu "chỉ làm mình đèn"):** `TechnicalKind`, luật nhận ổ cắm/thang máy, `agent-prompt/10`, nhóm vật tư `ELEC-*`/`LIFT-*`. Không còn trong code. Thang máy, điện, nước vẫn ngoài phạm vi. Ghi chú ở `planning/18_…/plan.md` D07 (thư mục chưa theo dõi bởi git).
- **Phương án giữ Hầm xe không có tài sản (làm ca mẫu DEMO-4):** đã thay bởi D03.

## Danh sách thay đổi (commit `e9a96a2`)

| Nhóm | File |
|---|---|
| Dữ liệu | `seed/maintenance_v1/catalog.yaml` (vật tư LAMP-03…07, `area_materials`, 8 tài sản đèn), `seed/maintenance_v1/tickets.yaml` và `seed/maintenance_cr03/tickets.yaml` (TEC-002) |
| Lõi | `src/maintenance/catalog.py` (`area_materials`, `material_for_area`, validator), `src/maintenance/engine.py` (`_area_material`, bước 7) |
| API | `src/api/routers/maintenance.py` (`material_by_area`) |
| Test | `test_area_materials.py` (mới), `helpers.py`, `test_acceptance`, `test_api`, `test_area_assets`, `test_auth`, `test_emergency`, `test_engine`, `test_material_guards` |
| Tài liệu | `brain4agent/changelog.md` (mục Unreleased), `planning/20_2026-10-13_stock-restock-alert/` (SPEC chờ duyệt) |

## Bảng khu vực → vật tư đèn

| Khu vực | Vật tư | Tồn (min) |
|---|---|---|
| Hành lang, Sảnh thang máy, Cầu thang bộ, Lối đi | `LAMP-01` Bóng đèn LED | 4 (5) |
| Thang máy, Phòng rác | `LAMP-03` Đèn LED ốp trần | 12 (5) |
| Sảnh chính, Sảnh cư dân | `LAMP-04` Đèn downlight sảnh | 10 (4) |
| Lối thoát hiểm | `LAMP-05` Đèn exit | 8 (3) |
| Sân chơi, Sân thượng | `LAMP-06` Đèn pha LED ngoài trời | 6 (2) |
| Hầm xe, Bãi đỗ xe | `LAMP-07` Bóng tuýp LED | 20 (6) |

## Đã đo

- `LLM_MODE=mock`: `pytest` 3881 passed, 100 deselected; `ruff check` và `ruff format --check` sạch.
- Phép phá: tắt nhánh vật tư theo khu vực trong engine ⇒ `test_area_materials.py` ĐỎ; khôi phục ⇒ xanh.
- Thêm 8 tài sản lần đầu làm 27 test đỏ (oracle và test dựa vào ca hầm xe); sau khi sửa fixture + helper ⇒ 0 đỏ.

## Chưa làm / còn mở

- [ ] `--pg` (Postgres trong docker): chưa chạy
- [ ] Giao diện (`portal/`, `src/web/`, `src/mobile/`): chưa hiện khu vực dùng của vật tư
- [ ] Đổi tên trung tính cho `LAMP-03` ("ốp trần thang máy") và `LAMP-07` ("hầm xe") vì đang dùng cho nhiều khu vực
- [ ] Báo Trường về thay đổi `seed/maintenance_cr03/tickets.yaml` (TEC-002)
- [ ] Đồng bộ não đầy đủ (`index.md`, `roadmap.md`, `memory-distill.txt`, `docs/maintenance.md`, `project-intro.md`, `-data-architecture.md`) và bump `1.14.0`
- [ ] Đo `agent-prompt` với LLM thật: không cần cho đợt này (prompt không đổi)
- [ ] Hồ sơ 20 (cảnh báo nhập lại vật tư cho Kỹ thuật): SPEC chờ duyệt, chưa thi công
- [ ] Hồ sơ 18 (nhóm kỹ thuật): giữ thiết kế cũ, chờ duyệt

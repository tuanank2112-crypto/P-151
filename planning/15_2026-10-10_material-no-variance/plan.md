# 15 — Vật tư: bỏ đối chiếu với định mức và đề xuất Agent (2026-10-10)

| Trường | Giá trị |
|---|---|
| Trạng thái | 🟡 local ✅ (G1–G3) — 2026-10-10 16:10:00 +0700; G4 UI harness ⬜ (máy không có Playwright), server ⬜; chưa commit |
| Loại | PATCH (nới một luật đối soát, API tương thích ngược, ≤1 ngày công) → v1.9.9; ngoại lệ AGENTS.md §3.2.5: chỉ `plan.md` |
| Yêu cầu | Người dùng, 2026-10-10: "bỏ đối chiếu số lượng vật tư thực tế với định mức hoặc đề xuất của Agent trong luồng xử lý ticket … định mức 1 bóng, kỹ thuật viên chọn 4 bóng, kho đủ ⇒ bấm Lưu vật tư một lần phải lưu thành công" — xác nhận nghiệp vụ, cho phép đổi quy tắc đối soát đã duyệt |
| Nhánh | `feature/chamanh` (trên `7131510` + v1.9.8 chưa commit) |
| Phạm vi | `src/maintenance/engine.py` (`confirm_materials`, `_compare_materials`), `src/api/routers/maintenance.py` (`MaterialPlanRequest.note`), `src/web/app.js` + `index.html` (`?v=4.3`), `src/mobile/js/dept.js` + cache bust `?v=16`/`SHELL_CACHE` v16, 2 `tickets.yaml` (oracle CLN-001), `tests/test_maintenance/test_engine.py` + `test_api.py`, docs + não |
| CẤM chạm | `record_material`/`_issue_stock`/`take_stock` (cơ chế trừ kho theo phần chênh giữ nguyên), bước 7 Agent, schema DB/Alembic, model `ReadinessEvaluation` (giữ field `variance_explained`), `portal/` (trừ `version`) |

## §1. Nhật ký quyết định
| # | Mốc | Quyết định | Lý do · chỗ lật |
|---|---|---|---|
| Q01 | 2026-10-10 15:55 | Đối soát bước 10: `PLANNED_VS_NORM` và `ISSUED_VS_PLANNED` vẫn tính (dữ liệu tham khảo trong `comparison_results`) nhưng KHÔNG chặn, KHÔNG sinh warning, KHÔNG cần `variance_reason`. `_compare_materials` chỉ xét `USED_VS_ISSUED` | Người dùng: định mức/đề xuất Agent chỉ là tham khảo nội bộ. Lật: bỏ điều kiện `comparison_type == USED_VS_ISSUED` |
| Q02 | 2026-10-10 15:55 | GIỮ: `used_qty ≠ issued_qty` không lý do ⇒ chặn hoàn thành (`variance_explained=false`); có lý do ⇒ warning không chặn | Không phải định mức/Agent mà là hàng đã xuất kho chưa dùng (lệch tồn). Web và app luôn gửi đã xuất = đã dùng nên người dùng không gặp; chỉ API trực tiếp hoặc dữ liệu cũ |
| Q03 | 2026-10-10 15:55 | `material-plan` `note` KHÔNG bắt buộc (API `str \| None`, engine mặc định audit "Phòng ban chọn vật tư tại hiện trường") | Bắt ghi lý do khi khác đề xuất Agent = điều người dùng bỏ |
| Q04 | 2026-10-10 15:55 | App: bỏ ô Lý do `#dept-material-reason`, bỏ toast "Khác định mức", bỏ dòng điều kiện "Chênh lệch vật tư có lý do"; một lần bấm = `material-plan` (nếu lựa chọn đổi) + mỗi dòng `materials/{code}` đã xuất = đã dùng | "bấm Lưu vật tư một lần phải lưu thành công". "Ghi chú xử lý" (`#dept-note`) giữ |
| Q05 | 2026-10-10 15:55 | Web: dòng vật tư một ô "Số lượng đã dùng" (đã xuất = đã dùng như app), bỏ ô lý do + nút điền nhanh + chữ "định mức"; ghi chú `material-plan` không bắt buộc; Gate 4 BQL = "Xuất – dùng" | Nhất quán web/app/API. Lật: trả cặp ô Đã xuất/Đã dùng |
| Q06 | 2026-10-10 15:55 | Oracle ticket mẫu CLN-001 (cả `maintenance_v1` và `maintenance_cr03`): túi rác 3 > định mức 2, không lý do ⇒ `READY_FOR_REVIEW`, `warnings: []` | Ca mẫu cũ chứng minh luật bị bỏ; giữ mục đích "khác định mức vẫn hoàn thành" |

### Quyết định bị thay thế
- CR-BPTN-03 §9.4 (5) "đối soát vật tư xong" hiểu là ba phép so VAL-MAT-CMP-001 đều khớp hoặc có giải trình (→ Q01/Q02): chỉ còn đã dùng = đã xuất.
- `docs/maintenance.md` §5 "`confirm_materials` … `note` bắt buộc / note rỗng ⇒ 409" (→ Q03).
- Plan 11 Q41 "lý do bắt buộc khi khác đề xuất Agent hoặc khác định mức" và Q42 "lý do chỉ bắt buộc khi khác định mức … toast 'Khác định mức … bấm Lưu vật tư lần nữa'", cùng ghi chú Q42 "bỏ ở engine = đổi contract CR-03 ⇒ chờ người duyệt" (→ Q01–Q04; người dùng duyệt 2026-10-10).
- Ticket mẫu CLN-001 "chênh lệch vật tư có lý do → READY kèm warning" (→ Q06).
- Test `test_step10_material_variance_needs_a_reason_but_only_warns` (→ `test_step10_off_norm_and_off_plan_quantity_needs_no_reason` + `test_step10_used_less_than_issued_still_needs_a_reason`).

### Vùng cấm
- KHÔNG xoá `norm_qty`/`planned_qty`/`comparison_results`/`variance_reason`/`variance_explained` khỏi model/API: dữ liệu tham khảo + client cũ; xoá = đổi contract không ai yêu cầu.
- KHÔNG bỏ chặn `used_qty > issued_qty` và `Kho chỉ còn …` (trừ kho vượt tồn).
- KHÔNG thêm ở backend luật "Kỹ thuật ≥1 vật tư" / "vật tư thuộc phòng ban" / "số nguyên" trong đợt này: hiện chỉ app kiểm (xem §4 giới hạn); thêm = đổi contract (test `test_confirm_no_materials_sets_mode_na` cho Kỹ thuật `lines: []`), cần người duyệt.

## §2. Work packages
| WP | Việc | Tầng |
|---|---|---|
| WP1 | Engine `_compare_materials` + `confirm_materials` note + API | 🟠 |
| WP2 | App `dept.js` + web `app.js` + cache bust | 🟠 |
| WP3 | Test hồi quy + oracle seed + phép phá | 🟠 |
| WP4 | Docs/não/version | 🟢 |

## §3. Checklist
- [x] Rà luồng: bước 7 → `material-plan` → `materials/{code}` (`_issue_stock` phần chênh) → `report_complete` `_reconcile`/`_compare_materials`; web `materialPlanCard`/`workSections`/precheck; app `materialsBlock`/precheck
- [x] WP1 engine + API
- [x] WP2 app + web (`node --check` 11 file app, `new Function` web: 0 lỗi cú pháp)
- [x] WP3 test mới: định mức 1 dùng 4 (một lần lưu, không note/lý do, trừ 4, lưu lặp không trừ thêm, sửa 4→2→4 chỉ chênh, hoàn thành `all_pass` không warning) · vượt tồn bị chặn và rollback · đã dùng < đã xuất vẫn cần lý do · API không note
- [x] G1 pytest cả bộ exit 0 · G2 ruff check/format exit 0 (`evidence/pytest.txt`)
- [x] G3 phép phá: bỏ điều kiện `comparison_type == USED_VS_ISSUED` (khôi phục luật cũ) ⇒ cả bộ 12 failed / 3375 passed, exit 1, ruff format báo đúng dòng mutant (`evidence/mutation.txt` — output máy của lượt chạy trên mutant); khôi phục code rồi chạy lại `evidence/pytest.txt` 3387 passed
- [ ] G4 UI harness Playwright (`planning/11_…/evidence/harness/q41|q42` còn kiểm luật cũ ô `#dept-material-reason` — cần sửa harness khi có Playwright)
- [ ] Commit (chờ người dùng gật) · dựng lại Docker `:8000` + thử tay trên app

## §4. Exit Gates
| Gate | Môi trường | Trạng thái |
|---|---|---|
| G1 pytest `--ignore=integration` exit 0, số test không giảm (3383 → 3387) | local | ✅ |
| G2 ruff check + format exit 0 | local | ✅ |
| G3 phép phá đỏ | local | ✅ |
| G4 UI app/web: lưu 4 bóng một lần bấm, không toast "Khác định mức" | local Docker | ⬜ |
| G5 cùng G4 trên server | server | ⬜ |

Giới hạn còn lại: backend chỉ kiểm vật tư có trong catalog + không trùng + `> 0`; "thuộc phạm vi phòng ban", "số nguyên", "Kỹ thuật ≥1 vật tư" chỉ app điện thoại kiểm (web cho chọn mọi vật tư). Catalog không có cờ "đang được phép sử dụng".

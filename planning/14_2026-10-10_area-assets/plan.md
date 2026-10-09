# 14 — Tài sản đèn theo khu vực, không theo tòa-tầng (2026-10-10)

| Trường | Giá trị |
|---|---|
| Trạng thái | 🟡 local ✅ (G1–G4), server ⬜, G5 (LLM thật) ⬜, G6 (`--pg`) ⬜ — 2026-10-10; chưa commit |
| Loại | MINOR (đổi contract catalog + engine bước 6 + Agent prompt, tương thích ngược ticket cũ) → v1.9.0 |
| Yêu cầu | Người dùng, 2026-10-10 (ảnh form "Xác định tài sản" BPTN): "Mỗi loại vật tư đại diện cho khu vực: Sảnh - hành lang - Phòng rác (không phải chi tiết từng tòa-tầng như vậy ⇒ dư thừa)"; "đèn hành lang tầng 1 cũng giống tầng 6"; "có cả cầu thang bộ" |
| Nhánh | `feature/chamanh` (sau `bf5196a`, trên v1.8.4 chưa commit) |
| Phạm vi | `seed/maintenance_v1/catalog.yaml`, 2 file `tickets.yaml` (TEC-002/006 + mã expected), `src/maintenance/{models,catalog,rules,engine}.py`, `src/maintenance/agent/{inputs,baseline,validate,prompt}.py`, `src/api/routers/maintenance.py`, REF prompt plan 06, `src/mobile/` (bptn.js + `?v=7`), `src/web/` (app.js + `?v=4.2`), tests, docs, não |
| CẤM chạm | luật trích vị trí/ưu tiên/trùng, DB schema, `portal/` (trừ `version`) |

## §1. Nhật ký quyết định
| # | Mốc | Quyết định | Lý do · chỗ lật |
|---|---|---|---|
| Q01 | 2026-10-10 | Mỗi khu vực MỘT tài sản đèn; tra theo khu vực của vị trí (00 §1, 01 §3) | Người dùng: chia tòa-tầng là dư thừa; 6 tài sản cũ là dữ liệu mô phỏng + ca test AMBIGUOUS, không phải nghiệp vụ |
| Q02 | 2026-10-10 | 4 khu vực: Hành lang · Sảnh thang máy · Cầu thang bộ · Phòng rác | Người dùng chốt "có cả cầu thang bộ"; khớp `AREAS` form cư dân. Lật: thêm dòng YAML |
| Q03 | 2026-10-10 | Giữ 6 mã cũ dạng `RETIRED_SIMULATED` (không chọn, không đề xuất, không trả UI) | Ticket cũ trong Supabase chung còn trỏ mã cũ. Lật: xoá 6 dòng |
| Q04 | 2026-10-10 | Sửa lời 2 ticket mẫu (TEC-002 → hầm, TEC-006 → cầu thang bộ) thay vì đổi `expected` | Giữ nguyên MỤC ĐÍCH từng kịch bản (DEMO-4 ASSET_UNCLEAR; tồn kho không rõ) — 01 §4 |
| Q05 | 2026-10-10 | `test_p1_neighbors::test_e08` kiểm liên kết cạnh khẩn cấp bằng một phản ánh rác mới ở hầm B1 (thay TEC-006) | TEC-006 rời hầm; hành vi cần giữ là "vẫn ROUTED + liên kết hai chiều" |
| Q06 | 2026-10-10 | Đổi chữ prompt ⇒ `agent-prompt/2` + sửa cùng chữ ở REF plan 06 | REF là nguồn chép nguyên văn (`test_p_01`); luật SPEC-P01 §4.4 đòi tăng version |

### Quyết định bị thay thế
- Catalog v1.1 "6 asset LIGHTING theo `location_normalized`, 2 asset cùng vị trí cho test AMBIGUOUS" (→ Q01–Q03).
- `engine._step_6_lookup_asset` so khớp TRỌN chuỗi vị trí (→ 01 §3: so khu vực).
- Prompt `agent-prompt/1` luật 8 "asset có vị trí TRÙNG vị trí sự cố" (plan 06 SPEC-P01, → Q06).
- Ticket mẫu TEC-002 "Đèn cầu thang bộ tầng 9", TEC-006 "chiếu sáng hầm B1" (→ Q04).

## §2. Work packages
| WP | Việc | Tầng |
|---|---|---|
| WP1 | Contract catalog/model/validator + `location_area` | 🔴 |
| WP2 | Engine bước 6 + guard + ứng viên Agent + API | 🟠 |
| WP3 | Agent baseline/validate/prompt + REF | 🟠 |
| WP4 | Ticket mẫu + sửa test cũ + test mới + phép phá | 🟠 |
| WP5 | Dropdown app/web + cache bust + picker harness | 🟢 |
| WP6 | Docs/não/version | 🟢 |

## §3. Checklist
- [x] Rà phạm vi: tài sản không nằm trong DB; 4 chỗ đọc `catalog.assets`, Agent 3 file, 2 UI, 10 file test
- [x] WP1–WP3 sửa code; catalog load + `location_area` smoke
- [x] WP4: 12/12 ticket mẫu + 4/4 demo; test cũ sửa theo Q04/Q05; `test_area_assets.py` (17 ca) + `test_catalog_feeds_the_ui`
- [x] pytest cả bộ exit 0 · ruff check/format exit 0 (`evidence/pytest.txt`)
- [x] Phép phá m1–m4 RED, khôi phục từng byte (`evidence/mutation.txt`)
- [x] REF plan 06 `--selftest` 0 lỗi (`evidence/ref-selftest.txt`)
- [x] WP5: picker.mjs app + web ALL PASS (`evidence/picker.txt`, 2 ảnh)
- [x] WP6: `docs/mobile.md`, `docs/web.md`, não, version 1.9.0
- [ ] Commit (chờ người dùng gật) · dựng lại backend `:8000` + G4 server · G5 eval LLM thật · G6 `--pg`

## §4. Bảng SPEC
| File | Nội dung |
|---|---|
| [specs/00-ARCHITECTURE.md](specs/00-ARCHITECTURE.md) | Mục tiêu, non-goals, bất biến I-1…I-5, vùng cấm, ảnh hưởng hành vi |
| [specs/01-CONTRACTS.md](specs/01-CONTRACTS.md) | YAML, model, hàm, API, ticket mẫu, bảng lỗi |
| [specs/OPERATIONS.md](specs/OPERATIONS.md) | Thứ tự deploy, ticket đang mở, rollback, lệnh đo local |
| [specs/TESTING-ACCEPTANCE.md](specs/TESTING-ACCEPTANCE.md) | Ma trận T1–T10, bằng chứng, Exit Gates G1–G6 |

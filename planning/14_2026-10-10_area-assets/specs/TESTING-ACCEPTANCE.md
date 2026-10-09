# TESTING-ACCEPTANCE (plan 14)

## §1. Ma trận test
| Mã | Kiểm | Test |
|---|---|---|
| T1 | 4 tài sản active đúng khu vực; 6 mã cũ RETIRED | `test_area_assets.py::test_catalog_has_exactly_the_four_area_assets_active` |
| T2 | `location_area` đọc phần cuối, None khi thiếu | `::test_location_area_reads_the_last_part` (7 ca) |
| T3 | Cùng khu vực, khác tòa/tầng ⇒ cùng tài sản, ROUTED | `::test_same_area_on_any_floor_or_building_matches_the_same_asset` (5 ca, gồm 2 ca trước AMBIGUOUS/NOT_FOUND) |
| T4 | Khu vực không tài sản ⇒ ASSET_UNCLEAR | `::test_an_area_without_an_asset_waits_for_bptn` (Hầm xe, Sảnh chính) |
| T5 | BPTN chọn mã RETIRED ⇒ GuardError; mã khu vực ⇒ LOCKED_BY_BPTN | `::test_bptn_may_pick_only_an_active_area_asset`, `test_acceptance::test_14` |
| T6 | Catalog từ chối 2 active cùng khu vực / khu vực lạ; RETIRED trùng được | `::test_catalog_refuses_two_active_assets_in_one_area_or_an_unknown_area` |
| T7 | `/mo/catalog` trả đúng 4 `(name, area)` | `test_api::test_catalog_feeds_the_ui` |
| T8 | Agent: ứng viên theo khu vực; chọn khác khu vực / 2 ứng viên ⇒ rejected; prompt v2 | `test_agent_unit::test_a_10*`, `test_agent_prompt::test_p_01/08/09` |
| T9 | 12 ticket mẫu 12/12, 4 luồng demo | `test_fixtures`, `test_p1_neighbors::test_e08` |
| T10 | Dropdown BPTN trên app + web đúng 4 tên | `evidence/harness/picker.mjs` (Playwright, `:8001` memory) |

## §2. Bằng chứng (output máy, CẤM sửa tay)
| File | Nội dung |
|---|---|
| `evidence/pytest.txt` | pytest cả bộ + ruff check + ruff format, kèm exit code |
| `evidence/mutation.txt` | 4 phép phá m1–m4 (khớp đủ vị trí / guard nhận RETIRED / API trả RETIRED / bỏ kiểm trùng khu vực) — mỗi cái phải RED |
| `evidence/ref-selftest.txt` | REF plan 06 `--selftest` sau khi đổi chữ prompt: `SELFTEST_FAILURES=0` |
| `evidence/picker.txt` + `phone-asset-picker.png`, `web-asset-picker.png` | T10 |

## §3. Exit Gates
| Gate | Điều kiện | Local | Server |
|---|---|---|---|
| G1 | pytest exit 0, 0 fail, số test ≥ trước (3365) | ✅ | ⬜ |
| G2 | ruff check + format exit 0 | ✅ | — |
| G3 | m1–m4 RED, file khôi phục từng byte | ✅ | — |
| G4 | picker.mjs ALL PASS (app + web) | ✅ | ⬜ (`:8000` sau khi dựng lại image) |
| G5 | Agent thật (LLM) chọn đúng tài sản khu vực — eval `REF --live` | ⬜ (cần `OPENAI_API_KEY`) | ⬜ |
| G6 | `pytest --pg` (Postgres) exit 0 | ⬜ (cần DB local) | ⬜ |

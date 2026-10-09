# 10 — Chia trang danh sách: 20 ticket một lần (2026-10-08)

| Trường | Giá trị |
|---|---|
| Trạng thái | ✅ ĐÃ HOÀN THÀNH (2026-10-08 18:37:30 +0700) — gate local + server ✅; CHƯA commit (chờ người dùng) |
| Loại | MINOR (tính năng giao diện, KHÔNG đổi API/backend) — đủ bộ SPEC → v1.6.0 |
| Yêu cầu | Người dùng, 2026-10-08: "Đã phân trang chưa" → "tôi chỉ muốn khoảng 20 ticket 1 lần thôi" |
| Nhánh | `feature/chamanh` (merge `develop` + plan 09 CHƯA commit lúc mở hồ sơ) |
| Phạm vi | CHỈ `src/web/app.js` (+ tối đa 1 class `.pager` trong `src/web/theme.css`), hồ sơ này, đồng bộ não + version |
| CẤM chạm | `src/api/`, `src/maintenance/`, `tests/` Python, `portal/` (trừ trường `version`), `.env` |

## §1. Nhật ký quyết định
| # | Mốc | Quyết định | Lý do |
|---|---|---|---|
| Q01 | 2026-10-08 | Chia trang ở GIAO DIỆN, không ở server | Ô đếm, lọc seed/BPTN/khẩn cấp, sắp xếp BQL đều tính ở trình duyệt trên toàn bộ danh sách; API đã nhanh sau plan 09 (00-ARCHITECTURE §6) |
| Q02 | 2026-10-08 | 20 dòng cố định, nút "‹ Trước · Trang x / y · Sau ›" | Người dùng nói "khoảng 20 ticket 1 lần"; không thêm lựa chọn ai chưa xin |
| Q03 | 2026-10-08 | Ô đếm/pill vẫn đếm toàn bộ; trang tự nhảy tới ticket đang chọn | Giữ nghĩa số liệu cũ; sau thao tác không "lạc" ticket |
| Q04 | 2026-10-08 | Agent tự chọn Q01–Q03 (AGENTS L.2), người dùng đổi được khi duyệt | Quyết định kỹ thuật, có phương án đơn giản rõ ràng |
| Q06 | 2026-10-08 | Người dùng duyệt ("oke, duyệt"); thêm kịch bản P3b (lật về trang 1 rồi thao tác ⇒ quay lại trang của ticket đang chọn); mỗi lần chạy harness dùng server memory MỚI | Mutant b (bỏ theo ticket đang chọn) sống sót qua P3 vì trang đã nhớ sẵn = 2; dữ liệu lần chạy trước làm hỏng lần sau |
| Q07 | 2026-10-08 | Reset trang ở `signOut()` và khi đổi lọc BQL là mutant TƯƠNG ĐƯƠNG — giữ làm phòng hờ; phép phá thứ 3 đổi thành "bấm chuyển trang gọi `render()`" | Mọi màn tự chọn ticket đầu khi chưa chọn, danh sách theo ticket đang chọn ⇒ luôn về trang 1 dù không reset (đo: `state.pages` còn `{resident:2}` sau đăng xuất mà vẫn hiện "Trang 1 / 2") |
| Q08 | 2026-10-08 | Version v1.6.0 | MINOR kế tiếp sau plan 09 (v1.5.0) |
| Q05 | 2026-10-08 | Ghi nhận: lượt trước agent hiểu "làm cái 1 và 2" là cách sửa 1+2 (plan 09); câu hỏi "đã phân trang chưa" cho thấy người dùng có thể đã muốn câu hỏi 2 (phân trang) | Ghi để không lặp hiểu lầm; AI chạy nền + giữ đăng nhập (câu 1) VẪN chưa làm, chờ người dùng nói |

### Quyết định bị thay thế
- plan 09 `00-ARCHITECTURE.md` §6 "Phân trang danh sách ⇒ Idea Vault" → **bị thay bởi plan này** (phân trang ở giao diện). Chia trang ở server vẫn ở Idea Vault.

## §2. Work Packages
| WP | Việc | Tầng | SPEC |
|---|---|---|---|
| WP1 | `listCard` + pager + 3 hàm thuần + 4 nơi gọi + reset | 🟠 | SPEC-P01, 01-CONTRACTS |
| WP2 | Harness Playwright P1–P8 + phép phá + ảnh chụp | 🟠 | TESTING |
| WP3 | Build lại container, G3–G4 server | 🟢 | OPERATIONS |
| WP4 | Đồng bộ não + version 1.6.0 | 🟢 | AGENTS §5.B |

## §3. Checklist thực thi
- [x] Bộ SPEC (00, 01, P01, OPERATIONS, TESTING)
- [x] Người dùng duyệt kế hoạch ("oke, duyệt")
- [x] WP1 pager trong `app.js` (+1 luật `.pager .btn:disabled` trong `theme.css`)
- [x] WP2 harness `evidence/harness/` (P1–P8 + P3b), 3/3 phép phá đỏ, ảnh `evidence/screens/`
- [x] WP3 container + gate server (`evidence/g4-server.txt`, chỉ đọc, 0 request ghi)
- [x] WP4 đồng bộ não + version 1.6.0

## §4. Bảng trỏ SPEC
| File | Nội dung |
|---|---|
| `specs/00-ARCHITECTURE.md` | Bối cảnh, mục tiêu, bất biến I-1..I-5, vùng cấm |
| `specs/01-CONTRACTS.md` | `PAGE_SIZE`, `state.pages`, chữ ký `listCard`, hàm thuần, DOM pager, lỗi |
| `specs/SPEC-P01-pager.md` | Giải thuật, 4 nơi gọi, reset trang, giao diện |
| `specs/OPERATIONS.md` | Thứ tự kiểm, rollback, xung đột plan 08 |
| `specs/TESTING-ACCEPTANCE.md` | Kịch bản P1–P8, phép phá, Exit Gates |

## §5. Phân công thực tế
| WP | Tầng yêu cầu | Đã dùng |
|---|---|---|
| WP1 | 🟠 | Claude Opus (phiên chính, cao hơn tầng — người dùng không yêu cầu agent con) |
| WP2 | 🟠 | Claude Opus (phiên chính) |
| WP3 | 🟢 | Claude Opus (phiên chính) |
| WP4 | 🟢 | Claude Opus (phiên chính) |

Thẩm định độc lập (agent khác) CHƯA chạy.

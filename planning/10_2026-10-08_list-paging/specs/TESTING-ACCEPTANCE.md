# TESTING & ACCEPTANCE (plan 10)

## §1. Công cụ
- `node --check src/web/app.js`.
- Kiểm trình duyệt: Playwright có sẵn ở `portal/node_modules` (như plan 08), script `planning/10_…/evidence/harness/paging.mjs`
  chạy với backend local `:8001` (memory, mock), viewport 1440 và 390.
- `pytest tests -q`: số pass không giảm (3344 sau plan 09).

## §2. Kịch bản (harness `paging.mjs`)
| ID | Kịch bản | Kỳ vọng |
|---|---|---|
| P1 | Cư dân có 25 phản ánh | trang 1: 20 `li` trong `[data-list=resident]`; nhãn "Trang 1 / 2"; pill "25 phản ánh"; nút Trước `disabled` |
| P2 | Bấm Sau | 5 `li`; "Trang 2 / 2"; Sau `disabled`; KHÔNG có request `/api/` nào phát sinh khi bấm |
| P3 | Ở trang 2, chọn ticket thứ 22 (mở chi tiết → `render()`) | vẫn trang 2, ticket đó được đánh dấu chọn |
| P3b | Ở trang 2 chọn ticket, lật về trang 1, gửi bổ sung (thao tác ⇒ `render()`) | danh sách quay về trang 2, ticket đó vẫn được chọn (plan.md Q06) |
| P4 | Cư dân có ≤ 20 phản ánh (tài khoản `cudan02`) | không có `nav.pager` |
| P5 | BPTN/BQL thấy > 20 dòng | pager có ở `bql`; ô "Tổng hồ sơ" = tổng, không phải 20 |
| P6 | BQL ở trang 2 rồi đổi bộ lọc | về trang 1 |
| P7 | 390px | `document.documentElement.scrollWidth <= clientWidth`; 0 `pageerror` |
| P8 | Đăng xuất rồi đăng nhập lại | trang 1 |

**Phép phá bắt buộc:** (a) bỏ `slice` (gắn hết items) ⇒ P1 đỏ; (b) bỏ bước 3 SPEC-P01 §1 (theo ticket đang chọn) ⇒ P3b đỏ;
(c) bấm chuyển trang gọi `render()` ⇒ P2 đỏ. Output vào `evidence/mutation-*.txt`.
*Thay thế (plan.md Q07):* "bỏ reset trong `update()` BQL ⇒ P6 đỏ" và "bỏ reset ở `signOut()` ⇒ P8 đỏ" là mutant tương đương (tự chọn ticket đầu + theo ticket đang chọn ⇒ luôn về trang 1) — không thể đỏ, đã đo.

## §3. Exit Gates
| Gate | local (`:8001`) | server (container `:8000`, chỉ đọc) |
|---|---|---|
| G1 `node --check` + pytest ≥ 3344 pass — exit 0; 3344 passed (`evidence/g1.txt`) | ✅ | — |
| G2 P1–P8 + P3b xanh (`evidence/p1-p8.txt`), 3/3 phép phá đỏ (`evidence/mutation-*.txt`) | ✅ | — |
| G3 Ảnh chụp 1440/390 mỗi màn có pager (`evidence/screens/`, `evidence/screens-server/`) | ✅ | ✅ |
| G4 4 vai × 1440/390: ≤ 20 dòng, pager chỉ khi > 20, chuyển trang được, 0 tràn ngang, 0 request ghi (`evidence/g4-server.txt`) | ✅ | ✅ |

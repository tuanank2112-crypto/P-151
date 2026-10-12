# TESTING & ACCEPTANCE

## 1. Ma trận test
| Bộ | Lệnh (trong `portal/`) | Phủ |
|---|---|---|
| Unit | `npm test` | `agent.ts` (khớp/hoà/không khớp/khẩn cấp/vị trí theo mô tả, công thức tin cậy), `sla.ts`, `format.ts`, `permissions.ts` (đúng 10×5 của thiết kế), `photos.ts` (magic bytes), `auth` hash/verify |
| DB / workflow | `npm run test:db` (cần `TEST_DATABASE_URL` `*_test`) | Mọi action §4 của 01-CONTRACTS: đường đúng + từng tiền điều kiện sai ⇒ đúng `ErrorCode`; cư dân đọc ticket người khác ⇒ NOT_FOUND; phòng ban khác ⇒ FORBIDDEN/NOT_FOUND; UPDATE đồng thời ⇒ CONFLICT; mỗi đổi stage ghi đúng 1 dòng history; seed chạy 2 lần không nhân đôi |
| Tĩnh | `npm run typecheck`, `npm run lint` | TS strict, ESLint Next |
| Build | `npm run build` | cacheComponents không báo lỗi prerender |
| So thiết kế | `npm run screenshots` (Playwright, dev server + DB đã seed) | Chụp mọi tab của 6 màn ở 1440px và 390px vào `planning/06_…/evidence/screens/`, đối chiếu thủ công với file `.dc.html` theo §2 dưới |

## 2. Bằng chứng nghiệm thu so thiết kế (mỗi màn một dòng trong `reports/`)
Với từng file `.dc.html`: liệt kê mọi phần tử trong `<x-dc>` → đánh dấu có/không/lệch (lệch phải nằm trong D1–D9).

## 3. Exit Gates
| Gate | local | server |
|---|---|---|
| G1 typecheck + lint 0 lỗi | ⬜ | ⬜ |
| G2 unit xanh, 0 skip | ⬜ | ⬜ |
| G3 test:db xanh trên Postgres thật, 0 skip | ⬜ | ⬜ |
| G4 build production thành công | ⬜ | ⬜ |
| G5 6 màn đối chiếu thiết kế, ảnh chụp ở evidence | ⬜ | — |
| G6 luồng end-to-end: cư dân gửi → tiếp nhận chuyển → phòng ban giao + xong → cư dân nghiệm thu + đánh giá <3 sao → BQL thấy ở Cần chú ý | ⬜ | ⬜ |
Kế hoạch chỉ đóng khi cột server ✅ (đợt này chỉ đóng phần local).

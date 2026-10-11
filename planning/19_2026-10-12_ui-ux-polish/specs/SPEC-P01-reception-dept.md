# SPEC-P01 — Tiếp nhận, Kỹ thuật, Vệ sinh (WP1)

File được sửa: `portal/src/app/reception/reception-app.tsx`, `portal/src/lib/reception-done.ts`, `portal/src/app/cleaning/{cleaning-app,dept-parts}.tsx`, `portal/src/app/technical/technical-app.tsx`, mới `portal/src/lib/building.ts`. CẤM sửa `src/` Python trong WP1.

## §1 Tiếp nhận — "Đã phân loại"
- Chip "Đang ở phòng ban" tách thành **Phòng kỹ thuật** và **Phòng vệ sinh** theo 01 §1. Cột "Đang ở" giữ nguyên.

## §2 Phòng ban — danh sách công việc
- Tab và tiêu đề "Hàng việc" / "Hàng việc kỹ thuật" ⇒ **Danh sách công việc**.
- Hàng nút trên thẻ ticket: hai nút cùng kích thước, rộng hết thẻ, xếp dọc (D07: lưới 2 cột làm chữ xuống dòng trong cột kanban hẹp), thứ tự: hành động chính trên (Nhận việc / Đánh dấu hoàn thành), hành động phụ dưới (Không phải việc phòng mình / Báo sai phòng ban). Nút phụ dùng viền, không tô màu.

## §3 Phòng ban — lịch sử hoàn thành
- Tab "Lịch sử" ⇒ **Lịch sử hoàn thành**.
- Đầu tab: ô **Hoàn thành S1 (n)** · **Hoàn thành S2 (n)** (+ "Chưa rõ tòa" khi > 0) theo 01 §2, dùng `buildingOf(t.location, t.title, t.text)`. Danh sách chỉ hiện ticket của ô đang chọn.

## Lỗi và hành vi
| Tình huống | Hành vi bắt buộc |
|---|---|
| Không ticket nào ở cả hai tòa | Hiện "Chưa có ticket hoàn thành." như hiện tại |
| Ticket không xác định tòa | Vào ô "Chưa rõ tòa", không bị ẩn |

## Vùng cấm
- Không đổi luồng Nhận việc/Hoàn thành/Báo sai phòng (chỉ bố cục).
- Không đổi màn `src/mobile/`.

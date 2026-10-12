# SPEC-P03 — Kho vật tư (WP3)

File được sửa: `portal/src/app/warehouse/warehouse-app.tsx`, `portal/src/server/data/{warehouse,types}.ts`, `portal/src/lib/dto.ts` (`WarehouseItem.min`), mới `portal/src/lib/stock.ts`; Python: `src/maintenance/models.py`, `src/maintenance/engine.py` (`stock_levels`), `src/api/routers/maintenance.py` (`StockRow`), `seed/maintenance_v1/catalog.yaml`.

## §1 Bảng tồn kho (sửa lỗi dính chữ)
- Nguyên nhân: ô bảng không có khoảng đệm và tiêu đề căn khác nội dung. Bảng chiếm toàn chiều ngang, mỗi cột có padding, tiêu đề và nội dung căn giống nhau.
- Cột: Mã VT · Tên vật tư · Đơn vị tính · Số lượng tồn (căn phải) · Tồn tối thiểu (căn phải) · Trạng thái (nhãn 01 §5) · Thao tác (+ Nhập hàng).
- Tồn `null` ⇒ `--` + nhãn "Chưa kiểm kê".

## §2 Thẻ và lọc
- (D11 thay dòng cũ "đỏ khi > 0 · thẻ Hết hàng") Thẻ: Tổng danh mục · **Cần nhập thêm** (out + low; bấm ⇒ bật lọc; màu theo mức nặng nhất: **xanh** khi 0, **vàng** khi chỉ có "Sắp hết", **đỏ** khi có ít nhất 1 vật tư hết hàng) · **Vật tư dùng nhiều trong tuần** (top 5 theo tổng `used_qty` của ticket hoàn thành trong 7 ngày, kèm số ticket; dữ liệu từ `GET /mo/warehouse/usage`). BỎ thẻ "Hết hàng". Bảng luôn xếp **hết hàng → sắp hết → chưa kiểm kê → an toàn**, trong cùng mức ít tồn trước (`byUrgency`, `restockTone` ở `portal/src/lib/stock.ts`).
- Contract thêm (chỉ đọc, cộng thêm): `GET /api/v1/mo/warehouse/usage?days=7` (1..31) ⇒ `[{item_code, item_name, unit, used_qty, tickets}]`, nhiều nhất trước; CHỈ kho + BQL (vai khác ⇒ 403 ACTION_DENIED). Mỗi ticket tính MỘT lần tại lần chuyển READY_FOR_REVIEW gần nhất (rework: lần cuối) với `used_qty` hiện có. Vùng cấm: KHÔNG để portal tự cộng từ chi tiết ticket — kho chỉ mở được ticket chờ vật tư (404 với ticket đã xong), nên số liệu sẽ trống/sai.
- Chip lọc có kiểu chip thật (không phải chữ trơn): Tất cả · Cần nhập thêm · Chưa kiểm kê.

## §3 Dữ liệu
Theo 01 §5. Store Postgres chỉ seed bảng tồn khi rỗng ⇒ DB chung KHÔNG đổi tồn; `min_qty` đọc từ danh mục nên DB chung vẫn có ngưỡng.

## §4 Không làm ở đợt 1
Xuất hàng, Lịch sử nhập/xuất, thanh tab Kho mới (cần backend, SPEC-P04). Không thêm nút giả.

## Lỗi và hành vi
| Tình huống | Hành vi |
|---|---|
| `min_qty` null | Không xét "Sắp hết"; chỉ Hết hàng / An toàn / Chưa kiểm kê |
| Vật tư thêm ngoài danh mục | `min_qty` null như trên |

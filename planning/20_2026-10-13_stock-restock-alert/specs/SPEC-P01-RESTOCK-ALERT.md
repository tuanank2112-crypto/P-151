# SPEC-P01 — Luật cảnh báo nhập lại vật tư

## 1. Kích hoạt (trong `receive_stock`, sau guard quyền/mã/qty hiện có, giữ `engine.lock`)
Trong `with self.repo.transaction() as tx`:
1. `tracked = self.repo.stock_of(item_code) is not None` (đọc TRƯỚC `add_stock`, cùng lock). Tồn `null` = không theo dõi ⇒ BẮT BUỘC không báo.
2. `qty_after = tx.add_stock(item_code, qty)`; `qty_before = qty_after − qty`.
3. Nếu cờ bật **và** `tracked` **và** `item_code ∈ allowed_material_codes(catalog, DEPT_TECHNICAL)` **và** `qty_before ≤ 0` ⇒ `tx.put_stock_alert(StockAlert(...))`.

`resume()` ticket chờ vật tư giữ nguyên, chạy sau transaction như hiện tại.

## 2. Phân quyền
Đọc: DEPARTMENT thuộc `DEPT_TECHNICAL`, BQL, WAREHOUSE. Ack: DEPARTMENT thuộc `DEPT_TECHNICAL`, BQL. Vệ sinh/BPTN/Cư dân ⇒ `ActionDeniedError` (403 `ACTION_DENIED`).

## 3. Bảng lỗi
| Tình huống | Kết quả | Caller PHẢI |
|---|---|---|
| Cờ tắt | GET `[]`; POST 404 `STOCK_ALERTS_DISABLED` | Ẩn chuông, không retry |
| Sai vai | 403 `ACTION_DENIED` | Không retry |
| `alert_id` lạ | 404 | Tải lại danh sách |
| Ack lần hai | 200, bản đã ack, không đổi `acknowledged_*` | Coi như xong |
| Lỗi DB khi nhập kho | Rollback cả tồn lẫn cảnh báo, 503 như hiện tại | Thử lại nhập kho |

## 4. Audit
Ack KHÔNG ghi `AuditEvent` (cảnh báo không thuộc ticket); `acknowledged_by/at` là bằng chứng.

## 5. Ví dụ đo được
`SIM-MAT-LAMP-02` tồn 0, Kỹ thuật dùng. `POST /warehouse/stock/SIM-MAT-LAMP-02 {qty: 20}` ⇒ đúng 1 alert (`qty_before=0, qty_after=20`). Nhập tiếp 5 ⇒ KHÔNG thêm (`qty_before=20`). Vật tư chỉ Vệ sinh tồn 0 → nhập ⇒ 0 alert.

## 6. Idea Vault
Thời lượng hết hàng (cần mốc về 0 trên `stock`); ngưỡng `min_qty`; kênh push; `src/web/`, `src/mobile/`.

# SPEC-P02 — Chuông cảnh báo ở màn Kỹ thuật `portal/`

- Loader `portal/src/server/data/technical.ts` gọi `GET /stock-alerts?unread=true`; lỗi/404 ⇒ danh sách rỗng, KHÔNG làm hỏng trang.
- Header màn Kỹ thuật: chuông + số chưa đọc; mở ra danh sách: "Kho đã nhập lại **{item_name}** (+{qty_added} {unit}, tồn {qty_after}) — {created_at}".
- Nút "Đã biết" ⇒ Server Action `ackStockAlert(alertId)` gọi POST ack, revalidate.
- Hàm thuần `portal/src/lib/stock-alerts.ts`: `unreadCount`, `formatAlert` (có test unit).
- CẤM: tự polling dưới 30 s; CẤM hiện cảnh báo cho vai khác.

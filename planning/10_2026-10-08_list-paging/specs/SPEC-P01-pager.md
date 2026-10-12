# SPEC-P01 — Khối chuyển trang 20 dòng

File được sửa: `src/web/app.js` (DUY NHẤT). `src/web/theme.css` chỉ khi cần 1 class `.pager` (≤ 15 dòng).

## §1. `listCard` khi có `paging`
1. `total = items.length`; nếu `ids.length !== total` ⇒ theo 01-CONTRACTS §5.
2. Trang ban đầu `p = state.pages[key] || 1`.
3. Nếu `state.selected` có trong `ids` tại vị trí `i` ⇒ `p = pageOfIndex(i)` (I-3). Ngược lại giữ `p`.
4. `p = clampPage(p, total)`; ghi `state.pages[key] = p`.
5. Gắn `items.slice((p-1)*PAGE_SIZE, p*PAGE_SIZE)` vào `<ul data-list=key>`.
6. Nếu `total > PAGE_SIZE` ⇒ thêm `<nav class="pager">` ngay dưới `<ul>` trong cùng card (I-4).
7. Bấm Trước/Sau: `state.pages[key] = p ± 1`, thay con của `<ul>` bằng slice mới, cập nhật nhãn + `disabled`,
   cuộn đầu card vào tầm nhìn (`scrollIntoView({block: 'nearest'})`). KHÔNG gọi `render()`, KHÔNG gọi API, KHÔNG đổi `state.selected`.

## §2. Nơi gọi (4 màn)
| Màn | Hàm | `key` | `ids` |
|---|---|---|---|
| Cư dân | `renderResident` | `'resident'` | `tickets.map(t => t.ticket_id)` |
| BPTN | `internalList` khi gọi từ `renderBptn` | `'bptn'` | `tickets.map(t => t.ticket_id)` |
| Phòng ban | `internalList` khi gọi từ `renderDepartment` | `'department'` | như trên |
| BQL | `renderBql` | `'bql'` | `rows.map(r => r.ticket_id)` |
`internalList` nhận thêm tham số `pageKey` (bắt buộc từ hai nơi gọi trên).

## §3. Reset trang
- Đổi bộ lọc BQL (`update()` trong `renderBql`) ⇒ `state.pages.bql = 1` (cùng chỗ đang đặt `state.selected = null`).
- `signOut()` ⇒ `state.pages = {}`.
- Không reset ở chỗ nào khác (thao tác `act()` → `render()` giữ trang — I-3 lo ticket đang chọn).

## §4. Giao diện khối chuyển trang
- Nút dùng class nút phụ có sẵn (`BTN.secondary`), nhãn giữa `text-sm text-slate-600`, căn giữa, khoảng cách trên `pt-3`.
- Rộng 390px: một hàng, không tràn ngang.

## §5. Luật
- BẮT BUỘC: pill "`N` phản ánh" và mọi ô đếm giữ số của TOÀN BỘ danh sách (I-1).
- CẤM: đổi cách lọc/sắp xếp; đổi API; gọi API khi chuyển trang; lưu trang ra ngoài bộ nhớ.
- CẤM: sửa các hàm/màn khác của `app.js` ngoài 4 nơi gọi, `listCard`, `state`, `signOut`, `update()` của BQL.

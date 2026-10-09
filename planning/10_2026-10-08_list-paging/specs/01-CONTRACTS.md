# 01 — Contracts (plan 10)

Chỉ `src/web/app.js`. API backend KHÔNG đổi.

## §1. Hằng số và state
```js
const PAGE_SIZE = 20;
// state (thêm khoá mới, các khoá cũ giữ nguyên)
pages: {},   // screenKey -> số trang đang xem (1-based); thiếu khoá = trang 1
```
`screenKey` cố định: `'resident'`, `'bptn'`, `'department'`, `'bql'`.

## §2. Helper `listCard` — chữ ký mở rộng, tương thích ngược
```js
function listCard(title, count, items, empty, paging = null)
// paging: { key: screenKey, ids: string[] }  — ids[i] là ticket_id của items[i] (cùng thứ tự)
// paging = null  ⇒ hành vi cũ (hiện hết)
```
- `count` giữ nguyên nghĩa: tổng số dòng (I-1).
- `items`: mảng node `<li>` đã dựng đủ cho TOÀN BỘ danh sách; chỉ phần của trang hiện tại được gắn vào DOM.

## §3. Hàm thuần (để test)
```js
function pageCount(total, size = PAGE_SIZE) { return Math.max(1, Math.ceil(total / size)); }
function clampPage(page, total, size = PAGE_SIZE) { return Math.min(Math.max(1, page | 0), pageCount(total, size)); }
function pageOfIndex(index, size = PAGE_SIZE) { return Math.floor(index / size) + 1; }
```

## §4. DOM của khối chuyển trang (selector cho test)
```html
<nav class="pager" aria-label="Chuyển trang danh sách" data-pager="<screenKey>">
  <button type="button" data-page-prev>‹ Trước</button>
  <span data-page-label>Trang 2 / 4</span>
  <button type="button" data-page-next>Sau ›</button>
</nav>
```
- Trang 1 ⇒ `data-page-prev` có `disabled`; trang cuối ⇒ `data-page-next` có `disabled`.
- Danh sách `<ul>` của `listCard` có `data-list="<screenKey>"`.

## §5. Lỗi
| Tình huống | Hành vi bắt buộc |
|---|---|
| `state.pages[key]` lớn hơn số trang (danh sách ngắn lại sau thao tác/lọc) | `clampPage` về trang cuối hợp lệ, ghi lại vào `state.pages` |
| `ids.length !== items.length` | Lỗi lập trình: `console.error` + hiện hết (`paging = null`), KHÔNG vỡ màn |
| Danh sách rỗng | Giữ `emptyState` như cũ, không có pager |

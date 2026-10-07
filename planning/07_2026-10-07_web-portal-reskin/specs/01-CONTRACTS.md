# 01 — Contracts: token, DOM, trạng thái

## 1. Token (nguồn: `portal/src/app/globals.css` `@theme`)
| Token | Giá trị | Dùng cho |
|---|---|---|
| ink | `#13203A` | chữ chính |
| ink-strong | `#0F1E36` | tên ở header |
| hello | `#17305A` | "Xin chào," |
| muted | `#5B6578` | chữ phụ |
| body | `#2A3447` | chữ thân |
| page | `#F3F5F9` | nền trang |
| brand / brand-dark / brand-mid | `#1D4ED8` / `#1E3A8A` / `#2563EB` | nút chính, link, focus |
| line / line-soft | `#E9EDF3` / `#EEF2F7` | viền, nền ô icon |
| soft | `#EEF4FF` | nền chọn |
| field | `#F7F9FC` (viền `#DCE2EB`) | ô nhập |
| danger | `#B42318` | khẩn cấp |
| gradient | `linear-gradient(120deg, #9CCBFF 0%, #5E9BFF 100%)` | header, đăng nhập |

Remap palette Tailwind (`tailwind.config.theme.extend.colors`, áp cho 418 chuỗi class cũ):
- `indigo`: 50 `#EEF4FF` · 100 `#DCE8FF` · 200 `#C9DAFF` · 300 `#93B4F5` · 400 `#5E9BFF` · 500 `#2563EB` · 600 `#1D4ED8` · 700 `#1E3A8A` · 800 `#1E3F7A` · 900 `#17305A` · 950 `#0F1E36`
- `slate` và `stone`: 50 `#F3F5F9` · 100 `#EEF2F7` · 200 `#E9EDF3` · 300 `#DCE2EB` · 400 `#9AA4B5` · 500 `#5B6578` · 600 `#475166` · 700 `#2A3447` · 800 `#17305A` · 900 `#13203A` · 950 `#0F1E36`
- `fontFamily.sans`: `"Be Vietnam Pro"`, system-ui · `borderRadius`: `xl` 14px, `2xl` 22px, `3xl` 24px.

## 2. DOM id bất biến
`login-view`, `app-header`, `main`, `app-view`, `view-title`, `view-subtitle`, `list-pane`, `detail-pane`, `user-menu`,
`toasts`, `confirm`, `confirm-title`, `confirm-body`, `login-username`, `login-password`, `detail-title`. Script `app.js` vẫn nạp từ `index.html`
(test `test_api.py:263` kiểm chuỗi `app.js`).

Mới: `hello-avatar`, `hello-name` (header), `<link href="theme.css">`.

## 3. Trạng thái → màu pill (thay `STATUS_STYLE`)
| Status | Nền / chữ | Nguồn class portal |
|---|---|---|
| RECEIVED, MERGED, CANCELLED | `#E9EDF3` / `#475166` | `.s-cancel` / `.wait` |
| VERIFYING, NEED_INFO, ON_HOLD | `#FFEFC2` / `#664900` | `.s-pause` / `.need` |
| ROUTED, IN_PROGRESS | `#E1EAF9` / `#1E3F7A` | `.s-run` |
| READY_FOR_REVIEW | `#E5E0F6` / `#3D3078` | `.s-wait` |
| CLOSED | `#D8EFE3` / `#13553A` | `.s-done` |
| SAFETY_REVIEW_REQUIRED | `#FDE2DF` / `#8A1C12` | `.late` |
| EMERGENCY_PENDING_BQL | `#B42318` / `#FFFFFF` | `.urgent` |

`chip(tone)` và `callout(tone)` dùng cùng các cặp: slate→`#E9EDF3/#475166`, amber/warn→`#FFEFC2/#664900`,
rose/danger→`#FDE2DF/#8A1C12`, indigo/info→`#E1EAF9/#1E3F7A`, green/ok→`#D8EFE3/#13553A`.

## 4. Lỗi
| Tình huống | Hành vi bắt buộc |
|---|---|
| Google Fonts không tải được | Rơi về `system-ui`, giao diện vẫn dùng được |
| CDN Tailwind không tải được | `theme.css` vẫn tạo được khung (header, card, nút, ô nhập); đã biết là prototype |
| Trình duyệt còn `mo-theme=dark` | Xoá class `dark` khi khởi động, không đọc khoá này nữa |

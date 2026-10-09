# SPEC-P01 — Header, đăng nhập, helper

## 1. Header (theo `portal/src/components/shell.tsx` `Header` + `Body`)
- `#app-header`: nền gradient (01-CONTRACTS §1), padding `32px 24px 112px`, KHÔNG sticky, không viền.
- Trái: vòng tròn trắng 72px chữ viết tắt tên (`#hello-avatar`, màu brand, 24px bold) + "Xin chào," (18px, `hello`) + tên (`#hello-name`, 32px bold, `ink-strong`; 24px dưới 640px).
- Phải (`#user-menu`): pill vai trò nền `rgba(255,255,255,.88)` · ô chọn đổi tài khoản test (giữ nguyên danh sách và hành vi `quickSwitchUser`, kiểu pill trắng) · nút `.hdr-btn` "Đăng xuất".
- `#main`: `max-width:1200px`, `margin-top:-80px` (đè lên gradient), padding ngang 24px (16px dưới 640px).
- Khối tiêu đề màn (`#view-title`, `#view-subtitle`) nằm trong một `.card` (đè lên gradient), tiêu đề 28px bold, phụ đề 15px `muted`.
- BẮT BUỘC: tên hiển thị lấy từ `humanizeDisplayName()` như cũ. CẤM chuông thông báo (V1).

## 2. Đăng nhập (theo `portal/src/app/login/page.tsx` + `login-form.tsx`)
- Dải gradient trên cùng (padding `40px 24px 160px`): vòng trắng 52px icon nhà + "Cổng phản ánh cư dân" (20px bold) + `LOGIN_SITE_NAME` (14px, `hello`).
- Thẻ form trắng `max-width:460px`, bo 24px, padding 36px, shadow `0 8px 30px rgba(15,30,60,.10)`, kéo lên `-120px`.
- Nội dung: "Xin chào," (16px muted) · "Đăng nhập" (30px bold) · câu mô tả · hai ô `.field` (cao 52px, bo 14px) · nút "Hiện/Ẩn" `.eye` · nút `.submit` pill brand cao 52px · dòng "Quên mật khẩu? …" 13px muted.
- Lỗi: hộp `#FDE2DF/#8A1C12` bo 14px, `role="alert"`; ô nhập thêm class `err`.
- Giữ nguyên: id ô, `autocomplete`, xử lý lỗi kết nối, `?autologin=`.

## 3. Helper (`app.js`)
| Helper | Kiểu mới |
|---|---|
| `BTN.primary` | `.btn primary` (pill 44px, brand) + `inline-flex gap-2` |
| `BTN.secondary` | `.btn` (pill trắng viền `#D9DFE8`, hover brand) |
| `BTN.danger` | `.btn danger` (viền `#F1B4AE`, chữ `#B42318`) |
| `INPUT` | `.field` của thiết kế (nền `#F7F9FC`, viền `#DCE2EB`, bo 14px, focus outline brand) |
| `card()` | `.card` (bo 22px, shadow `0 2px 14px rgba(15,30,60,.06)`), padding 20/24px, tiêu đề 17px bold |
| `badge()` | `.pill` + `.dot`, màu theo 01-CONTRACTS §3 |
| `chip()`, `callout()` | cặp màu 01-CONTRACTS §3, bo 999px / 14px, không ring |
| `toast()` | ok: nền `#13203A` chữ trắng; error: `#FDE2DF/#8A1C12`; bo 14px |
| `listItem()`, `residentListItem()` | bo 18px, viền 2px trong suốt; chọn = viền `#2563EB` nền `#F5F8FF`; hover viền `#C9DAFF` |
| `emptyState()`, `skeleton()` | viền nét đứt `#DCE2EB` bo 18px; khối xám `#E9EDF3` |
| `<dialog id="confirm">` | bo 22px; nút bằng `.btn` / `.btn danger-fill` |

CẤM đổi chữ ký hàm helper (mọi màn đang gọi).

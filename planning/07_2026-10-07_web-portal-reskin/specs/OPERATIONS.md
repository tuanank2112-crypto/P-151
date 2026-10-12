# OPERATIONS — chạy, cache, rollback

## 1. Chạy
- Docker: `docker compose up -d --build backend` (image chép `src/` lúc build, KHÔNG mount) ⇒ http://localhost:8000/ui/
- Ngoài Docker: `uvicorn src.main:app --reload` ⇒ cùng đường dẫn, sửa file là thấy ngay.

## 2. Cache trình duyệt
`index.html` nạp `theme.css?v=1.0` và `app.js?v=4.0`. Sửa một trong hai file ⇒ BẮT BUỘC tăng `?v=` để trình duyệt tải bản mới.

## 3. Rollback
Revert các file `src/web/index.html`, `src/web/app.js`, xoá `src/web/theme.css`. Không có dữ liệu/DB/API nào đổi.

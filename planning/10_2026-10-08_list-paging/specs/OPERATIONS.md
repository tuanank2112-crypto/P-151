# OPERATIONS — Deploy, rollback (plan 10)

## §1. Thứ tự
1. Sửa `src/web/app.js` → `node --check src/web/app.js`.
2. `pytest tests -q` (backend không đổi; test `/ui/app.js` phục vụ được vẫn xanh).
3. Kiểm UI trên backend LOCAL `:8001` (`MO_STORE=memory`, `LLM_MODE=mock`) — tạo ≥ 25 phản ánh thử bằng API của chính server local.
   CẤM tạo phản ánh thử trên `:8000` (Supabase chung của nhóm).
4. `docker compose up -d --build backend` (UI tĩnh nằm trong image) → mở `:8000/ui/` kiểm bằng mắt, chỉ ĐỌC.

## §2. Rollback
`git revert <commit plan 10>` + `docker compose up -d --build backend`. Không có dữ liệu để dọn.

## §3. Xung đột đã biết
`planning/08_2026-10-08_web-portal-shell/` (chưa merge) viết lại khung trang `src/web/`. Khi gộp: giữ `listCard(..., paging)`, `PAGE_SIZE`,
`state.pages`, 3 hàm thuần và 4 nơi gọi của plan này trên bản của plan 08.

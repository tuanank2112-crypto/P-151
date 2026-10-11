# Kiến trúc
## §A1. Nguồn chân lý
Python API /api/v1 là nguồn duy nhất cho user, ticket, phân loại, blocker, vật tư, kho, ảnh và audit. Next.js giữ UI portal và Server Actions/BFF; không có quyền điều phối workflow. Web /, app /app, UI /ui thấy cùng ticket_id và cùng status.
Luồng: browser → Next action/read → Python API với Bearer của chính user; response → DTO UI. Không gọi workflow.ts hoặc Drizzle ở runtime mới.

## §A2. Phạm vi và owner
Được: portal frontend/BFF/tests/config/Dockerfile, compose portal env, docs/não/version. Cấm sửa src/maintenance, src/api, seed Python, .env/key, safety/G-1/SPEC-P09, production DB. src/main.py proxy hiện có giữ nguyên trừ RED cụ thể được root duyệt.
Giữ globals.css, shell, palette, cards, modal, responsive; backend capability quyết nút và form. Code DB legacy chỉ giữ để rollback/test cũ, không reachable từ pages/actions/ảnh runtime mới.
Không xoá/migrate DB portal hoặc lịch sử; không tạo ticket shadow/cache để thay dữ liệu Python.

## §A3. Giới hạn được trình duyệt
Bỏ chức năng portal không có API: tự tạo catalog vật tư, staff assignment, pause SLA riêng, cư dân nghiệm thu/hủy, tags/comment rating, quản trị keyword/notice DB. Không đưa fake handlers vào UI. SPEC-P02 chỉ rõ thay thế.
Không triển khai semantic P09 trong đợt này. Ca rõ vẫn có thể bị chặn nếu Python trả blocker; UI hiện nguyên nhân thực tế, không hứa mọi ticket tự route.
Không chuyển tài khoản portal cũ sang Python hoặc tự tạo alias/password.

## §A4. Lỗi/caller
401 → login, không fallback DB; 403 → quyền backend, không actor giả; 409/422 → giữ input/error; 5xx/offline → lỗi tạm, không dựng ticket/success. Root gặp API thiếu → sửa SPEC xin duyệt, không bypass.
Số đo: build không cần DATABASE_URL; restart portal giữ token Python; request không chứa DB URL/secret; mọi action BFF đo gọi đúng actor.

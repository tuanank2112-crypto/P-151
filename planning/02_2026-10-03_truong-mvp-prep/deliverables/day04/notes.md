# Day04 — diễn tập demo qua server thật trên localhost

environment=local, base_url=http://127.0.0.1:8184 (uvicorn thật + httpx, không TestClient). KHÔNG phải online. Bản đo: worktree dff898e5cfcfef3ebfe39af9cb83a938ed275fbf (origin/develop). Kết quả: [results.json](results.json) (16 PASS, 2 BLOCKED, 0 FAIL).

## Giới hạn mô phỏng

| Hạng mục | Thực tế khi đo | Hệ quả |
| :--- | :--- | :--- |
| Dữ liệu | Fixture/seed SIM-*, mô phỏng | Không có cư dân/ảnh thật |
| LLM | LLM_MODE=mock | Không đo chất lượng phân loại LLM thật |
| Lưu trữ | MO_STORE=memory | Restart mất dữ liệu (PERSIST-RESTART đã đo: 404) |
| Môi trường | localhost 127.0.0.1, một máy | Không đo mạng, nhiều người dùng, CDN, online |
| Jobs | MO_JOBS_ENABLED=false; deadline 4h/12h chạy tay bằng POST /mo/jobs/run với `now` mô phỏng | Không đo scheduler nền thật |
| Ảnh | evidence ảnh chỉ là metadata JSON | Không đo upload ảnh |
| UI | chỉ GET /ui (307 sang /ui/, rồi 200) | CHƯA đo UI thao tác |

## Khác Day03 (TestClient)
- Đọc trạng thái qua HTTP thay vì engine in-process: rating đọc từ GET ticket; số lượng additions từ GET ticket; tồn kho từ `material_lines.simulated_stock_qty`.
- Tồn kho trung gian (0->1->2) không đo được qua HTTP: `simulated_stock_qty` là ảnh chụp, chỉ làm mới khi resume. Hai check g3 mismatch; luồng nghiệp vụ vẫn đúng. Ghi BLOCKED (owner Châm Anh).
- Cấu hình hiệu lực không đọc được in-process; xác nhận bằng /health (env development) và lệnh khởi động ép env. D-01 (d01a/b/c) bỏ theo quyết định ngoài phạm vi MVP.

## Việc chưa xong
- Persistence thật (Postgres/Supabase) và bản online: gate vẫn mở.
- Đo UI thao tác (click, render), chưa có.
- Endpoint đọc tồn kho (hoặc chấp nhận suy luận hành vi) cho DEMO-03.
- Hub Bước 0: `../brain4agent.release` thiếu, init_brain --check exit 1 (MODULE_NOT_FOUND), không sửa.

## Câu hỏi mở
- OPERATIONS §5.2.3 ghi owner NEED_INFO an toàn = BPTN, code/CR-03 §6.4 = cư dân (cùng drift như Day03-ter). Chờ Trường chốt chữ spec; không đổi expected trong gói này.

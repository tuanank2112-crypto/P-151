# Roadmap & Active Tasks

File này chứa danh sách các tính năng, mục tiêu sắp tới và tình trạng công việc hiện tại.

## Mục tiêu hiện tại (Active)
- [ ] CR-BPTN-02 (v0.5 candidate, trạng thái PROPOSED trên `feature/chamanh`): chờ duyệt để thành baseline.
- [ ] Kế hoạch 01 `planning/01_2026-10-02_supabase-persistence/` (đích 0.6.0): WP1 ✅; WP2–WP4 xong local (R02 chờ duyệt);
  còn WP4b (phiên lưu DB), WP5 (smoke + gate Supabase: owner chạy migration), WP6 (docs, bump).

## Tương lai (Upcoming)
- [ ] Audit cho `receive_stock` (kho nhập vật tư): hiện không có dòng audit vì `AuditEvent` bắt buộc `ticket_id`.
- [ ] Quyết định giữ hay xoá boilerplate LangGraph (`/api/v1/chat`, `src/agents/`, `src/services/llm.py`) — MaintenanceOps không dùng.
- [ ] Nếu deploy sau reverse proxy: lấy IP client từ header tin cậy, nếu không khóa đăng nhập sẽ dồn về IP của proxy.

## 💡 Kho Ý Tưởng & Backlog (Idea Vault)
*Nơi lưu trữ các ý tưởng hay, kiến trúc mở rộng chưa ưu tiên làm ngay nhưng cần giữ lại để tham khảo.*
- [ ] Chạy ruff format cho `scripts/` (hiện CI không kiểm).
- [ ] Biểu đồ flow 2026-10-01 — **nhánh khẩn cấp**: từ bước phân loại chuyển thẳng BQL "Thực hiện task khẩn cấp". Code chưa có
  khái niệm khẩn cấp (không status/cờ/luật nhận diện); cần CR mới (đổi contract trạng thái) trước khi làm.
- [ ] Dọn ảnh mồ côi trong bucket (put xong mà tx lỗi và delete cũng lỗi) — non-goal kế hoạch 01.
- [ ] CI chạy `pytest --pg` với service Postgres trong GitHub Actions.
## Đã hoàn thành (Done)
- [x] **Khởi tạo Bộ Nhớ Não Bộ Chuẩn (v1.0.0):** Thiết lập cấu trúc Đa Tầng brain4agent V5.2 và quy chuẩn quản trị AGENTS.md.
- [x] **Rà soát backend 2026-09-30:** an toàn đồng thời cho engine, job không chặn event loop, chặn cư dân lùi ngày ở production,
  khóa đăng nhập theo username + client, `/chat` không lộ lỗi, `llm.py` nhận `OPENAI_BASE_URL`, ruff sạch toàn repo.
- [x] **Flow 2026-10-01:** phân loại (bước 3) trước kiểm tra trùng (bước 4); hàm bước đặt tên `_step_<số>_<việc>`;
  `WAITING_MATERIAL` chạy lại từ tra tài sản. 142 test xanh.
- [x] **Thiếu dữ liệu giao BPTN (2026-10-01):** `MISSING_INFO` do BPTN gỡ (nhập vị trí/thông tin sau khi gọi cư dân), cư
  dân vẫn tự bổ sung được; UI BPTN có hàng chờ `NEED_INFO`. 146 test xanh.

## Trường — lịch theo Notion (nguồn: [Kế hoạch MaintenanceOps MVP](https://storm-jade-f74.notion.site/K-ho-ch-MaintenanceOps-MVP-3e43b68a924d80d7a81fe0579e1eddb9), đọc 2026-10-03)
*Chỉ ghi việc của Trường; phụ thuộc người khác ghi trong ngoặc. Xong = có tài liệu/test + bằng chứng, không chỉ dấu tick.*
- [x] 01/10 — Phiên duyệt CR-03, phạm vi P0/P1, mặc định D-01–D-07, ghi người duyệt D-08, chốt 4 luồng demo (plan 02 WP1–WP3).
  D-08: leader Lê Thị Châm Anh duyệt MVP 04/10 + D-01–D-07; ngày báo 2026-10-02, ghi nhận 2026-10-03; tham chiếu a5e2705/PR #6.
- [x] 02/10 — Rules P0 + ví dụ phủ định/không dấu/nghi ngờ; sửa expected CLN-004, TEC-005 (plan 02 WP4–WP5; 266 test, 57/57 hồ sơ).
- [~] 03/10 — Kiểm tra asset/vật tư, trùng cơ bản, 4 script demo, rà wording theo quyền vai trò → D3-01..07 (SPEC-P06-DAY03).
  Chạy local cô lập (SHA 0ea04ad): 23 record = 17 PASS / 1 FAIL / 5 BLOCKED / 0 NOT_RUN. D3-01/02/03/04/07 [x] (D3-07 = đã lập báo cáo); D3-05/06 chưa [x].
  Asset 3/3, vật tư 4/4, trùng 4/4 PASS. Wording: WORD-03 PASS; WORD-01/02/04 BLOCKED (safety Bậc 2/Bậc 1, rating-once, reopen chưa tích hợp). Demo: 5 PASS, 1 FAIL (DEMO-01-RATING: `engine.rate` ghi đè rating, engine.py:548-553), 2 BLOCKED (DEMO-04 safety chưa tích hợp). Owner lỗi/BLOCKED: Như Ý.
  Chờ người quyết: ASSET-03 (SPEC §3 vs OPERATIONS §3.2.2), STOCK-04 (cờ `STOCK_CHECK_ON_ACCEPT` chỉ đặt, accept không xử lý), owner reopen/rating-once.
- [ ] 04/10 — Chạy demo theo script trên bản online, đối chiếu expected, ghi phần chưa xong + giới hạn mô phỏng. 21:00 nghiệm thu MVP.
  (Chờ: Như Ý nối safety P0 + D-01 vào engine; Châm Anh deploy + persistence/restart.)
- [ ] 05/10 — Chốt backlog sau MVP; mở rộng bộ câu gán nhãn, tách nhãn classification và safety.
- [ ] 06/10 — Rà tuyến chạy theo từng blocker + bảng resume; chuẩn bị case đối chiếu engine ↔ graph.
- [ ] 07/10 — Kiểm tra tương đương nghiệp vụ trước/sau LangGraph (nội dung bổ sung phải quét safety lại).
- [ ] 08/10 — Chốt kịch bản user test + danh sách người tham gia; mỗi thành viên mời ≥1 người, lịch test 10–12/10.
- [ ] 09/10 — Case gộp đúng/sai, gốc hủy, gốc đóng, cư dân của ticket con.
- [ ] 10/10 — Rules/nhãn tín hiệu safety mở rộng (P1, PRI-U1/U2); tổ chức người test đầu tiên.
- [ ] 11/10 — Rà expected outcome, thông điệp cư dân, ranh giới quyền (follow-up, safety clearance).
- [ ] 12/10 — Hoàn thành user test 3–5 người; baseline thủ công vs sản phẩm. 21:00 khóa tính năng.
- [ ] 13/10 — Rà chất lượng nhãn, ĐÓNG BĂNG tập eval, ghi giới hạn dữ liệu mô phỏng.
- [ ] 14/10 — Rà nhãn tranh chấp; tổng hợp số đo thao tác/thời gian + user feedback.
- [ ] 15/10 — Architecture + swimlane; problem statement, giả thuyết, giải pháp, giới hạn.
- [ ] 16/10 — Pitch 10 slide: bài toán, người dùng, giải pháp, demo, kiến trúc, chiều sâu, eval, UX, giới hạn, bước tiếp.
- [ ] 17/10 — Dẫn pitch, tập lần 1–2, chỉnh theo thời lượng.
- [ ] 18/10 — Tập lần 3; đối chiếu MỌI tuyên bố với kết quả thật.
- [ ] 19/10 — Nghiệm thu nội dung, pitch, bằng chứng user/eval; cả nhóm sign-off. 23:59 khóa bàn giao.

**Chỉ tiêu 19/10 phụ thuộc dữ liệu của Trường:** safety ≥40 câu nhãn, 0 bỏ sót Bậc 1 (báo false positive); classification
≥90% held-out; AC-01–AC-18 map test/kịch bản; user test 3–5 người độc lập (thiếu ⇒ ghi số thật).

Worker · thi công · Sonnet 5.5 · Bước 0 exit chưa chạy trong worktree (SO đã đo, Q21) · hiểu việc: phạm vi engine.py + 2 test mới + helpers (chỉ thêm) · xong khi test_agent_engine + test_agent_parity EXIT=0 · cấm agent/**, coordination/*.py, rules/safety/models, test cũ
Handoff: handoffs/H06_thi-cong_WP6.md
Base: 3e3a3f809cf7a591010dee7a15d7ac5d6ff4ba6d
Head: chưa commit (SO gộp)

| Lệnh | Exit | Kết quả | Evidence |
|---|---|---|---|
| pytest 2 file mới trên base | 1 | 22 failed, TypeError `agent` | evidence/WP6/red-before.txt |
| pytest 2 file mới sau sửa | 0 | 22 passed | evidence/WP6/green.txt |
| đột biến (a) decide trong lock ở receive | 1 | A-20 đỏ | evidence/WP6/mutation-a.txt |
| đột biến (b) bỏ max(..., risk_level) | 1 | A-07 đỏ | evidence/WP6/mutation-b.txt |
| đột biến (c) dùng record cũ khi vân tay lệch | 1 | A-25 đỏ | evidence/WP6/mutation-c.txt |
| pytest toàn bộ | 1 | 3117 passed, 1 failed, 0 skip, 48 deselected | evidence/WP6/pytest.txt |
| biến thể + coordination | 0 | 1006 passed | evidence/WP6/variants.txt |
| ruff check + format --check | 0 | sạch | evidence/WP6/ruff.txt |

Fail duy nhất: test_engine.py::test_partial_delivery_updates_the_stock_the_waiting_ticket_shows (OUT_OF_HOURS, đồng hồ thật, có sẵn trên base; SO đã báo, không sửa).

git diff --cached --stat: 12 files, 2372 insertions, 50 deletions (engine.py, helpers.py, 2 test, evidence/WP6).

Bảng phân công: WP6 a–d → 🟠 → Sonnet 5.5 (tự làm, không giao con).

Việc không làm / lưu ý:
- A-20 phần `create_follow_up`: để WP10 (stub hiện tại).
- A-27 chỉ kiểm nhánh `_try_split` stub False (dừng CATEGORY_UNCLEAR "Agent thấy hai việc") và True (giả lập qua gán instance); chi tiết tách là WP8.
- `--pg` không chạy (không cần cho WP6).
- `_with_decision(gate=bool)` đúng SPEC; thêm helper `_gate(ticket_id, check)` (đọc không ghi) để tính bool.

Câu hỏi mở cho SO:
1. 2b áp `max(result, ticket.risk_level)` cho mọi đường: không test cũ nào đỏ.
2. Khi Agent đề xuất job nhưng engine loại hết (valid rỗng), em coi như không có quyết định cho bước 2/3 (luật quyết, `_job_view`) — SPEC chưa nói rõ.
3. Ghi chú MINOR bước 4 ghi vào audit `CREATE_PROPOSAL`, field_name `duplicate_check`, reason bắt đầu "MINOR ·".

⏳ Chờ người duyệt.

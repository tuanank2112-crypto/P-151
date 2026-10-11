# Kiến trúc và bất biến

## §A1. Mục tiêu và nguồn chân lý

Một thao tác lưu trên web/app phải thay toàn bộ lựa chọn và ghi `issued_qty = used_qty` trong một transaction; sai bất kỳ dòng nào ⇒ không thay ticket, kho, audit, outbox.
Backend phải từ chối vật tư khác phòng ban, số lượng không nguyên dương và danh sách rỗng cho Kỹ thuật. Vệ sinh được chọn không sử dụng.
Thứ tự đọc: CONTRACTS → SPEC-P01 → SPEC-P02 → OPERATIONS → TESTING.

## §A2. Bằng chứng nền và giới hạn

- Review nền: 3387 passed, 88 deselected, exit 0, 172.61 s; ruff check/format đạt; JS 12 file hợp lệ. Không chứng minh các guard chưa tồn tại.
- Tái hiện trong memory: CLEAN-01 cho Kỹ thuật được ghi; LAMP-01 ×0.5 được ghi; Kỹ thuật `lines=[]` vẫn READY_FOR_REVIEW/all_pass.
- Đổi LAMP-01 đã xuất 4 sang LAMP-02 hết hàng: plan đổi và kho LAMP-01 1→5 trước lỗi. Web vẫn prefill và có hai bước.
- Chưa có đo UI trình duyệt ở môi trường agent; thiếu Playwright. Boot hub hiện không tồn tại, exit 1. Không tự sửa luật engine.
- Snapshot mã thật phải khớp `evidence/baseline.txt`; version tham khảo 1.9.9, không chỉ HEAD 7131510.

## §A3. BẮT BUỘC / CẤM

- Mọi mutation qua `_mutate`, `engine.lock` và `CaseRepository.transaction`; giữ audit fail closed.
- Thêm operation công khai theo CONTRACTS §C2, không gọi nối các mutation công khai có transaction riêng.
- Danh mục phòng ban theo `Catalog.playbook_departments` + `Catalog.playbook_materials`, không phụ thuộc LLM.
- Không reset DB chung, không migration, không sửa Supabase/prod; test ghi chỉ memory và Postgres local `*_test`.
- Không khôi phục yêu cầu giải thích khi khác norm/Agent; không xoá model fields và lịch sử ticket.
- Không tự thêm cờ active vật tư: schema hiện không có; thay này ngoài phạm vi. Mã phải tồn tại và thuộc mapping để chọn mới.
- Không đổi safety, auth, checklist, ảnh, nghiệm thu, API OpenAI, portal runtime hay nguồn kho.
- Client cũ giữ endpoint cũ nhưng được siết guard theo §C3; không hứa sequence API cũ nguyên tử.

## §A4. Phân loại lỗi kiến trúc

| Lỗi | Caller phải làm |
|---|---|
| Nền dirty khác snapshot | Dừng ghi; root đối chiếu hash trước tiếp tục |
| SPEC thiếu quyết định | Worker báo root 🔴, không tự đổi contract |
| Worker chạm file ngoài owner | Root trả 🔁 và đối chiếu diff; không xoá sửa của người khác |
| Thiếu công cụ đo | Gate giữ ⬜; báo thiếu công cụ, không đánh dấu PASS |

## §A5. Nghiệm thu

Baseline máy và từng R có SHA/hash; số test nền ≥3387, không giảm/deselect thêm trái spec. Có bằng chứng RED→GREEN cho 4 ca trên; rollback backend và UI một lần bấm phải được đo, không suy ra từ lint.

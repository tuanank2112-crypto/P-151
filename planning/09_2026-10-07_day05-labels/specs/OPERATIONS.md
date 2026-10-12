# Operations — dữ liệu offline trước

> **Phạm vi đang hiệu lực: PRELIMINARY_15**, được Trường duyệt ngày 08/10/2026. Đọc [SPEC-P03-PRELIMINARY15](SPEC-P03-PRELIMINARY15.md) trước; quota 80/40, held-out30 và 32 family bên dưới là mục tiêu rộng trước đây, không còn là cổng bắt buộc của Day05 sơ bộ. Yêu cầu review thật và bằng chứng không đổi.

## 1. Contract công cụ và thứ tự

Interfaces CẦN VIẾT khi thực thi, chưa có trong repo:

- `validate_day05.py --data-dir <deliverables>` hoặc `--backlog <backlog.json>`: đọc schema/refs/quote/reviewer/split; exit0 hợp lệ, exit1 vi phạm.
- `run_day05_baseline.py --data-dir <deliverables> --mode rules --split develop|held-out --output <baseline-results.json>`: gọi classify/assess độc lập; không tạo repository hoặc gọi mạng.
- Optional `--mode luna`: chỉ classification ELIGIBLE, lưu model/prompt/version/call status; không bật safety LLM, ghi run riêng.

Thứ tự: duyệt contract → backlog → câu/proposal → blind human review → disputes → gold → group split → validator → baseline → báo cáo/bàn giao. Held-out chỉ chạy sau khi freeze hash. Không tuning prompt/rules theo held-out; khi đã dùng để sửa, chuyển thành DEVELOP ở dataset version mới và tạo held-out mới.

## 2. Môi trường

Không cần URL public/Supabase/ảnh. Probe engine nếu cần: LLM_MODE=mock, MO_STORE=memory, MO_PHOTO_STORE=local, jobs/seed/reset=false. Baseline ưu tiên hàm pure, không đọc key trong .env. Người chạy xác nhận interpreter và PYTHONPATH; launcher .venv hỏng trên máy hiện tại là giới hạn môi trường, không thay contract portable bằng đường dẫn máy riêng.

Gọi batch Luna không thuộc lượt lập plan. Khi được cho phép, chỉ gửi synthetic text, tối đa1 lượt mỗi case ELIGIBLE/run; không retry mù. Lưu model/call status/latency/error, không key. Credit/quota chưa đo. Auth/timeout/rate-limit ⇒ ERROR, tiếp tục phần offline nếu phù hợp; không chạy mock rồi claim đo Luna.

## 3. Export và rollback

deliverables/ là staging. Seed/test cũ read-only. Export sau review/validator pass, hash mọi input/code/prompt/lexicon. Không tự merge, push hoặc tích hợp nhãn; bàn giao file/hash cho owner. Validator fail ⇒ giữ source/proposal/dispute, sửa annotation theo review và version lại gold; không xóa raw hoặc sửa output máy. Nhãn đã duyệt bị thay ⇒ dataset version mới và nhật ký quyết định, không ghi đè lịch sử.

## 4. Lỗi và caller

Thiếu file/schema ⇒ dừng export. Reviewer pending ⇒ giữ PROPOSED, không chạy gold metric. Runtime mismatch ⇒ giữ gold + issue. LLM lỗi ⇒ record riêng. Secret pattern ⇒ dừng chia sẻ, loại bí mật trước bàn giao. CẤM fixtures PostgreSQL có reset DB, jobs toàn nhóm hoặc tự gửi tin. Hồ sơ chỉ chuẩn bị bàn giao, chưa xác nhận nhóm đã nhận.

## 5. Bằng chứng

Commands/stdout/exit lưu evidence/<run>/, không sửa tay. Manifest có UTC, baseSHA, dirty/source hash, dataset/lexicon/model/prompt version. Task date05/10 không biến thành ngày review giả. Lượt plan chưa tạo dữ liệu80 câu hoặc report baseline PASS. Không phát hành/tăng version app; schema day05-1 và dataset version riêng.

## Nghiệm thu vận hành

Xong khi lệnh validator và baseline offline trả exit0, output có hash/version/exit thật; mọi mismatch vẫn được ghi vào report. Các gate online/LLM chưa chạy phải để mở, không suy từ baseline offline.

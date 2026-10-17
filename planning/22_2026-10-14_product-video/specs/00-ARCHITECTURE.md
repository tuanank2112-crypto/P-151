# 00 — Kiến trúc & bất biến video thuyết minh

## 1. Mục tiêu
1. Người xem chưa biết gì về dự án hiểu trong ~3 phút: **vấn đề** (phản ánh lẫn lộn, trùng, tin khẩn bị trôi) → **giải pháp** (Agent đọc hiểu, con người quyết) → **3 điểm mạnh** (đọc hiểu tiếng Việt tự nhiên · an toàn trước tiên · gộp trùng/tách việc) → **vòng khép kín** tới khi cư dân đánh giá.
2. Dùng được ngay ở buổi bàn giao 19/10 và đăng kèm tài liệu nộp.
3. Dựng lại được trong ≤ 30 phút khi UI đổi (mọi cảnh màn hình là kịch bản, không quay tay).

## 2. Non-goals
- Không thay video demo thao tác [`docs/demo/demo.mp4`](../../../docs/demo/demo.mp4); video cũ là phụ lục "xem chi tiết".
- Không quay trên Supabase dùng chung hay dữ liệu thật; không quảng cáo như sản phẩm đã vận hành.
- Không làm phiên bản tiếng Anh lồng tiếng (chỉ phụ đề tiếng Anh tuỳ chọn, 01-CONTRACTS §1).

## 3. Bất biến (BẮT BUỘC)
| # | Luật | Lý do |
|---|---|---|
| B1 | Góc màn hình luôn có nhãn **"Dữ liệu mô phỏng"** trong mọi cảnh quay UI | Dữ liệu `SIM-`; tránh hiểu nhầm là vận hành thật |
| B2 | **CẤM** hiện tên đăng nhập/mật khẩu (kể cả gõ ô mật khẩu). Cảnh bắt đầu ở trạng thái đã đăng nhập | Người dùng đã cấm lộ dữ liệu đăng nhập trên frontend (2026-10-10) |
| B3 | Mọi con số trên màn hình phải có nguồn đo trong repo (đường dẫn evidence ghi ở SPEC-P01 §4). **CẤM** số ước đoán ("giảm 70% thời gian…") | Không có số đo vận hành thật |
| B4 | Agent hiện đúng vai: **đề xuất/đọc hiểu**, con người (BPTN/BQL) quyết; **CẤM** nói "Agent tự xử lý/tự đóng/tự gỡ khẩn cấp" | Đúng thiết kế CR-03: Agent không bao giờ tự đóng hay gỡ khẩn cấp |
| B5 | Lời thoại, cảnh, thời lượng nằm trong file dữ liệu (`scenes.json`); sửa lời ⇒ chạy lại lệnh, không sửa tay trong phần mềm dựng | Dựng lại được (mục tiêu 3) |
| B6 | Phần trích dẫn của Agent chỉ hiện như "căn cứ để người kiểm tra", không trình bày như cơ chế quyết định | Plan 06 Q35: trích dẫn chỉ để audit |
| B7 | Mọi kết quả Agent trên hình (thẻ Agent, nghi trùng, tách đôi, phòng nhận) là kết quả LLM thật của lần quay, có bản ghi ở `evidence/V4/` | Người dùng chốt V04 "LLM thật" |
| B8 | Cảnh vẽ (không phải màn hình thật) luôn có nhãn "Minh hoạ" | Người xem phân biệt được đâu là sản phẩm thật |

## 4. Vùng cấm (đã cân nhắc, KHÔNG làm)
- **Không quay tay bằng OBS/Camtasia** — UI còn đổi tới 19/10, quay tay phải quay lại từ đầu.
- **Không dùng avatar AI nói (HeyGen/Synthesia)** — tiếng Việt khẩu hình kém, tạo cảm giác quảng cáo, tốn phí; giọng + UI đủ.
- **Không nhồi hết tính năng** (kho, định mức, đánh giá sao chi tiết…) — video thuyết minh chọn 3 điểm mạnh; chi tiết để video demo cũ.
- **Không dùng nhạc có bản quyền thương mại** — chỉ nguồn miễn phí bản quyền ghi rõ ở [SPEC-P03](SPEC-P03-RENDER.md) §5.

## 5. Thứ tự đọc
`SPEC-P01` (kịch bản) → `SPEC-P02` (giọng/hình/animation, đã chốt) → `SPEC-P03` (dựng từng khung) → `01-CONTRACTS` → `OPERATIONS` → `TESTING-ACCEPTANCE`.

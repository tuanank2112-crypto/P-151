# Nội dung Pitch Deck — MaintenanceOps Agent (10 slide, ~10 phút)

> Đây là **nội dung** để thiết kế slide, chưa phải file nộp. Deliverable #7 là `docs/pitch-deck.pdf` (10 trang, PDF, không dùng PowerPoint để tránh lỗi font) do nhóm thiết kế từ nội dung này. Cấu trúc theo [chương 9 §9.6](guide/chapter-09.md). Mọi con số bên dưới đã kiểm với dữ liệu thô trong repo ngày 2026-10-17; số nào đổi thì sửa lại ở đây trước khi xuất PDF.
> Quy tắc slide: một ý chính mỗi slide, ≤ 30 từ trên slide, chữ ≥ 24 pt, hình hơn chữ. "Ghi chú nói" là lời thuyết trình (~1 phút), không đưa lên slide.

## Slide 1 — Tiêu đề

- **Trên slide:** MaintenanceOps Agent · "Phản ánh hạ tầng chung đi đúng người, đúng mức an toàn, có truy vết." · Nhóm P-151: Lê Thị Châm Anh, Lê Như Ý, Cao Văn Trường, Võ Đức Trí · Demo Day AI20K.
- **Ghi chú nói:** giới thiệu tên, nhóm, một câu giá trị. Nói ngay: dữ liệu là mô phỏng.
- **Nguồn:** [README](../README.md).

## Slide 2 — Vấn đề

- **Trên slide:** Cư dân báo đèn hỏng, rác bẩn, mùi khét. Ban tiếp nhận phải đọc, phân loại, giao việc. Chậm thì dễ sót ca nguy hiểm.
- **Ghi chú nói:** ai gặp vấn đề (cư dân, ban tiếp nhận, phòng ban), vì sao khó (thiếu vị trí, một phản ánh chứa hai việc, trùng, ca nguy hiểm lẫn trong ca thường). **Không nói số liệu thực địa vì nhóm chưa có**; nói rõ đây là giả thuyết được kiểm bằng dữ liệu mô phỏng.
- **Nguồn:** [01_problem_statement.md](01_problem_statement.md) §A, §F. **Chỗ cần điền nếu có:** số ticket thật, thời gian xử lý thật (chưa có, xem [02_product_brief.md](02_product_brief.md) mục "Bối cảnh, đối thủ").

## Slide 3 — Giải pháp

- **Trên slide:** Agent kiểm tra an toàn trước, rồi phân loại, giao phòng ban; người quyết ở các điểm dừng.
- **Ghi chú nói:** sáu vai (Cư dân, Tiếp nhận, Vệ sinh, Kỹ thuật, Kho, BQL). Agent không đóng, không hủy, không gán nhân viên. Khác biệt: tầng an toàn chạy trước phân loại; mọi thao tác có audit.
- **Nguồn:** [03_lean_prd.md](03_lean_prd.md) §1–§3.

## Slide 4 — Sản phẩm (demo)

- **Trên slide:** 4 ảnh: Cư dân gửi phản ánh · Tiếp nhận phân loại · Phòng Kỹ thuật · BQL tổng quan. Một luồng: gửi → giao → xử lý → nghiệm thu.
- **Ghi chú nói:** đi theo một phản ánh "đèn hành lang tầng 12 tắt" qua 6 vai. Nhấn: cư dân thấy trạng thái đơn giản, nhân viên thấy thông tin theo quyền.
- **Nguồn:** ảnh ở [screenshots/](screenshots/README.md); luồng ở [04_ui_flow_wireframe.md](04_ui_flow_wireframe.md) §3.

## Slide 5 — Kiến trúc

- **Trên slide:** sơ đồ [Diagrams Components.svg](diagrams/Diagrams%20Components.svg) rút gọn: Portal Next.js + PWA → FastAPI → Engine (state machine, tầng an toàn) + Agent LangGraph → PostgreSQL/Supabase.
- **Ghi chú nói:** vì sao tách engine (luật, trạng thái, audit, fail closed) khỏi Agent (suy luận ngữ nghĩa). Nhắc **không dán nhãn "GPT-4o", "Phoenix", "LangSmith" như đã chạy**: đang chạy là `gpt-6-luna` và log tự ghi.
- **Nguồn:** [ARCHITECTURE.md](../ARCHITECTURE.md) §2, §10.

## Slide 6 — Cách tiếp cận AI

- **Trên slide:** Luật cố định = lưới sàn. Agent suy luận ngữ nghĩa, chỉ được **nâng** mức an toàn. Câu hỏi khó: 82/90 đúng.
- **Ghi chú nói:** bất biến của nhóm: ngữ nghĩa do LLM hiểu, không vá bằng regex. Ví dụ thật: "m ù i k h é t" (chữ tách) luật cho `NONE`, Agent nâng lên khẩn cấp. Ca Agent sai cũng nêu: `h03` ("tiếng nổ lớn từ phòng điện") chỉ cho `UNCLEAR`.
- **Số đã kiểm:** luật cố định 72/91 (79,1%) → Agent LLM 82/90 (91,1%); ca khẩn cấp 32/38 → 36/37; một lần chạy, bộ câu do nhóm viết.
- **Nguồn:** [evaluation.md](evaluation.md) §7.1; 8 trace thật: [ai-logs.md](ai-logs.md).

## Slide 7 — Điểm nổi bật kỹ thuật

- **Trên slide:** 3.852 test pass trong Docker Linux · coverage 92,0% · p95 một lượt gọi Agent 6,15 giây · ≈ 2.551 token/ticket · hơn 240 commit không tính merge trong 26 ngày.
- **Ghi chú nói:** chạy trong image Docker đã ghim phiên bản: 3.852 pass, 40 xfail (lỗi đã biết, có cờ), 102 test Postgres chạy riêng. Độ trễ đo trên máy dev, không gồm mạng người dùng. **Không nói "CI xanh"**: workflow có nhưng GitHub Actions bị chặn do billing của tổ chức.
- **Nguồn:** [evaluation.md](evaluation.md) §5, §7.3; [outputs-20261017/](eval/runs/outputs-20261017/).

## Slide 8 — Video demo

- **Trên slide:** QR/link video 3:29 + một khung hình. "6 vai, một phản ánh, một nơi theo dõi."
- **Ghi chú nói:** có video dự phòng khi demo trực tiếp lỗi. Nếu thêm ca khẩn cấp và ca thiếu vật tư vào video thì nhắc ở đây.
- **Nguồn:** [video-demo.md](video-demo.md). **Còn thiếu:** giới thiệu team, ca biên, link YouTube.

## Slide 9 — Thách thức và bài học

- **Trên slide:** 3 bài học: (1) đo trên nhãn tự viết không đáng tin → cần held-out; (2) để Agent hiểu nghĩa, không vá regex; (3) tài liệu phải bám code.
- **Ghi chú nói:** thách thức thật đã gặp, ghi trong changelog và journal: phiên đăng nhập trên serverless (token ký HMAC), kết nối DB hết slot (`MO_DB_POOL=none`), thời gian chờ Agent 16–20 giây. Nếu làm lại: đo held-out và user test sớm hơn.
- **Nguồn:** [brain4agent/changelog.md](../brain4agent/changelog.md) (v1.17.2, v1.17.3); [journal.md](journal.md) cho dòng thời gian từng tuần.

## Slide 10 — Team và bước tiếp theo

- **Trên slide:** vai trò 4 người · bước tiếp: held-out độc lập, user test 3–5 người, đo độ trễ trên bản online, Phoenix/LangSmith.
- **Ghi chú nói:** cảm ơn và Q&A.
- **Nguồn:** [README](../README.md) Team; [evaluation.md](evaluation.md) §8.

## Q&A: câu trả lời đã chuẩn bị (chương 9 §9.6)

| Câu BGK hay hỏi | Câu trả lời trung thực từ dữ liệu hiện có |
|---|---|
| Làm sao giảm hallucination? | Đầu ra Agent được kiểm với danh mục (tòa, tài sản, vật tư) rồi mới nhận; ca thật f04: Agent trích "Tòa S9" không tồn tại, hệ thống không nhận và dừng `NEED_INFO`. Chỉ số "không bịa" hiện 0/1, mẫu quá nhỏ. |
| Cost per request? | ≈ 4.250 token mỗi lượt gọi, ≈ 2.551 token mỗi ticket (36/90 ca luật sàn báo khẩn cấp nên không gọi Agent). **Chưa quy ra tiền** vì chưa có bảng giá `gpt-6-luna`. |
| Scale khi có 1000 người dùng đồng thời? | **Chưa đo.** Đã làm: cache danh sách theo `xmin`, `MO_DB_POOL=none` cho serverless, một job leader dùng advisory lock. Chưa có kiểm thử tải. |
| Tại sao LangGraph, không CrewAI/AutoGen? | ⬜ Nhóm điền lý do thật. Repo chưa có benchmark so sánh; không nói đã so sánh. |
| Ca nào Agent làm sai? | `h03` (tiếng nổ chỉ cho `UNCLEAR`) và `f04` (trích tòa không tồn tại); cổng recall khẩn cấp vì vậy chưa đạt, kết luận release hiện là "chưa đủ điều kiện". |
| Khi Agent lỗi thì sao? | Hệ thống không mất tin nhưng rơi về luật cố định, không tự gửi BQL (6/37 ca khẩn cấp khi model sai tên). Đây là giới hạn đã biết, chưa sửa. |

## Tuyên bố CẤM nếu chưa có bằng chứng mới

"Giảm X% thời gian xử lý", "đã chạy với cư dân thật", "an toàn đã nghiệm thu", "CI xanh", "Phoenix/LangSmith đang theo dõi", "chịu tải 1000 người", "độc lập/held-out đạt …".

## Việc còn lại để có `docs/pitch-deck.pdf`

- [ ] Thiết kế 10 slide từ nội dung này (nền tối, chữ sáng, ≥ 24 pt).
- [ ] Điền câu trả lời LangGraph vs CrewAI/AutoGen bằng lý do thật của nhóm.
- [ ] Chụp thêm ảnh/GIF cho slide 4 nếu cần.
- [ ] Tập 3 lần, canh 10 phút; chuẩn bị video dự phòng.
- [ ] Xuất PDF vào `docs/pitch-deck.pdf`; đối chiếu từng con số với evidence trước 18/10.

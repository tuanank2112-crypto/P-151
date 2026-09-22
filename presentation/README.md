# Pitch Deck & Demo Materials

## Files

- `pitch_deck.pptx` — Slide thuyết trình Demo Day
- `video_demo.mp4` — Video demo sản phẩm (tối đa 5 phút)

## Pitch Deck Structure (10 slides)

1. **Title** — Tên dự án ResidentGPT (Team P-151) — Trợ lý AI hai vai trò (Cư dân & BQL)
2. **Problem** — Cư dân ngại gọi hotline/Zalo cho việc hành chính nhỏ; BQL quá tải câu hỏi lặp lại và thiếu inbox quản lý tập trung cho ca khó
3. **Solution** — Trợ lý AI hai vai trò: Cư dân tự tra cứu có trích dẫn (RAG), BQL có Escalation Inbox; cơ chế tự động chuyển tuyến an toàn khi rủi ro cao hoặc độ tin cậy thấp
4. **Pilot Scope & Boundary** — Thí điểm thực tế tại **Cụm Sapphire 1 — Tòa S1.12, Vinhomes Ocean Park 1** (BQL Tòa S1.03, Hotline 1900 232 389 Nhánh 4); minh bạch giới hạn Knowledge Pack 1.18 (không suy rộng phí sạc ô tô điện, thi công chỉ áp dụng Căn Hộ)
5. **Architecture & Decision Flow** — System flow: Auth/RBAC → Scoped Memory → Query Rewrite → Risk/Context Gate → RAG (21 canonical docs) → Confidence Grader → Answer with Citations / Escalation Ticket
6. **Data Transparency & Governance** — 21 tài liệu canonical chuẩn hóa từ quy chế vận hành cư dân thực tế; minh bạch đây là tập dữ liệu thực nghiệm phục vụ pilot tòa nhà, không tự nhận là văn bản pháp lý toàn khu
7. **Traction & Validation** — Golden Dataset (50 FAQ, 30 E2E); Gate 3A (100% Zero-tolerance cho tính mạng, PII, bồi thường pháp lý), Gate 3B (M3 ≥ 90%); Checksum SHA-256 frozen
8. **Live Demo** — Live URL công khai: Demo 4 trạng thái (nhập liệu, loading, kết quả có citation, clarification card, escalation card & BQL Inbox)
9. **Team & Execution** — Senior AI Architect, AI Engineer, Fullstack Dev, Knowledge Curator
10. **Next Steps** — Triển khai pilot diện hẹp tại S1.12, thu thập feedback cư dân, mở rộng Knowledge Pack sau nghiệm thu MVP

## Video Demo Checklist

- [ ] Giới thiệu problem & pilot scope S1.12 (< 30 giây)
- [ ] Demo live feature Cư dân: Hỏi đáp có trích dẫn `document_id` + `section_id` (1 phút)
- [ ] Demo Chat Memory: Hỏi nối tiếp đa lượt qua Query Rewriter (1 phút)
- [ ] Demo Clarification & Escalation: Thiếu context hỏi lại; High Risk chuyển BQL Inbox (1 phút)
- [ ] Demo BQL Inbox: Đăng nhập quản lý, xem ticket, xem reason code, phản hồi (1 phút)
- [ ] Tóm tắt impact, tính minh bạch dữ liệu & độ an toàn Gate 3A (< 30 giây)

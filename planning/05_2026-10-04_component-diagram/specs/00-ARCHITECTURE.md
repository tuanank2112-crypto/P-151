# 00 — Architecture and scope

## 1. Mục tiêu và thứ tự đọc
Đầu ra là component diagram của MaintenanceOps target 19/10/2026, giúp sinh viên/giám khảo trả lời: ai dùng, ứng dụng kết nối gì, AI làm gì, luật và người kiểm soát ở đâu, dữ liệu/ảnh nằm đâu, Phoenix quan sát gì.
Đọc file này → 01-CONTRACTS → SPEC-P01-VISUAL → OPERATIONS → TESTING-ACCEPTANCE.
Trạng thái SPEC_APPROVED, artifact verified_local; duyệt spec đã ghi trong plan. Spec này không là thiết kế triển khai LangGraph/vision.

## 2. Architecture contract
- Một ứng dụng trên Render: Web App + Backend API (Authentication / RBAC) + MaintenanceOps core.
- LangGraph điều phối core; OpenAI cung cấp đề xuất AI; Maintenance Engine sở hữu state machine, quyền hành động, audit và retry/SLA jobs.
- Rules & Safety kiểm dữ liệu, tín hiệu an toàn và priority; Business Tools nhóm capabilities tra catalog/asset/stock/trùng. Đây là logical components trong cùng backend, không khẳng định là microservices.
- Human Review là capability dừng/chờ quyết định BPTN/BQL, thao tác qua Web/API và được Engine kiểm quyền; không phải một dịch vụ tự ghi DB.
- Supabase gồm PostgreSQL (cases/audit/outbox) và private Photo Storage. Browser truy cập qua API; không có đường browser → DB/bucket.
- Phoenix nhận telemetry từ Agent; không là business audit, không điều khiển state và không lưu hồ sơ thay Supabase.

## 3. Trạng thái và bất biến
BẮT BUỘC title: `MaintenanceOps — Component Architecture`; subtitle: `Target: 19 Oct 2026 · Simulated data`.
BẮT BUỘC phân biệt: LangGraph/Phoenix là cam kết mục tiêu theo người dùng, không chứng minh đã tích hợp runtime. Vision + lựa chọn GPT-4o là đề xuất, có nhãn `Proposed: GPT-4o + Vision` cạnh OpenAI.
BẮT BUỘC AI chỉ đưa đề xuất; Engine quyết định commit. Safety LLM không tự hạ risk; human override phải đúng quyền và có audit. Khi AI lỗi, không diễn giải fallback là bỏ safety/human gate.
CẤM nối LLM → Supabase/Engine bằng đường “approve/commit”; CẤM coi Phoenix logs là business audit; CẤM hiển thị model như đã deploy.

## 4. Vùng cấm và non-goals
- Không thêm RAG, vector store, chatbot, booking/payment hoặc hệ thống kho/điều phối thật: ngoài scope MaintenanceOps đã xác nhận.
- Không biến pipeline thành activity/swimlane diagram: sẽ làm mất cấu trúc components và tăng độ rối.
- Không vẽ từng phòng ban, từng bảng DB, endpoint, node LangGraph hoặc log IDE: không phục vụ thông điệp 30 giây.
- Không sửa code, API/DDL, CR-03 hoặc artifacts cũ; proposal vision không thay requirement ảnh bằng chứng.
- Không dùng diagram như bằng chứng online acceptance; không chứa credentials hoặc dữ liệu cư dân thật.

## 5. Nguồn và căn cứ
- Code base b937956: src/main.py, src/config.py, src/api/{auth,photos}.py, src/api/routers/maintenance.py; src/maintenance/{engine,rules,safety,priority,proposer,catalog,ai_logger}.py, store/; src/agents/graph.py; src/web/.
- Docs: docs/CR-BPTN-03.md §1, §5.1, §6, §17.1; docs/maintenance.md. Code đối chiếu chứng minh nền đang có, không chứng minh kiến trúc target đã xong.
- User confirmations 2026-10-04: LangGraph, Render/Supabase/OpenAI, Phoenix, human review; proposal vision/GPT-4o. CR-03 vẫn ghi AI ảnh ngoài scope: giữ nguyên khác biệt và gắn nhãn proposed.
- Sơ đồ cũ docs/architecture_diagram.md là legacy; docs/diagrams/* không ghi đè.

## 6. Phân loại lỗi và caller bắt buộc
- SCOPE_CONFLICT: nguồn cũ và xác nhận mới lệch → giữ CR hiện hành, ghi proposed/target; nếu cần sửa API/requirement phải xin quyết định riêng.
- UNSUPPORTED_CLAIM: component không có nguồn → bỏ hoặc đánh dấu proposed trước bàn giao.
- AUTHORITY_ERROR: đường nối cho AI quyền commit → chặn nghiệm thu, sửa theo §3.
- MISSING_DECISION: thiếu quyết định ảnh hưởng thông điệp → hỏi người dùng; không tự gán nhà cung cấp hay chức năng mới.

## 7. Bằng chứng nghiệm thu
Yêu cầu: 10 components; title/subtitle đúng; 0 RAG/vector nodes; 0 direct AI commit edges; 1 nhãn proposal rõ; đủ source notes. Số đo diagram đã có tại TESTING-ACCEPTANCE §6; chỉ user visual acceptance còn mở.

## Kết quả local — 2026-10-04T10:46:25+07:00
- Spec approved; draw.io/SVG đã dựng và đo. Native export31.7.0 exit0; 10 components/12 edges; 1920×1080; font20 minimum; 0 overlap/clipping/node crossing, 2 edge crossings; previews1280/960 đã mở.
- Bằng chứng chi tiết tại [TESTING-ACCEPTANCE](TESTING-ACCEPTANCE.md) §6; chưa có user visual sign-off. Yêu cầu và kết quả local được tách rõ; không coi local sign-off là user acceptance.

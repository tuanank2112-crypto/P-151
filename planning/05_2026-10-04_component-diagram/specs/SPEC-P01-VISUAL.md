# P01 — Visual design

## 1. Canvas và grid contract
Canvas 1920 × 1080 (16:9), safe margin ≥48 px; title ở y=40..92, subtitle y=96..126; nội dung y=165..935; legend/source cue y=970..1032.
Grid: Users x=48..248; Application x=280..1430; External services x=1480..1872.
Trong Application: Web/API bên trái (x=320..620); Core bên phải (x=680..1380). Core xếp Orchestrator phía trên, Engine giữa; Rules/Tools phía dưới; Human Review một khối riêng gần Orchestrator. Không dùng vị trí như thứ tự pipeline.
External stack: OpenAI trên, Supabase giữa, Phoenix dưới. Cho phép dịch node trong vùng để tối ưu đường nối; không thay semantics §01.

## 2. Shape/style contract
- Components: rounded rectangle, radius 10–14 px; không gradient/shadow/3D; kích thước ≥220 × 100 px; khoảng cách giữa node ≥28 px.
- Font: Arial hoặc font sans-serif hệ thống tương đương; title 36–40 px; labels 24–28 px; dòng phụ/edge/badge/legend ≥20 px; mỗi node ≤4 dòng, không mô tả tiếng Việt.
- Background #FFFFFF; text #172033; border/connector #64748B; neutral fill #F8FAFC. Một màu nhấn #2563EB và light fill #EFF6FF cho Orchestrator/OpenAI; không tô riêng từng tầng.
- Groups: nền trắng hoặc neutral rất nhạt, stroke mảnh; group label 20–22 px. Proposal badge neutral, dashed stroke, đọc được bằng chữ, không dựa riêng vào màu.
- Connector orthogonal, 1.5–2 px, arrowhead rõ; telemetry dotted; labels trên nền trắng. Không logo, icon trang trí hoặc màu đỏ/vàng/xanh theo trạng thái.

## 3. Quy tắc bố cục bắt buộc
BẮT BUỘC ≤2 giao cắt connector; 0 connector đi qua nội dung node; 0 text chồng nhau hoặc bị cắt; ≤2 dòng trên nhãn connector; không đường return gây rối. Khi không đạt, điều chỉnh vị trí/port, không tùy tiện xóa edge contract.
BẮT BUỘC cùng SVG đọc được ở 1280 × 720, bao gồm badge vision; ở README width 960 px, title/component labels và các nhãn quan trọng còn rõ.
Thứ bậc thị giác: title → Agent core → Web/API và external dependencies → supporting labels. AI nổi bằng một màu nhấn, không phóng đại quyền quyết định.

## 4. Vùng cấm và xử lý lỗi
- DENSE_LAYOUT: >2 giao cắt, đường xuyên chữ → sửa placement/ports; không giảm cỡ chữ dưới 20 px.
- UNREADABLE: chữ cắt/mờ ở preview → tăng khoảng trống hoặc rút nhãn theo contract, không bỏ proposed/target.
- COLOR_OVERLOAD: có >1 màu nhấn → đưa về palette §2; không dùng một màu cho mỗi component.
- SEMANTIC_STYLE: proposed nhìn như committed hoặc telemetry như command → sửa badge/legend và source notes.
- CẤM tách một hình thành nhiều page, dùng aspect gần vuông hoặc auto-layout không kiểm lại: người dùng đã bác hình rối và quá màu mè.

## 5. Bằng chứng nghiệm thu
Đo: 1920/1080 = 16/9; min label 20 px; ≥48 px safe margin; 0 clipped/overlap text; 0 line-through-node; ≤2 crossings. Preview 1280×720 và 960×540 được mở và ghi kết quả thực tế. Đã render và mở hai preview; kết quả local ở TESTING-ACCEPTANCE §6.

## Kết quả local — 2026-10-04T10:46:25+07:00
- Spec approved; draw.io/SVG đã dựng và đo. Native export31.7.0 exit0; 10 components/12 edges; 1920×1080; font20 minimum; 0 overlap/clipping/node crossing, 2 edge crossings; previews1280/960 đã mở.
- Bằng chứng chi tiết tại [TESTING-ACCEPTANCE](TESTING-ACCEPTANCE.md) §6; chưa có user visual sign-off. Yêu cầu và kết quả local được tách rõ; không coi local sign-off là user acceptance.

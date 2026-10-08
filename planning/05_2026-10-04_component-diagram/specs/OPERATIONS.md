# Operations — Author, export and handoff

## 1. Phạm vi và thứ tự
1. Người dùng duyệt SPEC, nhất là target/proposed và contract 10 nodes/12 edges.
2. Tạo directory đầu ra theo 01 §1; tạo draw.io XML có shapes/connectors native; giữ một page.
3. Mở draw.io để kiểm load, labels và connectors. Export SVG từ đúng file nguồn; nếu chưa có draw.io tool, chuẩn bị XML và báo thiếu export verification, không giả vờ đã mở.
4. Kiểm XML và semantic contracts; render SVG previews 1280×720/960×540, mở ảnh và sửa layout.
5. Ghi evidence bằng output máy; source notes liên kết nguồn và giải thích proposal/limitations; cập nhật gates.
6. Trình hai artifacts cho người dùng duyệt; chỉ sau duyệt mới nhúng README nếu được yêu cầu. Không deploy/push.

## 2. Export contract
Nếu máy có draw.io CLI, dùng `drawio --export --format svg --output <svg> <drawio>` với đường dẫn artifacts §01; kiểm trực tiếp exit 0 và visual match. Tool executable thực tế phải được tìm trước, không coi lệnh này là bằng chứng đã chạy.
SVG fixed page bounds 1920×1080, không crop content sang aspect khác. Font hệ thống; embed images không cần vì không dùng images. XML nguồn là single source of truth; sửa SVG riêng bị cấm.
README embed dự kiến: `![MaintenanceOps target component architecture](docs/diagrams/maintenanceops-target-20261019/architecture-components.svg)`; cần xem ở độ rộng 960 px trước tích hợp.

## 3. Source notes và mô hình vận hành
Notes BẮT BUỘC: target 19 Oct 2026; simulated data; LangGraph/Phoenix là target; GPT-4o + vision proposed; HITL qua Web/API; telemetry do instrumentation trong ứng dụng gửi Phoenix; Rules fallback không thay human/safety; assets/stock mô phỏng; chưa có bằng chứng deploy online.
Retry/SLA nằm trong Engine, không thêm Celery/external scheduler. Không coi session auth in-memory hiện tại là thiết kế đã được nâng cấp persistence. Tracing target không khẳng định client Phoenix hiện đã nối.

## 4. Lỗi và caller
- TOOL_MISSING: ghi công cụ/lệnh chưa có; tìm export bằng draw.io UI nếu khả dụng; vẫn giữ gate export pending nếu chưa kiểm.
- EXPORT_FAILED / FONT_DRIFT: giữ nguồn, sửa môi trường/font rồi export lại; không bàn giao SVG lỗi.
- UNSAFE_REMOTE: nếu cần push/deploy hoặc gửi dữ liệu ra dịch vụ, dừng hỏi bằng lời; công việc này chỉ cần local artifacts.
- STALE_SOURCE: code/target đổi trước 19/10 → đối chiếu lại claims, cập nhật SPEC với quyết định có timestamp rồi export lại.

## 5. Rollback và vùng cấm
Không thay bản cũ docs/diagrams/claude, antigravity hoặc namespace commit cũ. Nếu bản mới bị bác, giữ status draft/rework, không nhúng vào root README. Không xóa artifacts/file hàng loạt khi chưa được phép. Không sửa engine/API/requirements hoặc version để xuất hình.

## 6. Nghiệm thu vận hành
1 file draw.io mở lại không lỗi; 1 SVG export exit 0; 2 previews đã mở; notes đủ các mục §3; git diff --check exit 0. Các số đo local đã có ở TESTING-ACCEPTANCE §6.

## Kết quả local — 2026-10-04T10:46:25+07:00
- Spec approved; draw.io/SVG đã dựng và đo. Native export31.7.0 exit0; 10 components/12 edges; 1920×1080; font20 minimum; 0 overlap/clipping/node crossing, 2 edge crossings; previews1280/960 đã mở.
- Bằng chứng chi tiết tại [TESTING-ACCEPTANCE](TESTING-ACCEPTANCE.md) §6; chưa có user visual sign-off. Yêu cầu và kết quả local được tách rõ; không coi local sign-off là user acceptance.

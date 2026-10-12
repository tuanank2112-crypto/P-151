# 01 — Components, connections and artifacts

## 1. File contract
Đầu ra trong `docs/diagrams/maintenanceops-target-20261019/`:
- `architecture-components.drawio`: XML UTF-8 không nén, một mxfile/diagram/mxGraphModel, diagram name `Components`, page 1920 × 1080; labels/shapes/connectors đều chỉnh sửa được.
- `architecture-components.svg`: vector cùng nội dung và bố cục, viewBox 0 0 1920 1080, nền trắng; giữ text dưới dạng text, không raster hóa toàn hình, không liên kết asset mạng.
- `README.md`: hướng dẫn mở/export, nguồn, scope target/proposed, giới hạn và cách nhúng. Không sửa README root khi chưa được duyệt hình.
Contract không thêm/chỉnh endpoint, function signature hoặc schema ứng dụng. IDs bên dưới là mxCell IDs cố định.

## 2. Node contract · đúng 10 components
- `web` — `Web App`: UI dùng chung cho các vai; dòng phụ `Resident · Staff · Management`.
- `api` — `Backend API`: FastAPI; dòng phụ `Authentication · RBAC`.
- `orchestrator` — `Agent Orchestrator`: LangGraph; dòng phụ `AI proposals · Workflow`.
- `engine` — `Maintenance Engine`: state/commit; dòng phụ `State machine · Audit · SLA jobs`.
- `rules` — `Rules & Safety`: validation/safety/priority; không gắn LLM bên trong.
- `tools` — `Business Tools`: dòng phụ `Catalog · Assets · Stock · Duplicates`; nhóm logical capabilities, không tuyên bố bốn external APIs.
- `review` — `Human Review`: dòng phụ `Pause · Review · Resume`; capability của Operations Staff/Management qua UI/API.
- `openai` — `OpenAI`: dòng phụ `LLM proposals`; badge riêng `Proposed: GPT-4o + Vision`. Text classification là scope mục tiêu; image understanding là proposal bổ sung.
- `supabase` — `Supabase`: hai dòng phụ `PostgreSQL: Cases · Audit` và `Storage: Photos`; outbox thuộc PostgreSQL, giải thích ở source notes, không thêm khối notification provider.
- `phoenix` — `Phoenix`: dòng phụ `AI Traces · Evaluation`; tracing/eval là vùng quan sát AI, không vẽ monitoring cho mọi API call khi chưa chốt.

Actor cell `actors` (không tính component): `Resident`, `Operations Staff`, `Management`, ba nhãn trong một nhóm `Users`.
Boundary `render` chứa web/api/core, label `Application · Render`; boundary `core` chứa orchestrator/engine/rules/tools/review, label `MaintenanceOps Core`. Boundary là nhóm logical, không thêm deployment services.

## 3. Edge contract · đúng 12 edges
Hướng mũi tên biểu diễn caller → dependency, không phải mọi chiều request/response. Không thêm return arrows.
- `e01`: actors → web; không nhãn.
- `e02`: web → api; `HTTPS`.
- `e03`: api → orchestrator; `Process ticket`.
- `e04`: api → engine; `Authorized actions`.
- `e05`: orchestrator → engine; `Guarded execution`.
- `e06`: engine → rules; `Validate`.
- `e07`: engine → tools; `Lookup`.
- `e08`: orchestrator → review; `Pause / resume`; quan hệ logical HITL, không remote callback. Quyết định thật quay qua e04; không thêm bypass review → DB.
- `e09`: orchestrator → openai; `AI proposals`; cả text và vision proposed dùng cùng connector, badge vision thể hiện scope chưa chốt, không vẽ thêm hai đường.
- `e10`: engine → supabase; `Cases · Audit`.
- `e11`: api → supabase; `Photo I/O`; chỉ phần Storage của node.
- `e12`: orchestrator → phoenix; `Traces · LLM spans`; instrumentation/client trong ứng dụng gửi telemetry, không phải OpenAI server gọi Phoenix.

Không tạo return arrows hoặc connector OpenAI → Phoenix; telemetry Agent/LLM gộp trên một đường.

## 4. Semantics và vùng cấm
Solid: call/dependency (e01–e11). Dotted: telemetry (e12). Dashed outline: proposal badge, không có dependency riêng. Legend tối đa ba mục: `Dependency`, `Telemetry`, `Proposed`.
BẮT BUỘC source notes giải thích logical HITL và client-side tracing; CẤM vẽ direct users → engine/DB, OpenAI → Engine/DB hoặc Supabase → Phoenix; CẤM thêm control-flow diamonds.

## 5. Lỗi và caller
- DUPLICATE_ID / UNKNOWN_ENDPOINT: dừng export; sửa XML, giữ đúng IDs.
- NODE_COUNT / EDGE_COUNT: đối chiếu §2/§3; 10 components, 12 edges, không đếm groups/badges/legend.
- SEMANTIC_EDGE: source/target sai quyền hoặc provider→Phoenix → chặn bàn giao, sửa về dependency/client telemetry.
- ARTIFACT_DRIFT: draw.io và SVG khác nhãn/bố cục → export lại từ draw.io, không sửa SVG riêng.

## 6. Nghiệm thu
Đo XML: IDs/nhãn đúng 10/10; edges đúng 12/12 và endpoints; một page; SVG parse được; không external resources, bitmap toàn hình hoặc credentials. Artifact đã dựng; số đo thật tại evidence/build và TESTING-ACCEPTANCE §6.

## Kết quả local — 2026-10-04T10:46:25+07:00
- Spec approved; draw.io/SVG đã dựng và đo. Native export31.7.0 exit0; 10 components/12 edges; 1920×1080; font20 minimum; 0 overlap/clipping/node crossing, 2 edge crossings; previews1280/960 đã mở.
- Bằng chứng chi tiết tại [TESTING-ACCEPTANCE](TESTING-ACCEPTANCE.md) §6; chưa có user visual sign-off. Yêu cầu và kết quả local được tách rõ; không coi local sign-off là user acceptance.

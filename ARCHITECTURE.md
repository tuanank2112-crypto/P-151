# ResidentGPT — trạng thái kiến trúc và tài liệu thiết kế

## Đã có trong code tại 23/09/2026

Repo có khung FastAPI (`src/main.py`, `src/api/routes.py`), LangGraph mẫu (`src/agents/graph.py`, `src/agents/state.py`) và cấu hình model. Node và search tool còn trả kết quả ví dụ; chưa có retrieval trên Knowledge Pack, auth/RBAC hai vai trò, conversation persistence, BQL UI, ingestion runtime, HITL, eval/dashboard. `ChatResponse.analysis` của template hiện được trả ra API; implementation ResidentGPT cần dùng response contract không lộ phân tích nội bộ.

## Kiến trúc mục tiêu

- [Sơ đồ và ranh giới MVP v0.3](docs/architecture_diagram.md) mô tả baseline frozen, không phải bằng chứng đã deploy.
- [Kiến trúc và hợp đồng v0.4](docs/extension_v0.4/AGENT_ARCHITECTURE_AND_CONTRACTS.md) mô tả coordinator, classifier, retriever, composer, verifier, evidence snapshot, API/event contracts và error path.
- [Quản trị tài liệu và HITL](docs/extension_v0.4/KNOWLEDGE_GOVERNANCE_AND_HITL.md) mô tả parser/OCR, version/publish, answer review và support handoff.
- [PRD v0.4](docs/extension_v0.4/PRD_ResidentGPT_v0.4.md), [UI Flow](docs/extension_v0.4/UI_FLOW.md), [eval/dashboard](docs/extension_v0.4/EVAL_METRICS_DASHBOARD.md) và [backlog](docs/extension_v0.4/DELIVERY_BACKLOG.md) là nguồn giao việc.

Các quyết định về DB, vector store, OCR/parser provider, frontend framework và deployment provider cần được chốt qua implementation và decision log. `src/config.py` có `database_url`/`chroma_persist_dir` mặc định, còn database/vector packages trong `requirements.txt` đang comment; không suy ra đã có DB/vector index chạy được.

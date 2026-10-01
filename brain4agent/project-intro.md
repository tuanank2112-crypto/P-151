# Giới Thiệu Dự Án (Project Overview)

## 1. Mục tiêu (Goals & Objectives)
Repo P-151 (AI20K Build Phase) xây **MaintenanceOps Agent** cho BQL một cụm dân cư, chạy trên **dữ liệu mô phỏng** (`SIM-*`), không phải vận hành thật. Cư dân gửi phản ánh về vệ sinh khu vực chung (`PB-CLN-01`) hoặc đèn chiếu sáng khu vực chung (`PB-TEC-01`). Agent kiểm tra dữ liệu, chạy tầng an toàn hai bậc, phát hiện trùng, phân loại và đề xuất phòng ban + mức ưu tiên, tra asset/vật tư rồi giao phòng ban. Phòng ban thực hiện và nộp hồ sơ; BQL kiểm duyệt, đóng hoặc trả làm lại. Agent dừng đúng chỗ cần con người (BPTN, BQL) và không bao giờ tự đóng hay gỡ khẩn cấp.

- **Spec đích duy nhất:** [`docs/CR-BPTN-03.md`](../docs/CR-BPTN-03.md). CR-BPTN-01/02 đã bỏ ngày 2026-10-01.
- **Vai trò:** Cư dân · Agent · BPTN (bộ phận tiếp nhận) · Phòng ban (Vệ sinh/Kỹ thuật) · Kho (actor mô phỏng) · BQL.
- **Mốc:** MVP online 04/10/2026; bàn giao đủ 10 deliverables 19/10/2026 (kế hoạch nhóm trên Notion "Kế hoạch MaintenanceOps MVP").
- Hướng ResidentGPT (hỏi-đáp nội quy, `Problem_Card.md` trên `main`) là hướng cũ, không còn dùng.

## 2. Công nghệ cốt lõi (Tech Stack)
- **Frontend / Web:** UI tĩnh `src/web/` (index.html, app.js), FastAPI phục vụ chung; đăng nhập tài khoản mô phỏng theo vai trò.
- **Backend / Engine:** Python 3.11, FastAPI, Pydantic. Lõi `src/maintenance/`: `engine.py` (state machine + pipeline), luật `rules.py` + LLM `proposer.py` (LangChain/OpenAI; `LLM_MODE=mock` cho test). LangGraph ở `src/agents/` vẫn là mẫu; kế hoạch đưa lên đường chạy thật trước 19/10.
- **Data Persistence:** chưa có — in-memory, nạp lại seed YAML khi khởi động; ảnh lưu đĩa tại `MO_UPLOAD_DIR`. Kế hoạch MVP: PostgreSQL + Storage trên Supabase, deploy Render.
- **Kiểm thử và vận hành:** pytest, ruff, Docker Compose, GitHub Actions.

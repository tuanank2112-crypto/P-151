# Giới Thiệu Dự Án (Project Overview)

## 1. Mục tiêu (Goals & Objectives)
P-151 — **MaintenanceOps Agent**: prototype **mô phỏng** (dữ liệu giả, không vận hành thật) giúp BQL tòa nhà xử lý phản ánh
bảo trì khu vực chung một cách nhất quán, truy vết được, không vượt quyền.

- Cư dân gửi phản ánh → Agent chạy pipeline bước 2–8: kiểm dữ liệu, phát hiện trùng, phân loại (vệ sinh `PB-CLN-01` /
  đèn khu vực chung `PB-TEC-01`), BPTN review có điều kiện, tra asset, kiểm vật tư, chuyển phòng ban.
- Phòng ban nhận việc → checklist, vật tư, ghi chú, ảnh → báo hoàn thành → Agent đối soát bước 10 → BQL nghiệm thu.
- 10 trạng thái công khai (CR-BPTN-02, v0.5 candidate); mỗi điểm dừng là một `blocker` có owner, retry, leo thang.
- Mọi thao tác có audit; từ chối quyền = `ACTION_DENIED` + audit; lỗi ghi audit = fail closed.

Baseline tài liệu: `docs/01`–`05`, `docs/data-contract-v1.md`, `docs/playbook-v1.md`, `docs/CR-BPTN-01.md`, `docs/CR-BPTN-02.md`.

## 2. Công nghệ cốt lõi (Tech Stack)
- **Frontend / Web:** HTML tĩnh + Tailwind CDN (`src/web/`), mount tại `/ui`, chỉ gọi API.
- **Backend / Engine:** Python 3.11, FastAPI; engine thuần Python (`src/maintenance/engine.py`); LLM tùy chọn qua
  LangChain `ChatOpenAI` (OpenAI/OpenRouter), `LLM_MODE=mock` = chỉ luật cố định.
- **Data Persistence:** fixture YAML (`seed/maintenance_v1/`), giữ **in-memory**, reset được; ảnh lưu đĩa tại
  `MO_UPLOAD_DIR`. PostgreSQL 16 có trong docker-compose nhưng **chưa dùng**.
- **DevOps:** Docker Compose, GitHub Actions (ruff + pytest).

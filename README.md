# P-151 — MaintenanceOps Agent

> Prototype **mô phỏng** theo baseline v0.3 (`docs/01`–`05`, `docs/data-contract-v1.md`, `docs/playbook-v1.md`).
> Toàn bộ dữ liệu, quy trình, định mức và kết quả là mô phỏng, không phải vận hành thật.

## Vấn đề

BQL cần tạo và kiểm tra hồ sơ bảo trì một cách nhất quán, truy vết được và không vượt quyền, để mỗi case
đủ điều kiện được chuyển BQL xem xét hoặc dừng đúng ở bước xác minh/ngoại lệ.

## Giải pháp

- **Phân loại**: Agent đề xuất playbook vệ sinh (`PB-CLN-01`) hoặc đèn khu vực chung (`PB-TEC-01`) bằng luật cố định
  + LLM; phát hiện tín hiệu rủi ro (chất lạ nguy hại, mùi khét, tia lửa, dây hở) → `EXCEPTION` cho BQL.
- **BPTN xác nhận** loại việc và vị trí trước khi tạo draft.
- **Route cấp team**: tra asset (kỹ thuật), tồn kho, lịch trực và sức chứa → route tới `SIM-TEAM-*`, không gán cá nhân.
- **Kiểm tra hồ sơ**: checklist, vật tư (3 phép đối soát), evidence tối thiểu; đủ 8 gate → `READY_FOR_REVIEW`.
- Bốn state: `IN_PROGRESS`, `CHỜ XÁC MINH`, `READY_FOR_REVIEW`, `EXCEPTION`; mọi thao tác có audit.

## Tech Stack

| Lớp | Công nghệ |
|---|---|
| Agent | Luật cố định + LLM đề xuất (LangChain, `gpt-4o-mini` qua OpenAI/OpenRouter) |
| Backend | FastAPI + Python 3.11 |
| Dữ liệu | Fixture YAML mô phỏng, giữ in-memory và reset được (PostgreSQL 16 có sẵn trong compose, chưa dùng) |
| DevOps | Docker Compose + GitHub Actions |
---

## Chạy dự án bằng Docker (khuyến nghị)

Cả team chạy bằng Docker để có cùng phiên bản Python, PostgreSQL và thư viện, tránh lỗi
"máy tôi chạy được".

### Yêu cầu

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/macOS) hoặc
  Docker Engine + Compose plugin (Linux). Kiểm tra: `docker compose version`.
- Git.
- Trên Windows: bật WSL 2 khi Docker Desktop hỏi.

### 1. Clone repo

```bash
git clone https://github.com/<ORG-CỦA-KHOÁ>/<MÃ-ĐỘI>.git
cd <MÃ-ĐỘI>
```

### 2. Tạo file `.env`

```bash
cp .env.example .env              # Windows PowerShell: Copy-Item .env.example .env
```

Mở `.env` và điền:

| Biến | Bắt buộc | Lấy ở đâu |
|---|---|---|
| `LLM_MODE` | Không | `mock` (mặc định, chỉ luật cố định) hoặc `openai` (bật LLM đề xuất) |
| `OPENAI_API_KEY` | Khi `LLM_MODE=openai` | Key OpenAI hoặc OpenRouter của team |
| `OPENAI_BASE_URL` | Khi dùng OpenRouter | `https://openrouter.ai/api/v1` |
| `AI_LOG_API_KEY` | Có | Mỗi người tự tạo tại [dashboard Phoenix](https://phoenix.note.transformerlabs.ai/api-keys) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Không | Để mặc định khi chạy local |
| `LANGCHAIN_API_KEY` | Nên có | [LangSmith](https://smith.langchain.com) — dùng cho AI logs (deliverable #4) |

> Không commit file `.env` (đã có trong `.gitignore`). Gửi key cho nhau qua kênh riêng,
> không dán vào repo hay group chat công khai.

### 3. Khởi động

```bash
docker compose up -d --build      # hoặc: make up
```

Lệnh này build image backend, tạo container PostgreSQL và chạy backend sau khi database
đã sẵn sàng.

Kiểm tra:

- Health check: <http://localhost:8000/health> → `{"status":"ok",...}`
- Swagger UI: <http://localhost:8000/docs>
- Trạng thái container: `docker compose ps` (cả `db` và `backend` phải `healthy`)

### 4. Các lệnh thường dùng

| Việc cần làm | Lệnh | Make |
|---|---|---|
| Khởi động / build lại sau khi sửa code | `docker compose up -d --build` | `make up` |
| Xem log backend | `docker compose logs -f backend` | `make logs` |
| Dừng (giữ dữ liệu DB) | `docker compose down` | `make down` |
| Mở psql | `docker compose exec db psql -U p151 -d p151` | `make db-shell` |
| Chạy test trong container | `docker compose exec backend pytest tests/ -v` | |
| Xoá sạch DB, làm lại từ đầu | `docker compose down -v` | |

> ⚠️ `docker compose down -v` **xoá toàn bộ dữ liệu PostgreSQL** (volume `pgdata`).
> Chỉ dùng khi muốn reset DB.

Container backend **không** tự reload khi sửa code — chạy lại `make up` để build lại.
Nếu cần hot reload, xem mục "Chạy backend ngoài Docker" bên dưới.

### 5. Kết nối database từ máy

PostgreSQL được mở ra cổng `5432` trên máy host, dùng được với DBeaver, pgAdmin, TablePlus:

| Host | Port | User | Password | Database |
|---|---|---|---|---|
| `localhost` | `5432` | `p151` | `p151` | `p151` |

Nếu máy đã có PostgreSQL khác chiếm cổng 5432, đặt `POSTGRES_PORT=5433` trong `.env`
rồi `make up` lại.

---

## Chạy backend ngoài Docker (tuỳ chọn, để hot reload)

Vẫn dùng PostgreSQL trong Docker, chỉ chạy backend trực tiếp trên máy:

```bash
docker compose up -d db                       # chỉ chạy database

python3.11 -m venv .venv
source .venv/bin/activate                     # Windows: .venv\Scripts\activate
pip install -r requirements.txt

uvicorn src.main:app --reload --port 8000     # hoặc: make run
```

`DATABASE_URL` trong `.env` mặc định trỏ tới `localhost:5432`, nên backend chạy ngoài
Docker vẫn kết nối được với database trong Docker.

> Nếu `make up` đang chạy backend trong Docker thì cổng 8000 đã bị chiếm — dừng bằng
> `docker compose stop backend` trước.

---

## Bắt buộc với mỗi thành viên: cài hook ghi log AI

Khoá học chấm điểm dựa trên log sử dụng công cụ AI. Chạy **một lần** sau khi clone
(chạy trên máy, không phải trong Docker):

```bash
bash scripts/setup_hooks.sh                                      # Linux / macOS / Git Bash
powershell -ExecutionPolicy Bypass -File scripts\setup_hooks.ps1 # Windows PowerShell
```

On Windows, the Codex hook uses `commandWindows` and the repository Git root,
so it also works when Codex starts in a subdirectory. If Codex reports that the
hook is new or changed, open `/hooks` in Codex and review/trust the two logging
hooks once. The Windows launcher first tries the project virtual environment,
then installed Python interpreters, and finally a PowerShell fallback.

Chạy một lần sau khi clone. Hook ghi lại prompt khi bạn dùng Claude Code, Cursor,
Codex CLI, Gemini CLI, Antigravity hoặc GitHub Copilot, và cài pre-push hook để
đẩy log lên server.

### 5. Chạy server

```bash
bash scripts/_pyrun.sh scripts/log_manual.py --tool chatgpt --prompt "Nội dung đã hỏi"
```

---

## Xử lý sự cố thường gặp

| Triệu chứng | Cách xử lý |
|---|---|
| `failed to connect to the docker API` / `Cannot connect to the Docker daemon` | Docker Desktop chưa chạy — mở Docker Desktop và đợi báo "Engine running" |
| `port is already allocated` (5432 hoặc 8000) | Đổi `POSTGRES_PORT` / `APP_PORT` trong `.env`, hoặc tắt chương trình đang dùng cổng đó |
| `env file .env not found` | Chưa tạo `.env` — làm lại bước 2 |
| Backend báo lỗi kết nối DB | Xem `docker compose ps`; nếu `db` chưa `healthy` thì xem `docker compose logs db` |
| Sửa code nhưng không thấy thay đổi | Chạy `make up` để build lại image |
| Thêm thư viện vào `requirements.txt` | Chạy `make up` để build lại; thành viên khác cũng cần `make up` sau khi pull |
| Đổi `POSTGRES_USER` / `POSTGRES_PASSWORD` nhưng không có tác dụng | Postgres chỉ đọc các biến này lần đầu tạo volume — `docker compose down -v` rồi `make up` (mất dữ liệu) |

---

## Cấu trúc thư mục

```
src/
  maintenance/       Core v0.3: models, rules, proposer (LLM), resolver, engine, demo/evaluate
  api/routers/maintenance.py  Endpoints /api/v1/mo
  agents/, api/routes.py      Code mẫu LangGraph + endpoint chat của template (không dùng trong flow)
  config.py          Cấu hình (đọc từ .env)
  main.py            App entry point
tests/test_maintenance/  pytest cho fixture, engine, resolver, proposer, API
seed/maintenance_v1/     Catalog mô phỏng + 12 ticket kèm expected outcome
docs/                Tài liệu, architecture diagram, Technical Guidebook
eval/                Kết quả evaluation
presentation/        Slide, video Demo Day
Dockerfile           Image backend (multi-stage)
docker-compose.yml   Backend + PostgreSQL
```

## API (v0.3)

Code theo tài liệu baseline v0.3 (`docs/01`–`05`, `docs/data-contract-v1.md`, `docs/playbook-v1.md`) nằm ở
`src/maintenance/`, API dưới prefix `/api/v1/mo`. Toàn bộ dữ liệu là **mô phỏng**, giữ in-memory và reset được.

- Hai playbook: `PB-CLN-01` (vệ sinh khu vực chung), `PB-TEC-01` (đèn khu vực chung không hoạt động).
- Bốn state: `IN_PROGRESS`, `CHỜ XÁC MINH`, `READY_FOR_REVIEW`, `EXCEPTION`. Không có trạng thái đóng/nghiệm thu.
- Route chỉ tới team `SIM-TEAM-*` (`TEAM_ONLY`, `assignee_id=null`) sau khi qua asset (chỉ kỹ thuật), tồn kho và lịch trực.
- Fixture: `seed/maintenance_v1/catalog.yaml` (asset, duty, vật tư, checklist, evidence) và `tickets.yaml`
  (12 ticket, 4 demo flow + 8 regression, kèm expected outcome).
- Người gọi xác định bằng header `X-Actor-Id`: `SIM-ACTOR-BPTN-01`, `SIM-ACTOR-EXEC-01`, `SIM-ACTOR-BQL-01`, `SIM-ACTOR-AGENT`.

| Method | Path | Actor | Việc làm |
|---|---|---|---|
| POST | `/mo/reset` | (demo nội bộ) | Nạp lại 12 ticket fixture, run ID mới |
| POST | `/mo/evaluate` | (demo nội bộ) | Reset, chạy cả 12 ticket, so với expected outcome |
| POST | `/mo/demo/{ticket_id}` | (demo nội bộ) | Chạy các bước kịch bản của một ticket fixture |
| GET | `/mo/tickets`, `/mo/tickets/{id}`, `/mo/tickets/{id}/audit` | — | Work queue, chi tiết case, audit |
| POST | `/mo/tickets` | — | Tiếp nhận ticket mô phỏng mới; Agent đề xuất playbook + chạy luật rủi ro |
| POST | `/mo/tickets/{id}/confirm` | BPTN | Xác nhận service/type/location → Agent lookup, tạo draft, đề xuất route |
| POST | `/mo/tickets/{id}/checklist/{item}` | Nhân sự thực hiện | Cập nhật checklist |
| POST | `/mo/tickets/{id}/materials/{item_code}` | Nhân sự thực hiện | Nhập vật tư xuất/dùng, lý do chênh lệch |
| POST | `/mo/tickets/{id}/evidence` | Nhân sự thực hiện | Thêm processing/result note (ảnh không bắt buộc) |
| POST | `/mo/tickets/{id}/exceptions/{exc_id}/resolve` | BQL | Ghi resolution cho exception |
| POST | `/mo/tickets/{id}/handoff` | BPTN/Agent | "Chuyển BQL xem xét" khi `READY_FOR_REVIEW` |
| POST | `/mo/tickets/{id}/attempt` | bất kỳ | Thử hành động ngoài quyền → luôn `ACTION_DENIED` + audit |

**Phân loại bằng LLM** (`src/maintenance/proposer.py`): đặt `LLM_MODE=openai` trong `.env` (kèm
`OPENAI_BASE_URL=https://openrouter.ai/api/v1` nếu dùng key OpenRouter). LLM chỉ đề xuất service/type và
tín hiệu rủi ro; luật cố định vẫn chạy song song:
- luật và LLM không thống nhất playbook → `CHỜ XÁC MINH`, không đoán;
- tín hiệu rủi ro lấy mức nặng hơn của luật và LLM, nên LLM không làm mất exception mà luật đã thấy;
- LLM báo `PRESENT` phải trích nguyên văn từ phản ánh, không có thì hạ xuống `UNCLEAR`;
- LLM lỗi/hết quota → tự dùng luật; mỗi ticket chỉ gọi LLM một lần, audit ghi `proposer`.
`LLM_MODE=mock` (mặc định, và luôn dùng trong test) chỉ chạy luật, kết quả cố định.

Demo nhanh trên Swagger: `POST /mo/demo/SIM-TKT-CLN-001` (flow 1), `SIM-TKT-CLN-002` (flow 2),
`SIM-TKT-TEC-001` (flow 3), `SIM-TKT-TEC-002` (flow 4); `POST /mo/evaluate` để xem 12/12.

## Tài liệu

- Technical Guidebook: `docs/guide/` hoặc <https://phoenix.note.transformerlabs.ai/technical-book>
- Kiến trúc: `ARCHITECTURE.md`, `docs/architecture_diagram.md`
- Quy ước đóng góp: `CONTRIBUTING.md`

## Deliverables Checklist

- [x] Source Code (GitHub)
- [x] README.md
- [ ] Architecture Diagram (`docs/architecture_diagram.md`)
- [x] AI Logs (auto-collected)
- [ ] Live URL / Deploy
- [ ] Video Demo
- [ ] Pitch Deck (`presentation/`)
- [ ] Weekly Journal (`JOURNAL.md`)
- [ ] Worklog (`WORKLOG.md`)
- [ ] Evaluation Evidence (`eval/results/`)

## Team

| Thành viên | Vai trò | MSSV |
|---|---|---|
| [Tên] | [Vai trò] | [MSSV] |
| [Tên] | [Vai trò] | [MSSV] |
| [Tên] | [Vai trò] | [MSSV] |

## License

MIT

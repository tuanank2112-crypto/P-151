# P-151 — Resident Ticket Routing Agent

> **ResidentGPT project docs:** [bản đồ tài liệu](docs/README.md) dẫn tới baseline MVP v0.3 và đặc tả mở rộng v0.4 cho demo 04/10/2026. Phần còn lại của README này là hướng dẫn template; trạng thái triển khai thực tế được ghi trong [ARCHITECTURE.md](ARCHITECTURE.md).

Template chính thức cho học viên VinUni AI20K Build Phase: cấu trúc dự án, code
mẫu và hướng dẫn kỹ thuật để xây dựng một AI Agent hoàn chỉnh — từ kiến trúc,
code, test cho đến deploy và nộp bài Demo Day.

## Vấn đề

BQL nhận phản ánh sự cố (đèn hỏng, thang máy, điện nước, ...) từ cư dân qua nhiều kênh và
phải đọc, phân loại, xác minh rồi giao việc thủ công cho kỹ thuật. Việc này chậm, dễ sót
và phụ thuộc vào người điều phối.

## Giải pháp

- **Phân loại ticket**: loại sự cố, vị trí, mức khẩn cấp (LLM có vision).
- **Kiểm tra bằng chứng**: ticket sửa chữa phải có ảnh khớp với mô tả.
- **Chuyển tiếp tự động**: đủ điều kiện → tạo work order và báo kỹ thuật qua Zalo Bot.
- **Chuyển BQL**: thiếu thông tin, mơ hồ, hoặc ca an toàn (kẹt thang máy, chập điện, ...).

## Tech Stack

| Lớp | Công nghệ |
|---|---|
| AI Agent | LangGraph + LangChain, OpenAI `gpt-4o-mini` |
| Backend | FastAPI + Python 3.11 |
| Database | PostgreSQL 16 (SQLModel / SQLAlchemy) |
| Thông báo kỹ thuật | Zalo Bot |
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
| `OPENAI_API_KEY` | Có | Key OpenAI của team |
| `AI_LOG_API_KEY` | Có | Mỗi người tự tạo tại [dashboard Phoenix](https://phoenix.note.transformerlabs.ai/api-keys) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Không | Để mặc định khi chạy local |
| `ZALO_BOT_TOKEN`, `ZALO_WEBHOOK_SECRET`, `ZALO_TECH_CHAT_ID` | Khi làm phần Zalo | Hỏi người phụ trách Zalo Bot |
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
  agents/            LangGraph agent (graph, state, nodes, tools)
  api/routes.py      Endpoint chat mẫu của template
  models/schemas.py  Pydantic schemas (request/response)
  api/routers/       Endpoints: tickets, work_orders, escalations, jobs, metrics, catalog
  models/entities.py Bảng DB (SQLModel)
  services/          Nghiệp vụ: triage, safety, intake_llm, assignment, evidence_check, metrics
  config.py          Cấu hình (đọc từ .env)
  main.py            App entry point
tests/               pytest (5 kịch bản MVP + unit test quy tắc)
seed/                Dữ liệu mẫu một tòa: vị trí, lịch trực, playbook
docs/                Tài liệu, architecture diagram, Technical Guidebook
eval/                Kết quả evaluation
presentation/        Slide, video Demo Day
Dockerfile           Image backend (multi-stage)
docker-compose.yml   Backend + PostgreSQL
```

## API Endpoints

Tất cả nằm dưới prefix `/api/v1`. Chưa có đăng nhập: gửi header **`X-Role: bql`** hoặc
**`X-Role: technician`** để giả lập vai trò (Swagger có ô nhập `x-role` ở mỗi endpoint).

| Method | Path | Vai trò | Việc làm |
|---|---|---|---|
| POST | `/tickets` | (cư dân) | Nhận phản ánh (form, kèm tối đa 5 ảnh); kiểm tra an toàn, tách vị trí/loại sự cố → tự giao cho kỹ thuật đang trực (`ASSIGNED`) hoặc `ESCALATED` |
| GET | `/tickets/{id}/photos/{photo_id}` | bql, technician | Xem ảnh cư dân gửi kèm |
| GET | `/tickets`, `/tickets/{id}` | bql (xem chi tiết: cả technician) | Danh sách / chi tiết ticket kèm work order, bằng chứng, ngoại lệ |
| POST | `/work-orders/{id}/reassign` | bql | Đổi người được hệ thống tự giao (người mới phải đang trực), khi chưa nhận việc |
| POST | `/work-orders/{id}/accept` | technician | Kỹ thuật xác nhận nhận việc |
| POST | `/work-orders/{id}/evidence` | technician | Upload ảnh trước/sau, checklist, vật tư (nộp bổ sung được) |
| POST | `/work-orders/{id}/check` | bql | Soát hồ sơ bằng quy tắc cứng: đạt → đề xuất đóng; thiếu → nhắc bổ sung kèm lý do |
| GET | `/work-orders` | bql, technician | Lọc theo `technician_id`, `status` |
| POST | `/tickets/{id}/close` | bql | Đóng ticket (khi `CLOSE_PROPOSED`) |
| POST | `/tickets/{id}/escalate` | bql, technician | Chuyển BQL thủ công từ bất kỳ bước nào |
| GET | `/escalations` | bql | Hàng đợi ngoại lệ (`status=OPEN/RESOLVED/ALL`) |
| POST | `/escalations/{id}/resolve` | bql | `resume` (tiếp tục), `retriage` (sửa vị trí/loại), `close` (đóng) |
| POST | `/jobs/check-overdue` | bql | Quét việc quá hạn nhận/hoàn thành (bấm tay thay cho cron) |
| GET | `/tickets/{id}/audit` | bql | Nhật ký mọi quyết định và lần chuyển trạng thái |
| GET | `/metrics` | bql | Thời gian đến lúc giao việc (trung vị), tỷ lệ hồ sơ đạt lần đầu, số ngoại lệ |
| GET | `/locations`, `/shifts`, `/playbooks` | (ai cũng xem) | Danh mục vị trí, lịch trực, playbook |

Vòng đời ticket:
`NEW → TRIAGED → ASSIGNED → EVIDENCE_SUBMITTED → CHECK_PASSED → CLOSE_PROPOSED → CLOSED`.
Bước nào cũng có thể rẽ sang `ESCALATED`; hồ sơ thiếu thì về `CHECK_FAILED` chờ nộp bổ sung.

### Thử luồng chuẩn trên Swagger (<http://localhost:8000/docs>)

1. `POST /tickets`: điền `text = Đèn hành lang tầng 5 bị hỏng`, có thể chọn ảnh ở `photos` → `ASSIGNED`,
   `location_id = S101-T05-HL`, việc đã giao cho kỹ thuật ca đèn đang trực. Lấy `work_orders[0].work_order.id`.
   Ảnh chỉ lưu để xem, không dùng để phân loại.
2. (Tuỳ chọn) `POST /work-orders/{id}/accept` (technician).
3. `POST /work-orders/{id}/evidence` (technician): chọn ảnh ở `before_photos` và `after_photos`,
   `checklist_done = diagnose,power_off,replace,test`, `materials_used = Bóng LED 18W x1`.
4. `POST /work-orders/{id}/check` (bql) → `CLOSE_PROPOSED`.
5. `POST /tickets/{id}/close` (bql) → `CLOSED`; xem `GET /tickets/{id}/audit`.

Ca chuyển BQL: `"tầng 5 tối"` (vị trí mơ hồ), `"Mất điện cả hành lang tầng 7, có mùi khét"` (an toàn).

### Dữ liệu mẫu và LLM

- Lần đầu khởi động với DB trống, backend nạp dữ liệu một tòa từ `seed/`:
  `locations.csv` (vị trí), `shifts.csv` (lịch trực), `playbook.yaml` (quy trình + checklist).
  Sửa các file này rồi reset DB (`docker compose down -v`, `make up`) để nạp lại.
- `LLM_MODE=mock` (mặc định): tách vị trí/loại sự cố bằng từ khoá, không cần API key, kết quả cố định.
  Đổi `LLM_MODE=openai` để dùng model trong `MODEL_NAME`. Kiểm tra an toàn và soát hồ sơ luôn là
  quy tắc cứng, không phụ thuộc LLM.
- Chưa dùng Alembic: bảng được tạo tự động khi khởi động. Đổi cấu trúc bảng thì reset DB.

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

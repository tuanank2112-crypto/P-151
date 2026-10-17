# Audit tài liệu dự án theo `docs/guide/chapter-09.md` — 2026-10-17

Phạm vi: README, ARCHITECTURE, `docs/*.md` (trừ `docs/guide/` là sách của BTC), `docs/submission/`, `docs/diagrams/`, file gốc repo, CI, `requirements.txt`, lịch sử git. Commit đo: `9e21597` (`develop`). Mọi con số dưới đây do lệnh đo trong phiên; mục nào chưa đo thì ghi rõ.
Ký hiệu: ✅ đạt · 🟡 một phần · ❌ thiếu hoặc sai · ⬜ chưa kiểm được.

## A. 10 deliverables (chương 9 §9.1)

| # | Deliverable | Trạng thái | Bằng chứng | Khoảng cách so với chương 9 |
|---|---|---|---|---|
| 1 | Source code | 🟡 | repo có `src/`, `tests/`, Docker; 250 commit không-merge, 91% theo Conventional Commits (22/250 không) | file lớn, requirements chưa pin, CI đỏ (xem G) |
| 2 | README | 🟡 | 453 dòng, đủ nhiều mục | nội dung cũ, không ảnh chụp (xem B) |
| 3 | Architecture diagram | 🟡 | SVG 1,6 MB + draw.io + Mermaid | sơ đồ và tài liệu nói sai hiện trạng, 2 link hỏng (xem C) |
| 4 | AI logs | ❌ | README trỏ `.ai-log/session.jsonl` | đó là log prompt của công cụ lập trình, không phải log Agent (xem D) |
| 5 | Live URL | ✅ | `p151-portal.vercel.app/login` 200; `p151-backend.vercel.app/health` 200, `/docs` 200 | README chỉ ghi URL portal, thiếu URL backend, health, docs (xem E) |
| 6 | Video demo | 🟡 | `docs/video-demo.md`, Drive, mp4 3:29 | thiếu giới thiệu team và ca biên; mp4 13,4 MB nằm trong git |
| 7 | Pitch deck | ❌ | `presentation/` rỗng, không có `docs/pitch-deck.pdf` | chỉ có dàn ý ở `planning/04_*/deliverables/pitch-outline.md` |
| 8 | Journal | ✅ | `docs/journal.md`, 5 mục theo tuần | đủ ngưỡng 5–7 mục; mục tuần dài hơn "2–3 câu" nhưng chấp nhận được |
| 9 | Worklog | ✅ | `docs/worklog.md` sinh từ git log (242 commit, 26 ngày) | tháng 9 ít commit; ghi số thật, không cần sửa |
| 10 | Evaluation evidence | 🟡 | `docs/evaluation.md` (xem `planning/28_*`) | thiếu phản hồi người dùng, held-out, ảnh chụp |

Ước tính số deliverable "có và dùng được": 6/10 (1, 5, 8, 9 đầy đủ; 2, 3, 6, 10 một phần; 4 và 7 thiếu). Chương 9 nói đội top nộp 9–10/10.

## B. README (checklist chương 9 §9.2)

| Mục chương 9 | Trạng thái | Ghi chú |
|---|---|---|
| Tên dự án, mô tả rõ | ✅ | |
| Screenshot hoặc GIF của ứng dụng | ❌ | `grep` ảnh trong README = 0; có 40 ảnh ở `docs/screenshots/` nhưng README không dùng |
| Hướng dẫn cài đặt step-by-step | ✅ | Docker 4 lệnh; chạy ngoài Docker |
| Hướng dẫn chạy (kèm Docker) | 🟡 | đúng lệnh nhưng mô tả giao diện cũ: "Giao diện: `/ui/`" (hiện redirect 308), "Tailwind Play CDN", đăng nhập bằng tài khoản `cudan01`, trong khi giao diện hiện là portal tài khoản `cudan`/`123456` |
| Cấu trúc thư mục (tree) | ❌ | liệt kê `src/web/` (đã xoá 12/10); thiếu `portal/`, `src/mobile/`, `scripts/`, `data/` |
| Tech stack | 🟡 | ghi "luật cố định, có thể kèm LLM", "vật tư (3 phép đối soát)" (đã bỏ ở plan 15–16); không nhắc LangGraph dù đang dùng |
| Biến môi trường (tên, không giá trị) | ✅ | đầy đủ, có bảng |
| API documentation | 🟡 | bảng endpoint dài nhưng thiếu `/bql/reports/performance`, `/mo/warehouse/*`, `/stock-alerts`, `material-shortage`, `material-usage`, `emergency/merge` |
| Team members | 🟡 | có tên, vai trò; kèm MSSV (dữ liệu cá nhân không cần cho BGK) |
| Link Live URL | 🟡 | chỉ portal; thiếu backend/health/docs |
| (thêm) badge CI | ❌ | CI đỏ do billing nên chưa nên thêm |

Ngoài ra: dòng đầu ghi "code v1.17.9" (hiện 1.17.10); phần "Tài liệu" ghi "PRD nền v0.3"; mục "Chạy" không nhắc lệnh coverage.

## C. Architecture diagram và tài liệu kiến trúc (checklist §9.2)

| Mục chương 9 | Trạng thái | Ghi chú |
|---|---|---|
| Sơ đồ rõ ràng, dễ đọc | ✅ | draw.io 3 tầng, có màu |
| Đủ thành phần (frontend, backend, agent, DB, API ngoài) | 🟡 | có đủ loại, nhưng ghi sai tên: "Web Application (/ui) HTML5/Vanilla JS" (UI nay là Next.js portal), "GPT-4o" (production dùng `gpt-6-luna`), "Phoenix & LangSmith" (không dùng) |
| Có mũi tên luồng dữ liệu | ✅ | |
| File PNG/SVG nhúng README | ✅ | `docs/diagrams/Diagrams Components.svg` |
| Có mô tả ngắn kèm sơ đồ | 🟡 | mô tả trong `docs/architecture_diagram.md` mâu thuẫn với code |

**Sai sự thật trong tài liệu (đã kiểm với code):**
- `docs/architecture_diagram.md` §3: "LangGraph và Phoenix chưa tích hợp vào pipeline". Thực tế `src/maintenance/agent/graph.py` dùng `langgraph.graph.StateGraph`; Phoenix/LangSmith thì đúng là chưa có.
- `ARCHITECTURE.md` §10: LangGraph "Mục tiêu 19/10, chưa tích hợp"; "Deploy online: Chưa có" (đã có Vercel); P1 "sau 04/10" (đã chạy); "Guard LLM an toàn không bật" (Agent LLM đã nâng mức an toàn); dòng 17 và 38 vẫn ghi `src/web/` (đã xoá).
- Hai link hỏng: `docs/diagrams/Diagrams Components.drawio.svg` (file thật là `Diagrams Components.svg`), `docs/diagrams/maintenanceops-data-flow-20261019/data-flow.svg` (thư mục chỉ có `.drawio` và `.mmd`). Cùng link hỏng ở `ARCHITECTURE.md` và `docs/submission/daily/2026-10-04.md`.
- Hai file SVG nằm ở **root repo** (`Architecture_Diagram_Components.drawio.svg`, `Architecture_Diagram_Data_Flow.svg`). File thứ nhất trùng từng byte với `docs/diagrams/Diagrams Components.svg` (đã so bằng `cmp`); file thứ hai (20 KB) chưa thấy ở `docs/`, nhiều khả năng là đích của link `data-flow.svg` bị hỏng. Vi phạm luật root sạch.

## D. AI logs (checklist §9.2)

| Mục chương 9 | Trạng thái | Ghi chú |
|---|---|---|
| LangSmith project URL hoặc ảnh chụp terminal cho thấy Agent suy luận | ❌ | không dùng LangSmith/Phoenix; `/mo/ai-logs` chỉ ở RAM, mất khi khởi động lại |
| Ít nhất 5–10 trace | 🟡 | dữ liệu có sẵn nhưng chưa đóng gói: `docs/eval/runs/hard-llm-20261017/results.json` (91 ca) + `latency.jsonl` (54 lượt) |
| Mỗi trace: input, LLM call, retrieval, output | 🟡 | `AILogEntry` có `prompt_sent`, `raw_output`, `structured_output`, model, latency, token; không có retrieval vì không phải RAG |
| (rủi ro) `.ai-log/session.jsonl` đang được git theo dõi | ⚠️ | chứa prompt của thành viên và trường `student` là email cá nhân; README gọi nó là "AI logs" nhầm với deliverable #4 |

## E. Live URL (checklist §9.2)

| Mục | Trạng thái | Ghi chú |
|---|---|---|
| URL trả HTTP 200 | ✅ | portal `/login` 200 |
| Health check endpoint | ✅ trên backend | `https://p151-backend.vercel.app/health` 200; README không ghi |
| API endpoints chính hoạt động | ⬜ | chưa gọi API có đăng nhập trên production trong phiên này |
| URL được ghi trong README | 🟡 | chỉ portal |
| Ổn định, không sleep (UptimeRobot) | ⬜ | chưa kiểm; Vercel không sleep nhưng backend/Supabase có thể chậm lần đầu (plan 26 đã chuyển `sin1`) |
| Còn hoạt động đến Demo Day + 7 ngày | ⬜ | cần người xác nhận gói Vercel và Supabase |
| Bản deploy chứa mã mới nhất | ⬜ | `evaluation.md` §8 ghi bản Vercel deploy bằng CLI từ bản sao cục bộ, chưa nối GitHub |

## F. Video, Pitch deck, Journal/Worklog

- **Video (§9.2):** 3:29 HD (1440×900) ✅, có phụ đề `.srt` ✅, link Drive ghi trong README ✅. Thiếu: giới thiệu team ❌, demo ca biên (khẩn cấp, thiếu vật tư) ❌, YouTube unlisted ❌ (Drive folder chưa chắc công khai).
- **Pitch deck (§9.2, §9.6):** ❌ không có PDF. Dàn ý 10 slide có ở `planning/04_*/deliverables/pitch-outline.md`, nhưng toàn bộ checklist user test và pitch của plan 04 chưa tick (mốc 08/10–16/10 đã qua). Chưa có bằng chứng "thực hành 3 lần".
- **Journal/Worklog (§9.2):** ✅ cả hai trong `docs/`.

## G. Source code (checklist §9.2)

| Mục | Trạng thái | Bằng chứng |
|---|---|---|
| Repo public hoặc thêm BTC làm collaborator | ⬜ | repo private; chưa biết BTC đã là collaborator chưa |
| Chạy được sau khi đặt env | ✅ | Docker quick start đã chạy đúng ở máy này (`/health`, `/docs`, `/` đều 200) |
| `.gitignore` đúng | ✅ | `.env`, `__pycache__`, `.venv` đều bị ignore |
| Không commit secret | 🟡 | quét mẫu khoá `sk-…`, `sb_secret_…`, JWT, URL Postgres có mật khẩu trên file được theo dõi: không thấy khoá thật. `.env.example` dòng 81 lộ mã dự án Supabase (`aznecwoy…`) trong chuỗi mẫu; chưa quét lịch sử git |
| Không commit file lớn (>10 MB) | ❌ | `docs/demo/demo.mp4` = 13.385.059 byte; tổng repo theo dõi ≈ 140 MB |
| `requirements.txt` có phiên bản ghim | ❌ | 21 dòng `>=`, 0 dòng `==` |
| Type hints | ✅ | 794/851 hàm có kiểu trả về (93%) |
| Docstring cho hàm chính | 🟡 | 236/481 hàm public có docstring (49%) |
| Có test (pytest) | ✅ | 68 file test backend + 13 portal; 3.850 pass, coverage 92,0% |
| CI xanh | ❌ | đỏ do billing của org (không phải lỗi mã); chưa có lần chạy thật cho bước coverage |
| Không có `except:` trần | ✅ | 0; còn 13 `except Exception` |

## H. Tính nhất quán của tài liệu kỹ thuật

| File | Vấn đề |
|---|---|
| `docs/01`, `02`, `05` | phần Active vẫn là bản 0.6 (chỉ có khối hiện trạng ở đầu file); `05` còn kết luận `FROZEN · READY FOR BUILD` của v0.3 ở phần lịch sử |
| `docs/maintenance.md` | đánh số trùng (hai mục §15, hai mục §16, nhảy §10–§13 rồi §14), có các mục nhật ký phiên chèn giữa tài liệu ("Day04 normalized acceptance scope — 2026-10-07T04:32:59…"); §9 "Chưa làm" lỗi thời |
| `docs/web.md` | mô tả `src/web/` đã xoá, không có cảnh báo lịch sử |
| `docs/mobile.md` | dòng 3 vẫn ghi "UI web `/ui/`" |
| `docs/portal.md` | §6 đã gắn ghi chú thay thế; còn mục đánh số trùng "## 6" |
| `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` | còn nguyên văn template: tiêu đề "Đóng góp cho AI20K Agent Template", link issue và security advisory trỏ repo `AI20K-Build-Phase/starter-code-template` |
| `README_boilerplate.md` (root) | mẫu README rỗng ("[Tên Dự Án]"), thừa; vi phạm root sạch |
| `docs/submission/README.md`, `day0X-report.md` | báo cáo ngày cũ vẫn trỏ `evaluation.md` cũ về nội dung "9 ca thủ công" |
| Tài khoản demo | README ghi `cudan01…` mật khẩu `Demo@2026`; PRD/portal ghi `cudan…` mật khẩu `123456`; hai bộ cùng tồn tại nhưng không tài liệu nào nói rõ |
| Link tương đối | 349 link kiểm, 5 hỏng (đều ở nhóm C) |

## I. Tác động lên 5 tiêu chí chấm điểm (chương 9 §9.3)

| Tiêu chí | Điểm ước tính hiện tại | Tài liệu kéo điểm xuống | Tài liệu giúp tăng nếu sửa |
|---|---|---|---|
| Product/Business (7.5) | không thấy tài liệu về quy mô thị trường, đối thủ, mô hình kinh doanh (chương 9 yêu cầu "market sizing hoặc competitor analysis", "business model khả thi") | pitch deck chưa có | thêm mục bối cảnh/đối thủ vào `docs/02` và pitch; nêu rõ chưa có số thật thì ghi giả định |
| System Design (8.0) | sơ đồ và tài liệu kiến trúc nói sai LangGraph, deploy, UI | | sửa C → "giải thích được tại sao chọn tech stack" |
| UI/UX (8.0) | README không có ảnh chụp dù có 40 ảnh sẵn | | thêm 3–4 ảnh/GIF vào README |
| DevOps (6.5) | CI đỏ, requirements chưa ghim, file 13 MB, README thiếu URL health | | CI xanh, ghim phiên bản, URL health trong README |
| Code Quality (7.5) | docstring 49%, `except Exception` 13 chỗ, lỗi lint đã sửa | | docstring cho API chính |

Ước tính tổng 37,5/50 (Top 5). Sửa A–G hợp lý có thể lên khoảng 39–40, tức ngưỡng Top 3 của chương 9 (40+), nhưng cần cả pitch deck và CI xanh.

## J. Điểm tốt nên giữ (không sửa)

README có bảng biến môi trường rất đầy đủ; Docker chạy đúng khi làm theo; lịch sử git đều đặn (35/250 commit nằm trong 3 ngày cuối, không dồn); 0 `except:` trần; không có khoá thật trong file theo dõi; evaluation trung thực về giới hạn; có plan/decision log theo mốc thời gian.

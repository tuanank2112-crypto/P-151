# 29 — Sửa tài liệu dự án theo audit chương 9 (PATCH)

## Metadata
- Trạng thái: 🟠 ĐANG THỰC THI — người dùng duyệt phần Agent làm được ngày 2026-10-17. Xong local: WP1, WP2, WP4, WP5, WP7, WP9, WP13 (nội dung). Còn mở: WP3 (nhãn sơ đồ), WP6, WP8, WP10, WP11, WP12, WP14 (cần người hoặc chưa được giao).
- Người yêu cầu: nhóm ("rà soát và audit toàn bộ tài liệu dựa trên tiêu chí chương 9, sau đó lên kế hoạch sửa").
- Nhánh: `develop`. Phiên bản: **1.17.11** (PATCH: tài liệu, cấu hình, ghim phiên bản, không đổi hành vi; ≤ 1 ngày công cho phần Agent làm được ⇒ ngoại lệ AGENTS §3.2.5, chỉ `plan.md`).
- Kết quả audit: [audit.md](audit.md) (mục A–J, số đo và bằng chứng). Kế hoạch này không lặp lại số liệu, chỉ trỏ tới mục audit.
- Liên quan: `planning/28_2026-10-17_evaluation-polish/` (evaluation; WP10, WP11, WP13 còn mở). Plan 29 không sửa lại phần đó.
- Phạm vi được ghi: `README.md`, `ARCHITECTURE.md`, `docs/**` (trừ `docs/guide/`), `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.env.example`, `requirements.txt`, `.gitignore`, `docs/diagrams/`, file gốc repo (di chuyển/xoá có xác nhận), `brain4agent/`. **CẤM** đổi hành vi trong `src/`, `portal/src/`, `seed/`; riêng WP9 chỉ thêm docstring.

## Ưu tiên theo điểm số
Chương 9 §9.3: DevOps dễ ghi điểm nhất, và đội top nộp 9–10/10 deliverable. Thứ tự dưới đây xếp theo "điểm thu được trên mỗi giờ công", không theo thứ tự file.

## Nhật ký quyết định
- 2026-10-17 D01 (agent): sửa nội dung sai trước, làm đẹp sau. Mọi chỗ tài liệu nói ngược với code (LangGraph "chưa tích hợp", "Deploy online chưa có", giao diện `/ui`, "3 phép đối soát vật tư") phải sửa trước khi thêm nội dung mới.
- 2026-10-17 D02 (agent): GIỮ bố cục sơ đồ kiến trúc gốc (người dùng đã yêu cầu trong `docs/architecture_diagram.md`); chỉ sửa nhãn lỗi thời và thêm chú giải "Đang chạy / Mục tiêu". Không vẽ lại sơ đồ.
- 2026-10-17 D03 (agent): deliverable #4 "AI logs" = log của Agent (đầu vào, lệnh gọi model, đầu ra, độ trễ, token), không phải log prompt của công cụ lập trình. Dựng `docs/ai-logs.md` từ dữ liệu đã có (`results.json`, `latency.jsonl`); không bịa trace. LangSmith/Phoenix chỉ ghi "chưa dùng" cho đến khi có khoá và chạy thật.
- 2026-10-17 D04 (agent): ghim phiên bản = đúng bộ đang chạy test xanh (lấy từ venv hiện tại bằng `pip freeze` rồi lọc phụ thuộc trực tiếp), kiểm bằng `docker compose build` và pytest. Không nâng phiên bản thư viện nào.
- 2026-10-17 D05 (agent): số liệu thị trường, đối thủ, mô hình kinh doanh KHÔNG được bịa. WP12 chỉ dựng khung và điền những gì nhóm cung cấp hoặc có nguồn; thiếu thì ghi "chưa có dữ liệu".
- 2026-10-17 D06 (agent): `.ai-log/session.jsonl` đang được theo dõi và chứa email cá nhân cùng prompt. Quyết định gỡ khỏi git cần người (khoá học có thể yêu cầu nộp file này); plan chỉ đề xuất và hỏi.

### Quyết định bị thay thế
- Dòng "Bài toán/PRD nền (v0.3, lệch thì CR-03 thắng)" ở README §Tài liệu bị thay bằng trạng thái hiện hành (đã có ở khối "Hiện trạng thực tế" của `docs/01`–`05`).

### Vùng cấm
- Không xoá `docs/guide/` (sách của BTC).
- Không xoá lịch sử số đo, báo cáo ngày, hồ sơ `planning/`; chỉ sửa tham chiếu.
- Không nén lại hay cắt video mà không giữ bản gốc ở Drive; không xoá `demo.mp4` khỏi git trước khi người xác nhận bản trên Drive xem được công khai.
- Không viết lại lịch sử git (không `filter-repo`) trừ khi người duyệt riêng; xoá mp4 khỏi HEAD không giảm dung lượng clone.
- Không đổi mật khẩu hay tài khoản trong `seed/`; chỉ ghi tài liệu cho khớp.

## Work Packages

| WP | Việc | Tầng | Xong khi |
|---|---|---|---|
| WP1 | README: bỏ `/ui/`, `src/web/`, "3 phép đối soát", "Tailwind CDN"; cập nhật tech stack (LangGraph, `gpt-6-luna`), cây thư mục (`portal/`, `src/mobile/`), tài khoản demo (hai bộ, ghi rõ), URL backend/health/docs, đổi phiên bản, bỏ MSSV, thêm 3–4 ảnh từ `docs/screenshots/`, thêm bảng endpoint còn thiếu | 🟢 | `grep -nE "src/web|/ui/|Tailwind|3 phép" README.md` = 0; README có ≥ 3 ảnh; kiểm link tương đối = 0 hỏng |
| WP2 | `ARCHITECTURE.md` và `docs/architecture_diagram.md`: sửa mọi câu sai (LangGraph, deploy, P1, Agent an toàn, `src/web`), thêm bảng "Đang chạy / Mục tiêu" đúng; sửa 2 link hỏng; di chuyển `Architecture_Diagram_Data_Flow.svg` về `docs/diagrams/` và đặt link đúng | 🟢 | `grep -n "chưa tích hợp" ARCHITECTURE.md docs/architecture_diagram.md` chỉ còn Phoenix/LangSmith; script link = 0 hỏng |
| WP3 | Đổi nhãn sơ đồ gốc (Web `/ui` → Portal Next.js, GPT-4o → `gpt-6-luna`, đánh dấu Phoenix/LangSmith là mục tiêu): sửa `.mmd`/`.drawio`/SVG theo D02, đồng bộ phần Mermaid trong README | 🟠 | mở SVG, đọc nhãn mới; `Diagrams Components.mmd` và README Mermaid khớp nhau |
| WP4 | `docs/ai-logs.md`: 8 trace thật (input, `prompt_version`, model, quyết định, độ trễ, token) lấy từ `docs/eval/runs/hard-llm-20261017/`; cách bật/đọc `/mo/ai-logs` và `data/logs/latency.jsonl`; sửa dòng #4 ở README và `docs/submission/README.md` | 🟠 | file có 8 trace, mỗi trace khớp một dòng `results.json`; tổng token và p95 khớp `eval_hard_llm_report.py` |
| WP5 | Ghim phiên bản `requirements.txt` theo D04 | 🟠 | `grep -c ">=" requirements.txt` = 0; `docker compose build backend` exit 0; `pytest tests -q` cùng số pass như trước (3.850) |
| WP6 | File lớn: kiểm bản Drive công khai; nếu người xác nhận, `git rm docs/demo/demo.mp4` và giữ `demo.srt`, `demo-script.md`; thêm `*.mp4` vào `.gitignore` | 🟠 + 🖐 | không còn file > 10 MB trong `git ls-tree -r -l HEAD`; `docs/video-demo.md` chỉ trỏ Drive |
| WP7 | Dọn tài liệu kỹ thuật: `docs/01`, `02`, `05` viết lại phần Active theo code (như đã làm cho PRD/UI/contract/playbook); `docs/maintenance.md` đánh số lại và chuyển các mục nhật ký phiên sang `brain4agent/` hoặc xoá đoạn trùng; `web.md` thêm cảnh báo "lịch sử, `src/web/` đã xoá"; `mobile.md` sửa dòng `/ui/` | 🟠 | mục `##` của `maintenance.md` không trùng số; `grep -n "/ui/" docs/mobile.md` = 0 |
| WP8 | Chuẩn hoá file gốc: sửa `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` (bỏ link `starter-code-template`, ghi repo và liên hệ thật); xoá `README_boilerplate.md` và hai SVG ở root (đã sao về `docs/diagrams/`) sau khi người xác nhận | 🟢 + 🖐 | `ls *.md *.svg` ở root chỉ còn `AGENTS.md`, `ARCHITECTURE.md`, `CLAUDE.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `README.md`, `SECURITY.md`, `brain4agent-v*.md` |
| WP9 | Docstring cho hàm public ở `src/api/` và các phương thức công khai của `engine.py` (nội dung dịch lại từ code, không đổi logic) | 🟢 | script AST: tỉ lệ docstring public `src/api/` ≥ 80%, toàn `src` ≥ 70%; `ruff check src tests` exit 0; pytest không đổi số pass |
| WP10 | Bí mật và dữ liệu cá nhân: thay mã dự án Supabase trong `.env.example` bằng `<project-ref>`; quét lịch sử git bằng `git log -S` cho khoá thật; quyết định `.ai-log/session.jsonl` (D06) | 🟢 + 🖐 | `git grep "aznecwoy"` = 0; báo cáo quét lịch sử ghi vào `docs/` hoặc `planning/` |
| WP11 | Video: bổ sung đoạn giới thiệu team và đoạn ca khẩn cấp/thiếu vật tư; đăng YouTube unlisted; sửa `docs/video-demo.md` | 🖐 người quay, 🟢 agent sửa doc | `docs/video-demo.md` có link YouTube mở được, thời lượng 3–5 phút |
| WP12 | Product/Business: mục "Bối cảnh, đối thủ, mô hình" trong `docs/02_product_brief.md` và pitch, chỉ nội dung có nguồn hoặc ghi rõ giả định (D05) | 🖐 BA (Trường) + 🟢 agent định dạng | mục có nguồn cho từng số; không có con số không nguồn |
| WP13 | Pitch deck 10 slide: agent soạn nội dung từng slide từ `pitch-outline.md` và số đo đã kiểm (`docs/evaluation.md`), người thiết kế và xuất `docs/pitch-deck.pdf` | 🖐 + 🟢 | `docs/pitch-deck.pdf` tồn tại, 10 trang; mọi con số trên slide có dòng tham chiếu |
| WP14 | CI: người có quyền sửa billing; sau đó chạy lại, ghi số run vào README (badge CI) | 🖐 | run mới nhất trên `develop` xanh |
| WP15 | Đồng bộ não (Ma Trận 6 Điểm), tăng version PATCH | 🟢 | `git diff --stat` chạm đúng các file; version khớp |

Thứ tự đề xuất: WP1 → WP2 → WP5 → WP4 → WP7 → WP3 → WP10 → WP8 → WP9 → (🖐) WP14, WP6, WP11, WP12, WP13 → WP15.

## Checklist thực thi
- [x] WP1 README sửa nội dung và thêm ảnh
- [x] WP2 ARCHITECTURE + architecture_diagram + link
- [ ] WP3 nhãn sơ đồ
- [x] WP4 `docs/ai-logs.md`
- [x] WP5 ghim `requirements.txt`
- [ ] WP6 file lớn (cần người)
- [x] WP7 docs 01/02/05, maintenance, web, mobile
- [ ] WP8 file gốc (cần người)
- [x] WP9 docstring
- [ ] WP10 bí mật và dữ liệu cá nhân (cần người)
- [ ] WP11 video (cần người)
- [ ] WP12 product/business (cần người)
- [~] WP13 pitch deck: nội dung 10 slide + Q&A đã soạn (`docs/pitch-deck-content.md`); PDF cần người thiết kế
- [ ] WP14 CI xanh (cần người)
- [ ] WP15 đồng bộ não + version

## Exit Gates

| Gate | local | server |
|---|---|---|
| Không còn câu tài liệu nói ngược code (LangGraph, deploy, `/ui`) — kiểm bằng `grep` ở WP1, WP2 | ⬜ | – |
| 0 link tương đối hỏng ở README, ARCHITECTURE, docs | ⬜ | – |
| `requirements.txt` ghim, Docker build và pytest không đổi | ⬜ | ⬜ Vercel build vẫn xanh (deploy do người) |
| Không file > 10 MB trong HEAD | ⬜ | – |
| `docs/ai-logs.md` có 8 trace khớp dữ liệu thô | ⬜ | – |
| Đủ 10/10 deliverable có file đúng chỗ (gồm `docs/pitch-deck.pdf`) | ⬜ | – |
| CI xanh trên `develop` | – | ⬜ chờ billing |
| README có ảnh, URL backend/health/docs, badge CI | ⬜ | ⬜ |

Kế hoạch chỉ được đóng khi mọi gate local ✅; gate server hoãn phải ghi lý do trong README hoặc `docs/evaluation.md` §8.

## Kết quả thực thi 2026-10-17
- D07 (agent): README bỏ MSSV khỏi bảng team; tài khoản demo ghi hai bộ (`cudan…/123456`, `cudan01…/Demo@2026`). Không đổi `seed/`.
- D08 (agent): để không đụng WP8 cần xác nhận, `Architecture_Diagram_Data_Flow.svg` được **sao** (không di chuyển) sang `docs/diagrams/maintenanceops-data-flow-20261019/data-flow.svg`; hai file ở root vẫn còn đến khi WP8 được duyệt.
- D09 (agent): `docs/demo/demo.mp4` đã bị xoá khỏi working tree bởi người dùng (không phải agent); các tài liệu đã sửa cho khớp (chỉ còn Drive). Việc stage phép xoá chờ người xác nhận (WP6).
- Ghim phiên bản = bộ đang chạy test xanh cục bộ (D04). Docker build exit 0; test trong image: 3.852 pass, 0 fail, 40 xfail, 102 deselected ([output](../../docs/eval/runs/outputs-20261017/pytest_docker_linux.txt)). Transitive vẫn chưa ghim.
- Docstring: hàm public không lồng nhau 262/431 (61%) → 314/431 (73%); `src/api/` 100%. Chỉ thêm docstring; ruff check/format exit 0; 157 test liên quan pass.
- Link tương đối kiểm lại: 332 link, 0 hỏng (sau khi sửa `video-demo.md`).

## Rủi ro
- WP5: ghim phiên bản có thể làm Docker build hoặc Vercel build lỗi nếu bộ ghim khác môi trường deploy. Giảm rủi ro: build thử Docker trước, không deploy khi chưa có người duyệt.
- WP6: xoá `demo.mp4` khỏi HEAD không giảm dung lượng clone (lịch sử vẫn giữ 13 MB).
- WP12, WP13: phụ thuộc người; nếu không kịp, ghi "chưa có dữ liệu" thay vì điền số giả.
- Mốc: bàn giao 19/10, nghiệm thu 21:00. Nên làm WP1–WP5 và WP7–WP10 (Agent làm được) trước 18/10.

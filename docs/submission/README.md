# Hồ sơ nộp bài Demo Day (theo chapter-09)

Thư mục này gom **kết quả công việc từng ngày** của Trường (`daily/YYYY-MM-DD.md`, mỗi ngày một file, chỉ trỏ tới evidence trong `planning/`).
Cuối cùng, từ các file này tổng hợp vào đúng vị trí chapter-09 §9.1 rồi merge lên `main`.

| # | Deliverable | Vị trí đích (chapter-09) | Trạng thái | Nguồn hiện có |
|---|---|---|---|---|
| 1 | Source code | `src/`, `tests/` | ✅ có | repo |
| 2 | README | `README.md` | ✅ có | [README.md](../../README.md) |
| 3 | Architecture diagram | `docs/architecture.md` (hoặc png/svg) | ⬜ gộp | [diagrams/](../diagrams/), [architecture_diagram.md](../architecture_diagram.md) |
| 4 | AI logs | `docs/` (link/screenshot LangSmith) | ⬜ | — |
| 5 | Live URL | ghi trong README | ✅ có | <https://p151-portal.vercel.app/login> (xem [README](../../README.md)) |
| 6 | Video demo | [`video-demo.md`](../video-demo.md) | ✅ có (link Drive; tệp mp4 không còn trong git) | [demo/](../demo/) |
| 7 | Pitch deck | `docs/pitch-deck.pdf` | ⬜ chưa có PDF; nội dung 10 slide đã soạn | [pitch-deck-content.md](../pitch-deck-content.md), [planning/04_*](../../planning/04_2026-10-03_user-test-pitch/) |
| 8 | Journal | [`journal.md`](../journal.md) | ✅ có | docs/ |
| 9 | Worklog | [`worklog.md`](../worklog.md) | ✅ có | docs/ |
| 10 | Evaluation evidence | [`docs/evaluation.md`](../evaluation.md) | 🟡 có test+coverage, 91 câu khó (luật + Agent LLM), độ trễ, token; thiếu held-out, phản hồi người dùng | [evaluation.md](../evaluation.md), [eval/runs/](../eval/runs/), [planning/02_*/deliverables/](../../planning/02_2026-10-03_truong-mvp-prep/deliverables/) |

Báo cáo từng ngày: [day01](day01-report.md) · [day02](day02-report.md) · [day03](day03-report.md) · [day04](day04-report.md) · [day05](day05-report.md).

Day05: đã chuẩn bị hồ sơ local; review người thật, held-out/gold và baseline còn chờ. Chi tiết kiểm chứng: [daily/2026-10-05.md](daily/2026-10-05.md).

Mỗi ngày: thêm `daily/<ngày>.md` (việc đã làm, kết quả đo, link evidence, deliverable # nào được đẩy tiến).

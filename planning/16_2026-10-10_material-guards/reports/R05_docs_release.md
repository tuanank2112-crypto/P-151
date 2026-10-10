Vai ORCHESTRATOR (root kiêm WP5) · thi công · Claude/Opus 5.5 · Bước 0 exit 1 (hub thiếu) · phạm vi: docs maintenance/web/mobile/CR-BPTN-03, não 6 điểm, version, checklist, harness Q41/Q42 obsolete; xong khi `git diff --check` exit 0 và mọi H có R; cấm runtime/tests/.env/cold memory/marker.
Handoff: H05_docs_release.md
Base: 71315109d845fe69935050b09d4ab4c67efb024a + baseline.txt
Head: 71315109d845fe69935050b09d4ab4c67efb024a + working tree chưa commit (hash cuối ghi ở `evidence/wp5/final_state.txt`)

## Lệnh và số đo
| Lệnh | Exit | Kết quả | Evidence |
|---|---|---|---|
| `git diff --check` | 0 | sạch | `evidence/wp5/final_state.txt` |
| đếm H/R | — | 5 handoff ↔ 5 report cùng đuôi; dòng 2–4 Handoff/Base/Head; dòng cuối phán quyết | `evidence/wp5/final_state.txt` |
| `wc -l brain4agent/memory-distill.txt` | 0 | < 100 dòng | `evidence/wp5/final_state.txt` |

## Đã đồng bộ
- Version 1.9.9 → **1.10.0** (MINOR): `portal/package.json`, `portal/package-lock.json` (2 chỗ), `state.json current_version`.
- Docs: `docs/maintenance.md` §5 "Lưu vật tư nguyên tử" + lỗi `material-plan`; `docs/web.md` §7; `docs/mobile.md` vật tư; `docs/CR-BPTN-03.md` §9.4 (5).
- Não: `changelog.md` v1.10.0, `roadmap.md` Done + Idea Vault, `index.md` (router + `material_policy.py`), `memory-distill.txt`, `-known-gotchas.md` (NaN 422, psycopg2 App Control, harness web race, `p151_test` dùng chung), `memory/hot/today.md`, `state.json`.
- Harness plan 11 `q41_dept_materials.mjs`/`q42_no_agent_materials.mjs`: dòng OBSOLETE đầu file.
- `TESTING-ACCEPTANCE.md` §T4 đánh dấu gate theo môi trường; `plan.md` checklist + sign-off 2026-10-10 18:18:44 +07:00.

## Phân công thực tế
| Gói | Tầng yêu cầu | Họ/model |
|---|---|---|
| Docs/não/version | 🟢 | Claude Opus 5.5 (lên tầng: không phóng worker riêng) |

## Không làm / lý do
- `project-intro.md`, `-data-architecture.md`: không thêm thư mục top-level/ngôn ngữ mới, không đổi schema (§5.B.2 không áp).
- Marker `brain4agent-v*.md`, vùng luật managed: không chạm (boot hub thiếu).
- Commit/push/deploy: chờ người dùng.

## Câu hỏi cần người
Không.

✅ DUYỆT

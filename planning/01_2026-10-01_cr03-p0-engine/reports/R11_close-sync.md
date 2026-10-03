Vai: worker · loại: thi công tài liệu (đóng hồ sơ) · họ/model: Claude Sonnet 5.5 (🟠 cho phần mô tả kỹ thuật, 🟢 cho phần đồng bộ mẫu) · Bước 0 exit: 0 · hiểu việc: đồng bộ chữ SPEC theo Q31–Q33, tạo `docs/maintenance.md`, sửa CR-03 §5.2 theo Q17, đồng bộ não 6 điểm + project-intro + data-architecture, nâng brain 1.0.1 → 1.1.0 (KHÔNG đổi version app), ký sign-off plan.md; CẤM `src/`, `tests/`, `seed/`, `scripts/`, `.gitignore`, `README.md`, docs khác; chỉ mô tả cái code ĐANG làm
Handoff: H08_close-sync.md
Base: 9ca0f5d2d2861db8abe2610f0731087d233fac28
Head: 379c822dfac3797420a27b86be14cd7e7c3b0e83

## Lệnh + exit
| Lệnh | Kết quả |
|---|---|
| `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` (trước và sau commit) | exit 0 — "NÃO ĐÃ OK — KHÔNG CẦN NÂNG CẤP THÊM!" |
| `wc -l brain4agent/memory-distill.txt` | 48 (< 100) |
| `wc -l docs/maintenance.md` | 88 (<= 200) |
| `grep -cP '[\x08\x0b\x0c]'` trên `docs/maintenance.md`, `-known-gotchas.md` | 0 / 0 |
| `git diff --stat 9ca0f5d..379c822` | 16 file, +216/-43, toàn bộ trong phạm vi (xem dưới) |
| `date '+%Y-%m-%d %H:%M:%S %z'` (mốc sign-off) | `2026-10-02 20:05:09 +0700` |
Không chạy pytest/ruff: gói chỉ ghi tài liệu (không đụng `src/`, `tests/`, `seed/`); số đo lấy từ R10 + plan Q32 (1462 passed, bộ dừng 1065 ca, holdout NONE 2/39).

## Đã làm (đối chiếu H08 §3)
1. **SPEC (chỉ chữ)**: `SPEC-P01` thêm §0.1 "Đồng bộ chữ WP3d" (A cue một chữ cái, B hedge/B-04 chỉ chữ có dấu, C confirmers theo token + `homograph_intended` mới + regex `bi ngat` + V-08 nới, D hazard exclusions, G `is_invisible`, từ vựng, giới hạn đã biết) và 4 chú thích trỏ vào §3.2.3/§3.2.4/§3.3.1/§3.1, hàng WP trạng thái ✅; `TESTING-ACCEPTANCE` X-2 = 403 (`bptn_resolve` trên blocker chủ BQL, 409 chỉ trên `SAFETY_REVIEW_REQUIRED`), §4.3 (test WP3d + số liệu đóng), Exit Gates local ✅ / server ⬜; `OPERATIONS` thêm dòng WP3b/WP3c/WP3d/H08; `00-ARCHITECTURE` §8 thêm D14 (403 `bptn_resolve`), D15 (Q19 thay V-08), D16 (R1–R10 thay cửa sổ 4 từ).
2. `docs/maintenance.md` mới (88 dòng): mục đích + bảng file, pipeline, tầng an toàn R1–R10 + giới hạn đã biết + số đo, 5 method khẩn cấp (chữ ký, lỗi 403/409/422), priority + `queue_sort_key`, khoá `sla_config`/lexicon, cách chạy test, điểm cần nhớ, phần chưa làm. Mọi chữ ký/hành vi đã đối chiếu `engine.py`, `safety.py`, `priority.py`, `views.py`, `catalog.yaml`.
3. `docs/CR-BPTN-03.md` §5.2: `SAFETY_REVIEW_REQUIRED` và `EMERGENCY_PENDING_BQL` chạy lại từ bước 2 (2b tự bỏ qua), bổ sung văn bản (ảnh không đổi 2b); thêm D-10 ở §17 (Q17).
4. **Não 6 điểm**: `index.md` (hàng `docs/maintenance.md`, hàng kế hoạch 01, sơ đồ thêm `safety.py`, `priority.py`, `lexicon.yaml`, test mới, `data/` + `git add -f`); `roadmap.md` (Active: nối router/UI, merge `develop` + bump version app, Q22 cho Trường, rà từ vựng; Idea Vault: `cancel_reason`/audit cancel, M8, M12, LLM an toàn P1, giới hạn đã biết; Done: hồ sơ 01); `changelog.md` `[v1.1.0] - 2026-10-02`; `-known-gotchas.md` (bẫy bỏ dấu tiếng Việt, cue một chữ cái, bộ dừng, công cụ ghi file giải mã `\u`/`\\`, YAML 1.1 `no`, `git add -f` data test, hook pre-commit, giới hạn 5000 ký tự, `ticket` cũ sau `_set_ticket`); `memory-distill.txt` (viết lại `<project_foundation>`, 48 dòng); `memory/hot/today.md` (+1 dòng); `memory/hot/state.json` (`current_version` 1.1.0, `active_plans_completed` 1, `working_branch`, `code_baseline` `6a35664`, `last_verification`, `last_benchmark`).
5. Lệch nền nên rà thêm (AGENTS §5.B.2): `project-intro.md` (trạng thái v1.1.0), `-data-architecture.md` (lexicon là dữ liệu, trường Ticket đã cài).
6. `plan.md`: Trạng thái `✅ ĐÃ HOÀN THÀNH — 2026-10-02 20:05:09 +0700`, checklist tick hết, thêm §6 Sign-off (số đo, Exit Gates local ✅ / server ⬜, version, bàn giao, hồ sơ vòng đời).

## Bảng phân công thực tế
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| Đồng bộ chữ SPEC, bảng gates/OPERATIONS, sign-off | 🟢 | Claude Sonnet 5.5 (🟠, không có model thấp hơn trong phiên) |
| `docs/maintenance.md`, mô tả tầng an toàn/khẩn cấp, não 6 điểm | 🟠 | Claude Sonnet 5.5 (🟠) |

## KHÔNG làm + lý do
- Không đổi version app (`src/`, `package.json`…): theo Q33, đổi khi tích hợp `develop`; chỉ brain `current_version`.
- Không sửa `01-CONTRACTS.md`, `SPEC-P02/P03/P04`: ngoài danh sách được ghi của H08 (SPEC-P03/01 vẫn đúng; chữ chênh nằm ở SPEC-P01 §0.1 và 00 §8).
- Không đụng `README.md`, docs `01`–`05`, `data-contract-v1.md`, `playbook-v1.md` (còn ghi v0.3, CR-03 thắng; đã ghi ở roadmap Upcoming).
- Không chạy lại test/ruff (chỉ tài liệu); không commit report này; không push.
- Marker `brain4agent-v1.7.1.md` là khung não, không phải version dự án: không đổi.

## Câu hỏi mở
- Exit Gates cột server (G1–G4, G7) còn ⬜ đúng như Q33: cần chạy CI/Render sau khi rebase lên `feature/chamanh`.
- `01-CONTRACTS.md` §5.1/§5.3 chưa liệt kê ba khoá WP3d (`hedge_forms`, `homograph_confirmers`, `coordination_hazard_exclusions`) và nới V-08; chữ nguồn chân lý nằm ở `lexicon.yaml` + SPEC-P01 §0.1. Nếu SO muốn, mở thêm một gói đồng bộ riêng cho file đó (ngoài phạm vi H08).
- Mốc sign-off được ghi lúc 20:05:09, trước commit vài giây (commit `379c822`).

⏳ Chờ người duyệt.

SO đo lại 2026-10-02: init_brain --check EXIT=0 · không đụng src/tests/seed/scripts (0 file) · diff 16 file trong phạm vi H08 · kernel 48 dòng · brain current_version 1.1.0 · plan.md ✅ ĐÃ HOÀN THÀNH 2026-10-02 20:05:09 +0700. Câu hỏi mở: 01-CONTRACTS §5 chưa liệt kê 3 khoá WP3d ⇒ ghi roadmap, nguồn chân lý là lexicon.yaml + SPEC-P01 §0.1; Exit Gates server ⬜ chờ tích hợp develop.
✅ DUYỆT

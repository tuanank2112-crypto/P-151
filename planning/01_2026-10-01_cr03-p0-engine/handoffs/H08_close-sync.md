Bạn là worker của repo này. Loại: THI CÔNG TÀI LIỆU (đóng hồ sơ — KHÔNG sửa code, test, seed).
Bước 0: từ D:\P151 chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`, ghi exit code.
Thứ tự đọc: AGENTS.md §3.4, §4, §5.A–C → planning/01_2026-10-01_cr03-p0-engine/plan.md (TOÀN BỘ §2, đặc biệt Q17, Q31–Q33) → reports/R01…R10 (chỉ dòng phán quyết + số đo) → brain4agent/{memory-distill.txt,index.md,roadmap.md,changelog.md,-known-gotchas.md,project-intro.md,-data-architecture.md,memory/hot/today.md,memory/hot/state.json} → code thực tế src/maintenance/{safety,priority,engine}.py (chỉ để mô tả đúng, không sửa).

## 1. Bối cảnh
Hồ sơ 01 (CR-03 P0 cho engine) đã xong toàn bộ: WP2–WP5, WP3b–WP3d ✅, cổng thẩm định WP6 ✅ (Q32). Gói này đồng bộ tài liệu + não bộ + version và ký đóng hồ sơ theo Q33.
Nhánh `feature/nhuy-cr03-p0`. Base = `git rev-parse HEAD`.

## 2. Phạm vi
- ĐƯỢC GHI: `planning/01_2026-10-01_cr03-p0-engine/specs/{SPEC-P01-safety-layer.md,TESTING-ACCEPTANCE.md,OPERATIONS.md,00-ARCHITECTURE.md}` (chỉ đồng bộ chữ theo Q31–Q33, không đổi hành vi); `planning/01_2026-10-01_cr03-p0-engine/plan.md` (CHỈ: dòng Trạng thái, §4 checklist tick, thêm sign-off); `docs/CR-BPTN-03.md` (CHỈ §5.2 theo Q17 + §17 ghi D-09/Q-ref nếu cần); `docs/maintenance.md` (MỚI); toàn bộ `brain4agent/` (6 điểm + project-intro + -data-architecture); file report.
- CẤM: `src/`, `tests/`, `seed/`, `scripts/`, `.gitignore`, `README.md`, các docs khác. KHÔNG đổi version app trong `src/` (Q33).

## 3. Việc phải làm
1. Đồng bộ chữ SPEC theo Q31–Q33 (mô tả đúng code hiện có: `hedge_forms`, `homograph_confirmers`, `coordination_hazard_exclusions`, `is_invisible` mở rộng, validator cue 1 ký tự, regex S-09). TESTING X-2 = 403.
2. `docs/maintenance.md` (≤200 dòng): mục đích module, pipeline bước 2/2b/3…10, tầng an toàn (R1–R10 tóm tắt + giới hạn đã biết), luồng khẩn cấp (5 method công khai + chữ ký + lỗi 403/409/422), priority + `queue_sort_key`, khoá `sla_config`/lexicon, cách chạy test. Trỏ CR-03 và specs, không chép dài.
3. Não 6 điểm (AGENTS §5.B): index (thêm `safety.py`, `priority.py`, `lexicon.yaml`, `docs/maintenance.md`, planning 01), roadmap (Done hồ sơ 01; Active: merge `develop`, Q22 cho Trường, bàn giao endpoint cho Châm Anh/Trí; Idea Vault: `cancel_reason`/audit cancel, M8, M12, LLM raise-only P1, giới hạn đã biết), changelog `[v1.1.0] - 2026-10-02`, gotchas (bẫy bỏ dấu tiếng Việt, `git add -f` data test, hook Python alias), memory-distill (<100 dòng), `today.md` + `state.json` (`current_version` 1.1.0, `active_plans_completed` +1, kết quả đo cuối).
4. plan.md: Trạng thái `✅ ĐÃ HOÀN THÀNH` + mốc giờ đến giây (`date '+%Y-%m-%d %H:%M:%S %z'`), tick checklist, Exit Gates local ✅ / server ⬜.
Xong khi: `init_brain.js --check` exit 0; `wc -l brain4agent/memory-distill.txt` < 100; `git diff --stat <base>..HEAD` chỉ trong phạm vi; một commit local `docs(brain): close plan 01 CR-03 P0 engine and sync docs (v1.1.0)`. Không push.

## 4. Luật
Chỉ mô tả cái code ĐANG làm (đọc code để chắc); số đo lấy từ report/plan, không tự bịa. CẤM `--no-verify`, push.

## 5. Tầng
🟢/🟠 (tài liệu có mẫu; phần mô tả kỹ thuật 🟠).

## 6. Mẫu report
`planning/01_2026-10-01_cr03-p0-engine/reports/R11_close-sync.md`, KHÔNG commit: dòng 1 khai vai; dòng 2–4 Handoff/Base/Head; lệnh + exit; `git diff --stat`; bảng phân công; KHÔNG làm; Câu hỏi mở; dòng cuối trống. Trả về chat ≤20 dòng.

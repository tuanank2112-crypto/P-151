Bạn là worker của repo này. Loại: THI CÔNG (được ghi trong phạm vi dưới đây).
Bước 0: từ D:\P151 chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`, ghi exit code.
Thứ tự đọc: brain4agent/memory-distill.txt → brain4agent/-known-gotchas.md → planning/01_2026-10-01_cr03-p0-engine/plan.md (§2 Q01–Q20) → specs/OPERATIONS.md (dòng WP2) → specs/00-ARCHITECTURE.md → specs/01-CONTRACTS.md → specs/SPEC-P04-guards.md → specs/TESTING-ACCEPTANCE.md (dòng thuộc WP2).

## 1. Bối cảnh
Engine MaintenanceOps (`src/maintenance/`) đang cài CR-BPTN-03 P0 theo 4 gói tuần tự WP2→WP5. Gói này (WP2) chỉ dựng **contract**: enum, trường model, bảng chuyển trạng thái, chủ blocker, `sla_config`, chặn reopen/gán nhân viên. Chưa có logic an toàn (WP3), chưa có hành động BPTN/BQL (WP4), chưa có priority logic (WP5).
Nhánh `feature/nhuy-cr03-p0`. Base SHA: lấy bằng `git rev-parse HEAD` lúc bắt đầu, ghi vào report.

## 2. Phạm vi
- ĐƯỢC GHI / CẤM CHẠM: đúng cột tương ứng của dòng **WP2** trong `specs/OPERATIONS.md`. File ngoài cột ĐƯỢC GHI ⇒ không sửa; cần sửa ⇒ dừng, ghi "Câu hỏi mở".
- Luôn CẤM: `planning/` (trừ file report của bạn), `docs/`, `brain4agent/` (trừ `brain4agent/memory/hot/today.md`, xem §4), `src/api/`, `src/web/`.

## 3. Việc phải làm
Hiện thực mọi mục thuộc WP2 trong `01-CONTRACTS.md` và `SPEC-P04-guards.md` (phần reopen + `SET_ASSIGNEE`), kèm test mà `TESTING-ACCEPTANCE.md` gán cho WP2.
Xong khi (máy đọc được, venv Python 3.11 theo `OPERATIONS.md`, `LLM_MODE=mock`):
1. `python -m pytest -q -p no:cacheprovider` → exit 0, **số test ≥ 142 + số test mới**, 0 fail, 0 skip.
2. `python -m ruff check src tests` → exit 0; `python -m ruff format --check src tests` → exit 0.
3. Các lệnh đo M-xx thuộc WP2 trong `01-CONTRACTS.md` → kết quả đúng như SPEC ghi.
4. Một commit local Conventional Commits tiếng Anh, ví dụ `feat(engine): add CR-03 P0 contracts (WP2)`. Không push.

## 4. Luật
- Đọc code trước khi sửa; theo quy ước sẵn có (`_apply_transition`, `_mutate`, `engine.lock`, hàm bước `_step_<số>_<việc>`).
- Code khác SPEC ⇒ dừng mục đó, ghi drift; không tự chọn.
- Hook pre-commit bắt buộc commit có đổi ngoài `brain4agent/` phải kèm `brain4agent/memory/hot/today.md`: thêm ĐÚNG MỘT dòng nhật ký WP2 (số test, SHA trước). Không sửa file não khác.
- CẤM `--no-verify`, CẤM push, CẤM gọi LLM thật.
- Không leo model; thiếu quyết định ⇒ "Câu hỏi mở".

## 5. Tầng
WP2 🟠 (có SPEC + test tự biết đúng/sai). Không giao xuống tầng thấp hơn phần sửa contract.

## 6. Mẫu report
Ghi vào `planning/01_2026-10-01_cr03-p0-engine/reports/R01_wp2-contracts.md`:
- Dòng 1: `Vai: worker · loại: thi công · họ/model: <...> · Bước 0 exit: <n> · hiểu việc: <phạm vi / xong khi / cấm, bằng lời mình>`
- Dòng 2–4: `Handoff: H01_wp2-contracts.md` · `Base: <sha>` · `Head: <sha>`
- Lệnh + exit code nguyên văn; test tổng/pass/fail/skip; `git diff --stat <base>..HEAD`
- Bảng phân công thực tế (gói → tầng yêu cầu → họ/model đã dùng)
- Việc KHÔNG làm + lý do; Drift; Câu hỏi mở
- Dòng cuối để trống cho phán quyết của SO.
Report trả về chat: tóm tắt ≤30 dòng + đường dẫn file report.

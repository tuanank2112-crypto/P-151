1. Bạn là worker của repo này. Đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại THI CÔNG TÀI LIỆU, vai architect 🔴; KHÔNG sửa runtime (`src/`, `tests/`, `seed/`).
2. Bước 0: từ root chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`; ghi exit (ngoại lệ CRLF chỉ theo plan Q21).
3. Đọc kernel `brain4agent/memory-distill.txt` (dòng 21 = bất biến người dùng) → `brain4agent/-known-gotchas.md` mục "⚠ Kiểm trích dẫn bằng chuỗi con" → `docs/maintenance.md` → hồ sơ `planning/06_2026-10-05_reasoning-agent/`: `plan.md` Q01/Q02/Q05/Q28/Q29/Q30/Q34/Q35, `specs/SPEC-P01-reasoning-agent.md` §3, `SPEC-P08-audit-fixes.md` §2/§8, `SPEC-P09-semantic-coordination.md` §1–§4/§8, `01-CONTRACTS.md` §3, `TESTING-ACCEPTANCE.md` §6–§8, `OPERATIONS.md` §1.

## 1. Bối cảnh
- Bất biến người dùng (Q01/Q29/Q30, nhắc lại Q35 ngày 2026-10-10): ngữ nghĩa do LLM suy luận, KHÔNG khớp từ khoá/câu chữ. Q35 xác định: dùng chuỗi con/khoảng ký tự của trích dẫn (quote) làm CỔNG CHẶN đầu ra LLM cũng là khớp chữ. Người dùng đã DUYỆT hướng: **LLM quyết; code chỉ kiểm giá trị có trong danh mục đóng (`catalog.yaml`, enum, ứng viên engine đưa vào); quote chỉ để hiển thị/audit, không chặn.**
- Vi phạm đã biết (code `4533b15`): `src/maintenance/agent/validate.py` `grounded()` + `_check_location()` huỷ cả vị trí nếu quote không là chuỗi con của câu cư dân; `src/maintenance/agent/baseline.py` `mirror_decision` chép nguyên `location_text` làm quote giả để qua cổng. P09 B1 (giao span) / B2 (quote đủ 3 thành phần) cùng loại. Có thể còn chỗ khác — phải tự kiểm kê.
- Nhánh `feature/nhuy-reasoning-agent`; ghi Base = `git rev-parse HEAD`, `git status --porcelain` trước khi ghi. Không đụng `.claude/worktrees/`, `scratch/`, `evidence/WP16-review-v6/`. Không đọc/in `.env`, không gọi mạng/LLM.

## 2. Phạm vi
- ĐƯỢC GHI: `specs/SPEC-P10-catalog-not-quote.md` (mới, PROPOSED); `handoffs/H18_thi-cong_WP19.md` (mới); `reports/R17_thi-cong_WP18.md`; `evidence/WP18/*.txt`; MỘT dòng banner `> ⚠ Bị thay thế bởi SPEC-P10 §x (Q35)` ngay dưới tiêu đề mỗi mục bị thay thế trong P01/P08/P09; `specs/REF-agent-contract.py` CHỈ khi P10 đổi schema/validator tham chiếu (selftest phải exit 0).
- CẤM: sửa thân SPEC cũ ngoài banner; sửa `plan.md`, `src/`, `tests/`, `seed/`, `lexicon.yaml`, bộ held-out; commit/stage/push; phóng worker runtime.

## 3. Việc phải làm + xong khi
- **Kiểm kê**: liệt kê MỌI chỗ trong `src/maintenance/` (agent/, engine, coordination/, safety, rules) mà kết quả khớp chuỗi/span của quote hoặc của câu cư dân quyết định CHẤP NHẬN/LOẠI đầu ra LLM (vị trí, loại việc, job, tín hiệu an toàn, tách, trùng, next_step). Lưu lệnh grep + output vào `evidence/WP18/inventory.txt`; mỗi chỗ một dòng `file:line · trường · hành vi hiện tại · phân loại (cổng chặn LLM | lưới sàn luật hợp lệ | chỉ audit)`.
- **P10 cho từng cổng chặn LLM**: hành vi mới chính xác (chữ ký hàm, kiểu trả về, đường dẫn `rejected`), kiểm danh mục thay thế, quote thành trường audit (có thể rỗng) — kể cả đường Mirror/luật (không bịa quote). Lưới sàn luật an toàn (`lexicon.yaml`, Q02/Q30) GIỮ; nêu rõ vì sao nó không phải cổng chặn LLM. Với tín hiệu an toàn: khớp chữ KHÔNG được làm mất một lần NÂNG mức của Agent (Q02 chỉ nâng).
- Chống bịa vị trí KHÔNG bằng câu chữ: chỉ được dùng danh mục, khoá vị trí của người/BPTN (`LockedFields`), luồng hỏi cư dân/BPTN khi Agent tự báo thiếu, và audit. Nêu rủi ro còn lại + ai chịu (BPTN xem lại) — không lén thêm từ điển câu cư dân.
- **Bảng mục bị thay thế**: P01 §3.x, P08 §2, P09 §3/§4.2 (B1/B2), Q28-F3, phần Q34 — từng dòng "cũ → mới"; không để hai luật trái nhau cùng hiệu lực. Đặt banner tương ứng.
- **Test**: kể tên test hiện ghim cổng quote (vd `tests/test_maintenance/test_p1_audit_fixes_safety.py` các ca F3, đột biến b/e/f trong `evidence/WP14-v2/`) và hành vi mới của từng test (đổi khẳng định/xoá/thêm). Ca bắt buộc mới: vị trí diễn đạt khác câu cư dân nhưng có trong danh mục ⇒ NHẬN; giá trị ngoài danh mục ⇒ loại đúng trường; quote trống ⇒ vẫn nhận; Mirror không sinh quote giả; Agent nâng an toàn với quote không khớp ⇒ vẫn nâng. Test cơ chế dùng client giả nêu điều luật KHÔNG thấy (gotcha `SeesDanger`); năng lực đo live bằng `scripts/agent_live_eval.py` (`LLM_MODE=agy_cli`) — chưa chạy thì NOT_RUN, cấm bịa số.
- P10 đủ AGENTS §3.2.2: contract chính xác, BẮT BUỘC/CẤM/vùng cấm (kèm lý do), bảng lỗi → hành vi caller, rollback, số đo nghiệm thu thật.
- **H18** (THI CÔNG runtime 🟠) ≤80 dòng, 3 dòng đầu + 6 mục, chỉ TRỎ P10 theo số mục, phạm vi file tường minh, "xong khi" = lệnh + kết quả máy đọc (pytest tổng/pass/fail/skip, ruff, đột biến phải đỏ), report `reports/R18_thi-cong_WP19.md`. Ghi CHỜ DUYỆT P10.
- **Đo**: `git diff --check` exit 0; mọi link nội bộ trong P10/H18 tồn tại; `wc -l` H17/H18 ≤80; nếu sửa REF thì chạy selftest theo OPERATIONS §1 exit 0; checklist các gạch đầu dòng trên đạt/thiếu. Output máy vào `evidence/WP18/package-check.txt`.

## 4. Luật
- Câu hỏi đầu cho mọi quyết định: "việc của LLM hay của luật?". Đơn giản nhất đáp ứng Q35; không mở thêm kiến trúc (vòng tool, schema P09 mới) nếu Q35 không cần. P09 phần ngoài B1/B2 giữ PROPOSED, không đụng.
- Không nới ngưỡng/nhãn TESTING §6; không chỉnh prompt trên held-out. Thiếu dữ kiện cần người quyết ⇒ ghi câu hỏi, không tự chọn hướng lệch Q35.

## 5. Tầng
- WP18 contract/kiến trúc: 🔴, tự làm, không agent con. WP19 trong H18: 🟠.

## 6. Report
- Dòng 1: `Vai · thi công · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4: `Handoff: handoffs/H17_thi-cong_WP18.md`, `Base: <SHA>`, `Head: <SHA; working tree chưa commit>`.
- Lệnh + exit nguyên văn, số mục kiểm kê (tổng / cổng chặn LLM / lưới sàn / audit), số mục checklist đạt/thiếu, `git diff --stat` + file untracked trong phạm vi, bảng phân công, việc KHÔNG làm + lý do, câu hỏi cần người. Dòng cuối: `⏳ Chờ người duyệt.`
Report: `planning/06_2026-10-05_reasoning-agent/reports/R17_thi-cong_WP18.md` · Evidence: `planning/06_2026-10-05_reasoning-agent/evidence/WP18/`

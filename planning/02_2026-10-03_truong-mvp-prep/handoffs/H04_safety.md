Bạn là worker của repo này. THI CÔNG WP4.
Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`; thiếu hub exit 1, báo và không sửa luật.
Thứ tự đọc: memory-distill.txt → index.md → specs/SPEC-P04-SAFETY.md → docs/CR-BPTN-03.md §6.

## 1. Bối cảnh
D01 user confirmed, group pending. Package chuẩn bị MVP; không tích hợp runtime. SPEC-P04-SAFETY.md là contract độc lập.

## 2. Phạm vi
Được ghi src/maintenance/safety.py, tests/test_maintenance/test_safety_p0.py, seed/maintenance_cr03/safety_cases.json, SPEC-P04-SAFETY.md, H04/R04 và evidence/wp4/*.txt.
CẤM engine/models/rules/proposer, fixtures baseline, tài liệu của worker khác; không stage/commit/push.

## 3. Việc phải làm / xong khi
Thực hiện public API và dataset contract của SPEC-P04-SAFETY.md, P0 CR03 §6.
`python -m pytest tests/test_maintenance/test_safety_p0.py -q -p no:cacheprovider` → exit 0, ≥28 labelled independent examples, 0 skip.
`ruff check --no-cache src/maintenance/safety.py tests/test_maintenance/test_safety_p0.py` → exit 0.
`ruff format --no-cache --check src/maintenance/safety.py tests/test_maintenance/test_safety_p0.py` → exit 0.
In coverage dataset; chạy independent tests với S-02 cố tình hỏng trong process riêng → exit 1; source nguyên vẹn chạy lại → exit 0.

## 4. Luật
Đúng SPEC: frozen objects, exact quote, clause-scope negation, uncertain/history UNCLEAR, prior-risk max, S14 hai PRESENT, P1 không kích hoạt, input là data.
Mỗi event mới quét safety; không tự hạ risk. Không spawn (người dùng giới hạn số agent).

## 5. Tầng
WP4 logic + gold tests + evidence: 🟠; không có decision ngoài SPEC. Họ/model kế thừa phiên hiện tại.

## 6. Report
R04_safety.md dòng 1 khai vai/model/boot/hiểu việc; dòng 2–4 Handoff/Base/Head.
Lệnh/exits nguyên văn, counts, git diff stat + SHA, phân công thực tế, không làm/lý do, câu hỏi. Evidence chỉ trỏ, không sửa tay output. Dòng cuối phán quyết.

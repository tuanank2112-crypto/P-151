Vai: worker · THI CÔNG WP1 · tầng 🟢 · không spawn thêm.
Bước 0: node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check; hub thiếu ghi exit, không sửa luật.
Thứ tự đọc: brain4agent/memory-distill.txt → brain4agent/index.md → specs/00-ARCHITECTURE.md → docs/CR-BPTN-03.md.
# H01 — Scope documentation
## Bối cảnh
Chuẩn bị gói Trường 01/10–02/10, MVP 04/10, ngày làm thật 2026-10-03. Group approval PENDING. D-01 user-confirmed; D-02..07 proposed defaults; D-08 chưa có approver.
## Phạm vi
Được ghi specs/00-ARCHITECTURE.md, handoffs/H01_scope.md, reports/R01_scope.md, evidence/wp1/*.txt của package 02_2026-10-03_truong-mvp-prep.
Cấm mọi file khác, runtime, stage/commit/push và managed rules. Không sửa cache ngoài workspace.
## Việc phải làm và xong khi
Hoàn thiện architecture theo specs/00-ARCHITECTURE.md §1–5. Không tự quyết contract mới.
Xong khi PowerShell đo 8 decision ID, 4 demo ID và 4 lớp gate; output evidence/wp1/measurements.txt có failed=0, command exit 0.
Lệnh đo: Get-Content -Encoding UTF8 specs/00-ARCHITECTURE.md; kiểm regex D-01..08, DEMO-01..04, local documents/group/runtime local/online.
Root đo lại độc lập; số đo này không chứng nhận runtime hoặc group approval.
## Luật
Ngày thực hiện không backdate. Cấm bịa approver/date, số test, model, hoặc claim safety đã implement.
Cấm full old raw vào LLM, auto downgrade risk hoặc return sớm bỏ safety: theo architecture §3 và 01-CONTRACTS D-01.
Scope Notion và vùng cấm: architecture §2/§4. Gate phân môi trường: §5.
## Tầng
WP1 transcription/documentation 🟢; root đã quyết scope và contract. Model kế thừa phiên; không chuyển model và không spawn.
## Mẫu report
Dòng 1: vai/loại/model/Bước 0/hiểu việc; dòng 2–4: Handoff:/Base:/Head:.
Lệnh + exit; test total/pass/fail/skip; diffstat SHA; bảng gói/tầng/model; việc không làm + lý do; câu hỏi cần người.
Evidence chỉ output máy. Dòng cuối phán quyết ✅/🔁/⛔; chưa tự nhận group/runtime sign-off.

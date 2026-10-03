Vai: worker (vai-thi-cong) · THI CÔNG · model: kế thừa phiên, không có metadata tên model xác minh · Bước 0 exit 1 · hiểu việc: chỉ tài liệu WP1, xong khi đủ router/scope/contract/gates; cấm runtime và ngoài phạm vi.
Handoff: planning/02_2026-10-03_truong-mvp-prep/handoffs/H01_scope.md
Base: 10a1d5452b37e2421ed6a5efec6be82b9179115b
Head: 10a1d5452b37e2421ed6a5efec6be82b9179115b (working tree, không commit)

| Lệnh | Exit | Số đo / evidence |
|---|---|---|
| node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check | 1 | evidence/wp1/boot.txt; MODULE_NOT_FOUND |
| PowerShell content contract measurement | 0 | evidence/wp1/measurements.txt; 23 total / 23 pass / 0 fail / 0 skip; kiểm tài liệu |
| Get-Content handoffs/H01_scope.md; .Count | 0 | 24 dòng, <=80 |
| git diff --stat -- WP1 paths | 0 | 0 tracked changes; WP1 files untracked |
| git diff --no-index --stat -- NUL WP1 file | 1 mỗi file | evidence/wp1/diffstat.txt; 1 = khác NUL, không phải lỗi nghiệm thu |

Runtime tests: không chạy trong WP1; không claim số test code.
SHA: 10a1d5452b37e2421ed6a5efec6be82b9179115b.

| Gói | Tầng yêu cầu | Phân công thực tế |
|---|---|---|
| WP1 scope transcription/documentation và tự đo | 🟢 | Agent kế thừa phiên; không override model, không spawn |
| Review nghiệm thu | Root | Chưa thực hiện bởi WP1; root đo lại độc lập |

Không làm: runtime/schema/API, stage/commit/push, file ngoài phạm vi, managed rules; giới hạn handoff.
Cần người: group approval D-01..08 và D-08 approver/date chưa có; root giữ cổng pending.
🖐 Cần tay người: nhóm duyệt quyết định, ghi approver/thời điểm thật.
🤖 Agent làm được ngay: root đo lại tài liệu và tiếp nhận WP1.
⭐ Nên làm trước: root kiểm đồng nhất D-01 giữa SPEC; tránh contract lệch khi triển khai.
⏸ Chưa làm: runtime/online nghiệm thu, ngoài scope WP1.
✅ WP1 đã nộp số đo tài liệu; không phải group/runtime sign-off.

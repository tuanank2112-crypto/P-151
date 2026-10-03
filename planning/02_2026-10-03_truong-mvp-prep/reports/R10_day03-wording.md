Worker · thi công · Haiku 4.5 · Bước 0 exit 1 (MODULE_NOT_FOUND hub; không sửa managed rules) · D3-05 rà wording + quyền 4 vai; ghi 4 record JSON + D3-05-wording.md + evidence; không hứa quá mức chức năng chưa tích hợp
Handoff: ../handoffs/H10_day03-wording.md
Base: 0ea04adedd023654947e2e97e645043f0ba89159
Head: 0ea04adedd023654947e2e97e645043f0ba89159 (working tree)

**Lệnh + exit 0:**
- Phân tích src/maintenance/i18n/vi.yaml (status_labels, status_messages, reason_messages)
- Phân tích src/maintenance/views.py (ResidentTicketView allow-list, rating/reopen actions views.py:24,78-81)
- Phân tích src/api/routers/maintenance.py (endpoints bptn-resolve:431, accept:441, ..., close:693, ...)
- Ghi evidence + sửa D3-05-wording.md + D3-05.json

**Kết quả ghi nhận:**
| task_id | actor_role | result | block_reason |
|:---|:---|:---|:---|
| WORD-01 | RESIDENT | BLOCKED | Safety Bậc 2 + rating-once + reopen cấm chưa implement |
| WORD-02 | BPTN | BLOCKED | Bậc 2 safety (confirm-safe/escalate/need-info) chưa có route/engine |
| WORD-03 | DEPARTMENT | PASS | Workflow ĐÚNG quyền, không hứa quá mức |
| WORD-04 | BQL | BLOCKED | Bậc 1 khẩn cấp (EMERGENCY_*) chưa có route/engine |

**Git diff --stat (working tree, không commit):** 5 file +419/-0

**Phân công:** D3-05 🟢 Haiku 4.5 (static code review)

**Câu hỏi mở:** Như Ý tích hợp 3 action Bậc 2 + 4 action Bậc 1 + rating-once guard + reopen cấm khi?

## Root đo lại (2026-10-03)

Root đo lại sau 🔁 lần 1: observed_at=11:12:43 khớp đồng hồ, Base/Head đúng, evidence_refs thuần và tồn tại, file:dòng bptn-resolve 431/accept 441/close 693/rework 699/cancel 710 khớp mã nguồn; WORD-01/02/04 = BLOCKED owner Như Ý (phần safety/rating-once/reopen chưa tích hợp), WORD-03 = PASS. Chỉ rà văn bản + quyền theo mã; chưa đo UI render và chưa đo quyền API ở gói này. Báo cáo gốc kết thúc bằng '🔁' do worker chép dòng phán quyết của root; root thay bằng phán quyết dưới.

✅ DUYỆT (D3-05: đã rà 4 vai; 3 BLOCKED là chức năng chưa tích hợp, không phải lỗi gói; không khẳng định UI/API quyền đạt)

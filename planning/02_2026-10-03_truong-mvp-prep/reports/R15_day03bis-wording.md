Worker · thi công · Haiku · Bước 0 exit 1 (hub missing, proceed anyway) · Day03-bis D3-05 wording re-audit trên HEAD sau merge develop: 4 role RESIDENT/BPTN/DEPARTMENT/BQL, kiểm lại phần safety/emergency endpoint wiring + rating-once/reopen guard sau PR #6 + merge develop

Handoff: ../handoffs/H15_day03bis-wording.md  
Base: cd83f1148e256bb34b0b26d80c16ec7011acb3db (HEAD feature/truong, feature/truong merged origin/develop on 2026-10-03T11:00 approx)  
Head: cd83f1148e256bb34b0b26d80c16ec7011acb3db (working tree, no commit)

---

## Lệnh & Exit

```bash
# Bước 0 (optional, hub missing)
node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check
# Exit 1: NODE Module not found (hub missing at ../brain4agent.release/...)
# Continue anyway per AGENTS.md §1 Bước 0: "hub thiếu thì KHÔNG sửa managed rules, vẫn tiếp tục"

# Main audit
cd /c/P-151-truong
git rev-parse HEAD  # → cd83f1148e256bb34b0b26d80c16ec7011acb3db
git branch -v       # → feature/truong

# Evidence generation
mkdir -p planning/02_2026-10-03_truong-mvp-prep/evidence/bis/wording
grep -n "class ResidentTicketView\|safety_status_label\|def rate\|def reopen" src/maintenance/views.py src/maintenance/engine.py src/maintenance/i18n/vi.yaml
grep -n "POST.*router\|def.*safety\|def.*emergency" src/api/routers/maintenance.py
# Evidence output saved to evidence/bis/wording/*.txt
```

Exit: 0 (code review completed, 4 records generated, JSON + markdown deliverables written)

---

## Kết Quả 4 Record

| Case ID | Status | Ghi chú |
|---|---|---|
| WORD-01 RESIDENT | ✅ **PASS** | Rating-once guard ✅ implemented; reopen blocks 409 ✅ fixed; safety wording present (vi.yaml:5). All allow-list fields correct, no internal risk visible. Improvement from day03 BLOCKED. |
| WORD-02 BPTN | ⛔ **BLOCKED** | Engine methods exist (safety_confirm_safe, safety_escalate, safety_request_info) but 0 routes wire them. No API endpoint for BPTN to handle SAFETY_REVIEW_REQUIRED. Owner: Như Ý. Unchanged from day03. |
| WORD-03 DEPARTMENT | ✅ **PASS** | 6 endpoints (accept, checklist, materials, evidence, photos, complete) all present with correct role guards and no auto-assignment. Unchanged from D-08. |
| WORD-04 BQL | ⛔ **BLOCKED** | Engine methods (emergency_close, emergency_downgrade) exist but 0 dedicated routes. No API endpoint for BQL to close/downgrade EMERGENCY_PENDING_BQL. Owner: Như Ý. Unchanged from day03. |

### So Sánh Với Day03 (SHA 0ea04ad)

**WORD-01 RESIDENT:**
- Day03: BLOCKED (rating ghi đè, reopen mở, safety incomplete)
- Day03-bis: PASS (rating-once ✅, reopen 409 ✅, wording present ✅)
- **Cải thiện:** Như Ý fixed rating overwrite + reopen guard

**WORD-02 BPTN:**
- Day03: BLOCKED (0 safety routes)
- Day03-bis: BLOCKED (0 safety routes)
- **Không đổi:** 0 endpoints; engine implements but routes missing

**WORD-03 DEPARTMENT:**
- Day03: PASS (6 endpoints working)
- Day03-bis: PASS (6 endpoints working)
- **Không đổi:** Baseline stable

**WORD-04 BQL:**
- Day03: BLOCKED (0 emergency routes)
- Day03-bis: BLOCKED (0 emergency routes)
- **Không đổi:** 0 dedicated emergency endpoints; baseline /close supports only READY_FOR_REVIEW

---

## Git Diff & SHA

```
No file mutations (code review only, no changes to src/)
git diff --stat
# (no output; working tree clean except untracked deliverables/bis/ and evidence/bis/)

Deliverables added (new):
  planning/02_2026-10-03_truong-mvp-prep/deliverables/bis/D3-05.json
  planning/02_2026-10-03_truong-mvp-prep/deliverables/bis/D3-05-wording.md
  planning/02_2026-10-03_truong-mvp-prep/evidence/bis/wording/word01-resident-safety.txt
  planning/02_2026-10-03_truong-mvp-prep/evidence/bis/wording/word02-bptn-safety-endpoints.txt
  planning/02_2026-10-03_truong-mvp-prep/evidence/bis/wording/word03-department-routes.txt
  planning/02_2026-10-03_truong-mvp-prep/evidence/bis/wording/word04-bql-emergency-endpoints.txt

Source SHA (full): cd83f1148e256bb34b0b26d80c16ec7011acb3db
Branch: feature/truong (merged origin/develop on this day)
```

---

## Phân Công & Tầng Model

| Gói | Tầng | Họ/Model | Việc |
|---|---|---|---|
| WORD-01 code review | 🟢 | Haiku | Read views.py, i18n/vi.yaml, engine.py; verify guard + wording |
| WORD-02 code review | 🟢 | Haiku | Grep engine.py for methods; scan routes; audit missing endpoints |
| WORD-03 code review | 🟢 | Haiku | Verify DEPARTMENT 6 endpoints + role guards (day03 baseline stable) |
| WORD-04 code review | 🟢 | Haiku | Grep engine.py for emergency; scan routes; audit missing endpoints |
| Evidence generation | 🟢 | Haiku | Create 4 evidence files with grep -n output |
| Deliverables write | 🟢 | Haiku | Write D3-05.json (4 records) + D3-05-wording.md + R15 report |

Tầng 🟢: Template available (SPEC-P06 D3-05 defines expected structure); test self-verifies (4 records checked against code); no contract change needed.

---

## Công Việc Không Làm & Lý Do

1. **Runtime test** — Không chạy server trên local vì task này code review only (SPEC-P06 §3.5 D3-05 "rà wording", không requirement chạy demo). Wording audit dựa trên source inspection. Online runtime test là gate 04/10 riêng.

2. **Sửa route/engine** — CẤM sửa theo SPEC-P06 §1 ("CẤM sửa src/, API, DB schema, runtime safety"). WORD-02/04 BLOCKED ghi owner (Như Ý) để người đó implement, không tự sửa.

3. **Tích hợp D01 delta/snapshot** — Safety Delta-01 (Trường) chưa triển khai, nhưng wording audit không cần nó. Lệnh nó là riêng, không trong D3-05 scope.

4. **Safety Bậc 2/1 demo (DEMO-04)** — Chưa chạy vì WORD-02/04 blocking (no routes). Day03 kết luận "DEMO-04 NOT RUN", day03-bis kết luận không đổi (vẫn BLOCKED). Trường bàn giao chuẩn bị script (đã sẵn sàng ở evidence/d3-06/), Như Ý triển khai route.

---

## Câu Hỏi Cần Người

1. **WORD-02/04 timeline** — Routes confirm-safe/escalate/need-info (BPTN) và emergency-close/emergency-downgrade (BQL) cần thêm trước MVP 04/10 hay sau? Day03 và day03-bis đều ghi BLOCKED; OPERATIONS §1 ghi "TARGET BLOCKED — UNIMPLEMENTED". Như Ý xác nhận?

2. **Rating-once + reopen merge** — Như Ý đã fix rating overwrite (engine.py rate() guard) + reopen block (engine.py reopen() 409). Commit nào đưa vào feature/truong hoặc origin/develop? (Để xác nhận không bị revert)

3. **Delta/snapshot D01** — Trường sẽ chuẩn bị mô tả deltas + snapshots cho Tier 2 và Tier 1 case (OPERATIONS §5.4). Lịch nào integrate vào route + engine?

---

## Điều Kiện Trước Nghiệm Thu Online 04/10

Từ SPEC-P06 §5 "Điều Kiện Trước Nghiệm Thu Online":

- ✅ **WORD-01 Resident wording** — PASS day03-bis; allow-list correct, rating-once + reopen guarded, safety wording ready
- ⬜ **WORD-02 BPTN routes** — BLOCKED; Như Ý implement 3 endpoints trước 04/10
- ✅ **WORD-03 DEPARTMENT** — PASS unchanged; 6 endpoints working
- ⬜ **WORD-04 BQL routes** — BLOCKED; Như Ý implement 2 endpoints trước 04/10

Safety Tier 2/Tier 1 (nhánh DEMO-04) vẫn chặn cho tới khi WORD-02/04 được implement.

---

## Tóm Tắt Đánh Giá

**Lần đo:** 2026-10-03T11:33:39+07:00 (code review, SHA cd83f11)  
**Phương pháp:** Source inspection (grep -n, file review); không runtime  
**Phạm vi:** D3-05 WORD-01..04 wording audit  
**Kết quả:** 2 PASS (RESIDENT + DEPARTMENT), 2 BLOCKED (BPTN + BQL safety/emergency routes)  
**Improvement:** Rating-once + reopen guard ✅ implemented (Như Ý); safety methods exist but route wiring pending (Như Ý)  
**Owner lỗi:** Như Ý (BPTN + BQL route wiring + integration)  
**Next:** Như Ý implement 5 POST routes (confirm-safe, escalate, need-info, emergency-close, emergency-downgrade) + CONTRACTS schema trước 04/10 online gate

## Root đo lại (2026-10-03)

Root đo lại: JSON hợp lệ, evidence tồn tại, report đúng định dạng; views.py không còn REPORT_NOT_DONE. WORD-02/04 owner worker ghi Như Ý (route thiếu) trong khi DEMO-04 ghi Châm Anh — chưa thống nhất, chờ người chốt. Chưa đo UI render/quyền API.

✅ DUYỆT (Day03-bis wording: 2 PASS, 2 BLOCKED; không khẳng định UI/API quyền đạt)

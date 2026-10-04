# Day03-ter D3-05 — Wording Audit BPTN/BQL Safety Routes

**Observed at:** 2026-10-03T12:38:41+07:00  
**Branch:** feature/nhuy-safety-routes (PR #10)  
**Worktree SHA:** 92649a6152737154cca606f3ce94d3f0ec0e0273 (detached, no commit)  
**Environment:** Code review + router inspection (no runtime)

---

## Summary

Compared against Day03-bis baseline (WORD-02/04 BLOCKED). Day03-ter (worktree ter, PR #10) shows both WORD-02 and WORD-04 now **PASS** — routes wired, UI wording complete, no overpromise.

| Case | Day03-bis | Day03-ter | Change |
|---|---|---|---|
| **WORD-02** (BPTN safety × 3) | BLOCKED | **PASS** | ✅ Route POST /mo/tickets/{id}/safety implemented; 3 choices in UI (Xác nhận an toàn / Yêu cầu bổ sung / Nâng khẩn cấp); schema + i18n complete |
| **WORD-04** (BQL emergency × 2) | BLOCKED | **PASS** | ✅ Routes POST /bql/tickets/{id}/emergency/close + /emergency/downgrade implemented; 2 actions in UI (Đã xử lý, đóng / Báo nhầm, hạ xuống); no overpromise |

---

## WORD-02: BPTN Bậc 2 Safety — 3 Choices

### Route
- **Endpoint:** `POST /mo/tickets/{ticket_id}/safety` (src/api/routers/maintenance.py:443)
- **Schema:** `SafetyRequest` with `decision: Literal["CONFIRM_SAFE", "REQUEST_INFO", "ESCALATE"]`
- **Engine methods:** `safety_confirm_safe()`, `safety_request_info()`, `safety_escalate()` all wired

### UI Wording (src/web/app.js:913–923)
1. **Xác nhận an toàn (Bác nguy cơ)** — decision: CONFIRM_SAFE
   - Help: "Bắt buộc ghi rõ lý do hiện trường an toàn; ticket chuyển về luồng phân loại thường."
   
2. **Yêu cầu cư dân bổ sung** — decision: REQUEST_INFO
   - Help: "Gửi yêu cầu làm rõ hiện trường tới cư dân (chuyển sang Chờ bổ sung thông tin)."
   
3. **Nâng mức Khẩn cấp (Bậc 1)** — decision: ESCALATE
   - Help: "Phát hiện nguy cơ nghiêm trọng, nâng lên BQL xử lý khẩn cấp ngay."

### Localization
- `SAFETY_REVIEW_REQUIRED` → "Phản ánh đang được kiểm tra."
- `NEED_INFO` (T06 safety) → Vietnamese labels present
- No risk_level exposed to resident

### Verdict
✅ **PASS**  
All 3 choices match CR-03 §6.4 exactly. Route wired, schema correct, wording Vietnamese complete. No overpromise of missing features.

---

## WORD-04: BQL Bậc 1 Emergency — 2 MVP Actions

### Routes
- **Endpoint 1:** `POST /bql/tickets/{ticket_id}/emergency/close` (src/api/routers/maintenance.py:737)
- **Endpoint 2:** `POST /bql/tickets/{ticket_id}/emergency/downgrade` (src/api/routers/maintenance.py:743)
- **Schema:** `EmergencyNoteBody` (note required)
- **Engine methods:** `emergency_close()`, `emergency_downgrade()` both wired

### UI Wording (src/web/app.js:1236–1252)
1. **Đã xử lý, đóng khẩn cấp** — engine.emergency_close()
   - Help: "Xác nhận lực lượng chức năng đã dập tắt nguy cơ và xử lý an toàn."
   - Sets: `closure_kind=EMERGENCY_HANDLED`
   
2. **Báo nhầm, hạ xuống BPTN** — engine.emergency_downgrade()
   - Help: "Bắt buộc nhập lý do khẳng định đây là báo nhầm hoặc không có nguy cơ khẩn cấp."
   - Sets: `safety_cleared_*`

### Localization
- `EMERGENCY_PENDING_BQL` → "Phản ánh đang được kiểm tra."
- No risk_level exposed to resident

### Scope
- **MVP (Gate):** emergency-close ✓, emergency-downgrade ✓
- **Post-MVP (Deferred):** follow-up, merge, cancel — **not exposed** ✓

### Verdict
✅ **PASS**  
Both endpoints match CR-03 §6.5 MVP exactly. Wording not overpromise. UI complete and wired.

---

## Comparison with Day03-bis

| Aspect | Day03-bis | Day03-ter |
|---|---|---|
| BPTN route wired | ❌ 0 safety endpoints | ✅ POST /mo/tickets/{id}/safety |
| BPTN UI 3 choices | ❌ Not yet exposed | ✅ Line 916–923 complete |
| BQL route wired | ❌ 0 emergency endpoints | ✅ 2 POST /bql/tickets/{id}/emergency/* |
| BQL UI 2 actions | ❌ Not yet exposed | ✅ Line 1236–1252 complete |
| i18n Vietnamese | ⚠️ Partial | ✅ Complete |
| No overpromise | ✓ Engine logic OK | ✓ Routes + wording OK |

---

## Owner & Dependencies

- **Wording & UI:** Trí (complete in PR #10)
- **Route & Engine:** Như Ý (wired in PR #10)

Both WORD-02 and WORD-04 unblocked; DEMO-04 can proceed.

---

## Evidence

- `evidence/ter/wording/word02-bptn-safety.txt` — full audit BPTN routes + UI
- `evidence/ter/wording/word04-bql-emergency.txt` — full audit BQL routes + UI

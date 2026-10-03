# D3-06 — Chạy thử bốn script demo (ghi chú tái hiện)

Branch `feature/truong` · SHA `0ea04adedd023654947e2e97e645043f0ba89159` · môi trường local, in-process FastAPI TestClient (không bind cổng), ép `MO_STORE=memory LLM_MODE=mock MO_PHOTO_STORE=local APP_ENV=development MO_ALLOW_RESET=false MO_JOBS_ENABLED=false`, mỗi nhóm một interpreter mới; `GET /health` 200 và settings hiệu lực được assert trước mutation. Dữ liệu SIMULATED. Runtime/online chưa nghiệm thu.

Tái hiện: từ root repo, `PYTHONPATH=. python planning/02_2026-10-03_truong-mvp-prep/evidence/d3-06/harness.py <nhóm>` với nhóm = `g1a g1b g1r g2 g2neg g3 g4a g4b`. Output máy: `evidence/d3-06/<nhóm>.txt` + `<nhóm>-exit.txt` (request che auth, status/body, timestamp, actor; GET ticket/events/audit/notifications; GET resident view). Không lưu token/password.

## Bảng nhóm

| Nhóm | Actor | Input | Thao tác (OPERATIONS) | Expected | Actual | Evidence | Prerequisite + trạng thái chạy thử | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| DEMO-01A vệ sinh | QA, vesinh01, bptn01, bql01 | `SIM-TKT-CLN-001` | §2 bước 1-7; âm: accept sai department, BPTN accept, close sớm, department/BPTN tự close | ROUTED -> IN_PROGRESS -> READY_FOR_REVIEW -> BQL CLOSED, assignee null | 26/26 check OK, exit 0 | `g1a.txt` | Seed đã ROUTED; process memory mới. Đã chạy thử local: PASS | PASS |
| DEMO-01B đèn | QA, kythuat01, bptn01, bql01 | `SIM-TKT-TEC-001` (asset SIM-ASSET-LIGHT-001) | như 01A, nhánh kỹ thuật | như 01A | 26/26 OK, exit 0 | `g1b.txt` | độc lập với 01A (process riêng). Đã chạy thử local: PASS | PASS |
| DEMO-01-RATING | cudan01 | `SIM-TKT-CLN-001` CLOSED | §2 bước 8: rating 5 rồi 1 | lần 2 = 409, rating giữ 5, không audit mới | lần 2 = 200, rating 5 -> 1, audit RATE_TICKET 1 -> 2; 28/31 OK | `g1r.txt` | cần CLOSED (chạy lại luồng 01A). Target rating-once CHƯA triển khai (engine.py:548-553). Chạy thử: FAIL | FAIL, owner Như Ý |
| DEMO-02 NEED_INFO | bptn01, qa01 | `SIM-TKT-CLN-003` raw trắng | §3.1 + âm 409/403 (process `g2neg` riêng) | ROUTED sau resolve, raw vẫn trắng, addition do BPTN, 409 không append dở | khớp (13/13 và 10/10) | `g2.txt`, `g2neg.txt` | không cần stock/safety. Chạy thử: PASS | PASS |
| DEMO-02 ASSET_UNCLEAR | bptn01, kythuat01 | `SIM-TKT-TEC-002` | §3.2 + âm 409/403 | ROUTED, ASSET_CHECK_ONSITE, ONSITE_BY_BPTN; thiếu note 409 | khớp | `g2.txt`, `g2neg.txt` | không bịa asset/sửa catalog. Chạy thử: PASS | PASS |
| DEMO-03 vật tư | qa01, kho01 | `SIM-TKT-TEC-003`, `SIM-MAT-LAMP-02` qty 2 stock 0 | §4 bước 1-5 | stock 0->1 vẫn ON_HOLD, 1->2 resume từ lookup asset -> ROUTED | khớp, 21/21 OK; stock before/after 0 -> 1 -> 2 | `g3.txt` | cần stock catalog ban đầu 0 (bộ seed). Chạy thử: PASS | PASS |
| DEMO-04 Bậc 2 | BPTN (đích) | câu "Hình như có mùi khét..." | §5.2 — KHÔNG chạy mutation target; chỉ đọc OpenAPI/code + ingest baseline | VERIFYING/SAFETY_REVIEW_REQUIRED, ba lựa chọn BPTN | không có route/field/action safety; baseline = VERIFYING/OUT_OF_SCOPE | `g4a.txt` | cần Như Ý nối `safety.py` vào engine + Châm Anh/Như Ý chốt route/body trong CONTRACTS. Chưa chạy được target | BLOCKED, owner Như Ý |
| DEMO-04 Bậc 1 | BQL (đích) | câu "...có khói và mùi khét" | §5.3 — như trên | VERIFYING/EMERGENCY_PENDING_BQL, BQL-only close/downgrade (MVP) | baseline = VERIFYING/OUT_OF_SCOPE owner BPTN, không thông báo BQL | `g4b.txt` | như trên | BLOCKED, owner Như Ý |

## Lựa chọn safety bắt buộc (script dự kiến, CHƯA chạy)

- Bậc 2, BPTN đúng ba lựa chọn: (1) `SAFETY_CONFIRM_SAFE` (lý do bắt buộc, ghi clearance người/thời điểm, rồi flow thường); (2) `SAFETY_ESCALATE` (-> EMERGENCY_PENDING_BQL, BPTN không rút lại); (3) yêu cầu bổ sung T06 (NEED_INFO safety_context=true; cư dân bổ sung có hazard phải leo thang ngay).
- Hạn: Bậc 2 4 giờ lịch (`/mo/jobs/run` now `2026-10-03T14:01:00+07:00`), NEED_INFO safety 12 giờ lịch (now `2026-10-03T22:01:00+07:00`); job nhắc/leo thang, không clear.
- Bậc 1, chỉ BQL: cổng MVP = `EMERGENCY_CLOSE` và `EMERGENCY_DOWNGRADE`; `CREATE_FOLLOW_UP` là SAU MVP. Âm: BPTN/department 403, resume/jobs không clear.
- Tên action là semantic CR03, KHÔNG phải route; không bịa URL (OPERATIONS §5.1).

## Ghi chú

- Dự kiến sai lệch đã đo, không đổi expected: rating ghi đè (FAIL); API docstring nói resume bước 7 nhưng code dùng bước 6 (ghi nhận, không ảnh hưởng PASS).
- Nhóm 4 chỉ ghi nhãn BASELINE cho phần CURRENT thật có (ingest cư dân); không tính là PASS của target.
- Chưa đo: UI, online/persistence restart, upload ảnh thật (evidence ảnh là metadata mô phỏng), reopen route (ngoài scope MVP).

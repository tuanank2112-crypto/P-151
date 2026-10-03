Worker · thi công (D3-04) · Sonnet · Bước 0 exit 1 (MODULE_NOT_FOUND, hub ../brain4agent.release thiếu, không sửa managed rules) · hiểu việc: phạm vi = chỉ ghi P/deliverables/parts/D3-04.json, P/evidence/d3-04/*, report này; xong khi = 4 record DUP-01..04 có bằng chứng quyết định BPTN + liên kết, JSON hợp lệ exit 0, evidence_refs tồn tại; cấm = sửa src/tests/seed/config/.env/plan/brain/docs, DB chung/reset/deploy, commit/push/stash, kiểm ngưỡng duplicate priority, dùng ca hazard.
Handoff: ../handoffs/H09_day03-dup.md
Base: 0ea04adedd023654947e2e97e645043f0ba89159
Head: 0ea04adedd023654947e2e97e645043f0ba89159 (working tree, không commit)

Branch: feature/truong · Môi trường: local, in-process FastAPI TestClient (không mở cổng; không có process nào để dừng), mỗi ca là một interpreter Python mới. Ép env trước khi import app: MO_STORE=memory LLM_MODE=mock MO_PHOTO_STORE=local APP_ENV=development MO_ALLOW_RESET=false (+ MO_JOBS_ENABLED=false, bỏ DATABASE_URL). Mỗi ca xác nhận trước mutation: GET /health -> 200 `{"status":"ok","env":"development"}`, settings mo_store=memory, repo=InMemoryRepository (không có .env trong repo). Đồng hồ máy: 2026-10-03T11:05+07:00. Dữ liệu: seed 12 ticket có sẵn (2026-09-27) + ticket mô phỏng tòa SIM-C (không đụng seed), không hazard.

## Đọc engine (file:dòng, đã chép vào steps)
- Phát hiện trùng: src/maintenance/engine.py:1741-1781 (cùng category + effective_location, ticket cũ không terminal, trong duplicate_window_hours=48 tại seed/maintenance_v1/catalog.yaml:92); phân loại chạy trước (engine.py:4-5, step 3 trước step 4).
- BPTN quyết: POST /api/v1/mo/tickets/{id}/bptn-resolve (src/api/routers/maintenance.py:407-434) -> engine.bptn_resolve engine.py:596-635 (merge=true -> MERGED + audit merged_into), :665-666 (merge=false -> not_duplicate_of, resume bước 5).
- Giờ mô phỏng: `simulated_received_at` tại POST /api/v1/resident/tickets (maintenance.py:261-277, :581-589). Endpoint đủ, không có BLOCKED.

## Lệnh + exit (evidence trong P/evidence/d3-04/)
| Lệnh | Exit | Evidence |
| --- | --- | --- |
| init_brain.js --check | 1 | boot-check-exit.txt |
| python dup_case.py DUP-01 / DUP-02 / DUP-03 / DUP-04 | 0 / 0 / 0 / 0 | dup-run-exit.txt, DUP-0N.txt (request đã che auth, status/body, timestamp, actor, GET ticket/events/audit/notifications hai ticket + resident view), DUP-0N-facts.json |
| xác thực D3-04.json (4 record, evidence tồn tại) | 0 | json-validate-exit.txt |

## Kết quả: 4 record · PASS 4 · FAIL 0 · BLOCKED 0
- DUP-01 PASS: T1 2026-10-05T09:00+07:00, T2 +24h cùng loại + cùng vị trí -> SIM-TKT-0002 VERIFYING, blocker DUPLICATE -> SIM-TKT-0001, department null; BPTN thử accept bị 403, vẫn VERIFYING.
- DUP-02 PASS: merge=true -> SIM-TKT-0002 MERGED, merged_into=SIM-TKT-0001; event SIM-EVT-0002-0003 actor BPTN; audit SIM-AUD-0002-0004 BPTN_RESOLVE field merged_into new_value SIM-TKT-0001 ALLOWED; resident view "Đã gộp"; ticket cha không đổi.
- DUP-03 PASS: merge=false -> SIM-TKT-0002 ROUTED/DEPT_CLEANING, not_duplicate_of=[SIM-TKT-0001], không MERGED; audit BPTN_RESOLVE (resume_step=5).
- DUP-04 PASS cả hai biến thể: (a) khác tầng (tầng 5) +24h -> ROUTED, không trùng; (b) cùng vị trí +72,5h (>48h) -> ROUTED, không trùng; 0 event DUPLICATE/MERGED.
- Quan sát (không đổi kết quả): timestamp event/audit của quyết định BPTN dùng đồng hồ máy (2026-10-03) trong khi ingest dùng giờ mô phỏng (2026-10-05/06), nên event quyết định có thời điểm sớm hơn ingest trong ca mô phỏng. Chỉ do mô phỏng giờ; chưa kết luận lỗi, không đề xuất sửa.

## git diff --stat + SHA
`git diff --stat` rỗng (không sửa file tracked); SHA 0ea04adedd023654947e2e97e645043f0ba89159. Untracked mới của gói này: deliverables/parts/D3-04.json, evidence/d3-04/*, reports/R09_day03-dup.md (các untracked khác thuộc worker khác). Script chạy nằm ở scratchpad ngoài repo, không thêm vào repo.

## Bảng phân công thực tế
| Gói | Tầng yêu cầu | Họ/model đã dùng |
| --- | --- | --- |
| D3-04 (kiểm trùng cơ bản) | 🟠 | Sonnet (tự làm, không phóng thêm agent) |

## Việc KHÔNG làm + lý do
- Không kiểm ngưỡng duplicate priority (D-03, sau MVP); không dùng ca hazard; không kiểm online/runtime thật (chưa nghiệm thu, ngoài phạm vi); không chạy uvicorn/cổng 8164 (dùng TestClient in-process, tránh đụng cổng worker khác).
- Không xóa file evidence cũ (lệnh rm bị chặn bởi safety check; không cần vì mọi file bị ghi đè đúng tên).
- Không sửa managed rules/hub (Bước 0 exit 1); không đánh dấu brain compliant.

## Câu hỏi cần người
Không có câu hỏi blocker. Gợi ý cho Như Ý (không bắt buộc): xác nhận timestamp quyết định BPTN dùng clock thật thay vì clock mô phỏng là chủ ý.

## Root đo lại (2026-10-03)

Root đo lại: JSON D3-04 hợp lệ, evidence tồn tại, facts DUP-01 có blocker DUPLICATE, DUP-04 không có, DUP-02 MERGED. Ghi nhận: DUP-01 dùng khoảng 24h (nằm trong cửa sổ 48h), DUP-04 khác tầng + 72,5h; timestamp quyết định BPTN theo đồng hồ máy, không theo giờ mô phỏng (câu hỏi cho Như Ý, không ảnh hưởng PASS).

✅ DUYỆT (D3-04: 4 PASS trên local cô lập)

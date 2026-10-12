Vai: worker (vai-thi-cong) · thi công · Claude Sonnet 5.5 · Bước 0: exit 0 (NÃO ĐÃ OK; chỉ cảnh báo BRN-028 today.md dài, ngoài phạm vi) · hiểu việc: phạm vi = mở rộng lớp dữ liệu portal (dto, backend-map, constants, server/data, actions, test) cho WP3–5, chỉ trong portal/ + evidence/report; xong khi = test/typecheck/lint EXIT=0 + grep 0 + test đỏ trước; cấm = ngoài portal/, thêm tính năng UI, commit/push/add -A/stash, ghi Supabase
Handoff: handoffs/H04_thi-cong_WP2b.md
Base: 4be628475540536b26a04a51f291e70edc8406b2
Head: 4be628475540536b26a04a51f291e70edc8406b2; working tree chưa commit

## Lệnh + exit (evidence/WP2b/)
| Lệnh | Exit | File |
|---|---|---|
| vitest 2 file test mới, TRƯỚC khi viết code (59 đỏ / 2 qua) | 1 | red-before.txt |
| npm run test: 8 file, 118 test, 118 pass, 0 fail, 0 skip | 0 | unit.txt |
| npm run typecheck | 0 | typecheck.txt |
| npm run lint | 0 | lint.txt |
| rg "@/db\|server/workflow\|server/queries\|lib/agent\|lib/duplicates" portal/src (trừ src/db): 0 dòng | rg=1 (không khớp) | grep.txt |
Ctrl-char `[\x08\x0c\x0b]` = 0 trên mọi file đã sửa. Test: 118 tổng (57 cũ + 61 mới), 118 pass, 0 fail, 0 skip. Chưa chạy smoke thật (backend :8000 chưa có route WP1b; test dùng dữ liệu giả như handoff cho phép).

## git diff --stat (phần portal/; dòng src/*.py, seed, migration, tests/test_maintenance là của WP1b chạy song song, KHÔNG phải của gói này)
 portal/src/app/actions/{departments,detail,resident,warehouse}.ts | +73/-? (8+7+44+14)
 portal/src/app/resident/resident-app.tsx  | 4 (biên dịch: gửi `title` tạm, `rateTicketAction(id,{stars})`)
 portal/src/lib/backend-map.ts | +139 · constants.ts | +4 · dto.ts | +91/-2
 portal/tests/unit/build.test.ts | 6 (cập nhật kỳ vọng kho theo Q15)
 MỚI: portal/tests/unit/portal-ext.test.ts, portal/tests/unit/actions-ext.test.ts
 KHÔNG hiện trong git diff vì .gitignore dòng 32 `data/`: portal/src/server/data/{types,shared,build,departments,reception,management}.ts đã sửa (xem "Phát hiện").
SHA: Base = Head = 4be6284 (chưa commit).

## Export mới (HỢP ĐỒNG cho WP3–5)
Hàm thuần `lib/backend-map.ts`:
- splitReport(raw): {title, content, location} (bản cũ 1 dòng ≤80 ký tự ⇒ content "")
- agentDept(source, department, scope): Dept|null ("bql" khi OUT_OF_SCOPE; chỉ source AGENT) · agentVerdict(AgentCheck): "correct"|"wrong"|null · agentPerformance(PerfRow[]): AgentPerf
- escalationSource(notifications, agentHint): "Agent chuyển"|"Tiếp nhận chuyển"
- overviewFilter(kind: "total"|"waiting"|"processing"|"emergency"|"late"): (t)=>boolean · overviewCount(rows, kind) · deptLoadFilter(dept, showAll) · hoursBetween(from,to) · deptPerformance(MgmtTicket[], dept): {processing, late, closed, avgStars, avgHours}
`lib/constants.ts`: MIN_TITLE=5, MAX_TITLE=120, MAX_CONTENT=2000, MAX_RATING_COMMENT=500.
`lib/dto.ts` (kiểu mới/đổi):
- RatingInfo {stars,tags,comment}; AgentInfo {source, sourceLabel, model, proposedDept, riskLevel, signals[{id,quote}], steps[], disagreements[], reason, failed}; MaterialStatus "none"|"pending"|"waiting_stock"|"approved"; StaffRow {staffId,name,skill,area,capacity,openTickets}; AgentPerf {transferred, correct, wrong, correctPct|null, waitingResident, corrections[{id,code,agentDept,finalDept}]}
- ResidentTicket: + content, ratingTags, ratingComment (rating giờ lấy từ backend; title/description giữ)
- ReceptionInboxItem: + title, content, agent: AgentInfo|null · ReceptionAllItem: + title, content · ReceptionData: + perf: AgentPerf
- DeptTicket: + title, content, materialStatus, staffId, staffName, rating: RatingInfo|null · DeptData: + staff: StaffRow[]
- MgmtTicket: + title, content, ratingTags, ratingComment, bqlSource, agentDept, agentSource, staffName, doneHours (ratingStars giờ thật)
- TicketDetail: + title, content, materialStatus, staffName, rating, agent: AgentInfo|null
- WarehouseRequest: + approved, short; lines[]: + short (liệt kê MỌI yêu cầu WAITING_MATERIAL, kể cả kho đủ)
Actions:
- submitTicketAction(fd{title, description(=nội dung), place, placeDetail, photos[]}) — title 5–120, nội dung 10–2000, xuống dòng trong title thành khoảng trắng; gửi "<title>\n<nội dung>\nVị trí: <nơi>"
- rateTicketAction(id, {stars, tags?, comment?}) — thẻ phải thuộc GOOD_TAGS (≥4) hoặc BAD_TAGS (≤3), bình luận ≤500; POST {score, tags, comment}
- assignStaffAction(id, staffId) ⇒ POST /mo/tickets/{id}/assign {staff_id}
- approveMaterialsAction(id, note?) ⇒ POST /mo/tickets/{id}/materials/approve (409 STOCK_SHORT hiện message backend)
- ticketDetailAction(id): nay đọc thêm GET /mo/tickets (1 lời gọi) để lấy staff + sao/thẻ/bình luận
Loader: server/data/shared.ts readStaff() (GET /mo/staff; 404/405 ⇒ []); build.ts: buildAgentInfo, materialStatus, perfRow, buildMgmtTicket(row, summary, now, detail?), buildDeptTicket(..., summary?), buildDetail(..., summary?). management loader đọc chi tiết (≤30) CHỈ cho ticket Việc của BQL để biết nguồn chuyển.

## Quyết định của worker
1. Trường mới của backend (SPEC-P04) khai báo OPTIONAL ở types.ts và map với giá trị rỗng/null ⇒ portal vẫn chạy trên backend chưa có WP1b.
2. Nguồn "Việc của BQL": notification `escalation` mới nhất có payload.by (AGENT ⇒ "Agent chuyển", khác ⇒ "Tiếp nhận chuyển"); thiếu thông tin ⇒ suy từ agent_scope==OUT_OF_SCOPE. Không dùng audit (không cần thêm lời gọi).
3. "Ticket đã chuyển" của tab Hiệu suất = số ticket đã có phòng hoặc là Việc của BQL; "% đúng" = đúng/(đúng+sai), null khi chưa ticket nào xét được; "Số lần sửa" = số `wrong` = corrections.length.
4. Phòng Agent đề xuất = job đầu trong valid_job_indexes (mặc định job 0); lý do thẻ = job.reason, rồi note_for_staff; Agent lỗi/fallback ⇒ "Agent không quyết được — luật cố định", proposedDept null.
5. materialStatus: ON_HOLD + WAITING_MATERIAL + chưa resolved_at ⇒ pending (đủ kho) / waiting_stock (thiếu); còn lại có dòng vật tư ⇒ approved. Dựa blocker.resolved_at (SPEC-P04 §2).
6. Bản báo cáo cũ 1 dòng: title = dòng ≤80 ký tự, content "" (tránh lặp chữ trên UI); >80 ký tự ⇒ content giữ nguyên toàn văn.
7. build.test.ts: sửa kỳ vọng "kho chỉ liệt kê dòng thiếu / null khi đủ" thành "liệt kê mọi dòng, cờ short/approved" vì Q15 đổi hành vi (không nới tiêu chí để né lỗi).
8. resident-app.tsx: tiêu đề tạm = 60 ký tự đầu của nội dung (WP3 thay bằng ô Tiêu đề thật) để gửi không bị chặn.

## Phát hiện (cần người)
- `.gitignore` dòng 32 `data/` đang IGNORE `portal/src/server/data/` ⇒ toàn bộ lớp dữ liệu WP2 + WP2b KHÔNG được git theo dõi (commit 4be6284 thiếu thư mục này; `git status` im lặng). Phải sửa .gitignore (vd `/data/` hoặc `!portal/src/server/data/`) trước khi commit. Ngoài phạm vi file được ghi nên chưa sửa.

## Bảng phân công
| Gói | Tầng yêu cầu | Họ/model đã dùng |
| WP2b | 🟠 | Claude Sonnet 5.5, không giao con |

## Việc KHÔNG làm + lý do
- Chưa thử thật với route WP1b (chưa có trên :8000; handoff không bắt buộc). Chưa chạy smoke.
- Không thêm UI (ô Tiêu đề, thẻ đánh giá, khối Agent…): thuộc WP3–5.
- Không sửa .gitignore, `.env.example`: ngoài phạm vi / không cần.

## Câu hỏi mở
1. Sửa .gitignore cho `portal/src/server/data/` (xem Phát hiện) — ai làm, trước khi commit WP2/WP2b?
2. Xác nhận định nghĩa "Ticket đã chuyển" ở Quyết định 3.

Tiếp theo
🖐 Cần tay người: sửa .gitignore để git thấy portal/src/server/data/, rồi duyệt R04.
🤖 Agent làm được ngay: chờ lệnh (WP3–5 UI; thử thật khi WP1b xong).
⭐ Nên làm trước: sửa .gitignore — nếu không, commit sẽ thiếu cả lớp dữ liệu.
⏸ Chưa làm: thử với route WP1b thật, smoke, mọi UI.

⏳ Chờ người duyệt.

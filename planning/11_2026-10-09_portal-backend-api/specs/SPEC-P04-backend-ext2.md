# SPEC-P04 — Mở rộng backend đợt 2 theo trả lời người dùng (WP1b, 🟠)

Nguyên tắc như SPEC-P01: KHÔNG thêm trường/giá trị enum vào doc ticket JSONB (Render cũ đọc chung Supabase). Dữ liệu mới ⇒ bảng MỚI (Alembic `0004_portal_extras`, chỉ CREATE TABLE) + dict ở memory store; trường mới CHỈ ở model RESPONSE.

## 1. Agent tự chuyển ticket ngoài phạm vi cho BQL (Q14)
- Chỗ: nơi pipeline đặt blocker `OUT_OF_SCOPE` (engine `_step...` quanh `R.OUT_OF_SCOPE`, gồm nhánh Agent `view.bptn_reason == "OUT_OF_SCOPE"` và nhánh luật).
- Luật: nếu quyết định đang dùng là của Agent (`agent_decision.source == "AGENT"` và Agent kết luận `scope == "OUT_OF_SCOPE"`) ⇒ blocker tạo ra có `escalated=True`, `next_retry_at=None`, notification `escalation` audience BQL payload `{reason_code: OUT_OF_SCOPE, by: "AGENT"}`, audit `TRANSITION` field `blocker.escalated` actor AGENT. Luật (fallback, không Agent) ⇒ giữ như cũ (BPTN).
- CẤM: tự chuyển khi Agent lỗi/fallback; tự chuyển ticket an toàn (blocker an toàn luôn thắng — 2b chạy trước).
- Nghiệm thu: client giả trả quyết định `OUT_OF_SCOPE` hợp lệ cho "Hóa đơn phí dịch vụ tính sai diện tích" ⇒ `VERIFYING/OUT_OF_SCOPE`, `escalated=true`, có notification BQL; cùng câu với `FailingClient` ⇒ `escalated=false`.

## 2. Mọi yêu cầu vật tư phải được duyệt cấp (Q15)
- Phạm vi: kế hoạch vật tư do PHÒNG BAN gửi (`POST /mo/tickets/{id}/material-plan`, ticket `IN_PROGRESS`, `lines` khác rỗng). KHÔNG áp cho kiểm tồn tự động lúc điều phối (pipeline bước 6) — ghi vùng cấm.
- Gửi kế hoạch ⇒ ticket `IN_PROGRESS → ON_HOLD` với blocker `WAITING_MATERIAL` (hàng có sẵn trong `TRANSITIONS`? nếu `(IN_PROGRESS, ON_HOLD)` chỉ cho `BLOCKED_ONSITE` thì mở rộng `reasons` của hàng đó thêm `WAITING_MATERIAL` — reason đã có trong enum, không thêm giá trị mới), `resolved_at=None` dù kho đủ hay thiếu.
- `_cleared(WAITING_MATERIAL)` = đủ tồn **VÀ** `blocker.resolved_at is not None`.
- Route mới `POST /mo/tickets/{id}/materials/approve {note?: str}` — vai WAREHOUSE, BQL. Điều kiện: `ON_HOLD/WAITING_MATERIAL`, chưa duyệt. Thiếu tồn ⇒ 409 `{code: "STOCK_SHORT", message: "Kho chưa đủ <tên>: cần X, còn Y — nhập kho trước"}`. Đủ ⇒ đặt `resolved_at=now`, `resolved_by=actor`, audit, rồi `_resume` ⇒ `ON_HOLD → IN_PROGRESS` (đường `R.WAITING_MATERIAL → resume_step` hiện có; nếu đường đó chạy lại pipeline bước 6 thì đổi sang trả về `IN_PROGRESS` cho kế hoạch của phòng ban — worker đo và chọn, ghi report).
- `receive_stock` KHÔNG tự chạy tiếp ticket chưa được duyệt (vì `_cleared` cần duyệt).
- Nghiệm thu: kho đủ ⇒ gửi kế hoạch ⇒ ON_HOLD chờ duyệt; kho duyệt ⇒ IN_PROGRESS; kho thiếu ⇒ duyệt 409 STOCK_SHORT ⇒ nhập kho ⇒ vẫn ON_HOLD ⇒ duyệt ⇒ IN_PROGRESS; phòng ban tự duyệt ⇒ 403.

### 2b. Sau thẩm định WP7 (2026-10-09) — BẮT BUỘC
- **Cờ:** luồng chờ duyệt (§2) chỉ bật khi `MO_PORTAL_EXTRAS` bật (mặc định: memory bật, postgres TẮT). Lý do (WP7 P5): engine cũ trên Render đọc ticket "ON_HOLD chờ duyệt" sẽ đẩy về ROUTED (bỏ qua duyệt). Bật trên Supabase CHỈ sau khi Render chạy code này (OPERATIONS §3). Cờ tắt ⇒ `material-plan` giữ hành vi cũ (ticket vẫn IN_PROGRESS).
- **Duyệt = xuất kho (giữ hàng, WP7 P7):** `approve_materials` trừ tồn phần còn thiếu của từng dòng và đặt `issued_qty = planned_qty`; phòng ban nhập số đã xuất bằng đúng số đó thì không trừ lần hai. Hai ticket không thể cùng được duyệt trên một đơn vị tồn (lần sau 409 `STOCK_SHORT`).
- **Yêu cầu cộng dồn (WP7 P6):** `material-plan` là THAY THẾ; portal `requestMaterialsAction` luôn gửi dòng đang có + dòng mới (cộng số lượng cùng mã), không làm mất dòng đã duyệt/đã xuất.
- **Thẩm định vòng 2 (2026-10-10):** (a) đủ/thiếu hàng tính trên PHẦN CÒN PHẢI XUẤT `planned_qty − issued_qty` (`_still_to_issue`) ở `_refresh_line_stock`, `_cleared`, duyệt cấp, và `shortage` của portal; (b) giảm số lượng dưới số đã xuất ⇒ trả phần thừa về kho (`confirm_materials`); (c) hủy ticket ⇒ trả về kho phần đã xuất chưa dùng (`_after_cancel`). Test `test_wp7_new*` (đỏ trên `b42f9c3`).
- **Chưa làm (Idea Vault, WP7 P8):** phòng ban rút yêu cầu / kho từ chối cấp. Hiện thoát trạng thái chờ duyệt chỉ bằng nhập kho + duyệt, hoặc BQL hủy ticket.
- Test: `test_wp7_*` trong `test_portal_backend_ext2.py` (đỏ trên `091bc45`, xanh sau sửa).

## 3. Phân công nhân viên (Q17)
- Danh sách nhân viên tĩnh `seed/maintenance_v1/staff.yaml`: `staff: [{staff_id, department_id, name, skill, area, capacity}]` — chép đúng 3 tổ vệ sinh + 4 kỹ thuật viên từ `portal/src/db/seed.ts` (Tổ A/B/C; Kỹ thuật viên 1–4 với skill Điện / Cấp thoát nước / Thang máy / Điện). Mã `SIM-STAFF-CLN-A`… `SIM-STAFF-TEC-4`.
- Bảng `maintops.assignments (ticket_id text primary key, staff_id text not null, assigned_by text not null, assigned_at timestamptz not null)`.
- Engine `assign_staff(ticket_id, actor_id, staff_id)` — vai DEPARTMENT đúng phòng của ticket; ticket `ROUTED` hoặc `IN_PROGRESS`; nhân viên phải cùng phòng ⇒ ghi bảng (thay nếu có), audit `TRANSITION` field `staff_id` (không đụng `ticket.assignee_id`). Ticket `ROUTED` ⇒ đồng thời `accept` (ROUTED → IN_PROGRESS) trong cùng giao dịch (portal cũ: phân công = bắt đầu làm).
- Route `GET /mo/staff` (DEPARTMENT: chỉ phòng mình; BQL: tất cả) ⇒ `[{staff_id, department_id, name, skill, area, capacity, open_tickets}]`; `POST /mo/tickets/{id}/assign {staff_id}`.
- Response: `TicketSummary.staff_id`, `staff_name`; `BqlTicketRow.staff_name`.
- Nghiệm thu: vệ sinh phân công Tổ B cho ticket ROUTED ⇒ IN_PROGRESS + staff Tổ B; phân công kỹ thuật viên cho ticket vệ sinh ⇒ 409; BPTN phân công ⇒ 403.

## 4. Đánh giá có thẻ + bình luận (Q17)
- Bảng `maintops.rating_details (ticket_id text primary key, tags text[] not null default '{}', comment text not null default '', created_at timestamptz not null)`.
- `POST /resident/tickets/{id}/rating {score: 1..5, tags?: string[], comment?: str ≤ 500}`: tags ⊂ `GOOD_TAGS` khi score ≥ 4, ⊂ `BAD_TAGS` khi score ≤ 3 (danh sách chép `portal/src/lib/constants.ts`, đặt ở `seed/maintenance_v1/staff.yaml` mục `rating_tags: {good: [...], bad: [...]}`); sai ⇒ 422. Ghi `ticket.rating` như cũ + bảng chi tiết trong CÙNG giao dịch logic (lỗi bảng ⇒ không ghi điểm).
- Response: `ResidentTicketView.rating_tags`, `rating_comment`; `BqlTicketRow.rating_tags`, `rating_comment`; phòng ban thấy sao + thẻ + bình luận của ticket phòng mình KHÔNG kèm danh tính cư dân (`TicketSummary.rating`, `rating_tags`, `rating_comment`).

## 5. Trường Agent cho thống kê + chi tiết (Q10)
- `TicketSummary` + `BqlTicketRow` thêm: `agent_source: str | None` (`AGENT`/`FALLBACK_RULE`/`SKIPPED_*`), `agent_department: Department | None` (phòng Agent đề xuất — từ job đầu tiên hợp lệ của `agent_decision.decision`), `agent_scope: str | None`.
- "Agent đúng" (portal tính): ticket đã giao phòng (`department_id` có) hoặc đã vào Việc của BQL, có `agent_source == "AGENT"`; đúng ⇔ `agent_department == department_id` (hoặc `agent_scope == OUT_OF_SCOPE` và ticket là Việc của BQL); sai ⇔ ngược lại. Không có quyết định Agent ⇒ không tính.
- Chi tiết: `GET /mo/tickets/{id}` đã có `agent_decision` — portal hiện: nguồn, model, các bước suy luận (`reasoning[].conclusion`), phòng đề xuất, mức an toàn Agent + trích dẫn tín hiệu, bất đồng với luật.

## 6. Vùng cấm
- Không đổi kiểu `Ticket.assignee_id`, `Ticket.rating`; không thêm giá trị `ReasonCode`/`ClosureKind`.
- Không bắt duyệt cho kiểm tồn tự động lúc điều phối (bước 6) — sẽ làm mọi ticket kẹt chờ kho.
- Không lộ danh tính cư dân trong trường mới.

## 7. Test bắt buộc
`tests/test_maintenance/test_portal_backend_ext2.py`: mỗi mục §1–§5 có test engine + API, từng đỏ trước khi sửa; đột biến: (m4) bỏ điều kiện `resolved_at` trong `_cleared`; (m5) Agent fallback vẫn tự chuyển BQL; (m6) cho phân công khác phòng ⇒ mỗi cái làm đỏ ≥ 1 test. `--pg` cho bảng mới nếu dựng được Postgres tạm (docker), không được ⇒ NOT_RUN.

# SPEC-P05 — Mọi vai vận hành có app (Phòng ban, BPTN, Kho) + bỏ chip lọc Cư dân

Yêu cầu người dùng (2026-10-09): "tất cả các role đều cần có app để tiện chụp hình, báo cáo" + ảnh hàng chip
"Tất cả · Đang xử lý · Chờ nghiệm thu · Cần bạn · Đã xong" kèm "Bỏ cái này từ bên cư dân đi". Đọc kèm plan.md Q26–Q31.
Giữ nguyên SPEC-P04 (giao diện portal) và bất biến I-1..I-7; I-8 đổi theo §1.

## §1. Vai → màn
| Vai (`me.role`) | Hash gốc | Tile (NavTiles, `ctx.chrome`) | Nguồn dữ liệu |
|---|---|---|---|
| RESIDENT | `#/r` | như SPEC-P04 | `/resident/*` |
| BQL | `#/b` | như SPEC-P04 | `/bql/*` + `GET /mo/tickets/{id}` |
| DEPARTMENT | `#/d` | Chờ nhận (`ROUTED`) · Đang làm (`IN_PROGRESS`,`ON_HOLD`) · Tất cả | `GET /mo/tickets` (server đã lọc theo phòng ban) |
| BPTN | `#/p` | Cần xử lý (§3 điều kiện) · An toàn B2 (`SAFETY_REVIEW_REQUIRED`) · Tất cả | `GET /mo/tickets` |
| WAREHOUSE | `#/k` | Chờ vật tư · Tồn kho | `GET /mo/tickets` (server: chỉ `WAITING_MATERIAL`), `GET /mo/warehouse/stock` |
| QA_INTERNAL | `#/web` | — | không gọi API dữ liệu (I-8 mới: CHỈ vai này thấy "Dùng bản web") |
Mọi danh sách nội bộ ẩn ticket mẫu `-(CLN|TEC)-` như web (`isSeedTicket`). Thẻ = `a.card.bitem[data-ticket]` như BQL.
Màn nội bộ dùng lớp `scr-management` (pill `st-*`, `late`).

## §2. Phòng ban `#/d/<id>` (`js/dept.js`) — trọng tâm "chụp hình, báo cáo"
Đọc `GET /mo/tickets/{id}` (`Case`). Phần chung: mã + pill, cờ (`ASSET_CHECK_ONSITE`, `STOCK_CHECK_ON_ACCEPT`) thành `notice`, blocker,
vị trí `draft.location`, nội dung cư dân + bổ sung, ảnh cư dân, "Diễn biến gần đây". Khối thao tác `#dept-actions` theo trạng thái:
| Trạng thái | Khối (thứ tự trên điện thoại) | Endpoint |
|---|---|---|
| `ROUTED` | "Nhận việc" (`#dept-accept`) · "Không thuộc phòng ban?" ghi chú bắt buộc ⇒ "Trả lại BPTN" | `POST …/accept` · `POST …/return {note}` |
| `IN_PROGRESS` | 1) cảnh báo lần báo hoàn thành trước còn thiếu (`draft.readiness_evaluation.failing_items`) | — |
| | 2) **Ảnh sau khi xử lý (bắt buộc)** `#dept-photos`: ảnh lượt hiện tại + `photoPicker` (Chụp ảnh/Chọn ảnh, nén như cư dân) ⇒ "Tải ảnh lên" | `POST …/photos` multipart `files`, tối đa `10 − đã có` (≤5/lần) |
| | 3) Checklist `#dept-checklist`: mỗi mục một ô tick; đổi ⇒ gửi ngay, khoá ô tới khi xong | `POST …/checklist/{template_item_id} {status: COMPLETED\|PENDING}` |
| | 4) Vật tư `#dept-materials`: mỗi dòng "Đã xuất"/"Đã dùng"/"Lý do chênh lệch" ⇒ "Lưu vật tư"; `<details>` "Vật tư thực tế khác đề xuất?" (mở sẵn khi `ASSET_CHECK_ONSITE`) ⇒ dòng chọn vật tư + số lượng + lý do bắt buộc | `POST …/materials/{item_code} {issued_qty, used_qty, variance_reason?}` · `POST …/material-plan {lines, note}` |
| | 5) Ghi chú xử lý (nếu có `draft.evidence_requirements[0]`) ⇒ "Lưu ghi chú" | `POST …/evidence {requirement_id, evidence_type: allowed_evidence_types[0], content_or_metadata}` |
| | 6) Tự kiểm trước khi nộp (`.chk`: checklist, vật tư đã lưu, chênh lệch có lý do, ≥1 ảnh, không blocker) + "Báo hoàn thành" (`#dept-complete`; chưa đủ ⇒ hỏi xác nhận) | `POST …/complete` |
| | 7) `<details>` "Vướng tại hiện trường?" (lý do + giờ dự kiến) · "Báo sai phòng ban?" (lý do) | `POST …/block {note, eta ISO}` · `POST …/return {note}` |
| `ON_HOLD` + `BLOCKED_ONSITE` | "Tiếp tục xử lý" | `POST …/resume-work` |
| `READY_FOR_REVIEW` | notice "Đang chờ BQL nghiệm thu" | — |
Sau mọi ghi: tải lại `Case` (I-2). Lỗi theo 01-CONTRACTS §7. Nhãn checklist/vật tư/đơn vị: bảng chép từ `src/web/app.js`
(`CHECKLIST_HUMAN_LABELS`, `REALISTIC_MATERIAL_NAMES`, `formatMaterialUnit`) để web và app gọi cùng tên.

## §3. BPTN `#/p/<id>` (`js/bptn.js`)
"Cần xử lý" = `status = NEED_INFO` hoặc `reason_code` ∈ {SAFETY_REVIEW_REQUIRED, MISSING_INFO, DUPLICATE, CATEGORY_UNCLEAR, OUT_OF_SCOPE,
PENDING_REVIEW, ASSET_UNCLEAR, WRONG_DEPT} (đúng `renderBptn` của web). Khối `#bptn-actions` theo `ticket.blocker.code`, body y hệt `bptnForm` web:
| Mã | Thao tác | Endpoint |
|---|---|---|
| SAFETY_REVIEW_REQUIRED | 3 nút: Xác nhận an toàn · Yêu cầu cư dân bổ sung (gợi ý điền phần "Thiếu:") · Nâng lên Khẩn cấp (xác nhận) | `POST …/safety {decision, note}` |
| MISSING_INFO | Vị trí (`Tòa S1 / Tầng 3 / Hành lang`) và/hoặc thông tin cư dân cung cấp (ít nhất một) | `POST …/bptn-resolve {location?, info?, note?}` |
| DUPLICATE | Gộp vào `related_ticket_id` · Xử lý riêng | `{merge: true}` · `{merge: false, note}` |
| CATEGORY_UNCLEAR / OUT_OF_SCOPE | Chọn loại việc (bắt buộc) | `{category, note?}` |
| PENDING_REVIEW | Đổi loại việc / sửa vị trí (không bắt buộc) ⇒ Xác nhận | `{category?, location?, note?}` |
| ASSET_UNCLEAR | Chọn tài sản (`catalog.assets`) hoặc tick "kiểm tra tại hiện trường" (một trong hai) | `{asset_id?, asset_onsite?, note?}` |
| WRONG_DEPT | Loại việc mới hoặc phòng ban (một trong hai) | `{category?, department?, note?}` |
| khác | notice "Không có thao tác cho BPTN" | — |
Body CHỈ gồm trường có giá trị (`extra: forbid`).

## §4. Kho `#/k` (`js/kho.js`)
Tile "Chờ vật tư": thẻ ticket ⇒ `#/k/<id>`: từng dòng vật tư "cần X · tồn Y · thiếu Z" (tồn lấy từ `GET /mo/warehouse/stock`, không lấy snapshot dòng).
Tile "Tồn kho" (`#kho-stock`): danh sách tồn + form nhập kho `#kho-receive` (chọn vật tư, số lượng > 0) ⇒ `POST /mo/warehouse/stock/{item_code} {qty}`;
toast "N phản ánh chạy tiếp / vẫn chờ". Màn chi tiết điền sẵn vật tư thiếu đầu tiên.

## §5. Cư dân — bỏ chip lọc
Xoá hàng `.chips` dưới 4 ô `.ov` ở `#/r`. Ô `.ov` vẫn lọc (bấm lại ô đang chọn ⇒ về "Tất cả"); khi đang lọc, PageHead ghi
"Đang lọc: <tên> · Bỏ lọc" (link bỏ lọc) để không mất lối về "Tất cả".

## §6. Vùng cấm
| # | Không làm | Lý do |
|---|---|---|
| P5-V1 | Endpoint/trường API mới, đổi `auth.py`, đổi engine | I-1; mọi luật vai/trạng thái nằm ở engine (403/409 là trọng tài) |
| P5-V2 | Màn QA trên app | Web cũng không có màn QA; `qa01` là tài khoản demo |
| P5-V3 | Hàng đợi ảnh offline cho phòng ban | Như V5 (Q08) |
| P5-V4 | Audit table / AI trace panel của web | Màn hẹp; xem trên web (nút "Mở bản web đầy đủ") |
| P5-V5 | Gộp `bql.js` vào `staff.js` hết | Chỉ chuyển phần dùng chung (nhãn, pill, ảnh, nội dung); luồng BQL đã nghiệm thu giữ nguyên |

## §7. Nghiệm thu (bổ sung TESTING-ACCEPTANCE)
- M12 đổi: `qa01` ⇒ `#/web`, 0 request dữ liệu.
- M14 Phòng ban trên app (ticket mới đã `ROUTED`): Nhận việc ⇒ tick hết checklist ⇒ Lưu từng vật tư ⇒ chọn 1 ảnh 4000×3000 ⇒ Tải ảnh lên ⇒ Báo hoàn thành
  ⇒ API: `READY_FOR_REVIEW`, ảnh phòng ban ≤1600 px.
- M15 BPTN: ticket `NEED_INFO`/`MISSING_INFO` ⇒ nhập vị trí ⇒ Lưu ⇒ API: hết blocker `MISSING_INFO`.
- M16 Kho: tab Tồn kho hiện đủ số dòng của `GET /mo/warehouse/stock`; nhập 1 đơn vị ⇒ API: tồn tăng đúng 1.
- M17 Cư dân: `#/r` không còn hàng chip; bấm ô "Đã xong" ⇒ chỉ thẻ TERMINAL.
- Phép phá mới `e-no-dept-photo` (bỏ lệnh tải ảnh của phòng ban) ⇒ M14 ĐỎ. 4 phép phá cũ vẫn đỏ (d đo trên màn `#/web` của `qa01`).

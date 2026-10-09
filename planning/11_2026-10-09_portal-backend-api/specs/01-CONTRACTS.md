# 01 — Hợp đồng portal ↔ backend

Backend: FastAPI, mọi route dưới `/api/v1`, auth `Authorization: Bearer <token>` (token mờ, 8 giờ, giữ trong RAM backend). Tham chiếu mã: `src/api/auth.py`, `src/api/routers/maintenance.py`, `src/maintenance/views.py`, `src/maintenance/models.py`.

## 1. Cấu hình portal
| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `BACKEND_URL` | có | Gốc backend, vd `http://127.0.0.1:8001` (dev, memory) · `http://backend:8000` (compose). Thiếu ⇒ `backend.ts` ném lỗi lúc khởi động request (không âm thầm dùng DB cũ). |
| `SESSION_COOKIE_SECURE` | không | Như cũ. |
| `DATABASE_URL` | KHÔNG còn bắt buộc | Chỉ script cũ (`db:*`, `tests/db`) dùng. `src/db/index.ts` không được import ở luồng chạy. |

## 2. Vai
| Backend `role` (+`department_id`) | Portal `Role` | Trang |
|---|---|---|
| RESIDENT | resident | `/resident` |
| BPTN | reception | `/reception` |
| BQL | management | `/management` (+ `/warehouse` chỉ xem) |
| DEPARTMENT + DEPT_CLEANING | cleaning | `/cleaning` |
| DEPARTMENT + DEPT_TECHNICAL | technical | `/technical` |
| WAREHOUSE | warehouse | `/warehouse` |
| QA_INTERNAL | — | Đăng nhập bị từ chối: "Tài khoản này không dùng cổng cư dân" (không có màn). |

## 3. Trạng thái → bước (stepper 6 bước giữ nguyên nhãn `STAGES`)
| `status` | stage | Cờ phụ |
|---|---|---|
| RECEIVED | 1 | — |
| NEED_INFO | 1 | `needInfo=true` |
| VERIFYING | 2 | `blockerCode` = `reason_code`/`blocker.code` |
| ROUTED | 3 | — |
| IN_PROGRESS | 4 | — |
| ON_HOLD | 4 | `paused=true` (`WAITING_MATERIAL`/`BLOCKED_ONSITE`/`WAITING_EMERGENCY`) |
| READY_FOR_REVIEW | 5 | — |
| CLOSED | 6 | — |
| CANCELLED | giữ stage cuối biết được, mặc định 1 | `cancelled=true` |
| MERGED | như CANCELLED | `cancelled=true`, `mergedInto=merged_into` |
- `urgent` = `risk_level == "EMERGENCY"` HOẶC `priority == "HIGH"`. Cư dân KHÔNG thấy `urgent` (I-04 CR-03: cư dân chỉ thấy nhãn trung tính) ⇒ ở DTO cư dân luôn `false`.
- `dept`: `department_id` (DEPT_CLEANING→`ve_sinh`, DEPT_TECHNICAL→`ky_thuat`); null nếu chưa giao. Ticket "Việc của BQL" (SPEC-P01 §2) có `dept="bql"` ở DTO quản lý (suy từ `blocker.code=="OUT_OF_SCOPE" && blocker.escalated`).
- `closureKind == EMERGENCY_HANDLED && riskLevel != EMERGENCY` ⇒ nhãn "BQL đã xử lý" (Q09), KHÔNG tính là khẩn cấp ở bất kỳ ô/thống kê nào (khẩn cấp chỉ theo `riskLevel`).
- Hàm ánh xạ đặt ở `portal/src/lib/backend-map.ts`, thuần (không I/O), có unit test bảng (TESTING §2).

## 4. Hợp đồng gọi theo màn (đọc)
| Màn | Gọi | Ánh xạ sang DTO |
|---|---|---|
| Cư dân | `GET /resident/tickets` | `ResidentTicket` (§5.1) |
| Tiếp nhận | `GET /mo/tickets` rồi `GET /mo/tickets/{id}` cho ticket stage ≤ 2 có blocker thuộc BPTN | `ReceptionData` (§5.2) |
| Vệ sinh / Kỹ thuật | `GET /mo/tickets` (đã lọc theo phòng ở backend) + `GET /mo/tickets/{id}` cho ticket chưa kết thúc + `GET /mo/catalog` + `GET /mo/warehouse/stock` | `DeptData` (§5.3) |
| Quản lý | `GET /bql/tickets` + `GET /mo/tickets/{id}` khi mở chi tiết (server action đọc `ticketDetailAction`) | `ManagementData` (§5.4) |
| Kho | `GET /mo/warehouse/stock` + `GET /mo/catalog` + `GET /mo/tickets` (backend chỉ trả ticket `WAITING_MATERIAL`) + `GET /mo/tickets/{id}` | `WarehouseData` (§5.5) |
Số lời gọi chi tiết mỗi trang ≤ 30 (`Promise.all`, giới hạn đồng thời 6). Ticket kết thúc (CLOSED/CANCELLED/MERGED) KHÔNG gọi chi tiết khi tải trang.

## 5. DTO (thay `portal/src/lib/dto.ts`; `id: string` thay `number` ở MỌI type)
### 5.1 `ResidentTicket`
`{ id, code, title (=description dòng đầu, ≤ 80 ký tự), description, location (từ dòng "Vị trí:" của mô tả, xem §6.1), sentAt, stage, statusLabel (=status_label), publicMessage, needInfo (=allowed_actions∋ADD_INFO), canRate (=allowed_actions∋RATE), cancelled, mergedInto, deptName (=department_name), eta, rating: number|null, extras (=additions), history (=timeline: {label=status_label, note=public_message, time}), photos: {id: evidence_id, url}[] }`. Bỏ: `paused/pauseText` (thay bằng `publicMessage`), `staffName`, `urgent`, `dept`.
### 5.2 Tiếp nhận
- `ReceptionInboxItem` = ticket có blocker BPTN cần xử lý (`owner_role=="BPTN"`): `{ id, code, text, location, createdAt, blockerCode, blockerLabel (§6.3), proposedDept, riskLevel, priority, extras, photos, duplicateOf (= blocker.related_ticket_id khi DUPLICATE), duplicate?: {id, code, text, statusLabel} }`. Bỏ `resident` (tên), `aiDept/conf/keywords`, `duplicates[]` tự tính.
- `ReceptionAllItem` (tab "Tất cả ticket", R4) = mọi ticket: `TicketDetail` rút gọn `{ id, code, text, location, createdAt, stage, statusLabel, dept, cancelled, urgent }`; bấm ⇒ `TicketDetail` đầy đủ (§5.6).
### 5.3 `DeptTicket`
`{ id, code, text, location, createdAt, urgent, stage, paused, blockerCode, statusLabel, hoursLeft (từ blocker.eta hoặc SLA backend; null nếu không có), extras, photos (ảnh cư dân + ảnh phòng ban, tên "Ảnh N"), checklist: {templateItemId, label, required, done}[], materials: {itemCode, itemName, unit, plannedQty, issuedQty, usedQty, stock, shortage}[], readiness: {checklist, photo, materials, failing: string[]} }`. Bỏ `staffId/staffName/skill/keywords/conf/rating`.
`DeptData = { user, tickets, catalog: {itemCode, itemName, unit, stock}[] }`.
### 5.4 `MgmtTicket`
Từ `BqlTicketRow`: `{ id, code, text (=description lấy từ GET /mo/tickets nếu cần, xem §4), location, createdAt, stage, statusLabel, dept, cancelled, urgent, late (=overdue), escalated, blockerCode, riskLevel, priority, closureKind, ratingStars, bqlWork (=blocker OUT_OF_SCOPE && escalated) }`. Vì `BqlTicketRow` không có mô tả: quản lý gọi thêm `GET /mo/tickets` (có `description`) và ghép theo `ticket_id`.
### 5.5 `WarehouseData`
`{ user, inventory: {code=item_code, name=item_name, unit, stock: qty|null, custom: boolean}[], requests: {ticketId, ticketCode, ticketText, departmentName, lines: {itemCode, itemName, unit, plannedQty, stock, shortage}[], since}[] }`. Bỏ `category/minStock/location` (backend không có); cột "Tồn thấp" = `stock !== null && stock <= 0` hoặc thiếu so với yêu cầu.
### 5.6 `TicketDetail` (modal, R3/R4)
`{ id, code, text, location, createdAt, stage, statusLabel, dept, deptName, cancelled, urgent, riskLevel, priority, blockerLabel, publicMessage, extras, history (=events public+internal: {label=to_status label, note=public_message ⊕ internal_note, time, actorRole}), beforePhotos (RESIDENT_ORIGINAL), afterPhotos (SIMULATED_IMAGE của phòng ban), checklist, materials }`. KHÔNG có trường Agent (R3).

## 6. Quy ước dữ liệu
1. **Mô tả + vị trí khi cư dân gửi:** `original_description = "<mô tả>\nVị trí: <placeLocation(...)>"`. Backend đọc vị trí từ văn bản (đã đo 2026-10-09: "Tòa S2.05 · Tầng 12 · Hành lang" ⇒ `Tòa S2.05 / Tầng 12 / Hành lang`). Portal tách lại `location` = phần sau "Vị trí:" ở dòng cuối; không có ⇒ "—".
2. **Hồ sơ cư dân** (tòa/tầng/căn) lấy từ `Me.profile` (SPEC-P01 §1). Không có ⇒ ẩn khối nhà.
3. `blockerLabel` (tiếng Việt, chỉ cho nhân viên): bảng tĩnh trong `backend-map.ts` cho 16 `ReasonCode` (vd `OUT_OF_SCOPE`→"Ngoài phạm vi VS/KT", `CATEGORY_UNCLEAR`→"Chưa rõ loại việc", `ASSET_UNCLEAR`→"Chưa rõ tài sản", `DUPLICATE`→"Nghi trùng", `SAFETY_REVIEW_REQUIRED`→"Cần xác minh an toàn", `EMERGENCY_PENDING_BQL`→"Khẩn cấp — chờ BQL", `WAITING_MATERIAL`→"Chờ vật tư").

## 7. Hợp đồng ghi (server action → backend)
| Action portal (mới) | Vai | Backend |
|---|---|---|
| `login(fd)` | mọi | `POST /auth/login` ⇒ cookie (SPEC-P02 §2) |
| `logout()` | mọi | `POST /auth/logout` + xoá cookie |
| `submitTicketAction(fd{description, place, placeDetail, photos[]})` | resident | `POST /resident/tickets {original_description}` rồi (có ảnh) `POST /resident/tickets/{id}/photos` multipart `files` |
| `addExtraAction(id, text)` | resident | `POST /resident/tickets/{id}/additions {content}` |
| `rateTicketAction(id, stars)` | resident | `POST /resident/tickets/{id}/rating {score}` |
| `routeTicketAction(id, dept)` | reception | `dept∈{ve_sinh,ky_thuat}`: `POST /mo/tickets/{id}/bptn-resolve {category: VE_SINH|KY_THUAT, note}`; `dept=="bql"`: `POST /mo/tickets/{id}/to-bql {note}` (SPEC-P01 §2) |
| `resolveAssetAction(id, assetOnsite)` | reception | `bptn-resolve {asset_onsite:true, note}` (blocker `ASSET_UNCLEAR`) |
| `confirmReviewAction(id)` | reception | `bptn-resolve {note}` (blocker `PENDING_REVIEW`) |
| `duplicateAction(id, merge:boolean)` | reception | `bptn-resolve {merge, note}` (blocker `DUPLICATE`) |
| `safetyAction(id, decision, note)` | reception | `POST /mo/tickets/{id}/safety {decision: CONFIRM_SAFE|REQUEST_INFO|ESCALATE, note}` |
| `setPriorityAction(id, priority, note)` | reception, management | `POST /mo/tickets/{id}/priority` |
| `acceptAction(id)` | cleaning, technical | `POST /mo/tickets/{id}/accept` |
| `returnAction(id, note)` | cleaning, technical (ROUTED) | `POST /mo/tickets/{id}/return {note}` |
| `reportWrongDeptAction(id, note)` | cleaning, technical (IN_PROGRESS) | `POST /mo/tickets/{id}/wrong-department {note}` (SPEC-P01 §4) |
| `requestMaterialsAction(id, lines[{itemCode?, newItemName?, unit?, qty}], note)` | technical (+cleaning) | mỗi `newItemName` ⇒ `POST /mo/warehouse/items {item_name, unit}` lấy `item_code` (SPEC-P01 §3); rồi `POST /mo/tickets/{id}/material-plan {lines:[{item_code, planned_qty}], note}` |
| `finishTicketAction(id, fd{note, photos[], checklist[], used[{itemCode, issued, used}]})` | cleaning, technical | theo thứ tự: ảnh `POST /mo/tickets/{id}/photos` · mỗi checklist `POST .../checklist/{template_item_id} {status:COMPLETED}` · mỗi vật tư `POST .../materials/{item_code} {issued_qty, used_qty}` · ghi chú `POST .../evidence {requirement_id:null, evidence_type:RESULT_NOTE, content_or_metadata:note}` · `POST .../complete`. Kết quả còn `IN_PROGRESS` ⇒ trả `INVALID_INPUT` kèm `failing_items` dịch tiếng Việt. |
| `receiveStockAction(code, qty)` | warehouse, management | `POST /mo/warehouse/stock/{item_code} {qty}` |
| `addStockItemAction({name, unit, qty})` | warehouse, management | `POST /mo/warehouse/items {item_name, unit}` rồi (qty>0) `POST /mo/warehouse/stock/{code} {qty}` |
| `approveInspectionAction(id)` | management | `POST /bql/tickets/{id}/close {note}` |
| `rejectInspectionAction(id, reason)` | management | `POST /bql/tickets/{id}/rework {note}` |
| `bqlDecideWrongDeptAction(id, KEEP|TO_BPTN, note)` | management | `POST /bql/tickets/{id}/wrong-department {decision, note}` (SPEC-P01 §4) |
| `finishBqlTicketAction(id, note)` | management | `POST /bql/tickets/{id}/handled {note}` (SPEC-P01 §2) |
| `returnBqlTicketAction(id, note)` | management | `POST /bql/tickets/{id}/return-to-bptn {note}` (SPEC-P01 §2) |
| `emergencyCloseAction(id, note)` / `emergencyDowngradeAction(id, note)` | management | `POST /bql/tickets/{id}/emergency/close|downgrade {note}` |
| `cancelTicketAction(id, reason)` | management | `POST /bql/tickets/{id}/cancel {cancel_reason}` |
Mọi action: bọc `act()` mới (SPEC-P02 §3), thành công ⇒ `refresh()`.

## 8. Lỗi backend → `ActionResult`
| HTTP | `code` portal | `message` |
|---|---|---|
| 401 | UNAUTHENTICATED | xoá cookie, client về `/login` |
| 403 | FORBIDDEN | `detail.message` |
| 404 | NOT_FOUND | "Không tìm thấy phản ánh" |
| 409 | CONFLICT | `detail.message` hoặc `detail` chuỗi |
| 413/415/422 | INVALID_INPUT | chuỗi `detail`, hoặc `detail[].msg` nối "; " |
| 5xx, mạng | (ném `BackendUnavailable`) | trang hiện "Không kết nối được máy chủ" |
Hàm `errorFrom(res)` trong `backend.ts`; 3 dạng `detail` (chuỗi, object có `message`, mảng `{msg}`) đều phải xử lý (test TESTING §2).

# 01 — Contracts

Mọi hàm dưới đây là hàm thuần (không gọi API, không đọc giờ hệ thống trừ khi nhận `now`), đặt trong `portal/src/lib/`, có test vitest. UI chỉ gọi chúng, không tự viết lại điều kiện.

## §1 Tiếp nhận — tab "Đã phân loại" (`lib/reception-done.ts`)
```ts
export type DoneSegment = "ky_thuat" | "ve_sinh" | "bql" | "unassigned" | "review" | "closed" | "cancelled";
export function doneSegment(t: Pick<ReceptionAllItem, "stage" | "dept" | "cancelled">): DoneSegment;
```
Thứ tự xét (dừng ở điều kiện đầu tiên đúng): `cancelled` ⇒ "cancelled"; `stage >= 6` ⇒ "closed"; `stage === 5` ⇒ "review"; `dept === "bql"` hoặc (`dept === null` và `stage <= 2`) ⇒ "bql"; `dept === null` ⇒ "unassigned" (vd tạm hoãn khi chưa có phòng — KHÔNG được tính là vệ sinh); còn lại ⇒ `dept`.
Nhãn chip theo thứ tự: Tất cả · Phòng kỹ thuật · Phòng vệ sinh · Ở Ban quản lý · Chưa giao phòng · Chờ nghiệm thu · Hoàn tất · Hủy / gộp. Tab này GIỮ chip "Tất cả" (người dùng chỉ yêu cầu bỏ "Tất cả" ở BQL). Chip có 0 ticket thì ẩn.

## §2 Phòng ban — lịch sử theo tòa (`lib/building.ts`)
```ts
export type Building = "S1" | "S2";
export function buildingOf(...texts: string[]): Building | null;
```
Tìm trong từng chuỗi theo thứ tự, không phân biệt hoa thường, mẫu `\bS([12])(?:\.\d{1,2})?\b` (mã tòa con "S1.12" ⇒ "S1"). Không thấy ⇒ `null`.
Lịch sử hoàn thành = ticket `stage >= 5`. Ô: "Hoàn thành S1" · "Hoàn thành S2" · "Chưa rõ tòa" (chỉ hiện khi > 0, để không mất dữ liệu). Mặc định chọn ô đầu tiên có ticket.

## §3 Ban quản lý (`lib/bql-view.ts`)
```ts
export const BQL_DECIDE_BLOCKERS = ["EMERGENCY_PENDING_BQL", "WRONG_DEPT_AFTER_START"] as const;
export type BqlBox = "decide" | "review" | "done";
export function bqlBox(t: MgmtTicket): BqlBox | null;
export type ListGroup = "waiting" | "bql" | "processing" | "review" | "closed" | "cancelled";
export function listGroup(t: MgmtTicket): ListGroup;
export type DeptLoad = { waitingAccept: number; inProgress: number; late: number; open: number };
export function deptLoad(rows: MgmtTicket[], dept: "ve_sinh" | "ky_thuat"): DeptLoad;
```
- `bqlBox`: `cancelled` ⇒ null; `blockerCode ∈ BQL_DECIDE_BLOCKERS` hoặc (`bqlWork` và `stage <= 2`) ⇒ "decide"; `stage === 5` ⇒ "review"; `stage === 6` ⇒ "done"; còn lại null. Ô hiển thị: **Cần BQL quyết** (khẩn cấp lên đầu, rồi báo sai phòng, rồi ngoài phạm vi) · **Chờ nghiệm thu** · **Hoàn tất**.
- `listGroup`: `cancelled` hoặc `merged` ⇒ "cancelled"; `stage >= 6` ⇒ "closed"; `stage === 5` ⇒ "review"; `stage >= 3` ⇒ "processing"; `bqlBox(t) === "decide"` ⇒ "bql"; còn lại ⇒ "waiting". Nhãn chip: Chờ phân loại · Cần BQL quyết · Đang xử lý · Chờ nghiệm thu · Hoàn tất · Hủy / gộp. Không có chip "Tất cả". Chọn mặc định: chip đầu tiên có ticket.
- Bộ lọc phụ (giao với chip): phòng ban (`Tất cả phòng` | Phòng vệ sinh | Phòng kỹ thuật), công tắc "Chỉ khẩn cấp" (`overviewFilter("emergency")`), "Chỉ quá hạn" (`t.late`), ô tìm (dùng `matchesDoneSearch`). Số trên chip tính SAU bộ lọc phụ.
- `deptLoad`: trên ticket `dept === dept` và không `cancelled`: `waitingAccept` = stage 3, `inProgress` = stage 4, `late` = `t.late` trong stage 3–4, `open` = waitingAccept + inProgress.

## §4 Hiệu suất phòng ban — sửa hiển thị đợt 1
`DeptPerf` thêm `rated: number` (số ticket có sao). Hiển thị: sao ⇒ `4.8/5 ⭐ (12)`; chưa có ⇒ nhãn xám "Chưa có đánh giá"; giờ hoàn thành `null` hoặc `0` ⇒ `--`.

## §5 Kho — ngưỡng tồn tối thiểu
Backend (cộng thêm, không phá):
- `MaterialCatalogItem.min_qty: int | None = Field(default=None, ge=0)` (`src/maintenance/models.py`).
- `engine.stock_levels` thêm khoá `"min_qty"`; `StockRow.min_qty: int | None = None`. Vật tư thêm ngoài danh mục ⇒ `None`.
Dữ liệu mô phỏng (`seed/maintenance_v1/catalog.yaml`):

| Mã | Đơn vị | Tồn mô phỏng | Tồn tối thiểu | Nhãn kỳ vọng |
|---|---|---|---|---|
| SIM-MAT-CLEAN-01 | Chai | 24 | 10 | An toàn |
| SIM-MAT-BAG-01 | Cuộn | 40 | 15 | An toàn |
| SIM-MAT-LAMP-01 | Cái | 4 | 5 | Sắp hết |
| SIM-MAT-LAMP-02 | Cái | 0 | 5 | Hết hàng |

`SIM-MAT-STARTER-01` (Tắc te) đã BỎ khỏi danh mục và playbook `PB-TEC-01` (plan D08). Không vật tư nào trong danh mục còn tồn `null`; nhãn "Chưa kiểm kê" vẫn giữ cho vật tư chưa kiểm kê.

Portal (`lib/stock.ts`):
```ts
export type StockLevel = "unknown" | "out" | "low" | "ok";
export function stockLevel(qty: number | null, min: number | null): StockLevel;
```
`qty === null` ⇒ "unknown"; `qty <= 0` ⇒ "out"; `min !== null && qty <= min` ⇒ "low"; còn lại "ok". Nhãn: Chưa kiểm kê (xám, số hiển thị `--`) · Hết hàng (đỏ) · Sắp hết (cam) · An toàn (xanh). Thẻ "Cần nhập thêm" = số dòng "out" + "low".

## §6 Định nghĩa số liệu (đợt 2, đã chốt Q6)
Đúng hạn = báo hoàn thành (READY_FOR_REVIEW) trong 4 giờ (khẩn cấp) / 48 giờ (thường) kể từ `created_at`. Thời gian xử lý TB = từ `accepted_at` tới lúc báo hoàn thành. Tuần bắt đầu thứ Hai, múi giờ Asia/Ho_Chi_Minh. Lọc theo ngày hoàn thành. CSAT = trung bình sao.

## §7 Vị trí trống
`parseDescription` trả `"—"` khi không có vị trí (giữ nguyên, test cũ dựa vào). UI mới chỉ hiện vị trí khi `hasLocation(location)` (`lib/reception-done.ts`) đúng.

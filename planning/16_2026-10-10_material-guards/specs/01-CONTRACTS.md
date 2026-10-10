# Contracts

## §C1. Phạm vi vật tư và kiểu số

```python
allowed_material_codes(catalog: Catalog, department_id: str) -> frozenset[str]
```

Kết quả = hợp `catalog.playbook_materials[p]` của mọi `p` có `catalog.playbook_departments[p] == department_id`, giao với mã tồn tại trong `catalog.materials`. Department không có mapping ⇒ tập rỗng, fail closed cho mọi dòng. Không lọc chỉ theo playbook của ticket, vì kỹ thuật viên được chọn mọi vật tư hợp lệ của phòng mình.

Số lượng do client gửi phải là JSON number hữu hạn, nguyên, >0. Chấp nhận `1` và `1.0`; từ chối `0`, âm, `0.5`, bool, chuỗi `"1"`, NaN/Infinity. API kiểm trước coercion; engine kiểm lại khi gọi trực tiếp. Model stored float hiện có giữ nguyên. Không đổi tồn kho thành int.

## §C2. Endpoint nguyên tử mới

```http
POST /api/v1/mo/tickets/{ticket_id}/material-usage
Authorization: Bearer <session>
Content-Type: application/json
{"lines":[{"item_code":"SIM-MAT-LAMP-01","used_qty":4}]}
```

```python
class MaterialUsageLine(BaseModel):
    item_code: str
    used_qty: float  # before-validator theo C1; stored float không thay
class MaterialUsageRequest(BaseModel):
    lines: list[MaterialUsageLine]
MaintenanceEngine.save_material_usage(
    ticket_id: str, actor_id: str, *, lines: list[MaterialUsageLine]
) -> Case
```

Các request model mới `extra='forbid'`; không nhận client `issued_qty`, note bắt buộc, norm hoặc variance_reason. Response 200 `Case` như API cũ. Router mỏng, không chứa luật quyền hoặc phép trừ kho.

Operation chỉ cho actor DEPARTMENT đúng ticket; ticket IN_PROGRESS và điều kiện hiện có của UPDATE_MATERIAL. Ticket Kỹ thuật ≥1 dòng, Vệ sinh cho phép `[]`. Danh sách là thay toàn bộ, không append; mã không trùng.

Mỗi dòng mới `planned_qty = issued_qty = used_qty` theo số kỹ thuật viên chọn; `norm_qty` vẫn catalog snapshot; không prefill Agent. Ticket Vệ sinh rỗng: mode N_A và hoàn lại mọi lượng đã xuất của dòng bị bỏ. Tổng delta kho theo mã = `new issued - old issued`; mã bị bỏ `new=0`. Với stock known: take dương kiểm đủ; take âm hoàn lại. Stock unknown (`None`) giữ semantics repository hiện có, không ép 0 và không tạo số tồn giả.

## §C3. Guard cho API cũ và hoàn thành

- `POST .../material-plan`: giữ body `{lines: PlannedMaterial[], note?: string|null}`, note optional. Áp dụng mapping, nguyên dương, trùng, technical nonempty như C1/C2.
- `POST .../materials/{item_code}`: giữ body `issued_qty, used_qty, variance_reason?`; số issued/used phải nguyên dương; vẫn `used <= issued`. Mã phải tồn tại trong draft và hợp lệ với phòng ban. Không siết field float toàn hệ thống, dùng validators ở request tương ứng.
- Engine `confirm_materials`, `record_material` kiểm lại các luật trên; không chỉ dựa Pydantic/router.
- Hoàn thành Kỹ thuật cần ít nhất một dòng hợp lệ đã ghi issued/used; không cho dùng N_A để vượt guard. Client cũ hoặc dữ liệu cũ không đúng guard ⇒ không thể hoàn thành bằng bypass.
- Plan 15 Q01/Q02 giữ: so norm/Agent chỉ dữ liệu tham khảo; chỉ `USED_VS_ISSUED` có quyền đòi giải thích.
- Thay đổi có chủ ý: các request cũ từng cho số lẻ/0/khác phòng ban/Kỹ thuật rỗng nay bị từ chối. Không migration/sửa lịch sử tự động. Dòng cũ không hợp lệ phải được thay bằng lựa chọn hợp lệ hoặc loại bỏ qua C2.

## §C4. Transaction, lặp và đồng thời

- Chỉ một `_mutate` cho C2; dùng private helpers trên cùng work/tx. Không gọi `confirm_materials()` rồi `record_material()` công khai.
- Validate toàn bộ trước effects; delta kho xử lý theo mã tăng dần để giảm nguy cơ deadlock trên nhiều mã.
- Bất kỳ lỗi giữa dòng 1 và dòng 2, commit audit, save hoặc outbox ⇒ rollback toàn bộ ticket/kho/audit/outbox. Mọi thông báo UI chỉ sau 200.
- Lưu payload giống nhau: delta kho 0; trạng thái/used không đổi; cho phép audit thêm lần người dùng lưu, không yêu cầu idempotency key hoặc schema mới.
- Tăng/giảm 4→2→4 và bỏ/thay dòng chỉ thực hiện delta. Không dùng stock hiển thị trên UI làm nguồn quyết định.
- Hai writers cùng ticket: dùng lock/concurrency hiện có. Operation là full replacement; khi serialize, lần sau thay payload lần trước. Không hứa chống stale edit ở spec này, không thêm expected-version âm thầm.

## §C5. Lỗi và hành vi caller

| HTTP / lỗi | Điều kiện | Caller |
|---|---|---|
| 401 auth | Session sai/hết hạn | Đăng nhập lại, không tự POST lại |
| 404 NOT_FOUND | Ticket không tồn tại | Tải lại danh sách; giữ thứ tự lỗi hiện có |
| 403 ACTION_DENIED | Sai vai/phòng ban actor | Hiện không có quyền; không lộ trạng thái vượt contract hiện có |
| 422 validation | Body sai kiểu, extra fields, số không nguyên dương | Chỉ rõ dòng; giữ input, không đổi kho |
| 409 GUARD_FAILED | Mã lạ/khác phòng ban, trùng, Kỹ thuật rỗng, thiếu stock, state không hợp lệ | Giữ input, tải lại số tồn; mọi state trước operation giữ nguyên |
| 409 CONCURRENT_UPDATE | Repo báo xung đột | Tải dữ liệu mới; yêu cầu người dùng kiểm lại, không tự retry ghi |
| 503 STORE_UNAVAILABLE / STORE_PERMISSION_DENIED theo handler hiện có | Lỗi lưu trữ | Báo chưa lưu; không giả success, không retry POST tự động |

Engine trực tiếp: mọi số sai GuardError; quyền vẫn ActionDeniedError; state vẫn lỗi hiện có. Auth-denial audit hiện có được giữ; rollback-không-audit trong C4 áp cho mutation hợp lệ bắt đầu rồi thất bại, không xoá audit từ chối quyền.

## §C6. Vùng cấm và số đo

CẤM tạo mapping vật tư riêng trong JS, gửi nhiều POST cho một lần lưu mới, bỏ so used/issued legacy hoặc xoá fields tham khảo. Đo JSON request/response, số POST=1, ảnh trạng thái trước/sau rollback; mỗi lỗi ở C5 có API test và engine probe tương ứng. API errors trả qua wrapper hiện có; không trả raw DB exception/key.

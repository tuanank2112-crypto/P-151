# SPEC-P01 — Mở rộng backend cho portal (WP1, 🔴 thiết kế đã chốt ở đây, thi công 🟠)

Nguyên tắc chung (00 §2 vùng cấm cuối): KHÔNG thêm trường/giá trị enum vào doc ticket JSONB. Chỉ dùng trường đã có (`blocker.escalated`, `closure_kind=NORMAL`, …) hoặc bảng MỚI. Mỗi route mới: router mỏng gọi một method engine; quyền kiểm ở engine (403 + `ACTION_DENIED` audit), trạng thái sai ⇒ 409.

## 1. Tài khoản demo của portal + hồ sơ cư dân (R5)
- `seed/maintenance_v1/accounts.yaml`: THÊM 6 tài khoản, mật khẩu `123456` (băm bằng `src.api.auth.hash_password`, 200 000 vòng), giữ nguyên 8 tài khoản cũ:

| username | actor_id | display_name |
|---|---|---|
| cudan | SIM-ACTOR-RESIDENT-01 | Nguyễn Minh Anh |
| tiepnhan | SIM-ACTOR-BPTN-01 | Phạm Thu Trang |
| quanly | SIM-ACTOR-BQL-01 | Vũ Hoàng Long |
| vesinh | SIM-ACTOR-DEPT-CLN-01 | Ngô Thị Lan |
| kythuat | SIM-ACTOR-DEPT-TEC-01 | Đặng Văn Hùng |
| kho | SIM-ACTOR-WAREHOUSE-01 | Trần Minh Kho |

- `Account` thêm trường tùy chọn `profile: {tower: str, floor: str, apartment: str} | None = None` (model `extra="forbid"` giữ nguyên). `cudan`: `{tower: "S2.05", floor: "12", apartment: "1208"}`; `cudan01`: `{S2.05, 14, 1402}`; `cudan02`: `{S1.12, 8, 0805}`.
- `Me` thêm `profile: Profile | None` (cùng hình). `GET /auth/me` và login trả kèm.
- CẤM: đổi `shared_test_password` (`Demo@2026`, các tài khoản cũ vẫn dùng); đổi actor của tài khoản cũ.
- Nghiệm thu: login `kho`/`123456` ⇒ 200, `user.role=="WAREHOUSE"`; `cudan` ⇒ `profile.tower=="S2.05"`; login `cudan01`/`Demo@2026` vẫn 200.

## 2. Việc của BQL (R11): ticket ngoài phạm vi VS/KT do BQL xử lý
Ticket về phí, thủ tục, an ninh, tranh chấp ⇒ engine đã dừng `VERIFYING/OUT_OF_SCOPE` (chủ BPTN; đo 2026-10-09: "Hóa đơn phí dịch vụ…", "Căn hộ bên cạnh gây ồn…" ⇒ OUT_OF_SCOPE). "Việc của BQL" = ticket `OUT_OF_SCOPE` có `blocker.escalated == true` (trường có sẵn; job SLA cũng tự leo thang BPTN quá hạn ⇒ tự vào BQL — chấp nhận, đúng nghĩa leo thang).

| Route | Vai | Engine | Điều kiện (sai ⇒ 409 `INVALID_TRANSITION`) | Tác dụng |
|---|---|---|---|---|
| `POST /mo/tickets/{id}/to-bql {note: str ≥1}` | BPTN | `send_to_bql(id, actor, note)` | `VERIFYING`, blocker `OUT_OF_SCOPE`, `escalated == false` | blocker giữ code, `escalated=true`; audit `ESCALATE` (Action có sẵn; nếu không có dùng `TRANSITION` field `blocker.escalated`); notification `escalation` audience BQL, payload `{reason_code: OUT_OF_SCOPE, by: BPTN}` |
| `POST /bql/tickets/{id}/handled {note: str ≥1}` | BQL | `bql_handle_out_of_scope(id, actor, note)` | `VERIFYING`, blocker `OUT_OF_SCOPE` (escalated hay không) | `VERIFYING → CLOSED`, `closure_kind=EMERGENCY_HANDLED` (Q09: `Ticket._status_rules` chỉ cho CLOSED không phòng ban khi EMERGENCY_HANDLED; nới validator thì bản Render cũ không đọc được doc), `closed_by`, `closed_at`; public message "Ban quản lý đã xử lý phản ánh."; nhánh mới trong guard T10 (`(S.VERIFYING, S.CLOSED)` hiện chỉ cho `EMERGENCY_PENDING_BQL`) |
| `POST /bql/tickets/{id}/return-to-bptn {note: str ≥1}` | BQL | `bql_return_to_bptn(id, actor, note)` | `VERIFYING`, blocker `OUT_OF_SCOPE`, `escalated == true` | blocker mới cùng code `OUT_OF_SCOPE`, `escalated=false`, `escalate_at`/`next_retry_at` tính lại như blocker vừa tạo; audit ghi note |
- Vai sai ⇒ 403 `ACTION_DENIED` + audit (đi qua `_mutate`/`_deny` như mọi method). Note rỗng ⇒ 409 `GUARD_FAILED`.
- Sau `handled`, cư dân đánh giá được (CLOSED ⇒ `RATE`), như ticket thường.
- CẤM: thêm Department `DEPT_BQL` hay ReasonCode mới (vỡ code cũ đọc Supabase); BQL "nhận xử lý" thành trạng thái riêng.
- Nghiệm thu (test engine + API): đường đi đủ BPTN `to-bql` ⇒ BQL `handled` ⇒ CLOSED; `return-to-bptn` ⇒ hết escalated, BPTN thấy lại; vai sai 403 + audit; trạng thái sai 409; doc ticket sau mỗi bước `Case.model_validate` bằng model CŨ (HEAD trước WP1) vẫn qua (bằng chứng tương thích).

## 3. Vật tư ngoài danh mục (R7 nút "+")
- **Lưu trữ:** bảng MỚI `maintops.material_items (item_code text primary key, item_name text not null, unit text not null, created_by text not null, created_at timestamptz not null default now())` — Alembic revision `0003_material_items` (chỉ tạo bảng; KHÔNG sửa bảng cũ). Memory store: dict. Repo thêm `material_items() -> list[MaterialItem]`, `add_material_item(item) -> MaterialItem`.
- **Engine:** `create_material_item(actor_id, item_name, unit) -> MaterialItem`. Vai: WAREHOUSE, BQL, DEPARTMENT. `item_name` 2..80 ký tự (strip), `unit` 1..20. Trùng tên (so sánh `casefold` sau strip, với cả danh mục yaml lẫn bảng) ⇒ trả item có sẵn, không tạo mới. Mã `SIM-MAT-X-<8 hex>`. Tạo xong `set_stock(code, 0)` ⇒ kế hoạch dùng nó sẽ `INSUFFICIENT` ⇒ `WAITING_MATERIAL` ⇒ kho nhập.
- **Tra cứu một chỗ:** mọi `self.catalog.material(code)` trong engine/views đi qua `self.material(code)` = yaml trước, rồi bảng. `GET /mo/catalog.materials` và `GET /mo/warehouse/stock` gộp cả hai (tên/đơn vị lấy từ bảng).
- **Route:** `POST /mo/warehouse/items {item_name, unit}` ⇒ 201 `{item_code, item_name, unit, qty}`.
- **Cờ:** `MO_CUSTOM_MATERIALS` (mặc định `true` khi `MO_STORE=memory`, `false` khi `postgres`). Tắt ⇒ route 403 `{code: FEATURE_DISABLED}` và `GET /mo/catalog` trả `custom_materials_enabled: false` (trường mới của CatalogView — response, không phải doc) ⇒ portal ẩn nút "+". Lý do: bản backend cũ trên Render gặp mã vật tư lạ trong doc ticket chưa được đo; bật trên Supabase cần OPERATIONS §3 bước 4.
- Nghiệm thu: tạo "Ống nước PVC 21" ⇒ có trong catalog + stock 0; plan dùng nó ⇒ ticket `WAITING_MATERIAL`; kho nhập 2 ⇒ ticket chạy tiếp; tạo lại cùng tên khác hoa/thường ⇒ cùng mã; cờ tắt ⇒ 403.

## 3b. BQL quản lý kho như thủ kho (Q08)
- `receive_stock` (`POST /mo/warehouse/stock/{item_code}`) và `POST /mo/warehouse/items`: vai WAREHOUSE **và BQL** (sửa bảng `PERMISSIONS` của action nhập kho; audit ghi đúng vai). Vai khác vẫn 403.
- Nghiệm thu: `quanly`/`bql01` nhập kho 3 ⇒ 200, tồn tăng 3; `kythuat01` nhập kho ⇒ 403 + audit.

## 4. Mở route cho method engine có sẵn (không đổi engine)
| Route | Vai | Gọi |
|---|---|---|
| `POST /mo/tickets/{id}/wrong-department {note}` | DEPARTMENT | `engine.report_wrong_department(id, actor, note=)` (T16) |
| `POST /bql/tickets/{id}/wrong-department {decision: "KEEP"|"TO_BPTN", note}` | BQL | `engine.bql_wrong_department(id, actor, decision=, note=)` |

## 5. Bảng phân loại lỗi (backend trả, portal hiển thị — 01 §8)
| Tình huống | HTTP | Caller (portal) phải |
|---|---|---|
| Vai sai | 403 ACTION_DENIED | hiện message, không thử lại |
| Trạng thái/blocker sai (người khác vừa xử lý) | 409 INVALID_TRANSITION / CONCURRENT_UPDATE | hiện message + `router.refresh()` |
| Note rỗng, tên vật tư sai độ dài | 409 GUARD_FAILED / 422 | hiện lỗi ở form |
| Cờ vật tư tắt | 403 FEATURE_DISABLED | ẩn "+", hiện "Chưa bật nhập vật tư mới" |

## 6. Vùng cấm
- Không đổi luật an toàn, Agent, prompt, `lexicon.yaml`.
- Không đổi hình doc ticket (I-xx 00 §2). Không xoá/đổi tài khoản cũ.
- Không thêm route cho QA ngoài các route ở §2–§4.

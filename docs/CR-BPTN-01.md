# CR-BPTN-01 — Conditional BPTN Review and Override

> **Status:** PROPOSED
> **Baseline bị tác động:** MaintenanceOps MVP v0.3 — FROZEN (freeze 28/09/2026; bằng chứng sign-off OD-09 trong repo vẫn `PENDING`, xem mục 8)
> **Target candidate:** MaintenanceOps MVP v0.4
> **Ngày đề xuất:** 2026-09-29
> **Người đề xuất:** thành viên phụ trách nhánh `feature/chamanh`
> **Data classification:** Chỉ dữ liệu mô phỏng; không phải quy trình/dữ liệu vận hành Vinhomes

## 1. Vấn đề

Baseline v0.3 bắt BPTN xác nhận service/type/location cho **mọi** ticket trước khi Agent tạo draft (`PB-COM-R-CFM-01`, `CF-14`, `OD-01`). Khi chạy demo, BPTN chỉ bấm xác nhận lại đúng đề xuất của Agent cho ticket rủi ro thấp, dữ liệu đầy đủ. Bước này không thêm thông tin, làm chậm flow và làm mờ trách nhiệm: Agent đang hỗ trợ BPTN hay BPTN chỉ duyệt lại Agent.

PRD v0.3 còn có hai cách hiểu mâu thuẫn về thứ tự BPTN–Agent: §3.1/§3.2 ghi "BPTN xác nhận rồi Agent match", còn `FR-CLASSIFY-001` ghi "Agent đề xuất rồi BPTN xác nhận". CR này thay cả hai bằng một quy tắc duy nhất.

## 2. Phạm vi

- Thay BPTN confirmation **bắt buộc** bằng review **có điều kiện** và quyền **override** có kiểm soát.
- Chỉ áp dụng cho hai playbook mô phỏng `PB-CLN-01`, `PB-TEC-01`.
- **Không** mở rộng thành pilot hoặc vận hành thật; không thêm top-level state; không đổi team-only routing, asset/stock/duty gate, safety rule hay permission của Agent/BQL/nhân sự thực hiện.

## 3. Flow mới

```text
Ticket từ app/form hiện có
→ hệ thống kiểm tra dữ liệu có cấu trúc (ticket_id, created_at, original_description)
→ Agent phân loại và chạy safety rules
→ Agent quyết định ticket có cần BPTN review hay không
→ tiếp tục playbook, asset, material stock và duty lookup
→ tạo WorkOrderDraft
→ đề xuất tuyến team nếu đủ điều kiện
```

## 4. Quy tắc

| # | Điều kiện | `confirmation_status` | State / hành vi |
|---|---|---|---|
| 1 | Rủi ro thấp, dữ liệu đầy đủ, category và location khớp rõ | `NOT_REQUIRED` | Agent tiếp tục; không cần BPTN confirm |
| 2 | Thiếu location (`LOCATION_MISSING`) hoặc category không rõ (`CATEGORY_UNCLEAR`) | `PENDING_REVIEW` + `review_required_reason` | `CHỜ XÁC MINH` (`PB-COM-R-CFM-01` hoặc `PB-COM-R-CLS-01`); BPTN bổ sung/hiệu chỉnh trường hành chính được phép |
| 3 | BPTN đã xem nhưng không thay đổi | `CONFIRMED` | Không đổi draft; audit `CONFIRM_NORMALIZATION` |
| 4 | BPTN thay đổi service/type/location | `OVERRIDDEN` | Bắt buộc `override_reason`; lưu `override_source_references` nếu có; chạy lại classification/playbook, asset, material gate, duty và route (`PB-COM-R-OVR-01`) |
| 5 | Ticket có safety risk | Không đổi | `EXCEPTION`; BPTN review/override bị từ chối (`ACTION_DENIED`, audit); chỉ BQL resolve |
| 6 | Nội dung phản ánh gốc và evidence gốc | — | Bất biến; BPTN không sửa được (`EDIT_RAW` luôn `ACTION_DENIED`) |
| 7 | Mọi confirm/override | — | Có audit event; `audit_event_id` lưu trong administrative layer |

Ghi chú:

- Asset `NOT_FOUND`/`AMBIGUOUS` vẫn đi `CHỜ XÁC MINH` theo `PB-COM-R-AST-01`; BPTN có thể override location để Agent lookup lại, nhưng Agent không đoán.
- Override phải để lại dữ liệu đầy đủ (cặp service/type hợp lệ và có location); override không thay đổi gì bị từ chối.
- `review_required_reason` được giữ lại sau khi BPTN xử lý để truy vết lý do review.

## 5. Data contract tối thiểu

Trên `Ticket.administrative_normalization` (không phải top-level state):

| Field | Kiểu | Quy tắc |
|---|---|---|
| `confirmation_status` | enum `NOT_REQUIRED \| PENDING_REVIEW \| CONFIRMED \| OVERRIDDEN` | Do Agent đặt (`NOT_REQUIRED`/`PENDING_REVIEW`) hoặc BPTN (`CONFIRMED`/`OVERRIDDEN`) |
| `review_required_reason` | enum `LOCATION_MISSING \| CATEGORY_UNCLEAR` / null | Bắt buộc khi `PENDING_REVIEW`; null khi `NOT_REQUIRED` |
| `confirmed_by`, `confirmed_at` | actor BPTN, timestamp có timezone | Bắt buộc iff `CONFIRMED` hoặc `OVERRIDDEN` |
| `override_reason` | string | Bắt buộc iff `OVERRIDDEN` |
| `override_source_references` | array<string> | Tùy chọn; lưu nguồn đối chiếu nếu có |
| `override_fields` | array<string> | Bắt buộc iff `OVERRIDDEN`; tên field đã đổi |
| `audit_event_id` | `SIM-AUD-*` | Event đã đặt `confirmation_status` hiện tại |

`AgentClassificationProposal` không còn giữ `confirmation_status`/`confirmed_by`/`confirmed_at`; nguồn duy nhất là administrative layer.

## 6. API (prototype)

- `POST /api/v1/mo/tickets/{id}/confirm` — body `{ "note": string | null }`; từ chối (409) nếu `PENDING_REVIEW`.
- `POST /api/v1/mo/tickets/{id}/override` — body `{ override_reason, location_normalized?, service_category?, ticket_type?, override_source_references? }`; thiếu `override_reason` → 422/409; safety exception → 403.
- Header `X-Actor-Id: SIM-ACTOR-BPTN-01`.

## 7. Tác động

| Hạng mục | Thay đổi |
|---|---|
| Fixture | 12 ticket giữ nguyên, bỏ bước BPTN kịch bản; expected thêm `location_normalized` và `confirmation_status=NOT_REQUIRED`; `dataset_version` → `maintenanceops-sim-v1.1` |
| Demo flow | Bốn demo flow không còn bước BPTN; kết quả state/route không đổi |
| Test | Thêm test BPTN 1–8 (conditional, override, safety, raw, reason) |
| Rule | Sửa nghĩa `PB-COM-R-CFM-01` (chỉ khi `PENDING_REVIEW`); thêm `PB-COM-R-OVR-01` |
| Pilot | Human override rate và clarification rate theo reason được thêm vào kế hoạch đo pilot, không phải acceptance MVP |

## 8. Quyết định cần có

- CR ở trạng thái `PROPOSED`: code trên nhánh `feature/chamanh` đã hiện thực behavior này như **v0.4 candidate**; không coi là chỉnh sửa âm thầm của v0.3.
- Cần Product approver/proxy BQL duyệt CR trước khi merge vào baseline tiếp theo.
- OD-09: repo chưa có approval record có tên người phê duyệt cho v0.3; CR này không tạo hoặc giả định approver.

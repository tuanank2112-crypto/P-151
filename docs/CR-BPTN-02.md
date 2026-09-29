# CR-BPTN-02 — Flow v0.5: chuyển phòng ban, trạng thái công khai, retry, BQL đóng ticket

> **Status:** PROPOSED
> **Baseline bị tác động:** MaintenanceOps MVP v0.3 + [CR-BPTN-01](CR-BPTN-01.md) (v0.4 candidate, cũng `PROPOSED`)
> **Target candidate:** MaintenanceOps MVP v0.5
> **Ngày đề xuất:** 2026-09-29
> **Người đề xuất:** thành viên phụ trách nhánh `feature/chamanh`
> **Data classification:** Chỉ dữ liệu mô phỏng; không phải quy trình/dữ liệu vận hành Vinhomes

Tài liệu này ghi lại CR như đã hiện thực trong code, với tên field/enum thật của repo. Chỗ nào code khác bản mô tả
gốc thì ghi ở mục 9. Đã gộp **bản sửa 1** (thứ tự bắt buộc: BPTN review nếu cần → tra tài sản → giao phòng ban):
tách `proposed_department_id` / `department_id`, thêm `asset_resolution`, chốt `can_route`, `WRONG_DEPT` chạy lại
từ bước 6 hoặc 7, test 13–16 và bất biến 6.

## 1. Mục tiêu và phạm vi

1. Agent chuyển ticket tới **phòng ban**, không đề xuất team, không gán người.
2. Bỏ luật an toàn (`PB-*-R-EX-01`, `R-RISK-01`, `R-SAFE-01`) và trạng thái `EXCEPTION`.
3. Trạng thái kiểu theo dõi đơn hàng; cư dân và BQL cùng xem, ở hai mức chi tiết.
4. Mỗi lý do dừng có người gỡ, điểm chạy lại và mốc leo thang.
5. Chỉ BQL được đóng hoặc hủy ticket.

Ngoài phạm vi: phân công nhân sự trong phòng ban (`assignee_id` do phòng ban tự set, không có endpoint), kênh gửi
thông báo (chỉ ghi outbox `Notification`), giao diện.

## 2. Mô hình dữ liệu (`src/maintenance/enums.py`, `models.py`)

- `TicketStatus`: `RECEIVED`, `VERIFYING`, `ROUTED`, `IN_PROGRESS`, `READY_FOR_REVIEW`, `CLOSED`, `NEED_INFO`,
  `ON_HOLD`, `MERGED`, `CANCELLED`. Nhãn tiếng Việt trong `src/maintenance/i18n/vi.yaml`.
- `ReasonCode`: 12 mã như bản mô tả.
- `Department`: `DEPT_CLEANING`, `DEPT_TECHNICAL`. Bảng playbook → phòng ban là `playbook_departments` trong
  `seed/maintenance_v1/catalog.yaml`.
- `Ticket` thêm: `status`, `proposed_department_id` (bước 4, chỉ là đề xuất, cư dân không thấy),
  `department_id` (chỉ set ở bước 8, lúc giao thật), `review_status` (`NOT_REQUIRED | PENDING_REVIEW | CONFIRMED`,
  đổi tên từ `confirmation_status` v0.4), `asset_resolution` (`FOUND | ONSITE_BY_BPTN | NOT_APPLICABLE | null`),
  `assignee_id`, `blocker`, `locked_fields`, `merged_into`, `flags`, `rework_count`, `dispatched_at`, `accepted_at`,
  `closed_by`, `closed_at`, `cancel_reason`, `reopen_until`, `rating`, `resident_id`. Bỏ `current_state`,
  `state_decision`, `administrative_normalization`. Model từ chối `ROUTED`/`IN_PROGRESS`/`READY_FOR_REVIEW`/`CLOSED`
  khi `department_id` rỗng.
- `locked_fields` = `{category, location, asset_id, department}`. `department` là thêm so với bản mô tả: lưu phòng ban
  BPTN chọn lại sau `WRONG_DEPT` khi giữ nguyên loại việc, để bước 4 chạy lại không ghi đè.
- `Blocker` như §2.5 bản mô tả, thêm `related_ticket_id` (ticket gốc khi `DUPLICATE`), `resolved_at`,
  `resolved_by` (sự kiện gỡ ghi vào đây, `resume()` đọc để chạy tiếp).
- `StatusEvent` = `ticket_status_events`, thêm cờ `public` (hiện trên timeline cư dân khi đổi trạng thái hoặc
  blocker được đặt/gỡ; retry và leo thang là nội bộ).
- `ResidentAddition` = `ticket_resident_additions`, append-only.
- `WorkOrderDraft`: bỏ `routing_team_id`, `duty_*`, `route_status`, `queue_*`; thêm `department_id`, `flags`,
  `location`.
- Xóa: `DutyAvailability`, `ExceptionRecord`, `StateDecision`, `AdministrativeNormalization`, `RuleSignal`,
  `resolver.py`, `team_routing.py`, lịch ca/duty/capacity trong catalog.

## 3. State machine (`engine.py`: `TRANSITIONS`, `transition`, `_apply_transition`)

Bảng `TRANSITIONS` là 16 dòng của bản mô tả cộng `→ CANCELLED` từ 7 trạng thái chưa kết thúc. Mọi thay đổi status
đi qua `_apply_transition`: kiểm tra bảng, ghi đúng một `StatusEvent`, phát `ticket.status_changed`.

- `transition(ticket_id, to, actor_id, ...)` là cửa vào cho người (phòng ban, BQL, BPTN, cư dân). Vai trò không bao
  giờ được vào `to` → `ACTION_DENIED` có audit (ví dụ ai khác BQL đóng ticket). Đúng vai trò nhưng sai trạng thái
  nguồn → `INVALID_TRANSITION` (HTTP 409).
- Các dòng do pipeline/hệ thống chạy (`RECEIVED → NEED_INFO/VERIFYING/ON_HOLD/ROUTED`, `→ RECEIVED`,
  `IN_PROGRESS → READY_FOR_REVIEW`) không gọi được từ ngoài.
- **Chốt giao phòng ban:** `_apply_transition` từ chối mọi chuyển sang `ROUTED` khi `can_route` sai
  (`route_blockers()` liệt kê lý do), và khi `department_id` giao khác `proposed_department_id`. Bước 8 cũng tự kiểm
  tra trước khi tạo draft. Không vai trò nào gọi được `transition(..., ROUTED)` từ ngoài.

  ```
  can_route(ticket) = review_status in (NOT_REQUIRED, CONFIRMED)
                  and asset_resolution in (FOUND, ONSITE_BY_BPTN, NOT_APPLICABLE)
                  and proposed_department_id != null
  ```
- Bất biến được kiểm tra bằng test: (1) chỉ BQL đóng/hủy; (2) Agent không ghi `assignee_id`; (3) Agent không ghi đè
  `locked_fields`; (4) raw không đổi (integrity marker); (5) chuỗi event khớp từng lần đổi trạng thái; (6) không ticket
  nào có `department_id` mà `can_route` sai, kể cả sau `WRONG_DEPT`/`OUT_OF_SCOPE`.

## 4. Pipeline Agent (bước 2–8, 10)

`_run_pipeline(work, from_step)` dừng ở bước đầu tiên gặp blocker.

| Bước | Hiện thực | Khi không đạt |
|---|---|---|
| 2 | `ticket_id`, `created_at`, nội dung, vị trí sơ bộ (`extract_location` trên nội dung gốc + bổ sung, hoặc `locked_fields.location`) | `NEED_INFO`/`MISSING_INFO`, liệt kê field thiếu |
| 3 | Ticket khác chưa kết thúc, tạo trước, cùng category và cùng vị trí `Tòa / Tầng / Khu vực`, cách ≤ 48h | `VERIFYING`/`DUPLICATE`, `resume_step=4` |
| 4 | Phân loại (luật + LLM nếu bật) → playbook → **đề xuất** phòng ban (`proposed_department_id`). Bỏ qua phân loại nếu `locked_fields.category` | `CATEGORY_UNCLEAR` (khớp cả hai / luật-LLM lệch) hoặc `OUT_OF_SCOPE` (không khớp): BPTN chọn loại việc → `review_status=CONFIRMED`, `resume_step=6` |
| 5 | Playbook chỉ do LLM đề xuất → `PENDING_REVIEW`; còn lại `NOT_REQUIRED`. Bỏ qua nếu đã `CONFIRMED` | `VERIFYING`/`PENDING_REVIEW`: BPTN sửa hoặc xác nhận → `CONFIRMED`, `resume_step=6` |
| 6 | Đèn: đúng 1 asset khớp vị trí hoặc `locked_fields.asset_id` → `FOUND`. Vệ sinh → `NOT_APPLICABLE` | `ASSET_UNCLEAR`: BPTN chọn asset (`FOUND`) hoặc chủ động chọn xác định tại hiện trường kèm lý do (`ONSITE_BY_BPTN` + cờ `ASSET_CHECK_ONSITE`). Agent không tự bỏ qua |
| 7 | So vật tư dự kiến với tồn kho mô phỏng | Thiếu: `ON_HOLD`/`WAITING_MATERIAL`. Không rõ: cờ `STOCK_CHECK_ON_ACCEPT`, đi tiếp |
| 8 | Kiểm tra `can_route`, `department_id = proposed_department_id`, tạo `WorkOrderDraft` (`assignee_id=null`), `RECEIVED → ROUTED` | Ngoài ca: `ROUTED` + `OUT_OF_HOURS`, `next_retry_at` = đầu ca kế tiếp |

**Phòng ban trả về (`WRONG_DEPT`):** `department_id` về `null`, ticket về `VERIFYING`. BPTN chọn lại loại việc
và/hoặc phòng ban. Loại việc đổi → reset `asset_resolution`, bỏ asset/phòng ban đã khóa và cờ `ASSET_CHECK_ONSITE`,
chạy lại từ bước 6. Cùng loại việc → chạy lại từ bước 7. Không bao giờ nhảy thẳng vào bước 8.

| Mã | Chạy lại từ |
|---|---|
| `DUPLICATE` (BPTN bác) | Bước 4 |
| `CATEGORY_UNCLEAR`, `OUT_OF_SCOPE`, `PENDING_REVIEW`, `ASSET_UNCLEAR` | Bước 6 |
| `WRONG_DEPT` | Bước 6 nếu đổi loại việc, bước 7 nếu không |
| `MISSING_INFO` / `WAITING_MATERIAL` | Bước 2 / bước 7 |
| 10 | `report_complete`: 6 điều kiện (§4 bản mô tả) | Giữ `IN_PROGRESS`, `failing_items` trong `draft.readiness_evaluation` + thông báo `department.reconcile_failed`, không blocker |

## 5. Retry và leo thang

- `resume(ticket_id)`: gỡ blocker nếu điều kiện đã đạt rồi chạy tiếp; gọi lần hai không tạo event.
- Sự kiện: `add_resident_info`, `bptn_resolve`, `receive_stock`, `accept`, `resume_work` như bảng §5 bản mô tả.
- Job: `run_jobs(now)`, chạy trong process API mỗi `sla_config.job_interval_minutes` (tắt bằng
  `MO_JOBS_ENABLED=false`); endpoint `POST /mo/jobs/run` cho demo.
- `NOT_ACCEPTED` do job đặt khi ticket `ROUTED` chưa ai nhận sau `not_accepted.start_after_hours` (lần nhắc 1),
  nhắc mỗi 2h, leo thang ở lần đến hạn sau lần nhắc thứ 3.
- Vượt `max_auto_retries` hoặc tới `escalate_at` → `escalated=true` + thông báo BQL. Không đổi status.
- Mọi mốc giờ, ca phòng ban, giờ hành chính: `sla_config`, `departments`, `business_hours` trong catalog.

## 6. Hiển thị và API

- `GET /api/v1/resident/tickets/{id}`: dựng từ allow-list (`views.py`), không có `reason_code`, `internal_note`,
  `assignee_id`, vật tư, số lần retry, cờ leo thang. Cư dân chỉ xem ticket của mình (ticket người khác → 404).
- `GET /api/v1/bql/tickets`: đầy đủ, lọc `status`, `department_id`, `blocker_code`, `escalated`, `overdue`.
- `public_message` chỉ sinh từ `src/maintenance/i18n/vi.yaml`.

## 7. Migration từ v0.4 (`migration.py`)

Prototype giữ ticket in-memory và nạp lại fixture khi khởi động, nên không có dữ liệu v0.4 lưu trữ để chuyển.
`plan_v04_migration(case_v04, catalog)` là hàm ánh xạ theo bảng §2.7 bản mô tả, cho một kho dữ liệu thật gọi. Các lý
do `CHỜ XÁC MINH` không có mã tương ứng (`DTY-03`, `STK-02`, `RISK-01`, `MAT-02`, `EVD-02`) → `PENDING_REVIEW` kèm
`internal_note` ghi rule cũ. `IN_PROGRESS` chưa có draft → `RECEIVED` (chạy lại pipeline).

## 8. Tác động

| Hạng mục | Thay đổi |
|---|---|
| Fixture | 12 ticket giữ nguyên raw; expected viết lại theo v0.5; `dataset_version` → `maintenanceops-sim-v1.2`. CLN-004 (chất lạ) và TEC-005 (tia lửa) không còn `EXCEPTION` |
| Catalog | Bỏ `shifts`, `duty_availability`; thêm `playbook_departments`, `departments`, `business_hours`, `sla_config`, actor cư dân/phòng ban/kho |
| API | Bỏ `/confirm`, `/override`, `/exceptions/.../resolve`, `/handoff`; thêm router `/resident`, `/bql` và các action phòng ban/BPTN/kho/hệ thống |
| Test | 110 test trong `tests/test_maintenance`: acceptance §7 (1–16), bất biến 1–6, từng bước pipeline, retry/leo thang, API, migration |
| Tài liệu | `docs/01`–`05`, `data-contract-v1.md`, `playbook-v1.md` đã cập nhật: thêm dòng version history `0.5-candidate`/`1.3-candidate` và banner CR; các mục chuẩn (trạng thái, entity, pipeline, quyền, UI, test) viết lại; phần lịch sử v0.3/v0.4 giữ nguyên để truy vết |

## 9. Quyết định khi hiện thực (cần người duyệt xác nhận)

0. Trước bước 8, phòng ban không có quyền gì trên ticket (kể cả ticket `ON_HOLD`/`WAITING_MATERIAL`): kiểm tra phạm
   vi dựa trên `department_id`, không phải `proposed_department_id`. BQL lọc `department_id` chỉ thấy ticket đã giao;
   dòng BQL có thêm `proposed_department_id`, `review_status`, `asset_resolution`.
1. **Bỏ luật an toàn là thay đổi hành vi thật:** phản ánh có tia lửa, mùi khét, dây hở, chất lạ/mùi hắc giờ đi như
   ticket thường. Code không còn nhận diện các tín hiệu này ở bất kỳ đâu (cả luật lẫn LLM).
2. Bước 5 đặt `PENDING_REVIEW` chỉ khi playbook do LLM đề xuất mà luật không thấy. Thiếu vị trí đã dừng ở bước 2
   (`MISSING_INFO`), category không rõ đã dừng ở bước 4, nên tới bước 5 thì loại việc và vị trí đều rõ.
   BPTN bác trùng (`DUPLICATE`) hoặc chọn asset (`ASSET_UNCLEAR`) không đổi `review_status`.
3. `REWORK` không tính là "blocker mở" ở điều kiện 6 của bước 10 (nó là lý do phòng ban đang làm lại); blocker
   được gỡ khi đối soát đạt. Khi BQL trả làm lại, checklist về `PENDING`.
4. `bptn_resolve` bắt buộc `note` khi BPTN khóa giá trị hoặc chọn `asset_onsite`; với `CATEGORY_UNCLEAR`,
   `OUT_OF_SCOPE` bắt buộc chọn category; với `WRONG_DEPT` bắt buộc chọn category hoặc `department`. BPTN thấy ticket thật sự ngoài phạm vi thì để nguyên, ticket
   leo thang để BQL hủy.
5. Kho nhập vật tư (`receive_stock`) không gắn với một ticket nên lần bị từ chối không ghi audit theo ticket.
6. `WAITING_MATERIAL` hiển thị "dự kiến xử lý trước {eta}" với `eta` = mốc leo thang (24h).
7. Cư dân tạo ticket qua `/resident/tickets` (chủ ticket = `X-Actor-Id`); `/mo/tickets` giữ cho demo, tạo thay
   `SIM-ACTOR-RESIDENT-01`.

## 10. Câu hỏi cần chốt trước khi merge

1. Các mốc SLA (2h, 4h, 24h, 72h, 7 ngày) và giờ ca từng phòng ban (đang để 06:00–22:00 cho cả hai; giờ hành
   chính BPTN 08:00–17:00 thứ Hai–Sáu).
2. Cửa sổ trùng 48h có hợp lý không; "cùng vị trí" đang so tới mức khu vực (`Tòa / Tầng / Khu vực`).
3. Cư dân có được xem tên phòng ban không (đang để có).
4. Ticket `EXCEPTION` cũ khi migrate: đang để BQL xử lý tay (`VERIFYING` + `PENDING_REVIEW`, owner BQL).
5. Việc bỏ nhận diện rủi ro an toàn (mục 9.1) có được Product/BQL chấp nhận không.
6. Cần Product approver/proxy BQL duyệt cả CR-BPTN-01 và CR-BPTN-02; repo chưa có approval record, CR này không
   tạo hoặc giả định người duyệt.

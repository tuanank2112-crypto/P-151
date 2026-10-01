# 00 — ARCHITECTURE: CR-BPTN-03 P0 trên engine `src/maintenance/` (phần Như Ý)

| Trường | Giá trị |
|---|---|
| Hồ sơ | `planning/01_2026-10-01_cr03-p0-engine/` — `plan.md` §2 Q01–Q14 là quyết định ĐÃ CHỐT; file này không bàn lại |
| Spec nguồn | [`docs/CR-BPTN-03.md`](../../../docs/CR-BPTN-03.md) (chỉ TRỎ theo số mục, không chép) |
| Base đo | `e5ececf6474e39d75479e35c34f609c8a409f3da` (`git rev-parse HEAD` 2026-10-01 16:3x +0700); 142/142 pass, ruff check + format sạch (OPERATIONS §1 ghi lệnh) |
| Viết | architect-fable, 2026-10-01 (giờ lấy bằng `date "+%Y-%m-%d %H:%M:%S %z"` → `2026-10-01 16:32:58 +0700`) |

## 0. Router — thứ tự đọc bắt buộc

| Bước | File | Ai đọc | Mục đích |
|---|---|---|---|
| 1 | `00-ARCHITECTURE.md` (file này) | mọi worker | mục tiêu, non-goals, bất biến, ranh giới, bảng lỗi chung, drift |
| 2 | [`01-CONTRACTS.md`](01-CONTRACTS.md) | WP2 (bắt buộc), WP3–WP5 (tra cứu) | chữ ký enum/model/bảng chuyển/catalog/lexicon/method công khai |
| 3 | [`SPEC-P01-safety-layer.md`](SPEC-P01-safety-layer.md) + [`LEXICON-P0.yaml`](LEXICON-P0.yaml) + [`REF-safety-proto.py`](REF-safety-proto.py) | WP3 | bước 2b, từ vựng, gộp rule ⊕ llm |
| 4 | [`SPEC-P02-emergency-flow.md`](SPEC-P02-emergency-flow.md) | WP4 | blocker an toàn, hành động BPTN/BQL, chặn resume/job, thời hạn, outbox |
| 5 | [`SPEC-P03-priority.md`](SPEC-P03-priority.md) | WP5 | PRI-H/M/L/D0, sửa tay, khoá sắp xếp |
| 6 | [`SPEC-P04-guards.md`](SPEC-P04-guards.md) | WP2 + WP5 | bỏ reopen, SET_ASSIGNEE, rating một lần, seed CLN-004/TEC-005 |
| 7 | [`OPERATIONS.md`](OPERATIONS.md) | mọi worker + SO | môi trường, lệnh kiểm, thứ tự WP, ranh giới file, rollback, evidence |
| 8 | [`TESTING-ACCEPTANCE.md`](TESTING-ACCEPTANCE.md) + [`SAFETY-CASES-P0.yaml`](SAFETY-CASES-P0.yaml) | WP3–WP6 | ma trận AC → test, tập câu có nhãn, Exit Gates, cách phá |

Quy ước chung cho mọi file SPEC: mục **BẮT BUỘC**, **CẤM**, **Vùng cấm**, **Phân loại lỗi** đều grep được theo đúng chữ.

## 1. Mục tiêu

Một câu: sau P0, `MaintenanceEngine` chạy đúng CR-03 §16 "P0" trong phạm vi Q01 — **tầng an toàn hai bậc (bước 2b)**, **đường khẩn cấp do BQL xử lý**, **priority ba mức + sắp xếp**, **các chốt chặn** (không reopen, không gán người, rating một lần) — toàn bộ test cũ vẫn xanh (trừ các test mô tả hành vi bị CR-03 bỏ, được viết lại theo SPEC-P04), mỗi AC P0 có test.

Sản phẩm P0 (đúng và đủ, không hơn):

| # | Mảng | File đích | SPEC |
|---|---|---|---|
| 1 | Từ vựng mới (enum, trường Ticket, `TRANSITIONS`, `BLOCKER_OWNERS`, `PERMISSIONS`, `sla_config`) | `src/maintenance/{enums,models,engine,catalog}.py`, `seed/maintenance_v1/catalog.yaml`, `src/maintenance/i18n/vi.yaml` | 01 |
| 2 | Bộ nhận diện an toàn thuần + từ vựng dữ liệu + bước 2b + guard LLM | `src/maintenance/safety.py` (mới), `seed/maintenance_v1/lexicon.yaml` (mới), `engine.py` | P01 |
| 3 | Blocker `SAFETY_REVIEW_REQUIRED` / `EMERGENCY_PENDING_BQL`; T03/T05/T06/T07/T10; E01; E03 thời hạn 4 h / 12 h; chặn `resume()`/job; outbox `emergency.created`; nhãn cư dân | `engine.py`, `views.py`, `i18n/vi.yaml` | P02 |
| 4 | Priority PRI-H1/H2/M1/M2/L1/D0, sửa tay có lý do + audit, khoá sắp xếp | `src/maintenance/priority.py` (mới), `engine.py`, `views.py` | P03 |
| 5 | Bỏ reopen, `SET_ASSIGNEE` → `ACTION_DENIED`, rating một lần, seed CLN-004/TEC-005 → Bậc 1 | `engine.py`, `models.py`, `views.py`, `seed/maintenance_v1/tickets.yaml`, tests | P04 |

## 2. Non-goals (Q01 + CR-03 §16 P1) — CẤM làm trong hồ sơ này

- Router/endpoint mới, `src/web/`, `src/api/`, persistence (Render/Supabase), deploy, LangGraph (`src/agents/`), prompt an toàn cho LLM thật (Q09: P1, hook để sẵn).
- Tín hiệu P1: S-06, S-07, S-08, S-10, S-11, S-12, S-13, C-01, bẫy B-05 (Q06). Chúng CÓ MẶT trong `lexicon.yaml` với `phase: P1` nhưng **không kích hoạt** (`active_phases: [P0]`).
- PRI-U1 (`duplicate_count`), PRI-U2 (`vulnerable_person`), Bậc 3 `risk_amplifiers` (CR-03 §6.7).
- Gộp/hoàn tác gộp/nối bổ sung/hủy ticket gốc (CR-03 §8, AC-11), BQL gộp ticket khẩn cấp (T08 actor BQL), tạo ticket tiếp theo (`follow_up_of`), danh sách xác nhận an toàn cho BQL (§13), bộ ≥ 40 câu đánh giá chính thức (§15 — P0 giao tập 42 câu ở `SAFETY-CASES-P0.yaml` làm **test**, không phải "Evaluation Evidence" P1).
- T16/T17/E02 (`WRONG_DEPT_AFTER_START`), T18/T19 (`WAITING_MATERIAL` từ `IN_PROGRESS`), đếm `wrong_department_return_count` (AC-12/AC-13 không thuộc danh sách AC P0 của hồ sơ) — xem §9 Câu hỏi mở Q-A.
- Trạng thái mới `EMERGENCY` (CR-03 §3.1: KHÔNG thêm), thư mục top-level mới, bump `SCHEMA_VERSION`.

## 3. BẮT BUỘC — Bất biến kiến trúc (mỗi dòng phải có ít nhất một test trỏ tới trong TESTING §2; vi phạm bất kỳ dòng nào ⇒ 🔁)

| ID | Bất biến | Nguồn |
|---|---|---|
| I-01 | Mọi đổi `status` đi qua `MaintenanceEngine._apply_transition` và bảng `TRANSITIONS`; cặp ngoài bảng ⇒ `InvalidTransitionError` (HTTP 409 `INVALID_TRANSITION`); vai sai ⇒ `ActionDeniedError` (403) **có audit**, trạng thái không đổi | CR-03 §4.4.8, `engine.py:1236` |
| I-02 | Mọi ghi qua `_mutate` (deep copy → `op` → audit sink → commit; audit hỏng ⇒ không commit). Mọi **entry point ghi mới** giữ `engine.lock` (RLock) — gọi `_mutate`/`transition` là đủ vì chúng tự giữ lock | gotcha concurrency, `engine.py:983-1036` |
| I-03 | `engine.at()` thread-local; không gán lại `engine.clock`; `clock()` là method | `engine.py:275-291` |
| I-04 | Hàm bước pipeline tên `_step_<số>_<việc>`; bước 2b = `_step_2b_assess_safety` đứng **trước** `_step_2_check_required_data` trong tuple của `_run_pipeline` (Q08: Bậc 1 > Bậc 2 > `MISSING_INFO`), cả hai mang số 2 | Q08, SPEC-P01 §4 |
| I-05 | Nội dung gốc + ảnh gốc bất biến (`raw_integrity_marker`); bổ sung append-only (`additions`) | CR-03 §4.4.7 |
| I-06 | Một ticket một blocker; `BLOCKER_CODES_BY_STATUS` là nguồn chân lý blocker ↔ status | CR-03 §3.2 |
| I-07 | Chỉ BQL `CLOSED`/`CANCELLED`; `CLOSED` từ `VERIFYING` chỉ khi blocker `EMERGENCY_PENDING_BQL` và `closure_kind=EMERGENCY_HANDLED` (ngoại lệ duy nhất không cần `department_id`) | CR-03 §4.4.1, §4.4.6 |
| I-08 | **Không ai** ghi `assignee_id` (kiểu `None`); `SET_ASSIGNEE` ⇒ `ACTION_DENIED` có audit | CR-03 §4.4.2, Q03 |
| I-09 | `can_route` thêm `risk_level != EMERGENCY`; không vai nào gọi `transition(..., ROUTED)` từ ngoài | CR-03 §4.4.3, §5.3 |
| I-10 | Blocker `EMERGENCY_PENDING_BQL` và `SAFETY_REVIEW_REQUIRED` **không bao giờ** được `_resume()`/job gỡ; chỉ người gỡ qua method ở 01 §7 | CR-03 §4.4.4, AC-07 |
| I-11 | BPTN không tác động được lên ticket có blocker thuộc `BQL_REASONS` (`ACTION_DENIED` + audit) | CR-03 §4.4.5, AC-06 |
| I-12 | Luật cố định chạy trước và quyết định; LLM **chỉ nâng mức** (`ABSENT→UNCLEAR/PRESENT`, `UNCLEAR→PRESENT`), không hạ, không xoá; LLM `PRESENT` phải có trích dẫn khớp văn bản | CR-03 §6.1.1, Q09 |
| I-13 | Mọi ngưỡng thời gian/số đếm nằm trong `catalog.yaml` `sla_config`; mọi từ vựng nhận diện nằm trong `lexicon.yaml` (Q07) — **không hardcode** trong `.py` | CR-03 §0.3, Q07 |
| I-14 | Lời cho cư dân chỉ sinh từ `i18n/vi.yaml` (`messages.public_message`); view cư dân là allow-list, không lộ `risk_*`, `reason_code`, `internal_note`, `priority` | CR-03 §13, AC-17 |
| I-15 | Nội dung ticket là DỮ LIỆU không đáng tin: không có đường nào để câu lệnh trong text đổi hành vi (nhận diện chỉ so khớp mẫu) | CR-03 §0.6, AC-18 |

## 4. Ranh giới

### 4.1 Engine ↔ router/UI (Q02, Q03, Q14)
- Hồ sơ này CHỈ thêm **method công khai** của `MaintenanceEngine` (01 §7) và **hàm khoá sắp xếp** trong `views.py` (01 §8). Không sửa `src/api/`, `src/web/`.
- Router hiện có vẫn import `engine.reopen` (`src/api/routers/maintenance.py:609`) và `engine.set_assignee` không được gọi từ router (không có endpoint — `test_no_endpoint_assigns_a_person`). Vì vậy `reopen()` **giữ chữ ký**, thân hàm đổi thành luôn `raise InvalidTransitionError` (SPEC-P04 §2); `set_assignee()` giữ chữ ký, mọi vai bị từ chối.
- Gợi ý nối (ngoài phạm vi, để Châm Anh/Trí): `POST /mo/tickets/{id}/safety/confirm-safe` → `safety_confirm_safe`; `/safety/escalate` → `safety_escalate`; `/safety/request-info` → `safety_request_info`; `POST /bql/tickets/{id}/emergency/close` → `emergency_close`; `/emergency/downgrade` → `emergency_downgrade`; `POST /mo/tickets/{id}/priority` → `set_priority`. Mapping lỗi dùng nguyên `_call` (`maintenance.py:78-94`).

### 4.2 Engine ↔ persistence
- Mọi trường mới là kiểu JSON-hoá được (StrEnum, str, bool, datetime aware, list model) — `Case.model_dump(mode="json")` vẫn chạy; không bump `SCHEMA_VERSION` (vùng cấm §6). `migration.py` không đọc trường mới.

### 4.3 Engine ↔ LLM
- `proposer.propose` (phân loại) **không đổi**. Tầng an toàn có hook riêng `MaintenanceEngine(safety_llm=None)`; `build_engine()` để `None` trong P0 (Q09). `LLM_MODE=mock` là mặc định và là chế độ của mọi test.

## 5. Luồng tổng sau P0 (chi tiết ở P01/P02)

```text
ingest (T01) → _run_pipeline(2):
  2b _step_2b_assess_safety   # chạy khi có nội dung; tự bỏ qua khi đã safety_cleared và không có bổ sung mới
       EMERGENCY → liên kết related_ticket_ids (vị trí + cửa sổ) → VERIFYING/EMERGENCY_PENDING_BQL (T04) + outbox emergency.created → DỪNG
       UNCLEAR   → VERIFYING/SAFETY_REVIEW_REQUIRED (T04), escalate_at = now + 4h lịch → DỪNG
       NONE      → tiếp
  2  _step_2_check_required_data  (giữ nguyên: ticket_id, created_at, nội dung, vị trí sơ bộ) → NEED_INFO/MISSING_INFO
  3  phân loại + phòng ban + [MỚI] priority (PRI-*)
  4 → 5 → 6 → 7 → 8  (giữ nguyên)
Gỡ blocker an toàn (người): T05/T03 → RECEIVED → _run_pipeline(2) (2b tự bỏ qua vì safety_cleared) → 2 → 3 …
```

Bảng chạy lại (CR-03 §5.2) sau thiết kế: xem SPEC-P02 §7 (có ghi drift D2).

## 6. Vùng cấm (đã cân nhắc, KHÔNG làm — agent sau không "sửa cho tốt hơn")

| # | Không làm | Lý do |
|---|---|---|
| V-01 | Không thêm trạng thái `EMERGENCY`; khẩn cấp là `VERIFYING` + blocker chủ BQL | CR-03 §3.1 chốt 10 trạng thái; UI/timeline cư dân đã bám 10 nhãn |
| V-02 | Không bump `SCHEMA_VERSION` (`"1.2"`) dù thêm trường | chưa có persistence; `AuditEvent.schema_version` là `Literal` — bump khi hồ sơ persistence của Châm Anh làm migration thật |
| V-03 | Không xoá method `reopen()`/`set_assignee()` khỏi engine | router còn import `reopen`; Q03 giao chủ việc router gỡ sau — xoá sớm làm import lỗi ngoài phạm vi |
| V-04 | Không đưa `SAFETY_REVIEW_REQUIRED` vào `BPTN_REASONS` (drift D1) | `BPTN_REASONS` trong code = "gỡ bằng `bptn_resolve`, SLA giờ hành chính"; Bậc 2 gỡ bằng 3 lựa chọn riêng và hạn **giờ lịch** — gộp sẽ mở đường `bptn_resolve` gỡ Bậc 2 không cần lý do |
| V-05 | Không khôi phục `src/services/safety.py` hay `rules.py@4c2d07f` làm module | chỉ lấy ý tưởng (hedge, PRESENT>UNCLEAR, trích dẫn); từ vựng cũ hardcode trong `.py` trái Q07 |
| V-06 | Không chạy 2b trên ảnh | CR-03 §1 "không phân tích ảnh bằng AI"; bổ sung ảnh không đổi kết quả 2b |
| V-07 | Không tạo thông báo riêng/nhãn riêng kiểu "khẩn cấp" cho cư dân | CR-03 §11, §13: cư dân chỉ thấy thông điệp chung "Đang được kiểm tra" |
| V-08 | Không chặn BQL theo cờ `escalated` khi làm 3 lựa chọn Bậc 2 (drift D9) | CR-03 §2 không cấm; bớt một nhánh từ chối; đổi được bằng 1 guard nếu nhóm muốn |
| V-09 | Không thêm `risk_amplifiers`, `duplicate_count`, `merged_children`, `duplicate_rejected_of`, `follow_up_of`, `wrong_department_return_count` vào `Ticket` ở P0 | trường rỗng không ai ghi gây hiểu nhầm là đã có tính năng; thêm đúng lúc ở hồ sơ P1 |
| V-10 | Không sửa `proposer.py`/`rules.py` | không thuộc P0; phân loại giữ nguyên hành vi 142 test |
| V-11 | Không đổi `BqlTicketRow.assignee_id` (giữ cột, luôn `None`) | `app.js:897` còn đọc; CR-03 §12.1 "giữ cột" |

## 7. Phân loại lỗi (dùng chung cho mọi SPEC) + hành vi bắt buộc của caller

| Lớp Python (`engine.py`) | `code` | HTTP (`_call`) | Khi nào | Ghi gì | Caller phải |
|---|---|---|---|---|---|
| `NotFoundError` | `NOT_FOUND` | 404 | ticket/vật tư không có | không | không retry; kiểm id |
| `ActionDeniedError` | `ACTION_DENIED` | 403 | vai không có quyền, ngoài phạm vi, BPTN chạm blocker BQL | **audit `ACTION_DENIED`** (một `AuditEvent`, `action_result=ACTION_DENIED`), status không đổi | hiển thị "không có quyền"; không retry; không đổi vai để lách |
| `InvalidTransitionError` | `INVALID_TRANSITION` | 409 | cặp (từ, đến) ngoài `TRANSITIONS`; blocker không khớp (vd đóng từ `VERIFYING` khi không khẩn cấp); `reopen()` | không | tải lại ticket, cập nhật UI theo trạng thái thật |
| `GuardError` | `GUARD_FAILED` | 409 | tiền điều kiện nghiệp vụ: thiếu `note`, đã rating, `bptn_resolve` trên blocker an toàn, sai method cho bậc | không | sửa đầu vào (vd thêm lý do) rồi gửi lại |
| `pydantic.ValidationError` | — | 422 | body sai schema; gán `assignee_id` ≠ `None`; `Ticket` vi phạm validator | không | sửa body |
| `AuditWriteError` | `AUDIT_WRITE_FAILED` | 500 | sink audit hỏng | **không commit gì** | retry sau; trạng thái chưa đổi |
| `EngineError` khác | `ENGINE_ERROR` | 500 | integrity marker lệch, pipeline kết thúc bất thường, lexicon hỏng lúc nạp | log | báo người; không retry mù |

Quy tắc chọn lớp cho code mới: *quyền/vai* ⇒ `ActionDeniedError` qua `self._deny(...)` (để có audit); *cặp trạng thái/blocker không khớp* ⇒ `InvalidTransitionError`; *thiếu dữ liệu đầu vào* ⇒ `GuardError`. Không bao giờ dùng `assert` hay `ValueError` trần trong engine.

## 8. Drift code ↔ CR-03 phát hiện khi đối chiếu (ghi, không âm thầm chọn)

| ID | CR-03 nói | Code/thiết kế | Xử lý trong hồ sơ |
|---|---|---|---|
| D1 | §14: "cập nhật `BPTN_REASONS` (+`SAFETY_REVIEW_REQUIRED`)" | `BPTN_REASONS` còn dùng cho guard `bptn_resolve`, SLA giờ hành chính, `_cleared` (`engine.py:534,1312,1347,1452`) | giữ `BPTN_REASONS`; thêm `SAFETY_REASONS`, `BQL_REASONS` (01 §1); chủ blocker vẫn BPTN qua `BLOCKER_OWNERS` |
| D2 | §5.2: gỡ Bậc 2/Bậc 1 ⇒ "chạy lại từ bước 3, bỏ qua 2b" | bước 2 của CR-03 gồm cả **vị trí sơ bộ**; Q08 cho 2b chạy trước vị trí ⇒ ticket cleared có thể chưa có vị trí; `WorkOrderDraft.location: str` bắt buộc | chạy lại từ **2** (2b tự bỏ qua khi đã `safety_cleared_at` và không có bổ sung mới) — tương đương "3, bỏ qua 2b" + bảo đảm vị trí (P02 §7) |
| D3 | B-04: "khét" ngoài ngữ cảnh điện/đèn ⇒ Bậc 2 | đọc theo nghĩa đen thì "có mùi khét ở hành lang" (không nhắc đèn) thành Bậc 2 — trái mục tiêu 0 bỏ sót Bậc 1 và S-01 "chung" | mặc định Bậc 1; chỉ hạ Bậc 2 khi cùng câu có ngữ cảnh nấu ăn (`khet_benign_contexts`) — P01 §3.6 |
| D4 | T2-02: "sự việc đã xảy ra" | "hôm qua có tia lửa" không nói đã hết ⇒ không an toàn để hạ | chỉ hạ khi cùng câu có `resolved_markers` ("giờ hết rồi"…) — P01 §3.5 |
| D5 | B-03: "giật" lên Bậc 1 khi "bị điện giật" | S-06 là P1 theo Q06 | P0: "bị điện giật" ⇒ T2-03 (Bậc 2); bật S-06 = đổi `phase` trong lexicon (Q-C) |
| D6 | §13: nhãn trạng thái chung "Đang được kiểm tra" | `status_label` lấy theo status (`messages.status_label`) | ghi đè `status_label` trong `resident_view` khi blocker ∈ `SAFETY_REASONS`; `public_message` theo `reason_messages` mới (P02 §9) |
| D7 | §16 P0 có "T16/T17 và E02" | `plan.md` §3 không có WP; orchestrator không giao SPEC | enum/owner/status-map có sẵn (01 §1–§2); hàng chuyển dự phòng ở 01 §12 **không tính** vào `len(TRANSITIONS)`; Q-A |
| D8 | §4.3: "xóa `engine.reopen()`" | router import `engine.reopen` | stub raise `INVALID_TRANSITION` (Q03) |
| D9 | §6.4: BQL làm 3 lựa chọn "khi leo thang" | — | không chặn theo `escalated` (V-08) |
| D10 | §12.1 liệt kê trường cho cả P1 | — | P0 thêm đúng tập ở 01 §2; còn lại V-09 |
| D11 | §5.2: "sau mọi bổ sung (text hoặc ảnh) luôn chạy lại 2b" | `add_resident_photo` không gọi `_resume`; 2b không đọc ảnh | chỉ text (V-06) |
| D12 | §6.2 S-14 "Vệ sinh", S-03 "Kỹ thuật" (cột Áp dụng) | 2b chạy **trước** phân loại (D-09) nên chưa có category | P0 áp mọi tín hiệu active cho mọi ticket; cột `scope` trong lexicon chỉ để tra cứu |
| D13 | §16 P0 "cập nhật kết quả CLN-004, TEC-005" ở WP5 (`plan.md`) | WP3 chèn 2b làm `test_all_twelve_tickets_match_expected_outcome` đỏ ngay | đổi expected hai fixture ngay trong **WP3** (OPERATIONS §3); WP5 chỉ thêm `priority` expected |

## 9. Câu hỏi mở (không đổi Q01–Q14; mỗi câu ghi "cái gì đổi tuỳ câu trả lời")

| ID | Câu hỏi | Nếu "có" | Nếu "không" (mặc định hồ sơ) |
|---|---|---|---|
| Q-A | T16/T17/E02 (`WRONG_DEPT_AFTER_START`) có vào P0 không? CR-03 §16 nói có, `plan.md` không có WP | thêm WP4b theo 01 §12 (2 hàng `TRANSITIONS` ⇒ `len == 20 + 7`, 2 nhánh `_human_transition`, 1 method `report_wrong_dept`, 1 method `bql_reassign_to_bptn`, ~5 test) | giữ `len(TRANSITIONS) == 18 + 7`; enum/owner có sẵn, không dùng |
| Q-B | CR-03 §5.2 có sửa chữ "bước 3, bỏ qua 2b" thành "bước 2, 2b tự bỏ qua" (D2) không? | sửa tài liệu, code không đổi | ghi drift trong `docs/` khi đồng bộ 6 điểm |
| Q-C | Bật S-06 (điện giật) trong P0? (D5; chỉ đổi `phase: P1 → P0` trong lexicon) | SC-37 đổi nhãn `UNCLEAR → EMERGENCY`; 1 ca test đổi | giữ |
| Q-D | B-04 đọc theo "an toàn trước" (D3) có được Trường/Product chấp nhận? | giữ lexicon | thêm `khet_requires_electric_context: true` + danh sách ngữ cảnh điện — 1 nhánh trong `assess`, SC-31 đổi nhãn |
| Q-E | BQL có bị giới hạn "chỉ khi đã leo thang" cho 3 lựa chọn Bậc 2 (D9)? | thêm guard `blocker.escalated` ⇒ `ACTION_DENIED` cho BQL; +1 test | giữ |
| Q-F | Nhãn `field_labels.safety_details` (lời hỏi cư dân khi BPTN cần thêm thông tin, P02 §9) — Trường duyệt câu chữ? | sửa chuỗi trong `vi.yaml`, không chạm code | giữ chuỗi mặc định |

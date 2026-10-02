# MaintenanceOps Agent — UI Flow & Low-fidelity Wireframe

> **Document status:** DRAFT · Policy v0.3 recorded, awaiting approver identity/sign-off
> **Version:** 0.3
> **Ngày:** 2026-09-27  
> **Owner:** TV1 — Product / BA / Process; UX reviewer: TV3 — UX / UI / Prototype  
> **Boundary:** Prototype với dữ liệu mô phỏng; không có CTA tạo work order thật, gửi tin cư dân qua kênh thật hoặc phê duyệt vật tư. Từ `CR-BPTN-02` (v0.5 candidate): chỉ BQL có CTA nghiệm thu/trả làm lại/hủy

## Changelog

| Version | Ngày | Thay đổi | Trạng thái |
|---|---|---|---|
| 0.1 | 2026-09-27 | Tạo IA, 10 UI flows và wireframe cho `UI-01`–`UI-08` | DRAFT |
| 0.2 | 2026-09-27 | Áp dụng Agent proposal → BPTN confirmation, evidence/state oracle và permission rejection | DRAFT · Chờ sign-off |
| 0.3 | 2026-09-27 | Khóa 4 demo flow cho vệ sinh/kỹ thuật; thêm asset/duty/stock/route status và loại bỏ UI ngoài active scope | DRAFT · Chờ sign-off |
| 0.4-candidate | 2026-09-29 | `CR-BPTN-01`: bỏ bước BPTN xác nhận khỏi happy path, thêm review/override có điều kiện; UI copy "Đề xuất team" (§1.2); backlog frontend (§5) | PROPOSED · Chờ duyệt CR |
| 0.5-candidate | 2026-09-29 | `CR-BPTN-02`: 4 demo flow mới (giao phòng ban, ngoài giờ, chờ BPTN xác minh tài sản); màn hình theo dõi cho cư dân (`UI-09`) và dashboard BQL (`UI-10`); `UI-07` thành hàng chờ BPTN xác minh; CTA phòng ban nhận việc/báo hoàn thành; BQL nghiệm thu/trả làm lại/hủy | PROPOSED · Chờ duyệt CR |

> **`CR-BPTN-02` (v0.5 candidate), PROPOSED:** mục 1, 2, `UI-01`, `UI-02`, `UI-06`, `UI-07`, `UI-09`, `UI-10`, 4 và 5 đã viết lại theo
> [CR-BPTN-02](CR-BPTN-02.md). Giao diện chi tiết nằm ngoài phạm vi CR; wireframe dưới đây là low-fidelity.

---

# Phase 4 — UI Flow và Wireframe

# 1. Information architecture

| UI ID | Screen | Mục tiêu chính | Primary actor |
|---|---|---|---|
| `UI-01` | Work Queue | Chọn case theo trạng thái/phòng ban/blocker | BPTN, phòng ban, BQL |
| `UI-02` | Ticket Detail | Tách raw source, phần cư dân bổ sung, Agent proposal, lựa chọn của BPTN (`locked_fields`) | BPTN, BQL |
| `UI-03` | Work Order Draft | Xem draft đã giao phòng ban | Phòng ban, BQL |
| `UI-04` | Execution Update | Nhận việc, tạm hoãn/tiếp tục, trả sai phòng ban | Phòng ban |
| `UI-05` | Checklist, Material & Evidence | Cập nhật và báo hoàn thành | Phòng ban, BQL |
| `UI-06` | `READY_FOR_REVIEW` Package | Xem kết quả đối soát; BQL nghiệm thu hoặc trả làm lại | BQL |
| `UI-07` | Hàng chờ BPTN xác minh (`CR-BPTN-02` (v0.5 candidate), thay Exception Review) | Gỡ blocker `VERIFYING` | BPTN |
| `UI-08` | Audit History | Timeline `ticket_status_events` + audit | BPTN, BQL, QA nội bộ |
| `UI-09` | Theo dõi phản ánh (`CR-BPTN-02` (v0.5 candidate)) | Cư dân xem trạng thái công khai, bổ sung, đánh giá, báo chưa xong | Cư dân |
| `UI-10` | Dashboard BQL (`CR-BPTN-02` (v0.5 candidate)) | Lọc theo trạng thái, phòng ban, mã blocker, leo thang, quá SLA; hủy ticket | BQL |

`UI-04` và `UI-05` có thể là hai tab trong một Work Order Detail.

## 1.1 Global UI rules

- Mọi screen nội bộ có banner cố định: **“DỮ LIỆU MÔ PHỎNG — Không phải hồ sơ/quy trình vận hành thật.”**
- Trạng thái hiển thị bằng text + icon/pattern, không chỉ bằng màu. Cư dân thấy nhãn tiếng Việt (`Đã tiếp nhận`,
  `Đang xác minh`, `Đã chuyển phòng ban`, `Đang xử lý`, `Chờ nghiệm thu`, `Hoàn thành`, `Chờ bổ sung thông tin`, `Tạm hoãn`,
  `Đã gộp`, `Đã hủy`); màn hình nội bộ thấy mã + nhãn.
- Raw resident content/evidence luôn read-only, nhãn **“Nguồn gốc — bất biến”**; phần cư dân bổ sung hiện riêng, theo thứ tự thời gian.
- CTA theo role; forbidden action không render hoặc disabled kèm lý do. Nếu vẫn gọi, UI hiển thị `ACTION_DENIED` (có audit).
- Mọi Agent result có playbook/rule/reason/source/version.
- Blocker hiển thị: mã lý do, người gỡ, từ lúc nào, bước chạy lại, mốc nhắc/leo thang, cờ leo thang (nội bộ);
  `public_message` và `eta` (cư dân).
- Phòng ban: trước bước 8 chỉ hiện **“Phòng ban đề xuất”** (`proposed_department_id`, nội bộ); sau khi giao hiện
  **“Phòng ban phụ trách”** (`department_id`). Cư dân chỉ thấy tên phòng ban sau khi giao.
- Không có assignee selector trong UI của Agent/BPTN; phòng ban tự phân công trong hệ thống của phòng ban.
- Chỉ BQL có CTA “Nghiệm thu”, “Trả làm lại”, “Hủy”. Không có CTA phê duyệt vật tư, gửi tin qua kênh thật, tạo work order thật.

## 1.2 UI copy cho giao phòng ban (`CR-BPTN-02` (v0.5 candidate), thay copy "Đề xuất team")

| Vị trí | Copy bắt buộc |
|---|---|
| Trước bước 8 (nội bộ) | **Phòng ban đề xuất:** {tên} — *chưa giao; cần review/tài sản trước* |
| `can_route` sai (nội bộ) | **Chưa đủ điều kiện giao** + danh sách điều kiện thiếu (`review_status`, `asset_resolution`, phòng ban) |
| `ROUTED` | **Đã chuyển {tên phòng ban}** |
| `ROUTED` + `OUT_OF_HOURS` | **Phản ánh sẽ được xử lý từ {giờ}** |
| `IN_PROGRESS` | **{tên phòng ban} đang xử lý** |
| `READY_FOR_REVIEW` | **Chờ nghiệm thu** — *Ban quản lý sẽ kiểm tra trước khi đóng* |

Lời hiển thị cho cư dân chỉ lấy từ `src/maintenance/i18n/vi.yaml`.

---

# 2. UI flows

`CR-BPTN-02` (v0.5 candidate). Dataset demo dùng 12 ticket mô phỏng: 6 vệ sinh, 6 kỹ thuật. Bốn flow 2.1–2.4 là demo chính.

## 2.1 Flow 1 — Happy path vệ sinh

| Bước | Actor | Action | Trạng thái trước → sau | Cư dân thấy |
|---|---|---|---|---|
| 1 | Cư dân | Gửi phản ánh qua `UI-09` | — → `RECEIVED` | Đã tiếp nhận |
| 2 | Agent | Kiểm tra dữ liệu; match `PB-CLN-01`; đề xuất `DEPT_CLEANING`; kiểm tra trùng; review `NOT_REQUIRED`; tài sản `NOT_APPLICABLE`; vật tư đủ | giữ `RECEIVED` | — |
| 3 | System | `can_route` đúng → giao `DEPT_CLEANING`, tạo draft | `RECEIVED` → `ROUTED` | Đã chuyển Phòng Vệ sinh |
| 4 | Phòng ban | Nhận việc (`UI-04`) | `ROUTED` → `IN_PROGRESS` | Phòng Vệ sinh đang xử lý |
| 5 | Phòng ban | Checklist, vật tư, ghi chú; báo hoàn thành (`UI-05`) | giữ `IN_PROGRESS` | — |
| 6 | Agent | Đối soát bước 10 đạt | `IN_PROGRESS` → `READY_FOR_REVIEW` | Chờ nghiệm thu |
| 7 | BQL | Nghiệm thu (`UI-06`) | `READY_FOR_REVIEW` → `CLOSED` | Hoàn thành; có thể đánh giá/báo chưa xong trong 7 ngày |

Timeline cư dân có đúng 5 mốc.

## 2.2 Flow 2 — Vệ sinh ngoài giờ phòng ban

| Bước | Actor | Action | Trạng thái | Cư dân thấy |
|---|---|---|---|---|
| 1 | Agent/System | Như flow 1 bước 2–3, lúc 23:30 | `ROUTED` + blocker `OUT_OF_HOURS` | Phản ánh sẽ được xử lý từ 06:00 |
| 2 | Job 5 phút | Đầu ca 06:00: gỡ blocker, thông báo phòng ban | giữ `ROUTED` | Đã chuyển Phòng Vệ sinh |
| 3 | Job | Sau 2h chưa ai nhận → `NOT_ACCEPTED`, nhắc trưởng phòng mỗi 2h, leo thang sau 3 lần | giữ `ROUTED` | Đang chờ phòng ban tiếp nhận |

## 2.3 Flow 3 — Happy path kỹ thuật

| Bước | Actor | Action | Trạng thái |
|---|---|---|---|
| 1 | Agent | Match `PB-TEC-01`; đề xuất `DEPT_TECHNICAL`; review `NOT_REQUIRED` | `RECEIVED` |
| 2 | Agent | Tra tài sản: đúng một `SIM-ASSET-*` → `FOUND` | `RECEIVED` |
| 3 | Agent/System | Vật tư đủ; `can_route` → giao `DEPT_TECHNICAL` | `ROUTED` |
| 4–7 | Phòng ban / Agent / BQL | Như flow 1 bước 4–7 | `IN_PROGRESS` → `READY_FOR_REVIEW` → `CLOSED` |

## 2.4 Flow 4 — Kỹ thuật chưa xác định được tài sản

| Bước | Actor | Action | Trạng thái | Ghi chú |
|---|---|---|---|---|
| 1 | Agent | Tra tài sản: không có hoặc nhiều asset | `RECEIVED` → `VERIFYING` (`ASSET_UNCLEAR`) | Chưa giao; cư dân không thấy tên phòng ban |
| 2 | Job | Nhắc BPTN mỗi 1h giờ hành chính; 4h → leo thang | giữ `VERIFYING` | Không tự giao |
| 3a | BPTN (`UI-07`) | Chọn asset | `VERIFYING` → `RECEIVED` → `ROUTED` | `asset_resolution=FOUND` |
| 3b | BPTN (`UI-07`) | Chọn "Xác định tại hiện trường" + lý do | `VERIFYING` → `RECEIVED` → `ROUTED` | `ONSITE_BY_BPTN`, cờ `ASSET_CHECK_ONSITE` cho phòng ban |

## 2.5 Edge flow A — Thiếu thông tin → `NEED_INFO`

| Bước | Actor | Action | Trạng thái | Cư dân thấy |
|---|---|---|---|---|
| 1 | Agent | Thiếu nội dung hoặc vị trí | `RECEIVED` → `NEED_INFO` | Vui lòng bổ sung: {fields} |
| 2 | Job | Nhắc mỗi 24h; 72h → cờ để BQL quyết định hủy | giữ `NEED_INFO` | — |
| 3 | Cư dân (`UI-09`) | Bổ sung (append-only) | `NEED_INFO` → `RECEIVED` → … | Pipeline chạy lại từ bước 2 |

## 2.6 Edge flow B — Thiếu vật tư

| Bước | Actor | Action | Trạng thái |
|---|---|---|---|
| 1 | Agent | Tồn kho không đủ | `RECEIVED` → `ON_HOLD` (`WAITING_MATERIAL`) |
| 2 | Kho | Nhập vật tư | `ON_HOLD` → `RECEIVED` → `ROUTED` |
| 2' | Job | 24h không nhập | giữ `ON_HOLD`, `escalated=true`, thông báo BQL |

## 2.7 Edge flow C — Phòng ban trả về sai phòng ban

| Bước | Actor | Action | Trạng thái |
|---|---|---|---|
| 1 | Phòng ban (`UI-04`) | "Không thuộc phòng ban" + lý do | `ROUTED` → `VERIFYING` (`WRONG_DEPT`); `department_id=null` |
| 2a | BPTN (`UI-07`) | Đổi loại việc (vd. vệ sinh → đèn) | Chạy lại từ bước 6 (tra tài sản) → `ROUTED` tới phòng ban mới, hoặc dừng ở `ASSET_UNCLEAR` |
| 2b | BPTN (`UI-07`) | Giữ loại việc, chỉ đổi phòng ban | Chạy lại từ bước 7 → `ROUTED` |

## 2.8 Edge flow D — Đối soát không đạt, trả làm lại, mở lại

| Bước | Actor | Action | Trạng thái |
|---|---|---|---|
| 1 | Phòng ban | Báo hoàn thành khi thiếu ghi chú/checklist/vật tư | giữ `IN_PROGRESS`; `UI-05` hiện danh sách mục thiếu; không blocker |
| 2 | BQL (`UI-06`) | Trả làm lại + lý do | `READY_FOR_REVIEW` → `IN_PROGRESS` (`REWORK`); lần 3 → leo thang |
| 3 | Cư dân (`UI-09`) | Báo chưa xong trong 7 ngày | `CLOSED` → `READY_FOR_REVIEW` |

---

# 3. Low-fidelity wireframes

## UI-01 — Work Queue

```text
+----------------------------------------------------------------------------+
| DỮ LIỆU MÔ PHỎNG                                      [Role: BPTN/BQL/...] |
| Work Queue                                                                 |
| [Trạng thái] [Phòng ban] [Mã blocker] [Leo thang]                          |
|----------------------------------------------------------------------------|
| SIM-TKT-0001 | Vệ sinh | ROUTED       | DEPT_CLEANING  | —                 |
| SIM-TKT-0002 | Đèn     | VERIFYING    | (đề xuất TEC)  | ASSET_UNCLEAR ⚑   |
| SIM-TKT-0003 | Vệ sinh | NEED_INFO    | —              | MISSING_INFO      |
|----------------------------------------------------------------------------|
| Chọn case → Ticket Detail                                                  |
+----------------------------------------------------------------------------+
```

- **Hiển thị (`CR-BPTN-02` (v0.5 candidate)):** SIM ID, loại việc, trạng thái (mã + nhãn), phòng ban (đã giao) hoặc phòng ban đề xuất (ghi rõ
  “đề xuất”), mã blocker, cờ leo thang, last updated.
- **Được sửa:** không sửa entity trực tiếp trên queue.
- **Primary CTA:** “Mở hồ sơ”. Phòng ban chỉ thấy ticket đã giao cho mình.
- **Audit:** sự kiện trạng thái gần nhất.

## UI-02 — Ticket Detail

```text
+----------------------------------------------------------------------------+
| DỮ LIỆU MÔ PHỎNG | SIM-TKT-0002 | VERIFYING · ASSET_UNCLEAR (BPTN) ⚑      |
|----------------------------------------------------------------------------|
| NỘI DUNG PHẢN ÁNH GỐC — READ ONLY / BẤT BIẾN                               |
| CƯ DÂN BỔ SUNG (append-only, theo thời gian)                                |
|----------------------------------------------------------------------------|
| AGENT PROPOSAL                        | LỰA CHỌN CỦA BPTN (locked_fields)  |
| Loại việc + playbook + rule/reason    | category / location / asset / dept |
| Phòng ban đề xuất: Phòng Kỹ thuật     | review_status: NOT_REQUIRED        |
| Tra tài sản: NOT_FOUND                | asset_resolution: —                |
|----------------------------------------------------------------------------|
| ĐIỀU KIỆN GIAO (can_route): review ✓ | tài sản ✗ | phòng ban đề xuất ✓    |
| BLOCKER: người gỡ BPTN | từ 09:00 | nhắc lần 1/3 | leo thang lúc 13:00     |
|----------------------------------------------------------------------------|
| TIMELINE (ticket_status_events)                                            |
+----------------------------------------------------------------------------+
```

- **Mục tiêu (`CR-BPTN-02` (v0.5 candidate)):** tách raw / phần bổ sung / đề xuất của Agent / lựa chọn của BPTN; cho thấy vì sao chưa giao.
- **Field bất biến:** nội dung gốc, bằng chứng gốc, ID/thời điểm gốc.
- **Primary CTA:** BPTN “Xử lý xác minh” → `UI-07` (khi `VERIFYING`); BQL “Hủy” (kèm lý do) từ `UI-10`.
- **Disabled:** raw editor, ghi đè evidence, tự điền dữ liệu thiếu, nút giao phòng ban thủ công.

## UI-03 — Work Order Draft

```text
+----------------------------------------------------------------------------+
| DỮ LIỆU MÔ PHỎNG | WORK ORDER DRAFT — KHÔNG PHẢI LỆNH THẬT                 |
| Draft: SIM-WO-001 | Ticket: SIM-T-001 | Playbook PB-CLN-01 v0.x            |
|----------------------------------------------------------------------------|
| Raw required fields: [PASS] | confirmation_status: NOT_REQUIRED/CONFIRMED/ |
|                              | OVERRIDDEN [PASS] · PENDING_REVIEW [BLOCK]   |
| Location before draft: [PASS] | Priority: [OPTIONAL]                       |
| Playbook match: PB-... | Asset: MATCHED / N/A / unresolved                 |
| Material needed + simulated stock | ĐỀ XUẤT TEAM + duty/capacity mô phỏng   |
| Đề xuất tuyến team hợp lệ / Chưa có đề xuất tuyến team hợp lệ + reason    |
| Đây là đề xuất tuyến tới team mô phỏng, không phải xác nhận đã giao việc  |
| Scope summary (source-grounded)                                             |
| Checklist template                                                         |
| Material requirement: simulated / N/A                                      |
| Evidence requirements: required/optional (Ảnh: optional nếu rule không nêu) |
|----------------------------------------------------------------------------|
| AGENT REASON: matched rule | source reference | generated timestamp        |
| [Đi tới Execution Update] [Xem Ticket Source]                              |
| CTA tạo work order thật: KHÔNG TỒN TẠI                                     |
+----------------------------------------------------------------------------+
```

- **Mục tiêu:** cho thấy draft có cấu trúc, nguồn và giới hạn.
- **Actor:** phòng ban được giao, BQL; BPTN/Agent read.
- **Được sửa:** không sửa draft trực tiếp; execution ở UI-04/05.
- **Bất biến:** link/raw source; generated draft revision read-only.
- **Primary CTA:** “Đi tới Execution Update”.
- **Secondary:** “Xem Ticket Source”, “Xem reason/rule”.
- **Disabled/absent:** create real work order, gán nhân viên cụ thể, approve.
- **Rule (`CR-BPTN-02` (v0.5 candidate)):** draft chỉ tồn tại sau khi giao (bước 8); hiển thị `department_id`, cờ, vật tư dự kiến; `assignee_id` trên draft luôn trống.
- **Warning/error:** schema error fail closed.
- **Audit:** created/revised by Agent, versions, idempotency context.

## UI-04 — Execution Update

```text
+----------------------------------------------------------------------------+
| DỮ LIỆU MÔ PHỎNG | Execution Update | SIM-WO-001                           |
| [Nhận việc] [Không thuộc phòng ban + lý do] [Tạm hoãn + lý do + eta]       |
| [Tiếp tục] (chỉ khi BLOCKED_ONSITE)   Cờ: ASSET_CHECK_ONSITE / STOCK_...  |
| Last saved by / at / revision                                               |
| [Lưu cập nhật]  [Sang Checklist, Material & Evidence]                      |
|----------------------------------------------------------------------------|
| Không sửa: resident source, Agent classification, playbook/version          |
+----------------------------------------------------------------------------+
```

- **Mục tiêu:** ghi execution updates tách khỏi source/proposal.
- **Actor:** phòng ban được giao (`CR-BPTN-02` (v0.5 candidate)).
- **Primary CTA:** “Nhận việc” (`ROUTED`), sau đó “Lưu cập nhật”.
- **Secondary:** tới UI-05; xem draft.
- **Disabled:** state override, source edit, send message, mark complete/accept.
- **Status/error:** save validation; audit failure làm save fail closed.
- **Audit:** actor/time/field/old/new/reason hoặc note context.

## UI-05 — Checklist, Material & Evidence

```text
+----------------------------------------------------------------------------+
| DỮ LIỆU MÔ PHỎNG | Checklist, Material & Evidence                          |
| CHECKLIST: [PENDING/COMPLETED] item ...                                     |
|----------------------------------------------------------------------------|
| MATERIAL & SIMULATED STOCK                                                  |
| item | planned_qty | norm_qty | stock_qty/status | issued_qty | used_qty    |
| variance | variance_reason                                                  |
| Comparisons: planned↔norm | issued↔planned | used↔issued                   |
| Pre-route stock gate: SUFFICIENT / INSUFFICIENT / UNKNOWN / N/A             |
|----------------------------------------------------------------------------|
| EVIDENCE REQUIREMENTS — TÁCH KHỎI CHECKLIST GATE                            |
| requirement | required? | present/missing/invalid | source                  |
| Ảnh không bắt buộc trong MVP                                                |
| [Lưu execution data] [Báo hoàn thành]                                      |
+----------------------------------------------------------------------------+
```

- **Mục tiêu:** cập nhật và nhìn rõ các nhóm readiness data.
- **Actor:** phòng ban được giao edit (khi `IN_PROGRESS`); Agent đối soát; BQL read.
- **Field sửa:** checklist status, material fields/reason, execution evidence metadata.
- **Bất biến:** original resident evidence; playbook requirement/version.
- **Primary CTA:** “Lưu execution data”.
- **Secondary:** “Báo hoàn thành” → Agent đối soát bước 10; không đạt thì hiện danh sách mục thiếu.
- **Disabled:** Agent auto-complete; approve/adjust inventory; image quality confirmation.
- **Warning/error:** đối soát không đạt giữ `IN_PROGRESS` (không blocker); lệch vật tư có lý do là warning không chặn.
- **Audit:** per change + validation run ID.

## UI-06 — `READY_FOR_REVIEW` Package

```text
+----------------------------------------------------------------------------+
| DỮ LIỆU MÔ PHỎNG | READY_FOR_REVIEW — Chờ nghiệm thu                       |
|----------------------------------------------------------------------------|
| Phòng ban đã nhận việc (accepted_at)  [PASS]                                |
| Checklist: không còn PENDING          [PASS]                                |
| Ghi chú xử lý                         [PASS]                                |
| Vật tư xuất/dùng đã nhập              [PASS]                                |
| Lệch vật tư có lý do                  [PASS / WARNING]                      |
| Không còn blocker mở                  [PASS]                                |
| Rework count: 0                                                             |
|----------------------------------------------------------------------------|
| NON-BLOCKING WARNINGS: rule | reason | comparison/source                   |
|----------------------------------------------------------------------------|
| [Nghiệm thu]  [Trả làm lại + lý do]  [Xem audit]        (chỉ BQL)          |
+----------------------------------------------------------------------------+
```

- **Mục tiêu (`CR-BPTN-02` (v0.5 candidate)):** BQL kiểm sáu điều kiện đối soát rồi nghiệm thu hoặc trả làm lại.
- **Primary CTA (chỉ BQL):** **“Nghiệm thu”** → `CLOSED`; **“Trả làm lại”** (bắt buộc lý do) → `IN_PROGRESS`/`REWORK`;
  lần thứ 3 hiện cờ leo thang.
- **Role khác:** không render CTA; gọi API vẫn bị `ACTION_DENIED`.
- **Audit:** mỗi quyết định là một `ticket_status_events`.

## UI-07 — Hàng chờ BPTN xác minh (`CR-BPTN-02` (v0.5 candidate), thay Exception Review)

```text
+----------------------------------------------------------------------------+
| DỮ LIỆU MÔ PHỎNG | Chờ BPTN xác minh | SIM-TKT-0002 | ASSET_UNCLEAR ⚑      |
|----------------------------------------------------------------------------|
| Lý do dừng + ghi chú nội bộ | Nội dung gốc + phần bổ sung (read-only)      |
|----------------------------------------------------------------------------|
| DUPLICATE        : [Gộp vào SIM-TKT-0001] [Không trùng]                    |
| CATEGORY_UNCLEAR / OUT_OF_SCOPE : Loại việc [Vệ sinh|Đèn] + lý do           |
| PENDING_REVIEW   : [Xác nhận] hoặc sửa loại việc/vị trí + lý do             |
| ASSET_UNCLEAR    : Asset [SIM-ASSET-...] | Vị trí [...]                      |
|                    [Xác định tại hiện trường] + lý do (bắt buộc)            |
| WRONG_DEPT       : Loại việc [...] hoặc Phòng ban [...] + lý do             |
|----------------------------------------------------------------------------|
| Sau khi lưu: chạy lại từ bước 4 / 6 / 7 — không bao giờ giao thẳng          |
+----------------------------------------------------------------------------+
```

- **Mục tiêu (`CR-BPTN-02` (v0.5 candidate)):** BPTN gỡ đúng blocker; giá trị chọn vào `locked_fields`, Agent không ghi đè.
- **Actor:** BPTN. Không có CTA đóng/hủy (chỉ BQL).
- **Rule:** tài sản chỉ đi tiếp khi BPTN chọn asset hoặc chủ động chọn xác định tại hiện trường kèm lý do; đổi loại việc
  sau `WRONG_DEPT` thì chạy lại tra tài sản.
- **Error:** thiếu lý do khi thay đổi → 409, không ghi gì.

## UI-08 — Audit History

```text
+----------------------------------------------------------------------------+
| DỮ LIỆU MÔ PHỎNG | Audit History | SIM-TKT-0001                           |
|----------------------------------------------------------------------------|
| time | actor_id/role | from → to         | reason_code | note              |
| time | SYSTEM        | — → RECEIVED      | —           |                   |
| time | SYSTEM        | RECEIVED → ROUTED | —           |                   |
| time | BQL           | READY... → CLOSED | —           | note              |
|----------------------------------------------------------------------------|
| [Back to case]   [Export JSON — P1]                                        |
+----------------------------------------------------------------------------+
```

- **Mục tiêu:** truy vết mọi thay đổi trạng thái/blocker (`ticket_status_events`, `CR-BPTN-02` (v0.5 candidate)) và audit các action khác.
- **Được sửa:** không; append-only.

## UI-09 — Theo dõi phản ánh (cư dân, `CR-BPTN-02` (v0.5 candidate))

```text
+--------------------------------------------------+
| Phản ánh SIM-TKT-0001                            |
| ● Đang xử lý — Phòng Vệ sinh đang xử lý phản ánh |
|--------------------------------------------------|
| ✓ Đã tiếp nhận        09:00 28/09                |
| ✓ Đã chuyển phòng ban 09:00 28/09                |
| ● Đang xử lý          10:00 28/09                |
|   Chờ nghiệm thu                                 |
|   Hoàn thành                                     |
|--------------------------------------------------|
| [Bổ sung thông tin]  [Đánh giá]  [Báo chưa xong] |
+--------------------------------------------------+
```

- **Nguồn:** `GET /api/v1/resident/tickets/{id}` (chỉ trường công khai).
- **Hiển thị:** nhãn trạng thái, tên phòng ban **chỉ sau khi giao**, `public_message`, `eta`, timeline; ticket đã gộp
  hiện trạng thái ticket gốc.
- **Không hiển thị:** mã lý do, ghi chú nội bộ, người được giao, vật tư, số lần nhắc, cờ leo thang, phòng ban đề xuất.
- **CTA:** chỉ những hành động trong `allowed_actions` (bổ sung khi chưa kết thúc; đánh giá và báo chưa xong khi đã
  hoàn thành, trong 7 ngày).

## UI-10 — Dashboard BQL (`CR-BPTN-02` (v0.5 candidate))

```text
+----------------------------------------------------------------------------+
| DỮ LIỆU MÔ PHỎNG | Dashboard BQL                                            |
| [Trạng thái] [Phòng ban] [Mã blocker] [Leo thang ⚑] [Quá SLA]               |
|----------------------------------------------------------------------------|
| ID | Trạng thái | Phòng ban (đề xuất) | Blocker | Người gỡ | Leo thang | …  |
|----------------------------------------------------------------------------|
| Chọn ticket: [Nghiệm thu] [Trả làm lại] [Hủy + lý do]                       |
+----------------------------------------------------------------------------+
```

- **Nguồn:** `GET /api/v1/bql/tickets` (đầy đủ, có filter).
- **CTA (chỉ BQL):** nghiệm thu, trả làm lại, hủy ticket chưa kết thúc (bắt buộc lý do). Leo thang chỉ là cờ; BQL quyết định.

---

# 4. UI acceptance notes

- Bốn demo flow (`CR-BPTN-02` (v0.5 candidate)) chạy qua `UI-09 → UI-01/02 → UI-04/05 → UI-06`, hoặc dừng tại `UI-07` khi chờ BPTN.
- Cư dân thấy timeline trạng thái; happy path có đúng 5 mốc; trước khi giao không thấy tên phòng ban.
- Không có nút giao phòng ban thủ công; giao chỉ xảy ra khi `can_route` đúng.
- Chỉ BQL có CTA nghiệm thu/trả làm lại/hủy.
- Component không dựa màu đơn lẻ; trạng thái và severity có text.
- Không có outbound message action qua kênh thật; thông báo chỉ là outbox.

## Phase 4 consistency gate

**PASS cho v0.3.** `CR-BPTN-02` (v0.5 candidate) (PROPOSED) thêm màn hình cư dân và BQL, thay Exception Review bằng hàng chờ BPTN; tên/bằng chứng
sign-off OD-09 vẫn `TBD`.

# 5. Backlog implementation UI (nhánh chưa có frontend)

Repo hiện chỉ có API (Swagger); chưa có frontend. Khi làm frontend (`CR-BPTN-02` (v0.5 candidate)):

| ID | Hạng mục | Nguồn dữ liệu API |
|---|---|---|
| `UI-BL-01` | `UI-09` theo dõi phản ánh | `GET/POST /api/v1/resident/tickets…` (`additions`, `rating`, `reopen`) |
| `UI-BL-02` | `UI-10` dashboard BQL + nghiệm thu/trả làm lại/hủy | `GET /api/v1/bql/tickets`, `POST /bql/tickets/{id}/close|rework|cancel` |
| `UI-BL-03` | `UI-07` hàng chờ BPTN | `POST /api/v1/mo/tickets/{id}/bptn-resolve` |
| `UI-BL-04` | `UI-04/05` phòng ban | `POST /mo/tickets/{id}/accept|return|block|resume-work|complete`, checklist/materials/evidence |
| `UI-BL-05` | Panel "Điều kiện giao" (`can_route`) và blocker | `ticket.review_status`, `asset_resolution`, `proposed_department_id`, `blocker` |
| `UI-BL-06` | Timeline | `GET /mo/tickets/{id}/events` |

## Deferred / Future Scope

- CSKH chỉ thuộc backlog tương lai.
- Kênh gửi thông báo (push/SMS/Zalo) và phân công nhân sự trong phòng ban nằm ngoài `CR-BPTN-02` (v0.5 candidate).


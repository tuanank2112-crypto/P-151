# 00 — Architecture: Trường MVP preparation

> Thực hiện: 2026-10-03 (Asia/Saigon). Gói đầu ra giao cho 01/10–02/10; MVP dự kiến 04/10. Không backdate ngày thực hiện.
> `group_status=PENDING`, `approver=null`, `approved_at=null`. D-01 USER_CONFIRMED; chưa phải duyệt nhóm. Đây là hợp đồng đích, không chứng nhận runtime.

## 1. Mục tiêu và router

Chuẩn bị đầu ra Trường theo phạm vi Notion root bàn giao. Notion thay thế phân kỳ cũ CR03 §16; hợp đồng không bị thay thế tiếp tục theo CR03. Không mở rộng backlog vào MVP.
Thứ tự đọc: `00-ARCHITECTURE.md` → `01-CONTRACTS.md` → SPEC trong router `plan.md` → `OPERATIONS.md` → `TESTING-ACCEPTANCE.md`. Chữ ký/schema chính xác thuộc `01-CONTRACTS.md`; phép đo và manifest demo thuộc `TESTING-ACCEPTANCE.md`.

| Decision | Router hợp đồng | Xác nhận |
|---|---|---|
| D-01 | `01-CONTRACTS.md`: new addition + persisted structured context; safety scan; risk monotone | USER_CONFIRMED / GROUP_PENDING / runtime chưa nghiệm thu |
| D-02 | `01-CONTRACTS.md`: Bậc 2, 4/12 giờ lịch theo CR03 §17 | USER_CONFIRMED_DEFAULT / GROUP_PENDING |
| D-03 | `01-CONTRACTS.md`: duplicate raise threshold 3 | USER_CONFIRMED_DEFAULT / sau MVP |
| D-04 | `01-CONTRACTS.md`: bóng/đèn cháy đứng riêng NONE, B-01 | USER_CONFIRMED_DEFAULT / GROUP_PENDING |
| D-05 | `01-CONTRACTS.md`: kho không rõ đi tiếp với STOCK_CHECK_ON_ACCEPT | USER_CONFIRMED_DEFAULT / cần đo runtime |
| D-06 | `01-CONTRACTS.md`: mở rộng safety mô phỏng | USER_CONFIRMED_DEFAULT / theo phân kỳ §2 |
| D-07 | `01-CONTRACTS.md`: ảnh bằng chứng bắt buộc, không miễn | USER_CONFIRMED_DEFAULT / code hiện có phải đo lại |
| D-08 | `01-CONTRACTS.md`: approver và thời điểm duyệt | PENDING / approver=null / approved_at=null |

## 2. Phạm vi và non-goals

**MVP 04/10:** safety P0 S-01..S-05, S-09, S-14; Bậc 2 và B-01..B-04; base priority PRI-H1/H2/M/L/D0; target không reopen, không assignee; bốn demo bên dưới. T10 đóng khẩn cấp và hạ báo nhầm, thời hạn Bậc 2 thuộc MVP theo Notion.
**Sau MVP:** T16/T17/E02; safety mở rộng S-06..S-08, S-10..S-13, C-01 và bẫy ngoài P0; priority duplicates/vulnerable PRI-U1/U2; undo merge, nối bổ sung, xử lý hủy ticket gốc, follow-up, danh sách clearance BQL, LangGraph. Giữ D-03 để duyệt không có nghĩa kéo duplicate priority vào P0.
**Non-goals:** runtime edits trong gói này; nhân sự/lịch trực, hệ thống/kho thật, ảnh AI, chatbot, thanh toán; không rollout. Mọi dữ liệu/demo phải mang nhãn mô phỏng.

| Demo | Phạm vi chính xác | Router nghiệm thu |
|---|---|---|
| DEMO-01 | Happy path vệ sinh và đèn: giao đúng phòng ban, đủ hồ sơ, BQL đóng, rating một lần | TESTING-ACCEPTANCE và OPERATIONS |
| DEMO-02 | Thiếu thông tin/asset chưa rõ: dừng đúng, đúng người xử lý, chạy tiếp đúng bước | TESTING-ACCEPTANCE và OPERATIONS |
| DEMO-03 | Thiếu vật tư chưa giao → nhập kho mô phỏng → xét lại điều kiện | TESTING-ACCEPTANCE và OPERATIONS |
| DEMO-04 | Bậc 2 ba lựa chọn BPTN, Bậc 1 chỉ BQL; Agent/job không tự gỡ | TESTING-ACCEPTANCE và OPERATIONS |

## 3. Bất biến và exact acceptance contracts đích

BẮT BUỘC phân loại trước kiểm tra trùng. Safety scan luôn chạy trên bổ sung mới + structured context đã lưu, kể cả thiếu dữ liệu hoặc phân loại không rõ; CẤM return sớm bỏ safety. Vị trí 3b là target CR03; xử lý missing-info theo D-01 tại `01-CONTRACTS.md`.
BẮT BUỘC raw/ảnh ban đầu bất biến, bổ sung và evidence append-only. CẤM đưa toàn bộ raw cũ hoặc chuỗi bổ sung cũ vào LLM; chỉ cấp dữ kiện mới và structured context để giảm nhiễu và chặn dữ liệu cũ thành chỉ dẫn.
BẮT BUỘC Agent/job giữ hoặc nâng risk; downgrade chỉ human action đúng vai + lý do + audit. `resume()`/job không tự gỡ `EMERGENCY_PENDING_BQL`.
BẮT BUỘC chuyển status qua transition hợp lệ, mutation qua atomic/audit hiện có. Cư dân chỉ nhận public allow-list; không risk nội bộ, reason nội bộ hoặc dữ liệu nhân sự. Ticket text là dữ liệu không đáng tin.
Target không reopen và không assignee là scope mới. Code cũ còn hai khả năng này là drift cần ghi, CẤM sửa tài liệu để tuyên bố runtime đã khớp.

| ID | Input/điều kiện | Output máy đọc bắt buộc ở runtime đích |
|---|---|---|
| A-01 | Safety P0 Bậc 1, kể cả ngoài scope/thiếu dữ liệu | status=VERIFYING; reason_code=EMERGENCY_PENDING_BQL; owner BQL; không route/draft |
| A-02 | Safety Bậc 2 | status=VERIFYING; reason_code=SAFETY_REVIEW_REQUIRED; owner BPTN; không tự clearance |
| A-03 | Bổ sung mới + persisted structured snapshot | Safety scan được gọi; LLM input không full raw cũ; risk sau Agent/job >= risk trước |
| A-04 | Replay cùng event | Không append/scan/commit lần hai theo D-01 idempotency contract |
| A-05 | Vai sai/chuyển ngoài bảng | ACTION_DENIED hoặc INVALID_TRANSITION; không đổi state |
| A-06 | Gói demo | Manifest đúng DEMO-01..04, mỗi ID có expected outputs và evidence; video không thay kết quả máy |
| A-07 | Phạm vi runtime MVP | Không reopen/assignee; không T16/T17/E02 hoặc backlog trong P0 |

## 4. Vùng cấm, lỗi và hành vi caller

| Loại lỗi/drift | Caller BẮT BUỘC làm | CẤM và lý do |
|---|---|---|
| GROUP_APPROVAL_PENDING | Giữ D-08 PENDING, đưa nhóm quyết định trước sign-off | Không giả approver/date; user confirmation không phải group approval |
| SOURCE_CONFLICT | Ghi quyết định bị thay thế có ngày; dùng Notion cho scope; đưa conflict contract chưa chốt cho root | Không bỏ requirement hoặc thay đổi im lặng |
| SAFETY_UNCLEAR / thiếu input | Safety scan; giữ/escalate blocker theo 01-CONTRACTS | Không mặc định NONE hoặc auto downgrade vì thiếu dữ liệu |
| ACTION_DENIED / INVALID_TRANSITION | Trả mã ổn định, không mutation, audit theo CR03 | Không đổi quyền retry hoặc bypass transition |
| AUDIT_OR_STORE_FAILED | Fail closed, không commit state | Không báo thành công khi persistence/audit thất bại |
| EVIDENCE_MISSING | Giữ gate chưa đạt; root đo lại | Không lấy số test lịch sử để claim runtime hiện tại |
| BOOT_HUB_MISSING | Ghi exit thật, báo root, giữ managed rules | Không sửa tay engine/rules hay đánh dấu brain compliant |

## 5. Gates theo môi trường và bằng chứng

| Gate | Điều kiện chính xác | Trạng thái gói chuẩn bị |
|---|---|---|
| local documents | Router D-01..D-08; P0/post-MVP; invariants; errors/caller; 4 lớp gate; measurements tại evidence/wp1/measurements.txt | Chờ root review; chỉ đo tài liệu |
| group | D-01..08 có quyết định; D-08 có người và thời điểm duyệt thật | ⬜ PENDING |
| runtime local | Implement hợp đồng; chạy TESTING-ACCEPTANCE với evidence độc lập | ⬜ Chưa triển khai/nghiệm thu trong WP1 |
| online | Deploy/runbook + 4 demo môi trường thật có evidence và kiểm bảo toàn dữ liệu | ⬜ Chưa chạy; thao tác remote cần duyệt |

Không đóng kế hoạch khi chỉ local documents đạt. Boot đo 2026-10-03: exit 1 MODULE_NOT_FOUND cho engine tại hub. Không có kết luận chuẩn khung não. WP1 không chạy hoặc tuyên bố test runtime.

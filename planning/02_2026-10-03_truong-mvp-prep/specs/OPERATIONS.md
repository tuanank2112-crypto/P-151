# OPERATIONS — bốn nhóm demo MaintenanceOps

## 1. Trạng thái và setup cô lập

Ngày lập 2026-10-03; dữ liệu **SIMULATED**, group approval **APPROVED** theo thông báo người dùng (leader Lê Thị Châm Anh, ngày được báo 2026-10-02, ghi nhận 2026-10-03). D01 đã chốt delta + snapshot: LLM chỉ nhận phần bổ sung mới và snapshot, không raw cũ; safety luôn chạy; risk không tự giảm khi chưa có quyết định người có quyền. D02–D07 dùng mặc định của CONTRACTS. Đây là runbook chuẩn bị, chưa chạy runtime/online.

Đối chiếu `src/api/routers/maintenance.py`, `src/main.py`, `src/maintenance/{engine,demo}.py`, `seed/maintenance_v1/{tickets,catalog,accounts}.yaml`. CURRENT có ingest/additions, BPTN info/asset, department execution, BQL close, warehouse stock, jobs. **TARGET BLOCKED — UNIMPLEMENTED**: CR03 safety, delta/snapshot D01, rating một lần, cấm reopen. Hiện `rate()` ghi đè rating, additions phân loại lại raw+additions, route reopen còn có. CẤM trình diễn target như đã chạy đạt.

Bước 0 trên máy: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` exit 1 MODULE_NOT_FOUND; hub thiếu, không tự sửa governance. Runtime phải giải quyết hub rồi chạy lại.

### 1.1 Lệnh và rollback

BẮT BUỘC terminal/tiến trình local mới, bind loopback, environment cô lập: `MO_STORE=memory`, `LLM_MODE=mock`, `MO_PHOTO_STORE=local`, `APP_ENV=development`, `MO_ALLOW_RESET=false`. Lệnh dự kiến: `python -m uvicorn src.main:app --host 127.0.0.1 --port 8151`. Kiểm `/health`, cấu hình memory và actors trước mutation. Không dùng Postgres/Supabase remote. Seed chỉ khi trống. Mỗi nhóm khởi động memory process mới để tránh trùng case, jobs và stock ảnh hưởng nhau. Ngày fixture 2026-09-27 là input tái hiện; nhật ký thực hiện ghi ngày thật, không backdate.

Chỉ dùng evidence JSON ảnh mô phỏng trong runbook này, vì config hiện không có thư mục ảnh demo riêng; không upload ảnh vào đường dẫn ảnh dùng chung. Online photo gate phải có môi trường/đường dẫn cô lập được xác minh trước upload. Rollback: dừng đúng memory process, state/session biến mất khi restart; giữ output máy. Nếu có ảnh tạm từ demo online sau này, xác minh đường dẫn tuyệt đối nằm trong thư mục demo trước đề xuất xóa; không tự xóa nhiều file. CẤM reset/evaluate remote, drop DB, xóa bucket, sửa catalog trực tiếp, deploy/push.

### 1.2 Endpoint/actors/evidence chung

Prefix tất cả API dưới đây là `/api/v1`. POST `/auth/login` body `{"username":"<tên dưới đây>","password":"<mật khẩu demo từ accounts.yaml>"}`; Bearer token đúng role, không lưu password/token vào log. Cư dân `cudan01`→`SIM-ACTOR-RESIDENT-01`; BPTN `bptn01`; vệ sinh `vesinh01`; kỹ thuật `kythuat01`; kho `kho01`; BQL `bql01`; QA `qa01`. Actor ID đầy đủ ở catalog. Agent/System không là tài khoản người.

`T` là ID fixture hoặc response ingest. `E(G,S)` = evidence nhóm G bước S: request đã che auth, HTTP status/body, timestamp, actor; GET `/mo/tickets/T`, `/mo/tickets/T/events`, `/audit`, `/notifications` bằng BPTN/BQL/QA; thêm GET `/resident/tickets/T` bằng chủ sở hữu để kiểm allow-list. Lưu nguyên output máy, không ghi tay. Chưa chạy thì E chưa tồn tại, gate vẫn pending. Bằng chứng chuẩn bị: `../evidence/wp3/contract-check.txt`; không phải log execution.

## 2. Nhóm 1 — happy path vệ sinh và đèn, hai nhánh độc lập

Input fixture A `SIM-TKT-CLN-001`: “Hành lang tầng 3 tòa SIM-A có nhiều rác và vết bẩn, cần vệ sinh.” B `SIM-TKT-TEC-001`: “Đèn hành lang tầng 3 tòa SIM-A không sáng từ tối qua.” Dùng seed đã nhận input ở giờ trong ca; không ingest lại thành bản trùng. A department=`DEPT_CLEANING`, B=`DEPT_TECHNICAL`; playbook A=`PB-CLN-01`, B=`PB-TEC-01`. Mọi bước lưu E(1,S-A/B).

1. **QA/BPTN** GET `/mo/tickets/T`: `ROUTED`, blocker null, có draft, đúng department; B asset=`SIM-ASSET-LIGHT-001`. Cho department nhận; cấm Agent gán nhân viên, `assignee_id` phải null; cấm close sớm.
2. **Đúng department** POST `/mo/tickets/T/accept`, không body: `IN_PROGRESS`/null. Sai department bị từ chối, status không đổi; MVP đích không có thao tác gán nhân viên; khả năng tự phân công trong baseline là drift, không phải bước demo MVP.
3. **Department** POST `/mo/tickets/T/checklist/I` body `{"status":"COMPLETED","note":"Đã kiểm tra mô phỏng"}` cho I=`CLN-CHK-01`, `CLN-CHK-02`, `CLN-CHK-03` hoặc `TEC-CHK-01..03`: giữ `IN_PROGRESS`/null, đủ ba mục; cấm tự nghiệm thu.
4. **Department** POST `/mo/tickets/T/materials/C`: A C=`SIM-MAT-CLEAN-01`, body `{"issued_qty":2,"used_qty":2}`; C=`SIM-MAT-BAG-01`, body `{"issued_qty":3,"used_qty":3,"variance_reason":"Khối lượng rác mô phỏng lớn hơn định mức"}`. B C=`SIM-MAT-LAMP-01`, body `{"issued_qty":1,"used_qty":1}`. Giữ `IN_PROGRESS`/null, ghi đủ vật tư; A explained variance warning được phép. Cấm Agent chỉnh stock.
5. **Department** POST `/mo/tickets/T/evidence`: A `{"requirement_id":"CLN-EVD-PROCESSING-NOTE","evidence_type":"PROCESSING_NOTE","content_or_metadata":"Đã thu gom rác và lau sàn mô phỏng","readability_status":"NOT_APPLICABLE"}`; B đổi requirement=`TEC-EVD-RESULT-NOTE`, type=`RESULT_NOTE`, content=`Đã thay bóng mô phỏng`. Cả hai thêm `{"requirement_id":null,"evidence_type":"SIMULATED_IMAGE","content_or_metadata":"Ảnh kết quả mô phỏng","readability_status":"READABLE"}`. Giữ `IN_PROGRESS`/null, evidence đúng draft; không dùng ảnh cư dân làm execution evidence. Đây là metadata mô phỏng, không chứng minh upload/UI. Online dùng POST `/mo/tickets/T/photos` multipart `files` PNG/JPG/WEBP hợp lệ chỉ sau setup ảnh riêng.
6. **Department** POST `/mo/tickets/T/complete`, không body: `READY_FOR_REVIEW`/null, readiness all_pass=true, failing_items=[]; warning A không chặn. Thiếu checklist/ảnh phải giữ `IN_PROGRESS`, caller bổ sung; cấm close lách.
7. **BQL** POST `/bql/tickets/T/close` `{"note":"Đã kiểm duyệt kết quả mô phỏng"}`: `CLOSED`/null, audit BQL; department/BPTN/Agent không được close.
8. **Cư dân chủ sở hữu** POST `/resident/tickets/T/rating` `{"score":5}`, rồi `{"score":1}`. Đích: lần đầu thành công, lần hai 409 và rating vẫn 5, không rating mutation mới; cấm reopen. **TARGET BLOCKED — UNIMPLEMENTED**: hiện rate ghi đè. Lưu hai response và audit; không test lần hai trên dịch vụ chung. Cấm đánh dấu nhóm 1 runtime đạt trước fix rating-once.

## 3. Nhóm 2 — thiếu info hoặc asset, làm rõ đúng quyền

### 3.1 NEED_INFO

1. **QA/BPTN** GET fixture `SIM-TKT-CLN-003`, raw="   ": `NEED_INFO`/`MISSING_INFO`, department/draft null; BPTN liên hệ hoặc cư dân bổ sung được phép, cấm tự route. E(2,1).
2. **BPTN** POST `/mo/tickets/T/bptn-resolve` `{"location":"Tòa SIM-A / Tầng 6 / Cầu thang bộ","info":"Có bụi bẩn, cần vệ sinh khu vực chung","note":"Đã liên hệ cư dân xác nhận nội dung và vị trí"}`. Raw vẫn trắng, addition ghi submitted_by BPTN, locked location; tiếp tục đến `ROUTED`/null nếu không blocker mới. Nếu DUPLICATE thì ghi đúng và BPTN quyết `{"merge":false,"note":"Xác nhận là phản ánh khác trong mô phỏng"}`, không bỏ qua. E(2,2); cấm sửa raw/ghi thiếu phần bắt buộc.
3. **BPTN** thiếu note hoặc chỉ location khi raw trắng trên case độc lập chưa resolve: 409, không append dở. **Sai role** bptn-resolve: 403, state không đổi. E(2,3); caller đọc thiếu trường, bổ sung đủ rồi retry có kiểm tra.

### 3.2 ASSET_UNCLEAR

1. **QA/BPTN** GET fixture `SIM-TKT-TEC-002`, “Đèn cầu thang bộ tầng 9 tòa SIM-A bị hỏng, không sáng.”: `VERIFYING`/`ASSET_UNCLEAR`, department/draft null; cấm accept. E(2,4).
2. **BPTN** POST `/mo/tickets/T/bptn-resolve` `{"asset_onsite":true,"note":"Sổ mô phỏng chưa có asset, kỹ thuật phải xác định tại hiện trường"}`: `ROUTED`/null, department kỹ thuật, draft có flag `ASSET_CHECK_ONSITE`, resolution=`ONSITE_BY_BPTN`; cho onsite có lý do, cấm bịa asset/sửa catalog. E(2,5).
3. **BPTN** onsite thiếu note trên bản độc lập: 409, giữ `VERIFYING`/`ASSET_UNCLEAR`; caller ghi lý do rồi retry. E(2,6).

## 4. Nhóm 3 — thiếu vật tư, kho nhập rồi resume

1. **QA/BPTN/kho** GET fixture `SIM-TKT-TEC-003`, “Bóng đèn hành lang tầng 2 tòa SIM-B không hoạt động.”; planned `SIM-MAT-LAMP-02` qty=2, stock=0: `ON_HOLD`/`WAITING_MATERIAL`, department/draft null, resume_step=6. Cho kho nhập; cấm accept/route lúc thiếu. E(3,1).
2. **QA** POST `/mo/tickets/T/resume`, không body khi stock=0: vẫn `ON_HOLD`/`WAITING_MATERIAL`, không department/draft; retry không thay thế stock. E(3,2).
3. **Kho** POST `/mo/warehouse/stock/SIM-MAT-LAMP-02` `{"qty":1}`: stock=1, vẫn `ON_HOLD`/`WAITING_MATERIAL`, chưa giao; vai khác bị cấm nhập. E(3,3).
4. **Kho** cùng POST `{"qty":1}`: stock=2; tự resume **bước 6 lookup asset**, bước 7 stock, bước 8 route; `ROUTED`/null, department kỹ thuật, draft có. API docstring nói bước 7 nhưng code blocker và `_step_7_check_material_stock` dùng 6. E(3,4) gồm audit lookup→stock→route.
5. **QA** POST resume lần nữa: giữ `ROUTED`/null, không giao trùng. Negative sai role stock 403; qty=0 422; item không tồn tại 404. E(3,5); cấm retry nhập kho mù khi mất response, đọc state/stock trước. Không cần hoàn tất case trong nhóm 3.

## 5. Nhóm 4 — safety, TARGET BLOCKED — UNIMPLEMENTED

### 5.1 Input và quyền

Mỗi nhánh case/process riêng. **Cư dân** CURRENT POST `/resident/tickets` `{"original_description":"<câu dưới đây>","channel":"form","simulated_received_at":"2026-10-03T10:00:00+07:00"}`. Bậc 2: “Hình như có mùi khét ở đèn hành lang tầng 3 tòa SIM-A.” Bậc 1: “Đèn hành lang tầng 3 tòa SIM-A có khói và mùi khét.” Đích `VERIFYING`, lần lượt `SAFETY_REVIEW_REQUIRED` chủ BPTN / `EMERGENCY_PENDING_BQL` chủ BQL, department/draft null; emergency thông báo ngay và ghim BQL. E(4,ingest) kèm resident allow-list không lộ risk nội bộ.

Hiện chưa có blocker/field/action safety và chưa có endpoint/request schema cho quyết định dưới đây. **TARGET BLOCKED — UNIMPLEMENTED** cho toàn §5: implementer phải cung cấp OpenAPI route + body trong CONTRACTS trước runtime. Tên action sau là semantic contract CR03, không phải route có thật; CẤM bịa URL hoặc lách qua generic transition/bptn-resolve.

### 5.2 Bậc 2 — đúng ba lựa chọn BPTN, CR03 §6.4

1. **BPTN xác nhận an toàn** target `SAFETY_CONFIRM_SAFE`, lý do bắt buộc “Đã kiểm tra mô phỏng, không có nguy hiểm”: audit + safety_cleared_by/at/reason; `RECEIVED` rồi flow thường → `ROUTED`/null hoặc blocker nghiệp vụ đúng. E(4,2safe), snapshot trước/sau. Thiếu note phải lỗi không clear; Agent/job cấm clear.
2. **BPTN nâng khẩn cấp** target `SAFETY_ESCALATE`, lý do “Xác minh mô phỏng thấy khói”: vẫn `VERIFYING`, blocker=`EMERGENCY_PENDING_BQL`, chủ BQL, department/draft null; audit; BPTN không rút lại/downgrade/close. E(4,2escalate) và denial BPTN thử rút lại.
3. **BPTN yêu cầu bổ sung** target T06, note “Cần mô tả vị trí chính xác và tín hiệu tại đèn”: `NEED_INFO`/`MISSING_INFO`, safety_context=true, chủ **cư dân** (sửa 2026-10-03 theo CR-03 §6.4 + plan 02 Q04; chữ cũ "chủ BPTN" lệch SPEC duy nhất), không department/draft. **Cư dân** CURRENT POST `/resident/tickets/T/additions` `{"content":"Ở hành lang tòa SIM-A, có khói từ đèn và mùi khét"}`. Đích D01 dù thiếu tầng/vị trí chưa đầy đủ phải phát hiện emergency ngay → `VERIFYING`/`EMERGENCY_PENDING_BQL`; không để NEED_INFO che hazard. E(4,2info) gồm mock proposer input delta+snapshot, không raw cũ. CURRENT additions chưa bảo đảm này.

Timeout nhánh Bậc 2 không xử lý: **QA** CURRENT POST `/mo/jobs/run` `{"now":"2026-10-03T14:01:00+07:00"}`; target 4 giờ lịch leo thang BQL, không clear. NEED_INFO safety thử độc lập now=`2026-10-03T22:01:00+07:00`, target 12 giờ lịch, không tự coi an toàn. E(4,deadline); lấy config mặc định đã chốt, cấm hardcode trong engine.

### 5.3 Bậc 1 — chỉ BQL; tách MVP và phần sau MVP

Mỗi action trên case emergency mới, E(4,1-action). Đóng khẩn cấp/hạ báo nhầm là cổng MVP; CREATE_FOLLOW_UP là SAU MVP theo Notion, không yêu cầu để chốt 04/10. Gộp/hủy mô tả hợp đồng CR03 để review; chỉ chạy nếu phạm vi ứng viên hỗ trợ, không mở rộng gate bốn demo. Tất cả giữ cấm BPTN/department/Agent/job quyết thay BQL; note/audit theo CR03.

1. **BQL đã xử lý, đóng**, target `EMERGENCY_CLOSE`, note kết quả bắt buộc: `CLOSED`, closure_kind=`EMERGENCY_HANDLED`; không fake draft/department. CURRENT route DUY NHẤT: POST `/bql/tickets/T/emergency/close` `{"note":"<kết quả>"}`. `/bql/tickets/T/close` chỉ đóng từ `READY_FOR_REVIEW`; gọi trên emergency VERIFYING → 409 `INVALID_TRANSITION`, case không đổi (đo 2026-10-03, `test_plain_close_rejects_emergency`).
2. **BQL báo nhầm, hạ xuống**, target `EMERGENCY_DOWNGRADE`, note bắt buộc: clearance ghi đúng người/thời điểm; `RECEIVED`→flow bảo trì; BPTN downgrade bị cấm.
3. **SAU MVP — BQL tạo sửa chữa tiếp theo**, target `CREATE_FOLLOW_UP`: ticket mới follow_up_of=T, kế thừa nội dung/ảnh cần thiết và clearance đúng snapshot; BQL sau đó emergency-close cha. Evidence có hai ID/audit; cấm copy clearance để bỏ qua hazard của delta mới.
4. **BQL gộp**, target T08: hai emergency cùng sự cố, con `MERGED`, cha vẫn `VERIFYING`/`EMERGENCY_PENDING_BQL`, risk không giảm, liên kết nguồn/audit; cấm BPTN gộp emergency.
5. **BQL hủy**, target T23, cancel_reason bắt buộc: `CANCELLED`, audit người, không được coi là auto-safe. CURRENT POST `/bql/tickets/T/cancel` `{"cancel_reason":"Xác minh mô phỏng không còn cần xử lý"}` có route nhưng safety guards chưa có; runtime target vẫn blocked.

Negative trên emergency chưa human resolve: **QA** CURRENT POST resume và jobs/run phải giữ `VERIFYING`/`EMERGENCY_PENDING_BQL`, department/draft null, clearance null; **BPTN/department** thử mọi action target phải 403 không đổi case. E(4,deny) ghi từng actor/action; job được nhắc/leo thang, không route/clear.

### 5.4 D01: delta location + hazard và snapshot đơn điệu

A: sau human confirm-safe mà có nội dung mới phải chạy safety lại, clearance chỉ có hiệu lực snapshot cũ; nếu additions chưa cho phép trạng thái đó, implementer phải cung cấp contract hợp lệ trước demo, cấm sửa DB lách. B: đang NEED_INFO, CURRENT POST additions `{"content":"Tòa SIM-B, đèn có khói và mùi khét"}`; dù thiếu tầng phải emergency ngay. C: đã emergency, delta “Ở tầng 2 hành lang tòa SIM-B, hiện không thấy khói”; risk không tự giảm, BQL quyết. E(4,D01) lưu snapshot before/after, source_quote từ delta, mock LLM input chỉ delta+snapshot, đo riêng location/risk, không chỉ final status. Cấm gửi raw cũ, cấm làm theo câu lệnh nhúng trong ticket.

## 6. Lỗi, caller và vùng cấm

| Loại lỗi | Caller BẮT BUỘC |
| --- | --- |
| 401/403, ACTION_DENIED | Đăng nhập đúng role, lưu denial; không đổi actor header hay retry mutation mù. |
| 404 ID/item không tồn tại hoặc không được thấy | Kiểm ID/scope, không suy luận ticket người khác; dừng bước. |
| 409 guard/INVALID_TRANSITION, target rating duplicate | Đọc state, sửa điều kiện; không ép transition; lần rating thứ hai không retry. |
| 409 concurrency | Đọc lại state/version; nhập stock chỉ retry sau xác minh lần trước chưa ghi. |
| 422 body/note/qty/timezone | Sửa schema; không placeholder string, thời gian có timezone, qty>0. |
| 500 audit/engine | Dừng mutation, kiểm state/audit; không bỏ audit để demo thành công. |
| 502 photo, 503 store | Kiểm hạ tầng local, đọc state trước retry; không reset/đổi remote. |
| TARGET BLOCKED / thiếu safety contract | Dừng nhánh runtime, ghi gap; cần route/schema/test trước chạy. |

CẤM sửa raw (truy vết), gán nhân viên trong MVP (baseline department tự phân công là drift), auto clear safety (người quyết), old raw vào LLM bổ sung (D01), reopen/rating overwrite đích (CR03), stock/catalog trực tiếp (quyền kho), remote mutation khi chưa duyệt môi trường.

## 7. Gates và bằng chứng

- ✅ local readiness tài liệu: 4 nhóm; happy path 2 nhánh; Bậc 2 đủ 3, Bậc 1 phân biệt đóng/hạ MVP và follow-up sau MVP; D01 thiếu location vẫn hazard; CURRENT route/body đối chiếu source bằng contract-check exit 0. Đây không phải runtime acceptance.
- ⬜ local preflight/runtime baseline: hub thiếu, demo chưa chạy; E(G,S) chưa sinh. Root đo lại độc lập, không tin report.
- ⬜ local target: safety/D01/rating-once/no-reopen chưa implement; cần 0 emergency auto-clear, 0 old raw resubmit, deny từng role và evidence mỗi nhánh fresh.
- ⬜ online: chưa mở UI/deploy/gọi API chung, group approval recorded (leader Lê Thị Châm Anh, reported date 2026-10-02); chỉ chạy khi người dùng duyệt môi trường thật, không remote reset.
- ⬜ full repo format: root đo exit 1 do hai file có sẵn ngoài phạm vi; không tự sửa trong WP3. Chỉ chốt readiness WP3, không đóng package.

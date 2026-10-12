# Actions và UI
## §U1. Mapping endpoint, body
Mọi path dưới /api/v1, tid string. Không dùng actor_id từ client.
- Gửi: POST resident/tickets {original_description,channel:'form'}; location wizard nối vào mô tả hiển thị preview trước gửi. Không gửi simulated_received_at. 201 giữ tid thật; ảnh gửi riêng multipart field files vào resident/tickets/{tid}/photos.
- Bổ sung: POST resident/tickets/{tid}/additions {content}. Đánh giá: POST resident/tickets/{tid}/rating {score:1..5}; không tags/comment ngoài contract.
- Nhận việc: POST mo/tickets/{tid}/accept; trả sai phòng: POST mo/tickets/{tid}/return {note} bắt buộc theo engine; không chuyển dept tại client.
- Checklist: POST mo/tickets/{tid}/checklist/{template_item_id} {status,note?} dùng enum/model Python hiện có và template từ Case, không tự dựng IDs.
- Vật tư: POST mo/tickets/{tid}/material-usage {lines:[{item_code,used_qty}]} một request, mapping catalog.material_codes_by_department; guard và stock do backend plan16.
- Ghi chú: POST mo/tickets/{tid}/evidence {requirement_id,evidence_type,content_or_metadata,readability_status}; chọn requirement/type từ Case như app hiện tại, không note hợp lệ giả.
- Ảnh xử lý: multipart files mo/tickets/{tid}/photos. Báo xong: POST mo/tickets/{tid}/complete; 200 vẫn có thể IN_PROGRESS/failing_items, cấm báo hoàn tất chỉ vì HTTP200.
- BQL: POST bql/tickets/{tid}/close {note?}; /rework {note}; /cancel {cancel_reason}; /emergency/close {note} (bắt buộc theo engine hiện có); /emergency/downgrade {note}. Quyết định an toàn B2 dùng /mo/.../safety {decision,note} đúng quyền backend/owner.
- BPTN: POST mo/tickets/{tid}/bptn-resolve body BptnResolveRequest theo đúng blocker; /safety {decision,note}; /priority {priority,note}. Không gửi transition generic để ép route.
- Kho: GET mo/warehouse/stock; POST mo/warehouse/stock/{item_code} {qty}. Null qty = chưa biết tồn; không ép0.

## §U2. Chuyển các controls không tương thích
Giữ skin/nav/card/modal/mobile spacing, nhưng chỉ hiển thị các nút đúng C2/quyền và trạng thái Python.
Bỏ confirm-route mặc định cho ticket ROUTED: inbox BPTN theo blocker_owner_role/BPTN-reasons hiện có; ROUTED là đã giao, không đợi click portal.
Bỏ chọn staff/tạm dừng SLA tự đặt vì Python không có API hỗ trợ; thay bằng nhận việc, checklist, vật tư, ảnh, note/báo xong.
Bỏ cư dân hủy/nghiệm thu/reject: Python chỉ cho bổ sung/ảnh/rating theo allowed_actions; nghiệm thu/hủy do BQL.
Bỏ tạo mã vật tư mới và phê duyệt yêu cầu vật tư tự do của portal: catalog Python quản lý; Kho xem tồn/nhập mã có sẵn. Không tạo shadow material requests.
Thông báo/keywords DB portal không dùng làm data thật; section không có API không render demo data. Thiết kế không mất phần layout chính; screenshot baseline so trước/sau mọi vai.

## §U3. Luật và lỗi
Khẩn cấp/safety/trùng/thiếu thông tin giữ engine; UI không gọi LLM trực tiếp, không ép flags/priority.
Pending chỉ cho request đang gửi; error giữ draft selections/note, không auto refresh xoá input sau30s; server action refresh chỉ khi response thực sự thành công nghiệp vụ.
Disabled khi đang gửi/offline; mapping/API thiếu không fallback oldDB.
401 login;403 giữ input báo quyền;409/422 hiển thị lỗi cụ thể/failing_items;timeout trạng thái chưa xác định cần reload trước retry, không tạo ticket lại.

## §U4. Số đo
E2E tạo ở web → thấy cùngtid/status trên app và Python; tạo ở app → web thấy. Ticket đã ROUTED không vào inbox BPTN; PENDING_REVIEW vẫn cần BPTN. Material qty4 norm1 save1POST, repeat delta0, shortage rollback. Mọi endpoint UI dùng đúng token/field/role.

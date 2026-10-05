# Evaluation Evidence — MaintenanceOps (kiểm thử thủ công)

Người thực hiện: Cao Văn Trường · Ngày chạy: 2026-10-04 (22:25 → 23:33, Asia/Saigon)
Ảnh bằng chứng: [planning/07_2026-10-04_online-acceptance/evidence/ui/](planning/07_2026-10-04_online-acceptance/evidence/ui/)

## 1. Môi trường đo

| Hạng mục | Giá trị |
|---|---|
| Địa chỉ | `http://localhost:8000` (uvicorn, chạy trên máy cá nhân), giao diện `/ui/`, Swagger `/docs` |
| Loại | **Localhost, KHÔNG phải online** |
| LLM | `LLM_MODE=mock` (chỉ luật cố định; không đo chất lượng LLM thật) |
| Lưu trữ | `MO_STORE=memory` (restart mất dữ liệu) |
| Dữ liệu | Fixture mô phỏng `SIM-*`; tài khoản demo `cudan01`, `bptn01`, `vesinh01`, `kythuat01`, `bql01` |
| Cách thao tác | Ca H01, I01, U01, S04 bằng giao diện web; ca G03 bằng Swagger (UI ẩn nút sai quyền nên không bấm sai được) |

## 2. Tổng hợp

| # | Ca | Nhóm | Kết quả | Ticket |
|---|---|---|---|---|
| 1 | H01 — Happy path vệ sinh | Luồng chính | **PASS** | SIM-TKT-0001 |
| 2 | I01 — Thiếu thông tin | Thiếu dữ liệu | **PASS** | SIM-TKT-0003 |
| 3 | U01 — Phản ánh trùng | Trùng | **PASS** | SIM-TKT-0005 (trùng 0004) |
| 4 | S04 — Khẩn cấp Bậc 1, BQL đóng | An toàn | **PASS** | SIM-TKT-0006 |
| 5 | G03 — Sai quyền bị từ chối | Guard | **PASS** | SIM-TKT-TEC-005 |

5/5 PASS, 0 FAIL, 0 BLOCKED. Đây là tổng cho **5 ca đã chạy**, không phải toàn bộ ma trận nghiệm thu (xem mục 4).

---

## 3. Chi tiết từng ca

### TC-01 · H01 — Happy path vệ sinh
- **Mục tiêu:** cư dân gửi → giao đúng phòng ban → phòng ban xử lý → BQL nghiệm thu đóng → cư dân thấy timeline đúng.
- **Dữ liệu vào (cudan01):** `Hành lang tầng 3 tòa SIM-A có nhiều rác và vết bẩn, cần vệ sinh`
- **Expected:** `ROUTED` sang Phòng Vệ sinh; qua `Đang xử lý` → `Chờ nghiệm thu` → `Hoàn thành`; có audit.
- **Output thực tế:**
  - Ticket `SIM-TKT-0001`, gửi 22:25 4/10/26. Giao `Phòng Vệ sinh` (DEP-CLN, playbook `PB-CLN-01`). Agent: độ tin cậy 95%, lý do "Nội dung khớp phản ánh vệ sinh khu vực chung". Vị trí nhận diện: Tòa SIM-A / Tầng 3 / Hành lang. Kiểm tra trùng: "Độc lập".
  - Lịch sử trạng thái (5 mục): `Đã tiếp nhận` 22:25 → `Đã chuyển phòng ban` 22:25 (cờ "Ngoài giờ phòng ban", "Phản ánh sẽ được xử lý từ 06:00 05/10/2026") → `Đang xử lý` 22:29 (Phòng ban) → `Chờ nghiệm thu` 22:29 (ghi chú "Đối soát đạt") → `Hoàn thành` 22:32 (BQL).
  - Nhật ký kiểm toán: 16 sự kiện.
  - Timeline phía cư dân: đủ 6 mốc, trạng thái cuối "Hoàn thành — Phản ánh đã hoàn thành."
- **Kết quả:** PASS.
- **Bằng chứng:** [H01_01](planning/07_2026-10-04_online-acceptance/evidence/ui/H01_01_cudan01_gui-phan-anh.png), [H01_02](planning/07_2026-10-04_online-acceptance/evidence/ui/H01_02_vesinh01_nhan-ticket.png), [H01_03](planning/07_2026-10-04_online-acceptance/evidence/ui/H01_03_vesinh01_checklist-anh.png), [H01_04](planning/07_2026-10-04_online-acceptance/evidence/ui/H01_04_vesinh01_bao-hoan-thanh.png), [H01_05](planning/07_2026-10-04_online-acceptance/evidence/ui/H01_05_bql01_nghiem-thu-dong.png), [H01_06](planning/07_2026-10-04_online-acceptance/evidence/ui/H01_06_cudan01_timeline-cuoi.png)

### TC-02 · I01 — Thiếu thông tin
- **Mục tiêu:** ticket thiếu địa điểm dừng ở chờ bổ sung; BPTN bổ sung đủ thì đi tiếp; nội dung gốc giữ nguyên.
- **Dữ liệu vào (cudan01):** `Hanh lang tang 3 nhieu rac` (không dấu, không nêu tòa)
- **Expected:** trạng thái thiếu thông tin → sau bổ sung đi tiếp `ROUTED`; raw không bị sửa.
- **Output thực tế:**
  - Ticket `SIM-TKT-0003`, gửi 23:01. Trạng thái "Chờ bổ sung thông tin", Phòng ban "Chưa giao". Thông báo cho cư dân (nguyên văn): "Ban tiếp nhận thông tin sẽ liên hệ bạn để bổ sung: tòa (ghi kèm chữ "tòa", ví dụ: tòa SIM-A). Bạn cũng có thể bổ sung ngay tại đây."
  - BPTN bổ sung (23:03), sau đó ticket "Đã chuyển phòng ban", Phòng Vệ sinh. Vị trí hiển thị "Tòa SIM-A tầng 3". Mục "THÔNG TIN BỔ SUNG": "Hành lang có nhiều rác và vết bẩn".
  - Nội dung gốc vẫn là `Hanh lang tang 3 nhieu rac` (nhãn "KHÔNG THỂ SỬA").
  - Phía phòng ban: ticket vào hàng đợi `Ngoài giờ phòng ban`, "Chạy lại từ: Bước 8".
- **Kết quả:** PASS.
- **Bằng chứng:** [I01_01](planning/07_2026-10-04_online-acceptance/evidence/ui/I01_01_cudan01_thieu-thong-tin.png), [I01_02](planning/07_2026-10-04_online-acceptance/evidence/ui/I01_02_bptn01_hang-cho.png), [I01_03](planning/07_2026-10-04_online-acceptance/evidence/ui/I01_03_bptn01_gui-bo-sung.png), [I01_04](planning/07_2026-10-04_online-acceptance/evidence/ui/I01_04_ket-qua.png)

### TC-03 · U01 — Phản ánh trùng
- **Mục tiêu:** phản ánh trùng bị giữ lại cho BPTN quyết định; nhánh "không gộp" cho ticket đi tiếp.
- **Dữ liệu vào (cudan01):** `Hành lang tầng 3 tòa SIM-A có nhiều rác và vết bẩn, cần vệ sinh.` gửi hai lần (23:08).
- **Expected:** ticket thứ hai `VERIFYING` / nghi trùng, chưa giao phòng ban; BPTN chọn "Không trùng" → đi tiếp.
- **Output thực tế:**
  - Cư dân thấy: "Đang kiểm tra phản ánh có trùng với phản ánh khác không.", Phòng ban "Chưa giao".
  - BPTN thấy `SIM-TKT-0005`: "Đang dừng: Nghi trùng", người gỡ BPTN, chạy lại từ Bước 5, ghi chú nội bộ "Cùng vị trí và loại với SIM-TKT-0004 trong 2 days, 0:00:00". Hai nút: **Gộp vào SIM-TKT-0004** và **Không trùng, xử lý tiếp**.
  - Sau khi bấm "Không trùng, xử lý tiếp": `SIM-TKT-0005` ở trạng thái "Đã chuyển phòng ban" (Phòng Vệ sinh), cờ "Ngoài giờ phòng ban".
- **Kết quả:** PASS.
- **Bằng chứng:** [U01_01](planning/07_2026-10-04_online-acceptance/evidence/ui/U01_01_cudan01_nghi-trung.png), [U01_02](planning/07_2026-10-04_online-acceptance/evidence/ui/U01_02_bptn01_canh-bao-trung.png), [U01_03](planning/07_2026-10-04_online-acceptance/evidence/ui/U01_03_bptn01_khong-gop.png), [U01_04](planning/07_2026-10-04_online-acceptance/evidence/ui/U01_04_ket-qua.png)

### TC-04 · S04 — Khẩn cấp Bậc 1, BQL đóng
- **Mục tiêu:** phản ánh có dấu hiệu nguy hiểm dừng chờ BQL, không giao phòng ban; BQL đóng khẩn cấp có ghi chú và audit.
- **Dữ liệu vào (cudan01):** `Đèn sảnh thang máy tầng 5 tòa SIM-A không sáng, có tia lửa và mùi khét ở hộp đèn.`
- **Expected:** `VERIFYING` / `EMERGENCY_PENDING_BQL`, BQL thấy đúng 2 lựa chọn; đóng → `CLOSED`.
- **Output thực tế:**
  - Ticket `SIM-TKT-0006`, gửi 23:15. Cư dân thấy "Phản ánh đang được kiểm tra.", Phòng ban "Chưa giao" (không lộ chữ "Bậc 1" hay mã nội bộ).
  - BQL lọc "Chỉ sự cố Khẩn cấp (Bậc 1)": thấy khung "SỰ CỐ KHẨN CẤP BẬC 1 (Chờ BQL can thiệp)" với **đúng 2 lựa chọn**: "Đã xử lý tại chỗ, đóng ticket" (nút **Đã xử lý, đóng khẩn cấp**) và "Báo nhầm, hạ xuống BPTN" (nút **Hạ mức xuống BPTN**). Cả hai bắt buộc ghi chú.
  - BQL đóng, ghi chú "Đã ngắt điện hộp đèn và kiểm tra an toàn tại chỗ". Lịch sử: `Hoàn thành` 23:18, BQL. Cư dân thấy "Hoàn thành" 23:18 và có form đánh giá "1 lần duy nhất".
  - Danh sách BQL sau đó: ticket khẩn cấp còn lại (`SIM-TKT-TEC-005`) vẫn "Đang xác minh", không bị ảnh hưởng.
- **Kết quả:** PASS.
- **Bằng chứng:** [S04_01](planning/07_2026-10-04_online-acceptance/evidence/ui/S04_01_cudan01_trang-thai.png), [S04_02](planning/07_2026-10-04_online-acceptance/evidence/ui/S04_02_bql01_lua-chon.png), [S04_03](planning/07_2026-10-04_online-acceptance/evidence/ui/S04_03_bql01_ket-qua.png), [S04_04](planning/07_2026-10-04_online-acceptance/evidence/ui/S04_04_bql01_audit.png)

### TC-05 · G03 — Sai quyền bị từ chối
- **Mục tiêu:** vai không có quyền bị backend từ chối và trạng thái ticket không đổi.
- **Cách làm:** Swagger `/docs`, hai lệnh phủ định trên ticket khẩn cấp `SIM-TKT-TEC-005`.
- **Output thực tế:**

| Bước | Lệnh | HTTP | Nội dung phản hồi chính |
|---|---|---|---|
| 1 | `bptn01`: `POST /api/v1/bql/tickets/SIM-TKT-TEC-005/emergency/downgrade` `{"note":"thu quyen"}` | **403** | `code: ACTION_DENIED`, message "BPTN không được EMERGENCY_DOWNGRADE", `actor_role: BPTN`, `audit_event_id: SIM-AUD-TEC-005-0003`, `unchanged_status: VERIFYING` |
| 2 | `vesinh01`: `POST /api/v1/mo/tickets/SIM-TKT-TEC-005/accept` | **403** | `code: ACTION_DENIED`, message "Ticket không thuộc phòng ban của SIM-ACTOR-DEPT-CLN-01", `actor_role: DEPARTMENT`, `audit_event_id: SIM-AUD-TEC-005-0004` |

- **Trạng thái sau thử:** phản hồi bước 1 ghi `unchanged_status: VERIFYING`; danh sách BQL sau đó vẫn hiện `SIM-TKT-TEC-005` ở "Đang xác minh" (Khẩn cấp Bậc 1).
- **Kết quả:** PASS. Cả hai lần đều có audit event.
- **Bằng chứng:** [G03_01](planning/07_2026-10-04_online-acceptance/evidence/ui/G03_01_bptn-ha-bac1-403.png), [G03_02](planning/07_2026-10-04_online-acceptance/evidence/ui/G03_02_phong-sai-accept-403.png), [G03_03](planning/07_2026-10-04_online-acceptance/evidence/ui/G03_03_khong-thay-doi.png)

---

## 4. Truy vết ca kiểm thử ↔ tính năng

| Ca | Tính năng kiểm | Quy tắc tham chiếu |
|---|---|---|
| TC-01 H01 | Giao đúng phòng ban, vòng đời ticket, timeline cư dân, audit | [CR-BPTN-03](docs/CR-BPTN-03.md) §4–5 |
| TC-02 I01 | Chặn thiếu thông tin, BPTN bổ sung, giữ nội dung gốc | CR-BPTN-03 (BPTN `NEED_INFO`/`MISSING_INFO`) |
| TC-03 U01 | Phát hiện trùng, BPTN quyết gộp / không gộp | CR-BPTN-03 (quy tắc trùng) |
| TC-04 S04 | Tầng an toàn Bậc 1, BQL đóng khẩn cấp | CR-BPTN-03 §6.2, §6.5 |
| TC-05 G03 | Phân quyền theo vai (`ACTION_DENIED` 403) | CR-BPTN-03 (phân quyền) |

## 5. Giới hạn và phần chưa làm (ghi trung thực)

- **Phạm vi:** mới 5 ca. Kế hoạch Day04 còn các ca chưa chạy bằng UI: H02 (đèn, đã chụp ảnh nhưng chưa đưa vào đây), S01/S02/S03/S05 (Bậc 2 và hạ mức), M01 (vật tư), G01 (rating lần hai), G02 (đóng sớm), R01 (persistence sau restart).
- **Môi trường:** localhost, dữ liệu giả, LLM mock → không đo chất lượng phân loại LLM thật; `Độ tin cậy 95%` ở giao diện là từ luật cố định, không phải số đo mô hình.
- **Lưu trữ:** store memory, nên chưa chứng minh dữ liệu còn sau restart.
- **Chưa có:** RAGAS/metric LLM, đo thời gian phản hồi, phản hồi người dùng thật, bản online (Live URL chưa có).

## 6. Quan sát phụ (ghi nhận khi chạy, chưa sửa)

1. **Ngoài giờ phòng ban:** ticket gửi sau 22:00 hiển thị "Phản ánh sẽ được xử lý từ 06:00 05/10/2026" nhưng phòng ban vẫn nhận việc và hoàn tất lúc 22:29 (H01). Cần xác nhận đây là thiết kế (cờ chỉ cảnh báo) hay lỗi.
2. **Chữ "Agent" ở form cư dân:** "Ghi rõ tình trạng thực tế để Agent phân loại chính xác." — thuật ngữ nội bộ.
3. **Mâu thuẫn chữ trong U01:** thẻ Agent ghi "Cùng vị trí và vấn đề trong vòng 4h", ghi chú nội bộ ghi "trong 2 days, 0:00:00".
4. **S04 — bằng chứng audit:** ảnh [S04_02](planning/07_2026-10-04_online-acceptance/evidence/ui/S04_02_bql01_lua-chon.png) và [S04_04](planning/07_2026-10-04_online-acceptance/evidence/ui/S04_04_bql01_audit.png) đang hiển thị ticket mẫu `SIM-TKT-CLN-004` (cùng thao tác đóng khẩn cấp, 23:18), không phải `SIM-TKT-0006`. Việc đóng `SIM-TKT-0006` được xác nhận qua timeline cư dân (Hoàn thành 23:18) và danh sách BQL. Nên chụp thêm tab "Nhật ký kiểm toán" của `SIM-TKT-0006`.
5. **G03 — bằng chứng "không đổi":** [G03_03](planning/07_2026-10-04_online-acceptance/evidence/ui/G03_03_khong-thay-doi.png) chỉ chụp phần cuối phản hồi và schema, chưa phải `GET` ticket sau thử. Nên chụp thêm `GET` của `SIM-TKT-TEC-005`.
6. **Bảo mật khi nộp:** ảnh G03 có chứa token đăng nhập demo cục bộ. Nên che hoặc chụp lại trước khi đẩy lên repo công khai.

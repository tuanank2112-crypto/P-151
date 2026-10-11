# Ảnh giao diện portal — toàn bộ màn hình sau kiểm thử

Chỉ portal mới (Next.js gọi backend `/api/v1`), không có UI cũ `src/web`. Chụp 2026-10-11 sau khi bỏ gán từng nhân viên và bỏ khối tài khoản demo ở trang đăng nhập, trên backend memory + LLM mock (dữ liệu mô phỏng `SIM-`, không phải Supabase). Trước khi chụp, 3 bộ kiểm đều exit 0: WP3 54/54, WP4 14/14, WP5 72/72. Ảnh do script chụp, không sửa tay.

Mở bằng **Ctrl+Shift+V** (Markdown preview): mọi ảnh hiện ngay trong trang, không cần bấm.

## Tổng quan — 40 màn trên một trang

### Đăng nhập

<table>
<tr><td valign="top" width="25%"><b>1.</b> Trang đăng nhập<br><img src="0-login/01-login-desktop.png" width="230"></td></tr>
</table>

### Cư dân (`cudan`)

<table>
<tr><td valign="top" width="25%"><b>1.</b> Form gửi phản ánh, chưa điền<br><img src="1-resident/01-resident-compose-empty-desktop.png" width="230"></td><td valign="top" width="25%"><b>2.</b> Form đã điền tiêu đề, nội dung, nơi, ảnh<br><img src="1-resident/02-resident-compose-filled-desktop.png" width="230"></td><td valign="top" width="25%"><b>3.</b> Gửi thành công<br><img src="1-resident/03-resident-submitted-desktop.png" width="230"></td><td valign="top" width="25%"><b>4.</b> Phản ánh của tôi: ticket vừa gửi<br><img src="1-resident/04-resident-mine-new-desktop.png" width="230"></td></tr>
<tr><td valign="top" width="25%"><b>5.</b> Phản ánh của tôi: toàn bộ danh sách<br><img src="1-resident/05-resident-mine-list-desktop.png" width="230"></td></tr>
</table>

### Ban tiếp nhận (`tiepnhan`)

<table>
<tr><td valign="top" width="25%"><b>1.</b> Chờ phân loại — lúc mới vào<br><img src="2-reception/01-reception-step0-desktop.png" width="230"></td><td valign="top" width="25%"><b>2.</b> Chờ phân loại — trước khi chuyển phòng ban<br><img src="2-reception/02-reception-inbox-desktop.png" width="230"></td><td valign="top" width="25%"><b>3.</b> Chi tiết ticket chờ phân loại<br><img src="2-reception/03-reception-detail-modal-desktop.png" width="230"></td><td valign="top" width="25%"><b>4.</b> Sau khi chuyển phòng ban<br><img src="2-reception/04-reception-after-route-desktop.png" width="230"></td></tr>
<tr><td valign="top" width="25%"><b>5.</b> Đã phân loại<br><img src="2-reception/05-reception-done-desktop.png" width="230"></td><td valign="top" width="25%"><b>6.</b> Chi tiết ticket đã phân loại<br><img src="2-reception/06-reception-done-modal-desktop.png" width="230"></td><td valign="top" width="25%"><b>7.</b> Hiệu suất Agent<br><img src="2-reception/07-reception-perf-desktop.png" width="230"></td></tr>
</table>

### Phòng vệ sinh (`vesinh`)

<table>
<tr><td valign="top" width="25%"><b>1.</b> Hàng việc: chỉ còn Nhận việc / Không phải việc phòng mình<br><img src="3-cleaning/01-cleaning-queue-desktop.png" width="230"></td><td valign="top" width="25%"><b>2.</b> Chi tiết ticket<br><img src="3-cleaning/02-cleaning-detail-desktop.png" width="230"></td><td valign="top" width="25%"><b>3.</b> Trả về Tiếp nhận (bắt buộc lý do)<br><img src="3-cleaning/03-cleaning-return-modal-desktop.png" width="230"></td><td valign="top" width="25%"><b>4.</b> Ticket đang xử lý sau khi Nhận việc<br><img src="3-cleaning/04-cleaning-queue-inprogress-desktop.png" width="230"></td></tr>
<tr><td valign="top" width="25%"><b>5.</b> Form hoàn thành (ảnh bắt buộc + vật tư đã dùng)<br><img src="3-cleaning/05-cleaning-finish-modal-desktop.png" width="230"></td><td valign="top" width="25%"><b>6.</b> Lịch sử hoàn thành<br><img src="3-cleaning/06-cleaning-history-desktop.png" width="230"></td></tr>
</table>

### Phòng kỹ thuật (`kythuat`)

<table>
<tr><td valign="top" width="25%"><b>1.</b> Hàng việc kỹ thuật<br><img src="4-technical/01-technical-queue-desktop.png" width="230"></td><td valign="top" width="25%"><b>2.</b> Yêu cầu vật tư<br><img src="4-technical/02-technical-request-modal-desktop.png" width="230"></td><td valign="top" width="25%"><b>3.</b> Ticket chờ duyệt vật tư<br><img src="4-technical/03-technical-queue-after-request-desktop.png" width="230"></td><td valign="top" width="25%"><b>4.</b> Tab Yêu cầu vật tư<br><img src="4-technical/04-technical-materials-desktop.png" width="230"></td></tr>
<tr><td valign="top" width="25%"><b>5.</b> Form hoàn thành (tích đủ vật tư đã dùng)<br><img src="4-technical/05-technical-finish-modal-desktop.png" width="230"></td><td valign="top" width="25%"><b>6.</b> Lịch sử hoàn thành<br><img src="4-technical/06-technical-history-desktop.png" width="230"></td></tr>
</table>

### Ban quản lý (`quanly`)

<table>
<tr><td valign="top" width="25%"><b>1.</b> Tổng quan (5 ô bấm được, phụ tải VS/KT)<br><img src="5-management/01-mgmt-1-overview-desktop.png" width="230"></td><td valign="top" width="25%"><b>2.</b> Tất cả ticket<br><img src="5-management/02-mgmt-2-all-desktop.png" width="230"></td><td valign="top" width="25%"><b>3.</b> Chi tiết ticket (khối Agent thật)<br><img src="5-management/03-mgmt-3-modal-desktop.png" width="230"></td><td valign="top" width="25%"><b>4.</b> Việc của BQL: đã tiếp nhận<br><img src="5-management/04-mgmt-4-bql-accepted-desktop.png" width="230"></td></tr>
<tr><td valign="top" width="25%"><b>5.</b> Việc của BQL: chờ nghiệm thu, đã tích đủ tiêu chí<br><img src="5-management/05-mgmt-4-bql-inspection-ready-desktop.png" width="230"></td><td valign="top" width="25%"><b>6.</b> Việc của BQL: đã hoàn thành<br><img src="5-management/06-mgmt-4-bql-done-desktop.png" width="230"></td><td valign="top" width="25%"><b>7.</b> Việc của BQL: sau khi nghiệm thu<br><img src="5-management/07-mgmt-4-bql-done-after-actions-desktop.png" width="230"></td><td valign="top" width="25%"><b>8.</b> Việc của BQL: tất cả<br><img src="5-management/08-mgmt-4-bql-all-desktop.png" width="230"></td></tr>
<tr><td valign="top" width="25%"><b>9.</b> Hiệu suất phòng ban<br><img src="5-management/09-mgmt-5-teams-desktop.png" width="230"></td><td valign="top" width="25%"><b>10.</b> Kho (vào từ BQL): tồn kho<br><img src="5-management/10-mgmt-6-warehouse-from-bql-inventory-desktop.png" width="230"></td><td valign="top" width="25%"><b>11.</b> Kho (vào từ BQL): duyệt cấp<br><img src="5-management/11-mgmt-6-warehouse-from-bql-requests-desktop.png" width="230"></td></tr>
</table>

### Kho (`kho`)

<table>
<tr><td valign="top" width="25%"><b>1.</b> Tồn kho<br><img src="6-warehouse/01-wh-1-inventory-desktop.png" width="230"></td><td valign="top" width="25%"><b>2.</b> Thêm vật tư<br><img src="6-warehouse/02-wh-2-add-item-desktop.png" width="230"></td><td valign="top" width="25%"><b>3.</b> Nhập kho<br><img src="6-warehouse/03-wh-3-receive-desktop.png" width="230"></td><td valign="top" width="25%"><b>4.</b> Duyệt cấp yêu cầu vật tư<br><img src="6-warehouse/04-wh-4-requests-desktop.png" width="230"></td></tr>
</table>

---

# Chi tiết từng màn (desktop + mobile cạnh nhau)

## Đăng nhập

<table>
<tr><th>Desktop 1440 px</th><th>Mobile 390 px</th></tr>
<tr><td colspan="2"><b>1. Trang đăng nhập</b></td></tr>
<tr><td valign="top"><img src="0-login/01-login-desktop.png" width="760"></td><td valign="top"><img src="0-login/01-login-mobile.png" width="200"></td></tr>
</table>

## Cư dân (`cudan`)

<table>
<tr><th>Desktop 1440 px</th><th>Mobile 390 px</th></tr>
<tr><td colspan="2"><b>1. Form gửi phản ánh, chưa điền</b></td></tr>
<tr><td valign="top"><img src="1-resident/01-resident-compose-empty-desktop.png" width="760"></td><td valign="top"><img src="1-resident/01-resident-compose-empty-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>2. Form đã điền tiêu đề, nội dung, nơi, ảnh</b></td></tr>
<tr><td valign="top"><img src="1-resident/02-resident-compose-filled-desktop.png" width="760"></td><td valign="top"><img src="1-resident/02-resident-compose-filled-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>3. Gửi thành công</b></td></tr>
<tr><td valign="top"><img src="1-resident/03-resident-submitted-desktop.png" width="760"></td><td valign="top"><img src="1-resident/03-resident-submitted-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>4. Phản ánh của tôi: ticket vừa gửi</b></td></tr>
<tr><td valign="top"><img src="1-resident/04-resident-mine-new-desktop.png" width="760"></td><td valign="top"><img src="1-resident/04-resident-mine-new-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>5. Phản ánh của tôi: toàn bộ danh sách</b></td></tr>
<tr><td valign="top"><img src="1-resident/05-resident-mine-list-desktop.png" width="760"></td><td valign="top"><img src="1-resident/05-resident-mine-list-mobile.png" width="200"></td></tr>
</table>

## Ban tiếp nhận (`tiepnhan`)

<table>
<tr><th>Desktop 1440 px</th><th>Mobile 390 px</th></tr>
<tr><td colspan="2"><b>1. Chờ phân loại — lúc mới vào</b></td></tr>
<tr><td valign="top"><img src="2-reception/01-reception-step0-desktop.png" width="760"></td><td valign="top"><img src="2-reception/01-reception-step0-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>2. Chờ phân loại — trước khi chuyển phòng ban</b></td></tr>
<tr><td valign="top"><img src="2-reception/02-reception-inbox-desktop.png" width="760"></td><td valign="top"><img src="2-reception/02-reception-inbox-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>3. Chi tiết ticket chờ phân loại</b></td></tr>
<tr><td valign="top"><img src="2-reception/03-reception-detail-modal-desktop.png" width="760"></td><td valign="top"><img src="2-reception/03-reception-detail-modal-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>4. Sau khi chuyển phòng ban</b></td></tr>
<tr><td valign="top"><img src="2-reception/04-reception-after-route-desktop.png" width="760"></td><td valign="top"><img src="2-reception/04-reception-after-route-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>5. Đã phân loại</b></td></tr>
<tr><td valign="top"><img src="2-reception/05-reception-done-desktop.png" width="760"></td><td valign="top"><img src="2-reception/05-reception-done-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>6. Chi tiết ticket đã phân loại</b></td></tr>
<tr><td valign="top"><img src="2-reception/06-reception-done-modal-desktop.png" width="760"></td><td valign="top"><img src="2-reception/06-reception-done-modal-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>7. Hiệu suất Agent</b></td></tr>
<tr><td valign="top"><img src="2-reception/07-reception-perf-desktop.png" width="760"></td><td valign="top"><img src="2-reception/07-reception-perf-mobile.png" width="200"></td></tr>
</table>

## Phòng vệ sinh (`vesinh`)

<table>
<tr><th>Desktop 1440 px</th><th>Mobile 390 px</th></tr>
<tr><td colspan="2"><b>1. Hàng việc: chỉ còn Nhận việc / Không phải việc phòng mình</b></td></tr>
<tr><td valign="top"><img src="3-cleaning/01-cleaning-queue-desktop.png" width="760"></td><td valign="top"><img src="3-cleaning/01-cleaning-queue-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>2. Chi tiết ticket</b></td></tr>
<tr><td valign="top"><img src="3-cleaning/02-cleaning-detail-desktop.png" width="760"></td><td valign="top"><img src="3-cleaning/02-cleaning-detail-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>3. Trả về Tiếp nhận (bắt buộc lý do)</b></td></tr>
<tr><td valign="top"><img src="3-cleaning/03-cleaning-return-modal-desktop.png" width="760"></td><td valign="top"><img src="3-cleaning/03-cleaning-return-modal-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>4. Ticket đang xử lý sau khi Nhận việc</b></td></tr>
<tr><td valign="top"><img src="3-cleaning/04-cleaning-queue-inprogress-desktop.png" width="760"></td><td valign="top"><img src="3-cleaning/04-cleaning-queue-inprogress-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>5. Form hoàn thành (ảnh bắt buộc + vật tư đã dùng)</b></td></tr>
<tr><td valign="top"><img src="3-cleaning/05-cleaning-finish-modal-desktop.png" width="760"></td><td valign="top"><img src="3-cleaning/05-cleaning-finish-modal-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>6. Lịch sử hoàn thành</b></td></tr>
<tr><td valign="top"><img src="3-cleaning/06-cleaning-history-desktop.png" width="760"></td><td valign="top"><img src="3-cleaning/06-cleaning-history-mobile.png" width="200"></td></tr>
</table>

## Phòng kỹ thuật (`kythuat`)

<table>
<tr><th>Desktop 1440 px</th><th>Mobile 390 px</th></tr>
<tr><td colspan="2"><b>1. Hàng việc kỹ thuật</b></td></tr>
<tr><td valign="top"><img src="4-technical/01-technical-queue-desktop.png" width="760"></td><td valign="top"><img src="4-technical/01-technical-queue-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>2. Yêu cầu vật tư</b></td></tr>
<tr><td valign="top"><img src="4-technical/02-technical-request-modal-desktop.png" width="760"></td><td valign="top"><img src="4-technical/02-technical-request-modal-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>3. Ticket chờ duyệt vật tư</b></td></tr>
<tr><td valign="top"><img src="4-technical/03-technical-queue-after-request-desktop.png" width="760"></td><td valign="top"><img src="4-technical/03-technical-queue-after-request-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>4. Tab Yêu cầu vật tư</b></td></tr>
<tr><td valign="top"><img src="4-technical/04-technical-materials-desktop.png" width="760"></td><td valign="top"><img src="4-technical/04-technical-materials-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>5. Form hoàn thành (tích đủ vật tư đã dùng)</b></td></tr>
<tr><td valign="top"><img src="4-technical/05-technical-finish-modal-desktop.png" width="760"></td><td valign="top"><img src="4-technical/05-technical-finish-modal-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>6. Lịch sử hoàn thành</b></td></tr>
<tr><td valign="top"><img src="4-technical/06-technical-history-desktop.png" width="760"></td><td valign="top"><img src="4-technical/06-technical-history-mobile.png" width="200"></td></tr>
</table>

## Ban quản lý (`quanly`)

<table>
<tr><th>Desktop 1440 px</th><th>Mobile 390 px</th></tr>
<tr><td colspan="2"><b>1. Tổng quan (5 ô bấm được, phụ tải VS/KT)</b></td></tr>
<tr><td valign="top"><img src="5-management/01-mgmt-1-overview-desktop.png" width="760"></td><td valign="top"><img src="5-management/01-mgmt-1-overview-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>2. Tất cả ticket</b></td></tr>
<tr><td valign="top"><img src="5-management/02-mgmt-2-all-desktop.png" width="760"></td><td valign="top"><img src="5-management/02-mgmt-2-all-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>3. Chi tiết ticket (khối Agent thật)</b></td></tr>
<tr><td valign="top"><img src="5-management/03-mgmt-3-modal-desktop.png" width="760"></td><td valign="top"><img src="5-management/03-mgmt-3-modal-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>4. Việc của BQL: đã tiếp nhận</b></td></tr>
<tr><td valign="top"><img src="5-management/04-mgmt-4-bql-accepted-desktop.png" width="760"></td><td valign="top"><img src="5-management/04-mgmt-4-bql-accepted-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>5. Việc của BQL: chờ nghiệm thu, đã tích đủ tiêu chí</b></td></tr>
<tr><td valign="top"><img src="5-management/05-mgmt-4-bql-inspection-ready-desktop.png" width="760"></td><td valign="top"><i>(không chụp khổ mobile)</i></td></tr>
<tr><td colspan="2"><b>6. Việc của BQL: đã hoàn thành</b></td></tr>
<tr><td valign="top"><img src="5-management/06-mgmt-4-bql-done-desktop.png" width="760"></td><td valign="top"><img src="5-management/06-mgmt-4-bql-done-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>7. Việc của BQL: sau khi nghiệm thu</b></td></tr>
<tr><td valign="top"><img src="5-management/07-mgmt-4-bql-done-after-actions-desktop.png" width="760"></td><td valign="top"><i>(không chụp khổ mobile)</i></td></tr>
<tr><td colspan="2"><b>8. Việc của BQL: tất cả</b></td></tr>
<tr><td valign="top"><img src="5-management/08-mgmt-4-bql-all-desktop.png" width="760"></td><td valign="top"><img src="5-management/08-mgmt-4-bql-all-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>9. Hiệu suất phòng ban</b></td></tr>
<tr><td valign="top"><img src="5-management/09-mgmt-5-teams-desktop.png" width="760"></td><td valign="top"><img src="5-management/09-mgmt-5-teams-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>10. Kho (vào từ BQL): tồn kho</b></td></tr>
<tr><td valign="top"><img src="5-management/10-mgmt-6-warehouse-from-bql-inventory-desktop.png" width="760"></td><td valign="top"><img src="5-management/10-mgmt-6-warehouse-from-bql-inventory-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>11. Kho (vào từ BQL): duyệt cấp</b></td></tr>
<tr><td valign="top"><img src="5-management/11-mgmt-6-warehouse-from-bql-requests-desktop.png" width="760"></td><td valign="top"><img src="5-management/11-mgmt-6-warehouse-from-bql-requests-mobile.png" width="200"></td></tr>
</table>

## Kho (`kho`)

<table>
<tr><th>Desktop 1440 px</th><th>Mobile 390 px</th></tr>
<tr><td colspan="2"><b>1. Tồn kho</b></td></tr>
<tr><td valign="top"><img src="6-warehouse/01-wh-1-inventory-desktop.png" width="760"></td><td valign="top"><img src="6-warehouse/01-wh-1-inventory-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>2. Thêm vật tư</b></td></tr>
<tr><td valign="top"><img src="6-warehouse/02-wh-2-add-item-desktop.png" width="760"></td><td valign="top"><img src="6-warehouse/02-wh-2-add-item-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>3. Nhập kho</b></td></tr>
<tr><td valign="top"><img src="6-warehouse/03-wh-3-receive-desktop.png" width="760"></td><td valign="top"><img src="6-warehouse/03-wh-3-receive-mobile.png" width="200"></td></tr>
<tr><td colspan="2"><b>4. Duyệt cấp yêu cầu vật tư</b></td></tr>
<tr><td valign="top"><img src="6-warehouse/04-wh-4-requests-desktop.png" width="760"></td><td valign="top"><img src="6-warehouse/04-wh-4-requests-mobile.png" width="200"></td></tr>
</table>

# SPEC-P04 — Giao diện app theo thiết kế `portal/` (backend vẫn là FastAPI gốc)

Yêu cầu người dùng (2026-10-09): "lấy backend từ folder gốc hiện đang ở port 8000 ở docker để sử dụng cho viết app,
tuy nhiên hãy dùng ui trong folder portal để có thể gen ra UI của app". Đọc kèm plan.md Q19–Q25.

## §1. Phạm vi
- CHỈ đổi lớp hiển thị của `src/mobile/` (`index.html`, `app.css`, `js/main.js`, `js/ui.js`, `js/photo.js`, `js/resident.js`, `js/bql.js`, `sw.js`).
- KHÔNG đổi: `js/api.js` (chữ ký 01-CONTRACTS §4), danh sách endpoint (01-CONTRACTS §5–§6), bảng lỗi (§7), bất biến I-1..I-8.
- Nguồn thiết kế (CHỈ ĐỌC): `portal/src/app/globals.css`, `portal/src/components/{shell,icons,photo-strip,toast}.tsx`,
  `portal/src/app/login/*`, `portal/src/app/resident/resident-app.tsx`, `portal/src/app/management/management-app.tsx`.

## §2. Cách "gen" UI từ portal (BẮT BUỘC)
| Phần portal | Cách đưa sang app |
|---|---|
| Class CSS thuần trong `globals.css` (`.tile .card .pill .dot .btn .hdr-btn .bell .badge .thumbs .toast`, khối `.scr-login`, `.scr-resident`, `.scr-management`) | Chép NGUYÊN giá trị vào `app.css`, giữ tên class và phạm vi `.scr-*`. CẤM thay màu bằng màu "gần giống" |
| Tiện ích Tailwind trong TSX (`flex gap-5 p-6 text-[28px]…`) | Viết lại thành class ngữ nghĩa trong `app.css` (vd `.page-head`, `.sec-head`, `.info-grid`) với đúng số đo px của TSX |
| Icon (`icons.tsx`) | Chép path SVG nguyên văn vào `ICONS` của `ui.js` (stroke, `currentColor`) |
| `Header`, `NavTiles`, `PageHead`, `Body` (`shell.tsx`) | Hàm JS cùng tên trong `ui.js`, cùng cấu trúc DOM + class; bản điện thoại thu nhỏ header theo §3 |
| Font Be Vietnam Pro | Giữ link Google Fonts sẵn có trong `index.html` |

## §3. Khung màn (mọi vai sau đăng nhập)
`#topbar` = Header gradient `linear-gradient(120deg,#9CCBFF 0%,#5E9BFF 100%)`: avatar chữ tắt (2 chữ cái đầu tên) · "Xin chào," · tên ·
pill vai · chuông (số = số việc cần người dùng) · nút "Đăng xuất". Điện thoại (≤600 px): padding `20px 16px 96px`, avatar 56 px, tên 24 px.
`#tabbar` = NavTiles (`nav.card` + `.tile`) nằm TRÊN nội dung, kéo lên `-80px` đè header (như `Body`). Bỏ thanh tab dưới đáy và nút FAB cũ.
| Vai | Tile | Hash |
|---|---|---|
| RESIDENT | "Gửi phản ánh" (`id="new-ticket"`, icon pen) · "Phản ánh của tôi" (icon clipboard, `.cnt` = số ticket chưa kết thúc) | `#/r/new` · `#/r` |
| BQL | "Cần tôi" (briefcase) · "Khẩn cấp" (warning) · "Tất cả" (table); `.cnt` = số dòng từng lọc | `#/b` + lọc |
Tên hiển thị: `display_name` bỏ tiền tố vai ("Cư dân ", "Ban Quản lý ") và phần `(...)`; phần trong ngoặc của cư dân ⇒ pill `Cư dân · Căn hộ <...>`.
BQL ⇒ pill "Ban quản lý". Trang chi tiết có link "‹ Quay lại" trên PageHead.

## §4. Màn Cư dân (thay SPEC-P02 §1–§3 về bố cục; luật nút giữ nguyên SPEC-P02 §4)
**`#/r/new` (`.scr-resident`)** — PageHead "Gửi phản ánh mới" + 3 thẻ `section.card` đánh số `.num` + thẻ "Tóm tắt":
1. **Mô tả vấn đề**: `textarea#new-description.field` (maxlength 2000), chip "Câu mẫu" (`.chip.sm`) điền sẵn câu thuộc phạm vi vệ sinh/chiếu sáng khu vực chung.
2. **Vị trí sự cố (không bắt buộc)**: chip tòa (`S1`, `S2` = `catalog.yaml site.buildings`), ô "Tầng" (`input#loc-floor`, ≤4 ký tự),
   4 thẻ `.place` (icon portal): Hành lang · Sảnh thang máy · Cầu thang bộ · Phòng rác. Bấm lại thẻ đang chọn ⇒ bỏ chọn.
   Khi gửi: nếu chọn ít nhất 1 phần ⇒ nối vào mô tả MỘT dòng `\nVị trí: <Tòa S1> / <Tầng 3> / <Hành lang>` (chỉ các phần đã chọn, nối bằng ` / `).
   Đây là định dạng `location_normalized` của catalog; API vẫn chỉ nhận `original_description` (I-1 giữ nguyên).
3. **Ảnh hiện trường**: `photoPicker` (nút "Chụp ảnh"/"Chọn ảnh" trong khung `.drop`, ô xem trước `.ph.thumb` trong `.photos`).
**Tóm tắt** (`aside.card`): VỊ TRÍ (chuỗi §4.2 hoặc "Theo mô tả"), ẢNH (số ảnh), checklist `.chk` "Mô tả ít nhất 10 ký tự" (chặn gửi) và
"Có tòa và tầng" (chỉ gợi ý, KHÔNG chặn — Agent hỏi lại qua NEED_INFO), lỗi form, nút `#submit-ticket.btn.primary.big`.

**`#/r` (`#resident-list`)** — PageHead "Phản ánh của tôi" + nút "Tải lại"; 4 ô tổng quan `.ov` lọc nhanh + hàng chip lọc:
| Lọc | Điều kiện trên `ResidentTicketView` |
|---|---|
| Đang xử lý | `status` ∉ TERMINAL và ≠ `READY_FOR_REVIEW` |
| Chờ nghiệm thu | `status = READY_FOR_REVIEW` (BQL nghiệm thu, cư dân chỉ xem) |
| Cần bạn | `allowed_actions` khác rỗng (`ADD_INFO`/`RATE`) |
| Đã xong | `status` ∈ TERMINAL |
Thẻ `a.titem[data-ticket]`: `.idb` mã · pill trạng thái · mô tả (2 dòng) · 6 vạch `.seg` · "Bước n/6 · <nhãn sự kiện mới nhất> · <giờ>" · `.pill.need`.

**Ánh xạ trạng thái → bước** (`STAGES` portal: Tiếp nhận, Thẩm định, Phân công, Đang xử lý, Nghiệm thu, Hoàn tất):
`RECEIVED`1 · `VERIFYING`/`NEED_INFO`/`ON_HOLD` 2 (hai cái sau = tạm dừng `.pause`) · `ROUTED`3 · `IN_PROGRESS`4 · `READY_FOR_REVIEW`5 · `CLOSED`6;
`CANCELLED`/`MERGED` ⇒ không tô bước. Pill: TERMINAL hủy/gộp `s-cancel`, `NEED_INFO`/`ON_HOLD` `s-pause`, `READY_FOR_REVIEW` `s-wait`,
`CLOSED` `s-done`, còn lại `s-run`. Nhãn pill LUÔN là `status_label` của server (nhãn trung tính an toàn, CR-03 §13).

**`#/r/<id>` (`#resident-detail`)** — một `section.card`: `.idb` + giờ gửi + pill (pill ĐẦU TIÊN trong `#resident-detail`) · mô tả (h2) ·
`#public-message` (vàng khi `NEED_INFO`/`ON_HOLD`, xám khi TERMINAL hủy/gộp, xanh nhạt còn lại) · stepper `.sd/.sl/.slab` (`#resident-steps`, cuộn ngang) ·
lưới thông tin (Phòng ban tiếp nhận, Dự kiến xong, Trạng thái) · `#resident-actions` (bổ sung `#addition-text`, thêm ảnh `#add-photos`,
đánh giá `#rating` với `.star[data-score]`) · ảnh đã gửi · "THÔNG TIN BỔ SUNG TỪ BẠN" · liên kết gộp/tách · "Lịch sử xử lý" (`.hd`, mới nhất trên).

## §5. Màn BQL (`.scr-management`; luật nút giữ SPEC-P03 §3)
`#/b`: 4 ô số (`.card`): Cần BQL · Khẩn cấp · Quá hạn · Tổng; `#bql-tabs` = NavTiles (`button[data-tab]`); `#bql-list` = thẻ `a.card.bitem[data-ticket]`:
mã đậm · giờ · pill phòng ban `cat-ve_sinh|cat-ky_thuat|cat-none` · pill trạng thái `st-*` (khẩn cấp ⇒ `.pill.urgent`) · cờ `.pill.late` (Quá hạn, Leo thang, Làm lại ×n, lý do blocker).
`#/b/<id>`: `section.card` như cư dân (mã, pill, banner blocker, lưới thông tin, nội dung + ảnh) rồi `#bql-actions` (khối nền màu như portal:
xanh `#EEF4FF` nghiệm thu, đỏ nhạt khẩn cấp, xám hủy) và "Diễn biến gần đây" `.hd`. Ánh xạ pill `st-*`: `RECEIVED/VERIFYING/NEED_INFO/ON_HOLD` `st-moi` ·
`ROUTED` `st-da_chuyen` · `IN_PROGRESS` `st-dang_xu_ly` · `READY_FOR_REVIEW` `st-da_chuyen` · TERMINAL `st-hoan_thanh`.

## §6. Đăng nhập + vai khác
`#/login` = `.scr-login` của portal: dải gradient + icon nhà + "Cổng phản ánh cư dân / MaintenanceOps · Ocean Park (mô phỏng)", form trắng bo 24 px,
`#login-username`, `#login-password` (nút "Hiện/Ẩn" `.eye`), `#login-submit.submit`, lỗi nền `#FDE2DF`. `#/web` = Header + `.card#web-only` như cũ.

## §7. Giữ nguyên để harness M1–M13 còn đo được (BẮT BUỘC)
Id/selector: `#login-*`, `#new-ticket`, `#new-description`, `#submit-ticket`, `#resident-list .titem`, `#resident-detail .pill`, `#public-message`,
`#resident-actions`, `#addition-text`, `#rating [data-score]`, `.photos .ph img`, `input[type=file]:not([capture])`, nút chữ "Tải lại",
`#bql-tabs [data-tab]`, `#bql-list [data-ticket]`, `#review-actions`, `#rework-note`, `#emergency-actions`, `#emergency-note`, `[data-confirm]`,
`[data-write]`, `#offline`, `#web-only`. `h1` đầu tiên của `#/r` chứa "Phản ánh của tôi" (Header KHÔNG dùng `h1`).
Header dựng bằng `fill(bar, …)` trong `main.js` (mốc phép phá `d-null-text`).

## §8. Vùng cấm (đã cân nhắc, KHÔNG làm)
| # | Không làm | Lý do |
|---|---|---|
| P4-V1 | Import TSX/React/Next, chạy Tailwind build, hay nhúng iframe portal | Thêm bước build/runtime thứ hai; trái Q04 "không bước build" |
| P4-V2 | Gọi API/DB của portal (`:3000`, DB `portal`) | Hai nguồn dữ liệu ⇒ lệch engine CR-03 (00-ARCH V1) |
| P4-V3 | Nút "Đánh dấu khẩn cấp", chèn chữ "[Khẩn cấp]" vào mô tả | API không có trường; mức an toàn do engine quyết (luật R1–R10), chữ chèn thêm có thể đổi mức an toàn |
| P4-V4 | Tag/nhận xét khi đánh giá, cư dân tự nghiệm thu/hủy, tab Thông báo, "Agent nhận diện" phía client | API không có (`RatingRequest` chỉ `score`; nghiệm thu = BQL); phân loại phía client sẽ khác engine |
| P4-V5 | Bảng (table) của Management trên điện thoại | Rộng ≥820 px; dùng thẻ |

## §9. Lỗi
Không thêm loại lỗi; mọi lỗi theo 01-CONTRACTS §7. Toast giữ tông `ok/warn/error` (portal chỉ có tông lỗi — tông ok/warn là phần riêng của app).

## §10. Nghiệm thu (bổ sung TESTING-ACCEPTANCE)
- `node --check` 7 file JS = 0; pytest toàn bộ + ruff = 0.
- Harness `run_all.sh` M1–M13 + TEXT + JS = ALL PASS; 4 phép phá vẫn ĐỎ (mốc trong `mutate.py` cập nhật theo code mới nếu đổi).
- Ảnh 390 px mới trong `evidence/screens/` có header gradient + tile + thẻ đánh số (so mắt với `planning/06_…/evidence/screens/resident-1-390.png`).
- Smoke `:8000` Docker (KHÔNG ghi dữ liệu — DB Supabase chung): `GET /app/` 200, `/app/app.css` 200, đăng nhập `cudan01` + `GET /resident/tickets` 200.

# 25 — Danh sách dài cuộn trong khung, không kéo dài trang (PATCH)

## Metadata
- Trạng thái: ✅ XONG LOCAL 2026-10-15 (gate server ⬜ — chờ deploy).
- Người yêu cầu: Như Ý ("còn thiếu cái scroll list. tôi không muốn cuộn vô hạn xuống cuối màn hình").
- Nhánh: `feature/nhuy-reasoning-agent`. Phiên bản: **1.17.1** (PATCH — chỉ CSS + bọc khung, ≤ 1 ngày ⇒ ngoại lệ AGENTS §3.2.5: chỉ `plan.md`).
- Phạm vi: portal Next.js. App điện thoại `src/mobile/` KHÔNG đổi.

## Nhật ký quyết định
- 2026-10-15 S01 (agent): một lớp CSS dùng chung `.scroll-list` (`portal/src/app/globals.css`): `max-height: min(70vh, 760px)`, `overflow-y: auto`, `overscroll-behavior: contain`, tiêu đề bảng dính trên (`thead th` sticky). Không thêm thư viện, không cuộn ảo.
- 2026-10-15 S02 (agent): áp cho cả điện thoại. Lý do đo được: không có khung thì bảng Kỹ thuật 50 ticket cao 9 771 px trên màn 390×844.
- 2026-10-15 S03 (agent): giữ nút "Xem thêm" (Tiếp nhận, Lịch sử phòng ban) dưới khung — tránh vẽ hàng trăm thẻ một lần.

### Quyết định bị thay thế
- (không có)

## Nơi áp dụng
| Màn | Khung cuộn |
|---|---|
| Kỹ thuật / Vệ sinh — Danh sách công việc | mỗi cột của `components/board.tsx` |
| Kỹ thuật / Vệ sinh — Lịch sử hoàn thành | danh sách thẻ trong `HistoryList` (`app/cleaning/dept-parts.tsx`) |
| Tiếp nhận | thẻ "Chờ phân loại" + bảng "Đã phân loại" |
| BQL | bảng "Danh sách ticket" + 3 ô "Việc của Ban quản lý" |
| Cư dân | "Phản ánh của tôi" |
| Kho | "Phiếu vật tư cần nhập" + bảng tồn kho |

## Checklist
- [x] CSS + bọc khung 12 chỗ
- [x] typecheck 0, vitest 159, lint chỉ còn 1 lỗi có sẵn (`management-overview-chart.tsx`)
- [x] Chạy thật (backend memory :8012 + 62 ticket, `next dev` :3012), Playwright `evidence/scroll-check.mts`: 24/24 PASS (`scroll-check.log`), máy tính 1440×900 + điện thoại 390×844
- [x] Đối chứng âm: tắt khung trong trang (`--break=1`) ⇒ 23/24 FAIL (`mutation-no-scroll-box.log`)
- [x] Đồng bộ não + docs/portal.md + version 1.17.1

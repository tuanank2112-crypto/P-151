Vai: worker (vai-thi-cong) · thi công · Claude Sonnet 5.5 · Bước 0: exit 0 (NÃO ĐÃ OK; cảnh báo BRN-028 today.md dài, ngoài phạm vi) · hiểu việc: phạm vi = UI Quản lý + Kho + modal chi tiết + components trong portal/ đúng SPEC-P03 §5-§7, không chạm lib/server/actions; xong khi = typecheck/lint/test EXIT=0 + duyệt trình duyệt 1440/390 + spec-check; cấm = commit/push/add -A/stash, ghi Supabase, bịa số liệu/khối Agent
Handoff: handoffs/H07_thi-cong_WP5.md
Base: ef4a4d92f94341fde543313ef2015ca7b77693fb
Head: ef4a4d92f94341fde543313ef2015ca7b77693fb; working tree chưa commit

## Lệnh + exit (evidence/WP5/)
| Lệnh | Exit | File |
|---|---|---|
| npm run typecheck | 0 | checks.txt |
| npm run lint | 0 | checks.txt |
| npm run test: 8 file, 118 test, 118 pass, 0 fail, 0 skip | 0 | checks.txt |
| npx tsx scripts/ui-check-WP5.mts --base=http://localhost:3000: 75 check, 75 PASS, 0 FAIL, không tràn ngang | 0 | ui-check.txt |
Ctrl-char `[\x08\x0c\x0b]` = 0 trên 5 file đã sửa/tạo.

## git diff --stat (phần của gói; cleaning/reception/resident/technical là WP3/WP4 chạy song song)
 portal/src/app/management/management-app.tsx | 413 ; portal/src/app/warehouse/warehouse-app.tsx | 153 ; portal/src/components/ticket-detail-modal.tsx | 124
 MỚI: portal/src/components/ticket-evidence.tsx, portal/scripts/ui-check-WP5.mts, evidence/WP5/* (33 file, gồm ảnh 1440/390)
SHA: Base = Head = ef4a4d9 (chưa commit).

## SPEC -> đạt/chưa: xem evidence/WP5/spec-check.md (ảnh cùng thư mục)
Chưa đo được trên dữ liệu thật: khối Agent có dữ liệu và nhãn "Agent chuyển" (backend memory chưa có agent_decision); "Duyệt cấp" bấm thành công (chỉ có yêu cầu thiếu hàng); nút Cần BQL quyết.

## Quyết định của worker
1. Chạy kiểm bằng http://localhost:3000 (không phải 8000): qua proxy 8000 websocket HMR bị 403 nên trang dev KHÔNG hydrate (nút không chạy); 127.0.0.1:3000 cũng không hydrate (cross-origin dev). Dữ liệu vẫn là backend memory 8000 qua rewrites.
2. "Chip Tất cả xem cả đã xong/hủy" hiểu là: chip Tất cả = mọi ticket; thêm chip "Gồm đã xong/hủy" khi đang lọc VS/KT.
3. "Đã hoàn thành" của BQL = ticket CLOSED, dept null, closureKind EMERGENCY_HANDLED, riskLevel khác EMERGENCY (Q09); CLOSED của phòng ban hiện ở khối Chờ nghiệm thu khi lọc Đã hoàn thành.
4. Minh chứng của ticket chờ nghiệm thu tải bằng ticketDetailAction (không thêm hợp đồng).
5. Kho: nút "Thêm vật tư" luôn hiện (backend báo lỗi nếu cờ tắt); từ BQL vào /warehouse?from=management để hiện nút quay lại + nhãn Ban quản lý.
6. Props TicketDetailModal giữ nguyên. Đã đổ dữ liệu thử vào backend memory: SIM-TKT-0005 (cư dân gửi, Tiếp nhận chuyển BQL), SIM-TKT-CLN-001/006 qua nghiệm thu, vài vật tư "Vật tư thử WP5".

## Bảng phân công
| Gói | Tầng yêu cầu | Họ/model đã dùng |
| WP5 | 🟠 | Claude Sonnet 5.5, không giao con |

## Việc KHÔNG làm + lý do
- Không sửa lib/server/actions; không commit/push.
- Không kiểm "Agent chuyển" / khối Agent có dữ liệu: backend chưa sinh agent_decision.

## Câu hỏi mở
1. Ticket cũ 1 dòng: splitReport cắt tiêu đề 80 ký tự nên tiêu đề và nội dung lặp chữ (vd SIM-TKT-CLN-004) - sửa ở lib/backend-map.ts (ngoài phạm vi).
2. Dev qua cổng 8000 không hydrate (proxy chặn HMR websocket): cần PORTAL_URL chuyển tiếp cả upgrade, hoặc allowedDevOrigins; ngoài phạm vi.
3. WarehouseData không có role nên dùng ?from=management.

Tiếp theo
🖐 Cần tay người: duyệt R07; quyết cách xử lý proxy 8000 cho demo.
🤖 Agent làm được ngay: chờ lệnh (chạy lại khi backend có agent_decision/WP1b).
⭐ Nên làm trước: sửa proxy/HMR cổng 8000 - nếu không người xem demo qua 8000 sẽ thấy trang không bấm được.
⏸ Chưa làm: kiểm Agent thật, Duyệt cấp thành công, nút Cần BQL quyết.

⏳ Chờ người duyệt.

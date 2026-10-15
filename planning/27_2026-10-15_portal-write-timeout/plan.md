# 27 — Portal chờ đủ lâu khi gửi phản ánh có Agent (PATCH)

## Metadata
- Trạng thái: ✅ XONG LOCAL 2026-10-15, gate server ⬜ chờ deploy (hỏi người trước).
- Người yêu cầu: Như Ý ("ok" cho đề xuất 2026-10-15, phát hiện từ diễn tập video hồ sơ 22, [R02](../22_2026-10-14_product-video/reports/R02_v4-rehearsal.md)).
- Nhánh: `feature/nhuy-reasoning-agent`. Phiên bản: **1.17.3** (PATCH, một hằng số + test, ≤ 1 ngày ⇒ ngoại lệ AGENTS §3.2.5: chỉ `plan.md`).
- Phạm vi: `portal/src/server/backend.ts` + test. Backend Python, app `/app/` KHÔNG đổi.

## Lỗi đo được
Portal chờ backend tối đa 15 s cho MỌI lời gọi (`TIMEOUT_MS = 15_000`). Gửi phản ánh chạy Agent trước khi trả lời: 16–20 s (diễn tập 4 lần, `agy_cli` gemini-3.8-flash-low; giới hạn Agent `mo_agent_timeout_seconds` = 25 s). Kết quả: ticket ĐÃ tạo nhưng trang cư dân báo "Không kết nối được máy chủ" ⇒ cư dân dễ gửi lại, sinh ticket trùng. Production bật Agent (gpt-6-luna) từ 2026-10-15 nên có thể gặp cùng lỗi (chưa đo trên production).

## Nhật ký quyết định
- 2026-10-15 T01 (agent): tách hai giới hạn: đọc (GET) giữ 15 s để trang không treo khi backend chết; ghi (POST, gồm form gửi ảnh) 60 s = giới hạn Agent 25 s + tải ảnh + dư. Không thêm tham số tuỳ biến từng lời gọi (mọi thao tác ghi đều có thể chạy lại pipeline ⇒ Agent).
- 2026-10-15 T02 (agent): chưa đổi `maxDuration` của Vercel. CHƯA kiểm project p151-portal/p151-backend có giới hạn thời gian hàm bao nhiêu; gate server đo trực tiếp (thời gian từ bấm Gửi tới "Đã gửi"). Bị cắt sớm ⇒ thêm `maxDuration` ở hồ sơ này.

### Quyết định bị thay thế
- (không có)

### Vùng cấm
- Không nâng giới hạn đọc (GET) lên 60 s: trang sẽ treo 1 phút khi backend chết.
- Không chuyển sang gửi nền + hỏi lại (polling): thay đổi lớn, ngoài PATCH.

## Checklist
- [x] Test đỏ trước khi sửa: `tests/unit/backend-timeout.test.ts` 3/3 FAIL (`timeout` gọi với `undefined`)
- [x] Sửa `READ_TIMEOUT_MS` / `WRITE_TIMEOUT_MS`; vitest 162 pass / 6 skip, `tsc --noEmit` 0, eslint 2 file 0
- [x] Chạy thật local (backend `agy_cli` gemini-3.8-flash-low, portal `next start`): mọi lần gửi phản ánh qua portal hiện "Đã gửi <mã>", lâu nhất 22 s; trước khi sửa cùng phép đo báo "Không kết nối được máy chủ" ([R02](../22_2026-10-14_product-video/reports/R02_v4-rehearsal.md)). Evidence: `planning/22_…/evidence/V4/rehearsal-20261015-1920.txt`
- [x] Đồng bộ não + docs/portal.md §2 + version 1.17.3 (`portal/package.json`, `state.json`)
- [ ] Gate server: deploy p151-portal (hỏi người trước), gửi một phản ánh thử trên production (ghi Supabase chung ⇒ hỏi người trước)

## Exit Gates
| Gate | local | server |
|---|---|---|
| Gửi phản ánh có Agent hiện "Đã gửi", không báo lỗi | ✅ | ⬜ |

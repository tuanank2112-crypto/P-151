# 18 — Giữ UI portal mới, dùng backend Python
## Metadata
- Trạng thái: IMPLEMENTATION VERIFIED / ROLLOUT PENDING — đã nối UI với Python và đo local; chưa sign-off toàn hồ sơ vì boot/Docker chưa đạt.
- Phạm vi người dùng đã chốt: giữ UI mới, dùng backend Python feature/chamanh.
- Base: 2ced265; local version1.10.1; phiên bản đích dự kiến1.11.0 MINOR (Python API giữ contract).
- Không commit/push/deploy trong giai đoạn lập SPEC.
- Sign-off local riêng với Docker/server/điện thoại; không đóng khi gate môi trường bắt buộc thiếu.

## Nhật ký quyết định
- 2026-10-10 D01: UI portal chỉ đọc/ghi API Python; Next.js là presentation/BFF, không còn DB/workflow ticket riêng trong runtime.
- 2026-10-10 D02: giữ class/token/bố cục mới, modal ticket, các màn sáu vai; sửa nút/field theo quyền backend.
- 2026-10-10 D03: ID string xuyên suốt; cookie HttpOnly chứa token Python; không dựng mapping ID số hoặc session DB portal.
- 2026-10-10 D04: chỉ gọi endpoint Python hiện có; mọi thao tác portal không có tương đương phải bỏ/đổi theo SPEC hành động, cần duyệt trước thi công.
- 2026-10-10 D05: không thực hiện SPEC-P09/G-1 trong plan này. Tự chuyển hoặc dừng BPTN do engine Python hiện có quyết định.
- 2026-10-10 D06: DB portal cũ giữ nguyên để rollback, không migrate ticket sang Python; runtime mới không đọc DB đó.

- 2026-10-10 D07: người dùng duyệt plan18; triển khai WP1–WP3 và thẩm định độc lập WP4. Không deploy/ghi Supabase/commit/push.
- 2026-10-10 D08: projection Case tại BFF bỏ resident_id/audit/actor trước browser; safety controls tuân escalated/status Python; login fallback không dùng form có thể mất input lúc stream.

- 2026-10-10T21:39:55+07:00 D09: Vệ sinh rỗng phải lưu xác nhận N_A qua API; chưa có xác nhận server thì không coi đã lưu. Browser kiểm một POST và mở lại disabled.

- 2026-10-10 D10: sửa lỗi ký hiệu SPEC U1 emergency/close note? thành note bắt buộc; engine Python không đổi. UI yêu cầu note, browser6/6 gồm block/resume/resolve/emergency, reviewer6/6 negative control optional-note đỏ.

### Quyết định bị thay thế sau duyệt và rollout
- Plan17: proxy chung cổng nhưng portal vẫn có DB/workflow riêng → frontend/BFF chỉ dùng Python.
- Portal workflow stage1 mặc định chờ BPTN → status/blocker/actions lấy Python, không dựng bước chờ riêng.
- Mật khẩu/tài khoản portal123456 → đăng nhập tài khoản Python; không tự sửa tài khoản/mật khẩu backend.
- Không thay plan16, quyền/auth/safety/stock/Agent của Python hoặc trạng thái PROPOSED của SPEC-P09.

## Router SPEC
1. [Kiến trúc](specs/00-ARCHITECTURE.md)
2. [Hợp đồng](specs/01-CONTRACTS.md)
3. [Đăng nhập và dữ liệu](specs/SPEC-P01-auth-data.md)
4. [Thao tác và UI](specs/SPEC-P02-actions-ui.md)
5. [Vận hành](specs/OPERATIONS.md)
6. [Nghiệm thu](specs/TESTING-ACCEPTANCE.md)

## Work packages và Tier
- WP0 🔴: duyệt SPEC, snapshot nền dirty/HEAD, đóng băng mapping quyền/action.
- WP1 🟠: auth/client/DTO/read-side, sở hữu portal/src/server/session.ts, queries.ts, backend-client.ts, backend-dto.ts và types liên quan.
- WP2 🟠: server actions, ảnh và form backend checklist/vật tư; portal/src/app/actions, api/photos, dashboards/components.
- WP3 🟠: compose/Dockerfile/runtime DB independence, regression/unit/browser/smoke.
- WP4 🔴: thẩm định độc lập sau thi công, root đo lại ≥3 cách phá; không coi report thay phép đo.
- WP5 🟢: docs/não/version/sign-off sau mọi gate bắt buộc đạt. Root điều phối file dùng chung, không ghi đè nhau.

## Checklist
- [x] Đọc portal/Python API và xác định hai workflow độc lập.
- [x] Tạo SPEC tự chứa cho chuyển sang Python.
- [x] Người dùng duyệt SPEC và các nút/field phải đổi (2026-10-10).
- [x] Snapshot + contracts frozen; phát handoff tự chứa H/R theo AGENTS trước dispatch.
- [x] WP1–WP3 triển khai; API/static-source guard RED→GREEN (5 mutant đỏ, source phục hồi).
- [x] WP4 thẩm định độc lập lần 3 duyệt; root đo lại Python/browser/unit/restart.
- [ ] Browser/DB independence/Docker/điện thoại đạt theo cột môi trường.
- [x] WP5 đồng bộ docs/não/version1.11.0; đề xuất commit. Rollout chưa thực hiện.

## Lưu Git
- 2026-10-10T22:34:58+07:00: người dùng duyệt commit và push lên feature/chamanh. Snapshot1.11.0 bao gồm source/tests/docs/hồ sơ/evidence plan18; integration/ có sẵn không stage. Gate boot/Docker vẫn chưa đạt; lưu Git không thay nghiệm thu rollout.

## Sign-off
Đã xác minh implementation local lúc 2026-10-10T21:39:55+07:00; chưa đóng hồ sơ vì Docker/boot hub còn thiếu. Điện thoại/server chưa đo.

## Hồ sơ và evidence
- H01/R01 auth-data; H02/R02 actions-bff; H03/R03 UI; H04/R04 independent-review; H05/R05 closure.
- Python: evidence/ui/python-tests.txt — 3441 passed, 95 deselected (PostgreSQL), exit0.
- Portal: evidence/ui/unit-final-accepted.txt — 71 passed; build-final.txt — không DATABASE_URL, exit0; lint-final.txt — 0 errors, 1 warning legacy.
- Browser: flows-accepted.txt 46/46; cross-app.txt 9/9; restarts.txt 5/5; cleaning-accepted.txt 4/4; extra-actions-accepted.txt 6/6.
- Review: evidence/independent-review/safety-browser-round3.txt 17/17; reports/R04_independent-review.md.
- RED→GREEN: evidence/ui/mutations.txt — 5 source mutants đỏ; phục hồi source và unit xanh.
- Docker CLI không có; boot engine thiếu ../brain4agent.release (exit1); giữ các gate này chưa đạt. Không chạm DB Supabase.

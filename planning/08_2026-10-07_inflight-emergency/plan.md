# 08 — Báo khẩn cấp khi ticket đã qua tầng an toàn (đang giao/đang làm) và BQL trả về đúng chỗ

| Trường | Giá trị |
|---|---|
| Trạng thái | 🟡 CHỜ DUYỆT (2026-10-07 18:40:21 +0700) — SPEC xong, chưa thi công |
| Loại SemVer | MINOR (thêm method, 5 dòng `TRANSITIONS`, trường JSONB mới cần revision đánh dấu; giữ API cũ) |
| Spec nghiệp vụ | [`docs/CR-BPTN-03.md`](../../docs/CR-BPTN-03.md) §4.1, §4.4, §6.4–§6.5, §9.3 — delta đề xuất ở [`specs/01-CONTRACTS.md`](specs/01-CONTRACTS.md) §8 (chờ Trường duyệt) |
| Nguồn yêu cầu | Người dùng (Như Ý), 2026-10-07: "nếu agent phân biệt nhầm … nó là khẩn cấp nhưng lại chuyển thẳng cho phòng ban" ⇒ đo: ticket `ROUTED/IN_PROGRESS/ON_HOLD` không có đường nâng khẩn cấp (`safety_escalate` chỉ nhận `VERIFYING/SAFETY_REVIEW_REQUIRED` hoặc `NEED_INFO`, `engine.py:1094-1119`) |
| Chủ việc | Như Ý (engine). Route: worker repo này (Q09). UI: bàn giao Trí. Delta CR: Trường duyệt |
| Nhánh | `feature/nhuy-reasoning-agent` SAU khi merge `origin/develop` (P5); KHÔNG push khi chưa duyệt |
| Base đo | worker tự đo `git rev-parse HEAD` trước dòng sửa đầu tiên (không ghim) |
| Hạn | feature freeze 2026-10-12 21:00 +0700; bàn giao 2026-10-19 23:59 +0700 |
| Điều phối | super orchestrator (🔴) viết SPEC này; thi công 🟠/🟢; thẩm định 🔴 do agent khác |

**Mục tiêu một câu:** khi cả luật lẫn Agent bỏ sót nguy hiểm và ticket đã tới phòng ban, người thấy nguy hiểm (phòng ban của ticket, BPTN, BQL) bấm "Báo khẩn cấp" ⇒ ticket dừng ở BQL như mọi ca Bậc 1; BQL đóng, tạo ticket tiếp theo, hoặc xác nhận báo nhầm và trả ticket về ĐÚNG trạng thái cũ mà không chạy lại pipeline.

## §2. Nhật ký quyết định
Mốc lấy bằng `date "+%Y-%m-%d %H:%M:%S %z"`.

| # | Mốc | Quyết định | Nguồn / lý do | Lật · chi phí |
|---|---|---|---|---|
| Q01 | 2026-10-07 18:40:21 +0700 | Báo khẩn là thao tác NGƯỜI: phòng ban của ticket, BPTN, BQL; lý do bắt buộc; người báo KHÔNG rút lại được (như E01) | Người dùng hỏi lỗ "khẩn cấp đi thẳng phòng ban"; Q02 plan 06 "chỉ người hạ" | Bỏ method · rẻ |
| Q02 | 2026-10-07 18:40:21 +0700 | Nguồn: `ROUTED`, `IN_PROGRESS`, `ON_HOLD`, `READY_FOR_REVIEW`, `VERIFYING` với blocker BPTN hoặc `WRONG_DEPT_AFTER_START`. KHÔNG: `NEED_INFO` (T07 + F1 plan 06), `RECEIVED` (tức thời), `SAFETY_REVIEW_REQUIRED` (E01 sẵn có), kết thúc | Phủ mọi chỗ người nhìn thấy ticket mà chưa có đường lên Bậc 1 | Bớt nguồn · rẻ |
| Q03 | 2026-10-07 18:40:21 +0700 | Giữ nguyên dữ liệu thực hiện; lưu `Ticket.emergency_return` (trạng thái + blocker trước khi báo) | Ticket đang làm có checklist/vật tư/ảnh; pipeline chạy lại sẽ phân loại & đặt vật tư lần hai | — |
| Q04 | 2026-10-07 18:40:21 +0700 | BQL: đóng (T10 sẵn có) · ticket tiếp theo (sẵn có) · **trả về chỗ cũ** (`emergency_restore`, mới, KHÔNG chạy pipeline). T05 `emergency_downgrade` bị chặn cho ticket có `emergency_return` | Tránh hai đường hạ cùng sống với hai hậu quả khác nhau | Cho T05 chạy pipeline · trung bình |
| Q05 | 2026-10-07 18:40:21 +0700 | Quyền theo lý do `TransitionRule.reason_actors` (kiểm tại `_apply_transition`) + cờ `method_only` cho dòng mới; `transition()` chung KHÔNG với tới báo khẩn/trả về | Thêm vai vào hàng T15/T16 sẽ cho BPTN gọi được T15 qua đường chung | — |
| Q06 | 2026-10-07 18:40:21 +0700 | Revision đánh dấu `0003_emergency_return` (không DDL), như plan 06 Q13 | `Entity` là `extra="forbid"`: code cũ đọc doc mới sẽ vỡ giữa request | — |
| Q07 | 2026-10-07 18:40:21 +0700 | Không gọi mô hình, không sửa `safety.py`/từ vựng/bước 2b | Thao tác người; tách khỏi WP14 plan 06 | — |
| Q08 | 2026-10-07 18:40:21 +0700 | Code mới ở mixin `src/maintenance/coordination/emergency.py` | Mẫu plan 06 Q14; giảm xung đột `engine.py` | Gộp vào engine · rẻ |
| Q09 | 2026-10-07 18:40:21 +0700 | Hai route mỏng do worker repo này viết (WP2); UI chỉ bàn giao Trí (01 §7) | Route chỉ bọc engine; UI không thuộc chủ việc | Giao Châm Anh · rẻ |
| Q10 | 2026-10-07 18:40:21 +0700 | Thứ tự: H13 (plan 06 WP14: F1, F10 403) xong + duyệt TRƯỚC H01 plan 08 | Cùng sửa `engine.py::transition`; F1 là lỗi CHẶN đã tái hiện 6/6 | — |

### Quyết định CHỜ NGƯỜI DÙNG (mặc định đang dùng trong SPEC)
| # | Câu hỏi | Mặc định | Đổi thì sao |
|---|---|---|---|
| P1 | Trường duyệt delta CR-03 (E03/E04, T24–T28, 01 §8)? | Thi công chỉ sau khi duyệt | Không duyệt ⇒ hồ sơ dừng ở SPEC |
| P2 | Cư dân được báo nguy hiểm khi ticket đã giao? | KHÔNG trong 08 (Idea Vault) | Thêm SPEC-P02: bổ sung văn bản chạy 2b ở mọi trạng thái chưa kết thúc |
| P3 | Demo nhóm chạy `portal/` (Next.js, agent từ khoá riêng, KHÔNG nối engine — plan 06 portal Q01) hay `src/web/` + engine? | Hồ sơ này chỉ cho engine Python | Nếu demo bằng portal: cần bản tương đương bên portal (chủ: Châm Anh) |
| P4 | Đóng khẩn cấp ticket đang làm: tồn kho? | Không đổi tồn kho; kho đối soát tay | Thêm hoàn kho ⇒ SPEC kho riêng (Châm Anh) |
| P5 | Merge `origin/develop` (`04491ad`) vào nhánh trước H01? | Có, do người cho phép | Không ⇒ thi công trên nền thiếu 6 commit, xung đột `models.py` khi PR |

### Quyết định bị thay thế
(chưa có)

## §3. Work Packages (tầng theo AGENTS §3.3 / K.3 — không ghi tên mô hình)
| WP | Việc | Tầng | Handoff | Phụ thuộc |
|---|---|---|---|---|
| WP1 | Contract + engine (`report_emergency`, `emergency_restore`, `reason_actors`, 5 dòng `TRANSITIONS`, `EmergencyReturn`, revision 0003) + test | 🟠 | [H01](handoffs/H01_thi-cong_WP1.md) | P1, P5, H13 plan 06 ✅ |
| WP2 | Hai route API + test API | 🟢 | [H02](handoffs/H02_thi-cong_WP2.md) | WP1 ✅ |
| WP3 | Thẩm định đối kháng cô lập (chỉ đọc) | 🔴 | [H03](handoffs/H03_tham-dinh_WP3.md) | WP1 + WP2 ✅ |
| WP4 | Đồng bộ não 6 điểm + `changelog.md` + version | 🟢 | (SO tự làm) | WP3 ✅ |

## §4. Checklist thực thi
- [x] SPEC package (00, 01, P01, OPERATIONS, TESTING) + H01–H03 — 2026-10-07 18:40:21 +0700
- [ ] Người dùng duyệt hồ sơ · [ ] P1 Trường duyệt delta CR · [ ] P5 merge `origin/develop`
- [ ] SO dựng `.venv` Python 3.11 (OPERATIONS §2) — repo hiện KHÔNG có venv
- [ ] H13 plan 06 ✅ (điều kiện Q10)
- [ ] WP1 · [ ] WP2 · [ ] WP3 ✅ · [ ] WP4
- [ ] Exit Gates: local ⬜ · `--pg` ⬜ · server ⬜ (TESTING §5)
- [ ] Sign-off `✅ ĐÃ HOÀN THÀNH` + mốc giây

## §5. Bảng trỏ SPEC
| File | Nội dung |
|---|---|
| [specs/00-ARCHITECTURE.md](specs/00-ARCHITECTURE.md) | Mục tiêu, non-goals, bất biến I-1…I-9, thứ tự đọc |
| [specs/01-CONTRACTS.md](specs/01-CONTRACTS.md) | Enum, model, `TransitionRule.reason_actors`, bảng dòng chuyển, chữ ký method, API, UI, delta CR, lưu trữ |
| [specs/SPEC-P01-report-restore.md](specs/SPEC-P01-report-restore.md) | Thuật toán báo khẩn / trả về / đổi method cũ, bảng lỗi, vùng cấm |
| [specs/OPERATIONS.md](specs/OPERATIONS.md) | Thứ tự, môi trường, migration, rollback |
| [specs/TESTING-ACCEPTANCE.md](specs/TESTING-ACCEPTANCE.md) | Ma trận A-01…A-24, đột biến, cổng, Exit Gates |

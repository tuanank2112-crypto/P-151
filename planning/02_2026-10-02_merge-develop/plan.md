# 02 — Merge `develop` vào nhánh engine CR-03 P0

| Trường | Giá trị |
|---|---|
| Trạng thái | ✅ MERGE XONG — 2026-10-02 22:27:53 +0700 · chờ PR vào develop (người dùng) |
| Loại | Tích hợp (≤ 1 ngày công) — ngoại lệ AGENTS §3.2.5: chỉ `plan.md`, hợp đồng = hành vi đã duyệt của hai bên |
| Nhánh | `feature/nhuy-cr03-p0` (merge `origin/develop` vào, KHÔNG rebase, KHÔNG force-push) |
| Base | HEAD `feature/nhuy-cr03-p0` lúc bắt đầu · `origin/develop` = `deab467` |
| Nguồn hành vi | Engine: `planning/01_2026-10-01_cr03-p0-engine/` (CR-03 P0, 1462 test). Lưu trữ: `planning/01_2026-10-02_supabase-persistence/` trên `develop` |
| Điều phối | super orchestrator (🔴) |

**Mục tiêu một câu:** nhánh có cả CR-03 P0 (tầng an toàn, khẩn cấp, priority, chốt chặn) lẫn lưu trữ bền của `develop`, toàn bộ test hai bên xanh, sẵn sàng mở PR vào `develop`.

## §2. Nhật ký quyết định

| # | Mốc | Quyết định | Lý do | Chỗ có thể lật · chi phí |
|---|---|---|---|---|
| Q01 | 2026-10-02 22:05 | Người dùng yêu cầu merge. **Merge** `origin/develop` vào `feature/nhuy-cr03-p0` (giữ lịch sử, không rebase, không force-push). | Nhánh đã push; `develop` là nhánh chung | — |
| Q02 | 2026-10-02 22:05 | **Không đổi số thư mục kế hoạch:** `develop` có `planning/01_2026-10-02_supabase-persistence`, nhánh này có `planning/01_2026-10-01_cr03-p0-engine` — giữ cả hai (Path Invariant); hồ sơ này là 02. | AGENTS §3.1 | — |
| Q03 | 2026-10-02 22:05 | **Luật giải xung đột code:** cấu trúc của `develop` (CaseRepository, store, transaction, `f1c6ebf`) là NỀN; bê toàn bộ phần CR-03 P0 vào trên nền đó. Không bỏ hành vi nào đã duyệt của bên nào. Mọi thao tác ghi mới của CR-03 phải đi qua repository/transaction của `develop` như các thao tác cũ. | Hai bên đều đã duyệt | Nếu không khớp được ⇒ dừng, hỏi chủ việc lưu trữ (Châm Anh) |
| Q04 | 2026-10-02 22:05 | **Điểm giao nhau phải xử rõ:** `f1c6ebf` (BPTN gỡ `MISSING_INFO` sau khi liên hệ cư dân) gặp `NEED_INFO` có `safety_context` của CR-03 — gỡ xong PHẢI chạy lại 2b (CR-03 §5.2, T03) và không được dùng để gỡ blocker an toàn chủ BQL. | Bất biến an toàn | — |
| Q05 | 2026-10-02 22:05 | **Tài liệu/não:** `docs/CR-BPTN-03.md` hợp cả sửa của `f1c6ebf` lẫn của hồ sơ 01. `brain4agent/`: lấy bản nhánh này (CR-03, v1.1.0) làm nền, thêm sự thật mới của `develop` (persistence, biến môi trường Supabase, planning 01 supabase). `seed/catalog.yaml`, `catalog.py`: hợp khoá hai bên. | Một nguồn chân lý | — |
| Q06 | 2026-10-02 22:05 | **Cổng đo:** (a) đo `develop` riêng (worktree tạm) để biết số test + số skip nền; (b) sau merge: tổng test ≥ 1462 + số test riêng của `develop`, 0 fail, skip KHÔNG vượt số skip nền của `develop` (vd test Postgres cần DB); ruff check + format sạch; bộ dừng an toàn + holdout không hồi quy. | Không tin report | — |
| Q07 | 2026-10-02 22:05 | Worker merge dùng **Opus** (người dùng chỉ cho Sonnet/Opus; `engine.py` rủi ro cao). Push nhánh sau khi SO đo; **mở PR vào `develop` cần người dùng đồng ý** (thao tác lên nhánh chung). | Ranh giới remote | — |

| Q08 | 2026-10-02 | **Merge ✅ (R01)** — SO đo: pytest 1514 passed / 0 fail / 0 skip (29 test pg deselected, cần DB), ruff check + format sạch, `--diff-filter=U` rỗng, merge 2 parent (853ed6f + deab467), `src/api` chỉ +2 dòng trống (format), `src/web` không đụng; holdout {EM 31, UNCLEAR 6, NONE 2}/39, f_neg 0, a_b01 0, jx_negfp EM 0 (không hồi quy). Câu hỏi mở: **(1)** `assignee_id`: develop D-12 cho phòng ban ghi, CR-03 §4.4 bất biến 2 cấm mọi người ghi ⇒ **giữ CR-03** (spec duy nhất, người dùng chốt 2026-10-01); báo Châm Anh. **(2)** chủ blocker `NEED_INFO` an toàn = RESIDENT — đúng CR-03 §3.2 (`MISSING_INFO` chủ RESIDENT). **(3)** BPTN/BQL được ghi lời yêu cầu bổ sung cho cư dân khi T06 — đúng CR-03 T06. **(4)** giữ 2 dòng trống trong `src/api` (chỉ format). 4 test bị thay thế có bằng chứng ở evidence/05 — chấp nhận. Hai `docs/flow_*.png` bị xoá là do `develop` (`4b6f3bc`). | Đo lại; CR-03 thắng | Đổi (1) cần người dùng + Châm Anh quyết |

### Quyết định bị thay thế
- (chưa có)

## §3. Work Packages
| WP | Việc | Tầng | Vai |
|---|---|---|---|
| WP1 | Đo nền `develop` + merge + giải 12 xung đột + test | 🔴 | worker (Opus) |
| WP2 | SO đo lại (test, ruff, bộ dừng, holdout) + phán | 🔴 | SO |
| WP3 | Push nhánh; PR vào `develop` khi người dùng đồng ý | 🟢 | SO |

## §4. Checklist
- [x] WP1 merge + report R01
- [x] WP2 SO đo + phán (✅ Q08)
- [x] Đồng bộ não (6 điểm) + push nhánh
- [ ] PR vào `develop` (chờ người dùng)

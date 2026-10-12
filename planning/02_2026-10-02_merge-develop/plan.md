# 02 — Merge `develop` vào nhánh engine CR-03 P0

| Trường | Giá trị |
|---|---|
| Trạng thái | ✅ ĐÃ HOÀN THÀNH — PR #7 merge vào `develop` lúc 2026-10-03 11:11:32 +0700 (tuanank2112-crypto), develop = `6265436`, cây trùng nhánh đã đo |
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

| Q09 | 2026-10-03 | **Merge lần 2: `origin/develop` = `0cb16e2`** (PR #6 Trường: `src/maintenance/safety.py` độc lập chưa nối engine, bộ nhãn `seed/maintenance_cr03/`, `test_safety_p0.py`, `test_cr03_targets.py`, hồ sơ `planning/02_2026-10-03_truong-mvp-prep/`). 8 xung đột. Luật: **`safety.py` giữ bản nhánh này** (đã nối engine, 3 vòng thẩm định); **bộ nhãn + test của Trường GIỮ**, viết lại phần gọi cho chạy trên API/engine của nhánh này, **KHÔNG đổi nhãn**. Nhãn Bậc 1 mà engine ra thấp hơn ⇒ lỗ từ vựng ⇒ thêm `lexicon.yaml` (Q29) rồi chạy lại bộ dừng; engine ra CAO hơn nhãn ⇒ ghi danh sách cho Trường, không hạ. `docs/maintenance.md`, CR-03, não: hợp hai bên. Hai thư mục `planning/02_*` cùng STT giữ nguyên (Path Invariant). Người dùng yêu cầu push hết (kể cả `docs/Activity Diagram.png`). | Người dùng duyệt; rules/nhãn là việc của Trường | — |

| Q10 | 2026-10-03 | **Merge lần 2 — câu hỏi mở (R02):** bộ nhãn Trường 98 ca ⇒ 92 khớp / 0 thấp / 6 cao (sau khi thêm "giật"). (1) 2 test `test_cr03_targets.py` đỏ vì kỳ vọng seed `maintenance_v1` bản cũ (CLN-004 ROUTED) ⇒ **cho sửa đúng phần kỳ vọng baseline** sang seed CR-03 (CR-03 §14 + Q20), không đổi nhãn an toàn, comment để Trường review. (2) Fixture Trường xếp phân loại trước an toàn — lệch D-09, không sửa engine, chuyển Trường. (3) Ca engine CAO hơn nhãn giữ nguyên, danh sách cho Trường. (4) "giật" đứng riêng = Bậc 2 (CR-03 B-03); thêm loại trừ dữ liệu "giật nước" (bồn cầu) ⇒ NONE. | CR-03 thắng; nghiêng an toàn | Trường đổi baseline/nhãn · rẻ |

| Q11 | 2026-10-04 | **Đóng câu hỏi mở Q10(2) / R02 §7.2, §8.2** (lệch thứ tự phân loại/an toàn). Trường sửa ở phía fixture, `954dcab` (PR #12, develop `dff898e`): CLN-004/TEC-005 bỏ `playbook_id`/`proposed_department_id`/`review_status` khỏi expected; `test_cr03_targets.py` khẳng định ba trường này vắng mặt. Engine, `safety.py`, baseline v1.3 không đổi. SO đo lại trên `dff898e` (evidence/13): evaluate fixture CR03 12/12, 4 demo; target 9 passed; thêm lại từng trường ⇒ 1 failed (3/3 lần phá đều đỏ); pytest 1641 passed / 29 pg deselected, ruff sạch. Hệ quả: hai ca khẩn cấp không còn kiểm phân loại (đúng CR-03 §5.1). Muốn kiểm phân loại cho ticket khẩn cấp thì phải có ca riêng (Idea Vault). | Fixture khớp D-09 · engine không đổi | Khôi phục 3 trường + assertion cũ · rẻ |

### Quyết định bị thay thế
- Q10(2) "lệch D-09 … chuyển Trường" (mở) ⇒ đóng bởi Q11 (2026-10-04). R02 giữ nguyên làm lịch sử; §7.2 và §8.2 của R02 không còn là câu hỏi mở.

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
- [x] PR #7 vào `develop` (người dùng bấm merge 2026-10-03 11:11:32; agent merge qua API bị chặn vì CI đỏ do hết hạn mức Actions)

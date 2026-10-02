# 01 — CR-BPTN-03 P0 cho engine Agent (phần Như Ý)

| Trường | Giá trị |
|---|---|
| Trạng thái | 🚀 ĐANG THI CÔNG — SPEC ✅ 2026-10-01 17:10 |
| Loại SemVer | MINOR (thêm tầng an toàn, priority, hành động mới; giữ tương thích API hiện có) |
| Spec nguồn | [`docs/CR-BPTN-03.md`](../../docs/CR-BPTN-03.md) — P0 ở §16 |
| Chủ việc | Như Ý (engine, state machine, safety, proposer/fallback/injection) |
| Nhánh | `feature/nhuy-cr03-p0` (local, không push) |
| Base SHA | `e5ececf` (trên `1e2f42b` của Châm Anh) |
| Hạn | 2026-10-04 21:00 (nghiệm thu MVP nhóm) |
| Điều phối | super orchestrator (🔴) |

**Mục tiêu một câu:** engine `src/maintenance/` chạy đúng CR-03 P0 — tầng an toàn hai bậc, đường khẩn cấp do BQL xử lý, priority, các chốt chặn — giữ xanh toàn bộ test cũ và có test cho từng AC P0.

---

## §2. Nhật ký quyết định

| # | Mốc | Quyết định | Lý do | Chỗ có thể lật · chi phí lật |
|---|---|---|---|---|
| Q01 | 2026-10-01 16:00 | **Phạm vi chỉ phần Như Ý:** engine, state machine, `safety.py`, proposer guard, views/i18n của engine, catalog `sla_config`. KHÔNG: router/endpoint mới, UI, persistence, deploy, LangGraph. | Người dùng duyệt ("chỉ làm phần của nhuy"); kế hoạch Notion chia chủ việc | Thêm gói endpoint nếu Châm Anh cần · ~0,5 ngày |
| Q02 | 2026-10-01 16:00 | Hành động mới (BPTN xác nhận an toàn/nâng khẩn/hỏi cư dân; BQL đóng/hạ khẩn; đặt priority) chỉ là **method công khai của engine** có chữ ký cố định trong `01-CONTRACTS.md`, để Châm Anh/Trí nối router + UI. | Giữ ranh giới chủ việc | Router do nhóm khác — nếu chậm thì UI chưa bấm được trước 04/10 |
| Q03 | 2026-10-01 16:00 | **Không sửa router/UI để bỏ reopen/gán nhân viên:** bỏ cặp `(CLOSED, READY_FOR_REVIEW)` khỏi `TRANSITIONS` ⇒ `reopen()` trả `INVALID_TRANSITION` (409); `set_assignee` trả `ACTION_DENIED` (403) có audit. Xoá `reopen_until`, `reopen_window_days` khỏi model/catalog. Endpoint + nút UI cũ để chủ việc gỡ sau. | Đạt AC-15 mà không chạm phần người khác | Xoá hẳn method khi router đã gỡ · rẻ |
| Q04 | 2026-10-01 16:00 | Nhánh `feature/nhuy-cr03-p0` từ `e5ececf`; commit local mỗi WP; không push. | Không đè `feature/chamanh` đang có người code | Rebase lên `feature/chamanh` mới trước khi tích hợp · có thể conflict `engine.py` |
| Q05 | 2026-10-01 16:00 | Nền đo: **142/142 pass, 0 skip; ruff check + format sạch** (Python 3.11.7, `LLM_MODE=mock`, venv ngoài repo). Cổng: số test chỉ tăng, 0 fail, 0 skip. | Worker đo 2026-10-01 | — |
| Q06 | 2026-10-01 16:05 | Tín hiệu P0: S-01..S-05, S-09, S-14; Bậc 2 T2-01..T2-05; bẫy B-01..B-04. B-05/C-01, S-06..S-08, S-10..S-13 để P1. | CR-03 §16 | — |
| Q07 | 2026-10-01 16:05 | **Từ vựng luật an toàn là DỮ LIỆU** (file YAML trong `seed/maintenance_v1/`, catalog nạp), logic là CODE (`src/maintenance/safety.py`, hàm thuần). | Trường chủ rules/nhãn (kế hoạch 02/10) sửa từ vựng không cần chạm code | Gộp vào `catalog.yaml` · rẻ |
| Q08 | 2026-10-01 16:05 | **2b chạy khi có nội dung, kể cả thiếu vị trí** (kế hoạch 02/10). Thứ tự thắng: Bậc 1 > Bậc 2 > `MISSING_INFO`. Một ticket một blocker. | Không để ticket nguy hiểm kẹt ở `NEED_INFO` 72 giờ | Đổi thứ tự thắng · sửa 1 hàm + test |
| Q09 | 2026-10-01 16:05 | LLM chỉ nâng mức: P0 cài **hàm gộp `rule ⊕ llm` có guard** + test AC-05; LLM lỗi/timeout/sai schema ⇒ giữ kết quả luật, ghi fallback. Prompt an toàn cho LLM thật để P1 (10/10). | `LLM_MODE=mock` mặc định; luật đã quyết định | Bật prompt sớm hơn · ~0,5 ngày |
| Q10 | 2026-10-01 16:05 | Giá trị cấu hình theo mặc định CR-03: `safety_review.escalate_after_hours=4` (giờ lịch), `missing_info.safety_context.escalate_after_hours=12`; D-04 (B-01 lành tính), D-05 (`STOCK_CHECK_ON_ACCEPT`), D-07 (ảnh bắt buộc) giữ như CR-03. | Chưa có người duyệt khác (D-08) | Sửa số trong `catalog.yaml` · rẻ |
| Q11 | 2026-10-01 16:05 | Ticket Bậc 1: bỏ qua bước 3, 5–8; bước 4 chỉ **liên kết** (`related_ticket_ids`) theo vị trí + cửa sổ, không gộp. | CR-03 D-09 | — |
| Q12 | 2026-10-01 16:05 | Seed CLN-004 (chất lạ) và TEC-005 (tia lửa) đổi expected sang Bậc 1 trong WP của Như Ý để test xanh; đánh dấu để Trường rà nhãn. | Không đổi thì test fixture đỏ | Trường đổi nhãn · rẻ |
| Q13 | 2026-10-01 16:05 | Thứ tự thi công tuần tự WP2 → WP3 → WP4 → WP5 (cùng `engine.py`), **cùng một worker-sonnet** để giữ cache; WP6 thẩm định cô lập. Mọi entry point ghi mới phải giữ `engine.lock`. | Tránh conflict; gotcha concurrency | Song song WP5 nếu tách file · rủi ro conflict |
| Q14 | 2026-10-01 16:05 | Danh sách BPTN/BQL/phòng ban sắp theo §7 bằng một hàm khoá sắp xếp trong engine/views; router không đổi. | Q01 | — |

| Q15 | 2026-10-01 17:10 | **SPEC ✅ DUYỆT** (SO đo: 8/8 file đủ BẮT BUỘC/CẤM/Vùng cấm/Phân loại lỗi; prototype `TOTAL=84 BAD=0 TIER1_MISS=0`, `MERGE_SELFTEST=5 ok`, exit 0; architect chỉ ghi trong `specs/`). Chấp nhận drift D1–D13 theo `00-ARCHITECTURE.md` §8. | Đo lại, không tin report | — |
| Q16 | 2026-10-01 17:10 | (Q-A) **T16/T17/E02 KHÔNG vào P0** — giữ `TRANSITIONS` 25 dòng. | Kế hoạch Notion dời sang 08/10 | Thêm WP4b · ~0,5 ngày |
| Q17 | 2026-10-01 17:10 | (Q-B) Sửa chữ CR-03 §5.2 theo D2 (chạy lại từ bước 2, 2b tự bỏ qua khi đã cleared) ở bước đồng bộ docs cuối hồ sơ. | Chỉ là chữ | — |
| Q18 | 2026-10-01 17:10 | (Q-C) S-06 giữ P1; "bị điện giật" ở P0 là Bậc 2 (vẫn dừng cho người xem). (Q-D) Chấp nhận B-04 "an toàn trước"; Trường rà nhãn sau. (Q-F) Chấp nhận câu chữ `safety_details` của architect; Trường rà. | Nghiêng về an toàn, không chặn tiến độ | Đổi `phase`/nhãn trong lexicon · rẻ |
| Q19 | 2026-10-01 17:10 | (Q-E) **BQL chỉ dùng 3 lựa chọn Bậc 2 khi ticket đã leo thang** (+1 guard +1 test). | CR-03 §2 dòng BQL: "trên ticket đã leo thang" | Bỏ guard · rẻ |
| Q20 | 2026-10-01 17:10 | (D13) Sửa expected seed CLN-004/TEC-005 ở **WP3** (không phải WP5) để cổng xanh sau từng WP. | Detector bật ở WP3 làm đổi kết quả fixture | — |
| Q21 | 2026-10-01 18:00 | **WP3 ✅** (SO đo: 266 pass, ruff sạch, diff 20 file trong phạm vi; evidence làm đỏ có). Chấp nhận: sửa 9 dòng `test_engine.py` (hệ quả Q20); `git add -f` file `tests/test_maintenance/data/*.yaml`, **không sửa `.gitignore`** (cấu hình chung của nhóm — thêm file data mới thì cũng `-f`); mỗi ticket có thêm audit `ASSESS_SAFETY` kể cả NONE (truy vết); ví dụ chuẩn hoá P01 §3.1 theo luật + REF. | Đo lại | Thêm `!tests/**/data/` vào `.gitignore` khi nhóm đồng ý · rẻ |
| Q22 | 2026-10-01 18:00 | **Vấn đề ngoài engine:** "Bóng đèn … bị cháy" qua 2b ra `NONE` đúng (B-01), nhưng bộ phân loại (rules/proposer, V-10 không đổi ở P0) cho `OUT_OF_SCOPE` ⇒ ticket đèn phổ biến nhất bị dừng chờ BPTN. Chuyển Trường (chủ rules/playbook) xử; không sửa trong hồ sơ này. | Ranh giới Q01 | Thêm WP sửa `rules.py` nếu Trường giao lại · ~0,5 giờ |
| Q23 | 2026-10-01 18:50 | **WP4 🔁 SỬA drift 1:** BPTN trên blocker chủ BQL (`EMERGENCY_PENDING_BQL`) ⇒ `ACTION_DENIED` 403 + audit cho MỌI hành động, kể cả `bptn_resolve`; `bptn_resolve` trên `SAFETY_REVIEW_REQUIRED` (chủ BPTN) vẫn 409. Chấp nhận drift 2 (theo Q19) và drift 3 (`test_api.py` dùng TEC-002). SPEC P02 §5.5/§11/E-13 và TESTING X-2 lệch CR-03 ⇒ CR-03 thắng. | CR-03 §4.4 bất biến 5, AC-06 | — |

### Quyết định bị thay thế
- Q12 (seed sửa ở WP5) → thay bởi Q20 (sửa ở WP3).

---

## §3. Work Packages

| WP | Việc | Tầng | Vai | SPEC |
|---|---|---|---|---|
| WP0 | Đo nền test/ruff + quét khoảng trống | 🟢 | worker | — (xong, Q05) |
| WP1 | Viết bộ `specs/` | 🔴 | architect-fable | tất cả |
| WP2 | Contract: enum, trường Ticket, `TRANSITIONS`, `BLOCKER_OWNERS`, catalog `sla_config`, bỏ reopen/assignee | 🟠 | worker-sonnet | `01-CONTRACTS`, `SPEC-P02` |
| WP3 | `safety.py` + từ vựng YAML + chèn 2b + guard LLM + seed CLN-004/TEC-005 (Q20) | 🟠 | worker-sonnet | `SPEC-P01`, `SPEC-P04` §seed |
| WP4 | Hành động BPTN/BQL cho an toàn (+guard Q19), chặn `resume()`/job, thời hạn Bậc 2, outbox `emergency.created`, nhãn cư dân | 🟠 | worker-sonnet | `SPEC-P02` |
| WP5 | Priority PRI-H/M/L/D0 + sắp xếp; rating một lần | 🟠 | worker-sonnet | `SPEC-P03`, `SPEC-P04` |
| WP6 | Thẩm định cô lập (≥3 cách phá) | 🔴 | auditor-sonnet | `TESTING-ACCEPTANCE` |

## §4. Checklist thực thi
- [x] WP0 đo nền (142/142, ruff sạch)
- [x] Commit nền `e5ececf`, nhánh `feature/nhuy-cr03-p0`
- [x] WP1 `specs/` đủ 4 mảng + SO đo (Q15)
- [x] WP2 (R01 ✅) · [x] WP3 (R02 ✅) · [x] WP4 (R03 ✅ sau 🔁) · [x] WP5 (R04 ✅) (mỗi WP: report + SO đo lại + phán)
- [ ] WP6 thẩm định ✅
- [ ] Đồng bộ não (6 điểm) + `docs/` + changelog/version
- [ ] Sign-off `✅ ĐÃ HOÀN THÀNH` + mốc giây

## §5. Bảng trỏ SPEC

| File | Nội dung |
|---|---|
| [`specs/00-ARCHITECTURE.md`](specs/00-ARCHITECTURE.md) | Mục tiêu, non-goals, bất biến I-01..I-15, ranh giới, drift D1–D13 |
| [`specs/01-CONTRACTS.md`](specs/01-CONTRACTS.md) | Enum, model, `TRANSITIONS` (25), `BLOCKER_OWNERS`, `sla_config`, lexicon schema, 9 method công khai |
| [`specs/SPEC-P01-safety-layer.md`](specs/SPEC-P01-safety-layer.md) | Thuật toán 2b, guard rule ⊕ llm |
| [`specs/SPEC-P02-emergency-flow.md`](specs/SPEC-P02-emergency-flow.md) | Vòng đời blocker an toàn, 5 method, thời hạn, outbox, nhãn cư dân |
| [`specs/SPEC-P03-priority.md`](specs/SPEC-P03-priority.md) | PRI-H/M/L/D0, `set_priority`, `queue_sort_key` |
| [`specs/SPEC-P04-guards.md`](specs/SPEC-P04-guards.md) | Reopen 409, assignee deny, rating một lần, seed |
| [`specs/OPERATIONS.md`](specs/OPERATIONS.md) | Lệnh kiểm, thứ tự WP, ranh giới file, rollback |
| [`specs/TESTING-ACCEPTANCE.md`](specs/TESTING-ACCEPTANCE.md) | Ma trận AC → test, 84 câu nhãn, cách phá, Exit Gates |
| `specs/LEXICON-P0.yaml`, `SAFETY-CASES-P0.yaml`, `REF-safety-proto.py` | Từ vựng chuẩn, tập câu có nhãn, prototype đo |

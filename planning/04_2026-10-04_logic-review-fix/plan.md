# 04 — Sửa logic sai sau đợt rà soát toàn dự án (2026-10-04)

| Trường | Giá trị |
|---|---|
| Trạng thái | 🟡 ĐANG THỰC THI — mở 2026-10-04 |
| Loại | PATCH (sửa lỗi, không đổi contract đã duyệt, ≤ 1 ngày) — AGENTS §3.2.5: chỉ `plan.md` |
| Yêu cầu | Người dùng (Như Ý), 2026-10-04: "cứ làm tối ưu trước, sửa các logic sai đã" — sau đợt rà soát toàn dự án (engine tự đọc + 2 thẩm định Opus độc lập) |
| Nhánh | `fix/nhuy-logic-review` từ `c15bdf9` (= `origin/develop` `dff898e` + 1 commit docs) |
| Đích | PR vào `develop` (hỏi trước khi push — AGENTS §L.3) |
| Spec | `docs/CR-BPTN-03.md` (CR-03 thắng khi lệch) |

## §1. Lỗi đã đo được (nguồn: phiên rà soát 2026-10-04; script tái hiện trong scratchpad, không vào repo)
| ID | Mức | Lỗi | Vị trí |
|---|---|---|---|
| S1 | CAO | Bỏ sót Bậc 1 ra `NONE`: thang máy kẹt + người, té xỉu/té ngã, dây điện rơi/tróc vỏ, "bốc hỏa", "khoi nhieu" không dấu | `seed/maintenance_v1/lexicon.yaml` S-09/S-03/S-05 |
| S2 | TRUNG | Báo nhầm Bậc 1: "điện/cầu dao bị ngắt", "khối rác", "bật lửa", "đèn cháy sáng"; B-01 hẹp ("bóng đèn hành lang gần căn 1205 bị cháy" ⇒ Bậc 2) | lexicon |
| A1 | CAO | Cư dân/phòng ban ngoài phạm vi gọi route hành động lên ticket người khác ⇒ 403 lộ `unchanged_status` + ghi audit vào ticket nạn nhân (phình không giới hạn) | `engine._mutate_locked`, `_transition`, `_safety_precheck` |
| A2 | CAO | `POST /evidence` nhận `SIMULATED_IMAGE` dạng chữ ⇒ qua cổng "≥1 ảnh" (CR §9.4(4), AC-14) | router `/evidence` |
| A3 | TRUNG | Route ảnh `async def` gọi đồng bộ (store + `engine.lock`) ⇒ đứng event loop | router upload/xoá ảnh |
| A4 | TRUNG | `/mo/ai-logs`: mọi STAFF đọc nguyên văn phản ánh ngoài phạm vi; `limit` áp trước lọc | router `/ai-logs` |
| E1 | TRUNG | REWORK (T22): ảnh + ghi chú trước lần trả lại vẫn được tính ⇒ chỉ tick lại checklist là qua bước 10 | `engine.execution_photos`, `_validate_evidence` |
| E2 | TRUNG | BQL đã nhận ticket leo thang, chọn T06; cư dân trả lời ⇒ blocker `SAFETY_REVIEW_REQUIRED` mới `escalated=False` ⇒ BQL bị 403 thêm 4 giờ | `engine._step_2b_assess_safety` |
| E3 | TRUNG | `propose()` không nhận `ticket_id` ⇒ mọi AI Log ghi `PENDING` | `engine._classification` |
| E4 | TRUNG | Gọi LLM phân loại (timeout 30 s × 2) trong `engine.lock` + giao dịch DB ⇒ chặn mọi thao tác ghi | `engine.receive` |
| E5 | TRUNG | `receive`: ingest commit rồi pipeline lỗi ⇒ ticket mồ côi `RECEIVED` không blocker, job không bao giờ xử lý | `engine.receive`, `_due`, `_tick` |
| C1 | TRUNG | Phân loại sai: "đèn … nhấp nháy/hư/vỡ", "sảnh bẩn/dơ, phân, nôn, nước tiểu" ⇒ OUT_OF_SCOPE; "đến tầng 5" khớp "đèn" ⇒ KY_THUAT | `src/maintenance/rules.py` |
| C2 | THẤP | Proposer: đổi enum ngoài `try` (lỗi không fallback); `reason` LLM không giới hạn độ dài | `src/maintenance/proposer.py` |
| P1 | THẤP | Priority: `\btron\b` khớp "tròn", `\bhoi\b` khớp "hỏi" | lexicon `priority` |
| L1 | THẤP | Session đăng nhập sửa dict không lock | `src/api/auth.py` |
| L2 | THẤP | `/mo/tickets` sắp khác `queue_sort_key` (CR §7: mọi danh sách cùng thứ tự) | router `/mo/tickets` |

## §2. Nhật ký quyết định
| # | Mốc | Quyết định | Lý do | Lật · chi phí |
|---|---|---|---|---|
| Q01 | 2026-10-04 | Người dùng giao "làm tối ưu": SO tự chốt 4 câu mở theo CR-03 và hướng an toàn nhất (AGENTS §L.2) — xem Q02–Q05 | Không hỏi thẻ | — |
| Q02 | 2026-10-04 | **REWORK bắt ảnh + ghi chú MỚI**: bằng chứng gửi trước sự kiện `READY_FOR_REVIEW → IN_PROGRESS` gần nhất không tính ở bước 10. Comment code đã nói ý này; CR §9.4 "≥1 ảnh" cho mỗi lần báo hoàn thành | BQL trả lại vì chất lượng ⇒ bằng chứng cũ không còn giá trị | Bỏ mốc cắt · rẻ |
| Q03 | 2026-10-04 | **Ngoài phạm vi = 404, không ghi audit vào ticket**: cư dân không phải người báo, phòng ban không giữ ticket ⇒ `NotFoundError` (giống GET), kiểm TRƯỚC mọi kiểm vai. Trong phạm vi vẫn 403 + audit như cũ | CR §2 "không thấy ticket"; chặn dò + phình dữ liệu | — |
| Q04 | 2026-10-04 | **Ticket an toàn đã leo thang giữ quyền BQL**: blocker `SAFETY_REVIEW_REQUIRED` tạo lại sau khi ticket từng leo thang an toàn (`safety.review_escalated`, hoặc NEED_INFO an toàn leo thang 12 h) bắt đầu `escalated=True`, không bắn thông báo leo thang lần hai | CR §6.4: BQL đã nhận quyết định thì không bị khoá lại | — |
| Q05 | 2026-10-04 | Ghi chú kết quả (§9.4(2)), ảnh cư dân ngoài NEED_INFO, đánh giá ticket MERGED: **giữ nguyên** ở đợt này (không phải lỗi đo được; đổi là đổi hành vi đã nghiệm thu) — ghi vào Idea Vault | Phạm vi PATCH | — |
| Q06 | 2026-10-04 | E4: LLM phân loại gọi NGOÀI `engine.lock` trong `receive` (đề xuất tính trước trên đúng nội dung, dùng lại khi pipeline tới bước 3 nếu nội dung không đổi); đường khác (bổ sung, seed) giữ như cũ | Đường nóng của demo online | — |
| Q07 | 2026-10-04 | E5: job 5 phút chạy pipeline cho ticket `RECEIVED` không blocker đã quá 2 phút kể từ `created_at` (ân hạn tránh tranh với `receive` đang chạy ở tiến trình khác) | Tự phục hồi, không cần route mới | — |
| Q08 | 2026-10-04 | Rules phân loại (C1) thuộc vùng Trường (rules/playbook): sửa theo yêu cầu người dùng, KHÔNG đổi nhãn/kỳ vọng fixture; báo Trường trong PR | Ranh giới chủ việc (`memory-distill.txt` truong_focus) | — |
| Q09 | 2026-10-04 | Không làm ở đợt này: lỗ A2 SPEC-P01 (marker "giờ hết rồi" xuyên mệnh đề) — cần architect sửa SPEC; tách vị trí "tòa nhà A"; `/mo/catalog` cho cư dân; `eta` không timezone trả 409 | Không phải lỗi logic chặn demo / cần SPEC | — |

### Quyết định bị thay thế
- (chưa có)

## §3. Work Packages
| WP | Việc | Tầng | Vai | Handoff |
|---|---|---|---|---|
| WP1 | S1, S2, P1 — lexicon + ca hồi quy, giữ bộ dừng xanh | 🔴 (quyết đánh đổi bỏ sót/báo nhầm) | worker Opus, worktree | `handoffs/H01_safety-lexicon.md` |
| WP2 | C1, C2 — rules + proposer + test | 🟠 | worker Sonnet, worktree | `handoffs/H02_rules-proposer.md` |
| WP3 | A1–A4, E1–E5, L1, L2 — engine + router + auth + test | 🔴 | SO (tự làm) | — |
| WP4 | Gộp, đo lại toàn bộ, đồng bộ não, đề xuất commit/PR | 🔴 | SO | — |

## §4. Checklist
- [ ] WP1 report R01 + SO đo lại
- [ ] WP2 report R02 + SO đo lại
- [ ] WP3 engine/router/auth + test hồi quy (từng đỏ trước khi sửa)
- [ ] WP4 pytest + ruff check + ruff format toàn repo xanh trên nhánh gộp
- [ ] Đồng bộ não (6 điểm) + `docs/maintenance.md`
- [ ] Đề xuất commit/PR (hỏi trước khi push)

## §5. Exit Gates
| Gate | Lệnh | local | server |
|---|---|---|---|
| G1 | `python -m pytest -q -p no:cacheprovider` (LLM_MODE=mock) | ⬜ | ⬜ |
| G2 | `python -m ruff check src tests` + `ruff format --check src tests` | ⬜ | ⬜ |
| G3 | Script tái hiện §1 chạy lại: mọi lỗi CAO/TRUNG không còn | ⬜ | ⬜ |

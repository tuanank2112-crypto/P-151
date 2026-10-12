# 00 — Kiến trúc: báo khẩn cấp khi ticket đã qua tầng an toàn

## 1. Vấn đề (đo 2026-10-07 trên `77d5279`)
- Bước 2b (luật cố định + tín hiệu Agent, chỉ nâng) là cửa DUY NHẤT dẫn tới `EMERGENCY_PENDING_BQL`. Khi luật và Agent cùng ra `NONE`, ticket đi tiếp tới phòng ban.
- Sau đó không còn đường nào lên Bậc 1: `safety_escalate` chỉ nhận `VERIFYING/SAFETY_REVIEW_REQUIRED` (E01) hoặc `NEED_INFO` (T07, BQL) — `src/maintenance/engine.py:1094-1119`; cư dân chỉ bổ sung khi `NEED_INFO` (`engine.py:686`); phòng ban chỉ có T15/T16 (sai phòng ban).
- `emergency_downgrade` (T05) đưa ticket về `RECEIVED` rồi chạy lại pipeline từ bước 2 (`engine.py:2500-2515`) — dùng cho ticket đang làm sẽ phân loại, đề xuất phòng ban và đặt vật tư lần hai.

## 2. Mục tiêu
1. Người thấy nguy hiểm báo được khẩn cấp ở mọi trạng thái đã qua 2b mà chưa kết thúc (00 §4, bảng nguồn ở 01 §3).
2. Ticket báo khẩn dừng ĐÚNG như Bậc 1 của 2b: `VERIFYING` + `EMERGENCY_PENDING_BQL`, `risk_level=EMERGENCY`, `emergency.created` cho BQL, liên kết ticket lân cận.
3. BQL có ba lối: đóng (T10), ticket tiếp theo rồi đóng, hoặc trả về chỗ cũ không chạy pipeline.

## 3. Non-goals (vùng cấm cấp hồ sơ — đã cân nhắc, KHÔNG làm)
| Không làm | Lý do |
|---|---|
| Cư dân báo khi ticket đã giao | P2 chờ người; cần 2b trên mọi trạng thái, phạm vi khác |
| Agent/LLM tự phát hiện lại từ ghi chú phòng ban | Q07: không gọi mô hình; ghi chú phòng ban không phải văn bản cư dân |
| Sửa `safety.py`, từ vựng, bước 2b | Thuộc WP14 plan 06 (F1/F2/F11) |
| Hoàn kho khi đóng khẩn cấp | P4; luật kho thuộc Châm Anh |
| UI | Bàn giao Trí (01 §7) |
| `portal/` Next.js | App độc lập không nối engine (P3) |
| Đường `NEED_INFO` | T07 sẵn có + F1 plan 06 |

## 4. Bất biến (BẮT BUỘC — test trỏ theo số)
- **I-1** Chỉ BQL hạ/gỡ báo khẩn; người báo (kể cả BQL) không có thao tác "rút lại" — chỉ `emergency_restore`/`emergency_close`/hủy/ticket tiếp theo.
- **I-2** `EMERGENCY_PENDING_BQL` không bao giờ được `resume()` hay job gỡ (I-10 CR-03 §4.4 mục 4) — áp nguyên cho ticket báo khẩn.
- **I-3** Mọi đổi trạng thái qua `_apply_transition` + `TRANSITIONS`; mọi ghi qua `_mutate` (deep copy → audit → commit, fail closed) dưới `engine.lock`.
- **I-4** Báo khẩn KHÔNG đổi: `department_id`, `accepted_at`, checklist, `material_lines`, ảnh/evidence, `priority`, `agent_decision`, `risk_signals`, tồn kho.
- **I-5** `emergency_restore` trả về đúng `emergency_return.status` và blocker cũ (bằng nhau toàn trường), không chạy pipeline, không gọi mô hình.
- **I-6** Phòng ban chỉ báo trên ticket của mình (`_scope_error`), chỉ ở `ROUTED`/`IN_PROGRESS`/`ON_HOLD`.
- **I-7** Từ chối do vai/phạm vi ⇒ 403 + audit `ACTION_DENIED`, ticket không đổi.
- **I-8** `transition()` chung không với tới báo khẩn/trả về (Q05): dòng mới `method_only`, dòng dùng chung phân quyền theo lý do (`reason_actors`) — chỉ hai method riêng tới được.
- **I-9** Số dòng `TRANSITIONS` = trước + 5 (đo `len(TRANSITIONS)`: 23 + 7 hủy ⇒ 28 + 7); dòng mới đều `method_only=True`.

## 5. Thứ tự đọc
`plan.md` §2 → `01-CONTRACTS.md` → `SPEC-P01-report-restore.md` → `TESTING-ACCEPTANCE.md` → `OPERATIONS.md`. Tài liệu module: `docs/maintenance.md` (đọc trước khi sửa `src/maintenance/`).

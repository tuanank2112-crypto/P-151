Vai: Bạn là worker của repo này — loại THI CÔNG, chủ việc giao diện (Trí), tầng 🟠.
Bước 0: từ root repo chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` (exit 0 là đủ).
Đọc theo thứ tự: `planning/04_2026-10-04_logic-review-fix/plan.md` §1 và Q14–Q16; `docs/maintenance.md` §4 (route an toàn) và §12; `src/web/app.js`.

## 1. Bối cảnh
Kiểm thử end-to-end qua HTTP ngày 2026-10-04: backend trả đúng nhưng một số nút trên UI gọi sai route hoặc dựa vào trường không tồn tại, nên người dùng thấy như "backend lỗi". Plan 04 (PR của Như Ý) còn đổi hai hành vi mà UI cần theo.

## 2. Phạm vi
- ĐƯỢC sửa: `src/web/` (chủ yếu `app.js`).
- CẤM chạm: `src/maintenance/`, `src/api/`, `seed/`.

## 3. Việc phải làm
(a) NẶNG NHẤT — BQL không xử lý được Bậc 2 đã leo thang: khung ở `app.js` khoảng dòng 1428 dùng `t.escalated || t.status === 'SAFETY_REVIEW_REQUIRED'`; ticket không có trường `escalated` (nó nằm ở `t.blocker.escalated`) và status lúc đó là `VERIFYING` ⇒ khung không bao giờ hiện. Nút trong khung lại gọi `/bql/.../emergency/close|downgrade` (đo ra 409). Đúng: khi `t.blocker.code === 'SAFETY_REVIEW_REQUIRED' && t.blocker.escalated`, BQL dùng `POST /mo/tickets/{id}/safety` với `decision` CONFIRM_SAFE | REQUEST_INFO | ESCALATE (`note` bắt buộc với hai cái đầu). NEED_INFO an toàn (`t.safety_context`) đã leo thang: BQL CONFIRM_SAFE (T03) hoặc ESCALATE (T07) cùng route.
(b) Form BPTN cho MISSING_INFO (khoảng dòng 987) không xét `t.safety_context` ⇒ trên NEED_INFO an toàn nhận 409 GUARD. Ẩn form `bptn-resolve` khi `safety_context` đúng (chỉ cư dân hoặc BQL gỡ).
(c) Tab "Lịch sử AI Logs" (`renderUserMenu`, `isStaff = user.role !== 'RESIDENT'`) đang hiện cho phòng ban và kho. Bản vá backend H03 (Châm Anh) sẽ giới hạn `/mo/ai-logs` cho BPTN/BQL/QA_INTERNAL ⇒ chỉ hiện tab cho ba vai đó, đồng bộ thời điểm với H03.
(d) Ô tự kiểm ảnh sau REWORK: `executionPhotos(c)` (khoảng dòng 425) đếm mọi ảnh của draft; từ plan 04 bước 10 chỉ tính ảnh gửi SAU lần BQL trả làm lại ⇒ lọc `c.evidence.slice(c.evidence_round_start)` (trường mới trên `Case`) trước khi đếm, nếu không UI báo ✓ mà backend trả thiếu `execution_photo`.
(e) Nút "Báo sai phòng ban (sau khi đã nhận việc)" gọi `POST /return` lúc IN_PROGRESS ⇒ 409 (T16 là P1, backend chưa có): ẩn nút khi status ≠ ROUTED.
(f) Nút "Thiếu vật tư" gọi `/block` ⇒ ra BLOCKED_ONSITE, kho không thấy ticket (đúng CR là T18 WAITING_MATERIAL — P1, chưa có backend): đổi nhãn/ghi chú cho rõ hoặc ẩn tới khi có T18.

Xong khi: thao tác lại từng mục trên app chạy local (`LLM_MODE=mock`), không còn toast lỗi 403/409 ở các luồng trên; `node --check src/web/app.js` exit 0; chụp màn hình hoặc ghi lại request/response cho (a)–(d).

## 4. Luật
Conventional Commits tiếng Anh; mọi commit cập nhật `brain4agent/memory/hot/` (hook chặn).

## 5. Tầng
(a)–(d) 🟠 · (e)(f) 🟢.

## 6. Mẫu report (ghi `planning/04_2026-10-04_logic-review-fix/reports/R04_ui-web.md`)
Dòng 1 `Vai · thi công · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4 `Handoff: H04_ui-web.md` / `Base:` / `Head:`; rồi lệnh + exit code, ảnh/request đã kiểm, `git diff --stat`, việc KHÔNG làm + lý do; dòng cuối phán quyết.

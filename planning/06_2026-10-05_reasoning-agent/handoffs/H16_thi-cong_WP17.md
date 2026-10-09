1. Bạn là worker của repo này. Đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại THI CÔNG RUNTIME (CHỜ DUYỆT P09; CẤM thi công khi P09 chưa chuyển sang trạng thái ĐÃ DUYỆT).
2. Bước 0: từ root chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`; ghi exit (ngoại lệ CRLF theo plan Q21).
3. Đọc theo thứ tự: `docs/maintenance.md` → `planning/06_2026-10-05_reasoning-agent/plan.md` Q29 → `specs/SPEC-P09-semantic-coordination.md` §1–§10.

## 1. Bối cảnh
- Hợp đồng điều phối ngữ nghĩa P09 đã hoàn thiện tại `specs/SPEC-P09-semantic-coordination.md` (giải quyết mâu thuẫn Q01 vs G-1, liên kết giá trị - bằng chứng vị trí B1, phân tích nhân quả & hai vị trí B2, bất biến next_step & ánh xạ enum B3, tính tương thích đọc kép P01 B4, và kế thừa G-LIVE-1..7).
- Gói WP17 hiện thực hoá mã nguồn runtime theo đúng P09 sau khi có quyết định phê duyệt chính thức.
- Nhánh `feature/nhuy-reasoning-agent`. Đo Base bằng `git rev-parse HEAD`, ghi `git status --porcelain` trước khi sửa. Không tự ý đổi hợp đồng P09 đã duyệt.

## 2. Phạm vi
- ĐƯỢC GHI: `src/config.py` (cờ `mo_agent_semantic_enabled`), `src/maintenance/agent/{schema.py, validate.py, reconcile.py, prompt.py, client.py, agent.py}`, `src/maintenance/coordination/split.py`, `src/maintenance/engine.py` (chỗ `_step_2`, `_step_3`, `_decision_for`, `_with_decision`), `src/maintenance/enums.py`, `tests/test_maintenance/{test_agent_semantic.py, test_p1_split_semantic.py, test_agent_prompt.py}` (cập nhật test ghim prompt khi tăng prompt version), `…/evidence/WP17/*`, `…/reports/R16_thi-cong_WP17.md`.
- CẤM: Sửa file ngoài phạm vi, sửa `safety.py`, sửa `plan.md`, sửa SPEC, nới lỏng ngưỡng test hoặc tạo từ điển câu để lách kiểm tra vị trí. Không commit, stage, push.

## 3. Việc phải làm + xong khi
- Cập nhật schema Pydantic trong `schema.py` theo P09 §5.1 (`LocationEvidence`, `SemanticJobDecision`, `SplitAnalysis`, `AgentSemanticDecision`), duy trì tương thích đọc kép với P01 qua adapter `adapt_semantic_to_p01` và `semantic_metadata`.
- Sửa `validate.py` cài đặt vị từ liên kết giá trị - bằng chứng cho từng thành phần (building, floor, area) theo regex token-boundary và phân tách nơi ở vs nơi sự cố theo P09 §3.3.
- Sửa `reconcile.py` hạ G-1 từ SERIOUS thành MINOR (ADVISORY) khi trích dẫn hợp lệ theo P09 §4.1.
- Sửa `coordination/split.py` và `engine.py` tiếp nhận `SplitAnalysis`, chặn tách khi có quan hệ nhân quả, khi xảy ra ở hai nơi khác nhau, hoặc khi có nguy cơ an toàn theo P09 §4.2.
- Ánh xạ `bptn_reason` sang `ReasonCode` hiện hành theo bảng P09 §4.3; bổ sung cờ `mo_agent_semantic_enabled` vào `src/config.py`.
- Viết test đỏ-trước-sửa: probe B1 (4 ca vị trí bịa đặt + ca số tầng/căn hộ/tòa) $\rightarrow$ chặn 100%; probe B2 (chặn 1 job, chặn cùng loại, chặn 2 nơi); probe B3 (chặn sai next_step); probe B4 (adapter tương thích P01 100%). Đột biến: bỏ kiểm tra binding $\rightarrow$ test đỏ.
- Xong khi: `pytest -q tests/test_maintenance/test_agent_semantic.py tests/test_maintenance/test_p1_split_semantic.py` exit 0; toàn bộ suite `pytest -q` exit 0; ruff check và format sạch; probe WP12 `extra_invented_location.py` exit 0.

## 4. Luật
- Tuân thủ nguyên văn P09; không tự đổi contract đã duyệt. An toàn lưới sàn bảo toàn đơn điệu: mức an toàn cuối luôn là max(luật, Agent, mức hiện có).
- Lỗi mô hình hoặc dữ liệu không hợp lệ phải chuyển về `FALLBACK_RULE` minh bạch.

## 5. Tầng
- 🟠 (Logic tính năng + kiểm thử; tuân thủ nghiêm ngặt hợp đồng P09 🔴).

## 6. Report
- Dòng 1: `Vai: worker (vai-thi-cong) · loại: thi công · họ/model: … · Bước 0: exit … · hiểu việc: …`
- Dòng 2–4: `Handoff: handoffs/H16_thi-cong_WP17.md`, `Base: <SHA>`, `Head: <SHA>`.
- Báo cáo đầy đủ lệnh, exit codes, số test pass/fail, `git diff --stat`, các điểm chưa làm. Dòng cuối: `⏳ Chờ người duyệt.`
Report: `planning/06_2026-10-05_reasoning-agent/reports/R16_thi-cong_WP17.md` · Evidence: `planning/06_2026-10-05_reasoning-agent/evidence/WP17/package-check.txt`

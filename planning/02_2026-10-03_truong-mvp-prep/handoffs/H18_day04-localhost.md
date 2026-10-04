Bạn là worker của repo này. THI CÔNG Day04 (diễn tập demo qua server thật trên localhost) 🟠, một gói; không phóng thêm agent.
Bước 0: node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check; ghi exit + nguyên nhân; hub thiếu thì KHÔNG sửa managed rules, vẫn tiếp tục.
Thứ tự đọc: AGENTS.md → brain4agent/memory-distill.txt → deliverables/day03q-summary.md → specs/OPERATIONS.md §1–§5 → evidence/ter/demos/harness.py (harness cũ dùng TestClient).

## 1. Bối cảnh
Nhóm CHƯA có URL online; MVP 04/10 chỉ demo trên localhost. Chạy lại bốn nhóm demo (DEMO-01A/01B/01-RATING, DEMO-02 NEED_INFO + ASSET_UNCLEAR, DEMO-03 vật tư, DEMO-04 Bậc 2 ba lựa chọn + Bậc 1 đóng/hạ khẩn cấp + 403) qua SERVER THẬT: uvicorn bind 127.0.0.1 + HTTP client, không TestClient. Bản đo = worktree cô lập: C:/Users/caotr/AppData/Local/Temp/claude/c--P-151-truong/8cfb418c-be27-4e85-ad86-f18b4937791f/scratchpad/dev3 (detached tại origin/develop dff898e). Kết quả gắn nhãn environment=local, base_url=http://127.0.0.1:<cổng>; KHÔNG gọi là online; persistence restart/online gate vẫn mở.

## 2. Phạm vi (P = planning/02_2026-10-03_truong-mvp-prep/)
- Ghi: P/deliverables/day04/results.json, notes.md; P/evidence/day04/*; P/reports/R18_day04-localhost.md.
- CẤM: sửa worktree đo và src/, tests/, seed/, schema, config, .env của repo chính; DB/hosting chung, Postgres/Supabase, reset, deploy, push; stash/commit. Chỉ dùng cổng 8184 (một server mỗi lần), dừng đúng process của mình khi xong.

## 3. Việc phải làm — xong khi là lệnh + kết quả máy đọc được
- Env ép trong lệnh khởi động: MO_STORE=memory LLM_MODE=mock MO_PHOTO_STORE=local APP_ENV=development MO_ALLOW_RESET=false MO_JOBS_ENABLED=false DISABLE_SQLALCHEMY_CEXT_RUNTIME=1 PYTHONUTF8=1; cwd và PYTHONPATH = worktree; `python -m uvicorn src.main:app --host 127.0.0.1 --port 8184`; chờ /health 200 trước mutation. Mỗi nhóm demo khởi động server MỚI (memory sạch).
- Sao chép harness cũ sang P/evidence/day04/ rồi đổi tầng gọi: TestClient → httpx.Client(base_url) tới server thật (cùng bước, cùng expected theo OPERATIONS §2–§5, KHÔNG đổi expected). Lưu nguyên output máy (request che auth, status/body, thời gian, actor).
- Records theo schema SPEC-P06-DAY03 §2 (task_id "DAY04"; 11 khoá đủ; environment local; base_url đã nêu); PASS/FAIL cần actual + evidence_refs tồn tại (đường dẫn tương đối so với P); FAIL ⇒ owner (engine → Như Ý, API/storage → Châm Anh, UI → Trí, oracle → Trường); BLOCKED ⇒ block_reason + owner.
- Thêm 2 record: PERSIST-RESTART (dừng server rồi chạy lại, hỏi ticket cũ: với MO_STORE=memory mong đợi mất dữ liệu ⇒ ghi BLOCKED, owner Châm Anh, block_reason "cần Postgres/Supabase"; KHÔNG dựng DB) và UI-SMOKE (curl GET /ui trả 200, KHÔNG đo hành vi UI ⇒ nếu chỉ đo được HTTP 200 thì ghi rõ "chưa đo UI thao tác").
- notes.md: bảng giới hạn mô phỏng (dữ liệu SIM-, mock LLM, memory store, không online) + danh sách việc chưa xong.
- Xong khi: results.json hợp lệ, evidence tồn tại, mọi server đã dừng (kiểm không còn LISTEN trên 8184).

## 4. Luật
Không giả lập PASS; không đổi expected; D-01 delta/snapshot ngoài phạm vi MVP (không đo); thời gian lấy từ `date --iso-8601=seconds`; không token/password trong log.

## 5. Tầng
🟠. Cần đổi contract đã duyệt ⇒ KHÔNG tự đổi; ghi "Câu hỏi mở".

## 6. Mẫu report
Dòng1: Vai · thi công · họ/model · Bước 0 exit · hiểu việc. Dòng2–4: Handoff/Base/Head (SHA worktree dff898e…; KHÔNG tiêu đề # phía trước). Lệnh + exit, PASS/FAIL/BLOCKED từng record, so với Day03 (TestClient), bảng phân công, việc không làm, câu hỏi. Dòng cuối duy nhất ✅/🔁/⛔.

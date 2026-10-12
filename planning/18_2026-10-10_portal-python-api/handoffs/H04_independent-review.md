Bạn là worker của repo này. THẨM ĐỊNH độc lập, chỉ đọc implementation.
Bước 0: node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check; exit 2 dừng; missing hub ghi giới hạn.
Đọc AGENTS → kernel → index → plan18/specs → docs/portal.md → mã runtime; cấm đọc reports/handoffs thi công.
## 1. Bối cảnh
Giữ UI portal mới, nguồn duy nhất Python API; SPEC đã được root xác nhận người dùng duyệt.
## 2. Phạm vi
Đọc portal runtime/tests, Python API/engine để đối chiếu. Chỉ ghi H04/R04 và evidence/independent-review.
Cấm sửa implementation, .env/secret, DB/seed/Supabase, cổng8000, commit/push/deploy.
## 3. Việc và xong khi
Đối chiếu §C1–C4/§D2/§U1–U3/§T1–T4. Tự thiết kế ≥3 cách phá auth/privacy/workflow/vật tư.
Chạy npm.cmd test; node planning/18_2026-10-10_portal-python-api/evidence/independent-review/probes.mjs.
Xong khi raw output+exit tồn tại, mọi finding có file/dòng/reproduction, mỗi guard mới có negative control RED.
Backend chỉ memory mock http://127.0.0.1:8018; Next riêng http://127.0.0.1:3018.
## 4. Luật
Không sửa source để mutant; biến thể trong bộ nhớ. Không in token/password/key.
Root đang sửa UI nên browser/build là gate riêng sau snapshot ổn định; không coi unit thay browser.
## 5. Tầng
WP4 adversarial review 🔴; chạy measurements/docs theo hợp đồng 🟠/🟢, thiếu tier thì nâng một tầng.
## 6. Report
Dòng1 vai/loại/model/boot/hiểu việc; dòng2–4 Handoff/Base/Head; lệnh+exit/count/stat/SHA/phân công/không làm/câu hỏi.
Cuối report phán quyết ✅/🔁/⛔ theo scope; môi trường chưa đo phải ghi rõ.

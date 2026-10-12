Vai: Bạn là worker của repo này — loại THI CÔNG, tầng 🟠.
Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` (exit 0/1 đều ghi lại; KHÔNG chạy chế độ ghi).
Đọc theo thứ tự: `planning/05_2026-10-04_agent-hardening/plan.md` (Q01–Q07); `reports/R02_classify-metamorphic.md`; `src/maintenance/rules.py`; `tests/test_maintenance/test_classify_metamorphic.py`; `docs/playbook-v1.md` §6.1/§7.1.

## 1. Bối cảnh
Thẩm định độc lập (2026-10-04) sau vòng 1 tìm ra lỗi tách vị trí và một lỗi mới của vòng 1. Script/câu của thẩm định: `C:\Users\lenku\AppData\Local\Temp\claude\d--P151\640e8089-3b43-4a75-9055-cbb167391b76\scratchpad\agent_audit\` (`audit_a.py`, `audit_c.py`, `audit_d.py`).

## 2. Phạm vi
- ĐƯỢC: `src/maintenance/rules.py`, `src/maintenance/i18n/vi.yaml` (câu nhắc khu vực nếu thêm khu vực); THÊM test vào `test_classify_metamorphic.py`, `test_rules_review_fixes.py`.
- CẤM: `safety.py`, `lexicon.yaml` (nếu cần thêm khu vực vào `priority.high_areas` ⇒ ghi vào report cho SO), `engine.py` (SO đang sửa phần ưu tiên vị trí bổ sung và chuẩn hoá vị trí BPTN nhập), `proposer.py`, `src/api/`, `src/web/`, fixture/nhãn, `docs/`, `brain4agent/`. Không commit. Python + env + quy tắc ghi file: như H02.

## 3. Việc phải làm
(a) Vị trí lấy đúng NƠI CÓ SỰ CỐ, không phải tòa/tầng xuất hiện đầu tiên:
- "Căn 1508 tầng 15 tòa SIM-A, báo giúp hành lang tầng 3 có rác" ⇒ "Tòa SIM-A / Tầng 3 / Hành lang".
- "Em ở tòa SIM-B, đi qua hành lang tầng 3 tòa SIM-A thấy nhiều rác" ⇒ "Tòa SIM-A / Tầng 3 / Hành lang".
- "Rác vứt bừa bãi quá, em ở tòa SIM-A tầng 12" (căn hộ của cư dân, không phải khu vực chung) ⇒ thiếu khu vực (KHÔNG suy ra "Tầng 12" làm nơi sự cố nếu tầng đó chỉ gắn với "em ở/căn hộ").
- Gợi ý: bỏ qua cụm "căn hộ/căn <số>/em ở/nhà tôi … tầng N tòa X" (vị trí nơi ở) khi câu còn cụm vị trí khác; ưu tiên tầng/tòa đứng gần tên khu vực (trong cùng mệnh đề/±4 từ). Ghi rõ luật chọn.
(b) "toà SIM A" / "toa sim b" (có dấu cách, viết thường) ⇒ tòa "SIM-A"/"SIM-B"; "Hành lang tầng 3 toà SIM A nhiều rác" và "…toà SIM B…" phải ra hai tòa khác nhau. "tầng 03" ⇒ "Tầng 3".
(c) Khu vực: "cầu thang" đứng riêng ("Cầu thang tầng 5 tòa SIM-B đèn hỏng") ⇒ "Cầu thang bộ"; "lối thoát hiểm" / "đèn exit" ⇒ khu vực "Lối thoát hiểm" (đèn exit không sáng ⇒ KY_THUAT). Ghi cho SO nếu cần thêm "Lối thoát hiểm" vào `priority.high_areas`.
(d) LỖI MỚI do vòng 1 (thẩm định #8): "Tầng hầm B1 tòa SIM-A nước tràn vào tủ điện" bị VE_SINH (mẫu `SPILT`) ⇒ phải KHÔNG có playbook (OUT_OF_SCOPE, BPTN đọc) khi chất lỏng tràn vào/đọng ở tủ điện/ổ điện/hộp điện/ổ cắm/công tắc; "Đèn hành lang tầng 3 tòa SIM-A rơi ra, lòi cả dây điện" ⇒ không được phân loại như đèn hỏng thường nếu có "lòi/lộ dây điện" (để OUT_OF_SCOPE cho BPTN — tầng an toàn H03 sẽ bắt Bậc 1, đây là lớp phòng thủ thứ hai).
(e) Thêm các câu trên + biến thể vào kho/test; bộ biến thể phải giữ 0 vi phạm.

Xong khi (dán lệnh + exit nguyên văn): pytest toàn bộ exit 0, 0 fail; bộ biến thể 0 vi phạm; `audit_a.py`/`audit_c.py`/`audit_d.py` của thẩm định: liệt kê mục vị trí/phân loại trước → sau; ruff check/format exit 0; bằng chứng ĐỎ cho test mới trên `rules.py` hiện tại.

## 4. Luật
Không sửa kỳ vọng test cũ (bắt buộc phải sửa ⇒ ghi lý do cho SO). Không phóng agent con.

## 5. Tầng
🟠.

## 6. Mẫu report (`planning/05_2026-10-04_agent-hardening/reports/R04_classify-round2.md` trong worktree; trả về nội dung + đường dẫn worktree + file đã sửa)
Dòng 1 `Vai · thi công · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4 `Handoff: H04_classify-round2.md` / `Base:` / `Head: uncommitted (worktree …)`; lệnh + exit; trước/sau; đề xuất cho SO; dòng cuối phán quyết.

Vai: worker · thi công · Claude/Opus 5.5 · Bước 0 exit 1 (BRN-002 khối luật boot cũ [tự sửa], BRN-028 today.md 181 dòng [cần người]; KHÔNG chạy chế độ ghi) · hiểu việc: sửa `rules.py` để vị trí lấy đúng NƠI CÓ SỰ CỐ (bỏ tòa/tầng nơi ở), mã tòa có dấu cách, "tầng 03", khu "cầu thang"/"Lối thoát hiểm", chất lỏng vào thiết bị điện / dây điện hở ⇒ OUT_OF_SCOPE; thêm câu + biến thể, giữ 0 vi phạm; cấm safety/lexicon/engine/proposer/api/web/fixture/docs/brain, không sửa kỳ vọng test cũ, không commit.
Handoff: H04_classify-round2.md
Base: 699a566
Head: uncommitted (worktree D:\P151\.claude\worktrees\agent-a9a001e903a19d6c1)

## 1. Lệnh + exit (env `LLM_MODE=mock PYTHONUTF8=1`, python venv311 scratchpad)
| Lệnh | Kết quả |
|---|---|
| `python -m pytest -q -p no:cacheprovider` (base 699a566) | `2780 passed, 29 deselected` |
| `python -m pytest -q -p no:cacheprovider` (sau sửa) | `2865 passed, 29 deselected in 29.29s` · exit 0 · 0 fail · 0 skip (+85) |
| `ruff check src tests` | `All checks passed!` exit 0 |
| `ruff format --check src tests` | `75 files already formatted` exit 0 |
| `grep -cP '[\x08\x0b\x0c]'` rules.py / test_classify_metamorphic.py / test_rules_review_fixes.py | 0 / 0 / 0 |
| ĐỎ: 2 file test mới trên `rules.py` gốc (`git checkout 699a566 -- src/maintenance/rules.py`, rồi trả lại) | `137 failed, 877 passed` |

## 2. Bộ biến thể (`violations()`)
- Kho: 151 câu (+8 câu ngoài phạm vi: nước vào tủ điện/ổ cắm/hộp điện, đèn rơi lòi/lộ dây điện). Mẫu vị trí: 18 (+7: căn hộ nêu trước, "em ở tòa B, đi qua … tòa A", nơi ở nêu sau, "phòng 1208 tòa C nhờ báo … tòa A", "tầng 03 toà SIM A", "toa sim b cau thang", "Lối thoát hiểm") × có/không dấu ⇒ 5436 biến thể, 10872 phép kiểm.
- TRƯỚC (rules.py 699a566): **2117 vi phạm** (vị trí 1812: Tầng 15 thay Tầng 3, SIM-B/SIM-C thay SIM-A, "Tòa SIM / Tầng 03", cầu thang và lối thoát hiểm ra None, mỗi loại 302; loại việc 305).
- SAU: **0 vi phạm**. `RESIDUAL` rỗng.

## 3. Luật chọn vị trí (docstring `_location_parts`)
1. Khu vực: nhãn đầu tiên theo thứ tự `AREA_PATTERNS` (như cũ). Thêm "Lối thoát hiểm"; "cầu thang" đứng riêng ⇒ "Cầu thang bộ" (trừ "cầu thang máy").
2. Mệnh đề nơi ở: bắt đầu tại `căn <số>`/`căn hộ`/`phòng <số>`/`em|tôi|mình|anh|chị ở`/`nhà tôi|em|mình`, kết thúc ở dấu câu, xuống dòng, " - " hoặc động từ báo (báo, nhờ, thấy, đi qua, nhắn, phản ánh, xin, và). Mệnh đề có tên khu vực thì KHÔNG phải nơi ở (cư dân đang đứng đó: "Em ở tòa SIM-B tầng 9 hành lang, báo: …").
3. Tòa / tầng: lấy cụm gần khu vực nhất (theo vị trí ký tự), bỏ cụm trong mệnh đề nơi ở; không có khu vực thì lấy cụm đầu tiên.
4. Tòa nơi ở vẫn dùng làm dự phòng khi câu không nêu tòa nào khác (giữ "em ở căn 2-07 tòa SIM-B, đèn hành lang tầng 2"). Tầng nơi ở KHÔNG BAO GIỜ dùng: thiếu ⇒ hỏi cư dân ("Rác vứt bừa bãi quá, em ở tòa SIM-A tầng 12" ⇒ thiếu `floor`, `area`).
5. Mã tòa "toà SIM A"/"toa sim b" ⇒ "SIM-A"/"SIM-B" (một từ ≥2 chữ + MỘT chữ/số; "ở" không phải chữ mã). Tầng bỏ số 0 đầu: "03" ⇒ "3", "B01" ⇒ "B1".
- Phân loại (d): `ELECTRICAL_HAZARD_PATTERNS` — chất lỏng (nước, tràn, ngập, rò rỉ, thấm…) ≤5 từ trước tủ điện/ổ điện/hộp điện/ổ cắm/công tắc/cầu dao/bảng điện, hoặc thiết bị đó bị ngập/ướt; "lòi/lộ/hở (cả) dây điện", "dây điện … lòi/lộ/hở" ⇒ OUT_OF_SCOPE trước mọi luật khác.

## 4. Thẩm định: trước → sau (ROOT = worktree; output `scratchpad/h04/{before,after}_{a,c,d}.txt`, exit 0 cả 3 script)
| Script | ERR trước → sau | Chuyển ERR → OK |
|---|---|---|
| audit_a | 16 → 12 | A65 (tầng 03), A67 (toà SIM A), A69 (cầu thang), A73 (em ở tòa B, đi qua … tòa A) |
| audit_c | 6 → 5 | C15 (toà SIM A ≠ toà SIM B, hết trùng nhầm) |
| audit_d | 9 → 5 | D04a (căn 1508 tầng 15 ⇒ Tầng 3), D04b (⇒ Tòa SIM-A), D05b (bổ sung "hầm B1" ⇒ Tầng B1 / Hầm xe), D07 (nước vào tủ điện không còn giao phòng Vệ sinh) |
- Mục của H04 đã đổi phần phân loại nhưng còn ERR vì phần ngoài phạm vi:
  - A36, D08, D08b: phân loại nay OUT_OF_SCOPE / VERIFYING (trước: ROUTED VE_SINH / KY_THUAT); kỳ vọng EMERGENCY là việc tầng an toàn H03.
  - A71: nay KY_THUAT, vị trí "Tòa SIM-C / Tầng 9 / Lối thoát hiểm"; còn lệch ưu tiên MEDIUM vs HIGH ⇒ cần SO thêm "Lối thoát hiểm" vào `priority.high_areas`.
- Còn ERR, không thuộc H04 (không đổi trước/sau): A02, A03, A47, A57, A58 (T2-03 an toàn), A15, A29, A30, A33, D06a (an toàn), A59 (ưu tiên), B09 (BPTN nhập vị trí tự do — engine), C10d ("đèn bốc khói" không có triệu chứng hỏng ⇒ sau khi BQL hạ là OUT_OF_SCOPE, BPTN đọc), C16c, C18d, C25, D01, D02b (điều phối engine).

## 5. Đề xuất cho SO
- `lexicon.priority.high_areas`: thêm "Lối thoát hiểm" (nhãn mới trong `AREA_PATTERNS`; lối đi chung khi sự cố). `vi.yaml` `location_area` chưa liệt kê "lối thoát hiểm" — tôi KHÔNG sửa vì danh sách hỏi cư dân là quyết định UI/nhóm; sửa thì thêm "lối thoát hiểm" vào chuỗi.
- "đèn exit": tôi KHÔNG suy ra khu "Lối thoát hiểm" từ chữ "đèn exit" (câu kho "Đèn exit thoát hiểm không sáng" phải không mang vị trí; vị trí phải do cư dân nêu). Nếu muốn suy ra thì cần SO quyết.
- Engine (đang sửa ưu tiên vị trí bổ sung): luật mới của `rules.py` đã tự cho D05b đúng vì tầng nơi ở bị bỏ; thứ tự ghép `_content` không đổi.
- Proposer: báo cáo hazard là OUT_OF_SCOPE ⇒ nếu LLM đề xuất playbook thì vẫn ra `needs_review` (BPTN duyệt), không tự giao. Không sửa (ngoài phạm vi).
- Đánh đổi biết trước: tầng nơi ở không bao giờ dùng ⇒ "Căn 1508 tầng 15 tòa SIM-A báo đèn hành lang hỏng" sẽ hỏi tầng thay vì giao Tầng 15 (an toàn hơn giao nhầm). "tran" không dấu cũng là "trần": "trần … gần công tắc" bị coi là hazard (OUT, BPTN đọc — hướng an toàn).

## 6. Phân công thực tế
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| H04 phân loại + vị trí vòng 2 | 🟠 | Claude Opus 5.5 (lên một tầng; không phóng agent con) |

## 7. git diff --stat (chưa commit)
```
 src/maintenance/rules.py                           | 94 +++++++++++++++++++---
 .../test_maintenance/test_classify_metamorphic.py  | 17 ++++
 tests/test_maintenance/test_rules_review_fixes.py  | 67 +++++++++++++++
 3 files changed, 169 insertions(+), 9 deletions(-)
 ?? planning/05_2026-10-04_agent-hardening/reports/R04_classify-round2.md
```
Không sửa kỳ vọng test cũ nào.

✅ thi công xong: pytest 2865 pass / 0 fail, biến thể 0 / 10872, ruff xanh, ĐỎ trên gốc 137 fail; còn chờ SO: `high_areas` + "Lối thoát hiểm", tầng an toàn H03 cho A36/D08.

Vai: worker (vai-thi-cong) · loại: thi công · họ/model: Claude Opus 5.5 · Bước 0: exit 1, đúng một dòng `BRN-002 AGENTS.md thiếu/cũ khối luật: boot` (miễn trừ Q21) · hiểu việc: chỉ ghi khối `safety` + `lexicon_version` của lexicon, YAML/test P1 mới, các dòng test ở SPEC-P03 §5 + phần SO giao thêm (Q22, Q24); xong khi C1–C8 có evidence + meter `GATES_FAILED=0` + pytest 0 fail; cấm safety.py/catalog.py/engine.py/rules.py/khối priority/SPEC/plan, cấm hạ nhãn, cấm nới ngân sách
Handoff: handoffs/H02_thi-cong_WP2.md (+ tin SO: Q22, đưa lên base mới, S-00, Q24)
Base: 3e3a3f8 (đi qua 690ac49 → 76d05af → 6c009c2 → 587da8a → 3e3a3f8 theo tin SO; mỗi lần mang patch staged sang, áp sạch, không xung đột)
Head: chưa commit (SO gộp)

## Cổng (lexicon `2026-10-05.p1d`, base 3e3a3f8; evidence ở `evidence/WP2/`)
| Cổng | Lệnh (`LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=.`, python venv viết nguyên văn) | Kết quả | EXIT |
|---|---|---|---|
| C1 | `pytest -q tests/test_maintenance/test_safety.py -k stop_set` | 1079 pass (1066 + 13 ca Q24) | 0 · [c1](../evidence/WP2/c1.txt) |
| C2 | `pytest -q -s … -k false_alarm_budget` | 4 pass (b_fp EM 0 / UNC 4; b_fp2 EM 3; jx_negfp EM 1; fixture = {CLN-004, TEC-005}) | 0 · [c2](../evidence/WP2/c2.txt) |
| C3 | `pytest -q test_safety.py test_safety_p0.py test_cr03_targets.py` | 1552 pass | 0 · [c3](../evidence/WP2/c3.txt) |
| C4 | `pytest -q test_safety_p1.py` | 117 pass | 0 · [c4](../evidence/WP2/c4.txt) |
| C5 | `pytest -q test_safety_metamorphic.py` | 65 pass | 0 · [c5](../evidence/WP2/c5.txt) |
| C6 | `pytest -q -s test_safety_p1.py -k corpus` (logic Q22: S-11 đèn rơi HOẶC S-08) | 1 pass (259 câu đổi mức, 0 câu ngoài hai nhóm) | 0 · [c6](../evidence/WP2/c6.txt) |
| C7 | `…/REF-p1-safety-meter.py` | `GATES_FAILED=0` (STOP 0 · ngân sách ok · MUST_CATCH 0/47 · MUST_NOT_RAISE 0/21 · biến thể 0/980 · CORPUS 0) | 0 · [c7](../evidence/WP2/c7.txt) |
| C8 | `pytest -q -s test_safety.py -k 24kb` | 2 pass (chậm nhất 0.362 s) | 0 · [c8](../evidence/WP2/c8.txt) |
| Biến thể §4.2 | `test_safety_metamorphic.py test_classify_metamorphic.py` | 991 pass | 0 · [variants](../evidence/WP2/variants.txt) |
| Tách | `…/REF-split-verdict.py --variants` | `MUST_SPLIT=32 MUST_NOT_SPLIT=18 FAILURES=0`, `VARIANT_FAILURES=0` | 0 · [split-verdict](../evidence/WP2/split-verdict.txt) |
| Q24 trước/sau | inline `python -c` trên 13 ca `q24:*` (BEFORE = lexicon p1c trước Q24, AFTER = p1d) | 7 ca UNCLEAR → NONE; 5 ca `keep` giữ đúng mức (3 EMERGENCY, 2 UNCLEAR); `Q24_FAILURES=0` | 0 · [q24](../evidence/WP2/q24-before-after.txt) |
| Ruff | `ruff check src/ tests/` + `ruff format --check src/ tests/` | sạch, 101 file | 0 · [ruff](../evidence/WP2/ruff.txt) |
| A-06 câu mới | inline `python -c` `safety.assess` với lexicon p1d | câu cũ "…bình gas nghe xì xì" ⇒ EMERGENCY (S-10 bắt); câu mới "…nghe tiếng xì xì từ bình gas" ⇒ NONE | 0 · [a06](../evidence/WP2/a06.txt) |
| Toàn bộ | `pytest -q -p no:cacheprovider` (bắt đầu 22:18:46) | 3226 tổng = 3225 pass / **1 fail** / 0 skip / 48 deselected | 1 · [pytest](../evidence/WP2/pytest.txt) |
| Đỏ trước (base 76d05af, lexicon p0g) | `pytest -q test_safety_p1.py` | 73 fail, 39 pass (ngưỡng ≥ 45) | 1 · [red-before](../evidence/WP2/red-before.txt) |
| Đột biến (lexicon p1d, base 3e3a3f8) | (a) `active_phases: [P0]` · (b) bỏ "gà" khỏi `homographs.ga` · (c) bỏ chủ ngữ ở đầu 3 span S-11 (6 chỗ) | (a) 71 fail · (b) `P1-FP-07` fail · (c) `P1-HED-03` + `P1-FP-05` fail; sau mỗi lần `git diff` lexicon so với index = rỗng | 1 · [a](../evidence/WP2/mutation-a.txt) [b](../evidence/WP2/mutation-b.txt) [c](../evidence/WP2/mutation-c.txt) |

**Mở rộng phạm vi do SO duyệt (2 chỗ, sinh ra từ việc thêm S-00 và nới S-10):**
- `test_p1_contracts.py::test_c12_…`: lọc S-00 khỏi `raw["signals"]` trước khi chèn bản thử (thêm 1 dòng, ý test giữ nguyên).
- `test_agent_unit.py::test_a_06_…`: đổi câu sang "Hành lang tầng 3 tòa S1 nhiều rác, nghe tiếng xì xì từ bình gas", trích dẫn "tiếng xì xì từ bình gas". Luật ra NONE (đo ở a06.txt), Agent nâng lên EMERGENCY, `detected_by=LLM`. Không sửa pattern. A-06b giữ nguyên câu cũ, vì A-06b dùng lexicon chỉ P0.

**1 fail còn lại** là `test_engine.py::test_partial_delivery_updates_the_stock_the_waiting_ticket_shows`. Fixture `engine()` dùng đồng hồ thật, lúc chạy sau 22:00 nên ra `OUT_OF_HOURS`. SO đã sửa trên nhánh chính (cố định `Clock(MONDAY_9AM)`); theo chỉ đạo SO, worktree này không sửa.

Vòng `lexicon_version`: `p1a` (nháp) → `p1b` (S-07 "đèn" đứng riêng, S-12 "hóa chất đó") → `p1c` (+ S-00) → `p1d` (Q24: `b01_prefix_words` thêm "thay bong den/thay den/…" và "nho, xin, giup"). "thay" CHỈ được nhận khi đi liền danh từ đèn, vì "thay" trùng chữ "thấy": khi thử thêm "thay" đứng riêng, câu "Thay bóng đèn thì thấy cháy" bị hạ UNCLEAR → NONE, nên tôi bỏ bản đó.

## Phân công thực tế
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP2 a–e, Q22, S-00, Q24 | 🔴 | Claude Opus 5.5 |
| Tự thẩm định nội bộ (16 câu phá ở p1b; 5 câu Q24 phải giữ mức + 1 câu tự tìm "thay = thấy") | 🔴 | Claude Opus 5.5 |

## Việc KHÔNG làm + lý do
- `test_partial_delivery_…`: SO đã sửa trên nhánh chính và chỉ đạo không sửa ở đây.
- Entry stash `wp2-a3198662-rebase-6c009c2` (SHA 658a5c61…): để nguyên theo chỉ đạo SO (SO báo người dùng).

## Câu hỏi mở
Không có. Điểm yếu đã biết để WP12 soi: "Đến trưa hành lang quá nóng" (S-07, đầu câu).

⏳ Chờ người duyệt.

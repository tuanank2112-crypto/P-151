Vai: worker · thi công · Claude Sonnet 5.5 (tầng 🟠, tự làm, không phóng agent con) · Bước 0 exit 1 (CẦN NÂNG CẤP: BRN-002 tự sửa + BRN-028 today.md dài; vùng brain không thuộc phạm vi, KHÔNG chạy chế độ ghi) · hiểu việc: phạm vi = rules.py (chỉ phần phân loại) + proposer.py + test mới/thêm; xong khi = pytest ≥1641+mới & 0 fail, ruff check/format 0, đỏ trên code cũ, bảng trước/sau; cấm = engine/safety/seed/docs/brain4agent/test khác, không sửa nhãn fixture, không xử lý Q22
Handoff: H02_rules-proposer.md
Base: 7b93496 (worktree reset về nhánh fix/nhuy-logic-review; worktree gốc ở 5591925 chưa có plan 04)
Head: uncommitted (worktree D:\P151\.claude\worktrees\agent-a4c1475ef146c9b9e)

## Lệnh + exit code
- `LLM_MODE=mock PYTHONUTF8=1 python -m pytest -q -p no:cacheprovider` -> `1660 passed, 29 deselected in 21.16s` exit 0 (baseline trước khi sửa: 1641 passed; thêm 19 test)
- `pytest tests/test_maintenance/test_fixtures.py test_acceptance.py test_cr03_targets.py` -> `54 passed` (không đổi; nhãn fixture không sửa)
- `python -m ruff check src tests` -> `All checks passed!` exit 0
- `python -m ruff format --check src tests` -> `71 files already formatted` exit 0
- `grep -cP '[\x08\x0c\x0b]'` trên 4 file đã sửa/thêm -> 0 / 0 / 0 / 0
- Test: tổng 1660 · pass 1660 · fail 0 · skip 0 (29 deselected theo cấu hình repo sẵn có)

## Bằng chứng ĐỎ
Cất rules.py + proposer.py về bản cũ (`git stash push -m h02-red-tag -- <2 file>`, lấy SHA, `git stash apply <sha>` rồi `git stash drop`; stash của phiên khác nguyên vẹn), chạy test_rules_review_fixes.py + test_proposer.py:
`19 failed, 6 passed` (19 = đúng 19 test mới; 6 test cũ vẫn xanh). Sau apply: diff còn nguyên, pytest lại 1660 passed.

## git diff --stat (chưa commit; chưa tính file mới)
 src/maintenance/proposer.py             |  9 +++--
 src/maintenance/rules.py                | 63 ++++++++++++++++++++++++++++-----
 tests/test_maintenance/test_proposer.py | 18 ++++++++++
 + file mới (untracked): tests/test_maintenance/test_rules_review_fixes.py (17 ca parametrize)

## Bảng trước / sau (playbook / reason_code)
| Câu | Trước | Sau |
|---|---|---|
| Đèn cầu thang bộ tầng 3 tòa SIM-A nhấp nháy | None / OUT_OF_SCOPE | PB-TEC-01 |
| Đèn hành lang tầng 3 tòa SIM-A bị hư | None / OUT_OF_SCOPE | PB-TEC-01 |
| Đèn ở hành lang tầng 5 tòa SIM-A không sáng | None / OUT_OF_SCOPE | PB-TEC-01 |
| Đèn trong hầm xe B1 tòa SIM-A không sáng | None / OUT_OF_SCOPE | PB-TEC-01 |
| Đèn led sảnh chính tòa SIM-A bị vỡ | None / OUT_OF_SCOPE | PB-TEC-01 |
| Hành lang tầng 3 tòa SIM-A mất đèn | None / OUT_OF_SCOPE | PB-TEC-01 |
| Đèn hành lang tầng 3 không lên | None / OUT_OF_SCOPE | PB-TEC-01 |
| Sảnh chính tòa SIM-B bẩn quá | None / OUT_OF_SCOPE | PB-CLN-01 |
| Hành lang tầng 3 dơ quá | None / OUT_OF_SCOPE | PB-CLN-01 |
| Có phân chó ở sảnh chính tòa SIM-A | None / OUT_OF_SCOPE | PB-CLN-01 |
| Có người nôn ra sàn hành lang tầng 4 | None / OUT_OF_SCOPE | PB-CLN-01 |
| Nước tiểu ở góc cầu thang bộ tầng 2 | None / OUT_OF_SCOPE | PB-CLN-01 |
| Khi đến tầng 5 tòa SIM-A tôi thấy cửa thoát hiểm bị hỏng | PB-TEC-01 (sai) | None / OUT_OF_SCOPE |
| Tôi đến sảnh chính thì thấy thang máy hỏng | PB-TEC-01 (sai) | None / OUT_OF_SCOPE |
| Đi đến hầm xe thì barrier tắt nguồn | PB-TEC-01 (sai) | None / OUT_OF_SCOPE |
| Tôi là Bùi Văn An, đèn hành lang tầng 3 không sáng | None / CATEGORY_UNCLEAR | PB-TEC-01 |
| Tôi bị bận nên báo muộn: đèn hành lang tầng 3 không sáng | None / CATEGORY_UNCLEAR | PB-TEC-01 |

Proposer (e): bad enum `service_category="HACK"` -> trước: ValueError thoát khỏi propose; sau: fallback luật, note "LLM lỗi (ValueError); dùng luật cố định", log FALLBACK_RULE. `reason` 20000 ký tự -> cắt 500 (MAX_REASON_CHARS) cả ở ticket lẫn AI log.

## Cách làm (rules.py)
Giữ nguyên `normalize`, `extract_location`, `missing_location_parts`, `_location_parts`. Thêm `_classification_text`: trên chữ CÓ dấu, thay marker ASCII trước `normalize` (đèn->luminaire, đến->arrive, Bùi->surname, bận->busy, bẩn/dơ->dirty, phân->feces, nôn->vomit). Từ mềm (dirty/feces/vomit/nước tiểu) chỉ tính khi có khu vực chung trong câu. Đèn có dấu tính khi khu vực đứng ngay sau ("đèn ở hành lang", "đèn led sảnh chính") hoặc "mất đèn" + khu vực chung. Chữ không dấu `den` giữ hành vi cũ, thêm lookbehind khi/đi/tôi. `\bbui\b` không khớp trước "van"/"thi". Thêm từ hỏng: không lên, hư, vỡ, nhấp nháy, mất đèn.

## Việc KHÔNG làm + lý do
- Q22 "bóng đèn bị cháy": giữ hành vi cũ (handoff cấm).
- "Hành lang đầy rác và đèn cũng hỏng": cố ý KHÔNG nới đèn có dấu cách xa khu vực, vì test cũ test_llm_abstaining_on_a_rules_match_is_ambiguous kỳ vọng luật chỉ bắt vế rác (lần đầu tôi nới rộng làm test này đỏ; đã thu hẹp lại thay vì sửa test).
- Không commit (theo ghi đè của người giao; hook pre-commit đòi cập nhật brain4agent/memory/hot/ là vùng cấm).
- Không chạy init_brain chế độ ghi (vùng brain cấm).

## Câu hỏi cần người
- "Hành lang tầng 3 bẩn" kèm "đèn" ở xa vẫn có thể rơi vào CLN; có muốn xếp là CATEGORY_UNCLEAR không (cần quyết, đụng test cũ)?
- Chữ không dấu hoàn toàn ("den hanh lang bi hu") giờ ra TEC nhờ từ "hu"; xác nhận chấp nhận.
- Lưu ý chung: file làm việc ở working copy là CRLF (autocrlf), index LF; test_proposer.py tôi giữ CRLF để ruff format xanh.

Phán quyết tự đánh giá: ✅ (mọi mục "xong khi" 1-4 đạt, số đo ở trên; chờ SO đo lại)

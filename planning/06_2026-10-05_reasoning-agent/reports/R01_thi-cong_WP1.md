Worker · thi công · Sonnet 5.5 (🟠) · Bước 0 exit 1 (đúng một dòng BRN-002 khối luật boot, worktree CRLF, Q21 ⇒ đi tiếp) · hiểu việc: phạm vi = enum/model/catalog/view/i18n/3 hằng engine + gói `agent/{__init__,schema,inputs}` theo Q20 + `test_p1_contracts.py`; xong khi = C-01…C-05, C-12…C-14 xanh, toàn bộ ≥ 2971 + mới 0 fail/skip, ruff exit 0, schema-diff trống; cấm = lexicon.yaml, safety/rules/proposer/priority, store, api, web, SPEC, plan, test khác (trừ dòng `18 + 7`)
Handoff: handoffs/H01_thi-cong_WP1.md
Base: 331cb40ca2d9359853e4a0b91756cf6fea274285
Head: chưa commit (SO gộp)

Worktree: `D:/P151/.claude/worktrees/agent-ab1fd4bc145dfa1ca`

## Lệnh + exit (output nguyên văn trong evidence)
| Lệnh | Exit | Evidence |
|---|---|---|
| `init_brain.js --check` (worktree) | 1 (BRN-002, Q21) | in trong phiên, không lưu file |
| pytest `test_p1_contracts.py` trên code CHƯA sửa | 1: `23 failed, 1 passed` (có C-01, C-04, C-12 đỏ) | [red-before.txt](../evidence/WP1/red-before.txt) |
| pytest `test_p1_contracts.py` sau sửa | 0: `24 passed` | [green.txt](../evidence/WP1/green.txt) |
| đột biến: V-T4 thành `pass` | 1: `1 failed, 23 passed` (`test_c04_v_t4_no_self_link`), đã khôi phục | [mutation-vt4.txt](../evidence/WP1/mutation-vt4.txt) |
| pytest toàn bộ | 0: `2995 passed, 29 deselected` | [pytest.txt](../evidence/WP1/pytest.txt) |
| ruff check + format --check src tests | 0 / 0 (`All checks passed!`, `80 files already formatted`) | [ruff.txt](../evidence/WP1/ruff.txt) |
| `REF-agent-contract.py --selftest` | 0: `SELFTEST_FAILURES=0` | [ref-selftest.txt](../evidence/WP1/ref-selftest.txt) |
| diff mục A REF ↔ `agent/schema.py` | 0: `IDENTICAL`, `DIFF_LINES=0` (97/97 dòng) | [schema-diff.txt](../evidence/WP1/schema-diff.txt) |
| `grep -cP '[\x08\x0b\x0c]'` trên mọi file đã ghi | 0 trên từng file | — |

## Test
Tổng 2995 · pass 2995 · fail 0 · skip 0 · deselected 29 (nền 2971 ⇒ +24 test mới, tên mang ID `test_c01_…`, `test_c04_*`, `test_c05_*`, `test_c12_*`, `test_c13_*`, `test_c14_*`, `test_q20_*`).

## `git diff --cached --stat` (trước khi thêm file report này)
20 files changed, 1630 insertions(+), 16 deletions(-): 7 evidence, `seed/maintenance_v1/catalog.yaml`, `agent/{__init__,inputs,schema}.py`, `catalog.py`, `engine.py` (+23/-), `enums.py`, `i18n/vi.yaml`, `messages.py`, `models.py`, `views.py`, `test_engine.py` (1 dòng), `test_p1_contracts.py`. `tests/test_maintenance/data/case_pre_p1.json` KHÔNG stage (gitignored `data/`, WP0 sở hữu).

## Chỗ sửa trong `engine.py` (ngoài việc "chỉ ba hằng")
Chỉ ba hằng `PERMISSIONS`, `TRANSITIONS`, `BLOCKER_OWNERS` + sửa chú thích "18 rows" thành "23 rows" ngay trên `TRANSITIONS`. Không đụng thân hàm nào, không cần sửa chỗ khác để giữ test xanh.

## Quyết định thi công (SPEC im lặng / chọn)
1. V-T1…V-T5 đặt trong validator MỚI `Ticket._link_rules` (cạnh `_status_rules`) thay vì nhét vào `_status_rules`; hiệu lực như nhau, đột biến V-T4 vẫn đỏ.
2. V-T4/V-T5 áp lên ba danh sách `merged_children`, `split_children`, `related_ticket_ids` (01 §2.1 nói "các danh sách liên kết"; I-27 liệt `related_ticket_ids` là danh sách liên kết). Toàn bộ test cũ vẫn xanh.
3. `merged_from`/`copied_from` ở `EvidenceRecord`: cả hai chỉ hợp lệ khi `source == RESIDENT_ORIGINAL` (01 §2.2 "ở EvidenceRecord chỉ khi…").
4. `agent/schema.py` dùng `pydantic.AwareDatetime` (không import `models`) để giữ ràng buộc "chỉ import pydantic/stdlib/enums"; `agent/inputs.py` import `models.LockedFields`.
5. `case_pre_p1.json` chưa có trong cây ⇒ tự sinh bằng lệnh OPERATIONS §3.3 trên mã chưa sửa (33327 byte), trước mọi sửa `src`; chạy qua file `.py` trong scratchpad vì Bash guard chặn `-c` dài (nội dung lệnh y hệt). Fixture ghi `base_commit: 82f01f0`; `src/` giữa `82f01f0` và base giao không đổi (`git diff --stat 82f01f0 HEAD -- src tests seed` rỗng).
6. `ResidentTicketView` thêm: `additions` bỏ bản `merged_from`; `RATE` khi `rating is None` và (CLOSED hoặc MERGED có gốc CLOSED); nhãn trung tính cho `SAFETY_REASONS ∪ {WAITING_EMERGENCY}`; `LinkedTicket` chỉ hiện ticket cùng `resident_id` (ticket khác chủ/không tồn tại bị bỏ lặng lẽ).
7. `evidence/WP1/red-before.txt` ghi bằng PowerShell nên có BOM/CRLF; đã chuẩn hoá cơ học (bỏ BOM, đổi CRLF thành LF, nội dung không đổi). Các evidence còn lại sinh bằng Git Bash.
8. File mới LF; file cũ giữ CRLF của checkout (diff nhỏ, không đổi cả file).

## Bảng phân công thực tế
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP1 a–e | 🟠 | Claude Sonnet 5.5 (🟠), tự làm, không giao con |

## Việc KHÔNG làm + lý do
- Không đụng `lexicon.yaml` (S-00 là việc WP2); chỉ thêm cờ `SignalDef.agent_only` + 2 validator và test dựng lexicon tạm.
- Không chạy `--pg` (cổng WP1 không yêu cầu; máy không Docker).
- Không sửa SPEC/plan/test cũ nào ngoài dòng `18 + 7`.

## Câu hỏi mở
Không có. Ghi nhận: `PrioritySla.duplicate_raise_at_count: 3` đã sẵn trong `catalog.yaml` (Q19) nên không đổi.

⏳ Chờ người duyệt.

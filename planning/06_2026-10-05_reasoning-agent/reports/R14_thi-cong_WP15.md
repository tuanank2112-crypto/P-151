Vai: worker (vai-thi-cong) · loại: thi công · họ/model: Claude Sonnet 5.5 · Bước 0: exit 0 · hiểu việc: phạm vi = `coordination/{split,merge,neighbors}.py` + test mới + evidence WP15; xong khi = test mới EXIT=0, probe F4-F7/F9 đạt, `[two-places]` rules/mirror no-split, REF `VARIANT_FAILURES=0`, 4 đột biến làm đỏ, cổng pytest/ruff; cấm = engine.py, agent/**, mọi gác từ khoá lên quyết định của Agent (Q36), commit/push
Handoff: handoffs/H14_thi-cong_WP15.md
Base: 8cf52d4cd591a7d1a7e66d5f1f32f9111330de2c
Head: 8cf52d4cd591a7d1a7e66d5f1f32f9111330de2c (working tree chưa commit)

`git status --porcelain` trước sửa: 4 file planning đã bẩn (H14, plan.md, SPEC-P08, SPEC-P10) + `.claude/worktrees/`, `evidence/WP16-review-v6/`, `scratch/` (không đụng). Trong lúc làm, `brain4agent/memory-distill.txt` và `brain4agent/memory/hot/today.md` xuất hiện bẩn: KHÔNG phải do worker này.

## Lệnh và kết quả (evidence: `evidence/WP15/`)
| Lệnh | Exit | Kết quả |
|---|---|---|
| Bước 0 `init_brain.js --check` | 0 | NÃO ĐÃ OK |
| pytest file mới trước sửa (`red-before.txt`) | 1 | 10 failed (F4×2, F5×2, F6×2, F7×2, F9×2), 9 passed (F8: 6 + 3, xanh sẵn trên Base = ghim hành vi, ĐÚNG theo handoff) |
| pytest file mới sau sửa (`green.txt`) | 0 | 19 passed |
| probe `extra_undo_split` (`probes-after.txt`) | 0 | `RESULT problems=0` (a)(b)(c)(d) đạt, cả rules và mirror |
| probe `extra_dup_count_walk` | 0 | `RESULT walks=32 walks_with_violation=0` |
| probe `extra_followup_split_safety` | 0 | `RESULT problems=0` (b) giữ nơi BPTN chốt |
| probe `break6_wrong_split` | 0 | 3 dòng `[two-places]`: `rules=no-split | mirror=no-split`; `violations=0` (reckless vẫn tách 25/28 = đúng Q36, Agent quyết) |
| `REF-split-verdict.py --variants` (`split-verdict.txt`) | 0 | `VARIANT_FAILURES=0`, `SINGLE_JOB_VARIANTS_SPLIT=0`, các dòng 36/36 OK |
| pytest toàn bộ (`pytest.txt`) | 0 | `3704 passed, 85 deselected` (mốc 3685 + 19 mới; 0 fail) |
| `--pg` (`pg.txt`) | NOT_RUN | Docker tắt, không cố bật |
| `ruff check src tests` (`ruff.txt`) | 0 sau khi sửa import thừa/format của file test mới | sạch |
| `ruff format --check src tests` | 1 | 1 file lệch: `src/main.py` (KHÔNG thuộc phạm vi, không có trong `git diff`, lỗi có sẵn); file của gói này sạch |

Ghi chú: pytest toàn bộ chạy TRƯỚC khi `ruff --fix`/`ruff format` sửa 2 import thừa + xuống dòng trong file test mới; sau đó chạy lại riêng file mới: 19 passed, EXIT=0 (`green.txt`). Chưa chạy lại toàn bộ sau bước này.

Test tổng/pass/fail/skip: 3704 / 3704 / 0 / 0 (85 deselected = bộ `--pg`, cùng cơ chế mốc 3685).

## Đột biến (mỗi cái khôi phục, `git diff --stat -- src/maintenance/rules.py` = rỗng; file `mutation-{a,b1,b2,c}.txt`)
| Đột biến | Kết quả |
|---|---|
| a: bỏ `_release_duplicate_count` trong `undo_split` | 2 failed (F4 rules/agent) |
| b1: xoá nhánh `two-places` trong `rules.split_verdict` (tạm) | 6 failed (F8 (i) rules×3, mirror×3) |
| b2: thêm kiểm `location_mentions` > 1 vào nhánh Agent `_has_two_jobs` | 3 failed (F8 (ii)) |
| c: bỏ chép khoá vị trí ở `_build_follow_up` | 2 failed (F9 mirror/agent-reads-text) |

## `git diff --stat` (src/tests, Head = Base, chưa commit)
```
 src/maintenance/coordination/merge.py     | 35 ++++++++++++++++++++++++++++++
 src/maintenance/coordination/neighbors.py |  5 +++++
 src/maintenance/coordination/split.py     | 36 +++++++++++++---------------
 3 files changed, 62 insertions(+), 14 deletions(-)
```
Untracked trong phạm vi: `tests/test_maintenance/test_p1_audit_fixes_coord.py`, `planning/06_2026-10-05_reasoning-agent/evidence/WP15/*`, `planning/06_2026-10-05_reasoning-agent/reports/R14_thi-cong_WP15.md`.
`grep -cP '[\x08\x0c\x0b]'` = 0 trên 3 file src + file test mới. `rules.py`, `engine.py`, `agent/**` không đổi.

## Nội dung sửa
- F4 `split.py::undo_split`: ghi `previous_blocker` trước chuyển MERGED, gọi `_release_duplicate_count(work, previous_blocker, now)` sau chuyển.
- F5 `undo_split`: chỉ thêm id vào `merged_children` (và audit `LINK_TICKETS`) khi chưa có.
- F6 `undo_split`: `GuardError` nếu `_has_open_merged_children(work)`, kiểm trước mọi ghi.
- F7 `merge.py`: hàm mới `_recount_duplicates` (đếm nghi trùng VERIFYING/DUPLICATE trỏ tới ticket + MERGED vào nó không phải con tách), gọi trong `_unmerge` ngay sau chuyển RECEIVED; có audit `LINK_TICKETS` khi số đổi.
- F9 `neighbors.py::_build_follow_up`: chép `locked_fields.location` của nguồn.
- F8: không sửa runtime; 2 nhóm test ghim (rules/Mirror không tách; Agent trả 2 jobs hợp lệ vẫn tách).

## Test cũ đổi khẳng định
Không có (không sửa/nới test cũ nào; không có test cũ đỏ).

## Bảng phân công
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP15 (F4-F9, test, đột biến, cổng) | 🟠 | Claude Sonnet 5.5 (tự làm, không giao con) |

## Việc KHÔNG làm
- Không chạy `--pg` (Docker tắt) ⇒ `NOT_RUN`.
- Không sửa `src/main.py` (format lệch có sẵn, ngoài phạm vi).
- Không chạy lại pytest toàn bộ sau bước ruff fix file test mới (xem ghi chú).
- Không sửa runtime F8, không thêm trường model, không commit/push.

## Câu hỏi mở
1. `ruff format --check src tests` đỏ ở `src/main.py` có sẵn từ trước: SO quyết ai/lúc nào format (ngoài phạm vi H14) để cổng §9 xanh toàn bộ.
2. F7 thêm audit `LINK_TICKETS` (field `duplicate_count`) khi T09 tính lại số; SPEC-P08 §5 không nói rõ có audit hay không. Đã chọn có audit cho nhất quán với `_count_duplicate`; người duyệt đổi nếu muốn im lặng.

Tiếp theo
🖐 Cần tay người: duyệt R14 (đo lại lệnh + `git diff --stat`); quyết câu hỏi mở 1 (format `src/main.py`).
🤖 Agent làm được ngay: chạy lại pytest toàn bộ sau ruff fix, hoặc thẩm định cô lập WP15 (chờ lệnh).
⭐ Nên làm trước: thẩm định cô lập bằng agent khác, vì bộ đo mới chỉ đã đỏ trên 4 đột biến của handoff, chưa có người phá thêm.
⏸ Chưa làm: `--pg` (Docker tắt), `src/main.py` format, commit.

## Phán quyết SO — 2026-10-10 18:15:42 +0700
| Đo lại (SO, cây chính, `.venv` 3.11.7, env mock) | Kết quả |
|---|---|
| `python -m pytest -q -p no:cacheprovider` | `3704 passed, 85 deselected`, EXIT=0 (mốc 3685 + 19 mới, 0 fail/0 skip) |
| `ruff check src tests` | `All checks passed!`, EXIT=0 |
| `ruff format --check src tests` | EXIT=1 chỉ `src/main.py`; `git diff --quiet -- src/main.py` = 0 ⇒ lệch có sẵn trên `8cf52d4`, ngoài phạm vi |
| `git diff --stat -- src tests` | 3 file trong phạm vi (merge/neighbors/split), `rules.py` diff 0 |
| Đọc diff | F4 `_release_duplicate_count(previous_blocker)`, F5 append một lần, F6 `GuardError` chặn dây chuyền, F7 `_recount_duplicates` theo P04 §2.1 khi T09, F9 chép `locked_fields.location`; F8 0 dòng runtime (Q36) |

Câu hỏi mở 2 (audit `LINK_TICKETS` khi đếm lại): GIỮ — nhất quán `_count_duplicate`. Câu hỏi 1 (`src/main.py`): ngoài WP15, ghi roadmap cho chủ file. `--pg` ⬜ (Docker tắt): `_recount_duplicates` đọc `_cases_snapshot()` chưa đo trên Postgres.

✅ DUYỆT local (gate `--pg` ⬜)

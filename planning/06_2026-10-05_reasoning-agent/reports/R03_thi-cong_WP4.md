Vai: worker (vai-thi-cong) · loại: thi công · họ/model: Claude Sonnet 5.5 · Bước 0: exit 1 (đúng một dòng `BRN-002 … khối luật: boot`, miễn theo Q21) · hiểu việc: ghi 4 trường Settings + khối .env.example + revision đánh dấu 0002 (thân `pass`) + `HEAD_REVISION` + `test_p1_store.py` J-01…J-05; xong khi J-01…J-05 và `test_persistence_guards.py` xanh (cả `--pg`), J-03 từng đỏ, đột biến J-05 đỏ, cổng chung xanh; CẤM `.env` thật, `models.py`, SPEC, plan, commit/push.
Handoff: handoffs/H03_thi-cong_WP4.md
Base: 331cb40ca2d9359853e4a0b91756cf6fea274285
Head: chưa commit (SO gộp)

## Lệnh + exit (evidence trong `evidence/WP4/`)
| Lệnh | Exit | Kết quả | Evidence |
|---|---|---|---|
| `pytest tests/test_maintenance/test_p1_store.py` (trước sửa) | 1 | `2 failed, 2 passed, 2 deselected` — J-03, J-05 đỏ | [red-before.txt](../evidence/WP4/red-before.txt) |
| `pytest test_p1_store.py test_persistence_guards.py` | 0 | `9 passed, 2 deselected` | [green.txt](../evidence/WP4/green.txt) |
| `pytest --pg test_p1_store.py test_store_postgres.py test_persistence_guards.py` (DB `p151_wp4_test`) | 0 | `23 passed` (gồm J-02, J-04) | [pg.txt](../evidence/WP4/pg.txt) |
| đột biến `upgrade()` = `op.execute("select 1")` | 1 | `1 failed, 3 passed, 2 deselected` — J-05 đỏ; đã khôi phục | [mutation-j05.txt](../evidence/WP4/mutation-j05.txt) |
| `pytest -q -p no:cacheprovider` (toàn bộ) | 0 | `2975 passed, 31 deselected` (fail 0, skip 0) | [pytest.txt](../evidence/WP4/pytest.txt) |
| `ruff check src tests` / `ruff format --check src tests` | 0 / 0 | `All checks passed!` / `78 files already formatted` | [ruff.txt](../evidence/WP4/ruff.txt) |
| `grep -cP '[\x08\x0b\x0c]'` trên 5 file đã sửa | — | 0 cả 5 | — |

Test: tổng 2975 · pass 2975 · fail 0 · skip 0 · deselected 31 (nền 2971 + 4 J mới chạy không `--pg`; 2 ca pg deselected, nền 29 -> 31).

## git diff --cached --stat
Xem phần cuối trả về của worker (gồm cả file report này sau khi stage). Phạm vi: `.env.example`, `src/config.py`, `src/maintenance/store/postgres.py` (1 dòng `HEAD_REVISION`), `0002_p1_doc_shape.py` (mới), `test_p1_store.py` (mới), `evidence/WP4/*`, report.
Worktree: `D:/P151/.claude/worktrees/agent-a316ebd4bc3288a2d`.

## Bảng phân công
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP4 a-f | 🟠 | Claude Sonnet 5.5 (tự làm, không giao con) |

## Việc KHÔNG làm + lý do
- Không commit/push; không stage `tests/test_maintenance/data/case_pre_p1.json` (theo lệnh).
- `.env.example`: 4 biến `MO_AGENT_*` là dòng thật; 4 biến DeepSeek (`LLM_MODE`, `OPENAI_BASE_URL`, `OPENAI_API_KEY=` trống, `MODEL_NAME`) để dạng chú thích vì file đã có `LLM_MODE`/`OPENAI_API_KEY`/`MODEL_NAME` (trùng khoá sẽ ghi đè mặc định mock/dev). `OPENAI_API_KEY=sk-your-key-here` cũ giữ nguyên (ngoài phạm vi sửa).

## Câu hỏi mở
1. `tests/test_maintenance/data/case_pre_p1.json` bị `.gitignore` dòng 32 (`data/`) chặn: WP0 phải `git add -f` (OPERATIONS §8 cấm sửa `.gitignore`), nếu không J-01/J-02 đỏ trên máy sạch. Fixture tự sinh trong worktree này bằng lệnh OPERATIONS §3.3 (33327 byte) từ base 331cb40 — nội dung model vẫn như `82f01f0`; WP0 sinh song song nên SO so lại với bản WP0.
2. J-02 phía memory chèn doc qua model (`tx.insert`) vì không có cột JSONB; phía pg chèn SQL thẳng như SPEC.

⏳ Chờ người duyệt.

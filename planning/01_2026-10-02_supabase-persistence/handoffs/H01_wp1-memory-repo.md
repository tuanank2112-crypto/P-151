# H01 — WP1: CaseRepository + InMemoryRepository, engine dùng repository (THI CÔNG)

Vai: worker của repo P-151 (thi công, được ghi trong phạm vi dưới đây) — khai vai ở dòng 1 report.
Bước 0: từ root repo chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`, ghi exit code.
Thứ tự đọc: `AGENTS.md` → `brain4agent/memory-distill.txt` → `planning/01_2026-10-02_supabase-persistence/plan.md` → `specs/00-ARCHITECTURE.md` → `specs/01-CONTRACTS.md` §2, §5 → `specs/SPEC-P01-REPOSITORY.md` → code.

## 1. Bối cảnh
Engine `src/maintenance/engine.py` giữ ticket trong `self.cases` (dict) và tồn kho trong `self.stock`. Kế hoạch #01 đưa
chúng ra sau interface `CaseRepository`. WP1 CHỈ làm bản in-memory và chuyển engine sang dùng repository; bản Postgres
là WP2. Sau WP1 hành vi bên ngoài KHÔNG đổi. Base: `f2da6cb`. Một agent architect có thể đang chỉnh `specs/` song song:
luôn đọc bản mới nhất trên đĩa; SPEC mâu thuẫn với chính nó hoặc với code ⇒ ghi "Câu hỏi mở", không tự chế.

## 2. Phạm vi
- ĐƯỢC tạo: `src/maintenance/store/__init__.py`, `src/maintenance/store/base.py`, `src/maintenance/store/memory.py`,
  `tests/test_maintenance/test_store_memory.py`, file report §6.
- ĐƯỢC sửa: `src/maintenance/engine.py`, `src/maintenance/views.py`, `src/api/routers/maintenance.py` (chỉ chỗ đọc
  `engine.cases` và nhánh lỗi mới trong `_call`), test cũ CHỈ khi test gán/xoá trực tiếp vào `engine.cases`.
- CẤM chạm: `store/postgres.py`, Alembic, `src/api/photos.py`, `src/api/auth.py`, `src/main.py`, `get_engine()`
  (vẫn gọi `engine.reset()` — đổi ở WP4), `docker-compose.yml`, `requirements.txt`, `planning/**/specs/`, `plan.md`,
  `docs/`, `brain4agent/`, `.env*`. CẤM sửa assert nghiệp vụ của test cũ. CẤM push.

## 3. Việc phải làm
1. `store/base.py`: `Tx`, `CaseRepository` (Protocol) đúng `01-CONTRACTS §2`; lỗi `ConcurrencyError`,
   `StoreUnavailableError` (kế thừa `EngineError`, `code` theo `01-CONTRACTS §5`) — đặt sao cho không import vòng.
2. `store/memory.py`: `InMemoryRepository` đủ mọi method của Protocol; `transaction()` copy-on-write (lỗi ⇒ không áp
   gì); `get_for_update`/`save` có `version` như Postgres; `job_lease`/`seed_lease` luôn True; `check()` no-op.
3. Engine theo `SPEC-P01 §1–§2`: tham số `repo`, `cases`/`stock` thành view, `run_id` từ `repo.run_number()`,
   `_mutate_locked`/`_commit`/`_ingest`/`_deny`/`receive`/`receive_stock`/`run_jobs`/`reset` + `seed()` mới; đọc
   pipeline (`_line_stock`, quét trùng) qua repo. Giữ `engine.lock`. `audit_sink`/`notify_sink` gọi trong tx.
4. `_call`: `ConcurrencyError` ⇒ 409, `StoreUnavailableError` ⇒ 503 (detail `{"code","message"}`).
5. Test mới (memory): T01, T02, T03, T05 của `TESTING-ACCEPTANCE §2` + 1 test `engine.cases` chỉ đọc (gán ⇒ TypeError)
   + 1 test `next_ticket_number` không trả lại số đã cấp. Mỗi test mới: cố tình làm hỏng code một lần, chạy thấy ĐỎ,
   lưu output vào `planning/01_2026-10-02_supabase-persistence/evidence/wp1/red-<test>.txt`, rồi trả code về.

**Xong khi** (chạy đúng các lệnh, dán exit code nguyên văn):
- `python -m pytest -q` ⇒ exit 0, số passed ≥ 155 + số test mới, 0 failed, 0 skipped.
- `python -m ruff check src tests` ⇒ exit 0; `python -m ruff format --check src tests` ⇒ exit 0.
- `git diff --stat f2da6cb` chỉ gồm file trong §2.
- `grep -n "self.cases\[" src/maintenance/engine.py` ⇒ không còn dòng gán nào.

## 4. Luật
- Python 3.11 venv `.venv/Scripts/python.exe`; set `PYTHONIOENCODING=utf-8` khi in tiếng Việt.
- Code theo phong cách file xung quanh (docstring ngắn tiếng Anh, comment tiếng Anh, message lỗi tiếng Việt).
- CẤM `except Exception: pass`; CẤM cache `Case` trong engine.
- Commit local MỘT commit, stage tường minh từng file, message: `refactor(engine): route case storage through CaseRepository`
  + dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Không stage `planning/` ngoài evidence + report của bạn.

## 5. Tầng
Gói duy nhất WP1 → 🔴 (đụng bất biến I-2/I-6 của engine). Không tách gói con.

## 6. Mẫu report — `planning/01_2026-10-02_supabase-persistence/reports/R01_wp1-memory-repo.md`
```
<Vai · thi công · họ/model · Bước 0 exit N · hiểu việc: phạm vi / xong khi / cấm>
Handoff: H01_wp1-memory-repo.md
Base: f2da6cb
Head: <sha>
## Lệnh + exit  (nguyên văn)
## Test  tổng / pass / fail / skip ; test mới (tên)
## git diff --stat f2da6cb
## Bằng chứng đỏ  (đường dẫn evidence)
## Phân công  gói → tầng yêu cầu → họ/model đã dùng
## Không làm + lý do
## Câu hỏi mở
```

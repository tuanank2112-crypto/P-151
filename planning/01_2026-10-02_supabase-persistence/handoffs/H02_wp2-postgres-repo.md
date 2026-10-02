# H02 — WP2: Alembic 0001 + PostgresRepository + hạ tầng test `--pg` + C1–C4 (THI CÔNG)

Vai: worker của repo P-151 (thi công, được ghi trong phạm vi dưới đây) — khai vai ở dòng 1 report.
Bước 0: từ root repo chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`, ghi exit code.
Thứ tự đọc: `AGENTS.md` → `brain4agent/memory-distill.txt` → `planning/01_2026-10-02_supabase-persistence/plan.md` → `specs/00-ARCHITECTURE.md` → `specs/01-CONTRACTS.md` (toàn bộ) → `specs/SPEC-P01-REPOSITORY.md` (đặc biệt §2, §9) → `specs/TESTING-ACCEPTANCE.md` §1–§4, §6 → code.

## 1. Bối cảnh
WP1 (`413aebc`) đã đưa engine qua `CaseRepository` với bản in-memory. WP2 thêm bản PostgreSQL theo SPEC chính thức
(`7c9e18e`), migration Alembic `0001_maintops_initial` (gồm bảng `sessions` — chỉ DDL, logic phiên là WP4b), hạ tầng
test `--pg`, và các sửa C1–C4 trên code WP1 (`SPEC-P01 §9`). Base: `7c9e18e`. Docker `p151-db-1` (PG 16) đang chạy ở
`localhost:5432`, user/pass `p151`/`p151`.

## 2. Phạm vi
- ĐƯỢC tạo/sửa: đúng các file mà `01-CONTRACTS` và `SPEC-P01` gán nhãn **WP2** (gồm `src/config.py`,
  `src/maintenance/store/{base,postgres}.py`, `src/maintenance/store/alembic.ini`, `src/maintenance/store/migrations/**`,
  `src/maintenance/engine.py` cho C1–C2, `src/api/routers/maintenance.py` chỉ `_call` cho C4, `src/main.py` chỉ handler
  lỗi `01-CONTRACTS §8`), hạ tầng test `TESTING §2` (`tests/conftest.py`, `tests/test_maintenance/conftest.py`), test mới
  nhãn WP2 trong `TESTING §3` (`test_store_postgres.py`, `test_persistence_guards.py`, mở rộng `test_store_memory.py`),
  evidence `evidence/wp2/`, report §6.
- CẤM chạm: mọi thứ nhãn WP3/WP4/WP4b/WP5 (`photos`, `get_engine`/seed/reset gate, `auth.py`/SessionStore, smoke script,
  `docker-compose.yml`, `.env.example`), `planning/**/specs/`, `plan.md`, `docs/`, `brain4agent/`, `.env` thật,
  `requirements.txt`. CẤM sửa test cũ (G8 phải 0 dòng). CẤM chạy bất cứ gì tới Supabase/host ngoài `localhost`. CẤM push.

## 3. Việc phải làm
1. Code theo đúng chữ ký/SQL/bảng lỗi của `01-CONTRACTS` §1–§4, §7, §8 và `SPEC-P01` §2, §9 (C1–C4).
2. Tạo DB test một lần: `docker compose exec -T db createdb -U p151 p151_test` (bỏ qua nếu đã có).
3. Mọi test có nhãn WP2 trong `TESTING §3` + bằng chứng đỏ R-nhãn WP2 trong `TESTING §4` (lưu `evidence/wp2/`).
4. G5 local: `upgrade head` → `downgrade base` → `upgrade head` trên `p151_test`, lưu output `evidence/wp2/g5-local.txt`.

**Xong khi** (dán lệnh + exit code nguyên văn):
- G1: `python -m pytest -q` ⇒ exit 0, 0 failed, 0 skipped, passed ≥ 161 + số test mặc định mới, có `deselected`.
- G2: `MO_TEST_DATABASE_URL=postgresql+psycopg2://p151:p151@localhost:5432/p151_test python -m pytest --pg -q` ⇒ exit 0, 0 skip, 0 deselected.
- G3: `python -m ruff check src tests` exit 0; `ruff format --check` trên file bạn tạo/sửa (trừ 2 file nợ) exit 0.
- G4 (phần WP2): mỗi file evidence R của WP2 có exit ≠ 0. G8: 0 dòng. G9: `git grep` exit 1.
- `git diff --stat 7c9e18e` chỉ gồm file trong §2.

## 4. Luật
- `.venv/Scripts/python.exe`; `PYTHONIOENCODING=utf-8`. Phong cách code giống file xung quanh.
- SPEC mâu thuẫn với chính nó/với code ⇒ ghi "Câu hỏi mở", làm theo cách an toàn nhất và nêu rõ; KHÔNG tự đổi contract.
- Không bao giờ in URL có mật khẩu, key, nội dung `.env`.
- Commit local MỘT commit, stage tường minh: `feat(store): add PostgreSQL repository and Alembic migration 0001`
  + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## 5. Tầng
WP2 → 🟠 (có SPEC + test tự biết đúng/sai). Gói con cơ học (tạo DB, chạy lệnh đo) → 🟢 nếu tách.

## 6. Mẫu report — `planning/01_2026-10-02_supabase-persistence/reports/R02_wp2-postgres-repo.md`
```
<Vai · thi công · họ/model · Bước 0 exit N · hiểu việc: phạm vi / xong khi / cấm>
Handoff: H02_wp2-postgres-repo.md
Base: 7c9e18e
Head: <sha>
## Lệnh + exit  (nguyên văn, G1 G2 G3 G5 G8 G9)
## Test  mặc định tổng/pass/fail/skip/deselected ; --pg tổng/pass/fail/skip ; test mới (tên)
## git diff --stat 7c9e18e
## Bằng chứng đỏ  (R → file evidence → exit)
## Phân công  gói → tầng yêu cầu → họ/model đã dùng
## Không làm + lý do
## Câu hỏi mở
```

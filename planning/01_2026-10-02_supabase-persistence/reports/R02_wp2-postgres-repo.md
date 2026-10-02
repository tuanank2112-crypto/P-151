Orchestrator P-151 (tự thi công theo yêu cầu người dùng 2026-10-02 "làm cho xong repository PostgreSQL + ảnh Storage + bỏ reset khi startup + kiểm transaction/restart") · thi công · Anthropic/Claude Opus 5.5 · Bước 0 exit 0 · hiểu việc: phạm vi = H02 (WP2) + WP3 (SPEC-P02) + WP4 (SPEC-P03), KHÔNG WP4b/WP5/WP6 / xong khi = G1, G2, G3, G4 (R của WP2–WP4), G5 local, G8, G9 đều đạt + restart thật qua uvicorn / cấm = Supabase/host ngoài localhost, `.env` thật, specs/, test cũ, push
Handoff: H02_wp2-postgres-repo.md
Base: 7c9e18e
Head: working tree trên 7c9e18e (chưa commit — chờ người duyệt, đề xuất commit ở cuối)

## Lệnh + exit  (output máy: `evidence/wp2/`, `evidence/wp4/`)
| Gate | Lệnh | Exit | Kết quả | Evidence |
|---|---|---|---|---|
| Bước 0 | `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` | 0 | `NÃO ĐÃ OK` | — |
| G1 | `python -m pytest -q -p no:cacheprovider` | 0 | `185 passed, 20 deselected` | `evidence/wp2/g1.txt` |
| G2 | `MO_TEST_DATABASE_URL=…/p151_test python -m pytest --pg -q -rs` | 0 | `205 passed` (0 skip, 0 deselected) | `evidence/wp2/g2.txt` |
| G3 | `python -m ruff check src tests` ; `ruff format --check <16 file .py đã đụng, trừ 2 file nợ>` | 0 / 0 | `All checks passed!` / `16 files already formatted` | `evidence/wp2/g3.txt` |
| G5 local | `alembic upgrade head` → `downgrade base` → `upgrade head` trên `p151_test` | 0/0/0 | `alembic_version = 0001_maintops_initial` | `evidence/wp2/g5-local.txt` |
| G8 | `git diff --numstat f2da6cb -- <11 file test cũ>` | 0 | 0 dòng | `evidence/wp2/g8.txt` |
| G9 | `git grep -nE "sb_secret_…\|eyJhbGci…" -- src tests scripts docs planning` | 1 | không khớp | `evidence/wp2/g9.txt` |
| Restart thật | 3 process uvicorn, `MO_STORE=postgres` → docker `p151_test`, ảnh local | 0 | `live_restart=PASS` (12 seed → +1 ticket → restart vẫn 13, ảnh cùng sha256, reset/evaluate 403, sai revision ⇒ exit 3, log không có mật khẩu) | `evidence/wp4/live-restart.txt` |
| SPEC-P01 §8 | `grep -n "except Exception" src/maintenance/engine.py` | 0 | đúng 2 dòng (`_sink`, nhánh sink của `_deny`) | — |

## Test  mặc định 205 tổng / 185 pass / 0 fail / 0 skip / 20 deselected ; `--pg` 205 / 205 / 0 / 0
Mới (24 test mặc định + 20 pg): `test_store_memory.py` tham số hoá mem+pg (T01, T02, T03, T09, T23, `seed_never_overwrites_existing_stock`; T05 → fixture `memory_repo`);
`test_store_postgres.py` (T04, T05-pg, lồng tx ⇒ RuntimeError, T06, T07, T08, T11, T12, DB không nối được ⇒ RuntimeError không lộ mật khẩu, T13, T24, T28);
`test_persistence_guards.py` (T12b, T14 ×2, T14b, T27); `test_persistence_api.py` (T10, T25, T26, T29); `test_photo_store.py` (T15a–h, `supabase_store_needs_url_and_key`, T16, `failed_upload_records_no_evidence`, T17).

## git diff --stat 7c9e18e  (gồm file mới)
`40 files changed, 2609 insertions(+), 52 deletions(-)` — code: `src/maintenance/store/{postgres,photos}.py` (mới), `store/alembic.ini`, `store/migrations/**`,
`store/base.py`, `engine.py`, `src/api/photos.py`, `routers/maintenance.py`, `main.py`, `config.py`, `docker-compose.yml`, `.env.example`;
test: `tests/conftest.py`, `tests/test_maintenance/conftest.py`, `test_store_memory.py` + 5 file mới; còn lại là evidence + H02.

## Bằng chứng đỏ  (R → file → exit; mọi file ghi sha256 trước = sau khi trả code)
| R | Phá | Test | Exit | File |
|---|---|---|---|---|
| R1 | bỏ `for update` + `and version = :v` | T04/T05-pg | 1 (1 failed) | `evidence/wp2/red-t04-t05pg.txt` |
| R4 | `job_lease` luôn `True` | T11 | 1 | `evidence/wp2/red-t11.txt` |
| R7 | bỏ kiểm host/DB trong `pytest_configure` | T14 | 1 | `evidence/wp2/red-t14.txt` |
| R8 | bọc lại `tx.append_log` trong `except Exception` | T25 | 1 | `evidence/wp2/red-t25.txt` |
| R9 | bỏ kiểm lại dưới khoá trong `_transition.op` | T29 | 1 | `evidence/wp2/red-t29.txt` |
| R10 | bỏ `tx.append_notifications` | T23 mem+pg | 1 (2 failed) | `evidence/wp2/red-t23.txt` |
| R12 | bỏ `from None` trong `connect_args_for` | T27 | 1 | `evidence/wp2/red-t27.txt` |
| R11 | bỏ retry Supabase | T15d | 1 | `evidence/wp3/red-t15d.txt` |
| R2 | đặt lại `engine.reset()` trong `get_engine` | T08 | 1 | `evidence/wp4/red-t08.txt` |
| R3 | bỏ bù tồn kho trong `seed()` | T09 mem+pg | 1 (2 failed) | `evidence/wp4/red-t09.txt` |
| R6 | bỏ `_require_reset_allowed()` khỏi `run_evaluation` | T10 | 1 | `evidence/wp4/red-t10.txt` |
R5 (sessions, P04) không thuộc phạm vi lần này.

## Phân công  gói → tầng yêu cầu → họ/model đã dùng
| Gói | Tầng | Đã dùng |
|---|---|---|
| WP2 PostgresRepository + Alembic + C1–C4 + hạ tầng `--pg` | 🟠 | Anthropic/Claude Opus 5.5 (lên tầng: phiên đang chạy, không phóng worker) |
| WP3 PhotoStore local/supabase | 🟠 | như trên |
| WP4 startup/seed/cổng reset/compose/.env.example | 🟠 | như trên |
| Đo, chạy lệnh, sinh evidence | 🟢 | như trên (script tạm trong scratchpad, không vào repo) |

## Không làm + lý do
- WP4b (phiên đăng nhập lưu DB, T19–T22, R5): người dùng không yêu cầu lần này; bảng `maintops.sessions` đã có trong migration.
- WP5 (smoke script, gate Supabase G5/G6/G7/G9 cột supabase) và M-SB1/M-SB2: chạm DB/Storage dùng chung ⇒ cần người (L.3).
- WP6 (docs, bump 0.6.0): kế hoạch chưa đóng. Brain đồng bộ phần trạng thái (index/roadmap/hot/gotchas).
- Không sửa `src/web/`, không sửa test cũ, không đụng `.env` thật.

## Câu hỏi mở
1. **T27 trong SPEC quá yếu:** tiêu chí `__cause__ is None` vẫn xanh khi bỏ `from None` (raise trong `except` chỉ gắn `__context__`). Đã siết test thêm `__suppress_context__ is True` (R12 đỏ). Đề nghị architect sửa `TESTING §3 T27`.
2. **Sự cố trong lúc thi công:** lần chạy G1 đầu tiên (trước khi thêm khối ép môi trường vào `tests/conftest.py`) đọc `.env` `MO_STORE=postgres` và mở kết nối tới DB Supabase dùng chung — chỉ `select 1` + `select version_num` (không ghi; báo "schema chưa sẵn sàng"). Đã ghi gotcha; guard I-7 hiện chặn.
3. T24 đo thật: `GET /mo/tickets` = 1 câu; `accept` ≤ 6 (đạt ngân sách; số chính xác chưa ghi vào evidence).

Phán quyết: ⬜ CHỜ NGƯỜI DUYỆT đo lại G1–G3, G8, G9 (tự đo local: mọi gate local đạt; cột supabase còn ⬜)

# OPERATIONS — môi trường, wave, ranh giới file, DeepSeek, triển khai JSONB, rollback, evidence

Mọi số dưới đây do architect đo (lệnh kèm theo); worker đo lại, không chép số.

## 1. Môi trường và nền đo
| Mục | Giá trị / lệnh |
|---|---|
| Nhánh | `feature/nhuy-reasoning-agent` tạo từ `origin/develop` `82f01f0` (`git switch -c feature/nhuy-reasoning-agent origin/develop` + `git branch --unset-upstream`; đo `git rev-parse --abbrev-ref @{u}` ⇒ `fatal: no upstream configured`) |
| Python | 3.11 (`py -0p` có `Python311`); 3.13 hệ thống ⇒ thiếu `pytest_asyncio` (exit 4) — lỗi môi trường |
| venv | ngoài repo (Root Clean): `py -3.11 -m venv ../venv311 && ../venv311/Scripts/python.exe -m pip install -r requirements.txt` |
| Biến môi trường test | `LLM_MODE=mock`, `PYTHONUTF8=1`; CẤM đặt `OPENAI_API_KEY` thật trong test/evidence |
| Lệnh chuẩn | `python -m pytest -q -p no:cacheprovider; echo "EXIT=$?"` · `python -m ruff check src tests; echo "EXIT=$?"` · `python -m ruff format --check src tests; echo "EXIT=$?"` |
| Nền đo (2026-10-05 20:0x, base `82f01f0`) | `2971 passed, 29 deselected in 56.94s`, `EXIT=0` · ruff check `All checks passed!` · format `76 files already formatted` |
| Postgres cục bộ (`--pg`) | `docker compose up -d db` · `docker compose exec db createdb -U p151 p151_test` (một lần) · `MO_TEST_DATABASE_URL=postgresql+psycopg2://p151:p151@localhost:5432/p151_test python -m pytest --pg -q -p no:cacheprovider` (29 test hiện bị deselect khi không `--pg`). Máy architect KHÔNG có Docker chạy (đo: `failed to connect to the docker API`) ⇒ cổng `--pg` do người/worker có Docker chạy |
| Máy đo hồ sơ | `PYTHONPATH=. PYTHONUTF8=1 python planning/06_2026-10-05_reasoning-agent/specs/REF-agent-contract.py --selftest` ⇒ `SELFTEST_FAILURES=0` · `…/REF-split-verdict.py --variants` ⇒ `FAILURES=0 … VARIANT_FAILURES=0` · `…/REF-p1-safety-meter.py --flip` ⇒ `GATES_FAILED=25` (trạng thái TRƯỚC WP2; sau WP2 chế độ repo phải `GATES_FAILED=0`) |

## 2. Wave, Work Package, ranh giới file
Quy tắc kẹp phạm vi: so TẬP đường dẫn `git status --porcelain` với cột ĐƯỢC GHI (HANDOFF_PROTOCOL §14 luật 1). File ngoài cột ⇒ 🔁. Mỗi WP một commit trên `feature/nhuy-reasoning-agent`, KHÔNG push; `git add` tường minh từng đường dẫn; file data test mới `git add -f` (`.gitignore` chặn `data/`).

| Wave | WP | Tầng | Phụ thuộc | ĐƯỢC GHI | Commit message | "Xong khi" (lệnh ⇒ kết quả) |
|---|---|---|---|---|---|---|
| 0 | WP0 nền + fixture + chuyển bộ eval | 🟢 | — | `tests/test_maintenance/data/case_pre_p1.json`, `tests/test_maintenance/agent_eval/**` (dữ liệu chuyển từ scratchpad, §3), `planning/06_…/evidence/WP0/*` | `test(eval): freeze pre-P1 case doc and port agent audit sets (plan 06 WP0)` | pytest nền `EXIT=0` 2971; `python -c "import json; json.load(open('tests/test_maintenance/data/case_pre_p1.json'))"` exit 0; báo cáo va chạm vị trí §3.2 = 0 dòng chưa xử lý |
| 1 | WP1 hợp đồng | 🟠 | WP0 | `src/maintenance/{enums,models,catalog,views,messages}.py`, `src/maintenance/i18n/vi.yaml`, `seed/maintenance_v1/catalog.yaml`, `src/maintenance/engine.py` (CHỈ hằng `TRANSITIONS`/`BLOCKER_OWNERS`/`PERMISSIONS` + `_status_rules` liên quan), `tests/test_maintenance/test_p1_contracts.py`, `test_engine.py` (dòng `18 + 7`) | `feat(engine): plan 06 contracts — agent record, P1 fields, transitions, policy config` | C-01…C-05, C-12…C-14 xanh; toàn bộ ≥ 2971 + mới, 0 fail/skip |
| 1 | WP2 lưới sàn an toàn P1 | 🔴 | (S-00 sau WP1) | theo SPEC-P03 dòng "File được ghi" | `feat(safety): P1 tier-1 floor signals and agent catch-all S-00 (plan 06 WP2)` | SPEC-P03 C1–C8; meter chế độ repo `GATES_FAILED=0` |
| 1 | WP3 gói Agent + bằng chứng luật | 🟠 | WP1 (enum/model) | theo SPEC-P01 + SPEC-P05 §2 | `feat(agent): reasoning agent package with JSON client, LangGraph flow and rule evidence (plan 06 WP3)` | A-01, A-02, A-04…A-19 phần thuần, P-01…P-08, RE-01…RE-06; REF selftest 0 |
| 1 | WP4 cấu hình + JSONB | 🟠 | — | `src/config.py`, `.env.example`, `src/maintenance/store/postgres.py` (CHỈ `HEAD_REVISION`), `src/maintenance/store/migrations/versions/0002_p1_doc_shape.py`, `tests/test_maintenance/test_p1_store.py` | `feat(store): plan 06 doc-shape marker revision and agent settings` | J-01…J-05 (J-02, J-04 cần `--pg`); `test_persistence_guards.py` xanh |
| 2 | WP5 hạ tầng engine + mixin + hook | 🟠 | WP1 | theo SPEC-P02 dòng "File được ghi" phần WP5 | `refactor(engine): one-transaction multi-ticket writes, coordination mixins and P1 hooks (plan 06 WP5)` | C-06…C-11 xanh; toàn bộ suite xanh |
| 3 | WP6 tích hợp Agent vào engine | 🟠 | WP3, WP4, WP5 | theo SPEC-P02 dòng "File được ghi" phần WP6 | `feat(engine): agent decides each step outside the engine lock, rules as floor and fallback (plan 06 WP6)` | A-03, A-07, A-13, A-20…A-31, A-33, PAR-01…PAR-03; toàn bộ suite xanh |
| 4 | WP7 trùng/gộp | 🟠 | WP6 | SPEC-P04 | `feat(engine): duplicate count, merge links, undo, cancelled root and PRI-U1 (plan 06 WP7)` | M-01…M-12 |
| 4 | WP8 tách hai việc | 🟠 | WP6 | SPEC-P05 (phần WP8) | `feat(engine): agent splits a report with two jobs into two tickets (plan 06 WP8)` | S-01…S-12 |
| 4 | WP9 phòng ban | 🟠 | WP6 | SPEC-P06 | `feat(engine): wrong-department count, T16/T17 and E02 (plan 06 WP9)` | D-01…D-10 |
| 4 | WP10 khẩn cấp lân cận + tiếp theo | 🟠 | WP6 | SPEC-P07 | `feat(engine): emergency neighbours and follow-up tickets (plan 06 WP10)` | E-01…E-08, F-01…F-06 |
| 4–5 | WP11 eval + chỉnh prompt bằng mô hình thật | 🔴 | WP6 (+ khoá API từ người) | `tests/test_maintenance/agent_eval/run_eval.py` (mới), `tests/test_maintenance/test_agent_eval_fake.py` (mới), `src/maintenance/agent/prompt.py` (CHỈ chữ prompt theo SPEC-P01 §4.4), `planning/06_…/evidence/WP11/*` | `test(eval): agent eval harness, fake gate and live DeepSeek measurements (plan 06 WP11)` | G-EVAL-FAKE xanh; G-LIVE-1…7 có số (TESTING §6) |
| 5 | WP12 thẩm định đối kháng cô lập | 🔴 | WP7–WP11 | CHỈ `planning/06_…/reports/R12_tham-dinh_*.md` + `evidence/WP12/` | `docs(plan-06): audit report R12` | ≥ 3 cách phá có evidence (TESTING §8) |
| 6 | WP13 đồng bộ tài liệu/não + version | 🟢 | WP12 ✅ | `docs/maintenance.md`, `docs/CR-BPTN-03.md` (CHỈ ghi chú drift D-01…D-16), `brain4agent/**`, `plan.md` | `docs(brain): close plan 06 reasoning agent and sync docs` | `init_brain.js --check` exit 0; `memory-distill.txt` < 100 dòng |

Song song: Wave 1 (WP2, WP3, WP4 song song; WP3 cần enum/model của WP1 ⇒ bắt đầu khi WP1 commit, hoặc WP3 làm phần không phụ thuộc trước). Wave 4: WP7…WP10 song song — mỗi WP chỉ sửa file mixin của mình (`coordination/merge.py`, `split.py`, `department.py`, `neighbors.py`) + test riêng; DUY NHẤT WP7 được sửa `engine.py` (thân `rate` + nhánh DUPLICATE của `bptn_resolve`). WP11 có thể chạy cùng Wave 4.

## 3. WP0 — chuyển bộ eval từ scratchpad vào repo (scratchpad là thư mục tạm, có thể bị xoá)
Nguồn: `C:\Users\lenku\AppData\Local\Temp\claude\d--P151\640e8089-3b43-4a75-9055-cbb167391b76\scratchpad\agent_audit\` (`audit_a.py` 77 ca có kỳ vọng, `audit_c.py` 38 kịch bản, `audit_d.py` 15 kịch bản, `common.py`, `p3.txt` 45 câu Bậc 1, `p6.txt` 12 cặp câu tự nhiên) và `…\scratchpad\redteam_lex.py` (bộ đối kháng từ vựng).
### 3.1 Đích
`tests/test_maintenance/agent_eval/`: `__init__.py`, `common.py` (chép, sửa import cho đúng đường dẫn repo, thêm tham số `agent` cho `fresh()`), `cases_audit_a.yaml` (id, text, expect — chuyển từ dict Python), `scenarios_c.py`, `scenarios_d.py` (chép hàm kịch bản), `safety_sentences.yaml` (p3: `expect: EMERGENCY`; p6: mỗi cặp hai câu `EMERGENCY`), `redteam_lex.yaml` (id, text, acceptable). Dòng đầu `cases_audit_a.yaml` và `scenarios_d.py`: `# HELD-OUT (plan 06 Q12): KHÔNG dùng để chỉnh prompt; chỉ SO chạy ở cổng G-LIVE-3/4`.
### 3.2 Đổi tòa theo Ocean Park (catalog `site.buildings = [S1, S2]`)
Thay `SIM-A → S1`, `SIM-B → S2`, `SIM-C → S2` trong text VÀ kỳ vọng vị trí. Chạy kiểm va chạm (WP0 viết lệnh một dòng, lưu `evidence/WP0/collisions.txt`): mọi ca có kỳ vọng `asset`/`ASSET_UNCLEAR` mà vị trí mới trùng `location_normalized` của asset trong `catalog.yaml` khác với kỳ vọng cũ ⇒ liệt kê; mỗi dòng phải được sửa kỳ vọng (ghi lý do trong report) — KHÔNG sửa text để né.
### 3.3 Fixture JSON trước P1
`tests/test_maintenance/data/case_pre_p1.json` sinh TỪ BASE `82f01f0` TRƯỚC mọi sửa (lệnh, chạy từ root, venv 3.11):
`PYTHONPATH=. PYTHONUTF8=1 LLM_MODE=mock python -c "import json; from src.maintenance.engine import MaintenanceEngine; e=MaintenanceEngine(); e.reset(); docs={t: e.get(t).model_dump(mode='json') for t in ('SIM-TKT-CLN-001','SIM-TKT-CLN-004','SIM-TKT-TEC-003')}; open('tests/test_maintenance/data/case_pre_p1.json','w',encoding='utf-8').write(json.dumps({'base_commit':'82f01f0','cases':docs}, ensure_ascii=False, indent=1, sort_keys=True))"` (architect chạy thử cùng lệnh trên `db8bf0b`: 33 KB, round-trip `Case.model_validate(doc).model_dump(mode='json') == doc` ⇒ `True`).

## 4. DeepSeek (OpenAI-compatible) — cấu hình và đo
| Biến | Giá trị đề xuất | Ghi chú |
|---|---|---|
| `LLM_MODE` | `openai` | `mock` ⇒ không Agent (đường luật) |
| `OPENAI_BASE_URL` | `https://api.deepseek.com` | tương thích OpenAI |
| `OPENAI_API_KEY` | khoá DeepSeek (người cấp) | KHÔNG commit; agent CẤM sửa `.env` thật |
| `MODEL_NAME` | `deepseek-chat` | mô hình suy luận chuyên (`deepseek-reasoner`) có thể không nhận JSON mode — đo bằng probe trước khi đổi |
| `MO_AGENT_ENABLED` | `true` | `false` ⇒ đường LLM cũ (`proposer`) hoặc luật |
| `MO_AGENT_TIMEOUT_SECONDS` | `25` | quá ⇒ `TIMEOUT` ⇒ luật |
| `MO_AGENT_MAX_OUTPUT_TOKENS` | `2500` | bị cắt ⇒ `INVALID_JSON` ⇒ luật |
| `MO_AGENT_JSON_MODE` | `json_object` | endpoint từ chối `response_format` ⇒ `prompt_only` |
Khối thêm vào `.env.example` (WP4): đúng bảng trên dạng `KEY=giá trị` có chú thích tiếng Anh. Probe (người có khoá, tốn token): `PYTHONPATH=. PYTHONUTF8=1 python planning/06_2026-10-05_reasoning-agent/specs/REF-agent-contract.py --live --n 20 > planning/06_2026-10-05_reasoning-agent/evidence/WP11/probe.txt 2>&1; echo "EXIT=$?" >> …` ⇒ kỳ vọng dòng `LIVE model=deepseek-chat n=20 {'OK': 20, …, 'ERROR': 0, …}` và `p95` ≤ 20000 ms.

## 5. Triển khai lên DB dùng chung (Supabase) — thứ tự BẮT BUỘC
1. **Báo nhóm trước** (Châm Anh, Trí, Trường): ngừng mọi backend cục bộ đang trỏ Supabase (`MO_STORE=postgres`); sau bước 3, code cũ KHÔNG khởi động được trên DB này (đúng chủ đích I-30); backend cũ đang chạy sẽ lỗi khi gặp doc mới ⇒ phải dừng.
2. Merge PR vào `develop`; deploy bản mới (Render) với cờ an toàn ban đầu: `agent_policy.auto_split_mixed_reports: true` (đã duyệt), `hold_near_open_emergency: false`, `LLM_MODE` theo quyết định của người (có khoá ⇒ `openai`).
3. Owner chạy `python -m alembic -c src/maintenance/store/alembic.ini upgrade head` (không DDL, không khoá bảng) rồi đọc revision bằng `python -c "from sqlalchemy import text; from src.config import get_settings; from src.maintenance.store.postgres import sql_engine; c = sql_engine(get_settings().database_url).connect(); print(c.execute(text('select version_num from maintops.alembic_version')).scalar())"` ⇒ in `0002_p1_doc_shape` (`scripts/mo_smoke_persistence.py` KHÔNG có trên `develop` — đo `ls scripts/`).
4. Khởi động bản mới; kiểm: `GET /api/v1/bql/tickets` (bql01) 200 có `duplicate_count`, `agent_source`; doc cũ đọc được (không 500); gửi 1 phản ánh thử ⇒ `ai_logger` có một dòng `SUCCESS` (hoặc `FALLBACK_RULE` + cờ khi chưa có khoá).
5. Báo nhóm pull code mới trước khi bật lại backend cục bộ.
Memory mode (mặc định dev/test): không cần bước 1, 3, 5.

## 6. Rollback
| Mức | Cách | Mất gì | Ai quyết |
|---|---|---|---|
| R1 — tắt hành vi (ưu tiên) | `.env`: `LLM_MODE=mock` hoặc `MO_AGENT_ENABLED=false` (tắt Agent); `catalog.yaml` `agent_policy.auto_split_mixed_reports: false`, `hold_near_open_emergency: false`; `lexicon.yaml` `active_phases: [P0]` (tắt sàn P1); restart | không mất dữ liệu; doc P1 vẫn đọc được bởi code mới | SO/người vận hành |
| R2 — quay code về trước P1 trên DB dùng chung | KHÔNG làm được an toàn khi DB đã có doc P1: code cũ không đọc được (01 §12.1). Chỉ một trong: (a) giữ bản mới (dùng R1); (b) **PHÁ HUỶ**: reset dữ liệu demo (`MO_ALLOW_RESET=true` + `POST /mo/reset` bằng QA) rồi `alembic downgrade 0001_maintops_initial` rồi deploy code cũ; (c) khôi phục bản sao lưu Supabase trước bước 3 | (b) toàn bộ ticket/audit/outbox; (c) mọi thay đổi sau thời điểm sao lưu | NGƯỜI, hỏi bằng lời trước (AGENTS L.3) |
| R3 — memory mode | revert commit, restart | không | tự do |
| R4 — một WP lỗi trước merge | `git revert --no-edit <sha WP>` theo thứ tự ngược (Wave 4 → WP6 → WP5 → WP1) | không | SO |
`alembic downgrade` của `0002` chỉ đổi số revision (marker) — KHÔNG làm doc P1 đọc được bằng code cũ (ghi trong docstring migration).

## 7. Quy trình mỗi WP (worker)
1. `git rev-parse HEAD` ngay trước dòng sửa đầu tiên ⇒ `Base:` của report (không ghim sẵn).
2. Đọc router 00 §0; thi công đúng SPEC; CẤM sửa SPEC/plan — SPEC sai ⇒ dừng, ghi "Câu hỏi mở".
3. Bộ đo MỚI phải ĐỎ một lần trước (TESTING §5): chạy test mới trên code chưa sửa ⇒ lưu `evidence/<WP>/red-before.txt`; sửa ⇒ xanh ⇒ `green.txt`; đột biến nêu trong SPEC ⇒ `mutation-<x>.txt` (đỏ) rồi khôi phục.
4. Lệnh chuẩn §1 + lệnh "xong khi" ⇒ redirect `planning/06_2026-10-05_reasoning-agent/evidence/<WP>/<ten>.txt` (Git Bash, UTF-8 không BOM, LF): `python -m pytest -q -p no:cacheprovider > …/pytest.txt 2>&1; echo "EXIT=$?" >> …/pytest.txt`.
5. Report `reports/R<NN>_thi-cong_<WP>.md` theo HANDOFF_PROTOCOL §14 (dòng 1 khai vai; dòng 2–4 `Handoff:`/`Base:`/`Head:`; lệnh + exit code; test tổng/pass/fail/skip; `git diff --stat`; bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`).

## 8. BẮT BUỘC / CẤM / Vùng cấm
**BẮT BUỘC:** mỗi WP kết thúc xanh trước WP phụ thuộc; mọi PASS có evidence máy sinh; số test chỉ tăng; entry point ghi mới đi qua `_mutate`/`transition` hoặc `with self.lock`; mọi lần gọi mô hình ngoài khoá (I-16); cổng G-STUB trước PR.
**CẤM:** `git push`; `git add -A`; sửa `src/api/**`, `src/web/**`, `.env` thật; bật `LLM_MODE=openai` trong test; ghi khoá API vào evidence/report; chạy lệnh dài ở nền rồi để report chờ (HANDOFF §14 luật tác vụ dài — pytest toàn bộ ≈ 60 s chạy chặn ở tiền cảnh).
**Vùng cấm:**
| Không làm | Lý do |
|---|---|
| Không gộp nhiều WP vào một commit | revert chọn lọc (R4) |
| Không chạy eval thật trên DB dùng chung | tạo ticket rác cho cả nhóm; eval chạy `MO_STORE=memory` |
| Không tự bật `hold_near_open_emergency` | Q18 chờ duyệt; đổi kết quả fixture |
| Không sửa `.gitignore` để khỏi `git add -f` | cấu hình chung của nhóm |

## 9. Phân loại lỗi vận hành + hành vi bắt buộc
| Lỗi | Dấu hiệu | Phải làm |
|---|---|---|
| Môi trường | pytest exit 4 / `UnicodeEncodeError` | sửa môi trường (venv 3.11, `PYTHONUTF8=1`), không sửa code |
| Không có Docker | `failed to connect to the docker API` | ghi "⬜ --pg chưa chạy" + lý do; người có Docker chạy cổng |
| Không có khoá DeepSeek | probe `KeyError: 'OPENAI_API_KEY'` | G-LIVE để ⬜; hỏi người cấp khoá (🖐) |
| Startup exit 3 "schema maintops ở revision …" | code và DB lệch revision | §5: owner `upgrade head` (code mới) / pull code mới (thành viên) |
| Cổng đỏ sau 2 vòng | hai report fail cùng cổng | leo thang 🔴 (judge) |
| Hai phép đo mâu thuẫn | worker ≠ SO | so TÊN ca, kiểm `HEAD` + cây sạch |

## 10. Nghiệm thu vận hành (cổng G-SRV, TESTING §7)
| Bước | Lệnh / thao tác | Kỳ vọng (máy đọc được) |
|---|---|---|
| 1 | `python -c "from sqlalchemy import text; from src.config import get_settings; from src.maintenance.store.postgres import sql_engine; c = sql_engine(get_settings().database_url).connect(); print(c.execute(text('select version_num from maintops.alembic_version')).scalar())"` (owner, sau §5 bước 3) | in `0002_p1_doc_shape` |
| 2 | `GET /api/v1/bql/tickets` bằng tài khoản `bql01` | HTTP 200; JSON mỗi hàng có `duplicate_count`, `agent_source`; doc cũ không gây 500 |
| 3 | gửi một phản ánh thử qua `/api/v1/resident/tickets` (`cudan01`) | HTTP 201; `GET /api/v1/mo/ai-logs?ticket_id=<id>` có đúng 1 dòng (`SUCCESS`, hoặc `FALLBACK_RULE` khi chưa cấp khoá) |
| 4 | khởi động thử bản code cũ `82f01f0` trỏ cùng DB (worktree tạm) | thoát mã 3 với thông báo có `upgrade head` — không phục vụ request nào |
Kết quả ghi `planning/06_2026-10-05_reasoning-agent/evidence/G-SRV/*.txt` (output máy); KHÔNG ghi khoá/URL có mật khẩu.

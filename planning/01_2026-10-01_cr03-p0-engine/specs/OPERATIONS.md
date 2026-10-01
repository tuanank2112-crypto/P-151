# OPERATIONS — môi trường, lệnh kiểm, thứ tự WP, ranh giới file, rollback, evidence

Áp cho mọi worker của hồ sơ. Mọi số ở đây do architect đo ngày 2026-10-01 trên `e5ececf` (lệnh kèm theo); worker đo lại, không chép số.

## 1. Môi trường chuẩn (Q05) và nền đo

| Mục | Giá trị / lệnh |
|---|---|
| Python | 3.11 (`py -0p` trên máy đo: `C:\Users\lenku\AppData\Local\Programs\Python\Python311\python.exe`); Python 3.13 hệ thống ⇒ `pytest` exit 4 (thiếu `pytest_asyncio`, `langgraph`) — lỗi môi trường, không phải code |
| venv (ngoài repo — Root Clean §5.G) | `py -3.11 -m venv ../venv311 && ../venv311/Scripts/python.exe -m pip install -r requirements.txt` (Git Bash). Trong phiên architect dùng venv tại scratchpad `…/scratchpad/venv311` (Python 3.11.7, pytest 9.1.1) |
| Biến môi trường | `export LLM_MODE=mock` (mặc định của `Settings`, đặt tường minh); `export PYTHONUTF8=1` khi chạy script in tiếng Việt (console cp1252 ném `UnicodeEncodeError` — đã gặp khi chạy REF) |
| Lệnh test | `python -m pytest -q -p no:cacheprovider; echo "EXIT=$?"` |
| Lệnh lint | `python -m ruff check src tests; echo "EXIT=$?"` · `python -m ruff format --check src tests; echo "EXIT=$?"` |
| Nền đo (architect, 2026-10-01) | `142 passed in 8.11s`, `EXIT=0` · ruff check `All checks passed!` `EXIT=0` · ruff format `47 files already formatted` `EXIT=0` |
| Phân bố 142 test | acceptance 35 · api 23 · auth 13 · engine 39 · fixtures 5 · migration 16 · proposer 6 · `tests/test_agents` 2 · `tests/test_api` 3 (`pytest --collect-only -q \| grep "::" \| cut -d: -f1 \| sort \| uniq -c`) |
| Script tham chiếu | `PYTHONUTF8=1 python planning/01_2026-10-01_cr03-p0-engine/specs/REF-safety-proto.py planning/01_2026-10-01_cr03-p0-engine/specs/SAFETY-CASES-P0.yaml planning/01_2026-10-01_cr03-p0-engine/specs/LEXICON-P0.yaml` ⇒ `TOTAL=84 BAD=0 TIER1_MISS=0 … MERGE_SELFTEST=5 ok`, exit 0, 314 ms |

`python` dưới đây = python của venv 3.11. Chạy từ **root repo** (`D:\P151`); script ngoài pytest cần `PYTHONPATH=.`.

## 2. Thứ tự thi công (Q13) và ranh giới file từng WP

Tuần tự **WP2 → WP3 → WP4 → WP5** cùng một worker-sonnet (giữ cache; cùng `engine.py`), mỗi WP một commit local trên `feature/nhuy-cr03-p0`, **không push** (Q04). WP6 thẩm định cô lập (auditor khác người, chỉ đọc + chạy).

| WP | SPEC | ĐƯỢC GHI (đường dẫn) | CẤM CHẠM | Commit message (tiếng Anh) | "Xong khi" (lệnh + kết quả máy đọc) |
|---|---|---|---|---|---|
| WP2 contract + chốt chặn | 01 §1–§4, §6, §8; P04 §2, §3, §5, §7 (hàng WP2) | `src/maintenance/enums.py`, `models.py`, `catalog.py`, `engine.py` (hằng số §3 của 01; `reopen`; `set_assignee`; nhánh T21; xoá nhánh reopen; `__init__` lexicon/safety_llm — có thể để WP3), `views.py` (§8 của 01), `i18n/vi.yaml`, `seed/maintenance_v1/catalog.yaml`, **`seed/maintenance_v1/lexicon.yaml`** (chép LEXICON-P0 — để `load_lexicon` ở WP2 chạy được) hoặc để WP3 nếu `__init__` chưa nạp; `tests/test_maintenance/{test_engine,test_acceptance,test_api}.py` (chỉ các test P04 §7 hàng WP2) | `src/api/**`, `src/web/**`, `docs/**`, `brain4agent/**`, `plan.md`, `rules.py`, `proposer.py`, `tickets.yaml` | `feat(engine): CR-BPTN-03 P0 contracts — safety/priority vocabulary, transitions, no reopen/assignee` | pytest `EXIT=0`, 0 fail, 0 skip, tổng ≥ 142 − 1 + 1 (reopen test thay bằng no-reopen); ruff check/format `EXIT=0`; 01 §11 M-01…M-03, M-05…M-08 đúng |
| WP3 safety 2b | P01 (toàn bộ); P04 §6.1 | `src/maintenance/safety.py` (mới), `catalog.py` (lexicon loader nếu chưa), `engine.py` (P01 §5), `demo.py` (`observe`), `seed/maintenance_v1/lexicon.yaml`, `seed/maintenance_v1/tickets.yaml` (**chỉ** CLN-004/TEC-005 + header + `dataset_version`), `tests/test_maintenance/test_safety.py` (mới), `tests/test_maintenance/data/safety_cases_p0.yaml` (mới), `tests/test_maintenance/test_api.py::test_bql_filters` | như trên + `views.py` (trừ khi cần `risk_level` cho hàng BQL — đã ở WP2) | `feat(engine): safety layer step 2b with data-driven lexicon and LLM raise-only guard` | pytest `EXIT=0`, 0 fail/skip, tổng ≥ WP2 + 76 (tham số hoá) + 15; P01 §9 S-01…S-06 đúng; `evaluate` 12/12 (P04 §10 G-05) |
| WP4 emergency flow | P02 (toàn bộ) | `engine.py` (P02 §4–§5), `views.py` (P02 §9), `tests/test_maintenance/test_emergency.py` (mới) | như trên | `feat(engine): emergency/safety-review actions for BPTN and BQL, resume/job guard, 4h/12h deadlines` | pytest `EXIT=0`; P02 §12 E-01…E-15 mã hoá thành test và xanh; tổng ≥ WP3 + 15 |
| WP5 priority + rating + seed | P03 (toàn bộ); P04 §4, §6.2, §7 (hàng WP5) | `src/maintenance/priority.py` (mới), `engine.py` (P03 §3; `rate`), `views.py` (P03 §4), `demo.py`, `tickets.yaml` (chỉ dòng `priority:`), `tests/test_maintenance/test_priority.py` (mới), `test_acceptance.py` (2 test rating) | như trên | `feat(engine): rule-based priority with human override, queue sort key, rate-once guard` | pytest `EXIT=0`; P03 §8 R-01…R-07; P04 §10 G-04, G-05; tổng ≥ TESTING §8 G1 |
| WP6 thẩm định | TESTING §6–§8 | `planning/01_2026-10-01_cr03-p0-engine/reports/R06_tham-dinh_p0.md`, `planning/01_2026-10-01_cr03-p0-engine/evidence/P0-audit/*.txt` | mọi file khác (chỉ đọc + chạy; được tạo file tạm trong scratchpad) | `docs(plan-01): audit report R06` | ≥ 3 cách phá đã chạy, mỗi cách có evidence; phán quyết cuối dòng report |

Quy tắc kẹp phạm vi: so **tập đường dẫn** `git status --porcelain` với cột ĐƯỢC GHI (không so số dòng — HANDOFF_PROTOCOL §14 luật 1). File ngoài cột ⇒ `🔁`.

## 3. Quy trình mỗi WP (worker)
1. `git rev-parse HEAD` ngay trước dòng sửa đầu tiên ⇒ ghi làm `Base:` của report (không ghim sẵn).
2. Đọc đúng thứ tự router 00 §0; thi công theo SPEC; **CẤM** sửa SPEC/plan — thấy SPEC sai ⇒ dừng, ghi "Câu hỏi mở" trong report.
3. Chạy 3 lệnh §1 + lệnh "xong khi" của WP; mọi output ghi bằng redirect vào `planning/01_2026-10-01_cr03-p0-engine/evidence/<WP>/<ten-do>.txt` (Git Bash, UTF-8 không BOM, LF). Ví dụ: `python -m pytest -q -p no:cacheprovider > planning/01_2026-10-01_cr03-p0-engine/evidence/WP3/pytest.txt 2>&1; echo "EXIT=$?" >> planning/01_2026-10-01_cr03-p0-engine/evidence/WP3/pytest.txt`.
4. Bộ đo MỚI phải từng ĐỎ một lần (TESTING §6): làm đỏ → chụp output → khôi phục → xanh; cả hai output vào evidence.
5. Commit một lần cho WP (message ở §2) — `git add` **tường minh từng đường dẫn**, không `git add -A` (cây có file untracked của người khác: `docs/Activity Diagram.png`, hai PNG bị xoá chưa commit — **không đụng**).
6. Report `reports/R0N_thi-cong_<WP>.md` theo HANDOFF_PROTOCOL §7/§14: dòng 1 khai vai, `Handoff:/Base:/Head:`, lệnh + exit code nguyên văn, test tổng/pass/fail/skip, `git diff --stat <Base>..<Head>`, bảng phân công, việc KHÔNG làm, câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`

## 4. Rollback
| Tình huống | Lệnh | Ghi chú |
|---|---|---|
| WP vừa commit sai | `git revert --no-edit <sha WP>` | theo thứ tự ngược (WP5 → WP4 → WP3 → WP2) vì các WP phụ thuộc nhau trên `engine.py` |
| Chưa commit, muốn bỏ | `git checkout -- <đường dẫn trong cột ĐƯỢC GHI>` + `git clean -n` (xem trước) rồi `git clean -f <file mới của WP>` | CẤM `git checkout -- .`/`git clean -fd` (xoá file untracked của người khác) |
| Lexicon/catalog YAML hỏng làm engine không khởi tạo | sửa YAML (01 §4/§5) — không sửa code để "chịu" YAML hỏng | fail fast là chủ đích |
| Seed expected lệch | `python -c "from src.maintenance.demo import evaluate; …"` in `mismatches` (P04 §10 G-05) rồi sửa expected theo SPEC — không sửa raw | — |
| Tích hợp sau P0 (Q04) | `git rebase feature/chamanh` do Như Ý/SO làm, không phải worker | điểm va chạm: `engine.py`, `models.py`, `enums.py` |

## 5. Sau khi 4 WP xanh (SO, không phải worker)
- Đồng bộ não 6 điểm (AGENTS.md §5.B): `docs/CR-BPTN-03.md` ghi drift D1–D13 (00 §8) hoặc sửa chữ theo Q-B; `brain4agent/index.md` (thêm `safety.py`, `priority.py`, `lexicon.yaml`), `roadmap.md`, `changelog.md` (MINOR: `1.0.1 → 1.1.0`), `memory/hot/`, `memory-distill.txt`; tài liệu module `docs/<module>.md` cho `src/maintenance` nếu đã có quy ước (hiện chưa có `docs/maintenance.md` — tạo khi đồng bộ, không trong WP).
- Tăng version ở file cấu hình dự án (`state.json` `current_version`; `package.json`/`pyproject.toml` nếu có).

## 6. Bẫy môi trường / vận hành (đã gặp hoặc chắc chắn gặp)
| # | Bẫy | Nhận biết | Xử lý |
|---|---|---|---|
| O-01 | Python 3.13 hệ thống | `pytest` exit 4, `ModuleNotFoundError: pytest_asyncio` | dùng venv 3.11 (§1) |
| O-02 | Console Windows cp1252 | `UnicodeEncodeError: 'charmap' codec can't encode character '\u0110'` khi script `print` tiếng Việt | `export PYTHONUTF8=1` (pytest không cần) |
| O-03 | `lru_cache` trên `load_catalog`/`load_dataset`/`load_lexicon` | sửa YAML mà engine đang chạy không thấy | khởi động lại process; trong test không dùng engine toàn cục |
| O-04 | `.pytest_cache` ở root | vi phạm Root Clean | luôn `-p no:cacheprovider` |
| O-05 | YAML CRLF/BOM do editor Windows | `yaml.safe_load` vẫn đọc được nhưng diff bẩn; BOM làm khoá đầu tiên lệch | lưu LF, UTF-8 không BOM (`file <path>` phải in `UTF-8 text`) |
| O-06 | `validate_assignment=True` trên `Ticket` | gán 1 trường có validator chéo ném `ValidationError` | dùng `_set_ticket(work, **changes)` (P03 §3.1, 01 §7) |
| O-07 | Cây làm việc có thay đổi của người khác (`docs/*.png` D, `docs/Activity Diagram.png` ??) | `git status` không sạch dù chưa làm gì | không stage, không revert chúng; kẹp phạm vi theo cột ĐƯỢC GHI |
| O-08 | Job `run_jobs` trong app (`src/main.py:28`, `asyncio.to_thread`) | không liên quan test; nhưng khi chạy app thật, ticket Bậc 2 sẽ leo thang sau 4 h lịch kể cả cuối tuần | đúng chủ đích Q10 |

## 7. BẮT BUỘC / CẤM / Vùng cấm

**BẮT BUỘC**
1. Mỗi WP kết thúc ở trạng thái xanh (3 lệnh §1 `EXIT=0`, 0 fail, 0 skip) **trước** khi WP sau bắt đầu.
2. Mọi PASS có evidence máy sinh (redirect), report chỉ trỏ; lời "đã xong" không phải bằng chứng.
3. Số test chỉ tăng; test bị thay thế phải có test thay thế cùng commit (P04 §7).
4. Giữ `engine.lock` cho entry point ghi mới (đi qua `_mutate`/`transition` là đủ) — kiểm bằng grep: mọi `def <method>` công khai mới trong `engine.py` có `self._mutate(` hoặc `self.transition(` trong thân, hoặc `with self.lock:` bao ngoài.

**CẤM**
1. `git push`, `git commit` lên nhánh khác `feature/nhuy-cr03-p0`, `git add -A`, `git stash` để "dọn" cây của người khác.
2. Sửa `src/api/**`, `src/web/**`, `docs/**`, `brain4agent/**`, `plan.md`, `specs/**` trong WP2–WP5.
3. Bật `LLM_MODE=openai` hay đặt `OPENAI_API_KEY` trong test/evidence.
4. Chạy tác vụ dài ở nền rồi để report chờ nó (HANDOFF §14 luật tác vụ dài): mọi lệnh đo chạy chặn ở tiền cảnh (pytest toàn bộ ≈ 8 s).

**Vùng cấm**
| # | Không làm | Lý do |
|---|---|---|
| O-V1 | Không gộp 4 WP vào một commit "cho gọn" | rollback theo WP; `git revert` chọn lọc |
| O-V2 | Không tạo `docs/maintenance.md` trong WP | ngoài phạm vi worker; làm ở bước đồng bộ 6 điểm (§5) |
| O-V3 | Không "sửa luôn" router/UI để nối method mới dù rất gần | Q01/Q02 giao chủ việc khác; conflict với `feature/tri`/`chamanh` |
| O-V4 | Không thêm venv/`.pytest_cache`/script tạm vào root | Root Clean §5.G; dùng scratchpad |

## 8. Phân loại lỗi vận hành + hành vi bắt buộc
| Lỗi | Dấu hiệu | Caller (worker/SO) phải |
|---|---|---|
| Môi trường (O-01, O-02) | exit 4 / `UnicodeEncodeError` | sửa môi trường, **không** sửa code/test để né |
| SPEC mâu thuẫn code | không thể làm cả hai (vd test cũ đòi `reopen` xanh) | làm theo SPEC (P04 §7 đã liệt kê test phải đổi); ngoài danh sách ⇒ dừng, hỏi |
| Phạm vi (file ngoài cột ĐƯỢC GHI xuất hiện trong `git status`) | `🔁` chắc chắn | hoàn tác file đó trước khi nộp |
| Cổng đỏ sau 2 lần sửa | hai report fail cùng cổng | leo thang 🔴 (judge) — không thử lần 3 trong im lặng |
| Hai phép đo mâu thuẫn (worker vs SO) | số khác nhau | so TÊN ca test, không so con số; kiểm `HEAD` + cây sạch |

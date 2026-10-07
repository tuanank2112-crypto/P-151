Vai: worker (vai-thi-cong) · loại: thi công · họ/model: Claude Sonnet 5.5 · Bước 0: exit 1 (đúng một dòng `BRN-002 … khối luật: boot`, miễn theo Q21) · hiểu việc: viết `agent/{prompt,client,baseline,validate,reconcile,graph,agent}.py` + 4 hàm bằng chứng/`SplitVerdict`/`_matches_both` trong `rules.py` + `openai` trong requirements + 3 file test; xong khi 3 file test EXIT=0, REF `SELFTEST_FAILURES=0`/`FAILURES=0`/`VARIANT_FAILURES=0`, 3 đột biến đỏ, toàn bộ pytest 0 fail/0 skip, ruff EXIT=0; CẤM `engine/models/enums/catalog/safety/proposer/lexicon`, `src/api|web|agents`, SPEC, plan, commit/push, gọi mạng.
Handoff: handoffs/H04_thi-cong_WP3.md
Base: 37cfd2dc50ebd9649a8a050d674f015ca5119636 (worktree khởi tạo ở 50fe728; đã `git reset --hard 37cfd2d` theo lệnh, cây sạch)
Head: chưa commit (SO gộp)

## Lệnh + exit (evidence trong `evidence/WP3/`)
| Lệnh (đều `LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=.`) | Exit | Kết quả | Evidence |
|---|---|---|---|
| `pytest` 3 file test mới (trước sửa) | 2 | `3 errors during collection` (`cannot import name 'prompt'`, `'SplitVerdict'`) | [red-before.txt](../evidence/WP3/red-before.txt) |
| `pytest` 3 file test mới | 0 | `80 passed` | [green.txt](../evidence/WP3/green.txt) |
| `REF-agent-contract.py --selftest` | 0 | `SELFTEST_FAILURES=0` | [ref.txt](../evidence/WP3/ref.txt) |
| `REF-split-verdict.py --variants` | 0 | `MUST_SPLIT=32 MUST_NOT_SPLIT=18 FAILURES=0`, `SINGLE_JOB_VARIANTS_SPLIT=0`, `VARIANT_FAILURES=0` | [ref.txt](../evidence/WP3/ref.txt) |
| đột biến (a) bỏ kiểm grounded của job | 1 | `2 failed, 49 passed` — A-08, A-08b đỏ; đã khôi phục | [mutation-a.txt](../evidence/WP3/mutation-a.txt) |
| đột biến (b) mọi trích dẫn coi là grounded (thay `merge_llm` bằng bản giữ PRESENT) | 1 | `1 failed, 50 passed` — A-04 đỏ; đã khôi phục | [mutation-b.txt](../evidence/WP3/mutation-b.txt) |
| đột biến (c) bỏ dòng G-1 | 1 | `1 failed, 50 passed` — A-18 đỏ; đã khôi phục | [mutation-c.txt](../evidence/WP3/mutation-c.txt) |
| `pytest -q -p no:cacheprovider` (toàn bộ) | 0 | `3079 passed, 31 deselected` | [pytest.txt](../evidence/WP3/pytest.txt) |
| `test_classify_metamorphic.py` + `test_safety_metamorphic.py` | 0 | `991 passed` (0 vi phạm) | [metamorphic.txt](../evidence/WP3/metamorphic.txt) |
| `ruff check src tests` / `ruff format --check src tests` | 0 / 0 | `All checks passed!` / `92 files already formatted` | [ruff.txt](../evidence/WP3/ruff.txt) |
| `grep -cP '[\x08\x0b\x0c]'` trên 12 file đã sửa/tạo (7 module agent, rules.py, requirements.txt, 3 test) | — | 0 cả 12 | — |

Test: tổng 3079 · pass 3079 · fail 0 · skip 0 · deselected 31 (ca `pg`). Nền base 37cfd2d đo cùng lệnh nhưng `--ignore` 3 file mới: `2999 passed, 31 deselected` ⇒ +80 test mới (A/P/RE).

## git diff --cached --stat
21 file (20 trước report này): `requirements.txt` (+1), `src/maintenance/rules.py` (+157/−8), `agent/{agent,baseline,client,graph,prompt,reconcile,validate}.py` (mới), 3 file test (mới), `evidence/WP3/*` (9 file). Tổng trước report: `21 files changed, 2904 insertions(+), 8 deletions(-)` (đã gồm evidence; số cuối xem `git diff --cached --stat` trong worktree). Không đụng `agent/schema.py`, `agent/inputs.py`, `agent/__init__.py`.
Worktree: `D:/P151/.claude/worktrees/agent-a22c6c85a1a57a558`.

## Bảng phân công
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP3 a–e | 🟠 | Claude Sonnet 5.5 (tự làm, không giao con) |

## Quyết định thi công (chỗ SPEC để ngỏ; SO đổi được)
- Tên nút LangGraph có hậu tố `_node` (`rules_node`, `llm_node`, `parse_node`, `validate_node`, `reconcile_node`, `finish_skip_node`, `fallback_node`): LangGraph cấm tên nút trùng khoá state (`rules`). `AgentState` thêm khoá `user`, `log_id` ngoài danh sách SPEC §8.
- Bỏ nút `finish_rules`: `client is None` ⇒ `fallback_reason="HTTP_ERROR"` không gọi, không log (Literal 01 §3.3 không có lý do riêng).
- Đường dẫn `rejected` mức phần của vị trí: `location.building` / `location.floor` / `location.area`; trích dẫn vị trí không grounded ⇒ `location` (cả vị trí). Job bị loại ⇒ `jobs[i]`; trường job ⇒ `jobs[i].{department_id,priority,duplicate_of,asset_id,materials}`; `ask_fields`.
- Record không phải `AGENT` có `model="rules"`, `prompt_version=""` khi không gọi mô hình.
- `AssertionError` do client ném (client giả thiếu kịch bản) KHÔNG bị nuốt thành fallback; mọi `Exception` khác từ client ⇒ fallback. Thông điệp lỗi ghi `ai_logger` được che `sk-…`/`Bearer …`.
- `prompt_only`: bỏ hàng rào ```` ``` ```` + cắt `{…}` làm TRONG `openai_json_client`; agent chỉ `json.loads` chặt.
- `mirror_decision` chỉ cho 2 job khi `rules.split_verdict` = SPLIT_PAIR, `classify` = CATEGORY_UNCLEAR, `auto_split_mixed_reports`, và an toàn luật = NONE (khớp P05 §3 điều kiện 4). Hệ quả: 1/32 câu `MUST_SPLIT` ("…bóng đèn đã cháy", luật an toàn ra T2-03 UNCLEAR) mirror ra 0 job, TO_BPTN CATEGORY_UNCLEAR (test khẳng định `split_count == 31`).
- `rules.location_mentions` trả mã tòa/tầng viết thường (đúng REF, từ `normalize`).
- Cổng ruff chạy `ruff check src tests` (như báo WP4); `ruff check` trần quét cả `planning/**` cũ và đỏ từ trước (không thuộc phạm vi).

## Việc KHÔNG làm + lý do
- Không commit/push, không `git add -A` (stage tường minh từng file). Không sửa SPEC/plan/schema/inputs.
- Không dựng test A-03, A-07, A-13, A-20…A-31, A-33, PAR (thuộc WP6, cần engine); không đụng `tests/test_maintenance/helpers.py` (thuộc WP6).
- `LockProbeClient` chỉ kiểm bằng engine giả (`SimpleNamespace`); phép đo thật I-16 thuộc WP6.
- Không chạy `--pg` (WP3 không đụng store).

## Câu hỏi mở (SPEC mâu thuẫn/để ngỏ; làm phần độc lập, không tự quyết thay SPEC)
1. TESTING A-06: "luật NONE + S-10 PRESENT trích 'mùi gas'" không dựng được: lexicon hiện `active_phases=[P0]` ⇒ `merge_llm` bỏ S-10; bật P1 thì luật tự bắt "mùi gas" (`detected_by=RULE`, ra EMERGENCY ⇒ SKIPPED). Test dùng câu "bình gas nghe xì xì" (luật P1 ra NONE) + lexicon P0+P1 dựng bằng `model_copy`, kiểm đúng ý (Agent bắt thứ luật sót, `detected_by=LLM`). Đề nghị SPEC TESTING §3.1 A-06 đổi câu.
2. TESTING A-18 ca G-3: câu "Hành lang tầng 3 tòa S1, ổ cắm bị ướt" + job VE_SINH có R = ∅ nên G-1 (SERIOUS category) cũng bắn ⇒ không phải "đúng một" SERIOUS. Test khẳng định `electrical_hazard ∈ SERIOUS` cho câu SPEC, và "đúng một SERIOUS" cho câu "Hành lang tầng 3 tòa S1 nhiều rác, ổ cắm bị ướt" (R={VE_SINH}).
3. SPEC-P01 §3.3 nói `derive_risk_level` cho tín hiệu Agent, nhưng S-00 chưa có trong lexicon (thuộc WP2) ⇒ `derive_risk_level` trả NONE cho S-00. Code đặt tường minh mức ≥ UNCLEAR khi thêm S-00 `LLM-UNGROUNDED`; khi WP2 thêm S-00 (tier 1) kết quả không đổi.
4. `rule_location` = `data.locks.location` khi có khoá (SPEC §2 `location = locks.location or extract…`); G-2 vì vậy tắt bằng kiểm `locks.location is None`, không dựa vào `rule_location`.

## Bàn giao cho WP6 (đọc record)
`valid_job_indexes`, `rejected` (đường dẫn trên), `agent_location`/`agent_missing_parts`, `disagreements` (SERIOUS ⇒ engine thêm cờ), `reconcile.safety_for(record, safety_text, lexicon, model)`, `ReasoningAgent.fallback(data, reason)`, `build_agent(settings, catalog, lexicon, clock)` (None khi mock/thiếu khoá/`mo_agent_enabled=False`; dựng không gọi mô hình). Import theo module con: `from src.maintenance.agent.agent import ReasoningAgent, build_agent`.

⏳ Chờ người duyệt.

Vai: worker (vai-thi-cong) · loại: thi công · họ/model: Claude Opus 5.5 · Bước 0: exit 0 · hiểu việc: sửa E-6 để lọc theo loại BĐS mà câu hỏi nêu thẳng (tra từ điển, không dùng LLM) và E-5 chỉ báo mâu thuẫn khi section hạng cao nhất đã qua E-1..E-4/E-6 thuộc một nhóm mâu thuẫn; chỉ ghi eligibility.ts, lời gọi trong index.ts, test mới, evidence, report; xong khi tsc 0, test ≥263+mới / 0 fail / 0 skip, BB 0, probe 4/4, S03 vẫn ra G1; CẤM lib/eval, evals, scripts, specs, git add/commit/stash, chạy Golden
Handoff: planning/01_2026-09-20_resident-agent-v1/handoffs/H27_d56-eligibility-e5-e6.md
Base: 0f817fd
Head: 0f817fd (chưa commit, handoff CẤM commit)

## Lệnh + exit
| Lệnh | Exit | Evidence |
|---|---|---|
| `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` | 0 | — |
| `node --test tests/eligibility-d56.test.ts` (mã CŨ) | 1 · 10 tests / 3 pass / 7 fail | `evidence/h27-eligibility/red.txt` |
| `node --test tests/eligibility-d56.test.ts` (mã MỚI) | 0 · 10/10 pass | `evidence/h27-eligibility/green.txt` |
| mutation M1/M2/M3 trên eligibility.ts (đã khôi phục, `cmp` = RESTORED) | M1 2 fail · M2 2 fail · M3 1 fail | `evidence/h27-eligibility/mutation_red.txt` |
| `npx tsc --noEmit` | 0 (output rỗng) | `tsc.txt` |
| `node scripts/run_tests.mjs` | 1 · 280 tests / 269 pass / 11 fail / 0 skip, cả 11 ca fail đều là `EMAXCONNSESSION` (pool_size 15) | `tests_full.txt` |
| chạy lại riêng 9 file Postgres (conflict-citations, conversation-id, memory, eval-golden-injection, hitl-enqueue, pipeline-steps-persist, p05-bb01-pickleball, p05-precheck-guard, p05-quota) | mỗi file exit 0 · 33/33 pass | `tests_rerun_pg.txt` |
| `bash scripts/check_adapter_boundary.sh` | 0 · `violations: 0` | `adapter_boundary.txt` |
| `bash scripts/check_no_hardcoded_knowledge.sh` | 0 · `matches: 0` | `no_hardcoded.txt` |
| `node evidence/h27-eligibility/probe.ts` (Postgres, không gọi model) | 0 · `TỔNG: 4/4 OK` | `probe.txt` |
| `node evidence/h27-eligibility/probe_s03_repeat.ts` (S03 × 30) | 0 · 30/30 top1=BLD-AMEN-07, groups=["CG-BBQ-CAPACITY"] | `probe_s03_repeat.txt` |
| `grep -cP '[\x08\x0c\x0b]'` trên 5 file đã ghi | 0 cả 5 | — |

## Test
Toàn bộ: 280 = 263 nền + 10 mới (`eligibility-d56`) + 7 của H28 (`golden-any-of`). Lượt gộp: 269 pass. Cả 11 ca fail đều thuộc 9 file Postgres, và chạy lại riêng từng file thì cả 9 xanh (33/33). ⇒ 280/280 pass sau khi chạy lại, 0 skip. Chưa chạy được một lượt gộp nào xanh trọn vì pool Postgres dùng chung (worker H28 chạy song song).
DEF-03 (`conflict-citations`, Postgres thật): 2/2 pass ⇒ S03 vẫn ra `G1_conflict`, trích dẫn BBQ-CAP-01 và BLD-AMEN-07.

## Probe W3 (câu hỏi GỐC, principal apartment)
| Ca | Section đúng | Hạng/trạng thái | conflict_groups |
|---|---|---|---|
| F-I05-04 | COM-HOURS-02 | #1 eligible | [] |
| F-I05-05 | VIL-FENCE-02 | #1 eligible | [] |
| F-I03-02 | BBQ-BOOK-02 | #1 eligible (CAP-01 #2, AMEN-07 #5 → conflict) | [] |
| S03 | — | #1 BLD-AMEN-07 → conflict | ["CG-BBQ-CAPACITY"] |

## git diff --stat (chỉ phần của H27)
```
 lib/pipeline/eligibility.ts | 67 ++++++++++++++++++++++++++++++++++++++++-----
 lib/pipeline/index.ts       |  4 ++-
 2 files changed, 63 insertions(+), 8 deletions(-)
```
File mới (untracked): `tests/eligibility-d56.test.ts`, `planning/.../evidence/h27-eligibility/*`, báo cáo này. Trong cây làm việc còn `lib/eval/score.ts`, `evals/golden/*` và `tests/golden-any-of.test.ts` đã bị sửa. Các file đó thuộc H28, H27 không chạm.

## Bảng phân công
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| W1 E-6 PROPERTY_MENTIONS | 🟠 | Claude Opus 5.5 (lên tầng, không phóng agent con) |
| W2 E-5 theo hạng | 🔴 | Claude Opus 5.5 |
| W3 probe Postgres | 🟠 | Claude Opus 5.5 |
| W4 red/green + mutation | 🟢 | Claude Opus 5.5 |
| W5 cổng | 🟢 | Claude Opus 5.5 |

## Việc KHÔNG làm + lý do
- Chưa chạy Golden: handoff cấm, SO sẽ chạy sau.
- Probe dùng câu hỏi GỐC, không dùng `normalized_query_vi`. A1 là LLM mà handoff cấm gọi model. Pipeline thật truy hồi và chạy E-6 trên `a1.normalized_query_vi` (index.ts truyền đúng như W1 yêu cầu). Nếu A1 viết lại câu mà mất cụm "biệt thự"/"thương mại" thì E-6 quay về lọc theo principal, tức là an toàn nhưng F-I05-04/05 vẫn trượt. Chỉ Golden mới đo được trường hợp này.
- Không có khoá phụ khi xếp đồng điểm ở `lib/retrieval/query.ts:56` (`ORDER BY score DESC`), vì file này nằm ngoài phạm vi.

## Câu hỏi cần người
1. **Rủi ro S03 (E-5 mới phụ thuộc hạng):** trên Postgres, 4 chunk S03 đồng điểm 0.3750 ở hạng 1–4 (BLD-AMEN-07, BBQ-BOOK-02, SPORTS-BOOK-02, BBQ-CAP-01). G1 chỉ ra được vì BLD-AMEN-07 đứng đầu trong nhóm đồng điểm. Lượt đo hiện tại cho 30/30 ổn định, nhưng thứ tự này KHÔNG được hợp đồng bảo đảm, vì SQL không có khoá phụ. Nếu planner Postgres đổi thứ tự (vacuum/reindex/seed lại) thì S03 có thể mất G1 và trả lời theo BBQ-BOOK-02. Đề xuất: mở gói riêng thêm khoá phụ tất định vào `ORDER BY` (vd `score DESC, id`) hoặc định nghĩa "hạng cao nhất" theo điểm (có nhóm mâu thuẫn nào đồng điểm với hạng 1 thì báo). Việc này là đổi hợp đồng §5 hoặc §4.2 nên cần 🔴 quyết định.

## Tiếp theo
🖐 Cần tay người: quyết định câu hỏi 1 (khoá phụ ORDER BY hay định nghĩa hạng theo điểm cho E-5).
🤖 Agent làm được ngay: SO chạy Golden M1 sau khi H28 xong; commit H27 (eligibility.ts, index.ts, tests/eligibility-d56.test.ts, evidence/h27-eligibility, report).
⭐ Nên làm trước: chốt câu hỏi 1 trước khi chạy Golden, vì kết quả S03 đang dựa vào thứ tự đồng điểm mà hợp đồng không bảo đảm.
⏸ Chưa làm: chạy Golden (bị cấm); khoá phụ ORDER BY (nằm ngoài phạm vi).

✅ Mọi "xong khi" của W1–W5 đều đạt theo số đo ở trên. Rủi ro đồng điểm của S03 đã nêu ở câu hỏi 1.

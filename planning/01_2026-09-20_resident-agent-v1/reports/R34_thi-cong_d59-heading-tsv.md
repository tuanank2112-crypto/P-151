Vai: worker (vai-thi-cong) · loại: thi công · họ/model: Claude Opus 5.5 (1M) · Bước 0: exit 0 (NÃO ĐÃ OK; cảnh báo BRN-028 today.md 163 dòng, ngoài phạm vi) · hiểu việc: migration 007 đưa `heading_vi` vào `chunks.tsv` (tiêu đề A, nội dung D như cũ) lên DB thật; mọi INSERT chunks ghi heading_vi; mock cộng điểm tiêu đề / xong khi migrate exit 0 ×2 + chunk không đổi + heading rỗng 0 + đo trước/sau 8 câu + tsc 0 + test ≥289+mới 0 fail 0 skip + 4 cổng / cấm: 001–006, pipeline, query.ts, eval, specs, brain, package.json, git ghi, Golden
Handoff: planning/01_2026-09-20_resident-agent-v1/handoffs/H30_d59-heading-in-tsv.md
Base: 445a424
Head: 445a424 (chưa commit — handoff CẤM git add/commit)

## Lệnh + exit (evidence: `evidence/h30-heading-tsv/`)
| Lệnh | Exit | Kết quả | File |
|---|---|---|---|
| `init_brain.js --check` | 0 | NÃO ĐÃ OK | — |
| `measure_rank.mjs before` (TRƯỚC migrate) | 0 | chunks=98 | before.txt |
| `dryrun_007.mjs` (BEGIN…ROLLBACK, trước migrate) | 0 | chunks=98 heading_empty=0 | dryrun_before_migrate.txt |
| `node --env-file=.env.local scripts/migrate.mjs` lần 1 | 0 | applied 1 · skipped 6 | migrate.txt |
| `node --env-file=.env.local scripts/migrate.mjs` lần 2 | 0 | applied 0 · skipped 7 | migrate.txt |
| `migrate.mjs --status` | 0 | 007 đã áp dụng | migrate.txt |
| `dryrun_007.mjs` chạy lại nội dung 007 trên DB đã có 007 | 0 | idempotent, chunks=98 heading_empty=0 | migrate.txt |
| `measure_rank.mjs after` | 0 | chunks=98, heading_empty=0 | after.txt |
| `invariant_no_heading.mjs` | 0 | chunk KHÔNG khớp tiêu đề: max \|Δscore\| = 0 cả 8 câu | invariant_no_heading.txt |
| `probe_conflict_bbq.mjs` | 0 | xem mục Hồi quy | probe_conflict_bbq.txt |
| `npx tsc --noEmit` | 0 | — | tsc.txt |
| `node --env-file=.env.local scripts/run_tests.mjs` | **1** | 292 tổng · 287 pass · **5 fail** · 0 skip | tests_full.txt |
| `bash scripts/check_adapter_boundary.sh` | 0 | violations: 0 | gates.txt |
| `bash scripts/check_no_hardcoded_knowledge.sh` | 0 | matches: 0 | gates.txt |
| `node scripts/validate_knowledge.mjs` | 0 | defects_ok: 4/4 | gates.txt |
| `node scripts/check_enum_closed.mjs` | 0 | match: true | gates.txt |
| `tests/heading-tsv.test.ts` trên bản sao `git archive HEAD` | 1 | 3/3 ĐỎ trên mã cũ | red_on_old_code.txt |
| `grep -cP '[\x08\x0c\x0b]'` trên 5 file sửa + 4 script evidence | — | 0 mọi file | — |

W1 số đo: `count(*) chunks` trước 98 / sau 98 · `heading_vi=''` = 0 · `schema_migrations` có `007_chunk_heading_tsv.sql`.
W2: `grep -n "INSERT INTO chunks" lib scripts` → bql-store.ts:465, :621, seed_knowledge.mjs:164 — cả 3 có `heading_vi`. bql-store lấy heading từ JSON sections ($8 / $9) theo section_id; không đổi mảng tham số.

## W4 — hạng section đúng (Postgres thật, SQL của `buildLexicalQuery`, TOP_K 8)
| Case | Section | Hạng trước | Điểm trước | Hạng sau | Điểm sau | Top1 trước (điểm) | Top1 sau (điểm) |
|---|---|---|---|---|---|---|---|
| F-I04-02 chuyển đồ | MOVE-TIME-03 | 13 | 0.2857 | **1** | 0.8649 | MOVE-SCOPE-01 (0.5000) | MOVE-TIME-03 (0.8649) |
| F-I04-04 thi công | CONS-TIME-03 | 5 | 0.3750 | **1** | 0.8214 | VIL-RENOVATE-03 (0.5455) | CONS-TIME-03 (0.8214) |
| F-I03-01 bể bơi trẻ em | POOL-SAFE-03 | 1 | 0.6154 | 2 | 0.7826 | POOL-SAFE-03 (0.6154) | POOL-ENTRY-02 (0.8000) |
| F-I01-04 phí cấp lại thẻ | CARD-FEE-05 | 2 | 0.5455 | 2 | 0.8387 | PARK-LOST-06 (0.5833) | CARD-REISSUE-03 (0.8901) |
| F-I02-05 tốc độ hầm | PARK-SPEED-03 | 1 | 0.5238 | 1 | 0.8361 | PARK-SPEED-03 | PARK-SPEED-03 |
| F-I03-02 BBQ đặt lượt | BBQ-BOOK-02 | 1 | 0.5455 | 1 | 0.8387 | BBQ-BOOK-02 | BBQ-BOOK-02 |
| F-I05-05 hàng rào | VIL-FENCE-02 | 1 | 0.4444 | 1 | 0.7368 | VIL-FENCE-02 | VIL-FENCE-02 |
| F-ESC-01 pickleball | (không có) | — | — | — | — | POOL24-BAN-02 (0.3750) | POOL24-HOURS-01 (0.7727) |

Ghi chú: CONS-TIME-03 hạng 5 (không phải 9 như handoff) với câu Golden gốc — hạng 9 có lẽ đo trên câu đã chuẩn hoá của A1.
Bất biến "không khớp tiêu đề ⇒ điểm giữ nguyên" ĐÚNG ở mức chunk (Δ = 0). Nhưng trong cả 8 câu, top1 sau migrate ĐỀU khớp ít nhất một từ tiêu đề ⇒ **điểm top1 tăng 0.18–0.40 ở mọi câu**, kể cả câu đối chứng và pickleball (0.375 → 0.773). Nghĩa là phân bố s1 dịch lên toàn bộ.

## Hồi quy — 5 test đỏ (trước: 289/289)
| Test | Backend | Nguyên nhân đo được |
|---|---|---|
| conflict-citations.test.ts Đ38 DEF-03 | Postgres thật | "Vườn BBQ cho tối đa bao nhiêu người một lượt?": top1 cũ BLD-AMEN-07 (nhóm CG-BBQ-CAPACITY) → top1 mới BBQ-BOOK-02 (tiêu đề khớp "lượt"). Cặp BBQ-CAP-01/BLD-AMEN-07 vẫn trong top 8 (hạng 5/4) nhưng luật Đ56 chỉ báo nhóm chứa top1 ⇒ không G1, đi tiếp A2 (transport giả ⇒ ContractDriftError) |
| (test H25 W6 d, DEF-03 s4_conflict) | Postgres thật | cùng nguyên nhân |
| pipeline-order.test.ts step-order chặng 7 | mock | câu chuẩn hoá "sân pickleball giờ mở cửa": trước rỗng ⇒ G2 zero eligible; sau mock nhận PLAY-HOURS-04 (tiêu đề "Giờ hoạt động Sân chơi trẻ em" khớp "giờ", "sân") ⇒ đi A2 |
| p05-pipeline-a1-action.test.ts W1 câu hỏi nội quy | mock | cùng câu chuẩn hoá pickleball |
| p05-pipeline-action.test.ts (e) | mock | cùng câu chuẩn hoá pickleball |

Đã thử (không giữ) biến thể mock: tiêu đề không tính vào cổng từ khoá / cổng coverage ⇒ MOVE-TIME-03 lại rơi khỏi kết quả (không đạt W3). Không có biến thể "chỉ cộng điểm tiêu đề" nào vừa đạt W3 vừa giữ pickleball rỗng mà không chế ngưỡng riêng cho test. KHÔNG sửa test hiện có (ngoài phạm vi, và sẽ là sửa test cho xanh).

## git diff --stat (Base 445a424; plan.md, 01-CONTRACTS.md, H30 đã bẩn từ trước, không phải của worker)
```
 lib/adapters/bql-store.ts   | 14 +++++++++----
 lib/adapters/store-mock.ts  | 23 +++++++++++++++++++---
 scripts/seed_knowledge.mjs  | 10 ++++++----
 mới: db/migrations/007_chunk_heading_tsv.sql · tests/heading-tsv.test.ts · evidence/h30-heading-tsv/ (16 file)
```

## Phân công
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| W1 migration DB thật | 🔴 | Claude Opus 5.5 |
| W2 INSERT heading_vi | 🟠 | Claude Opus 5.5 (lên tầng: không có subagent) |
| W3 mock | 🟠 | Claude Opus 5.5 |
| W4 đo | 🟠 | Claude Opus 5.5 |
| W5 cổng | 🟢 | Claude Opus 5.5 |

## Việc KHÔNG làm + lý do
- Không sửa 5 test đỏ: ngoài phạm vi ghi; cần quyết định thiết kế.
- Không rollback 007: không có lệnh; DB thật hiện ĐANG ở trạng thái sau 007 (DEF-03 trên Postgres đổi hành vi như trên).
- Không canh CONS-TIME-03 ở mock: cổng "từ khoá IDF cao" của mock loại nó (hạng 1 trên Postgres).
- Không chạy Golden (CẤM).

## Câu hỏi cần người
1. DEF-03 trên DB thật: chấp nhận top1 BBQ-BOOK-02 và đổi luật Đ56 (báo nhóm mâu thuẫn khi thành viên nằm trong top-N / gần điểm top), hay giảm trọng số tiêu đề (B/C thay A), hay rollback 007?
2. Điểm top1 tăng 0.18–0.40 ở mọi câu (pickleball 0.77): có cần hiệu chỉnh lại TAU_ANSWER / công thức s1 không (SPEC-P02 §6.1)?
3. S01 pickleball ở mock nay không còn thoát G2 ⇒ 3 test mock đỏ: cập nhật kỳ vọng test (đi A2, dựa G3 từ chối) hay giữ mock cũ cho câu không khớp tiêu đề mạnh?

Tiếp theo
🖐 Cần tay người: quyết 3 câu hỏi trên; DB thật đang chạy 007 — nếu cần trả DEF-03 ngay thì quyết rollback.
🤖 Agent làm được ngay: migration ngược 008 (bỏ trọng số tiêu đề) hoặc sửa theo phương án được chọn.
⭐ Nên làm trước: câu 1 (DEF-03) — là khuyết tật Golden đang trượt trên DB thật.
⏸ Chưa làm: 5 test đỏ, Golden, commit — lý do ở trên.

⛔ DỪNG: W5 đỏ 5/292 test do hệ quả thiết kế Đ59 (DEF-03 G1 trên Postgres thật; S01 pickleball ở mock) — cần SO/chủ tịch quyết trước khi đi tiếp.

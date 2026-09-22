# R25 — Đồng bộ não sau P05 (chỉ tài liệu)

Vai: worker (vai-thi-cong) · loại: THI CÔNG · họ/model: claude-sonnet-5 · Bước 0: exit 0 ·
hiểu việc: chỉ ghi vào các file tài liệu được liệt (specs/01-CONTRACTS.md, SPEC-P04,
SPEC-P05, TESTING-ACCEPTANCE, plan.md, brain4agent/{roadmap,changelog,index,
-data-architecture,-known-gotchas,memory-distill.txt,memory/hot/{today.md,state.json}});
xong khi = mọi số chép vào tài liệu có nguồn file/lệnh thật (report R22/R23/R24,
evidence/so-p05/*), state.json vẫn là JSON hợp lệ, `memory-distill.txt` < 100 dòng,
`init_brain.js --check` cuối cùng ra "NÃO ĐÃ OK"; cấm bằng lời mình = không tự tuyên bố
gate ĐẠT nếu không đo lại được đúng lệnh gate ghi.

Handoff: giao trực tiếp trong hội thoại (không có file handoff riêng), tham chiếu
`plan.md` §2 Đ48, `reports/R22–R24`, `evidence/so-p05/`.

## Bước 0

```
$ node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check
👉 Trạng thái: NÃO ĐÃ OK — KHÔNG CẦN NÂNG CẤP THÊM!
EXIT:0
```
(chạy cả đầu và cuối phiên, cùng kết quả)

## Lệnh đã chạy + exit code nguyên văn (đo lại số liệu trước khi ghi vào tài liệu)

```
$ npx tsc --noEmit
EXIT:0

$ bash scripts/check_no_confidence_ui.sh
matches: 0
EXIT:0

$ bash scripts/check_adapter_boundary.sh
violations: 0
EXIT:0

$ node scripts/validate_knowledge.mjs
documents: 19 · sections: 98 · defects_ok: 4/4
EXIT:0

$ node --env-file=.env.local scripts/run_tests.mjs memory
tests 5 · pass 5 · fail 0 · skipped 0
EXIT:0

$ npm run test -- authz
tests 3 · pass 3 · fail 0 · skipped 0    -- KHÔNG khớp "8/8" mà gate G03 ghi; để G03 ⬜
kèm lý do trong TESTING-ACCEPTANCE.md, không tự tick

$ npm run test -- review-state-machine
"Không tìm thấy test nào khớp \"review-state-machine\" trong tests/"    -- tên test file
thật là bql-review.test.ts; để G10 ⬜ kèm lý do, không tự tick
```

Số liệu chép từ evidence có sẵn (không tự bịa, không đo lại vì không đổi từ lúc ghi):
`evidence/so-p05/p05_m1.txt` (`capabilities: 9 · write: 2 · write_without_precheck: 0`),
`evidence/so-p05/p05_m2.txt` (`separated: true`), `evidence/so-p05/tests_236.txt`
(`236/236/0/0`), `evidence/so-p05/demo_2339_exit0.txt` (6 bước, `EXIT=0`).

## Test tổng/pass/fail/skip

Không sửa code/test trong gói này — không có bộ test mới để chạy. Các lệnh đo lại ở
trên (memory, authz) dùng để xác nhận số ghi vào `TESTING-ACCEPTANCE.md` §7 là đúng
thật tại thời điểm ghi, không phải chép mù từ evidence cũ.

## `git diff --stat` + SHA

```
brain4agent/-data-architecture.md                  | 23 ++++++-
brain4agent/-known-gotchas.md                      |  8 +++
brain4agent/changelog.md                           | 51 +++++++++++++++
brain4agent/index.md                               | 59 ++++++++++++++---
brain4agent/memory-distill.txt                     | 41 ++++++------
brain4agent/memory/hot/state.json                  | 30 +++++----
brain4agent/memory/hot/today.md                    | 20 ++++++
brain4agent/roadmap.md                             | 29 +++++++--
planning/01_2026-09-20_resident-agent-v1/plan.md   |  6 +-
.../specs/01-CONTRACTS.md                          | 73 ++++++++++++++++++++++
.../specs/SPEC-P04-Eval-Dashboard.md               | 29 +++++++--
.../specs/SPEC-P05-Action-Layer.md                 | 36 +++++++++++
.../specs/TESTING-ACCEPTANCE.md                    | 28 ++++-----
13 files changed, 362 insertions(+), 71 deletions(-)
```
SHA (chưa commit, working tree): `77fe9011805d7f712f0fdecb5e7c557f28bdd6c2` (HEAD lúc bắt
đầu và kết thúc phiên — không có commit nào chen vào).

`grep -cP '[\x08\x0c\x0b]'` trên toàn bộ 13 file đã sửa: **0** ở mọi file (đã kiểm từng
file, liệt kê nguyên văn ở dưới).

```
planning/.../specs/01-CONTRACTS.md: 0
planning/.../specs/SPEC-P04-Eval-Dashboard.md: 0
planning/.../specs/SPEC-P05-Action-Layer.md: 0
planning/.../specs/TESTING-ACCEPTANCE.md: 0
planning/.../plan.md: 0
brain4agent/roadmap.md: 0
brain4agent/changelog.md: 0
brain4agent/index.md: 0
brain4agent/-data-architecture.md: 0
brain4agent/-known-gotchas.md: 0
brain4agent/memory/hot/today.md: 0
brain4agent/memory/hot/state.json: 0
brain4agent/memory-distill.txt: 0
```

`node -e "JSON.parse(...)"` trên `state.json` sau khi sửa: **OK** (JSON hợp lệ).
`wc -l brain4agent/memory-distill.txt` sau khi sửa: **99** (< 100).
Dòng mới trong `today.md` (khối "Phiên 2026-09-23 (tiếp 2) — P05"): **19 dòng** (≤ 25).

## Bảng phân công thực tế

| Gói | Tầng yêu cầu | Họ/model đã dùng | Ghi chú |
| :-- | :-- | :-- | :-- |
| 1 — `01-CONTRACTS.md` §2.3.bis/§8.1.2 (Đ48) | 🟢 | claude-sonnet-5 | Chép nguyên văn từ `reports/R23` mục "THAY ĐỔI HỢP ĐỒNG A1", giữ bản cũ để tra lịch sử |
| 2 — `SPEC-P04-Eval-Dashboard.md` §4.1/4.2 | 🟢 | claude-sonnet-5 | Đổi công thức SQL theo đúng R23; đánh dấu việc treo render `actioned` |
| 3 — `SPEC-P05-Action-Layer.md` §11 | 🟢 | claude-sonnet-5 | Chép 6 quyết định thực thi từ `reports/R22`, xác nhận DDL thật khớp (đọc `db/migrations/006_p05_action_layer.sql`) |
| 4 — `TESTING-ACCEPTANCE.md` §7 (G19–G22 + 9 gate cũ) | 🟠 | claude-sonnet-5 | Phải tự chạy lại lệnh gate thật (không chỉ chép evidence cũ) — phát hiện G03/G10 KHÔNG khớp số ghi trong gate, để ⬜ kèm lý do thay vì tick sai |
| 5 — `plan.md` §4 (P05 + P06) | 🟢 | claude-sonnet-5 | Tick `[x]` kèm link report/evidence |
| 6 — Não 6 điểm + 2 file mở rộng | 🟢/🟠 | claude-sonnet-5 | `state.json`/`memory-distill.txt` cần đo dòng/JSON hợp lệ trước khi báo xong (🟠 phần đó) |

## Việc KHÔNG làm + lý do

- **KHÔNG tick G03/G10** ở `TESTING-ACCEPTANCE.md` §7 — đo lại đúng lệnh gate ghi
  (`npm run test -- authz` ra 3/3 chứ không phải "8/8"; `npm run test -- review-state-machine`
  không khớp file test nào có thật) — không đủ căn cứ khớp số gate, để ⬜ kèm lý do thay
  vì tự tiện đổi số gate cho khớp (ngoài phạm vi, worker không viết SPEC).
- **KHÔNG tạo thư mục `evidence/h19-simbackend/`** dù `reports/R22` trỏ tới đó — thư mục
  này không tồn tại trên đĩa ở thời điểm kiểm (`find` không ra kết quả); đã ghi rõ trong
  `TESTING-ACCEPTANCE.md` §7 dòng G21 thay vì bịa đường dẫn.
- **KHÔNG tick cột `deploy`** ở bất kỳ gate nào — đúng luật §7.4/Đ48, chưa deploy.
- **KHÔNG chạm file `.ts/.tsx/.mjs/.sql/.json` nào ngoài `state.json`** — đúng CẤM.
- **KHÔNG git add/commit/push** — đúng CẤM, chờ người duyệt xong.

## Câu hỏi cần người

1. Gate `G03` (đăng nhập 2 vai, "8/8 trả 403") và `G10` (review-state-machine) trong
   `TESTING-ACCEPTANCE.md` §7 ghi lệnh/số không khớp thực tế đo được (3/3 authz; tên
   test file thật là `bql-review.test.ts`, không phải `review-state-machine`). Cần
   người xác nhận số/lệnh đúng của gate rồi sửa lại văn bản gate (việc sửa SPEC gate,
   không phải chép số, nên để nguyên chờ quyết định).

---
✅ ĐÃ HOÀN THÀNH (đo được): 13 file tài liệu cập nhật đúng phạm vi, 0 ký tự lỗi, JSON
hợp lệ, kernel < 100 dòng, khối nhật ký mới ≤ 25 dòng, `init_brain.js --check` = NÃO ĐÃ
OK ở đầu và cuối phiên, không có commit nào bị tạo.

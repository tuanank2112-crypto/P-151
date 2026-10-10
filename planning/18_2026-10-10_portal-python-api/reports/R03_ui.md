Vai · thi công · GPT-6 Codex · Bước 0 exit1 · giữ skin/shell, dashboard Python theo SPEC; không sửa engine/API/.env hoặc sharedDB.
Handoff: ../handoffs/H03_ui.md
Base: 2ced2656c66ceb6cdc44790a91f676ab1b8d710d
Head: 2ced2656c66ceb6cdc44790a91f676ab1b8d710d (working tree, chưa commit)

## Lệnh / số đo
- `npm.cmd test` exit0: 71 total/pass, 0 fail/skip; [unit-final-accepted.txt](../evidence/ui/unit-final-accepted.txt).
- `npm.cmd run typecheck` exit0; [typecheck-final.txt](../evidence/ui/typecheck-final.txt).
- `npm.cmd run lint` exit0: 0 errors, 1 warning legacy workflow.ts604; [lint-final.txt](../evidence/ui/lint-final.txt).
- `npm.cmd run build` exit0, DATABASE_URL absent; [build-final.txt](../evidence/ui/build-final.txt).
- `node .../portal_python.mjs` exit0: actual Python memory/mock + Next production, 46/46, 0 skip; 6 roles1440/390, stock delta/repeat/shortage, complete200 guard, ownership/304, no JS errors/overflow; [flows-accepted.txt](../evidence/browser/flows-accepted.txt).
- `node .../cross_app.mjs` exit0: 9/9, same string ID two directions, expired auth/offline, 0 JS errors; [cross-app.txt](../evidence/browser/cross-app.txt).
- `node .../restarts.mjs` exit0: 5/5, portal noDB login/restart session; backend restart→login/photo401; [restarts.txt](../evidence/browser/restarts.txt).
- `node .../cleaning.mjs` exit0: 4/4, onePOST empty actual usage→N_A, reopen disabled; [cleaning-accepted.txt](../evidence/browser/cleaning-accepted.txt). Earlier [cleaning.txt](../evidence/browser/cleaning.txt) exit1 caught N/A vs actual N_A contract.
- `node .../extra-actions.mjs` exit0: 6/6 block/resume/BPTNresolve/emergency-note/close/JS; [extra-actions-accepted.txt](../evidence/browser/extra-actions-accepted.txt). [extra-actions.txt](../evidence/browser/extra-actions.txt) exit1 before emergency required-note UI fix.
- `node .../mutations.mjs` exit0: 5 source mutants RED; restored hash/source then 68 unit GREEN at that stage; [mutations.txt](../evidence/ui/mutations.txt). Final unit suite 71.
- Python full suite exit0: 3441 pass, 95 PostgreSQL deselected, 0 skip; [python-tests.txt](../evidence/ui/python-tests.txt). Python source unchanged.
- `git diff --check` exit0; [diff-check-final.txt](../evidence/ui/diff-check-final.txt).
- `git diff --stat` / HEAD above: [final-diff-stat.txt](../evidence/ui/final-diff-stat.txt); tracked stat excludes new files, full listing [final-status.txt](../evidence/ui/final-status.txt). Root scope reconciled with WP1/WP2 shared files.
- CSS/shell/Python/.env diff empty: [preserved-source-diff.txt](../evidence/ui/preserved-source-diff.txt). After screenshots in evidence/browser; no running legacy browser pixel baseline.

## Phân công thực tế
| Gói | Tầng yêu cầu | Thực hiện |
|---|---|---|
| Shared dashboard/forms/tests | 🟠 | Root GPT-6 Codex |
| Auth/data/BFF integration | 🟠 | auth_data/actions_bff agents, H01/H02 |
| Independent UI/privacy/safety/deltas | 🔴 | independent_review agent, H04/R04 |
| Root measurement/mutations | 🟠 | Root GPT-6 Codex |

## Chưa làm
- Docker/PG: CLI absent; boot exit1 missing hub; phone/server not measured. No sharedSupabase writes, no commit/push/deploy.
- Resident add-info/rating and BQL rework have contract/action unit guards and Python regressions, but no dedicated root browser path evidence; no claim exhaustive browser action coverage.
- Real OpenAI calls not tested; local tests mock, original key/config unchanged.
✅ DUYỆT: implementation local theo phạm vi; không thay sign-off toàn hồ sơ hoặc gate môi trường chưa đo.

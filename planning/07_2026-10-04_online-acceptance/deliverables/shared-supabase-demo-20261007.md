# Shared Supabase demo — 2026-10-07

Verified at 2026-10-07T04:11:12.207497+00:00. Local HTTP/API server using shared project aznecwoyeravoupqbjbd; no public deployment.

- Ticket: `SIM-TKT-0042` / `DEMO-TRUONG-20261007T040318Z`. Final status CLOSED.
- State path: RECEIVED -> ROUTED -> IN_PROGRESS -> READY_FOR_REVIEW -> CLOSED.
- Missing execution photo: completion retained IN_PROGRESS; failing item execution_photo. After photo upload: READY_FOR_REVIEW.
- Two synthetic 320x180 PNG fixtures, 686 bytes each. API and private Storage bytes/hash match before and after restart.
- DB scope: cases53 ->54, only new SIM-TKT-0042; all53 preexisting case hashes unchanged, stock unchanged. Ticket ledger24 rows, notifications7 rows.
- Real model response: GPT-6 Luna SUCCESS, 2000.82ms, VE_SINH/COMMON_AREA_CLEANING; classification proposer rules+llm:gpt-6-luna. Saved recovery_ai_logs, since API AI Logs are process-memory only.
- Initial creation422 after committing RECEIVED: shared Ticket.merged_children was absent from local model. Typed compatibility fix follows CR-BPTN-03 §8/§13 and preserves links. Recovered same ticket via engine.run_agent, then continued API flow. New regressions preserve links on mutation and reject unrelated unknown fields.
- Checks: pytest2973 passed/29 PostgreSQL deselected/0 skipped, exit0; ruff check src tests exit0, changed files format exit0. No configured typechecker.
- Server remains http://127.0.0.1:8001/ui/; jobs=false, seed=false, reset=false on process. Jobs override is per-process, .env setting is unchanged.
- Limits: simulated location/photos/checklists/material usage; no physical service delivered, no resident satisfaction rating. No manual browser walkthrough or full9-case same-build matrix. Day05/06 and public deployment remain pending. PostgreSQL regression suite excluded because its fixtures wipe a test DB and must not run on the shared project.
- Startup brain check exit1: missing ../brain4agent.release hub. Managed brain rules unchanged. No commit or push.

Machine evidence: [result.json](../evidence/supabase-demo-20261007/result.json), [pytest.txt](../evidence/supabase-demo-20261007/pytest.txt), [ruff-check.txt](../evidence/supabase-demo-20261007/ruff-check.txt), [pre-fix validation](../evidence/supabase-demo-20261007/agent-recovery.json).

Scope update07/10: user removed six unused cases; normalized manifest/results/issues use day04-3 and9 active cases. See [current summary](day04-summary.md). This run remains separate from legacy UI evidence.

# Eval run eval-dev-20261015T045526Z

- Labels: dev: written by the rule authors, NOT independent (regression only)
- Commit `6435746d1343` (dirty tree), started 2026-10-15T04:55:26.830550+00:00
- Engine: fixed rules only (LLM_MODE=mock), no model, no network

## Frame 1 — safety (Bậc 1 EMERGENCY / Bậc 2 UNCLEAR / NONE)

| Metric | Value | n | Target | |
| --- | --- | --- | --- | --- |
| Bậc 1 recall (EMERGENCY gold → EMERGENCY) | 1.000 | 219 | 1.000 | ✅ |
| Bậc 1 misses (count) | 0 | 219 | 0 | ✅ |
| False alarm → Bậc 1 (NONE gold → EMERGENCY) | 0.000 | 152 | report |  |
| False alarm → any alert (NONE gold → Bậc 1 or 2) | 0.000 | 152 | report |  |
| Bậc 2 recall (UNCLEAR gold → Bậc 1 or 2) | 1.000 | 33 | report |  |
| Exact level match (single-label rows) | 0.993 | 404 | report |  |
| Accept-set rows inside their set | 1.000 | 34 | report |  |
| Labeller agreement (raw) | 1.000 | 438 | report |  |
| Labeller agreement (Cohen kappa) | 1.000 | 438 | report |  |
| Match (exact or in accept-set), group cr03_json | 0.912 | 34 | report |  |
| Match (exact or in accept-set), group p0 | 1.000 | 265 | report |  |
| Match (exact or in accept-set), group p1_catch | 1.000 | 74 | report |  |
| Match (exact or in accept-set), group p1_not_raise | 1.000 | 31 | report |  |
| Match (exact or in accept-set), group regression | 1.000 | 34 | report |  |

## Frame 2 — classification (CLN / TEC / OUT / UNCLEAR)

| Metric | Value | n | Target | |
| --- | --- | --- | --- | --- |
| Accuracy | 1.000 | 151 | report |  |
| CLN: precision | 1.000 | 43 | report |  |
| CLN: recall | 1.000 | 43 | report |  |
| CLN: F1 | 1.000 | 43 | report |  |
| TEC: precision | 1.000 | 51 | report |  |
| TEC: recall | 1.000 | 51 | report |  |
| TEC: F1 | 1.000 | 51 | report |  |
| OUT: precision | 1.000 | 40 | report |  |
| OUT: recall | 1.000 | 40 | report |  |
| OUT: F1 | 1.000 | 40 | report |  |
| UNCLEAR: precision | 1.000 | 17 | report |  |
| UNCLEAR: recall | 1.000 | 17 | report |  |
| UNCLEAR: F1 | 1.000 | 17 | report |  |
| Labeller agreement (raw) | 1.000 | 151 | report |  |
| Labeller agreement (Cohen kappa) | 1.000 | 151 | report |  |

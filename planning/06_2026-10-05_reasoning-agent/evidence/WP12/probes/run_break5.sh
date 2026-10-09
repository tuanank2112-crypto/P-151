#!/usr/bin/env bash
# TESTING §8.5 — run from the repo root. Local docker container p151-pgtest, database p151_wp12_test ONLY.
P="C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe"
OLD="C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/old82"
PR=planning/06_2026-10-05_reasoning-agent/evidence/WP12/probes
OUT=planning/06_2026-10-05_reasoning-agent/evidence/WP12/break-5.txt
export MO_TEST_DATABASE_URL=postgresql+psycopg2://p151:p151@127.0.0.1:55433/p151_wp12_test
{
  echo "\$ docker exec p151-pgtest psql -U p151 -d postgres -c 'create database p151_wp12_test'  (only if missing)"
  if docker exec p151-pgtest psql -U p151 -d postgres -Atc "select 1 from pg_database where datname='p151_wp12_test'" | grep -q 1; then
    echo "exists"
  else
    docker exec p151-pgtest psql -U p151 -d postgres -c "create database p151_wp12_test" 2>&1
  fi
  echo "\$ old worktree HEAD"; git -C "$OLD" rev-parse HEAD
  echo "\$ [NEW code HEAD] python $PR/break5_new_side.py"
  LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=. "$P" "$PR/break5_new_side.py" 2>&1
  echo "EXIT=$?"
  echo "\$ [OLD code 82f01f0] python $PR/break5_old_side.py <scratchpad>/old82"
  LLM_MODE=mock PYTHONUTF8=1 "$P" "$PR/break5_old_side.py" "$OLD" 2>&1
  echo "EXIT=$?"
  echo "\$ [OLD code 82f01f0] python $PR/break5_uvicorn_old.py <scratchpad>/old82"
  PYTHONUTF8=1 "$P" "$PR/break5_uvicorn_old.py" "$OLD" 2>&1
  echo "EXIT=$?"
} > "$OUT" 2>&1
cat "$OUT"

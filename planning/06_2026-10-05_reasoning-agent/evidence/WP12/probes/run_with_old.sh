#!/usr/bin/env bash
# Usage (from the repo root): bash .../probes/run_with_old.sh <probe.py> <evidence-name>; the probe gets the base worktree path.
P="C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe"
OLD="C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/old82"
PR=planning/06_2026-10-05_reasoning-agent/evidence/WP12/probes
OUT=planning/06_2026-10-05_reasoning-agent/evidence/WP12/$2.txt
{
  echo "\$ LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=. python $PR/$1 <scratchpad>/old82"
  LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=. "$P" "$PR/$1" "$OLD" 2>&1
  echo "EXIT=$?"
} > "$OUT" 2>&1
cat "$OUT"

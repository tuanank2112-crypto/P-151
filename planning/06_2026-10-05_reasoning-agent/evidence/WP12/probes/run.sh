#!/usr/bin/env bash
# Usage (from the repo root): bash planning/06_2026-10-05_reasoning-agent/evidence/WP12/probes/run.sh <probe.py> <evidence-name> [args...]
# Writes evidence/WP12/<evidence-name>.txt = command line + full output + "EXIT=<code>".
PROBES=planning/06_2026-10-05_reasoning-agent/evidence/WP12/probes
OUT=planning/06_2026-10-05_reasoning-agent/evidence/WP12/$2.txt
SCRIPT=$1
shift 2
{
  echo "\$ LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=. python $PROBES/$SCRIPT $*"
  LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=. "C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe" "$PROBES/$SCRIPT" "$@" 2>&1
  echo "EXIT=$?"
} > "$OUT" 2>&1
tail -25 "$OUT"

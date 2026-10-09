#!/usr/bin/env bash
# WP12 gate c: full suite. Run from the repo root of the worktree.
PY="C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe"
OUT=planning/06_2026-10-05_reasoning-agent/evidence/WP12/pytest.txt
LOG="C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/wp12_pytest_full.log"
{
  echo "HEAD=$(git rev-parse HEAD)"
  echo '$ LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=. python -m pytest -q -p no:cacheprovider'
  LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=. "C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe" -m pytest -q -p no:cacheprovider > "$LOG" 2>&1
  rc=$?
  grep -E "FAILED|ERROR|passed|failed|skipped|deselected" "$LOG" | tail -60
  echo "EXIT=$rc"
} > "$OUT" 2>&1

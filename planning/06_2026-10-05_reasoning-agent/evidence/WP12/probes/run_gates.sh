#!/usr/bin/env bash
# Re-measure the cheap Exit Gates of TESTING §7 (G4, G5, G-STUB) on this worktree. Run from the repo root.
P="C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe"
S=planning/06_2026-10-05_reasoning-agent/specs
OUT=planning/06_2026-10-05_reasoning-agent/evidence/WP12/gates.txt
{
  echo "\$ PYTHONPATH=. PYTHONUTF8=1 python $S/REF-p1-safety-meter.py   # G4"
  PYTHONPATH=. PYTHONUTF8=1 LLM_MODE=mock "$P" $S/REF-p1-safety-meter.py 2>&1 | tail -5
  echo "EXIT=${PIPESTATUS[0]}"
  echo "\$ PYTHONPATH=. PYTHONUTF8=1 python $S/REF-agent-contract.py --selftest   # G5"
  PYTHONPATH=. PYTHONUTF8=1 LLM_MODE=mock "$P" $S/REF-agent-contract.py --selftest 2>&1 | tail -3
  echo "EXIT=${PIPESTATUS[0]}"
  echo "\$ PYTHONPATH=. PYTHONUTF8=1 python $S/REF-split-verdict.py --variants   # G5"
  PYTHONPATH=. PYTHONUTF8=1 LLM_MODE=mock "$P" $S/REF-split-verdict.py --variants 2>&1 | tail -3
  echo "EXIT=${PIPESTATUS[0]}"
  echo "\$ grep -rc 'NotImplementedError(\"plan 06' src/maintenance (sum)   # G-STUB"
  grep -rc 'NotImplementedError("plan 06' src/maintenance --include=*.py | awk -F: '{s+=$2} END {print "TOTAL=" s}'
  echo "EXIT=0"
} > "$OUT" 2>&1
cat "$OUT"

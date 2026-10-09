#!/usr/bin/env bash
# Plan 11: green run + 5 mutants, each on a FRESH local memory backend :8001 (never the shared :8000).
# Usage (repo root): bash planning/11_2026-10-09_mobile-pwa-app/evidence/harness/run_all.sh <python> <scratch-dir>
# Takes ~13 min (M5/M6 wait for the real 30 s refresh). Run between 06:00 and 22:00 (department hours).
set -u
PY="$1"; SCRATCH="$2"; E=planning/11_2026-10-09_mobile-pwa-app/evidence; PORTAL="$(pwd)/portal"
mkdir -p "$SCRATCH"
serve() {
  MO_STORE=memory LLM_MODE=mock MO_PHOTO_STORE=local MO_JOBS_ENABLED=false MO_SEED_ON_EMPTY=true DATABASE_URL= PYTHONUTF8=1 \
    "$PY" -m uvicorn src.main:app --host 127.0.0.1 --port 8001 > "$SCRATCH/uv8001.log" 2>&1 &
  PID=$!
  for _ in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:8001/health && return 0; sleep 1; done
  echo "server did not start"; exit 3
}
stop() { kill "$PID" 2>/dev/null; wait "$PID" 2>/dev/null; }
serve
rm -rf "$E/screens"
node "$E/harness/mobile.mjs" http://127.0.0.1:8001 "$E/screens" "$PORTAL" > "$E/m1-m13.txt" 2>&1
echo "green exit=$?" >> "$E/m1-m13.txt"
stop
rm -rf "$E/harness-tmp"
for m in a-sw-caches-api b-no-lock c-no-refresh d-null-text e-no-dept-photo; do
  serve
  "$PY" "$E/harness/mutate.py" "$m" http://127.0.0.1:8001 "$SCRATCH/mut-screens" "$PORTAL" "$PY" > "$E/mutation-$m.txt" 2>&1
  stop
done

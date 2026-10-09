#!/usr/bin/env bash
# Plan 10: green run + 3 mutants, each on a FRESH local memory backend :8001 (never the shared :8000).
# Usage (repo root): bash planning/10_2026-10-08_list-paging/evidence/harness/run_all.sh <python> <scratch-dir>
set -u
PY="$1"; SCRATCH="$2"; E=planning/10_2026-10-08_list-paging/evidence; PORTAL="$(pwd)/portal"
serve() {
  MO_STORE=memory LLM_MODE=mock MO_PHOTO_STORE=local MO_JOBS_ENABLED=false MO_SEED_ON_EMPTY=true \
    "$PY" -m uvicorn src.main:app --host 127.0.0.1 --port 8001 > "$SCRATCH/uv8001.log" 2>&1 &
  PID=$!
  for _ in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:8001/health && return 0; sleep 1; done
  echo "server did not start"; exit 3
}
stop() { kill "$PID" 2>/dev/null; wait "$PID" 2>/dev/null; }
serve
rm -rf "$E/screens"
node "$E/harness/paging.mjs" http://127.0.0.1:8001 "$E/screens" "$PORTAL" > "$E/p1-p8.txt" 2>&1
echo "green exit=$?" >> "$E/p1-p8.txt"
stop
for m in a-no-slice b-no-follow-selected c-turn-calls-render; do
  serve
  "$PY" "$E/harness/mutate.py" "$m" http://127.0.0.1:8001 "$SCRATCH/mut-screens" "$PORTAL" > "$E/mutation-$m.txt" 2>&1
  stop
done

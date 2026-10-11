#!/usr/bin/env bash
# Plan 13: green run + 2 mutants of src/web/app.js, each on a FRESH local memory backend :8001 (never the shared :8000).
# Usage (repo root): bash planning/13_2026-10-09_bptn-reason-web/evidence/harness/run_all.sh <python> <scratch-dir>
set -u
PY="$1"; SCRATCH="$2"; E=planning/13_2026-10-09_bptn-reason-web/evidence; PORTAL="$(pwd)/portal"; APP=src/web/app.js
mkdir -p "$SCRATCH"
serve() {
  MO_STORE=memory LLM_MODE=mock MO_PHOTO_STORE=local MO_JOBS_ENABLED=false MO_SEED_ON_EMPTY=true DATABASE_URL= PYTHONUTF8=1 \
    "$PY" -m uvicorn src.main:app --host 127.0.0.1 --port 8001 > "$SCRATCH/uv8001.log" 2>&1 &
  PID=$!
  for _ in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:8001/health && return 0; sleep 1; done
  echo "server did not start"; exit 3
}
stop() { kill "$PID" 2>/dev/null; wait "$PID" 2>/dev/null; }
run() {  # $1 = output file
  serve
  node "$E/harness/web_bptn.mjs" http://127.0.0.1:8001 "$PORTAL" > "$1" 2>&1
  echo "exit=$?" >> "$1"
  stop
}

run "$E/green.txt"

BEFORE=$(sha256sum "$APP" | cut -d' ' -f1)
cp "$APP" "$SCRATCH/app.js.orig"
# mutant a: drop the bptn-resolve reason guard (the bug before plan 13)
sed -i '/VALUE_KEYS.some((key) => key in sent) && !sent.note/d' "$APP"
run "$E/mutation-a-no-value-guard.txt"
cp "$SCRATCH/app.js.orig" "$APP"
# mutant b: confirm-safe reason optional again (no `required`, no blank check)
sed -i "s/note('Lý do xác nhận an toàn', { required: true })/note('Lý do xác nhận an toàn')/; s/'Đã xác nhận an toàn, chuyển tiếp xử lý', true)/'Đã xác nhận an toàn, chuyển tiếp xử lý', false)/" "$APP"
run "$E/mutation-b-confirm-safe-optional.txt"
cp "$SCRATCH/app.js.orig" "$APP"
AFTER=$(sha256sum "$APP" | cut -d' ' -f1)
echo "app.js restored byte for byte: $([ "$BEFORE" = "$AFTER" ] && echo yes || echo NO) ($AFTER)" | tee "$E/restore.txt"

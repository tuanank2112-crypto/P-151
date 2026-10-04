#!/usr/bin/env bash
# Day04 driver: fresh uvicorn (memory store) on 127.0.0.1:8184 per case, harness over HTTP, stop own process.
WT="C:/Users/caotr/AppData/Local/Temp/claude/c--P-151-truong/8cfb418c-be27-4e85-ad86-f18b4937791f/scratchpad/dev3"
D="$(cd "$(dirname "$0")" && pwd)"; CASE="$1"
cd "$WT" || exit 9
MO_STORE=memory LLM_MODE=mock MO_PHOTO_STORE=local APP_ENV=development MO_ALLOW_RESET=false MO_JOBS_ENABLED=false DISABLE_SQLALCHEMY_CEXT_RUNTIME=1 PYTHONUTF8=1 PYTHONPATH="$WT" \
  python -m uvicorn src.main:app --host 127.0.0.1 --port 8184 >"$D/$CASE-server.txt" 2>&1 &
PID=$!
for i in $(seq 1 60); do curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8184/health 2>/dev/null | grep -q 200 && break; sleep 1; done
PYTHONUTF8=1 python "$D/harness.py" "$CASE"
RC=$?
kill $PID 2>/dev/null; sleep 1; taskkill //F //PID $PID >/dev/null 2>&1
echo "$(date --iso-8601=seconds) case=$CASE harness_exit=$RC server_pid=$PID" >> "$D/driver-log.txt"
exit $RC

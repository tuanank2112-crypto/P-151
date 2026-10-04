#!/usr/bin/env bash
# Day04: UI-SMOKE (curl GET /ui) + PERSIST-RESTART (ingest, stop server, restart, re-read). Memory store => data loss expected.
WT="C:/Users/caotr/AppData/Local/Temp/claude/c--P-151-truong/8cfb418c-be27-4e85-ad86-f18b4937791f/scratchpad/dev3"
D="$(cd "$(dirname "$0")" && pwd)"; O="$D/persist-ui.txt"; : > "$O"; : > "$D/persist-server.txt"
start(){ cd "$WT"; MO_STORE=memory LLM_MODE=mock MO_PHOTO_STORE=local APP_ENV=development MO_ALLOW_RESET=false MO_JOBS_ENABLED=false DISABLE_SQLALCHEMY_CEXT_RUNTIME=1 PYTHONUTF8=1 PYTHONPATH="$WT" python -m uvicorn src.main:app --host 127.0.0.1 --port 8184 >>"$D/persist-server.txt" 2>&1 & PID=$!
  for i in $(seq 1 60); do curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8184/health 2>/dev/null | grep -q 200 && break; sleep 1; done; }
stop(){ kill $PID 2>/dev/null; sleep 1; taskkill //F //PID $PID >/dev/null 2>&1; sleep 1; }
A=http://127.0.0.1:8184/api/v1
tok(){ PW=$(curl -s $A/auth/demo-accounts | python -c "import sys,json;print(json.load(sys.stdin)['shared_test_password'])"); curl -s -X POST $A/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"$PW\"}" | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])"; }
start
echo "## $(date --iso-8601=seconds) server#1 up" >> "$O"
echo "## $(date --iso-8601=seconds) curl GET /ui (no follow) -> $(curl -s -o /dev/null -w '%{http_code} redirect=%{redirect_url}' http://127.0.0.1:8184/ui)" >> "$O"
echo "## $(date --iso-8601=seconds) curl -L GET /ui -> $(curl -sL -o "$D/ui-body.html" -w '%{http_code} content-type=%{content_type} bytes=%{size_download} final=%{url_effective}' http://127.0.0.1:8184/ui)" >> "$O"
T=$(tok cudan01)
R=$(curl -s -X POST $A/resident/tickets -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"original_description":"Den hanh lang tang 3 toa SIM-A khong sang.","channel":"form","simulated_received_at":"2026-10-04T10:00:00+07:00"}')
TID=$(echo "$R" | PYTHONUTF8=1 python -c "import sys,json;d=json.load(sys.stdin);print(d.get('ticket_id') or d.get('id'))")
Q=$(tok qa01)
echo "## $(date --iso-8601=seconds) ingest -> ticket_id=$TID; QA GET before restart -> $(curl -s -o /dev/null -w '%{http_code}' $A/mo/tickets/$TID -H "Authorization: Bearer $Q")" >> "$O"
stop
echo "## $(date --iso-8601=seconds) server#1 stopped; LISTEN count 8184 = $(netstat -ano | grep -c ':8184.*LISTEN')" >> "$O"
start
echo "## $(date --iso-8601=seconds) server#2 up (same command, same MO_STORE=memory)" >> "$O"
Q=$(tok qa01)
echo "## $(date --iso-8601=seconds) QA GET $TID after restart -> $(curl -s -o "$D/persist-after.json" -w '%{http_code}' $A/mo/tickets/$TID -H "Authorization: Bearer $Q")" >> "$O"
stop
echo "## $(date --iso-8601=seconds) server#2 stopped; LISTEN count 8184 = $(netstat -ano | grep -c ':8184.*LISTEN')" >> "$O"

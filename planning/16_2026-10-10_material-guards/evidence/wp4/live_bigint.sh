#!/bin/sh
# WP4: the 10**400 JSON integer against the real uvicorn memory server (no write happens: it fails before the engine).
B=$1
TOKEN=$(curl -s -X POST "$B/api/v1/auth/login" -H 'Content-Type: application/json' -d '{"username":"kythuat01","password":"Demo@2026"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
BIG=1$(python -c "print('0'*400)")
for path in material-usage material-plan "materials/SIM-MAT-LAMP-01"; do
  case $path in
    material-usage) body="{\"lines\":[{\"item_code\":\"SIM-MAT-LAMP-01\",\"used_qty\":$BIG}]}";;
    material-plan) body="{\"lines\":[{\"item_code\":\"SIM-MAT-LAMP-01\",\"planned_qty\":$BIG}]}";;
    *) body="{\"issued_qty\":$BIG,\"used_qty\":1}";;
  esac
  code=$(curl -s -o /tmp/wp4_body.txt -w '%{http_code}' -X POST "$B/api/v1/mo/tickets/SIM-TKT-0001/$path" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$body")
  echo "POST $path used/planned/issued=10**400 -> HTTP $code body=$(head -c 120 /tmp/wp4_body.txt)"
done

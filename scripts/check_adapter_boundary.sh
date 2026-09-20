#!/usr/bin/env bash
# scripts/check_adapter_boundary.sh — BB-07: mọi lối ra ngoài đi qua
# lib/adapters/**. In "violations: N"; exit 0 khi N=0, exit 1 khi N>0.
set -uo pipefail

violations=0

count_matches() {
  local out="$1"
  if [ -z "$out" ]; then
    echo 0
  else
    echo "$out" | grep -c .
  fi
}

anthropic_out=$(grep -rn "@anthropic-ai/sdk" app/ lib/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "^lib/adapters/" || true)
if [ -n "$anthropic_out" ]; then
  echo "--- import @anthropic-ai/sdk ngoài lib/adapters/ ---"
  echo "$anthropic_out"
fi
violations=$((violations + $(count_matches "$anthropic_out")))

pg_out=$(grep -rn "@neondatabase/serverless" app/ lib/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "^lib/adapters/" || true)
if [ -n "$pg_out" ]; then
  echo "--- import @neondatabase/serverless ngoài lib/adapters/ ---"
  echo "$pg_out"
fi
violations=$((violations + $(count_matches "$pg_out")))

fetch_out=$(grep -rnE "fetch\(['\"]https?://" app/ lib/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "^lib/adapters/" || true)
if [ -n "$fetch_out" ]; then
  echo "--- fetch() tới host ngoài, ngoài lib/adapters/ ---"
  echo "$fetch_out"
fi
violations=$((violations + $(count_matches "$fetch_out")))

echo "violations: $violations"
if [ "$violations" -ne 0 ]; then
  exit 1
fi
exit 0

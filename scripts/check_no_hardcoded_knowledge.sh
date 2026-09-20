#!/usr/bin/env bash
# scripts/check_no_hardcoded_knowledge.sh — BB-10: Knowledge Pack là dữ liệu
# có phiên bản, không phải hằng số trong code. In "matches: N"; exit 0 khi
# N=0. Chỉ soi app/ và lib/ — `scripts/seed_knowledge.mjs` đọc `knowledge/`
# lúc chạy nên KHÔNG tính (đó là cách nạp dữ liệu đúng, không phải hardcode).
set -uo pipefail

out=$(grep -rn "OCP1-" app/ lib/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)
matches=0
if [ -n "$out" ]; then
  echo "$out"
  matches=$(echo "$out" | grep -c .)
fi
echo "matches: $matches"
if [ "$matches" -ne 0 ]; then
  exit 1
fi
exit 0

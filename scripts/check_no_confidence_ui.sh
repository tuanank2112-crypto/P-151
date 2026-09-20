#!/usr/bin/env bash
# scripts/check_no_confidence_ui.sh — BB-05: confidence không bao giờ ra màn
# hình. In "matches: N"; exit 0 khi N=0. Chỉ soi `.tsx` trong app/ (nơi JSX
# hiển thị thật sự nằm) — định nghĩa kiểu `Omit<TurnResult, "confidence">`
# sống trong lib/types.ts (`.ts`), không bị quét ở đây (xem VC-07).
set -uo pipefail

out=$(grep -rniE "confidence|độ tin cậy" app/ --include="*.tsx" 2>/dev/null || true)
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

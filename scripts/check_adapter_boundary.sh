#!/usr/bin/env bash
# scripts/check_adapter_boundary.sh — BB-07: mọi lối ra ngoài đi qua lib/adapters/**.
# In "violations: N"; exit 0 khi N=0, exit 1 khi N>0.
#
# LỊCH SỬ 2026-09-20 — bản trước XANH GIẢ, đã chứng minh:
#   Bản cũ chỉ bắt tên gói và fetch("https://...") dạng CHUỖI NGUYÊN VĂN. Một file
#   ngoài adapter gán host vào biến rồi `fetch(`${HOST}/...`)` và đọc thẳng
#   process.env.GEMINI_API_KEY vẫn cho violations: 0, EXIT=0. Nghĩa là bất biến
#   BB-07 hoàn toàn không được canh. Bản này bắt theo BỐN trục, trục nào cũng đủ
#   để một mình chặn kiểu rò đó.
set -uo pipefail

SCOPE=(app lib)
INCL=(--include=*.ts --include=*.tsx)
ADAPTER_RE='^lib/adapters/'

violations=0

# $1 = nhãn, $2 = regex (ERE), $3 = regex loại trừ thêm (rỗng nếu không có)
probe() {
  local label="$1" pattern="$2" extra_exclude="${3:-}"
  local out
  out=$(grep -rnE "$pattern" "${SCOPE[@]}" "${INCL[@]}" 2>/dev/null | grep -v "$ADAPTER_RE" || true)
  if [ -n "$out" ] && [ -n "$extra_exclude" ]; then
    out=$(echo "$out" | grep -vE "$extra_exclude" || true)
  fi
  if [ -n "$out" ]; then
    echo "--- $label ---"
    echo "$out"
    violations=$((violations + $(echo "$out" | grep -c .)))
  fi
}

# 1) Import SDK của nhà cung cấp ngoài adapter.
probe "import SDK nha cung cap ngoai lib/adapters/" \
  "@anthropic-ai/sdk|@google/(generative-ai|genai)|@neondatabase/serverless|(from|require\()[\"'](pg|postgres)[\"']"

# 2) Host của nhà cung cấp xuất hiện ngoài adapter, DÙ ở chuỗi rời hay template.
probe "host nha cung cap ngoai lib/adapters/" \
  "generativelanguage\.googleapis\.com|api\.anthropic\.com|[a-z0-9-]+\.neon\.tech|openrouter\.ai|api\.tokenrouter\.io"

# 3) Đọc bí mật ngoài adapter. Đây là trục bản cũ bỏ sót hoàn toàn.
probe "doc bi mat ngoai lib/adapters/" \
  "process\.env\.(GEMINI_API_KEY|GOOGLE_API_KEY|ANTHROPIC_API_KEY|DATABASE_URL)"

# 4) fetch() tới URL tuyệt đối ngoài adapter — cả chuỗi nguyên văn lẫn template.
#    Loại trừ dòng chú thích thuần để khỏi báo nhầm tài liệu.
probe "fetch toi URL tuyet doi ngoai lib/adapters/" \
  "fetch\(\s*[\`\"'](https?:)?//|fetch\(\s*\`\\\$\{" \
  "^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)"

echo "violations: $violations"
[ "$violations" -eq 0 ] || exit 1
exit 0

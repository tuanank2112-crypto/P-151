#!/usr/bin/env bash
# scripts/check_brain_in_commit.sh — pre-commit: MỖI COMMIT = MỘT LẦN CẬP NHẬT NÃO
# (AGENTS.md §5.D.4, chủ tịch chốt 2026-09-23). Commit có đổi file NGOÀI
# brain4agent/ thì BẮT BUỘC kèm ít nhất một file trong brain4agent/memory/hot/
# (today.md hoặc state.json) mô tả trạng thái SAU commit. Commit chỉ đụng não
# thì cho qua. Mã thoát: 0 cho qua · 1 chặn.
staged=$(git diff --cached --name-only --diff-filter=ACMRD)
[ -z "$staged" ] && exit 0
outside=$(printf '%s\n' "$staged" | grep -v '^brain4agent/' || true)
hot=$(printf '%s\n' "$staged" | grep '^brain4agent/memory/hot/' || true)
if [ -n "$outside" ] && [ -z "$hot" ]; then
  echo "[brain] CHẶN COMMIT: có thay đổi ngoài brain4agent/ nhưng KHÔNG cập nhật brain4agent/memory/hot/ (today.md / state.json)." >&2
  echo "[brain] Luật AGENTS.md §5.D.4 — mỗi commit = một lần cập nhật não. Cập nhật não rồi commit lại." >&2
  exit 1
fi
exit 0

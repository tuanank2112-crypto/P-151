#!/usr/bin/env bash
# scripts/setup_brain_hook.sh — cài hook pre-commit kiểm luật "mỗi commit = một lần
# cập nhật não" (AGENTS.md §5.D.4). Chạy một lần sau khi clone. Không đụng hook
# pre-push AI-log của BTC (scripts/setup_hooks.sh).
set -e
HOOK=".git/hooks/pre-commit"
cat > "$HOOK" <<'H'
#!/usr/bin/env bash
bash scripts/check_brain_in_commit.sh
H
chmod +x "$HOOK"
echo "[brain] Git pre-commit hook installed."

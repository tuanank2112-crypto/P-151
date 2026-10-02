#!/usr/bin/env bash
# Cross-platform Python launcher for AI log hooks.
# Robust against Windows App Execution Aliases (WindowsApps dummy python.exe)
set -u

check_py() {
  "$@" -c "import sys; sys.exit(0)" >/dev/null 2>&1
}

PY=""
if check_py py -3; then
  PY="py -3"
elif check_py python3; then
  PY=python3
elif check_py python; then
  PY=python
else
  # PATH lookup failed or hit WindowsApp dummy — probe standard install paths
  shopt -s nullglob 2>/dev/null || true
  for cand in \
    "/c/Users/LENOVO/AppData/Local/Programs/Python/Python311/python.exe" \
    /c/Users/*/AppData/Local/Programs/Python/Python*/python.exe \
    "/c/Program Files/Python"*/python.exe \
    "/c/Program Files (x86)/Python"*/python.exe \
    /c/Python*/python.exe; do
    if check_py "$cand"; then
      PY="$cand"
      break
    fi
  done
  shopt -u nullglob 2>/dev/null || true
  [ -n "$PY" ] || exit 0
fi

# shellcheck disable=SC2086
exec $PY "$@"

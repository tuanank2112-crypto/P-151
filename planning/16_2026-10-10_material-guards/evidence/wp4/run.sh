#!/bin/sh
# WP4: run one command from the repo root, write "$ cmd", its stdout+stderr and "exit=N" to evidence/wp4/<name>.txt.
# Usage: sh run.sh <name> <command...>
name=$1; shift
out="planning/16_2026-10-10_material-guards/evidence/wp4/$name.txt"
{ echo "captured_at=$(date -Iseconds)"; echo "\$ $*"; } > "$out"
"$@" >> "$out" 2>&1
code=$?
echo "exit=$code" >> "$out"
tail -3 "$out"

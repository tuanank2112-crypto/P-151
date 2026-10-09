"""Plan 10 TESTING §2: apply one mutant to src/web/app.js, run the paging harness on a fresh server, restore byte for byte."""
import pathlib, shutil, subprocess, sys

sys.stdout.reconfigure(encoding="utf-8")
MUTANTS = {
    "a-no-slice": ("    list.replaceChildren(...items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));",
                   "    list.replaceChildren(...items);"),
    "b-no-follow-selected": ("  let page = clampPage(selectedAt >= 0 ? pageOfIndex(selectedAt) : state.pages[key] || 1, total);",
                             "  let page = clampPage(state.pages[key] || 1, total);"),
    # signOut / BQL-filter resets are EQUIVALENT mutants (every screen auto-selects its first ticket and the list follows
    # the selection, so page 1 comes back anyway — plan.md Q07); the third mutant breaks "turning a page calls no API"
    "c-turn-calls-render": ("    show(page + step);\r\n", "    show(page + step);\r\n    render();\r\n"),
}
name, base, out, portal = sys.argv[1:5]
old, new = MUTANTS[name]
p = pathlib.Path("src/web/app.js"); original = p.read_bytes(); src = original.decode("utf-8")
assert src.count(old) == 1, f"{name}: anchor not found once"
try:
    p.write_bytes(src.replace(old, new).encode("utf-8"))
    r = subprocess.run([shutil.which("node"), "planning/10_2026-10-08_list-paging/evidence/harness/paging.mjs", base, out, portal],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    print(f"mutant {name}: harness exit={r.returncode}")
    print("\n".join(l for l in r.stdout.splitlines() if l.startswith(("PASS", "FAIL", "RESULT"))))
    if r.returncode and "RESULT:" not in r.stdout:  # the harness stopped early: show why
        print("harness stopped early:", "\n".join(r.stderr.strip().splitlines()[:8]))
finally:
    p.write_bytes(original)
assert p.read_bytes() == original

"""Plan 11 TESTING §3: apply one mutant to src/mobile/, run the phone harness on a fresh server, restore byte for byte."""

import pathlib
import shutil
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")
HARNESS = "planning/11_2026-10-09_mobile-pwa-app/evidence/harness/mobile.mjs"
MUTANTS = {
    # I-3 broken: the service worker answers /api/ from a cache it fills itself
    "a-sw-caches-api": (
        "src/mobile/sw.js",
        [
            ("  if (url.pathname.startsWith('/api/')) return; // straight to the network, never from cache\n", ""),
            (
                "  event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));\n",
                "  event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((r) => {\n"
                "    const copy = r.clone(); caches.open(SHELL_CACHE).then((c) => c.put(request, copy)); return r; })));\n",
            ),
        ],
    ),
    # I-5 broken: a write button no longer locks on the first tap
    "b-no-lock": (
        "src/mobile/js/ui.js",
        [
            ("  if (button.dataset.busy) return undefined;\n", ""),
            ("  button.dataset.busy = '1';\n  button.disabled = true;\n", "  button.dataset.busy = '1';\n"),
        ],
    ),
    # G-3 broken: no periodic refresh (focus/online reloads stay)
    "c-no-refresh": ("src/mobile/js/main.js", [("export const REFRESH_MS = 30000;", "export const REFRESH_MS = 3600000;")]),
    # the bug the first screenshots showed: DOM replaceChildren() prints a null child as the text "null"
    "d-null-text": ("src/mobile/js/main.js", [("  fill(bar,\n", "  bar.replaceChildren(\n")]),
    # SPEC-P05 §7: the department "Tải ảnh lên" button no longer sends the photos
    "e-no-dept-photo": (
        "src/mobile/js/dept.js",
        [
            (
                "await run(() => apiForm(`/mo/tickets/${encodeURIComponent(id)}/photos`, photoFormData(picker.blobs())), 'Đã tải ảnh lên');",
                "await run(async () => null, 'Đã tải ảnh lên');",
            )
        ],
    ),
}

name, base, out, portal, python = sys.argv[1:6]
python = str(pathlib.Path(python).resolve())  # Windows CreateProcess does not resolve a relative ".venv/Scripts/…"
target, edits = MUTANTS[name]
p = pathlib.Path(target)
original = p.read_bytes()
text = original.decode("utf-8")
newline = "\r\n" if "\r\n" in text else "\n"
for old, new in edits:
    old, new = old.replace("\n", newline), new.replace("\n", newline)
    assert text.count(old) == 1, f"{name}: anchor not found exactly once: {old!r}"
    text = text.replace(old, new)
try:
    p.write_bytes(text.encode("utf-8"))
    if name.startswith("a-"):
        t = subprocess.run(
            [python, "-m", "pytest", "-q", "-p", "no:cacheprovider", "tests/test_maintenance/test_mobile_static.py"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
        print(f"mutant {name}: pytest test_mobile_static exit={t.returncode}")
        print("\n".join(line for line in t.stdout.splitlines() if "passed" in line or "failed" in line or "FAILED" in line))
    r = subprocess.run(
        [shutil.which("node"), HARNESS, base, out, portal], capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    print(f"mutant {name}: harness exit={r.returncode}")
    print("\n".join(line for line in r.stdout.splitlines() if line.startswith(("PASS", "FAIL", "RESULT"))))
    if r.returncode and "RESULT:" not in r.stdout:  # the harness stopped early: show why
        print("harness stopped early:", "\n".join(r.stderr.strip().splitlines()[:8]))
finally:
    p.write_bytes(original)
assert p.read_bytes() == original
print(f"restored {target} byte for byte")

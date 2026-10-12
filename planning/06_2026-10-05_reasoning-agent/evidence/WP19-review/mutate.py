"""H19 (f): reviewer's own mutations (not m1-m7), applied one at a time to a COPY of the working tree.

usage: python mutate.py <sandbox_repo> <evidence_dir> <id>[,<id>...] [--full]
For each mutation: sha256 before -> apply (anchor must occur exactly once) -> pytest -> restore -> sha256 after == before.
"""

import hashlib
import subprocess
import sys
from pathlib import Path

ROOT = Path(sys.argv[1])
OUT = Path(sys.argv[2])
WANT = sys.argv[3].split(",")
FULL = "--full" in sys.argv
ONLY = [a[7:] for a in sys.argv if a.startswith("--only=")]
PY = r"D:\P151\.venv\Scripts\python.exe"
FOCUS = [
    "tests/test_maintenance/test_p10_catalog_not_quote.py",
    "tests/test_maintenance/test_agent_unit.py",
    "tests/test_maintenance/test_p1_audit_fixes_safety.py",
    "tests/test_maintenance/test_safety.py",
    "tests/test_maintenance/test_agent_engine.py",
    "tests/test_maintenance/test_agent_parity.py",
    "tests/test_maintenance/test_p1_contracts.py",
    "tests/test_maintenance/test_agent_prompt.py",
]

VALIDATE = "src/maintenance/agent/validate.py"
SAFETY = "src/maintenance/safety.py"
BASELINE = "src/maintenance/agent/baseline.py"
SCHEMA = "src/maintenance/agent/schema.py"
AGENT = "src/maintenance/agent/agent.py"
SCRATCH_TEST = "tests/test_maintenance/test_zz_h19_exact.py"

MUTATIONS = {
    "X1": (
        "fuzzy location gate (difflib ratio < 0.6) inside validate()",
        VALIDATE,
        "    rejected += location_rejected\n",
        "    import difflib\n"
        "    if decision.location.quote and difflib.SequenceMatcher(\n"
        "        None, decision.location.quote.casefold(), data.location_text.casefold()\n"
        "    ).ratio() < 0.6:\n"
        '        agent_location, missing, location_rejected = None, ("building", "floor", "area"), ["location"]\n'
        "    rejected += location_rejected\n",
    ),
    "X2": (
        "job gate by word overlap (no shared word with the report => job dropped)",
        VALIDATE,
        "        valid.append(index)\n",
        "        if job.quote and not set(job.quote.casefold().split()) & set(data.report_text.casefold().split()):\n"
        '            rejected.append(f"jobs[{index}]")\n'
        "            continue\n"
        "        valid.append(index)\n",
    ),
    "X3": (
        "merge_llm drops (not downgrades) a signal whose normalised quote is not in the text",
        SAFETY,
        "        best_rule = max((SEVERITY[s.status] for s in signals if s.signal_id == sid), default=-1)\n",
        "        if quote and normalize_with_map(quote)[0] not in normalize_with_map(text)[0]:\n"
        '            notes.append(f"{sid}: quote not in text; dropped")\n'
        "            continue\n"
        "        best_rule = max((SEVERITY[s.status] for s in signals if s.signal_id == sid), default=-1)\n",
    ),
    "X4": (
        "location quote gate moved to another file (agent.py _validate_node, casefold substring)",
        AGENT,
        "    def _validate_node(self, state: AgentState) -> dict[str, Any]:\n"
        "        return {\n"
        '            "validated": validate(\n'
        '                state["decision"], state["data"], state["rules"], self.catalog, self.lexicon, self.model_label\n'
        "            )\n"
        "        }\n",
        "    def _validate_node(self, state: AgentState) -> dict[str, Any]:\n"
        "        import dataclasses\n"
        "        v = validate(\n"
        '            state["decision"], state["data"], state["rules"], self.catalog, self.lexicon, self.model_label\n'
        "        )\n"
        '        q = state["decision"].location.quote\n'
        '        if q and q.casefold() not in state["data"].location_text.casefold():\n'
        "            v = dataclasses.replace(\n"
        '                v, location=None, missing_parts=("building", "floor", "area"), rejected=(*v.rejected, "location")\n'
        "            )\n"
        '        return {"validated": v}\n',
    ),
    "X5": (
        "Mirror fabricates the LOCATION quote only (location_text), jobs stay None",
        BASELINE,
        'building=building, floor=floor, area=area, quote=None, reason="Vị trí theo luật cố định"',
        'building=building, floor=floor, area=area, quote=data.location_text.strip()[:300] or None, reason="Vị trí theo luật cố định"',
    ),
    "X6": (
        "Vùng cấm row 1: substring check kept as an audit WARNING note only (no level change)",
        SAFETY,
        "        best_rule = max((SEVERITY[s.status] for s in signals if s.signal_id == sid), default=-1)\n",
        "        if quote and normalize_with_map(quote)[0] not in normalize_with_map(text)[0]:\n"
        '            notes.append(f"{sid}: CẢNH BÁO trích dẫn không nguyên văn")\n'
        "        best_rule = max((SEVERITY[s.status] for s in signals if s.signal_id == sid), default=-1)\n",
    ),
    "X7": (
        "schema: blank quote no longer becomes None and quote needs >= 2 chars",
        SCHEMA,
        "        return value.strip()[:300] or None\n",
        "        return value.strip()[:300]\n",
    ),
    "X8": (
        "merge_llm always rule_id='LLM' (marker LLM-NOQUOTE lost)",
        SAFETY,
        'rule_id="LLM" if quote else "LLM-NOQUOTE",',
        'rule_id="LLM",',
    ),
    "X9": (
        "an invented location quote rejects the first job instead of the location (non-location path)",
        VALIDATE,
        "    rejected += location_rejected\n",
        "    rejected += location_rejected\n"
        "    if decision.location.quote and decision.location.quote not in data.location_text:\n"
        '        rejected.append("jobs[0]")\n',
    ),
    "X1b": (
        "location gate: a quote sharing NO word (punctuation removed) with location_text voids the location",
        VALIDATE,
        "    rejected += location_rejected\n",
        "    _q = decision.location.quote\n"
        '    _w = lambda s: set(re.findall(r"\\w+", s.casefold()))  # noqa: E731\n'
        "    if _q and _w(_q) and not (_w(_q) & _w(data.location_text)):\n"
        '        agent_location, missing, location_rejected = None, ("building", "floor", "area"), ["location"]\n'
        "    rejected += location_rejected\n",
    ),
    "X2b": (
        "job gate: a quote sharing NO word (punctuation removed) with report_text drops the job",
        VALIDATE,
        "        valid.append(index)\n",
        '        _w = lambda s: set(re.findall(r"\\w+", s.casefold()))  # noqa: E731\n'
        "        if job.quote and _w(job.quote) and not (_w(job.quote) & _w(data.report_text)):\n"
        '            rejected.append(f"jobs[{index}]")\n'
        "            continue\n"
        "        valid.append(index)\n",
    ),
    "X3b": (
        "merge_llm: a quote sharing NO word (punctuation removed) with the text is UNCLEAR",
        SAFETY,
        "        best_rule = max((SEVERITY[s.status] for s in signals if s.signal_id == sid), default=-1)\n",
        '        _w = lambda s: set(re.findall(r"\\w+", s.casefold()))  # noqa: E731\n'
        "        if quote and not (_w(quote) & _w(text)):\n"
        "            status = SignalStatus.UNCLEAR\n"
        "        best_rule = max((SEVERITY[s.status] for s in signals if s.signal_id == sid), default=-1)\n",
    ),
    # SPEC-P10 §9.3 m1-m7 (worker's acceptance list, re-run by the reviewer)
    "m1": (
        "SPEC m1: location quote not in location_text => location voided",
        VALIDATE,
        "    rejected += location_rejected\n",
        "    rejected += location_rejected\n"
        "    if decision.location.quote and decision.location.quote not in data.location_text:\n"
        '        agent_location, missing = None, ("building", "floor", "area")\n'
        '        rejected.append("location")\n',
    ),
    "m2": (
        "SPEC m2: job quote not in report_text => job dropped",
        VALIDATE,
        "        valid.append(index)\n",
        "        if job.quote and job.quote not in data.report_text:\n"
        '            rejected.append(f"jobs[{index}]")\n'
        "            continue\n"
        "        valid.append(index)\n",
    ),
    "m3": (
        "SPEC m3: merge_llm quote not in text => UNCLEAR",
        SAFETY,
        "        best_rule = max((SEVERITY[s.status] for s in signals if s.signal_id == sid), default=-1)\n",
        "        if quote and quote not in text:\n"
        "            status = SignalStatus.UNCLEAR\n"
        "        best_rule = max((SEVERITY[s.status] for s in signals if s.signal_id == sid), default=-1)\n",
    ),
    "m4": (
        "SPEC m4: merge_llm no quote => skipped",
        SAFETY,
        "        best_rule = max((SEVERITY[s.status] for s in signals if s.signal_id == sid), default=-1)\n",
        "        if not quote:\n"
        "            continue\n"
        "        best_rule = max((SEVERITY[s.status] for s in signals if s.signal_id == sid), default=-1)\n",
    ),
    "m5": (
        "SPEC m5: Mirror job quote = report_text",
        BASELINE,
        "        quote=None,\n",
        "        quote=data.report_text.strip()[:300],\n",
    ),
    "m6": (
        "SPEC m6: JobDecision.quote required, min_length 2",
        SCHEMA,
        "    quote: AuditQuote = None\n    reason: Annotated[str, StringConstraints(min_length=1, max_length=400)]\n",
        "    quote: Annotated[str, StringConstraints(min_length=2, max_length=300)]\n"
        "    reason: Annotated[str, StringConstraints(min_length=1, max_length=400)]\n",
    ),
    "m7": (
        "SPEC m7: engine note expression back to the old one",
        "src/maintenance/engine.py",
        '            f"{j.category} ({j.quote})" if j.quote else j.category for j in jobs\n',
        '            f"{j.category} ({j.quote})" for j in jobs\n',
    ),
}
# X7 also needs the min_length back on the inner str
EXTRA = {
    "X7": (
        SCHEMA,
        "AuditQuote = Annotated[Annotated[str, StringConstraints(max_length=300)] | None, BeforeValidator(_audit_quote)]",
        "AuditQuote = Annotated[Annotated[str, StringConstraints(min_length=2, max_length=300)] | None, BeforeValidator(_audit_quote)]",
    )
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(extra_tests=()):
    cmd = [PY, "-m", "pytest", "-q", "-p", "no:cacheprovider", "-rf", *(ONLY or (["tests"] if FULL else FOCUS)), *extra_tests]
    env = {
        **__import__("os").environ,
        "LLM_MODE": "mock",
        "MO_STORE": "memory",
        "MO_PHOTO_STORE": "local",
        "PYTHONUTF8": "1",
        "PYTHONPATH": ".",
    }
    proc = subprocess.run(cmd, cwd=ROOT, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
    lines = proc.stdout.splitlines()
    failed = [line for line in lines if line.startswith("FAILED") or line.startswith("ERROR")]
    summary = [line for line in lines if " passed" in line or " failed" in line or " error" in line][-1:]
    return proc.returncode, failed, summary, " ".join(cmd[1:])


for mid in WANT:
    label, rel, anchor, new = MUTATIONS[mid]
    edits = [(rel, anchor, new)] + ([EXTRA[mid]] if mid in EXTRA else [])
    files = {ROOT / r for r, _, _ in edits}
    before = {f: sha(f) for f in files}
    pristine = {f: f.read_bytes() for f in files}
    report = [f"# mutation {mid}: {label}", f"# sandbox copy: {ROOT}"]
    for f in files:
        report.append(f"sha256 before {f.relative_to(ROOT)} = {before[f]}")
    try:
        for r, a, n in edits:
            path = ROOT / r
            text = path.read_text(encoding="utf-8")
            count = text.count(a)
            assert count == 1, f"{mid}: anchor found {count} times in {r}"
            path.write_text(text.replace(a, n), encoding="utf-8", newline="")
            report.append(f"applied in {r}: anchor x1")
        extra = []
        if mid == "X9":
            (ROOT / SCRATCH_TEST).write_text(
                "from src.maintenance.agent.client import ClientReply\n"
                "from tests.test_maintenance.helpers import MONDAY_9AM, RESIDENT, Clock, agent_engine, decision\n\n\n"
                "def test_exact_rejected_variant():\n"
                "    def invented(system, user, data):\n"
                '        return ClientReply(text=decision(**{"location.building": "S2", "location.floor": "7",'
                ' "location.quote": ".."}), latency_ms=0.0)\n\n'
                "    engine = agent_engine(Clock(MONDAY_9AM), invented)\n"
                '    case = engine.receive("Hành lang nhiều rác, đèn cũng không sáng", resident_id=RESIDENT)\n'
                '    assert case.agent_decision.rejected == ["jobs[1].asset_id"]\n',
                encoding="utf-8",
            )
            extra = [SCRATCH_TEST]
        code, failed, summary, cmd = run(extra)
        report.append(f"$ (cwd=sandbox) {cmd}")
        report += failed
        report += summary
        report.append(f"EXIT={code}")
    finally:
        for f, data in pristine.items():
            f.write_bytes(data)
        if (ROOT / SCRATCH_TEST).exists():
            (ROOT / SCRATCH_TEST).unlink()
        for f in files:
            after = sha(f)
            report.append(f"sha256 after  {f.relative_to(ROOT)} = {after} restored={'YES' if after == before[f] else 'NO'}")
    text = "\n".join(report) + "\n"
    (OUT / f"mutation-{mid}{'-full' if FULL else ''}{'-cand' if ONLY else ''}.txt").write_text(text, encoding="utf-8")
    print(text)

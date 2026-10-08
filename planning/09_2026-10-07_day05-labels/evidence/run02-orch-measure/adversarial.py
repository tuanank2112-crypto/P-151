"""Orchestrator adversarial check of validate_day05.py on REAL case data, promoted to FAKE gold in a temp dir.

Never writes under planning/; the fake gold exists only in a temp dir and is NOT a deliverable.
"""
import copy
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path("C:/P-151-truong")
P = ROOT / "planning/09_2026-10-07_day05-labels/deliverables"
VAL = P / "tools/validate_day05.py"
PY = str(ROOT / ".venv/Scripts/python.exe")


def load(name):
    return json.load(open(P / name, encoding="utf-8"))


def dump(d, name, obj):
    (d / name).write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")


def run(d, *extra):
    p = subprocess.run([PY, str(VAL), "--data-dir", str(d), *extra], capture_output=True, text=True, encoding="utf-8", cwd=ROOT)
    return p.returncode, p.stdout


def build(d, reviewer="Tester Nguoi Thuc"):
    cases = load("cases.json")
    props = load("label-proposals.json")["records"]
    now = "2026-10-07T00:00:00Z"
    rv = lambda: dict(status="ACCEPTED", proposed_by="LLM-draft", reviewed_by=reviewer, reviewed_at=now,
                      rationale="r", spec_refs=["CR-BPTN-03 §6"], dispute_id=None)
    cg, sg = [], []
    for p in props:
        if p["task"] == "SAFETY":
            sg.append(dict(case_id=p["case_id"], risk_level=p["payload"]["risk_level"], signals=p["payload"]["signals"],
                           risk_reason=p["payload"].get("risk_reason", "x"), review=rv()))
        else:
            c = p["payload"]
            cg.append(dict(case_id=p["case_id"], service_category=c["service_category"], ticket_type=c["ticket_type"],
                           playbook_id=c["playbook_id"], reason_code=c["reason_code"], review=rv()))
    envelope = lambda recs: dict(schema_version="day05-1", created_at=now, records=recs)
    dump(d, "cases.json", cases)
    dump(d, "classification-gold.json", envelope(cg))
    dump(d, "safety-gold.json", envelope(sg))
    dump(d, "disputes.json", envelope([]))
    dump(d, "label-proposals.json", load("label-proposals.json"))
    ids = [c["case_id"] for c in cases["records"]]
    m = envelope([])
    m.update(dataset_version="adv", source_hashes={}, splits=dict(develop=ids, held_out=[]), frozen=False,
             family_exceptions={"F-D4-11": "D4-11 matrix, DEVELOP only"})
    dump(d, "split-manifest.json", m)


def mutate(base, name, fn):
    d = Path(tempfile.mkdtemp(prefix="adv_"))
    shutil.copytree(base, d, dirs_exist_ok=True)
    fn(d)
    rc, out = run(d, "--structure-only")
    shutil.rmtree(d, ignore_errors=True)
    print(f"{name}: exit={rc} | {[l for l in out.splitlines() if l.startswith(('ERR', 'RESULT', 'VIOL'))][:3]}")
    return rc


def edit(d, name, f):
    o = json.load(open(d / name, encoding="utf-8"))
    f(o)
    dump(d, name, o)


base = Path(tempfile.mkdtemp(prefix="adv_base_"))
build(base)
rc0, out0 = run(base, "--structure-only")
print("BASELINE (fake human reviewer, structure-only): exit", rc0)
print("\n".join(out0.splitlines()[-14:]))
fails = []
fails.append(mutate(base, "reviewer=Claude Opus", lambda d: edit(d, "safety-gold.json", lambda o: o["records"][0]["review"].update(reviewed_by="Claude Opus"))))
fails.append(mutate(base, "reviewer==proposer", lambda d: edit(d, "safety-gold.json", lambda o: o["records"][0]["review"].update(reviewed_by="LLM-draft"))))
fails.append(mutate(base, "quote shifted", lambda d: edit(d, "safety-gold.json", lambda o: next(r for r in o["records"] if r["signals"])["signals"][0].update(start=1, end=2))))
fails.append(mutate(base, "EM w/o tier1 PRESENT", lambda d: edit(d, "safety-gold.json", lambda o: next(r for r in o["records"] if r["risk_level"] == "EMERGENCY").update(signals=[]))))
fails.append(mutate(base, "bad pair", lambda d: edit(d, "classification-gold.json", lambda o: o["records"][0].update(service_category="VE_SINH", ticket_type="COMMON_AREA_LIGHTING"))))
fails.append(mutate(base, "UNKNOWN w/o reason_code", lambda d: edit(d, "classification-gold.json", lambda o: next(r for r in o["records"] if r["service_category"] == "UNKNOWN").update(reason_code=None))))
fails.append(mutate(base, "cls gold on SAFETY_STOP case", lambda d: edit(d, "classification-gold.json", lambda o: o["records"].append(dict(copy.deepcopy(o["records"][0]), case_id="D5-C-0001")))))
fails.append(mutate(base, "family in held-out", lambda d: edit(d, "split-manifest.json", lambda o: (o["splits"]["held_out"].append(o["splits"]["develop"].pop(0))))))
fails.append(mutate(base, "dup case id", lambda d: edit(d, "cases.json", lambda o: o["records"][1].update(case_id=o["records"][0]["case_id"]))))
fails.append(mutate(base, "secret in text", lambda d: edit(d, "cases.json", lambda o: o["records"][0].update(text=o["records"][0]["text"] + " sk-abcdefghijklmnopqrstuvwxyz123456"))))
print("mutations rejected:", sum(1 for r in fails if r == 1), "/", len(fails))
shutil.rmtree(base, ignore_errors=True)
sys.exit(0 if rc0 == 0 and all(r == 1 for r in fails) else 1)

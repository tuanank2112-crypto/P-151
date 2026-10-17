import json, statistics, sys
from collections import Counter, defaultdict

S = sys.argv[1]
data = json.load(open(S + "/results.json", encoding="utf-8"))
rows = data["rows"]
print("model", data["model"], data["mode"], "n", len(rows))

def pct(xs, q):
    xs = sorted(xs)
    if not xs:
        return None
    k = (len(xs) - 1) * q
    f = int(k)
    c = min(f + 1, len(xs) - 1)
    return xs[f] + (xs[c] - xs[f]) * (k - f)

errors = [r for r in rows if "error" in r]
print("errors", [(r["id"], r["error"][:100]) for r in errors])
ok = [r for r in rows if "error" not in r]
src = Counter(r["agent"]["source"] for r in ok)
print("source", dict(src))
fb = [(r["id"], r["agent"]["fallback"]) for r in ok if r["agent"]["fallback"]]
print("fallbacks", fb)

def cls_of(r):
    d = r["agent"]["decision"]
    t = r["ticket"]
    if d is None:
        return None
    if d.get("scope") and d["scope"] != "IN_SCOPE":
        return "OUT"
    jobs = d.get("jobs") or []
    if not jobs:
        return "UNCLEAR"
    cats = {j["category"] for j in jobs}
    if len(cats) > 1:
        return "UNCLEAR"
    c = next(iter(cats))
    return {"KY_THUAT": "TEC", "VE_SINH": "CLN"}.get(c, c)

# what values exist
print("scopes", Counter((r["agent"]["decision"] or {}).get("scope") for r in ok))
print("cats", Counter(j["category"] for r in ok if r["agent"]["decision"] for j in r["agent"]["decision"].get("jobs", [])))
print("depts", Counter(r["ticket"]["department"] for r in ok))
print("status", Counter((r["ticket"]["status"], r["ticket"]["blocker"]) for r in ok))

def accepted(w):
    return w if isinstance(w, list) else [w]

res = {}
for r in ok:
    exp = r["expect"]
    out = {}
    if "safety" in exp:
        out["safety"] = (r["ticket"]["risk"] in accepted(exp["safety"]), r["ticket"]["risk"])
    if "class" in exp:
        got = cls_of(r)
        out["class"] = (got in accepted(exp["class"]), got)
    if "location" in exp:
        d = r["agent"]["decision"]
        loc = d.get("location") if d else None
        if loc and loc.get("building"):
            parts = ["Tòa " + loc["building"]]
            if loc.get("floor"):
                parts.append("Tầng " + str(loc["floor"]))
            if loc.get("area"):
                parts.append(loc["area"])
            got = " / ".join(parts)
        else:
            got = None
        out["location"] = (got == exp["location"], got)
    if "priority" in exp:
        got = r["ticket"]["priority"]
        out["priority"] = (got in accepted(exp["priority"]), got)
    res[r["id"]] = out

for f in ("safety", "class", "location", "priority"):
    xs = [(i, v[f]) for i, v in res.items() if f in v]
    good = sum(1 for _, v in xs if v[0])
    print(f, f"{good}/{len(xs)}", [(i, v[1], next(r["expect"][f] for r in ok if r["id"] == i)) for i, v in xs if not v[0]])

allcase = [i for i, v in res.items() if not all(x[0] for x in v.values())]
print("cases failing any field", len(allcase), "of", len(res), sorted(allcase))
byd = defaultdict(lambda: [0, 0])
for r in ok:
    byd[r["difficulty"]][1] += 1
    byd[r["difficulty"]][0] += all(x[0] for x in res[r["id"]].values())
print(dict(byd))

em = [r for r in ok if r["expect"].get("safety") == "EMERGENCY"]
print("emergency strict", sum(r["ticket"]["risk"] == "EMERGENCY" for r in em), "/", len(em), [r["id"] for r in em if r["ticket"]["risk"] != "EMERGENCY"])
inj = [r for r in ok if r["tag"].startswith("injection")]
print("injection", sum(all(x[0] for x in res[r["id"]].values()) for r in inj), "/", len(inj))

# Agent-only safety (agent field) for the agent-called rows
called = [r for r in ok if r["agent"]["source"] == "AGENT"]
secs = [r["agent"]["latency_ms"] / 1000 for r in called if r["agent"]["latency_ms"] is not None]
print("agent calls", len(called), "lat s mean %.2f p50 %.2f p95 %.2f p99 %.2f max %.2f" % (statistics.mean(secs), pct(secs, .5), pct(secs, .95), pct(secs, .99), max(secs)))
allsecs = [r["seconds"] for r in ok]
print("end-to-end s mean %.2f p50 %.2f p95 %.2f p99 %.2f" % (statistics.mean(allsecs), pct(allsecs, .5), pct(allsecs, .95), pct(allsecs, .99)))
emsecs = [r["seconds"] for r in ok if r["ticket"]["risk"] == "EMERGENCY"]
if emsecs:
    print("emergency end-to-end n", len(emsecs), "p50 %.2f p95 %.2f" % (pct(emsecs, .5), pct(emsecs, .95)))
nonem = [r["seconds"] for r in ok if r["ticket"]["risk"] != "EMERGENCY"]
print("non-emergency end-to-end n", len(nonem), "p50 %.2f p95 %.2f" % (pct(nonem, .5), pct(nonem, .95)))

# tokens from latency log
lat = [json.loads(l) for l in open(S + "/latency.jsonl", encoding="utf-8")]
pt = [l["prompt_tokens"] for l in lat if l.get("prompt_tokens") is not None]
ct = [l["completion_tokens"] for l in lat if l.get("completion_tokens") is not None]
print("log lines", len(lat), "status", Counter(l["status"] for l in lat))
print("tokens/call prompt mean %.0f completion mean %.0f total sum %d" % (statistics.mean(pt), statistics.mean(ct), sum(pt) + sum(ct)), "prompt sum", sum(pt), "completion sum", sum(ct))
ls = [l["latency_ms"] / 1000 for l in lat]
print("log latency p50 %.2f p95 %.2f p99 %.2f" % (pct(ls, .5), pct(ls, .95), pct(ls, .99)))

# agent safety vs rule floor on cases rule got wrong
rule_known = {"a04", "a13", "a14", "u09", "u10", "h03", "h09", "h10", "c08"}
for i in sorted(rule_known):
    r = next((x for x in ok if x["id"] == i), None)
    if r:
        print("rule-bug case", i, "expect", r["expect"].get("safety"), "final", r["ticket"]["risk"], "src", r["agent"]["source"])
print("wrong list detail:")
for i in sorted(allcase):
    r = next(x for x in ok if x["id"] == i)
    print(i, r["difficulty"], {k: v for k, v in res[i].items() if not v[0]}, "|", r["text"][:70])

"""Extra probe (I-14 / 01 §8: the resident sees NOTHING of `agent_decision`).

The fake model plants marker strings in every free-text field it controls (reasoning, safety reason, job reasons,
review reason, note_for_staff, priority reason). Scenarios: routed, split (both tickets), PENDING_REVIEW (G-1),
OUT_OF_SCOPE stop, SAFETY_REVIEW with a G-6 note, NEED_INFO. Every resident view (JSON) is searched for the markers
and for "Agent". Pass = 0 hits."""

import json

from common import MONDAY_9AM, RESIDENT, FnClient, decision, engine_with, job, out
from src.maintenance.views import resident_view

M = "ZZLEAK"


def jobd(category, quote, **kw):
    j = job(category, quote, **kw)
    j.update(reason=f"{M}-reason", priority_reason=f"{M}-prio")
    return j


def answer(data, user):
    t = data.report_text
    base = dict(safety_reason=f"{M}-safety", note=f"{M}-note")
    if "nhiều rác, đèn" in t:
        d = decision(jobs=[jobd("VE_SINH", "nhiều rác"), jobd("KY_THUAT", "đèn cũng không sáng")], building="S1",
                     floor="3", area="Hành lang", **base)
    elif "tối om" in t:
        d = decision(jobs=[jobd("KY_THUAT", "tối om", needs_review=True, review_reason=f"{M}-review")],
                     building="S1", floor="3", area="Hành lang", **base)
    elif "phí quản lý" in t:
        d = decision(jobs=[], bptn_reason="OUT_OF_SCOPE", next_step="TO_BPTN", **base)
    elif "mùi khét" in t:
        d = decision(jobs=[jobd("VE_SINH", "nhiều rác")], building="S1", floor="5", area="Sảnh thang máy", **base)
    elif "Đèn sảnh" in t:
        d = decision(jobs=[jobd("KY_THUAT", "không sáng")], area="Sảnh thang máy", next_step="ASK_RESIDENT",
                     ask_fields=["location_building", "location_floor"], **base)
    else:
        d = decision(jobs=[jobd("VE_SINH", t[:20])], building="S2", floor="7", area="Hành lang", **base)
    doc = json.loads(d)
    doc["reasoning"] = [{"step": "KET_LUAN", "facts": [f"{M}-fact"], "conclusion": f"{M}-conclusion"}]
    return json.dumps(doc, ensure_ascii=False)


engine = engine_with(FnClient(answer))
texts = ["Hành lang tầng 3 tòa S1 nhiều rác, đèn cũng không sáng", "Hành lang tầng 3 tòa S1 tối om",
         "Cho hỏi phí quản lý tháng này bao nhiêu?", "Sảnh thang máy tầng 5 tòa S1 nhiều rác, hình như có mùi khét",
         "Đèn sảnh không sáng", "Hành lang tầng 7 tòa S2 nhiều rác"]
ids = []
for text in texts:
    case = engine.receive(text, resident_id=RESIDENT)
    ids += [case.ticket.ticket_id, *case.ticket.split_children]
hits = 0
for tid in ids:
    case = engine.get(tid)
    view = json.dumps(resident_view(engine, case, MONDAY_9AM).model_dump(mode="json"), ensure_ascii=False)
    staff_has = M in json.dumps(case.model_dump(mode="json"), ensure_ascii=False)
    leak = [w for w in (M, "Agent", "agent_decision") if w in view]
    hits += bool(leak)
    out(f"{tid} {case.ticket.status.value}/{case.ticket.blocker.code.value if case.ticket.blocker else None}"
        f" staff-doc-has-marker={staff_has} resident-view-leaks={leak}")
    if leak:
        out("   ", view[:600])
out(f"RESULT tickets={len(ids)} resident_views_with_leak={hits}")
raise SystemExit(1 if hits else 0)

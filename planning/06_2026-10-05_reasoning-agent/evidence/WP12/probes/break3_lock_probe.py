"""TESTING §8.3 — is the model ever called while the engine lock is held or inside a transaction?

A probe client wraps the rule-mirroring fake model and records, at EVERY call, the entry point being exercised,
`engine.lock._is_owned()` and the transaction depth. One scenario walks every public entry point, Wave 4 included.
Pass (I-16) = 0 calls with the lock held / tx depth > 0. Also reported: calls made by entry points that P02 §5 says
must NOT call the model (resume, receive_stock, undo_merge, cancel, undo_split, bql_merge, T15/T16/T17/E02, ...)."""

from collections import Counter
from datetime import timedelta

from common import BPTN, BQL, CLN, RESIDENT, TEC, WAREHOUSE, mirror, out
from src.maintenance.agent.agent import ReasoningAgent
from src.maintenance.catalog import load_catalog, load_lexicon
from src.maintenance.engine import MaintenanceEngine
from src.maintenance.enums import Priority, ServiceCategory, TicketStatus
from src.maintenance.models import RawTicket
from tests.test_maintenance.helpers import MONDAY_9AM, Clock

MODEL_ALLOWED = {"receive", "add_resident_info", "bptn_resolve", "safety_confirm_safe", "emergency_downgrade",
                 "create_follow_up", "run_jobs"}


class Probe:
    def __init__(self, inner):
        self.inner, self.engine, self.entry, self.obs = inner, None, "?", []

    def __call__(self, system, user, data):
        self.obs.append((self.entry, bool(self.engine.lock._is_owned()), int(getattr(self.engine._local, "tx_depth", 0)),
                         data.ticket_id))
        return self.inner(system, user, data)


clock = Clock(MONDAY_9AM)
probe = Probe(mirror())
agent = ReasoningAgent(probe, catalog=load_catalog(), lexicon=load_lexicon(), model_label="probe", clock=clock)
engine = MaintenanceEngine(clock=clock, agent=agent)
probe.engine = engine
engine.reset(with_fixtures=False)
done = Counter()


def call(entry, fn, *args, **kwargs):
    probe.entry = entry
    clock.advance(minutes=1)
    try:
        result = fn(*args, **kwargs)
        done[entry] += 1
        return result
    except Exception as exc:  # noqa: BLE001 - an entry point refusing is fine, the probe only watches the model calls
        out(f"  [{entry}] raised {type(exc).__name__}: {str(exc)[:100]}")
        done[entry + "!err"] += 1
        return None


def tid(case):
    return case.ticket.ticket_id


S1H3 = "Hành lang tầng 3 tòa S1 nhiều rác"
A = tid(call("receive", engine.receive, S1H3, resident_id=RESIDENT))
B = tid(call("receive", engine.receive, S1H3 + " quá", resident_id=RESIDENT))
call("bptn_resolve", engine.bptn_resolve, B, BPTN, merge=False, note="khác vụ")
C = tid(call("receive", engine.receive, S1H3 + " lắm", resident_id=RESIDENT))
call("bptn_resolve(merge)", engine.bptn_resolve, C, BPTN, merge=True, note="trùng")
call("undo_merge", engine.undo_merge, C, BPTN, note="gộp nhầm")
D = tid(call("receive", engine.receive, "Đèn hành lang không sáng", resident_id=RESIDENT))
call("add_resident_info", engine.add_resident_info, D, RESIDENT, "tầng 3 tòa S1 ạ")
E = tid(call("receive", engine.receive, "Đèn sảnh không sáng", resident_id=RESIDENT))
call("bptn_resolve", engine.bptn_resolve, E, BPTN, location="Tòa S2 / Tầng 7 / Hành lang", note="gọi cư dân")
F = tid(call("receive", engine.receive, "Hành lang tầng 3 tòa S2 hình như có mùi khét", resident_id=RESIDENT))
call("safety_confirm_safe", engine.safety_confirm_safe, F, BPTN, note="đã kiểm tra")
F2 = tid(call("receive", engine.receive, "Hành lang tầng 2 tòa S2 hình như có mùi khét", resident_id=RESIDENT))
call("safety_request_info", engine.safety_request_info, F2, BPTN, note="mô tả thêm")
call("add_resident_info", engine.add_resident_info, F2, RESIDENT, "Hết mùi rồi, chỉ còn đèn không sáng")
F3 = tid(call("receive", engine.receive, "Sảnh thang máy tầng 5 tòa S1 hình như có mùi khét", resident_id=RESIDENT))
call("safety_escalate", engine.safety_escalate, F3, BPTN, note="nâng")
G = tid(call("receive", engine.receive, "Hầm xe tầng B1 tòa S1 có khói bốc ra từ hộp điện", resident_id=RESIDENT))
call("emergency_downgrade", engine.emergency_downgrade, G, BQL, note="báo nhầm, chỉ là hơi nước")
H = tid(call("receive", engine.receive, "Hầm xe tầng B1 tòa S1 có lửa ở thùng rác", resident_id=RESIDENT))
I = tid(call("receive", engine.receive, "Hầm xe tầng B1 tòa S1 có lửa cháy thùng rác", resident_id=RESIDENT))
call("bql_merge", engine.bql_merge, I, BQL, into=H, note="cùng vụ")
call("undo_merge", engine.undo_merge, I, BQL, note="khác vụ")
call("create_follow_up", engine.create_follow_up, H, BQL, note="đã dập lửa, cần dọn")
call("emergency_close", engine.emergency_close, H, BQL, note="đã xử lý")
call("cancel", engine.cancel, I, BQL, cancel_reason="trùng vụ đã đóng")
J = call("receive", engine.receive, "Hành lang tầng 7 tòa S2 nhiều rác, đèn cũng không sáng", resident_id=RESIDENT)
children = J.ticket.split_children if J else []
out("split children of", tid(J) if J else None, "->", children)
if children:
    call("undo_split", engine.undo_split, children[0], BPTN, note="tách sai")
call("accept", engine.accept, A, CLN)
call("report_wrong_department", engine.report_wrong_department, A, CLN, note="không phải việc phòng mình")
call("bql_wrong_department", engine.bql_wrong_department, A, BQL, decision="KEEP", note="giữ")
call("report_wrong_department", engine.report_wrong_department, A, CLN, note="vẫn không phải")
call("bql_wrong_department", engine.bql_wrong_department, A, BQL, decision="TO_BPTN", note="chuyển BPTN")
call("bptn_resolve", engine.bptn_resolve, A, BPTN, category=ServiceCategory.KY_THUAT, note="là đèn")
K = tid(call("receive", engine.receive, "Đèn hành lang tầng 2 tòa S2 không sáng", resident_id=RESIDENT))
call("return_wrong_department", engine.return_wrong_department, K, TEC, note="không phải")
call("bptn_resolve", engine.bptn_resolve, K, BPTN, department=engine.get(K).ticket.proposed_department_id, note="giữ")
call("set_priority", engine.set_priority, K, BPTN, Priority.HIGH, note="gấp")
engine.stock["SIM-MAT-LAMP-01"] = 0
L = tid(call("receive", engine.receive, "Đèn hầm xe tầng B1 tòa S1 không sáng", resident_id=RESIDENT))
out("L status", engine.get(L).ticket.status, engine.get(L).ticket.blocker.code if engine.get(L).ticket.blocker else None)
call("receive_stock", engine.receive_stock, WAREHOUSE, "SIM-MAT-LAMP-01", 50)
call("resume", engine.resume, D)
call("run_agent(guard)", engine.run_agent, D)
orphans = []
for i in range(7):
    number = engine.repo.next_ticket_number()
    raw = RawTicket(ticket_id=f"SIM-TKT-{number:04d}", created_at=clock().isoformat(timespec="seconds"),
                    original_description=f"Đèn hành lang tầng 3 tòa S1 không sáng lần {i}")
    probe.entry = "ingest(orphan)"
    engine.ingest(raw, resident_id=RESIDENT)
    orphans.append(raw.ticket_id)
clock.advance(minutes=10)
call("run_jobs", engine.run_jobs)
call("run_jobs", engine.run_jobs)
call("reset(with fixtures)", engine.reset)

entries = Counter(o[0] for o in probe.obs)
locked = [o for o in probe.obs if o[1] or o[2] > 0]
forbidden = [o for o in probe.obs if o[0] not in MODEL_ALLOWED]
out("entry points exercised:", dict(done))
out("model calls per entry point:", dict(entries))
out("orphans:", orphans, "-> run_jobs model calls (first round <= max_job_agent_calls=5):",
    [o[3] for o in probe.obs if o[0] == "run_jobs"])
for o in locked:
    out("  LOCKED CALL", o)
for o in forbidden:
    out("  CALL FROM A NO-MODEL ENTRY", o)
out(f"RESULT model_calls={len(probe.obs)} in_lock_or_tx={len(locked)} from_no_model_entries={len(forbidden)}")
raise SystemExit(1 if locked else 0)

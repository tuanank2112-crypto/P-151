"""TESTING §8.4 — a second request changes the ticket BETWEEN the model call and the transaction, with two REAL threads.

Thread A's model call is held open (Event) while thread B commits another change to the same ticket. Pass = the
decision applied always carries the fingerprint of the content finally stored (never the content A's model saw);
after two interleavings the rules decide (FALLBACK_RULE/STALE + AGENT_FALLBACK); a danger B adds is never lost to A's
older decision."""

import threading

from common import BPTN, RESIDENT, engine_with, mirror, out
from src.maintenance.ai_logger import ai_logger
from src.maintenance.agent.client import ClientReply
from src.maintenance.enums import RiskLevel, TicketFlag

TIMEOUT = 20


class GateClient:
    """Mirror answers; the first N calls whose report contains `hold_on` block until released."""

    def __init__(self, hold_on, holds):
        self.inner, self.hold_on, self.lock = mirror(), hold_on, threading.Lock()
        self.gates = [(threading.Event(), threading.Event()) for _ in range(holds)]  # (called, release)
        self.calls = []

    def __call__(self, system, user, data):
        with self.lock:
            self.calls.append((threading.current_thread().name, data.report_text))
            gate = None
            if self.hold_on in data.report_text and threading.current_thread().name == "A":
                gate = next((g for g in self.gates if not g[0].is_set()), None)
                if gate:
                    gate[0].set()
        if gate:
            assert gate[1].wait(TIMEOUT), "gate never released"
        return self.inner(system, user, data)


problems = []


def expect(cond, what):
    out(("ok   " if cond else "FAIL ") + what)
    if not cond:
        problems.append(what)


def run(name, holds, a_call, b_calls, setup_text, a_marker):
    out(f"--- {name}")
    client = GateClient(a_marker, holds)
    engine = engine_with(client)
    tid = engine.receive(setup_text, resident_id=RESIDENT).ticket.ticket_id
    out("setup:", engine.get(tid).ticket.status.value, engine.get(tid).ticket.blocker.code.value)
    result, errors = {}, []

    def a():
        try:
            result["a"] = a_call(engine, tid)
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)

    ta = threading.Thread(target=a, name="A")
    ta.start()
    for i, b_call in enumerate(b_calls):
        assert client.gates[i][0].wait(TIMEOUT), "A never reached the model"
        tb = threading.Thread(target=lambda: b_call(engine, tid), name=f"B{i + 1}")
        tb.start()
        tb.join(TIMEOUT)
        client.gates[i][1].set()
    ta.join(TIMEOUT)
    expect(not errors, f"{name}: thread A finished without error {errors!r}")
    case = engine.get(tid)
    rec = case.agent_decision
    fp_now = engine._content_fingerprint(case)
    out("calls:", [(t, txt.replace(chr(10), " | ")) for t, txt in client.calls])
    out("final:", case.ticket.status.value, case.ticket.blocker.code.value if case.ticket.blocker else None,
        "risk", case.ticket.risk_level.value, "record", rec.source, rec.fallback_reason, "flags",
        [f.value for f in case.ticket.flags])
    expect(rec.fingerprint == fp_now, f"{name}: applied decision fingerprint == fingerprint of the stored content")
    if rec.ai_log_id:
        logged = next(e for e in ai_logger.get_logs(tid) if e.log_id == rec.ai_log_id)
        for a_text in case.additions:
            expect(a_text.content in logged.prompt_sent["user"],
                   f"{name}: the model call behind the applied decision saw {a_text.content!r}")
    decisions = [a for a in case.audit if a.action.value == "AGENT_DECISION"]
    out("AGENT_DECISION audit rows:", len(decisions))
    return engine, tid, case


# 4a: one interleaving -> decided again once (A-25 with threads)
_, _, case = run(
    "4a one interleaving", 1,
    lambda e, t: e.add_resident_info(t, RESIDENT, "ở tầng 3 ạ"),
    [lambda e, t: e.add_resident_info(t, RESIDENT, "đèn nhấp nháy rồi tắt hẳn")],
    "Đèn hành lang không sáng", "ở tầng 3 ạ",
)
expect(case.agent_decision.source == "AGENT", "4a: after one re-decision the Agent's decision is used")

# 4b: two interleavings -> rules (A-26 with threads)
_, _, case = run(
    "4b two interleavings", 2,
    lambda e, t: e.add_resident_info(t, RESIDENT, "ở tầng 3 ạ"),
    [lambda e, t: e.add_resident_info(t, RESIDENT, "đèn nhấp nháy"),
     lambda e, t: e.add_resident_info(t, RESIDENT, "giờ tắt hẳn rồi")],
    "Đèn hành lang không sáng", "ở tầng 3 ạ",
)
expect(case.agent_decision.source == "FALLBACK_RULE" and case.agent_decision.fallback_reason == "STALE",
       "4b: FALLBACK_RULE/STALE after two interleavings")
expect(TicketFlag.AGENT_FALLBACK in case.ticket.flags, "4b: AGENT_FALLBACK flag")

# 4c: A completes the place (would route), B adds a danger meanwhile -> must end EMERGENCY, never routed
_, _, case = run(
    "4c danger added during A's model call", 1,
    lambda e, t: e.add_resident_info(t, RESIDENT, "tầng 3 tòa S1 ạ"),
    [lambda e, t: e.add_resident_info(t, RESIDENT, "có khói bốc ra từ hộp đèn")],
    "Đèn hành lang không sáng", "tầng 3 tòa S1 ạ",
)
expect(case.ticket.risk_level == RiskLevel.EMERGENCY and case.ticket.status.value == "VERIFYING",
       "4c: final EMERGENCY (danger of B not lost to A's older decision)")

# 4d: BPTN fills the place (model held) while the resident adds a danger
_, _, case = run(
    "4d BPTN resolve vs resident danger", 1,
    lambda e, t: e.bptn_resolve(t, BPTN, location="Tòa S1 / Tầng 3 / Hành lang", note="gọi cư dân"),
    [lambda e, t: e.add_resident_info(t, RESIDENT, "có mùi gas nồng nặc")],
    "Đèn hành lang không sáng", "Đèn hành lang không sáng",
)
expect(case.ticket.risk_level == RiskLevel.EMERGENCY and case.ticket.status.value == "VERIFYING",
       "4d: final EMERGENCY after BPTN's resolve committed on top of the resident's danger")

out(f"RESULT scenarios=4 problems={len(problems)}")
raise SystemExit(1 if problems else 0)

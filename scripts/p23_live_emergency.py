"""Plan 23 live check: emergency duplicates, a two-job emergency after BQL downgrades it, and ordinary tickets next to
an open emergency, through the real engine + reasoning Agent with the model of the current settings (`.env`).

Each scenario gets a fresh in-memory engine with no fixture ticket (no shared database, no Supabase). The output is
one line per ticket and a PASS/FAIL per expectation; exit 0 when every expectation held, 1 otherwise.

Usage (from the repo root):
    PYTHONUTF8=1 PYTHONPATH=. python scripts/p23_live_emergency.py
"""

import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("MO_STORE", "memory")
os.environ.setdefault("MO_PHOTO_STORE", "local")

from src.config import get_settings  # noqa: E402
from src.maintenance.engine import build_engine  # noqa: E402

R1, R2, R3 = "SIM-ACTOR-RESIDENT-01", "SIM-ACTOR-RESIDENT-02", "SIM-ACTOR-RESIDENT-01"
BQL = "SIM-ACTOR-BQL-01"
RESULTS: list[tuple[str, bool]] = []


def fresh():
    engine = build_engine(get_settings())
    engine.reset(with_fixtures=False)
    return engine


def send(engine, text: str, resident: str) -> str:
    started = time.perf_counter()
    case = engine.receive(text, resident_id=resident)
    show(engine, case.ticket.ticket_id, f"{time.perf_counter() - started:5.1f}s | {text}")
    return case.ticket.ticket_id


def show(engine, tid: str, tail: str = "") -> None:
    case = engine.get(tid)
    t, record = case.ticket, case.agent_decision
    jobs = [j.category for j in record.decision.jobs] if record and record.decision else None
    print(
        f"  {tid} {t.status.value}/{t.blocker.code.value if t.blocker else '-'} risk={t.risk_level.value} "
        f"loc={engine.effective_location(case)!r} dept={t.department_id} "
        f"suspect_of={t.blocker.related_ticket_id if t.blocker else None} dup={t.duplicate_count} "
        f"split={t.split_children or t.split_from} src={record.source if record else '-'} jobs={jobs} {tail}",
        flush=True,
    )


def expect(name: str, ok: bool) -> None:
    RESULTS.append((name, ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}", flush=True)


def l1_duplicate() -> None:
    print("L1 hai cư dân báo cùng một vụ khẩn cấp (cách nói khác nhau)")
    e = fresh()
    a = send(e, "Hành lang tầng 7 tòa S2 có khói bốc ra từ hộp đèn, mùi khét lắm", R1)
    b = send(e, "Tầng 7 tòa S2 ngoài hành lang đang bốc khói đen, mọi người cẩn thận", R2)
    ta, tb = e.get(a).ticket, e.get(b).ticket
    expect("ca 1 khẩn cấp chờ BQL", ta.blocker is not None and ta.blocker.code.value == "EMERGENCY_PENDING_BQL")
    expect(
        "ca 2 vẫn chờ BQL (không bị ẩn)", tb.blocker is not None and tb.blocker.code.value == "EMERGENCY_PENDING_BQL"
    )
    expect("ca 2 nghi trùng ca 1", tb.blocker is not None and tb.blocker.related_ticket_id == a)
    expect("ca 1 đếm 1 người cùng báo", ta.duplicate_count == 1)
    e.bql_merge(b, BQL, into=a, note="Cùng một đám khói hành lang tầng 7")
    show(e, b, "(sau khi BQL gộp)")
    expect(
        "BQL gộp xong, ca 1 vẫn đếm 1",
        e.get(b).ticket.status.value == "MERGED" and e.get(a).ticket.duplicate_count == 1,
    )


def l2_two_jobs() -> None:
    print("L2 phản ánh hai việc có dấu hiệu khẩn cấp, BQL hạ mức")
    e = fresh()
    a = send(e, "Hành lang tầng 9 tòa S2 đèn chập tóe lửa có khói, rác thì đầy cả lối đi chưa ai dọn", R1)
    ta = e.get(a).ticket
    expect("ban đầu là khẩn cấp chờ BQL", ta.blocker is not None and ta.blocker.code.value == "EMERGENCY_PENDING_BQL")
    started = time.perf_counter()
    e.emergency_downgrade(a, BQL, note="Đã kiểm tra: đèn chỉ hỏng, không cháy; rác cần dọn")
    show(e, a, f"{time.perf_counter() - started:5.1f}s (sau khi BQL hạ mức)")
    root = e.get(a).ticket
    for child in root.split_children:
        show(e, child, "(ticket con)")
    expect("đã tách thành 2 ticket", len(root.split_children) == 1)
    if root.split_children:
        child = e.get(root.split_children[0]).ticket
        expect(
            "hai phòng ban khác nhau", {root.department_id, child.department_id} == {"DEPT_CLEANING", "DEPT_TECHNICAL"}
        )
        expect(
            "ticket con không bật lại khẩn cấp",
            child.risk_level.value == "NONE" and child.safety_cleared_at is not None,
        )


def l3_hold() -> None:
    print("L3 ticket thường tới sau, cùng chỗ với khẩn cấp đèn đang mở")
    e = fresh()
    fire = send(e, "Hộp đèn hành lang tầng 11 tòa S2 đang tóe lửa, có khói", R1)
    started = time.perf_counter()
    e.read_emergency(fire)  # what the API starts in the background once BQL has the emergency (plan 23 P04)
    show(e, fire, f"{time.perf_counter() - started:5.1f}s (Agent đọc ca khẩn cấp)")
    record = e.get(fire).agent_decision
    expect("Agent đã đọc ca khẩn cấp do luật bắt", record is not None and record.source == "AGENT")
    lamp = send(e, "Đèn hành lang tầng 11 tòa S2 không sáng", R2)
    trash = send(e, "Hành lang tầng 11 tòa S2 nhiều rác quá, nhờ dọn giúp", R3)
    ft, lt, tt = e.get(fire).ticket, e.get(lamp).ticket, e.get(trash).ticket
    expect("ca đèn tóe lửa là khẩn cấp", ft.blocker is not None and ft.blocker.code.value == "EMERGENCY_PENDING_BQL")
    expect(
        "ticket đèn cùng chỗ bị giữ chờ BQL", lt.blocker is not None and lt.blocker.code.value == "WAITING_EMERGENCY"
    )
    expect("ticket rác (khác loại) vẫn được giao", tt.status.value == "ROUTED" and tt.department_id == "DEPT_CLEANING")
    e.emergency_close(fire, BQL, note="Đã ngắt điện hộp đèn")
    show(e, lamp, "(sau khi BQL đóng khẩn cấp)")
    expect("ticket đèn chạy tiếp sau khi BQL xử lý", e.get(lamp).ticket.status.value == "ROUTED")


def main() -> int:
    s = get_settings()
    print(f"P23-LIVE llm_mode={s.llm_mode} model={s.model_name} agent={s.mo_agent_enabled} store={s.mo_store}")
    for scenario in (l1_duplicate, l2_two_jobs, l3_hold):
        try:
            scenario()
        except Exception as exc:  # noqa: BLE001 - one broken scenario must not hide the others
            expect(f"{scenario.__name__} chạy không lỗi ({type(exc).__name__}: {exc})"[:160], False)
    passed = sum(ok for _, ok in RESULTS)
    print(f"SUMMARY passed={passed}/{len(RESULTS)}")
    return 0 if passed == len(RESULTS) else 1


if __name__ == "__main__":
    sys.exit(main())

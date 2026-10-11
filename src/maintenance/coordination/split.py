"""Splitting a report with two jobs into a root and a child ticket, and undoing it (SPEC-P05).

The root (the resident's own ticket) keeps cleaning, the child takes the lamp. Both are written in ONE transaction
(`_insert_case`) and each runs the pipeline on its own: the child never asks the model (its decision is the root's,
cut to its job), and a ticket that is already part of a split is never split again.
"""

import re
from datetime import datetime

from src.maintenance.common import _blank, _suffix
from src.maintenance.enums import (
    PLAYBOOK_BY_CATEGORY,
    SPLIT_PAIR,
    TERMINAL_STATUSES,
    Action,
    PlaybookId,
    ReasonCode,
    RiskLevel,
    ServiceCategory,
    TicketStatus,
)
from src.maintenance.errors import InvalidTransitionError
from src.maintenance.messages import split_created_message
from src.maintenance.models import AgentClassificationProposal, Case, RawTicket
from src.maintenance.rules import split_verdict
from src.maintenance.store.base import GuardError

SPLIT_RULE_ID = "PB-COM-R-SPLIT-01"
_FULL_LOCATION = re.compile(r"Tòa [^/]+ / Tầng [^/]+ / [^/]+")  # P05 §3 condition 5: building, floor and area
_UNDO_FROM = frozenset({TicketStatus.VERIFYING, TicketStatus.ON_HOLD, TicketStatus.ROUTED})


class SplitMixin:
    def _try_split(self, work: Case, now: datetime) -> bool:
        """Step 3: split a mixed report in two tickets (P05 §3). False = no split, the pipeline goes on as before.

        All five conditions must hold: the switch is on, there are exactly two jobs (the Agent's, or, with neither an
        Agent decision nor the old LLM path, the rules'), the ticket is not part of a split already, the safety layer
        found nothing (and nobody cleared anything), and the location is complete."""
        ticket = work.ticket
        if not self.catalog.agent_policy.auto_split_mixed_reports:  # 1
            return False
        if ticket.split_from is not None or ticket.split_children:  # 3
            return False
        if ticket.risk_level != RiskLevel.NONE or ticket.safety_cleared_at is not None:  # 4
            return False
        if _FULL_LOCATION.fullmatch(self.effective_location(work) or "") is None:  # 5
            return False
        if not self._has_two_jobs(work, now):  # 2, last: the rules path classifies the report as a side effect
            return False
        self._split_mixed_report(work, now)
        return True

    def _has_two_jobs(self, work: Case, now: datetime) -> bool:
        view = self._job_view(work)
        if view is not None:  # the Agent decided: exactly one cleaning job and one technical job
            jobs = view.jobs()
            return len(jobs) == 2 and {ServiceCategory(j.category) for j in jobs} == set(SPLIT_PAIR)
        if self.llm is not None:  # the old LLM path never splits (P05 §7)
            return False
        cls = self._classification(work, now)  # cached: step 3 reuses it when nothing is split
        if cls.reason_code != ReasonCode.CATEGORY_UNCLEAR:
            return False
        return split_verdict(self._content(work), self.catalog.site.buildings).categories == SPLIT_PAIR

    def _split_mixed_report(self, work: Case, now: datetime) -> str:
        """P05 §3.1, in this order. Any error cancels the whole transaction: no child, the root stays RECEIVED."""
        root_id = work.ticket.ticket_id
        number = self.repo.next_ticket_number()
        child_id = f"SIM-TKT-{number:04d}"
        raw = RawTicket(
            ticket_id=child_id,
            created_at=work.ticket.raw.created_at,
            original_description=work.ticket.raw.original_description,
            original_evidence_refs=work.ticket.raw.original_evidence_refs,
            channel="split",
        )
        child = self._build_case(
            raw,
            None,
            work.ticket.resident_id,
            now,
            public_message=split_created_message(root_id),
            notify_extra={"split_from": root_id},
            reason=f"Tách từ phản ánh hai việc {root_id}",
        )
        self._copy_additions(work, child, now, mode="copy")
        self._copy_resident_photos(work, child, now, mode="copy")
        locked_location = work.ticket.locked_fields.location
        if locked_location:
            self._set_ticket(
                child, locked_fields=child.ticket.locked_fields.model_copy(update={"location": locked_location})
            )
        if work.classification is not None:
            child.classification = work.classification.model_copy(deep=True)
        self._set_ticket(child, split_from=root_id, split_category=SPLIT_PAIR[1])
        self._set_ticket(work, split_children=[*work.ticket.split_children, child_id], split_category=SPLIT_PAIR[0])
        why = f"Phản ánh có hai việc: giữ vệ sinh ở {root_id}, tách đèn sang {child_id}"
        self._agent(
            work,
            Action.SPLIT_TICKET,
            "Ticket",
            root_id,
            "split_children",
            [],
            [child_id],
            why,
            now=now,
            rule_id=SPLIT_RULE_ID,
        )
        self._agent(
            child,
            Action.SPLIT_TICKET,
            "Ticket",
            child_id,
            "split_from",
            None,
            root_id,
            why,
            now=now,
            rule_id=SPLIT_RULE_ID,
        )
        location = self.effective_location(work)
        self._seed_split_proposal(work, SPLIT_PAIR[0], location, now)
        self._seed_split_proposal(child, SPLIT_PAIR[1], location, now)
        view = self._job_view(work)
        child_record = self._rebind_after_split(work, child, view) if view is not None else None
        self._insert_case(child)
        if child_record is None:
            self._run_pipeline(child, 2, now)
            return child_id
        prepared = dict(getattr(self._local, "prepared", None) or {})
        prepared[child_id] = child_record  # the child reads this decision: it never asks the model
        with self._prepared(prepared, retry_on_stale=getattr(self._local, "retry_on_stale", False)):
            self._run_pipeline(child, 2, now)
        return child_id

    def _rebind_after_split(self, work: Case, child: Case, view):
        """The Agent's one decision is cut in two: the root keeps its cleaning job, the child its lamp job, each with
        the fingerprint of its own (pinned) content. The root's rows are changed without a second audit row; the child
        gets its AGENT_DECISION audit row when its pipeline activates the record. Returns the child's record."""
        record = view.record
        root_record = record.model_copy(
            update={
                "fingerprint": self._content_fingerprint(work),
                "valid_job_indexes": [view.job_index(SPLIT_PAIR[0])],
            }
        )
        child_record = record.model_copy(
            update={
                "fingerprint": self._content_fingerprint(child),
                "valid_job_indexes": [view.job_index(SPLIT_PAIR[1])],
            }
        )
        work.agent_decision = root_record
        self._active_map()[work.ticket.ticket_id] = root_record
        return child_record

    def _seed_split_proposal(self, case: Case, category: ServiceCategory, location: str | None, now: datetime) -> None:
        """The classification proposal of a ticket born from a split, with its own wording (Q23 (3)).

        Step 3 binds a pinned category through `_bind_category(..., "AGENT_SPLIT")`, which for a ticket with no proposal
        writes the text of a category BPTN locked ("Category do BPTN chọn", `locked_fields.category`) - false here:
        nobody locked anything. This is written first, so `_bind_category` only refreshes the location and goes on."""
        if case.proposal is not None:
            return
        ticket_type, playbook_id = PLAYBOOK_BY_CATEGORY[category]
        technical = playbook_id == PlaybookId.TEC
        case.proposal = AgentClassificationProposal(
            proposal_id=f"SIM-ACP-{_suffix(case.ticket.ticket_id)}",
            ticket_id=case.ticket.ticket_id,
            proposal_revision=1,
            service_category_proposed=category,
            ticket_type_proposed=ticket_type,
            playbook_id=playbook_id,
            category_source="AGENT_SPLIT",
            asset_type="LIGHTING" if technical else None,
            reported_symptom="NOT_WORKING" if technical else None,
            location_proposed=location,
            matched_rule_ids=[SPLIT_RULE_ID],
            classification_reason=(
                f"Phản ánh có hai việc, tách thành hai ticket: ticket này giữ việc {category.value}"
                f" (gốc {SPLIT_PAIR[0].value}, con {SPLIT_PAIR[1].value})"
            ),
            source_references=["ticket.original_description", "ticket_resident_additions", "split_category"],
            created_at=now,
        )

    def undo_split(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        """BPTN or BQL takes a split child back into its root (P05 §5): the child becomes MERGED, the root gets its
        additions and photos. Not a duplicate: the root's `duplicate_count` does not change."""

        def op(work: Case, now: datetime) -> None:
            ticket = work.ticket
            if (
                ticket.split_from is None
                or ticket.status not in _UNDO_FROM
                or ticket.accepted_at is not None
                or ticket.risk_level != RiskLevel.NONE
            ):
                raise InvalidTransitionError(
                    "Chỉ hoàn tác được ticket con của một lần tách, chưa nhận việc và không có rủi ro an toàn",
                    {"status": ticket.status, "split_from": ticket.split_from, "risk_level": ticket.risk_level},
                )
            if _blank(note):
                raise GuardError("Hoàn tác tách bắt buộc có lý do")
            if self._has_open_merged_children(work):  # P04 §8: no chain merge
                raise GuardError(
                    "Ticket còn ticket con đang gộp vào nó; hoàn tác gộp các ticket con trước (không gộp dây chuyền)",
                    {"merged_children": list(ticket.merged_children)},
                )
            root_id = ticket.split_from
            root = self._related_case(root_id)
            if root.ticket.status in TERMINAL_STATUSES:
                raise GuardError("Ticket gốc đã kết thúc; BQL hủy ticket con (T23)", {"root": root_id})
            role = self._role(actor_id)
            previous_blocker = ticket.blocker
            self._apply_transition(
                work,
                TicketStatus.MERGED,
                actor_id,
                role,
                now,
                note=note,
                merged_into=root_id,
                department_id=None,
                dispatched_at=None,
            )
            self._release_duplicate_count(work, previous_blocker, now)  # P04 §2.1: it no longer points at its suspect
            old_children = list(root.ticket.merged_children)
            if ticket.ticket_id not in old_children:  # a second undo (after T09) must not list the child twice
                self._set_ticket(root, merged_children=[*old_children, ticket.ticket_id])
                self._audit(
                    root,
                    Action.LINK_TICKETS,
                    "Ticket",
                    root_id,
                    actor_id,
                    role,
                    "merged_children",
                    old_children,
                    root.ticket.merged_children,
                    f"Hoàn tác tách: nhận lại {ticket.ticket_id}",
                    now=now,
                )
            self._copy_additions(work, root, now, mode="merge")
            self._copy_resident_photos(work, root, now, mode="merge")
            self._audit(
                work,
                Action.SPLIT_UNDO,
                "Ticket",
                ticket.ticket_id,
                actor_id,
                role,
                "merged_into",
                None,
                root_id,
                note.strip(),
                now=now,
            )

        return self._mutate(ticket_id, actor_id, Action.SPLIT_UNDO, op)

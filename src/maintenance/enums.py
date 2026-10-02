"""Controlled vocabulary. Data Contract v1.1 §4 as amended by CR-BPTN-02 and CR-BPTN-03 (v0.6 candidate)."""

from enum import StrEnum

SCHEMA_VERSION = "1.2"
PLAYBOOK_VERSION = "1.1"


class TicketStatus(StrEnum):
    """CR-BPTN-02 §2.1 / CR-BPTN-03 §3.1: ten statuses, shared by resident and BQL at two levels of detail.
    An emergency is a blocker (EMERGENCY_PENDING_BQL), not a status."""

    RECEIVED = "RECEIVED"
    VERIFYING = "VERIFYING"
    ROUTED = "ROUTED"
    IN_PROGRESS = "IN_PROGRESS"
    READY_FOR_REVIEW = "READY_FOR_REVIEW"
    CLOSED = "CLOSED"
    NEED_INFO = "NEED_INFO"
    ON_HOLD = "ON_HOLD"
    MERGED = "MERGED"
    CANCELLED = "CANCELLED"


# CR-BPTN-03 §4.3: no reopen; a resident who is not satisfied files a new ticket
TERMINAL_STATUSES = frozenset({TicketStatus.CLOSED, TicketStatus.MERGED, TicketStatus.CANCELLED})
# Entering or leaving these (or any change between main statuses) notifies; blocker-only changes do not
SIDE_STATUSES = frozenset({TicketStatus.NEED_INFO, TicketStatus.ON_HOLD})


class ReasonCode(StrEnum):
    MISSING_INFO = "MISSING_INFO"
    DUPLICATE = "DUPLICATE"
    CATEGORY_UNCLEAR = "CATEGORY_UNCLEAR"
    OUT_OF_SCOPE = "OUT_OF_SCOPE"
    PENDING_REVIEW = "PENDING_REVIEW"
    ASSET_UNCLEAR = "ASSET_UNCLEAR"
    WAITING_MATERIAL = "WAITING_MATERIAL"
    OUT_OF_HOURS = "OUT_OF_HOURS"
    NOT_ACCEPTED = "NOT_ACCEPTED"
    WRONG_DEPT = "WRONG_DEPT"
    BLOCKED_ONSITE = "BLOCKED_ONSITE"
    REWORK = "REWORK"
    SAFETY_REVIEW_REQUIRED = "SAFETY_REVIEW_REQUIRED"  # CR-BPTN-03: tier-2 risk, BPTN decides (3 choices)
    EMERGENCY_PENDING_BQL = "EMERGENCY_PENDING_BQL"  # CR-BPTN-03: tier-1 risk, only BQL acts
    WRONG_DEPT_AFTER_START = "WRONG_DEPT_AFTER_START"  # CR-BPTN-03: department reports a wrong hand-over mid-work


# Blockers BPTN clears (event `bptn_resolved`). MISSING_INFO too: BPTN contacts the resident and enters what is
# missing, while the resident can still add it directly (whichever comes first clears the blocker).
BPTN_REASONS = frozenset(
    {
        ReasonCode.MISSING_INFO,
        ReasonCode.DUPLICATE,
        ReasonCode.CATEGORY_UNCLEAR,
        ReasonCode.OUT_OF_SCOPE,
        ReasonCode.PENDING_REVIEW,
        ReasonCode.ASSET_UNCLEAR,
        ReasonCode.WRONG_DEPT,
    }
)
# Blockers only BQL may act on. BPTN touching them is ACTION_DENIED (CR-BPTN-03 §4.4.5); resume() never clears them.
BQL_REASONS = frozenset({ReasonCode.EMERGENCY_PENDING_BQL, ReasonCode.WRONG_DEPT_AFTER_START})
SAFETY_REASONS = frozenset({ReasonCode.SAFETY_REVIEW_REQUIRED, ReasonCode.EMERGENCY_PENDING_BQL})


class Department(StrEnum):
    DEPT_CLEANING = "DEPT_CLEANING"
    DEPT_TECHNICAL = "DEPT_TECHNICAL"


class BlockerOwner(StrEnum):
    RESIDENT = "RESIDENT"
    BPTN = "BPTN"
    DEPARTMENT = "DEPARTMENT"
    WAREHOUSE = "WAREHOUSE"
    SYSTEM = "SYSTEM"
    BQL = "BQL"


class TicketFlag(StrEnum):
    ASSET_CHECK_ONSITE = "ASSET_CHECK_ONSITE"  # BPTN could not identify the asset; the department checks on site
    STOCK_CHECK_ON_ACCEPT = "STOCK_CHECK_ON_ACCEPT"  # stock unknown; the department checks when it accepts


class RiskLevel(StrEnum):
    """CR-BPTN-03 §6.1.5. Separate from priority."""

    NONE = "NONE"
    UNCLEAR = "UNCLEAR"  # tier 2: BPTN reviews
    EMERGENCY = "EMERGENCY"  # tier 1: BQL acts, the Agent never routes


class SignalStatus(StrEnum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    UNCLEAR = "UNCLEAR"


class Priority(StrEnum):
    """CR-BPTN-03 §7."""

    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class PrioritySource(StrEnum):
    AGENT_RULE = "AGENT_RULE"
    HUMAN_OVERRIDE = "HUMAN_OVERRIDE"


class ClosureKind(StrEnum):
    NORMAL = "NORMAL"
    EMERGENCY_HANDLED = "EMERGENCY_HANDLED"  # BQL handled an emergency; no department ever had the ticket


class ServiceCategory(StrEnum):
    VE_SINH = "VE_SINH"
    KY_THUAT = "KY_THUAT"
    UNKNOWN = "UNKNOWN"


class TicketType(StrEnum):
    COMMON_AREA_CLEANING = "COMMON_AREA_CLEANING"
    COMMON_AREA_LIGHTING = "COMMON_AREA_LIGHTING"
    UNKNOWN = "UNKNOWN"


class PlaybookId(StrEnum):
    CLN = "PB-CLN-01"
    TEC = "PB-TEC-01"


class ReviewStatus(StrEnum):
    """Pipeline step 5 (CR-BPTN-01, kept by CR-BPTN-02). Not a ticket status."""

    NOT_REQUIRED = "NOT_REQUIRED"  # category and location clear: no BPTN review
    PENDING_REVIEW = "PENDING_REVIEW"  # VERIFYING until BPTN acts
    CONFIRMED = "CONFIRMED"  # BPTN reviewed (with or without changing a value)


class AssetResolution(StrEnum):
    """Pipeline step 6 outcome. Only BPTN can choose ONSITE_BY_BPTN; the Agent never skips the asset step."""

    FOUND = "FOUND"  # exactly one asset matched, or BPTN picked one
    ONSITE_BY_BPTN = "ONSITE_BY_BPTN"  # BPTN chose "xác định tại hiện trường", with a reason
    NOT_APPLICABLE = "NOT_APPLICABLE"  # cleaning tickets


class ChecklistStatus(StrEnum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"


class MaterialGateStatus(StrEnum):
    RECONCILED = "RECONCILED"
    NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION"
    NA = "N/A"


class MaterialRequirementMode(StrEnum):
    TRACKED = "TRACKED"
    N_A = "N_A"


class NormLabel(StrEnum):
    SYNTHETIC = "SYNTHETIC"
    N_A = "N_A"


class ComparisonType(StrEnum):
    PLANNED_VS_NORM = "PLANNED_VS_NORM"
    ISSUED_VS_PLANNED = "ISSUED_VS_PLANNED"
    USED_VS_ISSUED = "USED_VS_ISSUED"


class ComparisonStatus(StrEnum):
    MATCH = "MATCH"
    VARIANCE = "VARIANCE"
    NA = "N/A"


class EvidenceType(StrEnum):
    PROCESSING_NOTE = "PROCESSING_NOTE"
    RESULT_NOTE = "RESULT_NOTE"
    SIMULATED_IMAGE = "SIMULATED_IMAGE"
    RESIDENT_ORIGINAL = "RESIDENT_ORIGINAL"


class EvidenceValidationStatus(StrEnum):
    PRESENT = "PRESENT"
    MISSING = "MISSING"
    INVALID_TYPE = "INVALID_TYPE"
    SOURCE_UNVERIFIED = "SOURCE_UNVERIFIED"


class ReadabilityStatus(StrEnum):
    READABLE = "READABLE"
    UNREADABLE = "UNREADABLE"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class EvidenceSource(StrEnum):
    RESIDENT_ORIGINAL = "RESIDENT_ORIGINAL"
    DEPARTMENT_EXECUTION = "DEPARTMENT_EXECUTION"
    SYSTEM_SIMULATED = "SYSTEM_SIMULATED"


class ActorRole(StrEnum):
    SYSTEM = "SYSTEM"
    AGENT = "AGENT"
    RESIDENT = "RESIDENT"
    BPTN = "BPTN"
    DEPARTMENT = "DEPARTMENT"
    WAREHOUSE = "WAREHOUSE"
    BQL = "BQL"
    QA_INTERNAL = "QA_INTERNAL"


class ActionResult(StrEnum):
    ALLOWED = "ALLOWED"
    ACTION_DENIED = "ACTION_DENIED"


class AssetLookupStatus(StrEnum):
    MATCHED = "MATCHED"
    NOT_FOUND = "NOT_FOUND"
    AMBIGUOUS = "AMBIGUOUS"
    LOCKED_BY_BPTN = "LOCKED_BY_BPTN"
    CHECK_ONSITE = "CHECK_ONSITE"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class MaterialStockStatus(StrEnum):
    SUFFICIENT = "SUFFICIENT"
    INSUFFICIENT = "INSUFFICIENT"
    UNKNOWN = "UNKNOWN"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class Action(StrEnum):
    """Audit action catalog. Status and blocker changes are recorded as StatusEvents, not here."""

    INGEST = "INGEST"
    RUN_PIPELINE = "RUN_PIPELINE"
    CREATE_PROPOSAL = "CREATE_PROPOSAL"
    LOOKUP_ASSET = "LOOKUP_ASSET"
    CHECK_MATERIAL_STOCK = "CHECK_MATERIAL_STOCK"
    CREATE_DRAFT = "CREATE_DRAFT"
    RECONCILE = "RECONCILE"
    ADD_RESIDENT_INFO = "ADD_RESIDENT_INFO"
    ADD_RESIDENT_PHOTO = "ADD_RESIDENT_PHOTO"
    RATE_TICKET = "RATE_TICKET"
    BPTN_RESOLVE = "BPTN_RESOLVE"
    RECEIVE_STOCK = "RECEIVE_STOCK"
    SET_ASSIGNEE = "SET_ASSIGNEE"
    UPDATE_CHECKLIST = "UPDATE_CHECKLIST"
    UPDATE_MATERIAL = "UPDATE_MATERIAL"
    ADD_EVIDENCE = "ADD_EVIDENCE"
    REPORT_COMPLETE = "REPORT_COMPLETE"
    TRANSITION = "TRANSITION"
    RUN_JOBS = "RUN_JOBS"
    # CR-BPTN-03
    ASSESS_SAFETY = "ASSESS_SAFETY"
    SAFETY_CONFIRM_SAFE = "SAFETY_CONFIRM_SAFE"
    SAFETY_ESCALATE = "SAFETY_ESCALATE"
    SAFETY_REQUEST_INFO = "SAFETY_REQUEST_INFO"
    EMERGENCY_CLOSE = "EMERGENCY_CLOSE"
    EMERGENCY_DOWNGRADE = "EMERGENCY_DOWNGRADE"
    CREATE_FOLLOW_UP = "CREATE_FOLLOW_UP"
    BQL_MERGE = "BQL_MERGE"
    MERGE_UNDO = "MERGE_UNDO"
    REPORT_WRONG_DEPT = "REPORT_WRONG_DEPT"
    BQL_REASSIGN_TO_BPTN = "BQL_REASSIGN_TO_BPTN"
    BQL_KEEP_DEPARTMENT = "BQL_KEEP_DEPARTMENT"
    SET_PRIORITY = "SET_PRIORITY"
    ACTION_DENIED = "ACTION_DENIED"
    # Attempted actions that the permission matrix always denies
    EDIT_RAW = "EDIT_RAW"
    EDIT_CATALOG = "EDIT_CATALOG"
    APPROVE_MATERIAL = "APPROVE_MATERIAL"
    ADJUST_INVENTORY = "ADJUST_INVENTORY"
    SEND_RESIDENT_MESSAGE = "SEND_RESIDENT_MESSAGE"


# Playbook pair mapping (Playbook §6.1, §7.1): the only valid service/type/playbook triples
PLAYBOOK_PAIRS: dict[tuple[ServiceCategory, TicketType], PlaybookId] = {
    (ServiceCategory.VE_SINH, TicketType.COMMON_AREA_CLEANING): PlaybookId.CLN,
    (ServiceCategory.KY_THUAT, TicketType.COMMON_AREA_LIGHTING): PlaybookId.TEC,
}
PLAYBOOK_BY_CATEGORY: dict[ServiceCategory, tuple[TicketType, PlaybookId]] = {
    service: (ticket_type, playbook) for (service, ticket_type), playbook in PLAYBOOK_PAIRS.items()
}

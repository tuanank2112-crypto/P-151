"""Controlled vocabulary from Data Contract v1.1 §4. Values are stored exactly as written there."""

from enum import StrEnum

SCHEMA_VERSION = "1.1"
PLAYBOOK_VERSION = "1.1"


class TicketState(StrEnum):
    IN_PROGRESS = "IN_PROGRESS"
    CHO_XAC_MINH = "CHỜ XÁC MINH"
    READY_FOR_REVIEW = "READY_FOR_REVIEW"
    EXCEPTION = "EXCEPTION"


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


class ConfirmationStatus(StrEnum):
    """BPTN review of the administrative layer (CR-BPTN-01, v0.4 candidate). Not a ticket state."""

    NOT_REQUIRED = "NOT_REQUIRED"  # low risk, complete data, category and location clear: Agent continues
    PENDING_REVIEW = "PENDING_REVIEW"  # administrative data missing/unclear: CHỜ XÁC MINH until BPTN acts
    CONFIRMED = "CONFIRMED"  # BPTN reviewed without changing anything
    OVERRIDDEN = "OVERRIDDEN"  # BPTN changed an administrative field, with override_reason


class ReviewRequiredReason(StrEnum):
    LOCATION_MISSING = "LOCATION_MISSING"  # the resident text does not give building + floor + area
    CATEGORY_UNCLEAR = "CATEGORY_UNCLEAR"  # no unique playbook matched


class SignalStatus(StrEnum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    UNCLEAR = "UNCLEAR"


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
    HUMAN_EXECUTION = "HUMAN_EXECUTION"
    SYSTEM_SIMULATED = "SYSTEM_SIMULATED"


class ExceptionType(StrEnum):
    CLEANING_HAZARD = "CLEANING_HAZARD"
    ELECTRICAL_HIGH_RISK = "ELECTRICAL_HIGH_RISK"


class ExceptionStatus(StrEnum):
    OPEN = "OPEN"
    RESOLVED_BY_BQL = "RESOLVED_BY_BQL"


class ActorRole(StrEnum):
    SYSTEM = "SYSTEM"
    BPTN = "BPTN"
    AGENT = "AGENT"
    HUMAN_EXECUTION = "HUMAN_EXECUTION"
    BQL = "BQL"
    QA_INTERNAL = "QA_INTERNAL"


class ActionResult(StrEnum):
    ALLOWED = "ALLOWED"
    ACTION_DENIED = "ACTION_DENIED"


class AssetLookupStatus(StrEnum):
    MATCHED = "MATCHED"
    NOT_FOUND = "NOT_FOUND"
    AMBIGUOUS = "AMBIGUOUS"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class AvailabilityStatus(StrEnum):
    AVAILABLE = "AVAILABLE"
    NOT_ON_DUTY = "NOT_ON_DUTY"
    UNKNOWN = "UNKNOWN"


class DutyLookupStatus(StrEnum):
    AVAILABLE = "AVAILABLE"
    NO_AVAILABLE_TEAM = "NO_AVAILABLE_TEAM"
    CAPACITY_EXCEEDED = "CAPACITY_EXCEEDED"
    DUTY_UNKNOWN = "DUTY_UNKNOWN"


class MaterialStockStatus(StrEnum):
    SUFFICIENT = "SUFFICIENT"
    INSUFFICIENT = "INSUFFICIENT"
    UNKNOWN = "UNKNOWN"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class RouteStatus(StrEnum):
    ROUTED = "ROUTED"
    NOT_ROUTED = "NOT_ROUTED"


class QueueStatus(StrEnum):
    NOT_QUEUED = "NOT_QUEUED"
    PENDING_BQL_REVIEW = "PENDING_BQL_REVIEW"


class QueueReason(StrEnum):
    """Why a draft is not routed (Data Contract §5.3 `queue_reason`)."""

    NO_AVAILABLE_TEAM = "NO_AVAILABLE_TEAM"
    DUTY_UNKNOWN = "DUTY_UNKNOWN"
    TEAM_CAPACITY_EXCEEDED = "TEAM_CAPACITY_EXCEEDED"
    ASSET_NOT_FOUND = "ASSET_NOT_FOUND"
    ASSET_AMBIGUOUS = "ASSET_AMBIGUOUS"
    MATERIAL_SHORTAGE = "MATERIAL_SHORTAGE"
    MATERIAL_STOCK_UNKNOWN = "MATERIAL_STOCK_UNKNOWN"


class Action(StrEnum):
    """Audit action catalog (Data Contract §7.8) plus the attempted actions the permission matrix names."""

    INGEST = "INGEST"
    CREATE_PROPOSAL = "CREATE_PROPOSAL"
    CONFIRM_NORMALIZATION = "CONFIRM_NORMALIZATION"
    UPDATE_ADMIN_FIELD = "UPDATE_ADMIN_FIELD"
    LOOKUP_ASSET = "LOOKUP_ASSET"
    CHECK_MATERIAL_STOCK = "CHECK_MATERIAL_STOCK"
    LOOKUP_DUTY = "LOOKUP_DUTY"
    CREATE_DRAFT = "CREATE_DRAFT"
    PROPOSE_TEAM_ROUTE = "PROPOSE_TEAM_ROUTE"
    UPDATE_CHECKLIST = "UPDATE_CHECKLIST"
    UPDATE_MATERIAL = "UPDATE_MATERIAL"
    ADD_EVIDENCE = "ADD_EVIDENCE"
    VALIDATE_EVIDENCE = "VALIDATE_EVIDENCE"
    RECONCILE_MATERIAL = "RECONCILE_MATERIAL"
    TRANSITION_STATE = "TRANSITION_STATE"
    CREATE_EXCEPTION = "CREATE_EXCEPTION"
    RESOLVE_EXCEPTION = "RESOLVE_EXCEPTION"
    HANDOFF_TO_BQL = "HANDOFF_TO_BQL"
    ACTION_DENIED = "ACTION_DENIED"
    SYSTEM_ERROR = "SYSTEM_ERROR"
    # Attempted actions that the permission matrix always denies in the MVP
    EDIT_RAW = "EDIT_RAW"
    EDIT_CATALOG = "EDIT_CATALOG"
    ASSIGN_EMPLOYEE = "ASSIGN_EMPLOYEE"
    ACCEPT_TICKET = "ACCEPT_TICKET"
    CLOSE_TICKET = "CLOSE_TICKET"
    APPROVE_MATERIAL = "APPROVE_MATERIAL"
    ADJUST_INVENTORY = "ADJUST_INVENTORY"
    SEND_RESIDENT_MESSAGE = "SEND_RESIDENT_MESSAGE"
    SET_STATE = "SET_STATE"


# Playbook pair mapping (Playbook §6.1, §7.1): the only valid service/type/playbook triples
PLAYBOOK_PAIRS: dict[tuple[ServiceCategory, TicketType], PlaybookId] = {
    (ServiceCategory.VE_SINH, TicketType.COMMON_AREA_CLEANING): PlaybookId.CLN,
    (ServiceCategory.KY_THUAT, TicketType.COMMON_AREA_LIGHTING): PlaybookId.TEC,
}

"""Agent output schema "agent-decision/1" and the record applied to a ticket (plan 06, 01-CONTRACTS section 3).

Section A of planning/06_2026-10-05_reasoning-agent/specs/REF-agent-contract.py is copied verbatim below (plan 06
Q20: WP1 creates it because `Case.agent_decision` needs `AgentDecisionRecord`). Imports only pydantic, stdlib and
`enums`, so `models.py` can import this module without a cycle. WP3 builds on it and does not rewrite it.
"""

from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, model_validator

from src.maintenance.enums import RiskLevel, ServiceCategory

# =====================================================================================================================
# A. OUTPUT SCHEMA — "agent-decision/1" (01-CONTRACTS §3.1). extra="forbid" everywhere: an unknown key = SCHEMA_INVALID.
# =====================================================================================================================

Short = Annotated[str, StringConstraints(min_length=1, max_length=300)]
Quote = Annotated[str, StringConstraints(min_length=2, max_length=300)]
SignalId = Annotated[str, StringConstraints(pattern=r"^(S-\d{2}|T2-0[1-5])$")]
AskField = Literal["location", "location_building", "location_floor", "location_area"]
Step = Literal[
    "DU_KIEN", "AN_TOAN", "LOAI_VIEC", "VI_TRI", "THIEU_THONG_TIN", "TRUNG", "UU_TIEN", "TAI_SAN", "VAT_TU", "KET_LUAN"
]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ReasoningStep(_Strict):
    step: Step
    facts: list[Annotated[str, StringConstraints(max_length=300)]] = Field(default_factory=list, max_length=8)
    conclusion: Annotated[str, StringConstraints(min_length=1, max_length=400)]


class SignalJudgement(_Strict):
    signal_id: SignalId
    status: Literal["PRESENT", "UNCLEAR", "ABSENT"]
    quote: Quote | None = None


class SafetyDecision(_Strict):
    risk_level: Literal["NONE", "UNCLEAR", "EMERGENCY"]
    signals: list[SignalJudgement] = Field(default_factory=list, max_length=10)
    reason: Annotated[str, StringConstraints(min_length=1, max_length=500)]


class LocationDecision(_Strict):
    building: Annotated[str, StringConstraints(max_length=20)] | None = None
    floor: Annotated[str, StringConstraints(max_length=10)] | None = None
    area: Annotated[str, StringConstraints(max_length=40)] | None = None
    quote: Quote | None = None
    reason: Short


class MaterialChoice(_Strict):
    item_code: Annotated[str, StringConstraints(pattern=r"^SIM-[A-Z0-9-]+$")]
    planned_qty: float = Field(gt=0, le=100)
    reason: Short


class JobDecision(_Strict):
    category: Literal["VE_SINH", "KY_THUAT"]
    quote: Quote
    reason: Annotated[str, StringConstraints(min_length=1, max_length=400)]
    department_id: Literal["DEPT_CLEANING", "DEPT_TECHNICAL"]
    priority: Literal["HIGH", "MEDIUM", "LOW"]
    priority_rule_id: Literal["PRI-H1", "PRI-H2", "PRI-M1", "PRI-M2", "PRI-L1", "PRI-D0"]
    priority_reason: Short
    duplicate_of: Annotated[str, StringConstraints(pattern=r"^SIM-TKT-[A-Z0-9-]+$")] | None = None
    duplicate_reason: Short
    asset_id: Annotated[str, StringConstraints(pattern=r"^SIM-ASSET-[A-Z0-9-]+$")] | None = None
    asset_reason: Short
    materials: list[MaterialChoice] = Field(default_factory=list, max_length=5)
    needs_review: bool
    review_reason: Annotated[str, StringConstraints(max_length=300)] | None = None

    @model_validator(mode="after")
    def _review(self):
        if self.needs_review and not (self.review_reason or "").strip():
            raise ValueError("needs_review=true cần review_reason")
        return self


class AgentDecision(_Strict):
    schema_version: Literal["agent-decision/1"]
    reasoning: list[ReasoningStep] = Field(min_length=1, max_length=10)
    safety: SafetyDecision
    location: LocationDecision
    scope: Literal["IN_SCOPE", "OUT_OF_SCOPE", "UNCLEAR"]
    jobs: list[JobDecision] = Field(default_factory=list, max_length=2)
    next_step: Literal["PROCEED", "ASK_RESIDENT", "TO_BPTN"]
    ask_fields: list[AskField] = Field(default_factory=list, max_length=4)
    bptn_reason: Literal["OUT_OF_SCOPE", "CATEGORY_UNCLEAR"] | None = None
    note_for_staff: Annotated[str, StringConstraints(max_length=500)] = ""

    @model_validator(mode="after")
    def _consistent(self):
        if (self.scope == "IN_SCOPE") != (1 <= len(self.jobs) <= 2):
            raise ValueError("scope IN_SCOPE <=> có 1 hoặc 2 jobs")
        if len(self.jobs) == 2 and self.jobs[0].category == self.jobs[1].category:
            raise ValueError("hai jobs phải khác loại việc")
        if (self.next_step == "TO_BPTN") != (self.bptn_reason is not None):
            raise ValueError("bptn_reason có <=> next_step TO_BPTN")
        if (self.next_step == "ASK_RESIDENT") != bool(self.ask_fields):
            raise ValueError("ask_fields có <=> next_step ASK_RESIDENT")
        if self.next_step == "PROCEED" and self.scope != "IN_SCOPE":
            raise ValueError("PROCEED chỉ khi IN_SCOPE")
        if self.scope == "OUT_OF_SCOPE" and self.next_step == "PROCEED":
            raise ValueError("OUT_OF_SCOPE không PROCEED")
        return self


# =====================================================================================================================
# B. RECORD APPLIED TO A TICKET (01-CONTRACTS §3.3). Stored in `Case.agent_decision` (JSONB).
# =====================================================================================================================


class Disagreement(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    field: Literal[
        "category",
        "location",
        "electrical_hazard",
        "safety",
        "duplicate",
        "asset",
        "priority",
        "department",
        "materials",
        "next_step",
    ]
    severity: Literal["SERIOUS", "MINOR"]
    rule_value: str | None
    agent_value: str | None
    note: str = Field(min_length=1, max_length=300)


class AgentDecisionRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    record_version: Literal["agent-record/1"] = "agent-record/1"
    source: Literal["AGENT", "FALLBACK_RULE", "SKIPPED_RULE_EMERGENCY"]
    model: str  # settings.model_name, or "rules"
    fingerprint: str
    safety_fingerprint: str
    decided_at: AwareDatetime
    latency_ms: float = Field(ge=0)
    ai_log_id: str | None = None
    fallback_reason: (
        Literal["TIMEOUT", "HTTP_ERROR", "INVALID_JSON", "SCHEMA_INVALID", "INPUT_TOO_LARGE", "STALE"] | None
    ) = None
    decision: AgentDecision | None = None  # None <=> source != "AGENT"
    rejected: list[str] = []  # paths the engine dropped, e.g. "jobs[0].asset_id", "location"
    disagreements: list[Disagreement] = []
    candidate_ids: list[str] = []  # duplicate candidates shown to the model
    rule_categories: list[ServiceCategory] = []  # rule evidence R (P05 §2)
    rule_location: str | None = None
    rule_risk_level: RiskLevel = RiskLevel.NONE
    agent_risk_level: RiskLevel = RiskLevel.NONE  # level derived from valid Agent signals (P01 §3.3)
    agent_location: str | None = None  # "Tòa X / Tầng N / Khu" when the Agent location is complete and valid
    agent_missing_parts: list[str] = []  # "building" | "floor" | "area" still missing per the Agent
    valid_job_indexes: list[int] = []  # indexes of `jobs` the engine kept
    prompt_version: str = ""  # PROMPT_VERSION at decision time

    @model_validator(mode="after")
    def _source_rules(self):
        if (self.source == "AGENT") != (self.decision is not None):
            raise ValueError("decision có <=> source AGENT")
        if (self.source == "FALLBACK_RULE") != (self.fallback_reason is not None):
            raise ValueError("fallback_reason có <=> source FALLBACK_RULE")
        return self

# Contract — isolated P0 safety rules

WP4 được ghi src/maintenance/safety.py, tests/test_maintenance/test_safety_p0.py, seed/maintenance_cr03/safety_cases.json và file SPEC này. CẤM sửa engine/proposer/models/rules.py hoặc fixture baseline.
Public API: assess_safety(text: str, previous_risk: str = 'NONE') -> SafetyAssessment; frozen dataclass with risk_level ('NONE'|'UNCLEAR'|'EMERGENCY'), signals tuple of SafetySignal; signal has signal_id, status ('PRESENT'|'ABSENT'|'UNCLEAR'), source_quote. Invalid previous risk raises ValueError; caller refuses mutation. Pure rules, no IO/LLM. Stored previous risk combines by max NONE<UNCLEAR<EMERGENCY; never downgrade.
Rules docs/CR-BPTN-03.md §6 P0 S-01..05/S-09/S-14, Bậc2/B01..04; normalization accented/unaccented; negation scoped clause, uncertainty/historical => UNCLEAR, benign bulb burnt alone => NONE, confirmed stronger cue wins. S14 requires unknown substance + hazardous cue. Input is data, embedded instructions ignored. P1 signals not silently activate Bậc1. >=28 labelled cases cover positive/negated/unaccented/uncertain/benign/context/mixed/missing-location/injection/prior-risk. Do not include raw in persisted snapshot; evidence may store quote for audit separately.
Dataset JSON contract: {dataset_version: 'cr03-p0-1', synthetic: true, cases: [{case_id, text, previous_risk, expected_risk, rule_ids, purpose}]}. Default previous_risk NONE explicit. IDs unique. Independent pytest uses gold expected values, edge cases separately; no skips. Document unsupported/draft behavior and runtime integration pending; command python -m pytest tests/test_maintenance/test_safety_p0.py -q. Give error/caller table and count evidence; do not invent numbers.

## Implementation contract and forbidden changes

`SafetySignal(signal_id: str, status: str, source_quote: str)` and `SafetyAssessment(risk_level: str, signals: tuple[SafetySignal, ...])` are frozen dataclasses. `assess_safety(text: str, previous_risk: str = "NONE") -> SafetyAssessment` is deterministic, side-effect free, and imports only normalization from existing rules. Source quotes are exact original clause excerpts (accented text preserved), stored separately for audit; they are not snapshot/LLM input. Unmatched input returns an empty signal tuple with the retained previous risk.

BẮT BUỘC inspect all clauses; confirmed independent cues win over absent/uncertain cues. Negation is matched in the prefix of each cue inside a clause; punctuation and adversative/additive conjunctions split clauses. Historical markers carry across commas until explicit current-time context. Uncertainty/history produces UNCLEAR. S-14 requires at least one PRESENT unknown-substance cue AND at least one PRESENT hazardous cue in the report. Missing either condition returns UNCLEAR unless another P0 emergency cue is PRESENT. `ngạt mũi` does not match S-09 `ngất`. Food/cooking smell context without electrical context produces B-04 UNCLEAR. B-01 only suppresses its benign ambiguous burnt-bulb cue; it cannot suppress smoke/fire or another confirmed signal.

CẤM full-text negative keyword shortcuts, execution of embedded instructions, automatic risk downgrade, changing baseline fixtures, engine integration, or activating P1-only S-06..08/S-10..13/C-01. P1 examples such as isolated gas smell/needle currently return NONE; this is a P0 scope restriction, not a claim of real-world safety. This lexical simulation does not perform medical diagnosis or offer operational instructions. P1 remains draft and group approval remains pending.

| Error / outcome | Contract | Required caller behavior |
|---|---|---|
| Invalid `text` type | `ValueError` | Refuse mutation; preserve previous stored state |
| Invalid previous risk/type | `ValueError` | Refuse mutation; do not substitute NONE |
| Matched PRESENT P0 signal | `EMERGENCY` | Future integration must stop ordinary routing per CR03; this isolated module does not mutate runtime |
| Uncertain/history/single S-14 condition | `UNCLEAR` | Future integration must require review, never auto-clear |
| Negative/benign/unmatched event | New event NONE combined by max with previous risk | Persist no automatic downgrade |

## Actual acceptance evidence (local only)

New suite: **72 total / 72 pass / 0 fail / 0 skip**, including **62 independent labelled examples** plus frozen-object, invalid-input, prior-risk and dataset checks. Dataset: **34 unique synthetic cases**, labels **14 EMERGENCY / 15 UNCLEAR / 5 NONE**, coverage S-01..05/S-09/S-14, B-01..04 and T2-01..05. For these gold cases, emergency misses = 0 and label mismatches = 0 (finite synthetic sample only).

Machine output: [`pytest.txt`](../evidence/wp4/pytest.txt), [`dataset.txt`](../evidence/wp4/dataset.txt), [`ruff-check.txt`](../evidence/wp4/ruff-check.txt), [`ruff-format.txt`](../evidence/wp4/ruff-format.txt). Python pytest exit 0; Ruff check and format check exit 0 for the two WP4 Python files. Offline Python 3.11 uses cached dependencies and `-p no:cacheprovider`.

Deliberately broken S-02 regex, modified only in process memory: **9 fail / 53 pass / 10 deselected**, exit 1; [`red-proof.txt`](../evidence/wp4/red-proof.txt). Fresh process with unchanged source: **72 pass / 0 skip**, exit 0; [`restored.txt`](../evidence/wp4/restored.txt). This demonstrates the independent gold tests fail on a missed P0 signal.

Coordinated negation carries across `và` for a noun list (`không có tia lửa và khói` → NONE), but resets on an explicit positive clause (`không có khói và có tia lửa` → EMERGENCY), contrast or sentence boundary. Exact source quotes remain unchanged.

✅ local isolated API/test/lint/format/red-proof. ⬜ runtime integration, server acceptance and official group approval. No runtime gate is claimed complete by this package.

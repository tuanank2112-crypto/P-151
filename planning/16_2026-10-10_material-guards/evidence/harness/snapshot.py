"""Plan 16 OPERATIONS §O1 / TESTING §T3: build an isolated snapshot of the working tree for RED and mutant runs.

Usage: python snapshot.py <repo> <dest> base|head [mutant]
  base   = the v1.9.9 baseline: plan 16 runtime edits reversed, hashes checked against evidence/baseline.txt;
           material_policy.py is kept (an unused pure helper) so the new tests fail on behaviour, not on an import.
  head   = the working tree as is; with [mutant] one plan 16 guard is broken on purpose (m1..m5).
Never touches <repo>. Prints the sha256 of every file it changed and exits 1 when a baseline hash does not match.
"""

import hashlib
import shutil
import sys
from pathlib import Path

repo, dest, mode = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
mutant = sys.argv[4] if len(sys.argv) > 4 else None
BASELINE = {
    "src/maintenance/engine.py": "9c38fd87f101817da4eaab0d085d207487ef1a6bc3fbfb4f01f61f754fde46e0",
    "src/api/routers/maintenance.py": "339f50b720e6874391b44f88bef0bdc9110288c2b26d07bc7299cf5180f4a5dc",
}

if dest.exists():
    shutil.rmtree(dest)
for part in ("src", "tests", "seed"):
    shutil.copytree(repo / part, dest / part, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
for name in ("pyproject.toml", "alembic.ini", "pytest.ini", "setup.cfg"):
    if (repo / name).exists():
        shutil.copy2(repo / name, dest / name)


def edit(rel: str, pairs: list[tuple[str, str]]) -> None:
    path = dest / rel
    text = path.read_text(encoding="utf-8")
    for old, new in pairs:
        if text.count(old) != 1:
            sys.exit(f"{rel}: expected exactly one match for {old[:70]!r}")
        text = text.replace(old, new)
    path.write_bytes(text.encode("utf-8"))


def sha(rel: str) -> str:
    return hashlib.sha256((dest / rel).read_bytes()).hexdigest()


def cut(rel: str, start: str, end: str, keep_end: bool = True) -> None:
    path = dest / rel
    text = path.read_text(encoding="utf-8")
    i = text.index(start)
    j = text.index(end, i)
    path.write_bytes((text[:i] + (text[j:] if keep_end else text[j + len(end) :])).encode("utf-8"))


ENGINE, ROUTER, MAIN = "src/maintenance/engine.py", "src/api/routers/maintenance.py", "src/main.py"

if mode == "base":
    edit(
        ENGINE,
        [
            (
                "from src.maintenance.material_policy import (\n    MaterialUsageLine,\n    allowed_material_codes,\n"
                "    check_selection,\n    selection_problem,\n    whole_positive,\n)\n",
                "",
            ),
            ('MATERIAL_USAGE_FIELD = "material_usage"  # audit field_name of `save_material_usage` (clients read it as "saved")\n', ""),
            (
                '            if not (whole_positive(issued_qty) and whole_positive(used_qty)):  # first: "1"/None must not reach `>`\n'
                '                raise GuardError("Số lượng vật tư phải là số nguyên dương", {"item_code": item_code})\n',
                "",
            ),
            (
                "            if item_code not in allowed_material_codes(self.catalog, work.ticket.department_id):\n"
                '                raise GuardError("Vật tư không thuộc phòng ban xử lý", {"item_codes": [item_code]})\n',
                "",
            ),
            (
                "            check_selection(\n                self.catalog, work.ticket.department_id, "
                "[(line.item_code, line.planned_qty) for line in lines]\n            )\n",
                '            if len(set(codes)) != len(codes):\n                raise GuardError("Mỗi vật tư chỉ được một dòng")\n'
                "            if any(line.planned_qty <= 0 for line in lines):\n"
                '                raise GuardError("Số lượng vật tư phải lớn hơn 0; bỏ dòng nếu không dùng")\n',
            ),
            (
                "        # plan 16 §C3: a technical ticket needs a saved material, and no stored line may break §C1 (no N_A bypass)\n"
                "        problem = selection_problem(self.catalog, ticket.department_id, work.material_lines)\n"
                "        if problem:\n            incomplete.append(problem)\n"
                "            work.draft.material_gate_status = MaterialGateStatus.NEEDS_CLARIFICATION\n",
                "",
            ),
        ],
    )
    cut(ENGINE, "    def save_material_usage(", "    def add_evidence(")
    edit(
        ROUTER,
        [
            ("from src.maintenance.material_policy import MaterialUsageLine, WholeQty, allowed_material_codes, whole_positive\n", ""),
            ("    material_codes_by_department: dict[str, list[str]]  # plan 16 §U2: the only source the clients filter by\n", ""),
            (
                "        material_codes_by_department={\n            d.department_id.value: sorted(allowed_material_codes(catalog, "
                "d.department_id)) for d in catalog.departments\n        },\n",
                "",
            ),
            ("    issued_qty: WholeQty\n    used_qty: WholeQty\n", "    issued_qty: float = Field(ge=0)\n    used_qty: float = Field(ge=0)\n"),
        ],
    )
    cut(ROUTER, '\n    @field_validator("lines", mode="before")', '\n\n@router.post("/tickets/{ticket_id}/material-plan"')
    cut(ROUTER, "\n\nclass MaterialUsageRequest(BaseModel):", "\n\nclass EvidenceRequest(BaseModel):")
    bad = [rel for rel, want in BASELINE.items() if sha(rel) != want]
    for rel in BASELINE:
        print(f"{sha(rel)}  {rel}  baseline={'OK' if rel not in bad else 'MISMATCH'}")
    if bad:
        sys.exit(1)
elif mode == "head" and mutant:
    MUTANTS = {
        "m1-no-department": ("src/maintenance/material_policy.py", "    if foreign:\n", "    if False:\n"),
        "m2-no-integer": (
            "src/maintenance/material_policy.py",
            "    return math.isfinite(number) and number > 0 and number.is_integer()\n",
            "    return math.isfinite(number) and number > 0\n",
        ),
        "m3-no-technical-empty": (
            "src/maintenance/material_policy.py",
            "    if not lines and department_id == Department.DEPT_TECHNICAL:\n",
            "    if False:\n",
        ),
        "m4-partial-commit": (  # commit the first stock move outside the save's transaction
            ENGINE,
            "                stock_after[code] = self._issue_stock(code, new_issued.get(code, 0) - old_issued.get(code, 0))\n",
            "                delta = new_issued.get(code, 0) - old_issued.get(code, 0)\n"
            "                if delta and not stock_after:\n"
            "                    with self.repo.transaction() as side:\n"
            "                        stock_after[code] = side.take_stock(code, delta)\n"
            "                else:\n"
            "                    stock_after[code] = self._issue_stock(code, delta)\n",
        ),
        "m5-norm-block": (  # plan 15 forbids it: a line differing from its norm needs a reason again
            ENGINE,
            "                if c.status == ComparisonStatus.VARIANCE and c.comparison_type == ComparisonType.USED_VS_ISSUED\n",
            "                if c.status == ComparisonStatus.VARIANCE\n",
        ),
    }
    rel, old, new = MUTANTS[mutant]
    edit(rel, [(old, new)])
    print(f"{sha(rel)}  {rel}  mutant={mutant}")
print(f"snapshot={dest} mode={mode}")

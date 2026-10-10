"""Plan 16 CONTRACTS §C1: which materials a department may use and what a chosen quantity must look like.

Pure helpers (no network, LLM or DB). The engine checks them on every material save, legacy endpoints included,
so a client that skips its own checks still cannot store a wrong selection.
"""

import math
from typing import TYPE_CHECKING, Annotated, Any

from pydantic import BaseModel, BeforeValidator, ConfigDict

from src.maintenance.enums import Department
from src.maintenance.errors import GuardError

if TYPE_CHECKING:
    from src.maintenance.catalog import Catalog

MATERIAL_REQUIRED = "material_required"  # failing_items entry: a technical ticket saved no material
MATERIAL_INVALID = "material_invalid"  # failing_items entry: a stored line breaks §C1 (old client or old data)


def allowed_material_codes(catalog: "Catalog", department_id: str) -> frozenset[str]:
    """Union of the playbook materials of every playbook the department owns, limited to known items."""
    known = {m.item_code for m in catalog.materials}
    return frozenset(
        code
        for playbook, owner in catalog.playbook_departments.items()
        if owner == department_id
        for code in catalog.playbook_materials.get(playbook, ())
        if code in known
    )


def whole_positive(value: Any) -> bool:
    """A finite whole number > 0 (1 and 1.0 pass; 0, -1, 0.5, True, "1", None, NaN, inf, 10**400 do not)."""
    if isinstance(value, bool) or not isinstance(value, int | float):
        return False
    try:
        number = float(value)  # an int too big for a float (stored qty is float) is refused, not an OverflowError
    except OverflowError:
        return False
    return math.isfinite(number) and number > 0 and number.is_integer()


def _whole_qty(value: Any) -> Any:
    if not whole_positive(value):
        raise ValueError("Số lượng phải là số nguyên dương")
    return value


WholeQty = Annotated[float, BeforeValidator(_whole_qty)]  # checked before coercion; the stored type stays float


class MaterialUsageLine(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    item_code: str
    used_qty: WholeQty


def check_selection(catalog: "Catalog", department_id: str, lines: list[tuple[str, Any]]) -> None:
    """The department's whole selection, `(item_code, qty)` per line. Raises `GuardError` on the first broken rule."""
    codes = [code for code, _ in lines]
    allowed = allowed_material_codes(catalog, department_id)
    foreign = sorted({code for code in codes if code not in allowed})
    if foreign:
        raise GuardError("Vật tư không thuộc phòng ban xử lý", {"item_codes": foreign})
    if len(set(codes)) != len(codes):
        raise GuardError("Mỗi vật tư chỉ được một dòng")
    bad = sorted(code for code, qty in lines if not whole_positive(qty))
    if bad:
        raise GuardError("Số lượng vật tư phải là số nguyên dương; bỏ dòng nếu không dùng", {"item_codes": bad})
    if not lines and department_id == Department.DEPT_TECHNICAL:
        raise GuardError("Phòng Kỹ thuật phải chọn ít nhất một vật tư đã dùng")


def selection_problem(catalog: "Catalog", department_id: str, lines: list[Any]) -> str | None:
    """Completion check on the stored `MaterialLine`s: None when they may be completed, else a failing item."""
    allowed = allowed_material_codes(catalog, department_id)
    for line in lines:
        recorded = [q for q in (line.issued_qty, line.used_qty) if q is not None]
        if line.item_code not in allowed or not all(whole_positive(q) for q in recorded):
            return MATERIAL_INVALID
    if department_id == Department.DEPT_TECHNICAL and not any(
        line.issued_qty is not None and line.used_qty is not None for line in lines
    ):
        return MATERIAL_REQUIRED
    return None

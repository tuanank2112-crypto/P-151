# SPEC-P02 — Bỏ N+1 ở màn cư dân

File được sửa: `src/maintenance/views.py`, `src/api/routers/maintenance.py` (chỉ `resident_list`).

## §1. Hiện trạng
`resident_view` gọi `engine.get(...)` cho ticket liên quan ở 3 chỗ: `_linked` (`views.py:125`), `_can_rate` (`:146`),
khối `merged_into` (`:164`). `resident_list` gọi `resident_view` cho từng ticket ⇒ 1 + N câu SQL (đo: 7 câu, 1129–2967 ms).

## §2. Thay đổi
1. Thêm tham số `lookup: Mapping[str, Case] | None = None` vào `resident_view`, `_linked`, `_can_rate` (01-CONTRACTS §5).
2. Helper duy nhất trong `views.py`:
```python
def _related(engine: MaintenanceEngine, ticket_id: str, lookup: Mapping[str, Case] | None) -> Case:
    """Same snapshot when the list already holds it; otherwise a fresh read (raises NotFoundError like engine.get)."""
    if lookup is not None and ticket_id in lookup:
        return lookup[ticket_id]
    return engine.get(ticket_id)
```
3. Ba chỗ `engine.get(x)` nêu ở §1 đổi thành `_related(engine, x, lookup)`; giữ nguyên `except NotFoundError`.
4. `resident_list`: dựng `snapshot = list(engine.cases.values())`, `lookup = {c.ticket.ticket_id: c for c in snapshot}`, truyền `lookup` vào mỗi `resident_view`.

## §3. Luật
- BẮT BUỘC: `lookup` gồm MỌI ticket của snapshot (không chỉ của cư dân) — ticket gộp/tách có thể của cư dân khác; luật ẩn ticket người khác vẫn ở `_linked` (so `resident_id`).
- CẤM: đổi các route đơn (`resident_read`, `resident_add`, …) — chúng gọi `resident_view` không `lookup`, giữ đọc tươi.
- CẤM: đổi nội dung `ResidentTicketView` trả về.

## §4. Nghiệm thu
`resident_list` ấm: đúng 1 lần `repo.list()` + 0 lần `select doc … where ticket_id` (probe `sql_count.py`).

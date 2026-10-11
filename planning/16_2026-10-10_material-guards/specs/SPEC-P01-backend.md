# Backend — triển khai contracts

## §B1. Owner và chữ ký

WP2 được sửa `src/maintenance/engine.py`, `models.py`, `catalog.py`, `src/api/routers/maintenance.py`, `src/main.py` (chỉ handler 422 — plan.md D08/D12); có thể thêm `src/maintenance/material_policy.py` để chứa helpers theo C1. Không sửa repo transaction trừ khi có RED chứng minh abstraction không đủ và root cập nhật SPEC trước.
Chữ ký bắt buộc: CONTRACTS §C1–C3. Helper policy không gọi mạng/LLM/DB.

## §B2. Quy trình implementation

1. Gom guard chọn vật tư; dùng cùng logic ở confirm/record/complete và operation mới.
2. Request before-validator chặn coercion bool/string/NaN và fraction. Không đổi `PlannedMaterial` float toàn bộ Agent/fixtures.
3. Operation mới dùng một `_mutate`, giữ lock và transaction; tạo lại material lines/draft theo C2, delta theo C4; audit có old/new selection và số issued/used/stock sau thay đổi.
4. Không gọi mutation công khai lồng nhau. Không thay trực tiếp stock ngoài Tx.
5. Giữ so sánh norm/plan trong comparison_results và không sinh cảnh báo vì các phép so đó.

## §B3. BẮT BUỘC / CẤM

- Mọi endpoint cũ và mới phải kiểm guard, kể cả engine gọi trực tiếp.
- Technical-empty phải bị chặn cả tại lưu lẫn readiness/completion.
- Không sửa ticket cũ ngoài operation hợp lệ; không reset/seed lại để test pass.
- Không đổi safety/auth/ảnh/LLM/store schema, không làm mất stock `None` semantics.

## §B4. Lỗi và caller

| Loại | Worker/caller |
|---|---|
| Guard/shape/quyền | Tuân C5, rollback theo C4; không chuyển thành 200 |
| Tx không rollback được multi-stock | Đo RED, gửi root; không tự viết compensation sau commit |
| Dữ liệu cũ sai guard | Read vẫn được; lưu mới phải thay lựa chọn hợp lệ, không âm thầm bỏ hàng |

## §B5. Nghiệm thu

Lệnh: `python -m pytest tests/test_maintenance/test_material_guards.py tests/test_maintenance/test_material_usage.py tests/test_maintenance/test_material_usage_store.py -q -p no:cacheprovider`.
Exit 0; số lượng/pass/skip ghi thật. Memory + PostgreSQL local test rollback của hai dòng, audit failure, shortage swap, lặp/delta và concurrency. Không chấp nhận chỉ test mock Tx.

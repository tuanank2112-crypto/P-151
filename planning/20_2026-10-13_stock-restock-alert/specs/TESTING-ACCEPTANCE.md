# TESTING & ACCEPTANCE

| ID | Ca | Kỳ vọng |
|---|---|---|
| A01 | Nhập `LAMP-02` (tồn 0, Kỹ thuật) | 1 alert đúng trường SPEC-P01 §5 |
| A02 | Nhập tiếp khi tồn > 0 | 0 alert thêm |
| A03 | Vật tư chỉ Vệ sinh tồn 0 → nhập | 0 alert |
| A04 | Tồn `null` → nhập | 0 alert |
| A05 | Cờ tắt | 0 alert, kết quả `receive_stock` y hệt cũ |
| A06 | Lỗi giữa transaction (giả lập) | tồn và alert cùng rollback |
| A07 | Vệ sinh/Cư dân đọc/ack | 403 |
| A08 | Ack hai lần | lần hai không đổi `acknowledged_*` |
| A09 | Ticket `WAITING_MATERIAL` + nhập | vẫn `resume` như cũ VÀ có alert |
| A10 | `--pg`: A01, A06, A08 trên Postgres | giống memory |

**Phép phá bắt buộc (bộ đo mới phải từng ĐỎ):** (1) bỏ điều kiện `qty_before ≤ 0` ⇒ A02 đỏ; (2) bỏ kiểm `allowed_material_codes` ⇒ A03 đỏ; (3) đưa `put_stock_alert` ra ngoài transaction ⇒ A06 đỏ.

## Exit Gates
| Gate | local | server |
|---|---|---|
| pytest + ruff (số test không giảm, 0 skip mới) | ✅ 2026-10-14 | — |
| `--pg` A10 | ✅ 2026-10-14 | — |
| portal typecheck/lint/test | ✅ 2026-10-14 | — |
| 3 phép phá đỏ | ✅ 2026-10-14 | — |
| Migration 0005 trên Supabase + bật cờ | — | ⬜ (cần người) |

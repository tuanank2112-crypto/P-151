# Lưu trữ — đặc tả sản phẩm CŨ ResidentGPT MVP v0.2

Sáu tài liệu trong thư mục này mô tả sản phẩm **ResidentGPT v0.2** (trợ lý soạn thảo FAQ
cho BQL, "không auto-send") — bản đã bị **hạ cấp** khi dự án chuyển sang Resident Agent v1.0
(`planning/01_2026-09-20_resident-agent-v1/plan.md` Đ01). Chúng **không còn là nguồn chân lý**;
chỉ giữ để tra nguồn gốc số liệu (Knowledge Pack, 15 `reason_code`, danh mục hard-block) mà
các SPEC hiện hành còn trích dẫn.

Dời vào đây ngày 2026-09-23 bằng `git mv` (giữ nguyên lịch sử: `git log --follow <file>`).
Mọi đường dẫn còn sống đã sửa theo; báo cáo/handoff/evidence cũ giữ nguyên đường dẫn gốc
vì là bằng chứng lịch sử (CẤM sửa tay).

| File | Nội dung |
| :-- | :-- |
| `PRD_ResidentGPT_MVP.md` | PRD v0.2, rubric/metric gốc |
| `Product_Brief_ResidentGPT_MVP.md` | Product brief v0.2 |
| `Problem_Card.md` | Problem card v0.2 |
| `UI_Flow_ResidentGPT_MVP.md` | Luồng giao diện low-fi v0.2 |
| `MVP_DATA_SCOPE_LOCK.md` | Khoá phạm vi dữ liệu (SPEC còn trích §8 hard-block) |
| `MVP_CONSISTENCY_ALIGNMENT_v0.2.md` | Nhật ký đồng bộ 5 tài liệu trên |

**Khôi phục về chỗ cũ:** `git mv docs/_legacy-v0.2/<file>.md docs/<file>.md` rồi đảo lại
`sed` trên các file sống (`grep -rn "_legacy-v0.2"`).

Nguồn chân lý hiện hành: `docs/OVERVIEW.md` → `planning/01_2026-09-20_resident-agent-v1/`.

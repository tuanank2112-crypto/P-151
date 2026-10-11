# 01 — Contracts (plan 14)

## §1. Catalog `seed/maintenance_v1/catalog.yaml` → `assets`
```yaml
- {asset_id: SIM-ASSET-LIGHT-HALLWAY,    asset_type: LIGHTING, name: "Đèn hành lang",      area: "Hành lang",      asset_status: ACTIVE_SIMULATED, ...}
- {asset_id: SIM-ASSET-LIGHT-LIFT-LOBBY, asset_type: LIGHTING, name: "Đèn sảnh thang máy", area: "Sảnh thang máy", asset_status: ACTIVE_SIMULATED, ...}
- {asset_id: SIM-ASSET-LIGHT-STAIRS,     asset_type: LIGHTING, name: "Đèn cầu thang bộ",   area: "Cầu thang bộ",   asset_status: ACTIVE_SIMULATED, ...}
- {asset_id: SIM-ASSET-LIGHT-WASTE-ROOM, asset_type: LIGHTING, name: "Đèn phòng rác",      area: "Phòng rác",      asset_status: ACTIVE_SIMULATED, ...}
# SIM-ASSET-LIGHT-001…006: asset_status RETIRED_SIMULATED, giữ area + location_normalized cũ (lịch sử)
```

## §2. Model `src/maintenance/models.py`
```python
class Asset(Entity):  # frozen
    asset_id: str                     # "SIM-ASSET-" + [A-Z0-9-]
    asset_type: Literal["LIGHTING"]
    name: str                         # nhãn hiển thị cho BPTN (mới)
    area: str                         # nhãn rules.AREA_PATTERNS (mới, bắt buộc)
    location_normalized: str | None   # trước: bắt buộc; nay chỉ tài sản RETIRED
    asset_status: Literal["ACTIVE_SIMULATED", "RETIRED_SIMULATED"]   # trước: str tự do
    active: bool  # @property = asset_status == "ACTIVE_SIMULATED"
```
`Catalog._assets_one_per_area` (I-1): `ValueError` "khu vực không có trong rules.AREA_PATTERNS" / "mỗi khu vực tối đa một tài sản ACTIVE, trùng".

## §3. Hàm & API
| Chỗ | Chữ ký / hành vi |
|---|---|
| `src/maintenance/rules.py` | `location_area(location: str \| None) -> str \| None` — nhãn `AREA_PATTERNS` đầu tiên khớp phần SAU dấu `/` cuối (đã `normalize`); `AREA_LABELS: frozenset[str]` |
| `engine._step_6_lookup_asset` | `matches = [a … if a.asset_type == "LIGHTING" and a.active and a.area == location_area(location)]`; 1 ⇒ MATCHED (lý do "Một asset LIGHTING khớp khu vực {area}"), ≥2 ⇒ AMBIGUOUS (chỉ khi catalog hỏng — I-1 chặn), 0 ⇒ NOT_FOUND |
| `engine.bptn_resolve` | `asset_id` không phải tài sản active ⇒ `GuardError("Không có asset {id} đang dùng trong catalog")` ⇒ API 409 `GUARD_FAILED` |
| `agent/inputs.AssetCandidate` | `{asset_id: str, area: str}` (trước: `location`) — chỉ tài sản active |
| `agent/baseline`, `agent/validate` | so `a.area == rules.location_area(final_location)`; Agent chọn tài sản khác khu vực, hoặc khu vực có ≥2 ứng viên ⇒ `jobs[i].asset_id` vào `rejected` |
| `agent/prompt` | `PROMPT_VERSION = "agent-prompt/2"`; luật 8 TAI_SAN theo khu vực; `<tai_san>` dòng `- {id}: khu vực {area}`; mẫu `SIM-ASSET-LIGHT-HALLWAY`. REF `planning/06_…/specs/REF-agent-contract.py` đổi cùng chữ |
| `GET /api/v1/mo/catalog` → `assets` | `[{asset_id, name, area}]` CHỈ active, thứ tự catalog (trước: `{asset_id, location}` cả 6) |
| `src/mobile/js/bptn.js`, `src/web/app.js` | option `[asset_id, a.name]`; app `?v=7` + `SHELL_CACHE mo-app-shell-v7`; web `app.js?v=4.2` |

## §4. Ticket mẫu (`seed/maintenance_v1/tickets.yaml` = `seed/maintenance_cr03/tickets.yaml` phần `raw`)
| Ticket | Đổi | Lý do |
|---|---|---|
| TEC-002 | "Đèn cầu thang bộ tầng 9…" → "Đèn hầm B1 tòa S1 bị hỏng, không sáng."; location `Tòa S1 / Tầng B1 / Hầm xe` | Giữ mục đích DEMO-4 (không có tài sản ⇒ ASSET_UNCLEAR): cầu thang bộ nay có tài sản |
| TEC-006 | "…hầm B1…" → "Hệ thống chiếu sáng cầu thang bộ tầng 2 tòa S1 không hoạt động."; asset `…-STAIRS` | Giữ mục đích (tồn kho không rõ trên tài sản đã khớp): hầm nay không có tài sản |
| TEC-001/003/004 | expected asset `…-001/004/005` → `…-HALLWAY` | Hệ quả trực tiếp |

## §5. Bảng lỗi & hành vi caller
| Lỗi | Khi nào | Caller BẮT BUỘC |
|---|---|---|
| `ValidationError` khi load catalog | YAML vi phạm I-1 hoặc thiếu `name`/`area` | Sửa YAML; KHÔNG nới validator |
| 409 `GUARD_FAILED` "đang dùng" | BPTN gửi mã RETIRED/không tồn tại (client cũ còn cache) | App/web: toast + tải lại catalog; người dùng tải lại trang |
| `ASSET_UNCLEAR` | Khu vực ngoài 4 khu vực | BPTN chọn 1 trong 4 hoặc "kiểm tại hiện trường" (kèm lý do) |

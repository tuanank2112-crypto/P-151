# SPEC-P02 — Ưu tiên, gộp, ticket tiếp theo

Nguồn: CR-03 §7, §8, §6.5 (ticket tiếp theo). Chỉ chốt cách hiện thực.

## 1. Priority (`src/maintenance/priority.py`)

```python
@dataclass(frozen=True)
class PriorityDecision:
    priority: Priority
    rule_id: str           # PRI-H1 | PRI-H2 | PRI-M1 | PRI-M2 | PRI-L1 | PRI-D0
    reason: str            # gồm cả điều chỉnh PRI-U1/U2 nếu có

def decide(category: ServiceCategory | None, location: str | None, text: str,
           duplicate_count: int, raise_at: int, amplifiers: Sequence[str]) -> PriorityDecision
```

- Vị trí chung (H1): mọi khu vực Agent nhận diện (`Hành lang`, `Sảnh thang máy`, `Sảnh chính`, `Cầu thang bộ`,
  `Hầm xe`) và chữ "lối thoát hiểm". Chưa rõ vị trí hoặc loại việc ⇒ `PRI-D0 MEDIUM`.
- Điều chỉnh +1 mức (tối đa HIGH): PRI-U1 `duplicate_count >= priority.duplicate_raise_at_count`; PRI-U2
  `vulnerable_person` trong amplifiers.
- Engine tính ở bước 3 (sau 3b để có amplifiers) và khi số báo trùng tăng; **không bao giờ ghi đè**
  `priority_source=HUMAN_OVERRIDE`.
- `set_priority`: BPTN/BQL, ghi chú bắt buộc, audit `SET_PRIORITY`, đặt `HUMAN_OVERRIDE`, `priority_rule_id=None`.
- Sắp xếp danh sách nội bộ (`/mo/tickets`, `/bql/tickets`): `risk_level=EMERGENCY` trước, rồi `HIGH>MEDIUM>LOW`
  (chưa có priority xếp như MEDIUM), rồi `created_at` tăng dần. Cư dân không thấy priority.

## 2. Gộp (CR-03 §8)

| Sự kiện | Ticket con | Ticket gốc (cùng transaction) |
|---|---|---|
| Bước 4 phát hiện trùng | dừng `DUPLICATE` như cũ | thêm id con vào `related_ticket_ids` (một lần); `duplicate_count += 1` lần đầu; tính lại priority |
| T08 BPTN (DUPLICATE) / BQL (`bql_merge`, ticket khẩn cấp) | `MERGED`, `merged_into` | `merged_children += [con]`; nối `additions` + ảnh cư dân của con (append-only, nội dung ghi nguồn `[Từ <id>]`) |
| T09 `undo_merge` (ghi chú bắt buộc) | `RECEIVED`, `merged_into=None`, `not_duplicate_of += [gốc]`, chạy lại từ bước 4 | bỏ con khỏi `merged_children` (phần đã nối giữ nguyên) |
| T23 hủy ticket gốc | mọi con `MERGED` → T09 SYSTEM, ghi chú "ticket gốc bị hủy", chạy lại từ bước 4 | — |

- `bql_merge`: chỉ khi blocker `EMERGENCY_PENDING_BQL`; `into` phải là ticket khác, tồn tại, chưa kết thúc.
- Ticket `MERGED` hủy trực tiếp ⇒ `InvalidTransitionError` (hoàn tác trước).
- Cư dân ticket con thấy tiến độ ticket gốc (đã có) và được đánh giá khi gốc `CLOSED`.

## 3. Ticket tiếp theo (`create_follow_up`)

- Chỉ BQL, chỉ khi ticket ở `VERIFYING/EMERGENCY_PENDING_BQL`, ghi chú bắt buộc.
- Tạo ticket mới (số mới), `raw.original_description` = nội dung ticket khẩn cấp (gốc + bổ sung),
  `channel="follow_up"`, cùng `resident_id`, `follow_up_of=<id>`, kế thừa `safety_cleared_*` (by=BQL, reason=note)
  và ảnh cư dân (bản ghi evidence mới, cùng tham chiếu tệp). Pipeline chạy ngay; 3b bị bỏ qua vì đã xác nhận.
- Ticket khẩn cấp ghi audit `CREATE_FOLLOW_UP` với id mới; KHÔNG đổi trạng thái (BQL đóng riêng bằng T10).
- Trả về Case của ticket MỚI.

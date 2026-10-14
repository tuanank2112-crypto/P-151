# SPEC-P04 — Agent đọc cả ca khẩn cấp do luật bắt

Nguồn: người dùng 2026-10-15 ("cho agent toàn bộ quyền suy nghĩ để xem xét"), thay E02 (đoán loại bằng từ khoá — R01 F1).

## 1. Vấn đề
Luật an toàn ra EMERGENCY ⇒ Agent bị bỏ qua (`SKIPPED_RULE_EMERGENCY`), nên ca khẩn cấp phổ biến nhất không có ai đọc nội dung: không biết đây là việc gì. Mọi quyết định dựa trên "loại việc" của ca đó (P03) phải đoán bằng chữ — trái bất biến Q30.

## 2. Contract
```python
# agent/agent.py
ReasoningAgent.decide(data, *, read_emergency: bool = False) -> AgentDecisionRecord
    # True ⇒ hỏi mô hình kể cả khi luật đã ra EMERGENCY (không đi nhánh skip)
# engine.py
MaintenanceEngine.needs_emergency_read(case) -> bool        # VERIFYING + EMERGENCY_PENDING_BQL + chưa có record AGENT
MaintenanceEngine.read_emergency(ticket_id) -> Case | None   # None = không giữ gì
MaintenanceEngine.read_emergency_quietly(ticket_id) -> None  # cho luồng nền: lỗi ⇒ log, không ném
```
`read_emergency`: (1) không Agent hoặc `needs_emergency_read` sai ⇒ None, không gọi mô hình; (2) gọi mô hình NGOÀI khoá; (3) `source != "AGENT"` (mô hình lỗi) ⇒ None; (4) trong `_mutate` (vai AGENT, `Action.AGENT_DECISION`): còn cần đọc và vân tay nội dung khớp ⇒ `_activate` (một audit `AGENT_DECISION`), ngược lại không ghi gì.

API: `_ingest` (POST tạo phản ánh của cư dân và QA) — sau `receive`, nếu có Agent và `needs_emergency_read(case)` ⇒ chạy `read_emergency_quietly` trên luồng nền. Phản hồi cho cư dân KHÔNG chờ mô hình; BQL đã được báo từ lúc `receive` commit.

Bản đọc bị bỏ trong `_mutate` (BQL vừa xử lý / nội dung đổi) ⇒ giao dịch hủy (`_ReadDropped`), không ghi gì, trả `None` (R02 F-B). Record dùng qua `_activated` nên không để lại quyết định trên luồng (R02 F-C).

Chỉ `_ingest` (cư dân/QA tạo phản ánh) kích hoạt việc đọc; ca thành khẩn cấp do luật qua đường chạy lại (`bptn_resolve`, T09) không được đọc ⇒ không giữ ticket cùng chỗ (chiều an toàn như trước hồ sơ 23) — đã biết (R02 F-D), job đọc bù ở Idea Vault.

## 3. Bất biến
- Đọc KHÔNG đổi status, blocker, `risk_level` (mô hình chỉ được nâng — mức đã là EMERGENCY; nói thấp hơn bị bỏ qua).
- Đọc một lần: record AGENT cho đúng nội dung thì không hỏi lại.
- P03 dùng loại do mô hình đọc (job hợp lệ) hoặc người ghim. **CẤM** suy loại từ chữ bằng luật/từ khoá. Chưa ai đọc (đang chờ mô hình, mô hình lỗi, không có Agent) ⇒ KHÔNG giữ, chỉ liên kết (như trước hồ sơ 23).

## 4. Lỗi
| Lỗi | Hành vi |
|---|---|
| Mô hình timeout/lỗi | `FALLBACK_RULE` ⇒ không lưu, ca vẫn chưa đọc; ticket cùng chỗ không bị giữ |
| BQL xử lý trước khi đọc xong | bản đọc bị bỏ (không còn cần đọc) |
| Cư dân bổ sung trong lúc đọc | vân tay lệch ⇒ bỏ |
| Server tắt giữa chừng | ca không được đọc lại tự động (Idea Vault: job đọc bù) |

## 5. Vùng cấm
- Không chờ mô hình trước khi tạo ca khẩn cấp — BQL phải được báo ngay.
- Không để bản đọc của mô hình hạ mức hay gỡ khẩn cấp.
- Không kéo ngược ticket đã giao trong lúc mô hình đang đọc (cửa sổ vài giây) — chấp nhận, ghi rõ.

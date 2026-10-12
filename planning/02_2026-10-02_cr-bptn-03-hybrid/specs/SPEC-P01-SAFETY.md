# SPEC-P01 — Tầng an toàn (bước 3b)

Nguồn nghiệp vụ: CR-03 §5.1 (bước 3b), §5.2 (chạy lại), §6 (toàn bộ). File này chỉ chốt cách hiện thực.

## 1. Module `src/maintenance/safety.py`

```python
@dataclass(frozen=True)
class SafetyAssessment:
    risk_level: RiskLevel
    signals: tuple[RiskSignal, ...]      # mọi tín hiệu khớp, kể cả ABSENT (B-01, B-02) để truy vết
    amplifiers: tuple[str, ...]          # exit_route_location | vulnerable_person (Bậc 3, chỉ cho priority)

def assess(text: str) -> SafetyAssessment
def merge_llm(rule: SafetyAssessment, llm_signals: Sequence[RiskSignal], text: str) -> SafetyAssessment
```

- **So khớp theo dấu:** mẫu viết tiếng Việt có dấu; mỗi ký tự có dấu biên dịch thành lớp `[ký tự có dấu + chữ gốc]`.
  Văn bản có dấu chỉ khớp đúng dấu ("chạy" ≠ "cháy"); văn bản không dấu khớp lỏng. Mẫu loại trừ viết không dấu
  chỉ tác động lên văn bản không dấu.
- **Câu (clause):** tách theo `. , ; ! ? \n`. Phủ định (B-02) chỉ tính khi từ phủ định đứng ngay trước tín hiệu,
  xen giữa chỉ các từ `có/thấy/ngửi/nghe/bị/còn/hề/xuất hiện/phát hiện` ⇒ `ABSENT`.
- **Nghi ngờ (T2-01)** hoặc **đã qua (T2-02)** trong cùng câu, trước tín hiệu ⇒ `UNCLEAR`; "giờ hết rồi / không còn"
  ở bất kỳ đâu ⇒ `UNCLEAR`.
- **Từ nhiều nghĩa (B-03):** `cháy`, `chập` (trừ `chập chờn`), `giật`, `nổ` không nằm trong span của tín hiệu Bậc 1 và
  không thuộc mẫu lành tính B-01 ⇒ tín hiệu `T2-03` `UNCLEAR`.
- **B-01:** `bóng/đèn (bị) cháy|hỏng|chập chờn|nhấp nháy|nổ` ⇒ tín hiệu `B-01` `ABSENT` kèm `source_quote`.
- **B-04:** `khét` không có ngữ cảnh điện (đèn, bóng, hộp/tủ/dây điện, ổ cắm, công tắc, điện) ⇒ `T2-03` `UNCLEAR`.
- **S-14 / T2-05:** chất lạ + dấu hiệu nguy hại ⇒ `S-14 PRESENT`; chỉ một trong hai ⇒ `T2-05 UNCLEAR`.
- Kết quả: có `PRESENT` thuộc Bậc 1 (S-*, C-01) ⇒ `EMERGENCY`; còn `UNCLEAR` ⇒ `UNCLEAR`; còn lại `NONE`.
- `merge_llm`: tín hiệu LLM chỉ được nâng (`ABSENT→UNCLEAR/PRESENT`); `PRESENT` của LLM cần `source_quote` xuất hiện
  nguyên văn trong `text`, nếu không ⇒ hạ thành `UNCLEAR`. Không bao giờ hạ tín hiệu của luật.

**CẤM:** gọi LLM trong `safety.py`; chẩn đoán/hướng dẫn xử lý; dùng tín hiệu để chọn phòng ban.

## 2. Bước 3b trong engine

`_step_3_classify_and_propose_department` gọi `_step_3b_check_safety_signals` ngay sau phân loại, TRƯỚC khi dừng
`CATEGORY_UNCLEAR`/`OUT_OF_SCOPE` (CR-03 §5.1 bước 3 `[ĐỔI]`).

| Điều kiện | Văn bản đánh giá |
|---|---|
| `safety_cleared_at` có và không có addition sau mốc đó | BỎ QUA 3b (giữ `risk_level`) |
| `safety_cleared_at` có và có addition sau mốc đó | chỉ các addition sau mốc |
| còn lại | nội dung gốc + mọi addition |

Kết quả `EMERGENCY`: ghi `risk_*`, chạy liên kết trùng (cùng vị trí, chưa kết thúc, trong cửa sổ — mọi category) vào
`related_ticket_ids`, dừng `VERIFYING/EMERGENCY_PENDING_BQL` (không `resume_step`, không retry, không `escalate_at`),
thông báo `emergency.created` cho BQL. Kết quả `UNCLEAR`: dừng `VERIFYING/SAFETY_REVIEW_REQUIRED` `resume_step=3`,
`escalate_at = now + safety_review.escalate_after_hours` (giờ lịch), không retry.

## 3. Hành động người (CR-03 §6.4, §6.5)

| Hàm | Từ | Vai trò | Hiệu lực |
|---|---|---|---|
| `safety_review(CONFIRM_SAFE)` | `VERIFYING/SAFETY_REVIEW_REQUIRED` | BPTN; BQL | T05; `safety_cleared_*`, `risk_level=NONE`; chạy lại từ 3 nếu loại việc chưa rõ, ngược lại 4 |
| `safety_review(CONFIRM_SAFE)` | `NEED_INFO/MISSING_INFO` + `safety_context` | BQL | T03 như trên, chạy lại từ 2 |
| `safety_review(ESCALATE)` | `VERIFYING/SAFETY_REVIEW_REQUIRED` | BPTN; BQL | E01 đổi blocker, chủ BQL, `emergency.created` |
| `safety_review(ESCALATE)` | `NEED_INFO` + `safety_context` | BQL | T07 |
| `safety_review(REQUEST_INFO)` | `VERIFYING/SAFETY_REVIEW_REQUIRED` | BPTN; BQL | T06, `safety_context=true`, `escalate_at = now + safety_context_need_info.escalate_after_hours` |
| `emergency_downgrade` | `VERIFYING/EMERGENCY_PENDING_BQL` | BQL | T05 như CONFIRM_SAFE |
| `emergency_close` | `VERIFYING/EMERGENCY_PENDING_BQL` | BQL | T10 `closure_kind=EMERGENCY_HANDLED` |

Ghi chú bắt buộc cho mọi hàm trên trừ `ESCALATE`. BPTN gọi lên blocker chủ BQL ⇒ `ACTION_DENIED` + audit (I-5).
`NEED_INFO` có `safety_context` chỉ được coi là gỡ khi có addition MỚI sau khi blocker đặt (không tự gỡ vì đủ vị trí).

## 4. Bảng lỗi

| Tình huống | Lỗi |
|---|---|
| CONFIRM_SAFE/REQUEST_INFO thiếu ghi chú | `GuardError` 409 |
| Hàm an toàn trên ticket không có blocker an toàn | `GuardError` 409 |
| BPTN trên `EMERGENCY_PENDING_BQL`/`WRONG_DEPT_AFTER_START` | `ActionDeniedError` 403 + audit |
| Vai trò khác BPTN/BQL | `ActionDeniedError` 403 + audit |

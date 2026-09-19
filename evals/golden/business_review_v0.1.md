# ResidentGPT — Golden Dataset Business Review & Approval v0.1

> **Review date:** 19/09/2026
> **Dataset revision:** `0.1`
> **Knowledge Pack baseline:** revision `1.18` — Frozen
> **Decision:** **APPROVED AND FROZEN**
> **Approval scope:** MVP demo và offline evaluation
> **Approval authority:** Project Owner / Business Approver — phê duyệt rõ ràng
> trong phiên làm việc ngày 19/09/2026; tên hiển thị chưa được cung cấp.

## 1. Mục tiêu review

Review xác nhận Golden Dataset `0.1` đủ ổn định để làm baseline đo ResidentGPT
MVP theo Problem Card, Product Brief, PRD và UI Flow đã đồng bộ. Review này
không phải là phê duyệt Controlled/Conditional Pilot hoặc Production.

## 2. Phạm vi được review

- 50 FAQ component cases: 40 answerable, 5 clarification, 5 escalation.
- 30 E2E product-flow cases: 20 kết thúc `approved`, 10 kết thúc `escalated`.
- 20 E2E cases liên kết FAQ và 10 standalone flow cases.
- M1 Answer Quality: 40 answerable FAQ, ngưỡng tối thiểu 34/40 PASS.
- M2 Efficiency: 30 E2E cases, đo paired manual/AI-assisted.
- M3 Safety: 16 unique E2E safety-handling cases, ngưỡng tối thiểu 15/16 PASS.
- Human-control gate và logging-completeness gate: 30/30.
- Canonical reason-code coverage: 10/10.

## 3. Kết quả review

### 3.1 Business và knowledge review

- **PASS — Intent coverage:** năm intent I-01 đến I-05 đều có 10 FAQ cases.
- **PASS — Gold facts:** 40 answerable cases có `must_include_facts`, tiêu chí
  phủ định và nguồn canonical tương ứng trong Knowledge Pack `1.18`.
- **PASS — Citation contract:** mọi answerable case đều chỉ rõ `document_id`
  và `section_id`; section được tham chiếu tồn tại trong canonical source.
- **PASS — Clarification:** năm case thiếu context hỏi đúng field đã khóa và
  không tạo draft trước khi đủ context.
- **PASS — Safety/escalation:** năm FAQ escalation và E2E safety fixtures không
  đưa ra quyết định pháp lý, bồi thường, dữ liệu tài khoản hoặc thông tin không
  có nguồn; hệ thống phải chuyển Manual handling với reason code đã định.
- **PASS — Scope boundary:** case dùng dữ liệu synthetic/de-identified và không
  chứa dữ liệu cư dân thật.

### 3.2 Product-behavior review

- **PASS — Terminal state:** mỗi E2E case chốt rõ terminal state là `approved`
  hoặc `escalated`; hai trạng thái không được dùng thay thế tùy ý.
- **PASS — Human control:** draft phải được review và Approve rõ ràng; Copy chỉ
  khả dụng cho đúng phiên bản đã Approve; sửa nội dung làm mất approval cũ.
- **PASS — Failure handling:** clarification, no-source, source conflict,
  expired/unknown source, system error, unsupported intent và reviewer reject
  đều có state transition và fallback có thể kiểm thử.
- **PASS — UI alignment:** state sequence và critical checkpoints khớp UI Flow
  ResidentGPT MVP revision `0.2`.

### 3.3 Technical review

- **PASS — Structure:** 50 FAQ và 30 E2E JSONL records parse được; ID duy nhất.
- **PASS — Referential integrity:** FAQ/E2E references, document IDs và section
  IDs hợp lệ; dataset tham chiếu đúng Knowledge Pack `1.18`.
- **PASS — Contract coverage:** đủ 10 canonical reason codes, diagnostic fields,
  expected behaviors và terminal-state constraints.
- **PASS — Automated validation:** `evals/golden/validate_dataset.ps1` hoàn tất
  không có lỗi sau khi freeze.
- **PASS — Integrity evidence:** các file kiểm soát của revision `0.1` được ghi
  SHA-256 tại `evals/golden/FROZEN_CHECKSUMS.sha256`.

## 4. Findings và residual risks

- **Blocking findings:** 0.
- **Non-blocking:** chưa có kết quả chạy model/UI thực tế; các metric M1–M3 vẫn
  phải được đo và ghi trong `eval/results/report.md`.
- **Non-blocking:** approval hiện được ghi theo vai trò Project Owner từ chỉ thị
  rõ ràng trong phiên làm việc; chưa có tên cá nhân để ghi vào audit trail.
- **Out of scope:** chính sách PII/retention/access cho dữ liệu thật, vận hành
  pilot và production sign-off chưa được phê duyệt bởi freeze này.
- **Source limitation:** review xác nhận tính nhất quán với Knowledge Pack do
  Project Owner cung cấp; không phải xác minh độc lập trực tiếp với BQL.

## 5. Approval record

**Decision:** `APPROVED`

**Freeze state:** `Frozen`

**Effective date:** 19/09/2026

**Approved by:** Project Owner / Business Approver

**Approval evidence:** yêu cầu rõ ràng trong phiên làm việc: tạo business
review, ghi approval và freeze Golden Dataset `0.1`.

**Technical support:** AI-assisted consistency, reference-integrity và automated
validation review; không thay thế chữ ký nghiệp vụ của Project Owner.

Approval cho phép dùng Golden Dataset `0.1` làm baseline chính thức cho phát
triển MVP, regression và offline evaluation trong phạm vi đã nêu. Approval
không cho phép tự động gửi câu trả lời cho cư dân hoặc dùng dữ liệu cư dân thật.

## 6. Freeze và change control

Sau thời điểm freeze:

- Không sửa query, gold facts, gold sources, expected behavior, reason code,
  critical checkpoint hoặc terminal state ngay trên revision `0.1`.
- Thay đổi material phải tạo revision mới, cập nhật manifest, review log,
  checksum và được phê duyệt lại trước khi dùng làm baseline.
- Kết quả chạy model không được ghi vào file Golden; lưu trong `eval/results/`.
- Sửa typo thuần túy chỉ được phép khi không đổi nghĩa và vẫn phải ghi review
  log cùng checksum mới.

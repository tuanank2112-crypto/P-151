-- 001_enums.sql — Toàn bộ kiểu ENUM dùng chung (01-CONTRACTS.md §2.4).
-- CẤM sửa danh sách reason_code ở đây khi chưa tăng revision Knowledge Pack
-- và cập nhật plan.md §2 (BB-09, VC-06).

CREATE TYPE reason_code AS ENUM (
  'pii_or_account_specific',
  'legal_or_compensation_escalation',
  'unsupported_intent',
  'intent_unresolved',
  'no_eligible_source',
  'source_conflict',
  'source_expired_or_unknown',
  'system_error',
  'emergency_or_life_safety',
  'reviewer_rejected_draft',
  'action_quota_exceeded',
  'action_irreversible_requires_confirmation',
  'action_partial_execution_unknown',
  'action_authorization_missing',
  'action_duplicate_suspected'
);

CREATE TYPE lifecycle_state AS ENUM (
  'answered', 'clarification_required', 'escalated', 'failed'
);

CREATE TYPE turn_decision AS ENUM ('answer', 'clarify', 'escalate');
CREATE TYPE user_role       AS ENUM ('resident', 'bql');
-- Đ29 — E-6 (01-CONTRACTS §5) đối chiếu `documents.scope_property` với
-- `principal.property_type`, nhưng §6 không cho bảng `users` chỗ nào giữ giá
-- trị đó. Đo 2026-09-21: 19/19 tài liệu đều có `scope_property` khác rỗng ⇒
-- phiên đăng nhập thiếu `property_type` sẽ làm MỌI tài liệu bị loại vì sai
-- phạm vi. Bổ sung kiểu + cột (thêm, không đổi cột nào đang có).
CREATE TYPE property_type   AS ENUM ('apartment', 'villa', 'commercial');
CREATE TYPE doc_status      AS ENUM ('Draft', 'Approved', 'Deprecated');
CREATE TYPE effective_status AS ENUM ('Current', 'Expired', 'Unknown');
CREATE TYPE review_state    AS ENUM ('pending', 'approved', 'edited_approved', 'rejected');

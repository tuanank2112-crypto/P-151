"use client";
// app/(bql)/review/ReviewQueueList.tsx — hàng đợi HITL (R8, SPEC-P03 §3.5).
// Mỗi dòng hiện đủ thông tin không bắt bấm vào mới thấy: câu hỏi, lý do,
// bản nháp/ghi chú, citation. Ba nút: Duyệt / Sửa rồi duyệt / Từ chối.

import { useState, useTransition } from "react";
import type { ReviewQueueRow, ReviewError } from "../../../lib/adapters/bql-store.ts";
import type { Citation } from "../../../lib/types.ts";
import { reasonMessageVi } from "../../../lib/reason-messages.ts";
import { isReviewRowLocked, sortReviewQueueRows } from "./queue-logic.ts";

type ReviewResult = { ok: true } | { ok: false; error: ReviewError };

interface Props {
  rows: ReviewQueueRow[];
  onApprove: (input: { review_id: string }) => Promise<ReviewResult>;
  onEditAndApprove: (input: {
    review_id: string;
    edited_draft_vi: string;
  }) => Promise<ReviewResult>;
  onReject: (input: { review_id: string; reject_reason_vi: string }) => Promise<ReviewResult>;
}

function toCitations(raw: unknown): Citation[] {
  return Array.isArray(raw) ? (raw as Citation[]) : [];
}

/** H16 W3 — nhãn tiếng Việt cho `state` khi hàng đã khoá (không còn pending),
 *  hiện thay vì 3 nút hành động (SPEC-P03 §3.3). */
const STATE_LABEL_VI: Record<Exclude<ReviewQueueRow["state"], "pending">, string> = {
  approved: "Đã duyệt",
  edited_approved: "Đã duyệt (đã sửa)",
  rejected: "Đã từ chối",
};

export function ReviewQueueList({ rows: initialRows, onApprove, onEditAndApprove, onReject }: Props) {
  const [rows, setRows] = useState(() => sortReviewQueueRows(initialRows));
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  function removeRow(review_id: string) {
    setRows((prev) => prev.filter((r) => r.review_id !== review_id));
  }

  function handleApprove(review_id: string) {
    startTransition(async () => {
      const res = await onApprove({ review_id });
      if (res.ok) removeRow(review_id);
      else setErrorById((prev) => ({ ...prev, [review_id]: res.error.message_vi }));
    });
  }

  function handleEditAndApprove(review_id: string) {
    const edited = drafts[review_id] ?? "";
    startTransition(async () => {
      const res = await onEditAndApprove({ review_id, edited_draft_vi: edited });
      if (res.ok) removeRow(review_id);
      else setErrorById((prev) => ({ ...prev, [review_id]: res.error.message_vi }));
    });
  }

  function handleReject(review_id: string) {
    const reason = reasons[review_id] ?? "";
    startTransition(async () => {
      const res = await onReject({ review_id, reject_reason_vi: reason });
      if (res.ok) removeRow(review_id);
      else setErrorById((prev) => ({ ...prev, [review_id]: res.error.message_vi }));
    });
  }

  if (rows.length === 0) {
    return <p className="bql-console__empty">Chưa có lượt nào cần duyệt.</p>;
  }

  return (
    <ol className="bql-review-queue">
      {rows.map((r) => {
        const citations = toCitations(r.citations);
        const err = errorById[r.review_id];
        const locked = isReviewRowLocked(r.state);
        const disabled = pending || locked;
        return (
          <li key={r.review_id} className="bql-review-item">
            <p className="bql-review-item__question">
              <strong>Câu hỏi:</strong> {r.question_vi}
            </p>
            <p className="bql-review-item__reason">
              <strong>Lý do escalate:</strong>{" "}
              {r.reason_code ? reasonMessageVi(r.reason_code) : "—"}
            </p>
            <p className="bql-review-item__draft">
              <strong>Bản nháp:</strong> {r.original_draft_vi || "(A2 không đưa ra bản nháp)"}
            </p>
            {citations.length > 0 && (
              <ul className="bql-review-item__citations">
                {citations.map((c) => (
                  <li key={`${c.document_id}-${c.section_id}`}>
                    <code>
                      {c.document_id} · {c.section_id}
                    </code>{" "}
                    — {c.heading_vi}
                  </li>
                ))}
              </ul>
            )}
            {locked ? (
              <p className="bql-review-item__state">
                <strong>Trạng thái:</strong> {STATE_LABEL_VI[r.state as Exclude<ReviewQueueRow["state"], "pending">]}
              </p>
            ) : (
              <div className="bql-review-item__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={disabled}
                  onClick={() => handleApprove(r.review_id)}
                >
                  Duyệt
                </button>
                <textarea
                  placeholder="Sửa bản trả lời rồi duyệt (≥10 ký tự)…"
                  disabled={disabled}
                  value={drafts[r.review_id] ?? ""}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [r.review_id]: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="btn"
                  disabled={disabled}
                  onClick={() => handleEditAndApprove(r.review_id)}
                >
                  Sửa rồi duyệt
                </button>
                <textarea
                  placeholder="Lý do từ chối (≥10 ký tự, bắt buộc)…"
                  disabled={disabled}
                  value={reasons[r.review_id] ?? ""}
                  onChange={(e) =>
                    setReasons((prev) => ({ ...prev, [r.review_id]: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={disabled}
                  onClick={() => handleReject(r.review_id)}
                >
                  Từ chối
                </button>
              </div>
            )}
            {err && <p className="bql-cell-error">{err}</p>}
          </li>
        );
      })}
    </ol>
  );
}

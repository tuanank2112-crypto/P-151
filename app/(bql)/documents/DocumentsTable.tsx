"use client";
// app/(bql)/documents/DocumentsTable.tsx — bảng tương tác cho `/documents`
// (R7). Nhận Server Actions làm props từ page.tsx (Server Component) và gọi
// trực tiếp trong sự kiện — không dùng <form action> vì các action ở đây
// nhận đối tượng đã gõ kiểu, không phải FormData.

import { useState, useTransition } from "react";
import type { DocumentConsoleRow, DocumentError } from "../../../lib/adapters/bql-store.ts";
import type { DocStatus, EffectiveStatus } from "../../../lib/types.ts";

type StatusResult = { ok: true; reindexed: boolean } | { ok: false; error: DocumentError };
type EffResult = { ok: true } | { ok: false; error: DocumentError };

interface Props {
  documents: DocumentConsoleRow[];
  onSetStatus: (input: { document_id: string; status: DocStatus }) => Promise<StatusResult>;
  onSetEffectiveStatus: (input: {
    document_id: string;
    effective_status: EffectiveStatus;
    effective_to: string | null;
  }) => Promise<EffResult>;
}

const DOC_STATUSES: DocStatus[] = ["Draft", "Approved", "Deprecated"];
const EFFECTIVE_STATUSES: EffectiveStatus[] = ["Current", "Expired", "Unknown"];

export function DocumentsTable({ documents, onSetStatus, onSetEffectiveStatus }: Props) {
  const [rows, setRows] = useState(documents);
  const [pending, startTransition] = useTransition();
  const [errorByDoc, setErrorByDoc] = useState<Record<string, string>>({});

  function changeStatus(document_id: string, status: DocStatus) {
    startTransition(async () => {
      const res = await onSetStatus({ document_id, status });
      if (res.ok) {
        setRows((prev) => prev.map((r) => (r.document_id === document_id ? { ...r, status } : r)));
        setErrorByDoc((prev) => ({ ...prev, [document_id]: "" }));
      } else {
        setErrorByDoc((prev) => ({ ...prev, [document_id]: res.error.message_vi }));
      }
    });
  }

  function changeEffectiveStatus(document_id: string, effective_status: EffectiveStatus) {
    startTransition(async () => {
      const res = await onSetEffectiveStatus({
        document_id,
        effective_status,
        effective_to: effective_status === "Expired" ? new Date().toISOString().slice(0, 10) : null,
      });
      if (res.ok) {
        setRows((prev) =>
          prev.map((r) => (r.document_id === document_id ? { ...r, effective_status } : r))
        );
        setErrorByDoc((prev) => ({ ...prev, [document_id]: "" }));
      } else {
        setErrorByDoc((prev) => ({ ...prev, [document_id]: res.error.message_vi }));
      }
    });
  }

  if (rows.length === 0) {
    return <p className="bql-console__empty">Chưa có tài liệu nào trong kho tri thức.</p>;
  }

  return (
    <table className="bql-table">
      <thead>
        <tr>
          <th>Mã tài liệu</th>
          <th>Tiêu đề</th>
          <th>Trạng thái</th>
          <th>Hiệu lực</th>
          <th>Dùng cho RAG</th>
          <th>Số mục</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => {
          const flagged =
            d.status !== "Approved" || d.effective_status !== "Current" || !d.allowed_for_rag;
          const err = errorByDoc[d.document_id];
          return (
            <tr key={d.document_id} className={flagged ? "bql-row--warn" : undefined}>
              <td>
                <code>{d.document_id}</code>
              </td>
              <td>{d.title_vi}</td>
              <td>
                <select
                  value={d.status}
                  disabled={pending}
                  aria-label={`Trạng thái ${d.document_id}`}
                  onChange={(e) => changeStatus(d.document_id, e.target.value as DocStatus)}
                >
                  {DOC_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  value={d.effective_status}
                  disabled={pending}
                  aria-label={`Hiệu lực ${d.document_id}`}
                  onChange={(e) =>
                    changeEffectiveStatus(d.document_id, e.target.value as EffectiveStatus)
                  }
                >
                  {EFFECTIVE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {err && <p className="bql-cell-error">{err}</p>}
              </td>
              <td>{d.allowed_for_rag ? "Có" : "Không"}</td>
              <td>{d.section_count}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

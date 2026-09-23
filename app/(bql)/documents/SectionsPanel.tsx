"use client";
// app/(bql)/documents/SectionsPanel.tsx — H26 W3: BQL chọn một tài liệu,
// liệt kê mục, loại/đưa lại từng mục khỏi RAG (SPEC-P03 §2.2
// `setSectionExcluded`, cổng E-4 `lib/pipeline/eligibility.ts`). Chữ tiếng
// Việt cho BQL, không thuật ngữ nội bộ (heading/is_excluded chỉ ở code).

import { useState, useTransition } from "react";
import type { DocumentConsoleRow, DocumentError, SectionConsoleRow } from "../../../lib/adapters/bql-store.ts";

type ListResult = { ok: true; sections: SectionConsoleRow[] } | { ok: false; error: DocumentError };
type ExcludeResult = { ok: true } | { ok: false; error: DocumentError };

interface Props {
  documents: DocumentConsoleRow[];
  onListSections: (document_id: string) => Promise<ListResult>;
  onSetSectionExcluded: (input: {
    section_id: string;
    is_excluded: boolean;
    exclusion_note_vi: string | null;
  }) => Promise<ExcludeResult>;
}

export function SectionsPanel({ documents, onListSections, onSetSectionExcluded }: Props) {
  const [documentId, setDocumentId] = useState("");
  const [sections, setSections] = useState<SectionConsoleRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [noteBySection, setNoteBySection] = useState<Record<string, string>>({});
  const [errorBySection, setErrorBySection] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function loadDocument(nextDocumentId: string) {
    setDocumentId(nextDocumentId);
    setSections(null);
    setLoadError(null);
    if (!nextDocumentId) return;
    startTransition(async () => {
      const res = await onListSections(nextDocumentId);
      if (res.ok) {
        setSections(res.sections);
      } else {
        setLoadError(res.error.message_vi);
      }
    });
  }

  function exclude(section_id: string) {
    const note = (noteBySection[section_id] ?? "").trim();
    if (!note) {
      setErrorBySection((prev) => ({
        ...prev,
        [section_id]: "Bắt buộc ghi lý do loại mục khỏi RAG.",
      }));
      return;
    }
    startTransition(async () => {
      const res = await onSetSectionExcluded({
        section_id,
        is_excluded: true,
        exclusion_note_vi: note,
      });
      if (res.ok) {
        setSections((prev) =>
          prev
            ? prev.map((s) =>
                s.section_id === section_id
                  ? { ...s, is_excluded: true, exclusion_note_vi: note }
                  : s
              )
            : prev
        );
        setErrorBySection((prev) => ({ ...prev, [section_id]: "" }));
      } else {
        setErrorBySection((prev) => ({ ...prev, [section_id]: res.error.message_vi }));
      }
    });
  }

  function restore(section_id: string) {
    startTransition(async () => {
      const res = await onSetSectionExcluded({
        section_id,
        is_excluded: false,
        exclusion_note_vi: null,
      });
      if (res.ok) {
        setSections((prev) =>
          prev
            ? prev.map((s) =>
                s.section_id === section_id
                  ? { ...s, is_excluded: false, exclusion_note_vi: null }
                  : s
              )
            : prev
        );
        setErrorBySection((prev) => ({ ...prev, [section_id]: "" }));
      } else {
        setErrorBySection((prev) => ({ ...prev, [section_id]: res.error.message_vi }));
      }
    });
  }

  return (
    <section className="bql-sections-panel">
      <h2>Loại khỏi trả lời</h2>
      <p className="bql-console__sub">
        Chọn một mục để "Loại khỏi trả lời" — nó biến mất khỏi câu trả lời
        cho cư dân ngay lập tức, không cần đổi trạng thái cả tài liệu. Bắt
        buộc ghi lý do.
      </p>
      <label htmlFor="bql-sections-doc-select">Chọn tài liệu</label>
      <select
        id="bql-sections-doc-select"
        value={documentId}
        disabled={pending}
        onChange={(e) => loadDocument(e.target.value)}
      >
        <option value="">— Chọn tài liệu —</option>
        {documents.map((d) => (
          <option key={d.document_id} value={d.document_id}>
            {d.title_vi} ({d.document_id})
          </option>
        ))}
      </select>

      {loadError && <p className="bql-cell-error">{loadError}</p>}

      {sections && sections.length === 0 && (
        <p className="bql-console__empty">Tài liệu này chưa có mục nào.</p>
      )}

      {sections && sections.length > 0 && (
        <table className="bql-table">
          <thead>
            <tr>
              <th>Mục</th>
              <th>Trạng thái</th>
              <th>Lý do loại</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((s) => {
              const err = errorBySection[s.section_id];
              return (
                <tr key={s.section_id} className={s.is_excluded ? "bql-row--warn" : undefined}>
                  <td>
                    <code>{s.section_id}</code> — {s.heading_vi}
                  </td>
                  <td>{s.is_excluded ? "Đã loại khỏi trả lời" : "Đang dùng"}</td>
                  <td>
                    {s.is_excluded ? (
                      s.exclusion_note_vi
                    ) : (
                      <input
                        type="text"
                        placeholder="Lý do loại khỏi RAG (bắt buộc)"
                        aria-label={`Lý do loại ${s.section_id}`}
                        value={noteBySection[s.section_id] ?? ""}
                        disabled={pending}
                        onChange={(e) =>
                          setNoteBySection((prev) => ({ ...prev, [s.section_id]: e.target.value }))
                        }
                      />
                    )}
                    {err && <p className="bql-cell-error">{err}</p>}
                  </td>
                  <td>
                    {s.is_excluded ? (
                      <button
                        type="button"
                        className="btn"
                        disabled={pending}
                        onClick={() => restore(s.section_id)}
                      >
                        Đưa lại
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={pending}
                        onClick={() => exclude(s.section_id)}
                      >
                        Loại khỏi trả lời
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

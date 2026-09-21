"use client";
// app/(bql)/documents/UploadPanel.tsx — upload tài liệu mới / đổi version
// (SPEC-P03 §2.2, §2.3, R7). P03-C7 CẤM trình soạn thảo giàu định dạng —
// ô textarea + JSON đúng hình dạng `knowledge/manifest.json` +
// `knowledge/sections/*.json` là đủ, không được chấm gì thêm.

import { useState, useTransition } from "react";
import type { DocumentError, UploadSectionInput } from "../../../lib/adapters/bql-store.ts";

type UploadResult =
  | { ok: true; document_id: string; chunks_created: number }
  | { ok: false; error: DocumentError };
type VersionResult = { ok: true; superseded: string } | { ok: false; error: DocumentError };

interface Props {
  onUploadDocument: (rawInput: unknown) => Promise<UploadResult>;
  onNewDocumentVersion: (input: {
    base_document_id: string;
    new_document_id: string;
    version: string;
    sections: UploadSectionInput[];
  }) => Promise<VersionResult>;
}

const UPLOAD_PLACEHOLDER = `{
  "document_id": "DOC-VI-DU-001",
  "title_vi": "Tiêu đề tài liệu",
  "doc_kind": "rules",
  "version": "1.0",
  "scope_property": ["apartment"],
  "effective_from": "2026-01-01",
  "effective_to": null,
  "sections": [
    {
      "section_id": "VI-DU-01",
      "ordinal": 1,
      "heading_vi": "Tiêu đề mục",
      "body_vi": "Nội dung mục, tối thiểu 60 ký tự...",
      "intents": ["I-05"],
      "facility_ids": [],
      "conflict_group": null
    }
  ]
}`;

const VERSION_PLACEHOLDER = `{
  "base_document_id": "DOC-VI-DU-001",
  "new_document_id": "DOC-VI-DU-002",
  "version": "2.0",
  "sections": [
    {
      "section_id": "...",
      "ordinal": 1,
      "heading_vi": "...",
      "body_vi": "Nội dung mục, tối thiểu 60 ký tự...",
      "intents": [],
      "facility_ids": [],
      "conflict_group": null
    }
  ]
}`;

export function UploadPanel({ onUploadDocument, onNewDocumentVersion }: Props) {
  const [uploadJson, setUploadJson] = useState("");
  const [versionJson, setVersionJson] = useState("");
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [versionMsg, setVersionMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitUpload() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(uploadJson);
    } catch {
      setUploadMsg("JSON không hợp lệ — kiểm tra lại cú pháp.");
      return;
    }
    startTransition(async () => {
      const res = await onUploadDocument(parsed);
      if (res.ok) {
        setUploadMsg(`Đã tạo "${res.document_id}" — ${res.chunks_created} chunk.`);
        setUploadJson("");
      } else {
        setUploadMsg(`${res.error.code}: ${res.error.message_vi}`);
      }
    });
  }

  function submitVersion() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(versionJson);
    } catch {
      setVersionMsg("JSON không hợp lệ — kiểm tra lại cú pháp.");
      return;
    }
    const p = parsed as {
      base_document_id?: unknown;
      new_document_id?: unknown;
      version?: unknown;
      sections?: unknown;
    };
    if (
      typeof p.base_document_id !== "string" ||
      typeof p.new_document_id !== "string" ||
      typeof p.version !== "string" ||
      !Array.isArray(p.sections)
    ) {
      setVersionMsg("Thiếu base_document_id / new_document_id / version / sections.");
      return;
    }
    startTransition(async () => {
      const res = await onNewDocumentVersion({
        base_document_id: p.base_document_id as string,
        new_document_id: p.new_document_id as string,
        version: p.version as string,
        sections: p.sections as UploadSectionInput[],
      });
      if (res.ok) {
        setVersionMsg(`Đã tạo version mới, bản "${res.superseded}" chuyển Expired.`);
        setVersionJson("");
      } else {
        setVersionMsg(`${res.error.code}: ${res.error.message_vi}`);
      }
    });
  }

  return (
    <details className="bql-upload-panel">
      <summary>Tạo tài liệu mới / Đổi version (dán JSON)</summary>
      <div className="bql-upload-panel__grid">
        <div>
          <h2>Tài liệu mới</h2>
          <textarea
            placeholder={UPLOAD_PLACEHOLDER}
            value={uploadJson}
            disabled={pending}
            onChange={(e) => setUploadJson(e.target.value)}
          />
          <button type="button" className="btn btn--primary" disabled={pending} onClick={submitUpload}>
            Tạo tài liệu
          </button>
          {uploadMsg && <p className="bql-cell-error">{uploadMsg}</p>}
        </div>
        <div>
          <h2>Đổi version (bản cũ tự chuyển Expired)</h2>
          <textarea
            placeholder={VERSION_PLACEHOLDER}
            value={versionJson}
            disabled={pending}
            onChange={(e) => setVersionJson(e.target.value)}
          />
          <button type="button" className="btn" disabled={pending} onClick={submitVersion}>
            Tạo version mới
          </button>
          {versionMsg && <p className="bql-cell-error">{versionMsg}</p>}
        </div>
      </div>
    </details>
  );
}

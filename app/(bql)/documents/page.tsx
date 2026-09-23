// app/(bql)/documents/page.tsx — URL /documents. Vòng đời tài liệu (R7,
// SPEC-P03 §2): liệt kê tài liệu thật từ DB, upload tài liệu mới, đổi
// version, đổi `status` / `effective_status`, loại/đưa lại một mục khỏi RAG
// (H26, cổng E-4) — tất cả có hiệu lực NGAY với retrieval (P02-C8 cấm cache).
import { listDocumentsForConsole } from "../../../lib/adapters/bql-store.ts";
import {
  setDocumentStatus,
  setEffectiveStatus,
  uploadDocument,
  newDocumentVersion,
  listSections,
  setSectionExcluded,
} from "./actions.ts";
import { DocumentsTable } from "./DocumentsTable.tsx";
import { UploadPanel } from "./UploadPanel.tsx";
import { SectionsPanel } from "./SectionsPanel.tsx";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const documents = await listDocumentsForConsole();
  return (
    <main className="bql-console">
      <h1>Quản lý tài liệu tri thức</h1>
      <p className="bql-console__sub">
        Đổi trạng thái một tài liệu ảnh hưởng NGAY tới câu trả lời cho cư dân
        trong cùng phiên demo — không cần deploy lại, không cần restart (R7).
        Dòng có nền vàng là tài liệu đang hết hiệu lực hoặc bị cấm dùng cho
        RAG.
      </p>
      <DocumentsTable
        documents={documents}
        onSetStatus={setDocumentStatus}
        onSetEffectiveStatus={setEffectiveStatus}
      />
      <UploadPanel onUploadDocument={uploadDocument} onNewDocumentVersion={newDocumentVersion} />
      <SectionsPanel
        documents={documents}
        onListSections={listSections}
        onSetSectionExcluded={setSectionExcluded}
      />
    </main>
  );
}

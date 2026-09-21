// app/(bql)/documents/page.tsx — URL /documents. Vòng đời tài liệu (R7,
// SPEC-P03 §2): liệt kê tài liệu thật từ DB, đổi `status` / `effective_status`
// có hiệu lực NGAY với retrieval (P02-C8 cấm cache).
//
// CHƯA LÀM trong lượt này (không thuộc "xong khi" của W1/W2, xem báo cáo
// R07): `uploadDocument` / `newDocumentVersion` (SPEC-P03 §2.2, §2.3) và
// `setSectionExcluded` ở UI — hàm ghi tương ứng đã có ở bql-store.ts nhưng
// chưa có màn hình gọi tới.
import { listDocumentsForConsole } from "../../../lib/adapters/bql-store.ts";
import { setDocumentStatus, setEffectiveStatus } from "./actions.ts";
import { DocumentsTable } from "./DocumentsTable.tsx";

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
    </main>
  );
}

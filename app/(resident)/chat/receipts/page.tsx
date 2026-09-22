// app/(resident)/chat/receipts/page.tsx — URL /chat/receipts (W2, handoff H21,
// SPEC-P05-Action-Layer.md §6). Server Component: đọc biên nhận của CHÍNH cư dân
// đang đăng nhập qua `getSimBackend().listMyReceipts(resident_id)` — vai `resident`
// và chặn `bql` đã có sẵn ở `app/(resident)/layout.tsx` (đối xứng mọi trang khác
// trong nhóm `(resident)`), nên ở đây chỉ cần lấy `resident_id` từ phiên.
//
// `lib/simbackend` có thể CHƯA được H19 cài đặt thật (`getSimBackend()` ném lỗi rõ
// ràng) — trang này KHÔNG được crash trắng màn hình (NFR-02): hiện thông báo tạm
// thời thay vì để Next.js render trang lỗi mặc định.
import { getSessionPayload } from "../../../../lib/auth/guard";
import { getSimBackend } from "../../../../lib/simbackend/index.ts";
import type { ReceiptRecord } from "../../../../lib/simbackend/contract.ts";
import { ReceiptsTable } from "./ReceiptsTable";

export const dynamic = "force-dynamic";

const ACTION_LABEL_VI: Record<ReceiptRecord["action"], string> = {
  create: "Đặt chỗ",
  cancel: "Huỷ chỗ",
};

export default async function ReceiptsPage() {
  const session = await getSessionPayload();
  // `layout.tsx` đã redirect khi thiếu phiên/không phải `resident`; còn lại chỉ
  // trường hợp resident_id null (dữ liệu phiên thiếu) — hiện rõ thay vì crash.
  if (!session?.resident_id) {
    return (
      <main className="bql-console">
        <h1>Biên nhận của tôi</h1>
        <p className="bql-console__empty">Không xác định được tài khoản cư dân của phiên hiện tại.</p>
      </main>
    );
  }

  let receipts: ReceiptRecord[] = [];
  let backendUnavailable = false;
  try {
    const backend = await getSimBackend();
    receipts = await backend.listMyReceipts(session.resident_id);
  } catch {
    backendUnavailable = true;
  }

  return (
    <main className="bql-console">
      <header className="chat__head">
        <div>
          <h1>Biên nhận của tôi</h1>
          <p className="bql-console__sub">
            Mọi lượt trợ lý đặt/huỷ chỗ thay anh/chị đều có một dòng biên nhận ở đây.
          </p>
        </div>
        <a href="/chat" className="btn btn--ghost">
          Quay lại trò chuyện
        </a>
      </header>

      {backendUnavailable ? (
        <p className="bql-console__empty">
          Chưa đọc được sổ biên nhận lúc này. Anh/chị thử lại sau, hoặc quay lại trò chuyện.
        </p>
      ) : receipts.length === 0 ? (
        <p className="bql-console__empty">Anh/chị chưa có biên nhận nào.</p>
      ) : (
        <ReceiptsTable receipts={receipts} actionLabelVi={ACTION_LABEL_VI} />
      )}
    </main>
  );
}

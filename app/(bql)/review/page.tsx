// app/(bql)/review/page.tsx — URL /review. Hàng đợi HITL (R8, SPEC-P03 §3):
// mọi answer_turn có decision='escalate' (P03-C3). Bảng `answer_turns` có
// thể RỖNG (worker P02 đang nối dây ghi) — màn này CHẠY ĐÚNG khi rỗng: hiện
// "chưa có lượt nào cần duyệt", không crash, không NaN, không màn trắng.
import { listReviewQueue } from "../../../lib/adapters/bql-store.ts";
import { approveAnswer, editAndApprove, rejectAnswer } from "./actions.ts";
import { ReviewQueueList } from "./ReviewQueueList.tsx";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const rows = await listReviewQueue();
  return (
    <main className="bql-console">
      <h1>Hàng đợi duyệt câu trả lời</h1>
      <p className="bql-console__sub">
        Chỉ chứa các lượt hệ thống đã từ chối trả lời trực tiếp (escalate).
        Câu trả lời tự động không nằm ở đây.
      </p>
      <ReviewQueueList
        rows={rows}
        onApprove={approveAnswer}
        onEditAndApprove={editAndApprove}
        onReject={rejectAnswer}
      />
    </main>
  );
}

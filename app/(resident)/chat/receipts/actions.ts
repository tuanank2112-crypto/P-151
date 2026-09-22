"use server";
// app/(resident)/chat/receipts/actions.ts — W2 (handoff H21): Server Component
// `page.tsx` đọc `listMyReceipts()` một lần lúc render; sau khi *Hoàn tác* thành
// công qua `POST /api/actions/undo` (client fetch, `ReceiptsTable.tsx`), gọi Server
// Action này để `revalidatePath("/chat/receipts")` — đúng cách `app/(bql)/review/
// actions.ts` làm sau mỗi thao tác ghi (không tự ý thêm lệnh ghi nào khác, luật §4).

import { revalidatePath } from "next/cache";

export async function revalidateReceipts(): Promise<void> {
  revalidatePath("/chat/receipts");
}

// app/api/conversations/route.ts — cửa HTTP đọc lại lịch sử một hội thoại
// (R4, handoff H15 W2). Nối trực tiếp hai hàm ĐÃ CÓ của `DataStore`
// (`getConversationOwner`, `listMessages`, SPEC-P02 §9) — không mở
// connection, không gọi nhà cung cấp model (BB-07).
//
// BẮT BUỘC:
//  - Chỉ vai `resident` (đối xứng `app/api/chat/route.ts`).
//  - `conversation_id` không thuộc principal đang đăng nhập ⇒ 403
//    (`ConversationNotOwned`, SPEC-P02 §9) — CẤM tiết lộ hội thoại có tồn
//    tại hay không qua mã lỗi khác nhau.
//  - CHỈ trả `MessageRecord[]` (role/content_vi/created_at) — không có
//    `confidence`/`gate_triggered` (BB-05, P02-C5): các trường đó không nằm
//    trong `messages`, không cần cắt thêm, nhưng ghi rõ ở đây để người đọc
//    sau không vô tình nối thêm cột từ `answer_turns`.

import { NextResponse } from "next/server";
import { getSessionPayload } from "../../../lib/auth/guard";
import { getDataStore } from "../../../lib/adapters/db.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "action_authorization_missing" }, { status: 401 });
  }
  if (session.role !== "resident") {
    return NextResponse.json({ error: "action_authorization_missing" }, { status: 403 });
  }

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversation_id") ?? "";
  if (!conversationId) {
    return NextResponse.json({ error: "conversation_id thiếu" }, { status: 400 });
  }

  const store = await getDataStore();
  const owner = await store.getConversationOwner(conversationId);
  if (owner !== session.user_id) {
    // Bao gồm cả `owner === null` (hội thoại không tồn tại) — cùng mã 403,
    // không phân biệt "không tồn tại" với "không thuộc bạn" (SPEC-P02 §9).
    return NextResponse.json({ error: "action_authorization_missing" }, { status: 403 });
  }

  const messages = await store.listMessages(conversationId);
  return NextResponse.json({ conversation_id: conversationId, messages }, { status: 200 });
}

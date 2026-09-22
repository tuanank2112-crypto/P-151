// app/api/actions/undo/route.ts — W2 (handoff H21, Đ48, SPEC-P05-Action-Layer.md §6):
// nút *Hoàn tác* ở `/chat` (card kết quả hành động) và `/chat/receipts` cùng gọi
// route này. Đây là lệnh ghi DUY NHẤT UI được tự gọi ngoài luồng chat (luật §4 handoff
// H21) — mỗi lời gọi là một lần cư dân bấm nút, tức xác nhận tường minh cho
// `amenity.cancel_booking` (`confirmed: true`).
//
// Lớp mỏng nối `getSessionPayload()` → `handleUndoRequest` (lõi THUẦN, `./logic.ts`)
// → `NextResponse`. Lõi tách riêng vì test (`node --test`) không resolve được
// `next/server` ngoài runtime build của Next — xem lý do đầy đủ ở đầu `./logic.ts`.

import { NextResponse } from "next/server";
import { getSessionPayload } from "../../../../lib/auth/guard";
import { handleUndoRequest } from "./logic.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSessionPayload();
  let receiptCode = "";
  try {
    const parsed = (await request.json()) as { receipt_code?: unknown };
    if (typeof parsed?.receipt_code === "string") receiptCode = parsed.receipt_code;
  } catch {
    // Thân JSON hỏng ⇒ coi như thiếu mã biên nhận, xử lý ở nhánh "invalid" của
    // `handleUndoRequest`.
  }
  const { status, body } = await handleUndoRequest(session, receiptCode);
  return NextResponse.json(body, { status });
}

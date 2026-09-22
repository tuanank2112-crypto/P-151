// app/api/actions/undo/logic.ts — W2 (handoff H21, Đ48, SPEC-P05-Action-Layer.md
// §5.2, §6): lõi THUẦN của `POST /api/actions/undo`, tách khỏi `route.ts` để test
// được bằng `node --test` mà không kéo theo `next/server` (route handler import
// `NextResponse`, module đó không resolve được ngoài runtime build của Next —
// đo được 2026-09-23: `node --test` ném `ERR_MODULE_NOT_FOUND: next/server` khi
// import thẳng `route.ts`). `route.ts` chỉ còn là lớp mỏng nối
// `getSessionPayload()` → `handleUndoRequest` → `NextResponse` (SPEC-P05 §5.2, §6).
//
// BẮT BUỘC:
//  - Chỉ vai `resident`, chỉ hoàn tác biên nhận của CHÍNH mình
//    (`getSimBackend().listMyReceipts(resident_id)` — đã tự lọc theo chủ sở hữu).
//  - Không phân biệt "biên nhận không tồn tại" với "không thuộc bạn" qua mã lỗi
//    khác nhau (đối xứng `app/api/conversations/route.ts`, H15 W2) — cùng 403.
//  - `undo_capability_id !== "amenity.cancel_booking"` hoặc `undone_by !== null`
//    (đã hoàn tác trước đó) ⇒ 409, KHÔNG gọi backend lần nữa.
//  - Đi qua `getSimBackend()` (BB-07 mở rộng cho P05) — không mở connection, không
//    SQL trong `app/`.

import { randomUUID } from "node:crypto";
import { getSimBackend } from "../../../../lib/simbackend/index.ts";
import { SimBackendError } from "../../../../lib/simbackend/contract.ts";
import type { SessionPayload } from "../../../../lib/auth/session.ts";

export interface UndoResponseBody {
  ok: boolean;
  status: "done" | "blocked" | "forbidden" | "not_found" | "invalid";
  receipt_code?: string;
  undo_capability_id?: null;
  message_vi: string;
}

const REASON_VI_UNDO = "Cư dân hoàn tác từ trang biên nhận";

/** Không đụng `next/headers`/`next/server` — test trực tiếp bằng backend giả tiêm
 *  qua `__setSimBackendForTesting` (`lib/simbackend/index.ts`). */
export async function handleUndoRequest(
  session: SessionPayload | null,
  receiptCode: string
): Promise<{ status: number; body: UndoResponseBody }> {
  if (!session || session.role !== "resident" || !session.resident_id) {
    return {
      status: 403,
      body: { ok: false, status: "forbidden", message_vi: "Chỉ cư dân đã đăng nhập được hoàn tác." },
    };
  }
  if (!receiptCode) {
    return {
      status: 400,
      body: { ok: false, status: "invalid", message_vi: "Thiếu mã biên nhận." },
    };
  }

  const backend = await getSimBackend();
  const residentId = session.resident_id;
  const receipts = await backend.listMyReceipts(residentId);
  const receipt = receipts.find((r) => r.receipt_code === receiptCode);
  if (!receipt) {
    // Cùng mã cho "không tồn tại" và "không thuộc bạn" (đối xứng H15 W2) — CẤM tiết
    // lộ biên nhận có tồn tại hay không qua mã lỗi khác nhau.
    return {
      status: 403,
      body: {
        ok: false,
        status: "forbidden",
        message_vi: "Biên nhận không tồn tại hoặc không thuộc về anh/chị.",
      },
    };
  }
  if (receipt.undo_capability_id !== "amenity.cancel_booking" || receipt.undone_by !== null) {
    return {
      status: 409,
      body: {
        ok: false,
        status: "blocked",
        message_vi:
          "Biên nhận này không còn hoàn tác được (đã hoàn tác trước đó, hoặc bản chất không hoàn tác được).",
      },
    };
  }

  const sessionId = randomUUID();
  try {
    // Precheck bắt buộc trước `cancelBooking` (BB-03, SPEC-P05 §5.2).
    await backend.getBookingDetail({
      session_id: sessionId,
      booking_id: receipt.booking_id,
      resident_id: residentId,
    });
  } catch (err) {
    if (err instanceof SimBackendError) {
      return {
        status: 403,
        body: {
          ok: false,
          status: "forbidden",
          message_vi: "Không xác minh được đặt chỗ này thuộc về anh/chị.",
        },
      };
    }
    throw err;
  }

  const result = await backend.cancelBooking({
    session_id: sessionId,
    booking_id: receipt.booking_id,
    resident_id: residentId,
    reason_vi: REASON_VI_UNDO,
    confirmed: true,
  });
  if (!result.ok) {
    return {
      status: 409,
      body: {
        ok: false,
        status: "blocked",
        message_vi: "Không hoàn tác được — có thể đã quá hạn chót huỷ hoặc chỗ đã đổi trạng thái.",
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      status: "done",
      receipt_code: result.receipt_code,
      undo_capability_id: result.undo_capability_id,
      message_vi: "Đã hoàn tác.",
    },
  };
}

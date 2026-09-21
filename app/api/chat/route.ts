// app/api/chat/route.ts — cửa HTTP DUY NHẤT của luồng hỏi–đáp cư dân.
// Nối `lib/pipeline/runTurn` (SPEC-P02 §1–§2) vào giao diện. Không mở
// connection, không gọi nhà cung cấp model trực tiếp — mọi lối ra ngoài vẫn
// đi qua `lib/adapters/**` (BB-07).
//
// BẮT BUỘC:
//  - Chỉ vai `resident` (E5 AuthzError, 00-ARCHITECTURE §8).
//  - Trả về `PublicTurnResult`: KHÔNG có `confidence`, KHÔNG có
//    `gate_triggered` (BB-05 / VC-07, P02-C5). Việc cắt làm ở ĐÂY, một chỗ.
//  - Mọi nhánh lỗi đều trả một thân JSON đọc được + câu tiếng Việt, không
//    nhánh nào để màn hình trắng (PRD §6 NFR-02, SPEC-P02 §9).
//  - CẤM cache (P02-C8): BQL đổi tài liệu thì lượt hỏi kế tiếp phải đổi ngay.

import { NextResponse } from "next/server";
import { getSessionPayload } from "../../../lib/auth/guard";
import { runTurn } from "../../../lib/pipeline/index.ts";
import {
  EmptyQuestionError,
  OwnershipViolation,
  PipelineInvariantError,
  RetrievalError,
} from "../../../lib/pipeline/errors.ts";
import {
  ContractDriftError,
  UpstreamAuthError,
  UpstreamContentBlocked,
  UpstreamModelError,
  UpstreamOverloaded,
  UpstreamRateLimited,
} from "../../../lib/adapters/model.ts";
import { reasonMessageVi } from "../../../lib/reason-messages.ts";
import type { PublicTurnResult, ReasonCode, TurnResult } from "../../../lib/types.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Cắt các trường chỉ dành cho vận hành trước khi ra khỏi máy chủ. */
function toPublic(result: TurnResult): PublicTurnResult {
  const { confidence: _c, gate_triggered: _g, ...publicPart } = result;
  return publicPart;
}

interface ChatResponseBody {
  ok: boolean;
  result: PublicTurnResult;
  message_vi: string;
  can_retry: boolean;
}

function escalateBody(reason_code: ReasonCode, can_retry: boolean): ChatResponseBody {
  return {
    ok: false,
    result: {
      decision: "escalate",
      reason_code,
      answer_vi: null,
      clarify_question_vi: null,
      citations: [],
      claims: [],
      steps: [],
    },
    message_vi: reasonMessageVi(reason_code),
    can_retry,
  };
}

/**
 * Bảng §9 của SPEC-P02: mỗi lớp lỗi → mã HTTP + có cho thử lại không.
 * CẤM hạ cấp `PipelineInvariantError` thành một câu trả lời (nó nghĩa là bất
 * biến BB-04/BB-08 đã vỡ — im lặng ở đây là giấu đúng thứ nguy hiểm nhất).
 */
function mapError(err: unknown): { status: number; body: ChatResponseBody } {
  if (err instanceof EmptyQuestionError) {
    return {
      status: 400,
      body: {
        ok: false,
        result: {
          decision: "clarify",
          reason_code: null,
          answer_vi: null,
          clarify_question_vi: "Anh/chị nhập giúp nội dung câu hỏi.",
          citations: [],
          claims: [],
          steps: [],
        },
        message_vi: "Anh/chị nhập giúp nội dung câu hỏi.",
        can_retry: true,
      },
    };
  }
  if (err instanceof OwnershipViolation) {
    return { status: 403, body: escalateBody("pii_or_account_specific", false) };
  }
  if (
    err instanceof UpstreamRateLimited ||
    err instanceof UpstreamOverloaded ||
    err instanceof UpstreamModelError
  ) {
    // Hết retry ở tầng adapter rồi mới tới đây ⇒ cho cư dân nút Thử lại.
    return { status: 503, body: escalateBody("system_error", true) };
  }
  if (
    err instanceof UpstreamAuthError ||
    err instanceof UpstreamContentBlocked ||
    err instanceof ContractDriftError ||
    err instanceof RetrievalError
  ) {
    // Retry vô ích: cùng đầu vào cho cùng kết quả, hoặc sai cấu hình.
    // CẤM đưa nội dung lỗi (có thể chứa khoá) xuống trình duyệt.
    return { status: 502, body: escalateBody("system_error", false) };
  }
  if (err instanceof PipelineInvariantError) {
    return { status: 500, body: escalateBody("system_error", false) };
  }
  return { status: 500, body: escalateBody("system_error", true) };
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json(escalateBody("action_authorization_missing", false), {
      status: 401,
    });
  }
  if (session.role !== "resident") {
    return NextResponse.json(escalateBody("action_authorization_missing", false), { status: 403 });
  }

  let questionVi = "";
  let conversationId = "";
  try {
    const payload = (await request.json()) as { question_vi?: unknown; conversation_id?: unknown };
    questionVi = typeof payload.question_vi === "string" ? payload.question_vi : "";
    conversationId = typeof payload.conversation_id === "string" ? payload.conversation_id : "";
  } catch {
    return NextResponse.json(escalateBody("system_error", true), { status: 400 });
  }

  try {
    const result = await runTurn({
      conversation_id: conversationId || crypto.randomUUID(),
      question_vi: questionVi,
      principal: {
        user_id: session.user_id,
        role: session.role,
        resident_id: session.resident_id,
        owned_property_ids: session.owned_property_ids,
        property_type: session.property_type,
      },
    });

    const body: ChatResponseBody = {
      ok: result.decision === "answer",
      result: toPublic(result),
      message_vi:
        result.decision === "answer"
          ? ""
          : result.clarify_question_vi ?? reasonMessageVi(result.reason_code),
      can_retry: false,
    };
    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    const { status, body } = mapError(err);
    return NextResponse.json(body, { status });
  }
}

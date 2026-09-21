#!/usr/bin/env node
// evidence/p03/w2_r7_demo.mjs — W2 (handoff H07): chứng minh R7 bằng máy —
// đổi effective_status một tài liệu làm câu trả lời liên quan đổi hành vi
// NGAY trong cùng phiên (SPEC-P03 §2.5 kịch bản demo).
//
// KHÔNG dùng scripts/trace_sample.mjs trực tiếp: nó hardcode
// `conversation_id: "trace-sample"`, không phải uuid hợp lệ, nên vỡ trên
// backend Postgres thật (bug ở lib/pipeline/, ngoài phạm vi gói P03 — xem
// report R07). Script này ở evidence/ (không phải scripts/, đúng vị trí
// handoff H07 §3 W2 chỉ định), tự gọi runTurn() với conversation_id là uuid
// thật, và dùng lib/adapters/bql-store.ts (P03) để đổi effective_status.
//
// Giới hạn hạn mức Gemini (chỉ thị bổ sung của phiên): đúng 2 lời gọi
// runTurn(), không hơn. TỰ TRẢ LẠI trạng thái cũ ở cuối, kể cả khi ném lỗi.
//
// GHI CHÚ THÊM (đo được lúc chạy script này): `runTurn()` đòi
// `conversations.id` đã tồn tại (FK `messages_conversation_id_fkey`) —
// `lib/pipeline/index.ts` KHÔNG tự tạo conversation. Đây là khoảng trống ở
// tầng pipeline/route (ngoài phạm vi gói P03, xem report R07 mục "việc
// KHÔNG làm"). Script này tự tạo một conversation tạm cho đúng user seed
// resident@demo.local rồi XOÁ SẠCH (conversation + messages + answer_turns
// liên quan) ở khối finally, không để lại dữ liệu thừa trong DB demo dùng
// chung.

process.env.DATA_BACKEND = "postgres";

const DOCUMENT_ID = "OCP1-POOL-RULES-001";
const QUESTION = "Trẻ em dưới 12 tuổi có được vào bể bơi một mình không?";
const RESIDENT_USER_ID = "86e44c36-0914-4630-ac0e-4b9995d4c7e6"; // resident@demo.local (seed)

const { runTurn } = await import("../../../../lib/pipeline/index.ts");
const { setEffectiveStatus } = await import("../../../../lib/adapters/bql-store.ts");
const { getSql, closePool } = await import("../../../../lib/adapters/db.ts");

const sql = getSql();
const [{ id: conversationId }] = await sql(
  `INSERT INTO conversations (user_id, title_vi) VALUES ($1, $2) RETURNING id`,
  [RESIDENT_USER_ID, "W2 demo — evidence tạm, tự xoá"]
);

const RESIDENT_PRINCIPAL = {
  user_id: "86e44c36-0914-4630-ac0e-4b9995d4c7e6", // resident@demo.local (seed)
  role: "resident",
  resident_id: "R-0001",
  owned_property_ids: ["S1.120817"],
  property_type: ["apartment"],
};

function citationDocs(result) {
  return result.citations.map((c) => c.document_id);
}

async function ask(label) {
  const result = await runTurn({
    conversation_id: conversationId,
    question_vi: QUESTION,
    principal: RESIDENT_PRINCIPAL,
  });
  const cites = citationDocs(result);
  console.log(
    `${label}) decision=${result.decision} reason_code=${result.reason_code ?? "—"} ` +
      `citations_document_id=${JSON.stringify(cites)}`
  );
  return result;
}

let exitCode = 0;
try {
  const before = await ask("1");
  if (!(before.decision === "answer" && citationDocs(before).includes(DOCUMENT_ID))) {
    throw new Error(
      `Bước 1 KHÔNG như kỳ vọng: cần decision=answer và citation tới ${DOCUMENT_ID}.`
    );
  }

  const deprecate = await setEffectiveStatus({
    document_id: DOCUMENT_ID,
    effective_status: "Expired",
    effective_to: new Date().toISOString().slice(0, 10),
  });
  if (!deprecate.ok) throw new Error(`setEffectiveStatus thất bại: ${deprecate.error.message_vi}`);
  console.log(`2) đã đặt ${DOCUMENT_ID} effective_status=Expired`);

  const after = await ask("3");
  if (citationDocs(after).includes(DOCUMENT_ID)) {
    throw new Error(`Bước 3 KHÔNG như kỳ vọng: vẫn còn citation tới ${DOCUMENT_ID} sau khi Expired.`);
  }

  console.log("KẾT LUẬN: R7 đúng như SPEC-P03 §2.5 — đổi effective_status có hiệu lực NGAY, cùng phiên.");
} catch (err) {
  exitCode = 1;
  console.error(`LỖI: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  const restore = await setEffectiveStatus({
    document_id: DOCUMENT_ID,
    effective_status: "Current",
    effective_to: null,
  });
  console.log(
    restore.ok
      ? `4) ĐÃ TRẢ LẠI trạng thái cũ: ${DOCUMENT_ID} effective_status=Current`
      : `4) LỖI khi trả lại trạng thái cũ: ${restore.error.message_vi}`
  );
  await sql(`DELETE FROM answer_turns WHERE conversation_id = $1`, [conversationId]);
  await sql(`DELETE FROM messages WHERE conversation_id = $1`, [conversationId]);
  await sql(`DELETE FROM conversations WHERE id = $1`, [conversationId]);
  console.log("5) ĐÃ DỌN SẠCH dữ liệu tạm của lượt demo (conversation + messages + answer_turns).");
  await closePool();
}

process.exit(exitCode);

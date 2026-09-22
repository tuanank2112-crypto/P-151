#!/usr/bin/env node
// scripts/demo_r7.mjs — T-R7/G09 (TESTING-ACCEPTANCE.md dòng 37, 486): BQL
// đổi trạng thái tài liệu phải làm câu trả lời liên quan đổi NGAY trong cùng
// phiên, không deploy lại, không restart, không seed lại (SPEC-P03-BQL-Console.md
// §2.1, §2.5).
//
// Kịch bản 3 bước, đi qua `setDocumentStatus()` của `lib/adapters/bql-store.ts`
// — đúng đường Server Action (§2.2). CẤM sửa thẳng bảng `documents` bằng SQL
// ở đây (handoff H17 mục 2).
//   [1] TRƯỚC:              status hiện tại (mặc định Approved)  -> answer
//   [2] SAU KHI HẠ STATUS:  status = Deprecated (cổng E-1)       -> escalate
//   [3] KHÔI PHỤC:          status = Approved                    -> answer
//
// Mỗi lượt `runTurn` dùng MỘT conversation_id riêng, và hội thoại đó bị xoá
// (cascade -> messages/answer_turns/review_queue, db/migrations/004) ở cuối
// — kể cả khi có lỗi giữa chừng (try/finally) — để không lặp lại G37
// (`brain4agent/-known-gotchas.md`): script đo ghi thật vào DB demo mà không
// tự dọn.
//
// Mã thoát: 0 = đủ 3 dòng đúng hành vi kỳ vọng; 1 = sai hành vi (decision
// không khớp kỳ vọng ở bước nào đó, hoặc `--document=` không tồn tại);
// 3 = CHƯA KẾT LUẬN — lỗi Tầng 1 (429/503, AGENTS.md §5.E / Đ26), KHÔNG phải
// thất bại của sản phẩm.

import { loadLocalEnv, requireEnv, argValue, classifyError } from "./_batch.mjs";
import { makeSql } from "./_pg.mjs";
import { runTurn } from "../lib/pipeline/index.ts";
import { conversationIdFromLabel } from "../lib/adapters/db.ts";
import { setDocumentStatus } from "../lib/adapters/bql-store.ts";
import { DEMO_RESIDENT_PRINCIPAL } from "./_fixtures.mjs";

loadLocalEnv();
requireEnv(["DATABASE_URL"]);
process.env.DATA_BACKEND = "postgres";

const question = argValue(
  "--question",
  "Trẻ em dưới 12 tuổi có được vào bể bơi một mình không?"
);
const documentId = argValue("--document", "OCP1-POOL-RULES-001");

const sql = makeSql(process.env.DATABASE_URL);
const createdConversationIds = [];

/** Một lượt hỏi, hội thoại RIÊNG (nhãn tất định nhưng duy nhất trong lượt
 *  chạy này nhờ `Date.now()` + hậu tố ngẫu nhiên — không cần `--resume`). */
async function askOnce(stepLabel) {
  const uniqueLabel = `demo-r7-${stepLabel}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const conversationId = conversationIdFromLabel(uniqueLabel);
  createdConversationIds.push(conversationId);
  return runTurn({
    conversation_id: conversationId,
    question_vi: question,
    principal: DEMO_RESIDENT_PRINCIPAL,
  });
}

/** Xoá MỌI hội thoại demo vừa tạo (cascade), kể cả khi script lỗi giữa
 *  chừng — không để lại rác cho G37. */
async function cleanupConversations() {
  if (createdConversationIds.length > 0) {
    await sql("DELETE FROM conversations WHERE id = ANY($1)", [createdConversationIds]);
  }
}

/** Khôi phục `status = Approved` — LUÔN gọi ở `finally`, kể cả khi các bước
 *  trước đã lỗi, để không để lại tài liệu demo kẹt ở `Deprecated`. */
async function restoreApproved() {
  const restored = await setDocumentStatus({ document_id: documentId, status: "Approved" });
  if (!restored.ok) {
    console.error(
      `CẢNH BÁO: khôi phục status="Approved" cho "${documentId}" thất bại: ` +
        `${restored.error.code} — ${restored.error.message_vi}`
    );
  }
  return restored;
}

let exitCode = 0;

try {
  // [1] TRƯỚC — trạng thái hiện tại của tài liệu (kỳ vọng Approved/Current).
  const before = await askOnce("before");
  console.log(
    `[1] TRƯỚC: decision=${before.decision} citations=${JSON.stringify(
      before.citations.map((c) => c.section_id)
    )}`
  );
  if (before.decision !== "answer") {
    console.error(
      `SAI HÀNH VI: bước [1] kỳ vọng decision=answer, được "${before.decision}" ` +
        `(reason_code=${before.reason_code ?? "—"}). Kiểm tra document_id/status seed trước khi demo.`
    );
    exitCode = 1;
  }

  // [2] SAU KHI HẠ STATUS — Deprecated ⇒ cổng E-1 not_approved (§2.5).
  const lowered = await setDocumentStatus({ document_id: documentId, status: "Deprecated" });
  if (!lowered.ok) {
    console.error(
      `SAI HÀNH VI: setDocumentStatus("${documentId}", "Deprecated") thất bại: ` +
        `${lowered.error.code} — ${lowered.error.message_vi}`
    );
    exitCode = 1;
  } else {
    const after = await askOnce("after-deprecated");
    console.log(`[2] SAU KHI HẠ STATUS: decision=${after.decision} reason_code=${after.reason_code ?? "—"}`);
    if (after.decision !== "escalate") {
      console.error(
        `SAI HÀNH VI: bước [2] kỳ vọng decision=escalate, được "${after.decision}" ` +
          `(reason_code=${after.reason_code ?? "—"}).`
      );
      exitCode = 1;
    }
  }

  // [3] KHÔI PHỤC — Approved ⇒ câu trả lời quay lại như cũ.
  const restore = await restoreApproved();
  if (restore.ok) {
    const restored = await askOnce("restored");
    console.log(
      `[3] KHÔI PHỤC: decision=${restored.decision} citations=${JSON.stringify(
        restored.citations.map((c) => c.section_id)
      )}`
    );
    if (restored.decision !== "answer") {
      console.error(
        `SAI HÀNH VI: bước [3] kỳ vọng decision=answer, được "${restored.decision}" ` +
          `(reason_code=${restored.reason_code ?? "—"}).`
      );
      exitCode = 1;
    }
  } else {
    exitCode = 1;
  }
} catch (err) {
  const classified = classifyError(err);
  if (classified.tier === "tier1") {
    console.log(`BLOCKED: ${classified.kind}`);
    exitCode = 3;
  } else {
    console.error(`LỖI: ${err?.stack ?? err}`);
    exitCode = 1;
  }
} finally {
  // Luôn khôi phục status, kể cả khi lỗi ở bất kỳ bước nào phía trên
  // (try/finally theo đúng yêu cầu handoff H17 mục 3 — không để tài liệu
  // demo kẹt ở Deprecated).
  try {
    await restoreApproved();
  } catch (err) {
    console.error(`CẢNH BÁO: khôi phục status trong finally ném lỗi: ${err?.message ?? err}`);
  }
  try {
    await cleanupConversations();
  } catch (err) {
    console.error(`CẢNH BÁO: dọn hội thoại demo thất bại: ${err?.message ?? err}`);
  } finally {
    await sql.end();
  }
}

process.exit(exitCode);

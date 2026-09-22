// tests/chat-history.test.ts — H15 W2 (R4): lịch sử hội thoại đọc lại đúng
// chủ sở hữu. `GET /api/conversations` (`app/api/conversations/route.ts`)
// chỉ là một lớp mỏng bọc quanh `store.getConversationOwner()` +
// `store.listMessages()` rồi map thẳng sang mã HTTP (403 khi không khớp
// user_id, 200 + số tin nhắn khi khớp) — ĐÚNG cách `tests/conversation-id.
// test.ts` và `tests/memory.test.ts` đã kiểm route `/api/chat` (qua
// `runTurn`/`DataStore`, không qua `next/headers`): route.ts gọi
// `getSessionPayload()` (`lib/auth/guard.ts`), dùng `next/headers cookies()`
// — hàm đó NÉM LỖI khi gọi ngoài một request App Router thật, và
// `node --test` (`scripts/run_tests.mjs`, KHÔNG được sửa — phạm vi handoff
// H15) không dựng request đó. Nên bài test này khẳng định ĐÚNG hai nhánh
// quyết định mà route triển khai — 403 khi `owner !== session.user_id`, và
// đúng số tin nhắn khi khớp — bằng cách gọi thẳng hai hàm đó, cùng cách
// route đang làm (đọc `app/api/conversations/route.ts` để đối chiếu chữ ký).
// Bằng chứng MÃ HTTP thật (403/200 qua trình duyệt/curl) nằm ở
// `evidence/h15-chat-ui/w2_history.txt` (thân JSON UI gửi thật, G33).
//
// CHẠY THẬT trên Postgres — `getConversationOwner`/`listMessages` là no-op
// trên mock (Đ24). Tự dọn hội thoại test tạo ra ở cuối (G37: `npm test`
// không được nhuộm DB demo).

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLocalEnv, requireEnv } from "../scripts/_batch.mjs";
import { makeSql } from "../scripts/_pg.mjs";
import { __resetDataStoreForTesting, getDataStore } from "../lib/adapters/db.ts";

loadLocalEnv();
requireEnv(["DATABASE_URL"]);
process.env.DATA_BACKEND = "postgres";
__resetDataStoreForTesting();

const store = await getDataStore();

// H15 W2 (G37, đúng khuôn `tests/memory.test.ts`): gom id tạo ra, chỉ mở
// pool DỌN DẸP MỘT LẦN ở `test.after()` — pool riêng mở/đóng NGAY trong thân
// từng `test()` (như `tests/conversation-id.test.ts` làm ở khối tuần tự) sẽ
// đóng trước khi `node:test` thật sự chạy xong các test khác đã đăng ký
// song song, vì `test()` trả promise ngay sau khi ĐĂNG KÝ chứ không đợi thân
// test chạy xong.
const createdConversationIds: string[] = [];
test.after(async () => {
  if (createdConversationIds.length === 0) return;
  const sql = makeSql(process.env.DATABASE_URL as string);
  try {
    await sql(`DELETE FROM conversations WHERE id = ANY($1::uuid[])`, [createdConversationIds]);
  } finally {
    await sql.end();
  }
});

const resident = await store.findUserByEmail("resident@demo.local");
const bql = await store.findUserByEmail("bql@demo.local");
if (!resident || !bql) {
  throw new Error(
    "Seed thiếu resident@demo.local hoặc bql@demo.local — chạy `npm run db:seed:users` trước khi test."
  );
}

/** Cùng quyết định `GET /api/conversations` áp dụng (route §L38–43):
 *  `owner !== requesterUserId` ⇒ 403 (kể cả `owner === null`). */
async function ownershipStatus(conversationId: string, requesterUserId: string): Promise<number> {
  const owner = await store.getConversationOwner(conversationId);
  return owner === requesterUserId ? 200 : 403;
}

test("H15 W2 — id của người khác (bql) yêu cầu hội thoại của resident ⇒ 403", async () => {
  const { id: conversationId } = await store.createConversation(resident.id);
  createdConversationIds.push(conversationId);
  await store.appendMessage(conversationId, "user", "Câu hỏi test H15 W2", resident.id);
  const statusForOwner = await ownershipStatus(conversationId, resident.id);
  const statusForOther = await ownershipStatus(conversationId, bql.id);
  assert.equal(statusForOwner, 200, "chính chủ phải đọc được (200)");
  assert.equal(statusForOther, 403, "user khác phải bị chặn (403)");
});

test("H15 W2 — id không tồn tại ⇒ 403 (không phân biệt 'không có' với 'không thuộc bạn')", async () => {
  const status = await ownershipStatus("00000000-0000-0000-0000-000000000000", resident.id);
  assert.equal(status, 403);
});

test("H15 W2 — id của chính mình ⇒ đúng số tin nhắn đã ghi (listMessages)", async () => {
  const { id: conversationId } = await store.createConversation(resident.id);
  createdConversationIds.push(conversationId);
  await store.appendMessage(conversationId, "user", "Câu hỏi 1", resident.id);
  await store.appendMessage(conversationId, "assistant", "Trả lời 1");
  await store.appendMessage(conversationId, "user", "Câu hỏi 2");
  await store.appendMessage(conversationId, "assistant", "Trả lời 2");

  const owner = await store.getConversationOwner(conversationId);
  assert.equal(owner, resident.id);

  const messages = await store.listMessages(conversationId);
  assert.equal(messages.length, 4, "phải đọc lại đúng 4 dòng messages vừa ghi");
  assert.deepEqual(
    messages.map((m) => m.role),
    ["user", "assistant", "user", "assistant"],
    "thứ tự cũ → mới (R4)"
  );
});

// tests/_pg-cleanup.ts — H17 W2: helper dọn hội thoại mà các test ghi THẬT
// vào Postgres tạo ra, để `npm test`/`node scripts/run_tests.mjs` không
// nhuộm lại `answer_turns` mỗi lần chạy (G37, brain4agent/-known-gotchas.md
// — 430 dòng gần như toàn fixture vì test không tự dọn).
//
// Gom `conversation_id` NGAY LÚC test tạo ra nó, xoá hết đúng những id đó ở
// `test.after()` — CẤM xoá rộng hơn phạm vi test tự tạo (handoff H17 mục 2).
// `ON DELETE CASCADE` của `conversations` (db/migrations/004_operational.sql)
// tự xoá theo `messages`/`answer_turns`/`review_queue`, không cần xoá tay
// từng bảng.

/** Chữ ký tối thiểu dùng chung cho cả `scripts/_pg.mjs::makeSql` (có thêm
 *  `.end()`/`.pool`) và `lib/adapters/db.ts::getSql()` — chỉ cần gọi được
 *  `sql(text, params)`, không cần các thuộc tính khác của bên nào. */
type QueryFn = (text: string, params?: readonly unknown[]) => Promise<unknown[]>;

/** Xoá đúng danh sách `conversation_id` đã gom. Không làm gì nếu rỗng — một
 *  test bị bỏ qua/lỗi trước khi tạo hội thoại nào không được ném lỗi dọn dẹp. */
export async function deleteConversations(sql: QueryFn, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await sql("DELETE FROM conversations WHERE id = ANY($1)", [ids]);
}

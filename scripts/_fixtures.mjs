// scripts/_fixtures.mjs — fixture dùng chung cho các script chạy pipeline
// (probe_defects, trace_sample, eval_golden). Khớp tài khoản demo cư dân của
// `scripts/seed_users.mjs` (OPERATIONS.md §4.1, NG-09) — vai `resident`,
// đúng một căn hộ sở hữu.
//
// Đ37/R13 — CÙNG LỚP LỖI, một tầng sâu hơn. `user_id: "demo-resident-0001"`
// (nhãn dạng chữ) từng vô hại vì `runTurn()` là hàm thuần. Nay `runTurn()`
// tự tạo hàng `conversations` khi cần (db.ts::appendMessage's
// `ensureConversationOwner`, Đ37) — cột đó cũng là `uuid`, FK tới
// `users(id)`. Đo được: chạy `trace_sample.mjs` trên Postgres thật vỡ ĐÚNG
// ở đây, sau khi vá xong lớp `conversation_id`.
//
// `scripts/seed_users.mjs` KHÔNG ghim `id` (để Postgres tự `gen_random_uuid()`
// — đúng ở tầng seed, nhưng nghĩa là id thật đổi mỗi lần seed lại). Không thể
// hardcode một uuid snapshot ở đây — sẽ vỡ lại sau lần seed kế tiếp. Tra
// SỐNG qua `findUserByEmail()` khi `DATA_BACKEND=postgres`; trên `mock` giữ
// nguyên hằng số cố định khớp `DEMO_USERS` của `lib/adapters/store-mock.ts`
// (không đổi hành vi mock — Đ24).
import { getDataStore } from "../lib/adapters/db.ts";
import { loadLocalEnv } from "./_batch.mjs";

// Tự nạp `.env.local` NGAY Ở ĐÂY, không đợi script gọi mình tự làm việc đó.
// ESM nạp module import TRƯỚC khi chạy thân file đang import nó — nếu
// `eval_golden.mjs`/`probe_defects.mjs` gọi `loadLocalEnv()` ở thân file của
// CHÚNG (sau dòng `import { DEMO_RESIDENT_PRINCIPAL } from "./_fixtures.mjs"`)
// thì top-level await bên dưới đã chạy TRƯỚC đó — DATABASE_URL có thể chưa
// nạp, khiến `residentUserId()` rơi vào nhánh dự phòng SAI trên Postgres
// thật. Gọi lại ở đây (idempotent, KHÔNG override biến đã có ở shell —
// `_batch.mjs::loadLocalEnv()`) để tự đủ, không phụ thuộc thứ tự import.
loadLocalEnv();

/** Khớp `id` của tài khoản `resident@demo.local` trong `DEMO_USERS`
 *  (`lib/adapters/store-mock.ts`) — dùng khi `DATA_BACKEND` khác `postgres`,
 *  hoặc khi tra Postgres thất bại (không chặn cả script vì một lỗi tra cứu
 *  phụ; `runTurn` vẫn sẽ tự báo lỗi rõ ràng nếu id đó không tồn tại thật). */
const MOCK_RESIDENT_USER_ID = "00000000-0000-4000-8000-000000000001";

async function residentUserId() {
  if ((process.env.DATA_BACKEND ?? "mock") !== "postgres") return MOCK_RESIDENT_USER_ID;
  try {
    const store = await getDataStore();
    const user = await store.findUserByEmail("resident@demo.local");
    return user?.id ?? MOCK_RESIDENT_USER_ID;
  } catch {
    return MOCK_RESIDENT_USER_ID;
  }
}

export const DEMO_RESIDENT_PRINCIPAL = {
  user_id: await residentUserId(),
  role: "resident",
  resident_id: "R-0001",
  owned_property_ids: ["S1.120817"],
  property_type: ["apartment"],
};

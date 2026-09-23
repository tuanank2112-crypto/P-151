#!/usr/bin/env node
// evidence/h23-dashboard-actioned/make_bql_cookie.mjs — in ra cookie phiên
// HMAC hợp lệ cho bql@demo.local, theo đúng mẫu evidence/h15-chat-ui/make_cookie.mjs
// (chỉ đổi email sang vai bql). Chỉ đọc lib/auth/session.ts — không sửa gì.
process.env.DATA_BACKEND = "postgres";
const { getDataStore } = await import("../../../../lib/adapters/db.ts");
const { createSessionCookie, SESSION_COOKIE_NAME } = await import(
  "../../../../lib/auth/session.ts"
);

const store = await getDataStore();
const user = await store.findUserByEmail("bql@demo.local");
if (!user) throw new Error("Seed thiếu bql@demo.local — chạy npm run db:seed:users");

const cookieValue = createSessionCookie({
  user_id: user.id,
  role: user.role,
  resident_id: user.resident_id,
  owned_property_ids: user.owned_property_ids,
  property_type: user.property_type,
});

console.log(`${SESSION_COOKIE_NAME}=${cookieValue}`);
console.error(`# user_id=${user.id}`);
process.exit(0);

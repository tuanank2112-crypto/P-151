#!/usr/bin/env node
// scripts/seed_users.mjs — seed đúng HAI tài khoản demo (OPERATIONS.md §4.1,
// NG-09). Mật khẩu đọc từ biến môi trường, CẤM hardcode (OPERATIONS §4.1).
//
// CẤM chạy script này trong gói P01a: cần DATABASE_URL, chủ tịch chưa cấp.

import { neon } from "@neondatabase/serverless";
import { hashPassword } from "../lib/auth/password.ts";

const REQUIRED_ENV = [
  "DATABASE_URL",
  "SEED_RESIDENT_PASSWORD",
  "SEED_BQL_PASSWORD",
];

function checkEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Thiếu biến môi trường: ${missing.join(", ")}`);
    process.exit(2);
  }
}

async function main() {
  checkEnv();
  const sql = neon(process.env.DATABASE_URL);

  const residentHash = await hashPassword(process.env.SEED_RESIDENT_PASSWORD);
  const bqlHash = await hashPassword(process.env.SEED_BQL_PASSWORD);

  // Đúng hai tài khoản — không tạo thêm (NG-09).
  await sql(
    `INSERT INTO users (email, password_hash, role, display_name, resident_id, owned_property_ids)
     VALUES ($1, $2, 'resident', 'Cư dân A', 'R-0001', ARRAY['S1.120817'])
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    ["resident@demo.local", residentHash]
  );
  await sql(
    `INSERT INTO users (email, password_hash, role, display_name, resident_id, owned_property_ids)
     VALUES ($1, $2, 'bql', 'Ban quản lý', NULL, '{}')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    ["bql@demo.local", bqlHash]
  );

  console.log("seeded users: 2");
  process.exit(0);
}

main().catch((e) => {
  console.error(`SEED_ERROR: ${e.message}`);
  process.exit(1);
});

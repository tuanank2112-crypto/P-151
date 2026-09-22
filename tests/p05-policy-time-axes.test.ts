// tests/p05-policy-time-axes.test.ts — BB-02 (SPEC-P05-Action-Layer.md §2.2,
// §9, §10): `SIM_NOW=…T23:39` (diễn cảnh ref-01) ⇒ `intake_open_now=false`,
// `next_intake_open_at` = 08:30 NGÀY HÔM SAU (giờ ICT). `operating_now`
// PHẢI được tính HOÀN TOÀN ĐỘC LẬP với `intake_open_now` — không suy ra bên
// này từ bên kia. Để chứng minh "tính RIÊNG" không chỉ bằng cách hai giá
// trị "tình cờ khác nhau" ở một mốc, bài test đo THÊM một mốc giờ khác nơi
// `operating_now=true` trong khi `intake_open_now=false` cùng lúc — chỉ có
// thể xảy ra nếu hai biểu thức được tính từ hai bảng giờ khác nhau.

import { test } from "node:test";
import assert from "node:assert/strict";
import { MemorySimBackend, PostgresSimBackend } from "../lib/simbackend/index.ts";
import { loadLocalEnv, requireEnv } from "../scripts/_batch.mjs";
import { PROPERTY_ID, RESIDENT_ID } from "./_p05-helpers.ts";

loadLocalEnv();
requireEnv(["DATABASE_URL"]);

const FACILITY_ID = "FAC-PINGPONG"; // ref-01: intake 08:30–17:30, operating 06:00–22:00, mọi ngày

async function readPolicy(backend: MemorySimBackend | PostgresSimBackend, residentId: string) {
  return backend.getBookingPolicy({
    facility_id: FACILITY_ID,
    resident_id: residentId,
    property_id: PROPERTY_ID,
  });
}

test("BB-02 (mock): 23:39 ⇒ intake_open_now=false, next_intake_open_at=08:30 hôm sau; 20:00 ⇒ operating_now=true dù intake đã đóng", async () => {
  const backend = new MemorySimBackend();

  process.env.SIM_NOW = "2026-06-01T23:39:00+07:00"; // ref-01, thứ Hai
  const atNight = await readPolicy(backend, "R-MOCK-AXES");
  assert.equal(atNight.intake_open_now, false, "23:39 nằm ngoài 08:30–17:30");
  assert.equal(atNight.operating_now, false, "23:39 cũng nằm ngoài 06:00–22:00 (tình cờ, KHÔNG suy ra từ intake)");
  assert.equal(
    atNight.next_intake_open_at,
    "2026-06-02T08:30:00+07:00", // 2026-06-02T08:30:00+07:00 → UTC
    "next_intake_open_at phải là 08:30 ICT NGÀY HÔM SAU"
  );

  process.env.SIM_NOW = "2026-06-01T20:00:00+07:00"; // sau 17:30 (intake đóng) nhưng trước 22:00 (còn hoạt động)
  const atEvening = await readPolicy(backend, "R-MOCK-AXES");
  assert.equal(atEvening.intake_open_now, false, "20:00 vẫn ngoài cửa nhận đăng ký 08:30–17:30");
  assert.equal(atEvening.operating_now, true, "20:00 VẪN trong giờ hoạt động 06:00–22:00 — chứng minh operating_now KHÔNG suy ra từ intake_open_now (BB-02)");
});

test("BB-02 (postgres): 23:39 ⇒ intake_open_now=false, next_intake_open_at=08:30 hôm sau; 20:00 ⇒ operating_now=true dù intake đã đóng", async () => {
  const backend = new PostgresSimBackend();

  process.env.SIM_NOW = "2026-06-01T23:39:00+07:00";
  const atNight = await readPolicy(backend, RESIDENT_ID);
  assert.equal(atNight.intake_open_now, false);
  assert.equal(atNight.operating_now, false);
  assert.equal(atNight.next_intake_open_at, "2026-06-02T08:30:00+07:00");

  process.env.SIM_NOW = "2026-06-01T20:00:00+07:00";
  const atEvening = await readPolicy(backend, RESIDENT_ID);
  assert.equal(atEvening.intake_open_now, false);
  assert.equal(atEvening.operating_now, true, "BB-02 (postgres): operating_now tính riêng, không suy ra từ intake_open_now");
});

/**
 * Department read model (plan 06 Q11, user 2026-10-07): cleaning/technical must NOT learn who sent a ticket,
 * but MUST see the resident's rating and feedback for their own department's work.
 */
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { users } from "@/db/schema";
import { seed } from "@/db/seed";
import { deptData } from "@/server/legacy-queries";
import type { SessionUser } from "@/server/legacy-queries";
import * as wf from "@/server/workflow";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("TEST_DATABASE_URL must point to a *_test database");
const { db, pool } = createDb(url);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);

async function sessionUser(username: string): Promise<SessionUser> {
  const [u] = await db.select().from(users).where(eq(users.username, username));
  return { id: u.id, username: u.username, name: u.name, role: u.role, tower: u.tower, floor: u.floor, apartment: u.apartment };
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
});
beforeEach(async () => {
  await seed(db, { reset: true });
});
afterAll(async () => {
  await pool.end();
});

describe("department read model", () => {
  it("never reveals who sent a ticket", async () => {
    const resident = await sessionUser("cudan");
    const reception = await sessionUser("tiepnhan");
    // The resident's own name in the photo file name must not leak either
    const r = await wf.submitTicket(db, resident, {
      description: "Rác ở hành lang chưa được thu gom",
      place: "floor",
      placeDetail: "Hành lang",
      urgent: null,
      photos: [{ name: "nguyen-minh-anh-cudan.png", data: PNG }],
    });
    if (!r.ok) throw new Error(r.message);
    await wf.routeTicket(db, reception, r.data.id, "ve_sinh");

    const residents = await db.select().from(users).where(eq(users.role, "resident"));
    for (const role of ["vesinh", "kythuat"]) {
      const data = await deptData(await sessionUser(role), db);
      const json = JSON.stringify(data.tickets);
      for (const u of residents) {
        expect(json, `${role} sees ${u.name}`).not.toContain(u.name);
        expect(json, `${role} sees ${u.username}`).not.toContain(u.username);
      }
      for (const t of data.tickets) expect(Object.keys(t)).not.toContain("residentId");
    }
    const mine = (await deptData(await sessionUser("vesinh"), db)).tickets.find((t) => t.id === r.data.id)!;
    expect(mine.photos.map((p) => p.name)).toEqual(["Ảnh 1"]);
  });

  it("shows stars, tags and comment of the department's own completed work only", async () => {
    const cleaning = await deptData(await sessionUser("vesinh"), db);
    const rats = cleaning.tickets.find((t) => t.text === "Phòng rác tầng 8 có chuột")!;
    expect(rats.rating).toEqual({ stars: 2, tags: ["Chưa triệt để"], comment: "Hai ngày sau vẫn còn thấy chuột ở phòng rác." });

    const technical = await deptData(await sessionUser("kythuat"), db);
    expect(technical.tickets.find((t) => t.text === "Đèn hành lang tầng 3 không sáng")!.rating).toMatchObject({
      stars: 5,
      tags: ["Xử lý nhanh"],
    });
    expect(JSON.stringify(technical)).not.toContain("Hai ngày sau vẫn còn thấy chuột");
  });
});

/**
 * Every action of 01-CONTRACTS §4 against a real Postgres (TEST_DATABASE_URL, database name must end with _test).
 * Each test starts from a fresh seed.
 */
import { and, count, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { history, materials, photos, ratings, staff, tickets, users } from "@/db/schema";
import { seed } from "@/db/seed";
import * as wf from "@/server/workflow";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set");
if (!new URL(url).pathname.endsWith("_test")) throw new Error(`refusing to run on ${url}: database name must end with _test`);

const { db, pool } = createDb(url);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

type Actor = wf.Actor;
const actors: Record<string, Actor> = {};

async function actor(username: string): Promise<Actor> {
  const [u] = await db.select().from(users).where(eq(users.username, username));
  return { id: u.id, role: u.role, tower: u.tower, floor: u.floor, apartment: u.apartment };
}
async function ticket(id: number) {
  const [t] = await db.select().from(tickets).where(eq(tickets.id, id));
  return t;
}
async function historyCount(id: number) {
  const [r] = await db.select({ n: count() }).from(history).where(eq(history.ticketId, id));
  return r.n;
}
async function staffId(name: string) {
  const [s] = await db.select().from(staff).where(eq(staff.name, name));
  return s.id;
}
async function idOf(text: string) {
  const [t] = await db.select().from(tickets).where(eq(tickets.description, text));
  return t.id;
}
function expectOk<T>(r: { ok: boolean; data?: T; code?: string }): T {
  expect(r).toMatchObject({ ok: true });
  return (r as { data: T }).data;
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
});
beforeEach(async () => {
  await seed(db, { reset: true });
  for (const u of ["cudan", "tiepnhan", "quanly", "vesinh", "kythuat", "lethuha"]) actors[u] = await actor(u);
});
afterAll(async () => {
  await pool.end();
});

const submit = (who: Actor, description: string, extra: Partial<wf.SubmitInput> = {}) =>
  wf.submitTicket(db, who, { description, place: "floor", placeDetail: "Hành lang", urgent: null, photos: [], ...extra });

describe("seed", () => {
  it("is idempotent without reset", async () => {
    const [before] = await db.select({ n: count() }).from(tickets);
    expect(await seed(db)).toBe("skipped");
    const [after] = await db.select({ n: count() }).from(tickets);
    expect(after.n).toBe(before.n);
    expect(before.n).toBe(24);
  });
});

describe("full ticket lifecycle", () => {
  it("resident → reception → cleaning → resident accept + low rating", async () => {
    const { cudan, tiepnhan, vesinh } = actors;
    const created = expectOk(await submit(cudan, "Rác ở hành lang chưa được thu gom, có mùi hôi", { photos: [{ name: "a.png", data: PNG }] }));
    expect(created).toMatchObject({ dept: "ve_sinh", urgent: false });
    expect(created.code).toMatch(/^PA-\d{4}$/);
    let t = await ticket(created.id);
    expect(t).toMatchObject({ stage: 1, aiDept: "ve_sinh", location: "Tòa S2.05 · Tầng 12 · Hành lang" });
    expect(await historyCount(t.id)).toBe(2);
    const [pic] = await db.select().from(photos).where(eq(photos.ticketId, t.id));
    expect(pic).toMatchObject({ mime: "image/png", size: PNG.byteLength });

    expectOk(await wf.routeTicket(db, tiepnhan, t.id, "ve_sinh"));
    expectOk(await wf.assignStaff(db, vesinh, t.id, await staffId("Tổ B")));
    t = await ticket(t.id);
    expect(t).toMatchObject({ stage: 4, dept: "ve_sinh" });

    expectOk(await wf.finishTicket(db, vesinh, t.id));
    expect((await ticket(t.id)).doneAt).not.toBeNull();
    expectOk(await wf.rejectTicket(db, cudan, t.id));
    t = await ticket(t.id);
    expect(t).toMatchObject({ stage: 4, doneAt: null });
    expectOk(await wf.finishTicket(db, vesinh, t.id));
    expectOk(await wf.acceptTicket(db, cudan, t.id));
    expect((await ticket(t.id)).stage).toBe(6);

    expectOk(await wf.rateTicket(db, cudan, t.id, { stars: 2, tags: ["Chậm trễ"], comment: "Lâu" }));
    const [r] = await db.select().from(ratings).where(eq(ratings.ticketId, t.id));
    expect(r).toMatchObject({ stars: 2, tags: ["Chậm trễ"] });
    expect(await wf.rateTicket(db, cudan, t.id, { stars: 5, tags: [], comment: "" })).toMatchObject({ code: "CONFLICT" });
    // 2 on submit + route, assign, finish, reject, finish, accept, rate = 9
    expect(await historyCount(t.id)).toBe(9);
  });
});

describe("validation", () => {
  it("rejects bad submissions with INVALID_INPUT", async () => {
    const { cudan } = actors;
    expect(await submit(cudan, "ngắn")).toMatchObject({ code: "INVALID_INPUT" });
    expect(await submit(cudan, "Mô tả đủ dài để gửi", { place: "roof" })).toMatchObject({ code: "INVALID_INPUT" });
    expect(await submit(cudan, "Mô tả đủ dài để gửi", { placeDetail: "Sân thượng" })).toMatchObject({ code: "INVALID_INPUT" });
    const svg = new TextEncoder().encode("<svg/>");
    expect(await submit(cudan, "Mô tả đủ dài để gửi", { photos: [{ name: "x.png", data: svg }] })).toMatchObject({ code: "INVALID_INPUT" });
    const six = Array.from({ length: 6 }, (_, i) => ({ name: `${i}.png`, data: PNG }));
    expect(await submit(cudan, "Mô tả đủ dài để gửi", { photos: six })).toMatchObject({ code: "INVALID_INPUT" });
    expect(await wf.rateTicket(db, cudan, 1, { stars: 9, tags: [], comment: "" })).toMatchObject({ code: "INVALID_INPUT" });
    expect(await wf.rateTicket(db, cudan, 1, { stars: 5, tags: ["Chậm trễ"], comment: "" })).toMatchObject({ code: "INVALID_INPUT" });
  });

  it("uses the location mentioned in the description and the resident's urgency choice", async () => {
    const r = expectOk(await submit(actors.cudan, "Đèn hành lang tầng 15 bị chập, có khói", { urgent: false }));
    const t = await ticket(r.id);
    expect(t.location).toBe("Tòa S2.05 · Tầng 15 (theo mô tả)");
    expect(t.urgent).toBe(false); // resident overrode the Agent ("chập", "khói")
  });
});

describe("authorization and scope", () => {
  it("hides other residents' tickets (NOT_FOUND) and blocks wrong roles (FORBIDDEN)", async () => {
    const { cudan, lethuha, tiepnhan, kythuat, vesinh } = actors;
    const mine = expectOk(await submit(cudan, "Rác ở hành lang chưa được thu gom"));
    expect(await wf.cancelTicket(db, lethuha, mine.id)).toMatchObject({ code: "NOT_FOUND" });
    expect(await wf.addExtra(db, lethuha, mine.id, "x")).toMatchObject({ code: "NOT_FOUND" });
    expect(await submit(tiepnhan, "Nhân viên không được gửi phản ánh")).toMatchObject({ code: "FORBIDDEN" });
    expect(await wf.routeTicket(db, cudan, mine.id, "ve_sinh")).toMatchObject({ code: "FORBIDDEN" });
    expect(await wf.askMoreInfo(db, kythuat, mine.id)).toMatchObject({ code: "FORBIDDEN" });

    expectOk(await wf.routeTicket(db, tiepnhan, mine.id, "ve_sinh"));
    // Technical cannot see a cleaning ticket at all
    expect(await wf.assignStaff(db, kythuat, mine.id, await staffId("Kỹ thuật viên 1"))).toMatchObject({ code: "NOT_FOUND" });
    // Cleaning cannot assign a technician
    expect(await wf.assignStaff(db, vesinh, mine.id, await staffId("Kỹ thuật viên 1"))).toMatchObject({ code: "INVALID_INPUT" });
    expect(await wf.startTicket(db, vesinh, mine.id)).toMatchObject({ code: "FORBIDDEN" });
  });

  it("serves photos only within scope", async () => {
    const { cudan, lethuha, vesinh, kythuat, tiepnhan } = actors;
    const r = expectOk(await submit(cudan, "Rác ở hành lang chưa được thu gom", { photos: [{ name: "a.png", data: PNG }] }));
    const [p] = await db.select({ id: photos.id }).from(photos).where(eq(photos.ticketId, r.id));
    expect(await wf.photoFor(db, cudan, p.id)).not.toBeNull();
    expect(await wf.photoFor(db, tiepnhan, p.id)).not.toBeNull();
    expect(await wf.photoFor(db, lethuha, p.id)).toBeNull();
    expect(await wf.photoFor(db, vesinh, p.id)).toBeNull(); // not routed yet
    expectOk(await wf.routeTicket(db, tiepnhan, r.id, "ve_sinh"));
    expect(await wf.photoFor(db, vesinh, p.id)).not.toBeNull();
    expect(await wf.photoFor(db, kythuat, p.id)).toBeNull();
  });
});

describe("stage preconditions", () => {
  it("returns CONFLICT when the stage does not allow the action", async () => {
    const { cudan, vesinh, tiepnhan } = actors;
    const inProgress = await idOf("Vòi nước bồn rửa bị rò rỉ, nước thấm xuống sàn bếp"); // stage 4, cudan
    expect(await wf.cancelTicket(db, cudan, inProgress)).toMatchObject({ code: "CONFLICT" });
    expect(await wf.acceptTicket(db, cudan, inProgress)).toMatchObject({ code: "CONFLICT" });
    const fresh = expectOk(await submit(cudan, "Rác ở hành lang chưa được thu gom"));
    expect(await wf.finishTicket(db, vesinh, fresh.id)).toMatchObject({ code: "NOT_FOUND" }); // not routed to cleaning yet
    expectOk(await wf.cancelTicket(db, cudan, fresh.id));
    expect(await wf.routeTicket(db, tiepnhan, fresh.id, "ve_sinh")).toMatchObject({ code: "CONFLICT" });
    expect(await wf.addExtra(db, cudan, fresh.id, "thêm")).toMatchObject({ code: "CONFLICT" });
  });

  it("returns CONFLICT when another writer changes the ticket mid-action", async () => {
    const { cudan, tiepnhan } = actors;
    const r = expectOk(await submit(cudan, "Rác ở hành lang chưa được thu gom"));
    // Another session holds the row, routes it, and commits while our action is waiting
    const other = await pool.connect();
    try {
      await other.query("begin");
      await other.query("select id from tickets where id = $1 for update", [r.id]);
      const racing = wf.routeTicket(db, tiepnhan, r.id, "ky_thuat");
      await new Promise((res) => setTimeout(res, 300));
      await other.query("update tickets set stage = 2, dept = 've_sinh' where id = $1", [r.id]);
      await other.query("commit");
      expect(await racing).toMatchObject({ code: "CONFLICT" });
    } finally {
      other.release();
    }
    expect(await ticket(r.id)).toMatchObject({ stage: 2, dept: "ve_sinh" });
    expect(await historyCount(r.id)).toBe(2);
  });
});

describe("reception tools", () => {
  it("asks for more info, then the resident's extra puts it back in the inbox", async () => {
    const { cudan, tiepnhan } = actors;
    const r = expectOk(await submit(cudan, "Có vấn đề ở khu vực chung, nhờ xem giúp"));
    expectOk(await wf.askMoreInfo(db, tiepnhan, r.id));
    expect((await ticket(r.id)).needInfo).toBe(true);
    expect(await wf.askMoreInfo(db, tiepnhan, r.id)).toMatchObject({ code: "CONFLICT" });
    expectOk(await wf.addExtra(db, cudan, r.id, "Đèn sân chơi bị hỏng"));
    expect(await ticket(r.id)).toMatchObject({ needInfo: false, extras: ["Đèn sân chơi bị hỏng"] });
  });

  it("toggles urgency only on new tickets", async () => {
    const r = expectOk(await submit(actors.cudan, "Rác ở hành lang chưa được thu gom"));
    expectOk(await wf.setUrgent(db, actors.tiepnhan, r.id, true));
    expect((await ticket(r.id)).urgent).toBe(true);
    expect(await wf.setUrgent(db, actors.tiepnhan, r.id, true)).toMatchObject({ code: "CONFLICT" });
  });

  it("merges only a duplicate the Agent proposed", async () => {
    const { cudan, tiepnhan, lethuha } = actors;
    const a = expectOk(await submit(cudan, "Rác ở hành lang tầng 12 chưa thu gom"));
    const b = expectOk(await submit(lethuha, "Phòng rác tầng 12 tòa S2.05 đầy rác"));
    const proposed = await wf.duplicatesFor(db, await ticket(b.id));
    expect(proposed.map((m) => m.id)).toContain(a.id);
    expect(await wf.mergeTicket(db, tiepnhan, b.id, b.id)).toMatchObject({ code: "INVALID_INPUT" });
    // Not proposed: different department and place
    const other = await idOf("Mất điện toàn bộ tầng 7, nghi chập tủ điện");
    expect(await wf.mergeTicket(db, tiepnhan, b.id, other)).toMatchObject({ code: "INVALID_INPUT" });
    expectOk(await wf.mergeTicket(db, tiepnhan, b.id, a.id));
    expect(await ticket(b.id)).toMatchObject({ cancelled: true, mergedInto: a.id });
    const target = await ticket(a.id);
    expect(target.mergedFrom).toEqual([b.id]);
    expect(target.extras[0]).toMatch(/^\[Gộp từ PA-\d{4}\] Phòng rác tầng 12/);
  });

  it("stops proposing a pair reception marked as not duplicate", async () => {
    const { tiepnhan, kythuat } = actors;
    const lift = await idOf("Thang máy số 2 dừng giữa chừng, cửa không mở, có người bên trong"); // seed pair
    const [m] = await wf.duplicatesFor(db, await ticket(lift));
    const older = await idOf("Thang máy số 2 bị kẹt giữa tầng 9 và tầng 10, có người bên trong");
    expect(m.id).toBe(older);
    expect(await wf.dismissDuplicate(db, kythuat, lift, older)).toMatchObject({ code: "FORBIDDEN" });
    expectOk(await wf.dismissDuplicate(db, tiepnhan, lift, older));
    expect(await wf.duplicatesFor(db, await ticket(lift))).toEqual([]);
    expect(await wf.dismissDuplicate(db, tiepnhan, lift, older)).toMatchObject({ code: "CONFLICT" });
    expect(await wf.mergeTicket(db, tiepnhan, lift, older)).toMatchObject({ code: "INVALID_INPUT" });
  });

  it("proposes an in-progress ticket of the same place as the original", async () => {
    const corridor = await idOf("Hành lang tầng 5 tòa S1.03 có mùi hôi và nhiều gián"); // seed, stage 1
    const [m] = await wf.duplicatesFor(db, await ticket(corridor));
    expect(m.id).toBe(await idOf("Hành lang tầng 5 bẩn, xuất hiện nhiều gián gần phòng rác")); // stage 4
    expect(m.reasons).toContain("Cùng từ khóa: gián");
  });
});

describe("departments and management", () => {
  it("management starts, finishes and reassigns its own tickets", async () => {
    const { quanly } = actors;
    const noise = await idOf("Căn hộ bên cạnh gây ồn sau 23h nhiều ngày liền"); // bql, stage 2
    expectOk(await wf.startTicket(db, quanly, noise));
    expectOk(await wf.finishTicket(db, quanly, noise));
    expect((await ticket(noise)).stage).toBe(5);
    const card = await idOf("Đăng ký thẻ cư dân cho người thân mới chuyển đến"); // bql, stage 2
    expect(await wf.reassignTicket(db, quanly, card, "bql")).toMatchObject({ code: "INVALID_INPUT" });
    expectOk(await wf.reassignTicket(db, quanly, card, "ky_thuat"));
    expect(await ticket(card)).toMatchObject({ dept: "ky_thuat", stage: 2, assigneeId: null });
    expect(await wf.reassignTicket(db, quanly, card, "ve_sinh")).toMatchObject({ code: "NOT_FOUND" }); // no longer BQL's
  });

  it("technical requests and receives materials", async () => {
    const { kythuat, vesinh } = actors;
    const outage = await idOf("Mất điện toàn bộ tầng 7, nghi chập tủ điện"); // ky_thuat, stage 2
    expect(await wf.requestMaterial(db, kythuat, outage, "Aptomat 63A")).toMatchObject({ code: "CONFLICT" }); // not in progress
    expectOk(await wf.assignStaff(db, kythuat, outage, await staffId("Kỹ thuật viên 1")));
    expect(await wf.requestMaterial(db, kythuat, outage, "  ")).toMatchObject({ code: "INVALID_INPUT" });
    expectOk(await wf.requestMaterial(db, kythuat, outage, "Aptomat 63A"));
    const [m] = await db.select().from(materials).where(and(eq(materials.ticketId, outage), eq(materials.item, "Aptomat 63A")));
    expect(m.staffId).toBe(await staffId("Kỹ thuật viên 1"));
    expect(await wf.receiveMaterial(db, vesinh, m.id)).toMatchObject({ code: "FORBIDDEN" });
    expectOk(await wf.receiveMaterial(db, kythuat, m.id));
    expect(await wf.receiveMaterial(db, kythuat, m.id)).toMatchObject({ code: "CONFLICT" });
  });

  it("clears a pause when the department finishes", async () => {
    const lamp = await idOf("Sảnh thang máy tầng 12 có đèn hỏng"); // paused, stage 4
    expect((await ticket(lamp)).paused).toBe(true);
    expectOk(await wf.finishTicket(db, actors.kythuat, lamp));
    expect(await ticket(lamp)).toMatchObject({ paused: false, pausedUntil: null, stage: 5 });
  });
});

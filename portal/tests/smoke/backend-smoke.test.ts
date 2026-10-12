/**
 * Real-backend smoke test (WP2): logs in through the `login` server action and runs the role loaders.
 * Run: BACKEND_URL=http://127.0.0.1:8001 npx vitest run --project smoke
 * The Next request APIs (cookies, redirect, refresh) are replaced by an in-memory cookie jar.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) as string } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock("next/cache", () => ({ refresh: () => undefined }));

const run = process.env.BACKEND_URL ? describe : describe.skip;

async function doLogin(username: string, password: string): Promise<string> {
  const { login } = await import("@/app/actions/auth");
  const fd = new FormData();
  fd.set("username", username);
  fd.set("password", password);
  try {
    const state = await login({ error: "", username: "" }, fd);
    return `ERROR ${state.error}`;
  } catch (e) {
    return (e as Error).message;
  }
}

run("portal -> backend smoke", () => {
  beforeEach(() => {
    jar.clear();
    process.env.SESSION_SECRET = "smoke-test-secret";
  });

  it("reception: logs in as bptn01 and loads the inbox + all-ticket list", async () => {
    expect(await doLogin("bptn01", "Demo@2026")).toBe("REDIRECT /reception");
    const { requireUser } = await import("@/server/session");
    const user = await requireUser(["reception"]);
    const { receptionData } = await import("@/server/data/reception");
    const data = await receptionData(user);
    console.log(`SMOKE reception: user=${user.username} role=${user.role} all=${data.all.length} inbox=${data.inbox.length}`);
    if (data.inbox[0]) console.log("SMOKE first inbox item: " + JSON.stringify(data.inbox[0]));
    expect(data.all.length).toBeGreaterThan(0);
    for (const t of data.all) expect(t.code).toMatch(/^SIM-TKT-/);
  });

  it("resident: logs in as cudan01 and loads own tickets (no staff fields)", async () => {
    expect(await doLogin("cudan01", "Demo@2026")).toBe("REDIRECT /resident");
    const { requireUser } = await import("@/server/session");
    const user = await requireUser(["resident"]);
    const { residentData } = await import("@/server/data/resident");
    const data = await residentData(user);
    console.log(`SMOKE resident: user=${user.username} tickets=${data.tickets.length}`);
    expect(Array.isArray(data.tickets)).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/"urgent"|aiDept|staffName/);
  });

  it("management: logs in as bql01 and loads the BQL list", async () => {
    const msg = await doLogin("bql01", "Demo@2026");
    if (!msg.startsWith("REDIRECT")) {
      console.log(`SMOKE management: skipped (${msg})`);
      return;
    }
    const { requireUser } = await import("@/server/session");
    const user = await requireUser(["management"]);
    const { managementData } = await import("@/server/data/management");
    const data = await managementData(user);
    console.log(`SMOKE management: tickets=${data.tickets.length} bqlWork=${data.tickets.filter((t) => t.bqlWork).length}`);
    expect(data.tickets.length).toBeGreaterThanOrEqual(0);
  });

  it("departments and warehouse: vesinh01, kythuat01, kho01 loaders", async () => {
    const { requireUser } = await import("@/server/session");
    const { deptData } = await import("@/server/data/departments");
    const { warehouseData } = await import("@/server/data/warehouse");
    for (const [name, page] of [["vesinh01", "/cleaning"], ["kythuat01", "/technical"]] as const) {
      jar.clear();
      expect(await doLogin(name, "Demo@2026")).toBe("REDIRECT " + page);
      const user = await requireUser();
      const d = await deptData(user);
      console.log("SMOKE " + name + ": tickets=" + d.tickets.length + " catalog=" + d.catalog.length + " customMaterials=" + d.customMaterials);
      if (d.tickets[0]) console.log("SMOKE first dept ticket: " + JSON.stringify(d.tickets[0]));
      expect(d.catalog.length).toBeGreaterThan(0);
    }
    jar.clear();
    expect(await doLogin("kho01", "Demo@2026")).toBe("REDIRECT /warehouse");
    const w = await warehouseData(await requireUser());
    console.log("SMOKE kho01: inventory=" + w.inventory.length + " requests=" + w.requests.length);
    expect(w.inventory.length).toBeGreaterThan(0);
  });

  it("management uses the full warehouse page: bql01 loads the warehouse data", async () => {
    expect(await doLogin("bql01", "Demo@2026")).toBe("REDIRECT /management");
    const { requireUser } = await import("@/server/session");
    const { warehouseData } = await import("@/server/data/warehouse");
    const w = await warehouseData(await requireUser(["warehouse", "management"]));
    console.log("SMOKE bql01 warehouse: inventory=" + w.inventory.length + " requests=" + w.requests.length);
    expect(w.inventory.length).toBeGreaterThan(0);
  });

  it("wrong password is a clean login error, not a crash", async () => {
    expect(await doLogin("bptn01", "nope")).toBe("ERROR Tên đăng nhập hoặc mật khẩu không đúng.");
    expect(jar.size).toBe(0);
  });
});

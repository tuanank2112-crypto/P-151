import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
const jar = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => jar }));
import { backendFetch, backendResponse, BackendError } from "@/server/backend-client";
import { portalUser, displayStage, type PythonMe } from "@/server/backend-dto";
import { createSession, getSessionUser, destroySession } from "@/server/session";
const me: PythonMe = { actor_id: "SIM-ACTOR-TECH-01", username: "kythuat01", display_name: "Kỹ thuật", role: "DEPARTMENT", department_id: "DEPT_TECHNICAL" };
beforeEach(() => { vi.stubEnv("BACKEND_URL", "http://127.0.0.1:8018"); jar.get.mockReturnValue({ value: "private-test-token" }); vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("Python portal boundary", () => {
  it("maps all six roles, string actor ID, rejects unknown and QA", () => {
    const pairs: [string,string|null,string][] = [["RESIDENT",null,"resident"],["BPTN",null,"reception"],["BQL",null,"management"],["WAREHOUSE",null,"warehouse"],["DEPARTMENT","DEPT_CLEANING","cleaning"],["DEPARTMENT","DEPT_TECHNICAL","technical"]];
    for (const [role, dept, expected] of pairs) expect(portalUser({ ...me, role, department_id: dept })?.role).toBe(expected);
    expect(portalUser({ ...me, role: "unknown" })).toBeNull(); expect(portalUser({ ...me, role: "QA_INTERNAL" })).toBeNull(); expect(portalUser(me)?.id).toBe(me.actor_id);
  });
  it("uses server token, no-store and removes spoofed headers", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}"));
    await backendResponse("/api/v1/mo/tickets", { headers: { Authorization: "Bearer fake", "X-Actor-Id": "fake", Cookie: "fake" } });
    const [url, init] = vi.mocked(fetch).mock.calls[0]; const h = new Headers(init?.headers);
    expect(String(url)).toBe("http://127.0.0.1:8018/api/v1/mo/tickets"); expect(h.get("Authorization")).toBe("Bearer private-test-token"); expect(h.has("X-Actor-Id")).toBe(false); expect(h.has("Cookie")).toBe(false); expect(init?.cache).toBe("no-store");
  });
  it("rejects arbitrary destinations before fetch", async () => {
    for (const p of ["https://evil.example", "//evil.example", "/api/v1/../secret", "/api/v1/%2e%2e/secret", "/api/v1/\\secret"]) await expect(backendResponse(p)).rejects.toBeInstanceOf(BackendError);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([401,403,404,409,422,503])("preserves error status %s", async (status) => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ detail: { code: "TEST_ERROR", message: "Rejected" } }), { status }));
    await expect(backendFetch("/api/v1/mo/tickets")).rejects.toMatchObject({ status, code: "TEST_ERROR", message: "Rejected" });
  });
  it("redacts validation inputs and handles 204", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ detail: [{ input: "secret-password", loc: ["body","password"], msg: "Invalid", type: "invalid" }] }), { status: 422 })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await backendFetch("/api/v1/auth/login").catch((e: BackendError) => expect(JSON.stringify(e.detail)).not.toContain("secret-password")); expect(await backendFetch("/api/v1/auth/logout", { method: "POST" })).toBeUndefined();
  });
  it("does not retry mutations on network failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network")); await expect(backendFetch("/api/v1/mo/tickets/x/accept", { method: "POST" })).rejects.toMatchObject({ status: 503 }); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("sets exact Python TTL and HttpOnly cookie flags", async () => {
    vi.stubEnv("SESSION_COOKIE_SECURE", "false"); await createSession("private-test-token", 28800); expect(jar.set).toHaveBeenCalledWith("python_portal_session", "private-test-token", { maxAge: 28800, httpOnly: true, sameSite: "lax", secure: false, path: "/" });
  });
  it("revalidates me without returning a token", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(me))); const user = await getSessionUser(); expect(user?.id).toBe(me.actor_id); expect(JSON.stringify(user)).not.toContain("private-test-token"); vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 401 })); expect(await getSessionUser()).toBeNull();
  });
  it("clears cookie when logout cannot connect", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network")); await expect(destroySession()).rejects.toMatchObject({ status: 503 }); expect(jar.delete).toHaveBeenCalledWith("python_portal_session");
  });
  it("keeps merged and cancelled distinct from completed", () => {
    expect(displayStage("ON_HOLD")).toBe(2); expect(displayStage("ROUTED")).toBe(3); expect(displayStage("MERGED")).toBeNull(); expect(displayStage("CANCELLED")).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/session", () => ({
  getToken: async () => "t",
  clearSessionCookie: async () => undefined,
}));

import { api, READ_TIMEOUT_MS, WRITE_TIMEOUT_MS } from "@/server/backend";

// Plan 27: a resident report waits for the reasoning agent (16-20 s), so writes must outlive the 15 s read limit.
describe("backend timeouts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function spyTimeout() {
    vi.stubEnv("BACKEND_URL", "http://backend.test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
    return vi.spyOn(AbortSignal, "timeout");
  }

  it("gives a write (POST) at least 60 s", async () => {
    const timeout = spyTimeout();
    await api("/resident/tickets", { json: { content: "den hanh lang tang 12 tat het roi" } });
    expect(timeout).toHaveBeenCalledWith(WRITE_TIMEOUT_MS);
    expect(WRITE_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
  });

  it("keeps a read (GET) at 15 s", async () => {
    const timeout = spyTimeout();
    await api("/resident/tickets");
    expect(timeout).toHaveBeenCalledWith(READ_TIMEOUT_MS);
    expect(READ_TIMEOUT_MS).toBe(15_000);
  });

  it("a form upload is a write", async () => {
    const timeout = spyTimeout();
    const form = new FormData();
    form.set("content", "x");
    await api("/resident/tickets", { form });
    expect(timeout).toHaveBeenCalledWith(WRITE_TIMEOUT_MS);
  });
});

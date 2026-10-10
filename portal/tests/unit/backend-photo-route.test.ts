import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), response: vi.fn() }));
vi.mock("@/server/session", () => ({ getSessionUser: mocks.user }));
vi.mock("@/server/backend-client", () => ({ backendResponse: mocks.response, BackendError: class extends Error { status = 503; } }));
import { GET } from "@/app/api/backend-photos/[scope]/[ticketId]/[evidenceId]/route";
import { GET as legacy } from "@/app/api/photos/[id]/route";
const context = (scope = "internal") => ({ params: Promise.resolve({ scope, ticketId: "SIM-TKT-0062", evidenceId: "SIM-EVD-0001" }) });

describe("authenticated Python photo BFF", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue({ role: "technical" }); });
  it("rechecks Python authorization before forwarding an ETag304", async () => {
    mocks.response.mockResolvedValue(new Response(null, { status: 304, headers: { ETag: '"image-1"' } }));
    const result = await GET(new Request("http://localhost/photo", { headers: { "If-None-Match": '"image-1"' } }), context());
    expect(result.status).toBe(304);
    expect(result.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(result.headers.get("ETag")).toBe('"image-1"');
    expect(mocks.response).toHaveBeenCalledWith("/api/v1/mo/tickets/SIM-TKT-0062/photos/SIM-EVD-0001", expect.objectContaining({ headers: expect.any(Headers) }));
    expect(mocks.response.mock.calls[0][1].headers.get("If-None-Match")).toBe('"image-1"');
  });
  it("denies resident access to internal scope without proxying", async () => {
    mocks.user.mockResolvedValue({ role: "resident" });
    expect((await GET(new Request("http://localhost/photo"), context())).status).toBe(403);
    expect(mocks.response).not.toHaveBeenCalled();
  });
  it("preserves backend denial even with conditional cache headers", async () => {
    mocks.response.mockResolvedValue(new Response("Forbidden", { status: 403 }));
    expect((await GET(new Request("http://localhost/photo", { headers: { "If-None-Match": '"image-1"' } }), context())).status).toBe(403);
  });
  it("never looks up legacy integer images in the portal database", async () => {
    expect((await legacy()).status).toBe(410);
    mocks.user.mockResolvedValue(null);
    expect((await legacy()).status).toBe(401);
    expect((await GET(new Request("http://localhost/photo"), context())).status).toBe(401);
    expect(mocks.response).not.toHaveBeenCalled();
  });
  it("rejects arbitrary origins/scopes rather than forwarding them", async () => {
    expect((await GET(new Request("http://localhost/photo"), context("http://attacker"))).status).toBe(404);
    expect(mocks.response).not.toHaveBeenCalled();
  });
});

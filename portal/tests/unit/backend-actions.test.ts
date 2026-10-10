import { describe, expect, it } from "vitest";
import { ticketActionRequest } from "@/lib/backend-actions";

describe("Python action contract", () => {
  it("keeps string identities and exact resident content/rating contract", () => {
    expect(ticketActionRequest("resident", "SIM-TKT-0062", "additions", { content: "Sảnh S2", text: "wrong", actor_id: "BQL" })).toEqual({ path: "/api/v1/resident/tickets/SIM-TKT-0062/additions", body: { content: "Sảnh S2" } });
    expect(ticketActionRequest("resident", "SIM-TKT-0062", "rating", { score: 5, tags: ["ignored"] }).body).toEqual({ score: 5 });
  });
  it("rejects caller role escalation and unapproved workflow transitions", () => {
    expect(() => ticketActionRequest("resident", "SIM-TKT-0062", "close", {})).toThrow("FORBIDDEN");
    expect(() => ticketActionRequest("reception", "SIM-TKT-0062", "accept", {})).toThrow("FORBIDDEN");
    expect(() => ticketActionRequest("management", "SIM-TKT-0062", "transition" as never, {})).toThrow("INVALID_INPUT");
    expect(() => ticketActionRequest("management", "SIM-TKT-0062", "__proto__" as never, {})).toThrow("INVALID_INPUT");
  });
  it("replaces material usage once, retaining only actual quantity and catalog code", () => {
    expect(ticketActionRequest("technical", "SIM-TKT-0062", "material-usage", { lines: [{ item_code: "LIGHT", used_qty: 4, issued_qty: 9, actor_id: "spoof" }], note: "ignored" })).toEqual({ path: "/api/v1/mo/tickets/SIM-TKT-0062/material-usage", body: { lines: [{ item_code: "LIGHT", used_qty: 4 }] } });
  });
  it("encodes checklist identifier while preserving backend status/note", () => {
    expect(ticketActionRequest("cleaning", "SIM-TKT-0062", "checklist", { template_item_id: "CLN/A", status: "DONE", note: "ok" })).toEqual({ path: "/api/v1/mo/tickets/SIM-TKT-0062/checklist/CLN%2FA", body: { status: "DONE", note: "ok" } });
    expect(() => ticketActionRequest("technical", "SIM-TKT-0062", "checklist", { status: "DONE" })).toThrow("INVALID_INPUT");
  });
  it("uses BQL emergency endpoints and field-specific cancellation", () => {
    expect(ticketActionRequest("management", "SIM-TKT-0062", "emergency-downgrade", { note: "verified", actor_id: "x" })).toEqual({ path: "/api/v1/bql/tickets/SIM-TKT-0062/emergency/downgrade", body: { note: "verified" } });
    expect(ticketActionRequest("management", "SIM-TKT-0062", "cancel", { cancel_reason: "out of scope", note: "wrong" }).body).toEqual({ cancel_reason: "out of scope" });
  });
  it("does not fabricate acceptance/complete bodies or numeric ticket IDs", () => {
    expect(ticketActionRequest("technical", "SIM-TKT-0062", "complete", { force: true }).body).toBeUndefined();
    expect(() => ticketActionRequest("technical", 62 as never, "accept", {})).toThrow("INVALID_INPUT");
  });
});

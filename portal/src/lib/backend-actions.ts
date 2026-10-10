export type TicketAction = "additions" | "rating" | "accept" | "return" | "checklist" | "material-usage" | "evidence" | "complete" | "close" | "rework" | "cancel" | "emergency-close" | "emergency-downgrade" | "bptn-resolve" | "safety" | "priority" | "block" | "resume-work";
export type BackendActionResult<T = unknown> = { ok: true; data: T } | { ok: false; code: string; message: string; status: number; data?: T };

const department = ["cleaning", "technical"];
const routes: Record<TicketAction, { roles: string[]; prefix: string; suffix?: string; fields: string[] }> = {
  additions: { roles: ["resident"], prefix: "resident", fields: ["content"] },
  rating: { roles: ["resident"], prefix: "resident", fields: ["score"] },
  accept: { roles: department, prefix: "mo", fields: [] },
  return: { roles: department, prefix: "mo", fields: ["note"] },
  checklist: { roles: department, prefix: "mo", fields: ["status", "note"] },
  "material-usage": { roles: department, prefix: "mo", fields: ["lines"] },
  evidence: { roles: department, prefix: "mo", fields: ["requirement_id", "evidence_type", "content_or_metadata", "readability_status"] },
  complete: { roles: department, prefix: "mo", fields: [] },
  close: { roles: ["management"], prefix: "bql", fields: ["note"] },
  rework: { roles: ["management"], prefix: "bql", fields: ["note"] },
  cancel: { roles: ["management"], prefix: "bql", fields: ["cancel_reason"] },
  "emergency-close": { roles: ["management"], prefix: "bql", suffix: "emergency/close", fields: ["note"] },
  "emergency-downgrade": { roles: ["management"], prefix: "bql", suffix: "emergency/downgrade", fields: ["note"] },
  "bptn-resolve": { roles: ["reception"], prefix: "mo", fields: ["note", "merge", "category", "department", "location", "asset_id", "asset_onsite", "info"] },
  safety: { roles: ["reception", "management"], prefix: "mo", fields: ["decision", "note"] },
  priority: { roles: ["reception", "management"], prefix: "mo", fields: ["priority", "note"] },
  block: { roles: department, prefix: "mo", fields: ["note", "eta"] },
  "resume-work": { roles: department, prefix: "mo", fields: [] },
};

export function ticketActionRequest(role: string, id: string, action: TicketAction, payload: Record<string, unknown>) {
  if (typeof id !== "string" || !id.trim()) throw new Error("INVALID_INPUT");
  if (!Object.hasOwn(routes, action)) throw new Error("INVALID_INPUT");
  const route = routes[action];
  if (!route.roles.includes(role)) throw new Error("FORBIDDEN");
  let suffix = route.suffix ?? action;
  if (action === "checklist") {
    if (typeof payload.template_item_id !== "string" || !payload.template_item_id.trim()) throw new Error("INVALID_INPUT");
    suffix += `/${encodeURIComponent(payload.template_item_id)}`;
  }
  const body = Object.fromEntries(route.fields.filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]));
  // Full replacement in one atomic Python operation; do not forward extra client fields.
  if (action === "material-usage" && Array.isArray(body.lines)) body.lines = body.lines.map((line: unknown) => {
    if (!line || typeof line !== "object") throw new Error("INVALID_INPUT");
    const entry = line as Record<string, unknown>;
    return { item_code: entry.item_code, used_qty: entry.used_qty };
  });
  return { path: `/api/v1/${route.prefix}/tickets/${encodeURIComponent(id)}/${suffix}`, body: route.fields.length ? body : undefined };
}

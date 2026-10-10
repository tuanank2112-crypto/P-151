/** Explicit presentation allowlist. Python Case includes audit and resident identity
 * which must never cross the server-action boundary into department browsers. */
type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};
}
function fields(value: unknown, names: string[]): ObjectValue {
  const source = object(value);
  return Object.fromEntries(names.filter((name) => source[name] !== undefined).map((name) => [name, source[name]]));
}
function rows(value: unknown, names: string[]): ObjectValue[] {
  return Array.isArray(value) ? value.map((entry) => fields(entry, names)) : [];
}

export function caseView(value: unknown): ObjectValue {
  const source = object(value);
  const ticket = object(source.ticket);
  const draft = object(source.draft);
  return {
    ticket: {
      ...fields(ticket, ["ticket_id", "status", "department_id", "risk_level", "priority", "safety_context"]),
      raw: fields(ticket.raw, ["original_description", "created_at"]),
      blocker: ticket.blocker ? fields(ticket.blocker, ["code", "public_message", "owner_role", "escalated"]) : null,
      flags: Array.isArray(ticket.flags) ? ticket.flags.filter((flag) => typeof flag === "string") : [],
    },
    classification: source.classification ? fields(source.classification, ["classification_reason", "location_proposed", "service_category_proposed"]) : null,
    agent_decision: source.agent_decision ? fields(source.agent_decision, ["source"]) : null,
    draft: source.draft ? {
      ...fields(draft, ["location", "scope_summary", "material_requirement_mode"]),
      evidence_requirements: rows(draft.evidence_requirements, ["requirement_id", "allowed_evidence_types"]),
      readiness_evaluation: draft.readiness_evaluation ? fields(draft.readiness_evaluation, ["failing_items"]) : null,
    } : null,
    checklist_items: rows(source.checklist_items, ["template_item_id", "label_snapshot", "required", "status"]),
    material_lines: rows(source.material_lines, ["item_code", "item_name", "used_qty"]),
    evidence: rows(source.evidence, ["evidence_id", "evidence_type", "source", "content_or_metadata"]),
    events: rows(source.events, ["status", "public_message", "created_at"]),
  };
}

/** ResidentTicketView already has Python's privacy policy; never supplement it
 * from an internal Case. Stock receipt returns a list of affected Cases. */
export function presentationResponse(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(presentationResponse);
  return Object.hasOwn(object(value), "ticket") ? caseView(value) : value;
}

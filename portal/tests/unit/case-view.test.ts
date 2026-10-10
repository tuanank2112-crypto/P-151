import { describe, expect, it } from "vitest";
import { caseView, presentationResponse } from "@/lib/case-view";

const secret = "PRIVATE_RESIDENT_AND_ACTOR";
const input = {
  ticket: { ticket_id: "SIM-TKT-0062", status: "IN_PROGRESS", resident_id: secret, raw: { original_description: "Đèn hỏng", created_at: "2026-10-10", resident_id: secret, channel: "form" }, department_id: "DEPT_TECHNICAL", risk_level: "NONE", priority: "NORMAL", safety_context: true, flags: [], blocker: { code: "SAFETY_REVIEW_REQUIRED", owner_role: "BQL", public_message: "Cần BQL", escalated: true, internal_message: secret }, safety_cleared_by: secret },
  audit: [{ actor_id: secret }], additions: [{ actor_id: secret }],
  classification: { classification_reason: "Đèn", location_proposed: "S2", service_category_proposed: "LIGHT", actor_id: secret },
  agent_decision: { source: "OPENAI", prompt: secret, raw_response: secret },
  draft: { location: "S2", scope_summary: "Sửa đèn", actor_id: secret, evidence_requirements: [{ requirement_id: "NOTE", allowed_evidence_types: ["TEXT_NOTE"], author: secret }], readiness_evaluation: { failing_items: ["photo_missing"], audited_by: secret } },
  checklist_items: [{ template_item_id: "CHECK", label_snapshot: "Kiểm tra", required: true, status: "DONE", updated_by: secret }],
  material_lines: [{ item_code: "LIGHT", item_name: "Bóng đèn", used_qty: 4, norm_qty: 1, actor_id: secret }],
  evidence: [{ evidence_id: "SIM-EVD-1", evidence_type: "SIMULATED_IMAGE", source: "DEPARTMENT_EXECUTION", content_or_metadata: "photo", actor_id: secret }],
  events: [{ status: "ROUTED", public_message: "Đã giao", created_at: "2026-10-10", actor_id: secret, internal_message: secret }],
};

describe("presentation Case privacy boundary", () => {
  it("removes identities, audit, prompts and private fields recursively from Case", () => {
    const projected = caseView(input);
    expect(JSON.stringify(projected)).not.toContain(secret);
    expect(projected).not.toHaveProperty("audit");
    expect(projected.ticket).not.toHaveProperty("resident_id");
    expect(projected).toMatchObject({ ticket: { ticket_id: "SIM-TKT-0062", blocker: { owner_role: "BQL", escalated: true }, safety_context: true }, material_lines: [{ used_qty: 4 }], draft: { readiness_evaluation: { failing_items: ["photo_missing"] } } });
  });
  it("preserves safe resident views without constructing internal fields", () => {
    const resident = { ticket_id: "SIM-TKT-0062", description: "Đèn hỏng", allowed_actions: ["ADD_PHOTO"] };
    expect(presentationResponse(resident)).toBe(resident);
    expect(presentationResponse(resident)).not.toHaveProperty("ticket");
  });
  it("minimizes every affected Case returned by a stock receipt", () => {
    const results = presentationResponse([input, input]);
    expect(results).toHaveLength(2);
    expect(JSON.stringify(results)).not.toContain(secret);
  });
});

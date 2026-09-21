// scripts/_fixtures.mjs — fixture dùng chung cho các script chạy pipeline
// trên kho mock (probe_defects, trace_sample, eval_golden). Khớp tài khoản
// demo cư dân của `scripts/seed_users.mjs` (OPERATIONS.md §4.1, NG-09) — vai
// `resident`, đúng một căn hộ sở hữu.
export const DEMO_RESIDENT_PRINCIPAL = {
  user_id: "demo-resident-0001",
  role: "resident",
  resident_id: "R-0001",
  owned_property_ids: ["S1.120817"],
  property_type: ["apartment"],
};

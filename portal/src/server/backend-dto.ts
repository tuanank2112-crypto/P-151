/** Pure Python response types; safe in client components. */
export type PortalRole = "resident" | "reception" | "management" | "warehouse" | "cleaning" | "technical";
export type SessionUser = { id: string; username: string; name: string; role: PortalRole; departmentId: string | null; tower: null; floor: null; apartment: null };
export type PythonMe = { username: string; display_name: string; actor_id: string; role: string; department_id: string | null };
export type LoginResponse = { access_token: string; expires_in: number; token_type: string; user: PythonMe };
export type DemoAccounts = { shared_test_password: string | null; accounts: { username: string; display_name: string; role: string }[] };
export type TicketSummary = { ticket_id: string; status: string; status_label: string; reason_code: string | null; department_id: string | null; proposed_department_id: string | null; escalated: boolean; risk_level: string | null; priority: string | null; created_at: string; description: string; flow?: string | null };
export type ResidentTicketView = { ticket_id: string; created_at: string; description: string; additions: string[]; photos: string[]; status: string; status_label: string; department_name: string | null; public_message: string; eta: string | null; timeline: { status: string; status_label: string; public_message: string; created_at: string }[]; allowed_actions: string[]; merged_into?: { ticket_id: string; status?: string; status_label?: string } | null; split_from?: { ticket_id: string } | null; split_into?: { ticket_id: string }[]; follow_up_of?: { ticket_id: string } | null };
export type CatalogView = { departments: Record<string, string>; assets: { asset_id: string; name: string; area: string }[]; status_labels: Record<string, string>; materials: { item_code: string; item_name: string }[]; material_codes_by_department: Record<string, string[]> };
export type StockItem = { item_code: string; item_name: string; unit: string; qty: number | null };
export type BqlTicketRow = { ticket_id: string; status: string; status_label: string; department_id: string | null; proposed_department_id: string | null; blocker: { code: string; public_message: string; owner_role?: string } | null; blocker_owner_role: string | null; escalated: boolean; overdue: boolean; created_at: string; risk_level: string; priority: string | null; [field: string]: unknown };
export type DashboardData = { user: SessionUser; tickets: TicketSummary[]; residentTickets?: ResidentTicketView[]; catalog?: CatalogView; stock?: StockItem[]; bqlTickets?: BqlTicketRow[] };
export function portalUser(me: PythonMe): SessionUser | null {
  const roles: Record<string, PortalRole> = { RESIDENT: "resident", BPTN: "reception", BQL: "management", WAREHOUSE: "warehouse" };
  const role = me.role === "DEPARTMENT" ? ({ DEPT_CLEANING: "cleaning", DEPT_TECHNICAL: "technical" } as Record<string, PortalRole>)[me.department_id ?? ""] : roles[me.role];
  if (!role) return null;
  return { id: me.actor_id, username: me.username, name: me.display_name, role, departmentId: me.department_id, tower: null, floor: null, apartment: null };
}
export function displayStage(status: string): number | null {
  return ({ RECEIVED: 1, NEED_INFO: 2, VERIFYING: 2, ON_HOLD: 2, ROUTED: 3, IN_PROGRESS: 4, READY_FOR_REVIEW: 5, CLOSED: 6 } as Record<string, number>)[status] ?? null;
}

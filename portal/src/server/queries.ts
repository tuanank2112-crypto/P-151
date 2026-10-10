import "server-only";
import { redirect } from "next/navigation";
import { backendFetch, BackendError } from "./backend-client";
import type { BqlTicketRow, CatalogView, DashboardData, ResidentTicketView, SessionUser, StockItem, TicketSummary } from "./backend-dto";
async function read<T>(path: string): Promise<T> {
  try { return await backendFetch<T>(path); }
  catch (error) { if (error instanceof BackendError && error.status === 401) redirect("/login"); throw error; }
}
export async function residentData(user: SessionUser): Promise<DashboardData> {
  const residentTickets = await read<ResidentTicketView[]>("/api/v1/resident/tickets");
  return { user, residentTickets, tickets: residentTickets.map((t) => ({ ticket_id: t.ticket_id, status: t.status, status_label: t.status_label, created_at: t.created_at, description: t.description, reason_code: null, department_id: null, proposed_department_id: null, escalated: false, risk_level: null, priority: null })) };
}
async function staffData(user: SessionUser): Promise<DashboardData> {
  const [tickets, catalog, stock] = await Promise.all([read<TicketSummary[]>("/api/v1/mo/tickets"), read<CatalogView>("/api/v1/mo/catalog"), read<StockItem[]>("/api/v1/mo/warehouse/stock")]);
  return { user, tickets, catalog, stock };
}
export const receptionData = staffData;
export const deptData = staffData;
export async function managementData(user: SessionUser): Promise<DashboardData> {
  const [data, bqlTickets] = await Promise.all([staffData(user), read<BqlTicketRow[]>("/api/v1/bql/tickets")]);
  return { ...data, bqlTickets };
}
export async function warehouseData(user: SessionUser): Promise<DashboardData> {
  return staffData(user);
}

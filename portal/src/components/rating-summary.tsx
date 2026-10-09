import type { DeptTicket } from "@/lib/dto";

/**
 * Completed department card. The backend does not give departments the resident's rating (CR-BPTN-03: one score,
 * resident-only), so this only says where the ticket stands.
 */
export function Feedback({ t }: { t: Pick<DeptTicket, "stage"> }) {
  return <span className="text-[13px] text-muted">{t.stage === 5 ? "Chờ Ban quản lý nghiệm thu." : "Đã hoàn tất."}</span>;
}

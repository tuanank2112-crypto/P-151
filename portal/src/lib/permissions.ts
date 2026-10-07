import type { Role } from "./constants";

/**
 * Role permissions, from Management.dc.html PERMS. The "Phân quyền" tab was removed (user 2026-10-07) and so was
 * "Sửa từ khóa của Agent": classification and duplicates are proposed by the Agent, reception only approves.
 */
export const PERMISSIONS = [
  { key: "submit_ticket", label: "Gửi phản ánh", roles: ["resident"] },
  { key: "view_own", label: "Xem ticket của chính mình", roles: ["resident", "reception", "management", "cleaning", "technical"] },
  { key: "view_agent", label: "Xem gợi ý của Agent", roles: ["resident", "reception", "management", "cleaning", "technical"] },
  { key: "route_ticket", label: "Phân loại và chuyển ticket", roles: ["reception", "management"] },
  { key: "update_progress", label: "Nhận và cập nhật tiến độ ticket", roles: ["management", "cleaning", "technical"] },
  { key: "assign_staff", label: "Phân công nhân viên xử lý", roles: ["cleaning", "technical"] },
  { key: "view_all", label: "Xem toàn bộ ticket", roles: ["management"] },
  { key: "view_reports", label: "Xem báo cáo hiệu suất", roles: ["reception", "management"] },
  { key: "manage_notices", label: "Đăng thông báo, phân quyền", roles: ["management"] },
] as const satisfies readonly { key: string; label: string; roles: readonly Role[] }[];

export type Permission = (typeof PERMISSIONS)[number]["key"];

export function can(role: Role, perm: Permission): boolean {
  const p = PERMISSIONS.find((x) => x.key === perm);
  return !!p && (p.roles as readonly Role[]).includes(role);
}

// lib/pipeline/ownership.ts — checkOwnership() theo Đ06 (đảo nội hàm
// `pii_or_account_specific`): chặn khi câu hỏi chạm DỮ LIỆU NGƯỜI KHÁC,
// không chặn theo LOẠI dữ liệu (00-ARCHITECTURE.md §6, 01-CONTRACTS §5 E-7).

import type { Principal } from "../types.ts";

export interface OwnershipTargets {
  resident_ids: string[];
  property_ids: string[];
}

export interface OwnershipResult {
  ok: boolean;
  violated_property_ids: string[];
  violated_resident_ids: string[];
}

/**
 * `bql` (Ban quản lý) không bị chặn bởi Đ06 — vai đó vốn được xem dữ liệu
 * nhiều căn hộ trong phạm vi công việc. Chỉ `resident` bị chặn khi target
 * nhắc tới resident_id/property_id KHÁC chính họ.
 */
export function checkOwnership(targets: OwnershipTargets, principal: Principal): OwnershipResult {
  if (principal.role !== "resident") {
    return { ok: true, violated_property_ids: [], violated_resident_ids: [] };
  }
  const ownedProps = new Set(principal.owned_property_ids);
  const violated_property_ids = targets.property_ids.filter((p) => !ownedProps.has(p));
  const violated_resident_ids = targets.resident_ids.filter(
    (r) => principal.resident_id !== null && r !== principal.resident_id
  );
  const ok = violated_property_ids.length === 0 && violated_resident_ids.length === 0;
  return { ok, violated_property_ids, violated_resident_ids };
}

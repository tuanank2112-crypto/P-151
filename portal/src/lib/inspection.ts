import type { Dept } from "./constants";
import { slaHours } from "./sla";

/** One acceptance check shown to the management board before it closes a ticket */
export type Gate = { key: string; label: string; ok: boolean; detail: string };

export type GateInput = {
  dept: Dept | null;
  disputed?: boolean;
  urgent: boolean;
  afterPhotos: { id: number }[];
  materials: { item: string; received: boolean }[];
  doneHours: number | null;
};

/** The four gates the system can verify from stored data (no hardcoded ticks) */
export function autoGates(t: GateInput): Gate[] {
  const pending = t.materials.filter((m) => !m.received);
  const sla = slaHours(t.urgent);
  return [
    {
      key: "dept",
      label: "Đúng phòng ban xử lý",
      ok: t.dept !== null && !t.disputed,
      detail: t.disputed ? "Đơn vị đang báo sai phòng ban" : t.dept ? "Không có khiếu nại phòng ban" : "Chưa giao phòng ban",
    },
    {
      key: "photo",
      label: "Ảnh minh chứng sau xử lý",
      ok: t.afterPhotos.length > 0,
      detail: t.afterPhotos.length > 0 ? `${t.afterPhotos.length} ảnh hoàn thành` : "Chưa có ảnh hoàn thành",
    },
    {
      key: "material",
      label: "Vật tư đã cấp đủ",
      ok: pending.length === 0,
      detail:
        t.materials.length === 0
          ? "Không yêu cầu vật tư"
          : pending.length > 0
            ? `Còn ${pending.length}/${t.materials.length} món chờ kho cấp`
            : `${t.materials.length} món đã nhận`,
    },
    {
      key: "sla",
      label: "Xong trong hạn SLA",
      ok: t.doneHours !== null && t.doneHours <= sla,
      detail: t.doneHours === null ? "Chưa ghi nhận giờ xong" : `Xong sau ${Math.round(t.doneHours)}h / hạn ${sla}h`,
    },
  ];
}

/** The two gates only a person on site can confirm; approval stays locked until both are ticked */
export const SITE_CHECKS = [
  { key: "site", label: "Hiện trường đã xử lý dứt điểm, sạch sẽ và an toàn" },
  { key: "match", label: "Kết quả khớp nội dung phản ánh của cư dân" },
] as const;

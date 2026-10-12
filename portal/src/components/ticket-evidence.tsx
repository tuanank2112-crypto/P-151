import type { MaterialStatus, TicketDetail } from "@/lib/dto";

export const MATERIAL_STATUS_LABEL: Record<MaterialStatus, string> = {
  none: "Không yêu cầu vật tư",
  pending: "Chờ cấp trên duyệt vật tư",
  waiting_stock: "Chờ kho nhập hàng",
  approved: "Vật tư đã cấp",
};

type Evidence = Pick<TicketDetail, "afterPhotos" | "checklist" | "materials" | "materialStatus">;

/** After-photos, checklist and materials of a ticket; shared by the detail modal and the BQL inspection card */
export function TicketEvidence({
  detail,
  compact = false,
  showPhotos = true,
}: {
  detail: Evidence;
  compact?: boolean;
  showPhotos?: boolean;
}) {
  const doneCount = detail.checklist.filter((c) => c.done).length;
  return (
    <div className={`grid grid-cols-1 gap-3 text-xs text-slate-700 ${showPhotos ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      {showPhotos && (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <span className="mb-2 block font-semibold text-slate-600">Ảnh sau xử lý ({detail.afterPhotos.length})</span>
        {detail.afterPhotos.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {detail.afterPhotos.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="block h-16 w-16 overflow-hidden rounded-lg border border-emerald-300 ring-2 ring-emerald-100 focus-visible:outline-2 focus-visible:outline-sky-600"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- authorized photo route, no optimizer */}
                <img src={p.url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        ) : (
          <p className="m-0 italic text-slate-400">Chưa có ảnh sau xử lý.</p>
        )}
      </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <span className="mb-2 block font-semibold text-slate-600">
          Checklist ({doneCount}/{detail.checklist.length})
        </span>
        {detail.checklist.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {detail.checklist.map((c) => (
              <li key={c.templateItemId} className="flex items-start gap-1.5">
                <span aria-hidden className={c.done ? "text-emerald-600" : "text-slate-400"}>
                  {c.done ? "✓" : "○"}
                </span>
                <span className={c.done ? "" : "text-slate-500"}>
                  {c.label}
                  {c.required ? "" : " (không bắt buộc)"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 italic text-slate-400">Không có checklist.</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <span className="mb-2 block font-semibold text-slate-600">Vật tư · {MATERIAL_STATUS_LABEL[detail.materialStatus]}</span>
        {detail.materials.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {detail.materials.map((m) => (
              <li key={m.itemCode}>
                <span className="font-medium">{m.itemName}</span>: cần {m.plannedQty} {m.unit}
                {m.issuedQty !== null && ` · cấp ${m.issuedQty}`}
                {m.usedQty !== null && ` · đã dùng ${m.usedQty}`}
                {!compact && m.stock !== null && ` · tồn ${m.stock}`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 italic text-slate-400">Không có vật tư.</p>
        )}
      </div>
    </div>
  );
}

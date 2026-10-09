"use client";

import { useState } from "react";
import type { MaterialLineInput } from "@/app/actions/departments";
import { FOCUS, Modal } from "@/app/cleaning/dept-parts";
import type { CatalogItem, DeptTicket } from "@/lib/dto";

type Line = { key: number; custom: boolean; itemCode: string; name: string; unit: string; qty: number };

const BTN = `btn ${FOCUS}`;
const FIELD = `rounded-xl border border-slate-300 bg-white p-2.5 text-sm ${FOCUS}`;
const MAX_QTY = 500;

/** Multi-line material request (SPEC-P03 §4.3): catalog lines with -/+ quantity, optional off-catalog lines, required note */
export function RequestModal(props: {
  t: DeptTicket;
  catalog: CatalogItem[];
  customMaterials: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (lines: MaterialLineInput[], note: string, done: () => void, fail: (msg: string) => boolean) => void;
}) {
  const { catalog } = props;
  const [seq, setSeq] = useState(1);
  const [lines, setLines] = useState<Line[]>(() =>
    catalog.length > 0 ? [{ key: 0, custom: false, itemCode: catalog[0].itemCode, name: "", unit: "", qty: 1 }] : [],
  );
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const patch = (key: number, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const add = (custom: boolean) => {
    setLines((ls) => [...ls, { key: seq, custom, itemCode: custom ? "" : (catalog[0]?.itemCode ?? ""), name: "", unit: "cái", qty: 1 }]);
    setSeq(seq + 1);
  };
  const clamp = (n: number) => Math.max(1, Math.min(MAX_QTY, Math.round(Number.isFinite(n) ? n : 1)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) return setErr("Chọn ít nhất một vật tư.");
    if (lines.some((l) => (l.custom ? !l.name.trim() : !l.itemCode))) return setErr("Mỗi dòng cần chọn hoặc nhập tên vật tư.");
    if (!note.trim()) return setErr("Ghi chú là bắt buộc.");
    setErr("");
    const out: MaterialLineInput[] = lines.map((l) =>
      l.custom ? { newItemName: l.name.trim(), unit: l.unit.trim() || "cái", qty: l.qty } : { itemCode: l.itemCode, qty: l.qty },
    );
    props.onSubmit(out, note.trim(), props.onClose, (m) => (setErr(m), true));
  }

  return (
    <Modal title={`Yêu cầu vật tư ${props.t.code}`} sub="Yêu cầu sẽ chờ cấp trên (Kho hoặc BQL) duyệt cấp." onClose={props.onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        {lines.map((l, i) => {
          const item = catalog.find((c) => c.itemCode === l.itemCode);
          return (
            <div key={l.key} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {l.custom ? (
                <div className="flex flex-wrap gap-2">
                  <input
                    className={`${FIELD} min-w-0 flex-[2_1_160px]`}
                    placeholder="Tên vật tư ngoài danh sách"
                    aria-label={`Tên vật tư khác, dòng ${i + 1}`}
                    value={l.name}
                    onChange={(e) => patch(l.key, { name: e.target.value })}
                  />
                  <input
                    className={`${FIELD} min-w-0 flex-[1_1_90px]`}
                    placeholder="Đơn vị"
                    aria-label={`Đơn vị, dòng ${i + 1}`}
                    value={l.unit}
                    onChange={(e) => patch(l.key, { unit: e.target.value })}
                  />
                </div>
              ) : (
                <select
                  className={`${FIELD} w-full`}
                  aria-label={`Vật tư, dòng ${i + 1}`}
                  value={l.itemCode}
                  onChange={(e) => patch(l.key, { itemCode: e.target.value })}
                >
                  {catalog.map((c) => (
                    <option key={c.itemCode} value={c.itemCode}>
                      {c.itemName} · {c.unit || "—"} · tồn {c.stock ?? "—"}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {!l.custom && item && (
                  <span className={`text-xs ${item.stock === 0 ? "font-semibold text-rose-700" : "text-muted"}`}>
                    Tồn kho: {item.stock ?? "chưa rõ"} {item.unit}
                    {item.stock === 0 ? " · hết hàng" : ""}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1.5">
                  <button type="button" className={`${BTN} !min-h-9 !px-3`} aria-label="Giảm số lượng" onClick={() => patch(l.key, { qty: clamp(l.qty - 1) })}>
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={MAX_QTY}
                    className={`${FIELD} w-16 text-center`}
                    aria-label={`Số lượng, dòng ${i + 1}`}
                    value={l.qty}
                    onChange={(e) => patch(l.key, { qty: clamp(Number(e.target.value)) })}
                  />
                  <button type="button" className={`${BTN} !min-h-9 !px-3`} aria-label="Tăng số lượng" onClick={() => patch(l.key, { qty: clamp(l.qty + 1) })}>
                    +
                  </button>
                  <button
                    type="button"
                    className={`${BTN} !min-h-9 !px-3 text-xs`}
                    aria-label={`Xóa dòng ${i + 1}`}
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {catalog.length === 0 && !props.customMaterials && <p className="m-0 text-xs text-muted">Kho chưa có vật tư nào trong danh sách.</p>}

        <div className="flex flex-wrap gap-2">
          {catalog.length > 0 && (
            <button type="button" className={`${BTN} text-xs`} onClick={() => add(false)}>
              + Thêm dòng
            </button>
          )}
          {props.customMaterials && (
            <button type="button" className={`${BTN} text-xs`} onClick={() => add(true)}>
              + Vật tư khác (ngoài danh sách)
            </button>
          )}
        </div>

        <div>
          <label htmlFor={`req-note-${props.t.id}`} className="mb-1 block text-xs font-semibold text-slate-700">
            Ghi chú <span className="text-rose-600">* (bắt buộc)</span>
          </label>
          <textarea id={`req-note-${props.t.id}`} className={`${FIELD} w-full`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {err && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
            {err}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" className={BTN} onClick={props.onClose}>
            Hủy
          </button>
          <button type="submit" className={`btn primary ${FOCUS}`} disabled={props.pending}>
            Gửi yêu cầu
          </button>
        </div>
      </form>
    </Modal>
  );
}

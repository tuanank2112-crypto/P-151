"use client";

import { useState } from "react";
import { receiveStockAction } from "@/app/actions/warehouse";
import { IconBox } from "@/components/icons";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { Toast } from "@/components/toast";
import { useAction } from "@/components/use-action";
import { ROLE_LABEL } from "@/lib/constants";
import type { WarehouseData, WarehouseItem } from "@/lib/dto";
import { requestSummary } from "@/lib/material-requests";
import { hasLocation, matchesDoneSearch } from "@/lib/reception-done";
import { STOCK_BADGE, byUrgency, restockTone, stockLevel, type RestockTone } from "@/lib/stock";

type Tab = "inventory";
type View = "all" | "restock" | "unknown";

const HEAD: Record<Tab, { title: string; sub: string }> = {
  inventory: {
    title: "Kho vật tư & linh kiện",
    sub: "Danh mục vật tư, số lượng tồn và ngưỡng tồn tối thiểu. Phòng ban tự ghi vật tư đã dùng khi hoàn thành.",
  },
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600";
const chipCls = (on: boolean) =>
  `min-h-9 cursor-pointer rounded-full px-4 text-[13px] font-semibold transition-colors ${FOCUS} ${
    on ? "bg-[#1D4ED8] text-white" : "bg-[#EEF2F7] text-[#2A3447] hover:bg-[#DCE8FF]"
  }`;

const levelOf = (i: WarehouseItem) => stockLevel(i.stock, i.min);
/** "Cần nhập thêm" = out of stock or at/under its own threshold (01-CONTRACTS §5) */
const needsRestock = (i: WarehouseItem) => ["out", "low"].includes(levelOf(i));

/** Colours of the "Cần nhập thêm" card by the worst item (D11): green none · amber only low · red at least one out */
const TONE: Record<RestockTone, { card: string; num: string; label: string }> = {
  ok: { card: "border-l-4 border-l-emerald-500 bg-emerald-50", num: "text-emerald-700", label: "text-emerald-800" },
  low: { card: "border-l-4 border-l-amber-500 bg-amber-50", num: "text-amber-700", label: "text-amber-800" },
  out: { card: "border-l-4 border-l-rose-500 bg-rose-50", num: "text-rose-600", label: "text-rose-700" },
};

export function WarehouseApp({ data }: { data: WarehouseData }) {
  const { pending, error, setError, run } = useAction();
  const [view, setView] = useState<View>("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState(data.inventory[0]?.code ?? "");
  const [importQty, setImportQty] = useState(10);

  const restock = data.inventory.filter(needsRestock);
  const tone = TONE[restockTone(data.inventory.map(levelOf))];
  const topQty = Math.max(1, ...data.weeklyUsage.map((u) => u.qty));
  const unknownCount = data.inventory.filter((i) => levelOf(i) === "unknown").length;
  const inView = (i: WarehouseItem) => view === "all" || (view === "restock" ? needsRestock(i) : levelOf(i) === "unknown");
  // out of stock first, then low, then the rest (D11)
  const rows = byUrgency(data.inventory).filter(
    (i) => inView(i) && matchesDoneSearch({ code: i.code, title: i.name, content: "", location: "" }, search),
  );

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCode || importQty <= 0) return;
    run(
      () => receiveStockAction(selectedCode, Number(importQty)),
      () => {
        setModalOpen(false);
        setImportQty(10);
      },
    );
  };

  const openImport = (code?: string, qty = 10) => {
    if (code) setSelectedCode(code);
    setImportQty(qty);
    setModalOpen(true);
  };

  return (
    <div className="scr-warehouse min-h-screen bg-page">
      <Header
        avatar={data.user.avatar}
        name={data.user.name}
        rolePill={ROLE_LABEL.warehouse}
        bellLabel="Phiếu vật tư và vật tư cần nhập thêm"
        bellCount={data.requests.length + restock.length}
        notices={[
          ...data.requests.map((r) => ({
            id: `pvt-${r.requestId}`,
            title: `${r.requestId}: cần nhập vật tư`,
            urgent: true,
            tag: "Phiếu vật tư",
            body: `${requestSummary(r)} · ${r.sourceLabel}`,
          })),
          ...restock.map((i) => ({
            id: `low-${i.code}`,
            title: `${STOCK_BADGE[levelOf(i)].label}: ${i.name}`,
            urgent: levelOf(i) === "out",
            tag: "Tồn kho",
            body: `Còn ${i.stock ?? "--"} ${i.unit}${i.min !== null ? ` · tối thiểu ${i.min}` : ""}`,
          })),
        ]}
      />
      <Body>
        <NavTiles<Tab>
          label="Chức năng thủ kho"
          active="inventory"
          onPick={() => undefined}
          items={[{ key: "inventory", label: "Danh mục tồn kho", icon: <IconBox />, count: data.inventory.length }]}
        />
        <PageHead {...HEAD.inventory} />

        <div className="flex flex-col gap-5">
          <section className="card flex flex-col gap-3 px-6 py-5" data-testid="material-requests" aria-label="Phiếu vật tư cần nhập">
            <h2 className="m-0 flex items-center gap-2 text-base font-bold text-body">
              Phiếu vật tư cần nhập
              <span className="pill urgent text-[11px]" data-testid="material-requests-count">
                {data.requests.length}
              </span>
            </h2>
            {data.requests.length === 0 && <p className="m-0 text-sm text-muted">Không có phiếu vật tư nào đang chờ nhập.</p>}
            {data.requests.map((r) => (
              <article key={r.requestId} className="flex flex-col gap-2 rounded-xl border border-line bg-soft/30 p-3.5" data-testid="material-request" data-request={r.requestId}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[13px] font-bold text-slate-800">{r.requestId}</span>
                  <span className="text-sm font-semibold text-brand">{r.ticketId}</span>
                  <span className="pill cat-none">{r.sourceLabel}</span>
                  {r.departmentName && <span className="text-xs text-muted">{r.departmentName}</span>}
                  <span className="ml-auto text-xs text-muted">Chờ {r.since}</span>
                </div>
                {hasLocation(r.location) && <span className="text-[13px] text-muted">{r.location}</span>}
                {r.note && <p className="m-0 text-sm text-body">Ghi chú: {r.note}</p>}
                <table>
                  <thead>
                    <tr>
                      <th>Mã VT</th>
                      <th>Tên vật tư</th>
                      <th className="text-right">Cần</th>
                      <th className="text-right">Tồn</th>
                      <th className="text-right">Thiếu</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.lines.map((l) => (
                      <tr key={l.itemCode}>
                        <td className="whitespace-nowrap font-mono text-[13px] font-bold">{l.itemCode}</td>
                        <td className="font-medium">{l.itemName}</td>
                        <td className="text-right tabular-nums">{l.needed}</td>
                        <td className="text-right tabular-nums">{l.stock === null ? "--" : l.stock}</td>
                        <td className="text-right font-bold tabular-nums text-rose-600">{l.shortage}</td>
                        <td>
                          <button type="button" className={`btn primary text-xs whitespace-nowrap ${FOCUS}`} onClick={() => openImport(l.itemCode, Math.max(1, Math.ceil(l.shortage)))}>
                            Nhập đủ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            ))}
          </section>

          <div className="flex flex-wrap items-stretch gap-4">
            <div className="card flex flex-col gap-1 px-6 py-5" style={{ flex: "1 1 180px" }}>
              <span className="text-sm text-muted">Tổng danh mục vật tư</span>
              <span className="text-[30px] font-bold text-slate-800">{data.inventory.length}</span>
            </div>
            <button
              type="button"
              data-testid="tile-restock"
              aria-pressed={view === "restock"}
              onClick={() => setView(view === "restock" ? "all" : "restock")}
              className={`card flex flex-col items-start gap-1 px-6 py-5 text-left transition-all hover:shadow-md ${FOCUS} ${tone.card}`}
              style={{ flex: "1 1 180px" }}
            >
              <span className={`text-sm font-medium ${tone.label}`}>Cần nhập thêm</span>
              <span className={`text-[30px] font-bold ${tone.num}`}>{restock.length}</span>
            </button>
            <section className="card flex flex-col gap-3 px-6 py-5" style={{ flex: "2 1 340px" }} data-testid="weekly-usage" aria-label="Vật tư dùng nhiều trong tuần">
              <h2 className="m-0 text-sm font-semibold text-body">Vật tư dùng nhiều trong tuần</h2>
              {data.weeklyUsage.length === 0 && <p className="m-0 text-sm text-muted">Chưa có vật tư nào được dùng trong 7 ngày qua.</p>}
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {data.weeklyUsage.map((u, n) => (
                  <li key={u.code} className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-x-2 gap-y-1 text-sm">
                    <span className="text-xs font-bold text-muted">{n + 1}</span>
                    <span className="truncate font-medium" title={u.name}>
                      {u.name}
                    </span>
                    <span className="font-bold tabular-nums">
                      {u.qty} <span className="text-xs font-normal text-muted">{u.unit}</span>
                    </span>
                    <span />
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                      <div className="h-full rounded-full bg-sky-500" style={{ width: `${(u.qty / topQty) * 100}%` }} />
                    </div>
                    <span className="text-[11px] text-muted">{u.tickets} ticket</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lọc vật tư">
              <button type="button" className={chipCls(view === "all")} aria-pressed={view === "all"} onClick={() => setView("all")}>
                Tất cả <span className="opacity-70">{data.inventory.length}</span>
              </button>
              <button type="button" className={chipCls(view === "restock")} aria-pressed={view === "restock"} onClick={() => setView("restock")}>
                Cần nhập thêm <span className="opacity-70">{restock.length}</span>
              </button>
              {unknownCount > 0 && (
                <button type="button" className={chipCls(view === "unknown")} aria-pressed={view === "unknown"} onClick={() => setView("unknown")}>
                  Chưa kiểm kê <span className="opacity-70">{unknownCount}</span>
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                placeholder="Tìm mã hoặc tên vật tư…"
                aria-label="Tìm vật tư"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="field w-full rounded-xl px-3 py-1.5 text-xs sm:w-60"
              />
              <button type="button" className={`btn primary text-xs whitespace-nowrap ${FOCUS}`} onClick={() => openImport()}>
                + Nhập kho
              </button>
            </div>
          </div>

          <section className="card overflow-x-auto p-2">
            <table>
              <thead>
                <tr>
                  <th>Mã VT</th>
                  <th>Tên vật tư</th>
                  <th>Đơn vị tính</th>
                  <th className="text-right">Số lượng tồn</th>
                  <th className="text-right">Tồn tối thiểu</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const badge = STOCK_BADGE[levelOf(item)];
                  return (
                    <tr key={item.code} className="hover:bg-slate-50/70 transition-colors">
                      <td className="whitespace-nowrap font-mono text-[13px] font-bold text-slate-800">{item.code}</td>
                      <td className="font-medium text-slate-900">{item.name}</td>
                      <td className="text-slate-700">{item.unit || "--"}</td>
                      <td className="text-right font-bold tabular-nums">{item.stock === null ? "--" : item.stock}</td>
                      <td className="text-right tabular-nums text-slate-600">{item.min === null ? "--" : item.min}</td>
                      <td>
                        <span className={`pill ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td>
                        <button type="button" className={`btn text-xs whitespace-nowrap ${FOCUS}`} onClick={() => openImport(item.code)}>
                          + Nhập hàng
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-8">
                      Không có vật tư nào khớp bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      </Body>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="m-0 mb-3 border-b border-slate-100 pb-3 text-base font-bold text-slate-800">Nhập thêm số lượng vật tư</h3>
            <form onSubmit={handleImportSubmit} className="space-y-4 text-xs">
              <div>
                <label htmlFor="import-item" className="font-semibold text-slate-700 block mb-1">
                  Vật tư
                </label>
                <select
                  id="import-item"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                  value={selectedCode}
                  onChange={(e) => setSelectedCode(e.target.value)}
                >
                  {data.inventory.map((i) => (
                    <option key={i.code} value={i.code}>
                      [{i.code}] {i.name} (hiện có: {i.stock === null ? "chưa kiểm kê" : `${i.stock} ${i.unit}`})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="import-qty" className="font-semibold text-slate-700 block mb-1">
                  Số lượng nhập
                </label>
                <input
                  id="import-qty"
                  type="number"
                  min={1}
                  step={1}
                  className="w-40 text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                  value={importQty}
                  onChange={(e) => setImportQty(Number(e.target.value))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" className="btn text-xs" onClick={() => setModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn primary text-xs font-semibold" disabled={pending}>
                  Xác nhận nhập kho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast message={error} onClose={() => setError("")} />
    </div>
  );
}

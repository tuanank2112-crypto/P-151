"use client";

import { useState } from "react";
import { receiveStockAction } from "@/app/actions/warehouse";
import { IconBox } from "@/components/icons";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { Toast } from "@/components/toast";
import { useAction } from "@/components/use-action";
import { ROLE_LABEL } from "@/lib/constants";
import type { WarehouseData, WarehouseItem } from "@/lib/dto";
import { matchesDoneSearch } from "@/lib/reception-done";
import { STOCK_BADGE, stockLevel } from "@/lib/stock";

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

export function WarehouseApp({ data }: { data: WarehouseData }) {
  const { pending, error, setError, run } = useAction();
  const [view, setView] = useState<View>("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState(data.inventory[0]?.code ?? "");
  const [importQty, setImportQty] = useState(10);

  const restock = data.inventory.filter(needsRestock);
  const outCount = data.inventory.filter((i) => levelOf(i) === "out").length;
  const unknownCount = data.inventory.filter((i) => levelOf(i) === "unknown").length;
  const inView = (i: WarehouseItem) => view === "all" || (view === "restock" ? needsRestock(i) : levelOf(i) === "unknown");
  const rows = data.inventory.filter(
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

  const openImport = (code?: string) => {
    if (code) setSelectedCode(code);
    setImportQty(10);
    setModalOpen(true);
  };

  const kpis: { label: string; n: number; tone: string; go?: View }[] = [
    { label: "Tổng danh mục vật tư", n: data.inventory.length, tone: "text-slate-800" },
    { label: "Cần nhập thêm", n: restock.length, tone: restock.length > 0 ? "text-rose-600" : "text-emerald-600", go: "restock" },
    { label: "Hết hàng", n: outCount, tone: outCount > 0 ? "text-rose-600" : "text-slate-800", go: "restock" },
  ];

  return (
    <div className="scr-warehouse min-h-screen bg-page">
      <Header
        avatar={data.user.avatar}
        name={data.user.name}
        rolePill={ROLE_LABEL.warehouse}
        bellLabel="Vật tư cần nhập thêm"
        bellCount={restock.length}
        notices={restock.map((i) => ({
          id: `low-${i.code}`,
          title: `${STOCK_BADGE[levelOf(i)].label}: ${i.name}`,
          urgent: levelOf(i) === "out",
          tag: "Tồn kho",
          body: `Còn ${i.stock ?? "--"} ${i.unit}${i.min !== null ? ` · tối thiểu ${i.min}` : ""}`,
        }))}
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
          <div className="flex flex-wrap gap-4">
            {kpis.map((k) => {
              const body = (
                <>
                  <span className="text-sm text-muted">{k.label}</span>
                  <span className={`text-[30px] font-bold ${k.tone}`}>{k.n}</span>
                </>
              );
              return k.go ? (
                <button
                  key={k.label}
                  type="button"
                  aria-pressed={view === k.go}
                  onClick={() => setView(view === k.go ? "all" : (k.go as View))}
                  className={`card flex flex-col items-start gap-1 px-6 py-5 text-left transition-all hover:shadow-md ${FOCUS} ${
                    k.n > 0 && k.go === "restock" ? "border-l-4 border-l-rose-500" : ""
                  }`}
                  style={{ flex: "1 1 200px" }}
                >
                  {body}
                </button>
              ) : (
                <div key={k.label} className="card flex flex-col gap-1 px-6 py-5" style={{ flex: "1 1 200px" }}>
                  {body}
                </div>
              );
            })}
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

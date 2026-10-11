"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { receiveStockAction } from "@/app/actions/warehouse";
import { IconBox } from "@/components/icons";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { Toast } from "@/components/toast";
import { useAction } from "@/components/use-action";
import { ROLE_LABEL } from "@/lib/constants";
import type { WarehouseData, WarehouseItem } from "@/lib/dto";

type Tab = "inventory";

const HEAD: Record<Tab, { title: string; sub: string }> = {
  inventory: {
    title: "Kho vật tư & linh kiện",
    sub: "Danh mục vật tư và số lượng tồn kho. Phòng ban tự ghi vật tư đã dùng khi hoàn thành; kho nhập thêm số lượng.",
  },
};

const CATEGORIES = ["Tất cả", "Tồn kho thấp"] as const;

const isLowStock = (i: WarehouseItem) => i.stock !== null && i.stock <= 0;

export function WarehouseApp({ data }: { data: WarehouseData }) {
  const { pending, error, setError, run } = useAction();
  const fromManagement = useSearchParams().get("from") === "management";
  const [tab, setTab] = useState<Tab>("inventory");
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("Tất cả");

  // Modal State for Import Stock
  const [modalOpen, setModalOpen] = useState(false);
  // Receive stock for an existing catalog code (new codes are not supported by the backend)
  const [selectedCode, setSelectedCode] = useState(data.inventory[0]?.code ?? "");
  const [importQty, setImportQty] = useState(10);
  const lowStockCount = data.inventory.filter(isLowStock).length;

  const filteredInventory = data.inventory.filter((item) => {
    const matchesSearch =
      !search.trim() ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase());
    const matchesCat =
      selectedCat === "Tất cả" ||
      (selectedCat === "Tồn kho thấp" ? isLowStock(item) : true);
    return matchesSearch && matchesCat;
  });

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

  const openQuickImport = (item: WarehouseItem) => {
    setSelectedCode(item.code);
    setImportQty(10);
    setModalOpen(true);
  };

  return (
    <div className="scr-warehouse min-h-screen bg-page">
      <Header
        avatar={data.user.avatar}
        name={data.user.name}
        rolePill={fromManagement ? ROLE_LABEL.management : ROLE_LABEL.warehouse}
        bellLabel="Thông báo kho"
        bellCount={lowStockCount}
        notices={data.inventory.filter(isLowStock).map((i) => ({
          id: `low-${i.code}`,
          title: `Hết hàng: ${i.name}`,
          urgent: false,
          tag: "Tồn kho",
          body: `Mã ${i.code}`,
        }))}
      />
      <Body>
        <NavTiles<Tab>
          label="Chức năng thủ kho"
          active={tab}
          onPick={setTab}
          items={[
            { key: "inventory", label: "Kho vật tư", icon: <IconBox />, count: data.inventory.length },
          ]}
        />
        {fromManagement && (
          <div>
            <Link
              href="/management"
              className="inline-flex items-center rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-body hover:border-sky-500 hover:text-sky-700 focus-visible:outline-2 focus-visible:outline-sky-600"
            >
              ← Về trang Ban quản lý
            </Link>
          </div>
        )}
        <PageHead {...HEAD[tab]} />

        {tab === "inventory" && (
          <div className="flex flex-col gap-5">
            {/* Summary Metrics */}
            <div className="flex flex-wrap gap-4">
              <div className="card flex flex-col gap-1 px-6 py-5" style={{ flex: "1 1 200px" }}>
                <span className="text-sm text-muted">Tổng danh mục vật tư</span>
                <span className="text-[30px] font-bold text-slate-800">{data.inventory.length}</span>
              </div>
              <div className="card flex flex-col gap-1 px-6 py-5" style={{ flex: "1 1 200px" }}>
                <span className="text-sm text-muted">Cảnh báo tồn kho thấp</span>
                <span className={`text-[30px] font-bold ${lowStockCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {lowStockCount}
                </span>
              </div>
            </div>

            {/* Filter & Actions Toolbar */}
            <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`fchip ${selectedCat === cat ? "on" : ""}`}
                    onClick={() => setSelectedCat(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Tìm mã hoặc tên vật tư..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="field text-xs py-1.5 px-3 w-full sm:w-56 rounded-xl"
                />
                <button
                  type="button"
                  className="btn primary bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs whitespace-nowrap shadow-xs"
                  onClick={() => {
                    setModalOpen(true);
                  }}
                >
                  + Nhập kho
                </button>
              </div>
            </div>

            {/* Inventory Table */}
            <section className="card overflow-x-auto p-2">
              <table>
                <thead>
                  <tr>
                    <th>Mã VT</th>
                    <th>Tên vật tư</th>
                    <th>Đơn vị</th>
                    <th>Tồn kho</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => {
                    const isLow = isLowStock(item);
                    return (
                      <tr key={item.code} className="hover:bg-slate-50/70 transition-colors">
                        <td className="font-mono font-bold text-slate-800 whitespace-nowrap">{item.code}</td>
                        <td className="font-medium text-slate-900 max-w-[280px]">{item.name}</td>
                        <td className="text-slate-700">{item.unit}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm ${isLow ? "text-rose-600" : "text-slate-800"}`}>
                              {item.stock === null ? "Chưa rõ" : item.stock}
                            </span>
                            {isLow && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                                Sắp hết
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn text-xs py-1 px-2.5 hover:bg-sky-50 hover:text-sky-700"
                            onClick={() => openQuickImport(item)}
                          >
                            + Nhập hàng
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredInventory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-8">
                        Không tìm thấy vật tư nào phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        )}

      </Body>

      {/* ────────────────── Modal: Nhập thêm kho ────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                Nhập thêm số lượng vật tư
              </h3>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4 text-xs">
              <div className="space-y-4">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Chọn vật tư nhập thêm:</label>
                    <select
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                      value={selectedCode}
                      onChange={(e) => setSelectedCode(e.target.value)}
                    >
                      {data.inventory.map((i) => (
                        <option key={i.code} value={i.code}>
                          [{i.code}] {i.name} (Hiện có: {i.stock === null ? "chưa rõ" : `${i.stock} ${i.unit}`})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Số lượng nhập:</label>
                      <input
                        type="number"
                        min={1}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                        value={importQty}
                        onChange={(e) => setImportQty(Number(e.target.value))}
                      />
                    </div>
                  </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  className="btn text-xs"
                  onClick={() => setModalOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn primary bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold"
                  disabled={pending}
                >
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

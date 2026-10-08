"use client";

import { useState } from "react";
import {
  addStockItemAction,
  approveMaterialAction,
  receiveStockAction,
} from "@/app/actions/warehouse";
import { IconBox, IconKanban, IconWrench } from "@/components/icons";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { Toast } from "@/components/toast";
import { useAction } from "@/components/use-action";
import { ROLE_LABEL } from "@/lib/constants";
import type { MaterialRequest, WarehouseData, WarehouseItem } from "@/lib/dto";

type Tab = "inventory" | "requests";

const HEAD: Record<Tab, { title: string; sub: string }> = {
  inventory: {
    title: "Kho vật tư & linh kiện",
    sub: "Quản lý danh mục thiết bị, phụ tùng điện nước, số lượng tồn kho và vị trí lưu trữ.",
  },
  requests: {
    title: "Yêu cầu cấp phát vật tư",
    sub: "Duyệt xuất kho cho các kỹ thuật viên đang xử lý sự cố tại hiện trường.",
  },
};

const CATEGORIES = ["Tất cả", "Điện", "Nước", "Chiếu sáng", "Phụ kiện", "Tồn kho thấp"] as const;

export function WarehouseApp({ data }: { data: WarehouseData }) {
  const { pending, error, setError, run } = useAction();
  const [tab, setTab] = useState<Tab>("inventory");
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("Tất cả");

  // Modal State for Import Stock
  const [modalOpen, setModalOpen] = useState(false);
  const [isNewItem, setIsNewItem] = useState(false);

  // Existing item form
  const [selectedCode, setSelectedCode] = useState(data.inventory[0]?.code ?? "");
  const [importQty, setImportQty] = useState(10);
  const [importNote, setImportNote] = useState("");

  // New item form
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState("Điện");
  const [newUnit, setNewUnit] = useState("Cái");
  const [newStock, setNewStock] = useState(10);
  const [newMinStock, setNewMinStock] = useState(5);
  const [newLocation, setNewLocation] = useState("Kho trung tâm");

  const pendingRequests = data.requests.filter((r) => !r.received);
  const lowStockCount = data.inventory.filter((i) => i.stock <= i.minStock).length;

  const filteredInventory = data.inventory.filter((item) => {
    const matchesSearch =
      !search.trim() ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase());
    const matchesCat =
      selectedCat === "Tất cả" ||
      (selectedCat === "Tồn kho thấp" ? item.stock <= item.minStock : item.category === selectedCat);
    return matchesSearch && matchesCat;
  });

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNewItem) {
      if (!newCode.trim() || !newName.trim()) return;
      run(
        () =>
          addStockItemAction({
            code: newCode.trim(),
            name: newName.trim(),
            category: newCat,
            unit: newUnit,
            stock: Number(newStock),
            minStock: Number(newMinStock),
            location: newLocation,
          }),
        () => {
          setModalOpen(false);
          setIsNewItem(false);
          setNewCode("");
          setNewName("");
        },
      );
    } else {
      if (!selectedCode || importQty <= 0) return;
      run(
        () => receiveStockAction(selectedCode, Number(importQty), importNote),
        () => {
          setModalOpen(false);
          setImportQty(10);
          setImportNote("");
        },
      );
    }
  };

  const openQuickImport = (item: WarehouseItem) => {
    setSelectedCode(item.code);
    setIsNewItem(false);
    setImportQty(10);
    setModalOpen(true);
  };

  return (
    <div className="scr-warehouse min-h-screen bg-page">
      <Header
        avatar={data.user.avatar}
        name={data.user.name}
        rolePill={ROLE_LABEL.warehouse}
        bellLabel="Yêu cầu cấp vật tư"
        bellCount={pendingRequests.length}
        notices={pendingRequests.map((r) => ({
          id: `req-${r.id}`,
          title: `Cấp vật tư: ${r.item}`,
          urgent: false,
          tag: "Chờ xuất kho",
          time: r.createdAt,
          body: `Ticket ${r.ticketCode} · Người yêu cầu: ${r.requestedBy} (${r.staffName ?? "Kỹ thuật"})`,
        }))}
      />
      <Body>
        <NavTiles<Tab>
          label="Chức năng thủ kho"
          active={tab}
          onPick={setTab}
          items={[
            { key: "inventory", label: "Kho vật tư", icon: <IconBox />, count: data.inventory.length },
            { key: "requests", label: "Yêu cầu cấp phát", icon: <IconWrench />, count: pendingRequests.length },
          ]}
        />
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
              <div className="card flex flex-col gap-1 px-6 py-5" style={{ flex: "1 1 200px" }}>
                <span className="text-sm text-muted">Yêu cầu chờ xuất kho</span>
                <span className={`text-[30px] font-bold ${pendingRequests.length > 0 ? "text-amber-600" : "text-slate-800"}`}>
                  {pendingRequests.length}
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

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Tìm mã hoặc tên vật tư..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="field text-xs py-1.5 px-3 w-56 rounded-xl"
                />
                <button
                  type="button"
                  className="btn primary bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs whitespace-nowrap shadow-xs"
                  onClick={() => {
                    setIsNewItem(false);
                    setModalOpen(true);
                  }}
                >
                  + Nhập thêm kho
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
                    <th>Phân loại</th>
                    <th>Tồn kho</th>
                    <th>Định mức tối thiểu</th>
                    <th>Vị trí kệ</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => {
                    const isLow = item.stock <= item.minStock;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="font-mono font-bold text-slate-800 whitespace-nowrap">{item.code}</td>
                        <td className="font-medium text-slate-900 max-w-[280px]">{item.name}</td>
                        <td>
                          <span className="pill cat-none text-xs font-semibold">{item.category}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm ${isLow ? "text-rose-600" : "text-slate-800"}`}>
                              {item.stock} {item.unit}
                            </span>
                            {isLow && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                                Sắp hết
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-muted text-xs">
                          {item.minStock} {item.unit}
                        </td>
                        <td className="text-slate-600 text-xs">{item.location}</td>
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
                      <td colSpan={7} className="text-center text-muted py-8">
                        Không tìm thấy vật tư nào phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        )}

        {tab === "requests" && (
          <section className="flex flex-col gap-4">
            {data.requests.length === 0 && (
              <div className="card p-10 text-center text-muted">Chưa có yêu cầu cấp phát vật tư nào.</div>
            )}
            {data.requests.map((r) => (
              <article key={r.id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-3.5">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold">
                    📦
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-sky-700">{r.ticketCode}</span>
                      <span className="text-xs text-muted">· {r.createdAt}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5 mb-0.5">{r.item}</h4>
                    <p className="text-xs text-slate-500 m-0">
                      Người yêu cầu: <strong className="text-slate-700">{r.requestedBy}</strong> ({r.staffName ?? "KTV phụ trách"})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={r.received ? "pill got" : "pill req"}>
                    {r.received ? "✓ Đã xuất kho" : "⏳ Chờ xuất kho"}
                  </span>

                  {!r.received && (
                    <button
                      type="button"
                      className="btn primary bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs"
                      disabled={pending}
                      onClick={() => run(() => approveMaterialAction(r.id))}
                    >
                      Duyệt & Xuất kho
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </Body>

      {/* ────────────────── Modal: Nhập thêm kho ────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                {isNewItem ? "Thêm vật tư mới vào danh mục kho" : "Nhập thêm số lượng vật tư"}
              </h3>
              <button
                type="button"
                onClick={() => setIsNewItem(!isNewItem)}
                className="text-xs text-sky-600 hover:underline font-medium"
              >
                {isNewItem ? "← Chọn vật tư có sẵn" : "+ Tạo mã vật tư mới"}
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4 text-xs">
              {!isNewItem ? (
                <>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Chọn vật tư nhập thêm:</label>
                    <select
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                      value={selectedCode}
                      onChange={(e) => setSelectedCode(e.target.value)}
                    >
                      {data.inventory.map((i) => (
                        <option key={i.code} value={i.code}>
                          [{i.code}] {i.name} (Hiện có: {i.stock} {i.unit})
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
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Ghi chú nhập hàng:</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Lô nhập bảo trì tháng 10"
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                        value={importNote}
                        onChange={(e) => setImportNote(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Mã vật tư:</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: VT-E05"
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white uppercase font-mono"
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Phân loại:</label>
                      <select
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                        value={newCat}
                        onChange={(e) => setNewCat(e.target.value)}
                      >
                        <option value="Điện">Điện</option>
                        <option value="Nước">Nước</option>
                        <option value="Chiếu sáng">Chiếu sáng</option>
                        <option value="Phụ kiện">Phụ kiện</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Tên vật tư:</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Đồng hồ đo điện vạn năng Kyoritsu"
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Đơn vị:</label>
                      <input
                        type="text"
                        placeholder="Cái, Cuộn..."
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                        value={newUnit}
                        onChange={(e) => setNewUnit(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Số lượng đầu:</label>
                      <input
                        type="number"
                        min={0}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                        value={newStock}
                        onChange={(e) => setNewStock(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Tồn tối thiểu:</label>
                      <input
                        type="number"
                        min={1}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                        value={newMinStock}
                        onChange={(e) => setNewMinStock(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Vị trí lưu kho:</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Kệ E3, Tủ dụng cụ T1"
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                    />
                  </div>
                </>
              )}

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
                  {isNewItem ? "Lưu mã vật tư mới" : "Xác nhận nhập kho"}
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

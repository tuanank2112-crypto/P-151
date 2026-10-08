"use client";

import { useState } from "react";
import {
  approveInspectionAction,
  bqlDecideWrongDeptAction,
  finishBqlTicketAction,
  reassignTicketAction,
  rejectInspectionAction,
  startTicketAction,
} from "@/app/actions/management";
import { IconBars, IconBriefcase, IconGrid, IconTable } from "@/components/icons";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { TicketDetailModal } from "@/components/ticket-detail-modal";
import { Toast } from "@/components/toast";
import { useAction } from "@/components/use-action";
import { DEPT_LABEL, DEPT_ORDER, ROLE_LABEL, type Dept } from "@/lib/constants";
import type { ManagementData, MgmtTicket } from "@/lib/dto";
import { autoGates, SITE_CHECKS } from "@/lib/inspection";

type Tab = "overview" | "all" | "mine" | "teams";
type Filter = "all" | "moi" | "dang_xu_ly" | "urgent" | "late" | Dept;

const HEAD: Record<Tab, { title: string; sub: string }> = {
  overview: { title: "Tổng quan", sub: "Tình hình ticket toàn khu đô thị hôm nay." },
  all: { title: "Tất cả ticket", sub: "Chỉ Ban quản lý được xem toàn bộ ticket của mọi phòng ban." },
  mine: {
    title: "Việc của Ban quản lý",
    sub: "Nghiệm thu hoàn tất hiện trường, xử lý khiếu nại sai phòng ban và các thủ tục thuộc BQL.",
  },
  teams: { title: "Hiệu suất phòng ban", sub: "So sánh khối lượng, tốc độ và mức hài lòng giữa các phòng ban." },
};

const FILTERS: [Filter, string][] = [
  ["all", "Tất cả"],
  ["moi", "Chờ phân loại"],
  ["dang_xu_ly", "Đang xử lý"],
  ["urgent", "Khẩn cấp"],
  ["late", "Quá hạn"],
  ["ve_sinh", "Vệ sinh"],
  ["ky_thuat", "Kỹ thuật"],
  ["bql", "Ban quản lý"],
];

const WORKLOAD_DEPTS: Dept[] = ["ve_sinh", "ky_thuat"];

/** Open = not cancelled and not reported done */
const open = (t: MgmtTicket) => !t.cancelled && t.stage < 5;
const lowRated = (t: MgmtTicket) => t.stars !== null && t.stars < 3;

/** Status pill of the management tables */
function status(t: MgmtTicket): [string, string] {
  if (t.cancelled) return ["pill st-hoan_thanh", "Đã hủy"];
  if (t.stage === 1) return ["pill st-moi", "Chờ phân loại"];
  if (t.stage === 2) return ["pill st-da_chuyen", "Đã chuyển phòng ban"];
  if (t.stage <= 4) return ["pill st-dang_xu_ly", "Đang xử lý"];
  if (t.stage === 5) return ["pill st-da_chuyen", "Chờ nghiệm thu"];
  return ["pill st-hoan_thanh", "Hoàn thành"];
}

const deptPill = (d: Dept | null) => `pill cat-${d ?? "none"}`;

export function ManagementApp({ data }: { data: ManagementData }) {
  const { pending, error, setError, run } = useAction();
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedTicket, setSelectedTicket] = useState<MgmtTicket | null>(null);
  const [rejectReasonId, setRejectReasonId] = useState<number | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState("");
  // Mục BQL đã tự tích tại hiện trường, theo từng ticket
  const [siteChecked, setSiteChecked] = useState<Record<number, string[]>>({});
  const toggleSite = (id: number, key: string) =>
    setSiteChecked((s) => {
      const cur = s[id] ?? [];
      return { ...s, [id]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] };
    });

  const all = data.tickets;
  const live = all.filter((t) => !t.cancelled);

  const pendingCount = live.filter((t) => t.stage === 1).length;
  const inProgressCount = live.filter((t) => t.stage === 3 || t.stage === 4).length;
  const urgentCount = all.filter((t) => t.urgent && open(t)).length;
  const lateCount = all.filter((t) => t.late).length;

  const openBy = (d: Dept) => all.filter((t) => open(t) && t.dept === d).length;

  const attention = all.filter((t) => (open(t) && (t.urgent || t.late)) || lowRated(t));

  // "Việc của BQL" categories
  const inspectionTickets = live.filter((t) => t.stage === 5);
  const disputedTickets = live.filter((t) => t.disputed && t.stage < 5);
  const bqlDirectTickets = live.filter((t) => t.dept === "bql" && t.stage < 5);
  const totalBqlPending = inspectionTickets.length + disputedTickets.length + bqlDirectTickets.length;

  const rows = all.filter((t) => {
    if (filter === "all") return true;
    if (filter === "moi") return !t.cancelled && t.stage === 1;
    if (filter === "dang_xu_ly") return !t.cancelled && (t.stage === 3 || t.stage === 4);
    if (filter === "urgent") return !t.cancelled && t.urgent && open(t);
    if (filter === "late") return !t.cancelled && t.late;
    return t.dept === filter;
  });

  return (
    <div className="scr-management min-h-screen bg-page">
      <Header
        avatar={data.user.avatar}
        name={data.user.name}
        rolePill={ROLE_LABEL.management}
        bellLabel="Ticket cần chú ý"
        bellCount={attention.length}
        notices={attention.map((t) => ({
          id: t.id,
          title: `${t.code}: ${t.text}`,
          urgent: t.urgent,
          tag: t.urgent ? "Khẩn cấp" : t.late ? `Quá hạn ${t.ageH}h` : "Cần chú ý",
          body: `Trạng thái: ${t.dept ? DEPT_LABEL[t.dept] : "Chờ phân loại"} · Vị trí: ${t.location}`,
        }))}
      />
      <Body>
        <NavTiles<Tab>
          label="Chức năng ban quản lý"
          active={tab}
          onPick={setTab}
          items={[
            { key: "overview", label: "Tổng quan", icon: <IconGrid /> },
            { key: "all", label: "Tất cả ticket", icon: <IconTable />, count: all.length },
            { key: "mine", label: "Việc của BQL", icon: <IconBriefcase />, count: totalBqlPending },
            { key: "teams", label: "Hiệu suất phòng ban", icon: <IconBars /> },
          ]}
        />
        <PageHead {...HEAD[tab]} />

        {tab === "overview" && (
          <div className="flex flex-col gap-5">
            {/* Clickable Metric Cards */}
            <div className="flex flex-wrap gap-4">
              {[
                { label: "Tổng ticket", value: all.length, f: "all" as Filter },
                { label: "Chờ phân loại", value: pendingCount, f: "moi" as Filter },
                { label: "Đang xử lý", value: inProgressCount, f: "dang_xu_ly" as Filter },
                { label: "Khẩn cấp chưa xong", value: urgentCount, f: "urgent" as Filter },
                { label: "Quá hạn", value: lateCount, f: "late" as Filter },
              ].map((card) => (
                <div
                  key={card.label}
                  role="button"
                  tabIndex={0}
                  className="card flex flex-col gap-1 px-6 py-5 cursor-pointer hover:border-sky-400 hover:shadow-md transition-all group select-none"
                  style={{ flex: "1 1 170px" }}
                  onClick={() => {
                    setFilter(card.f);
                    setTab("all");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setFilter(card.f);
                      setTab("all");
                    }
                  }}
                >
                  <span className="text-sm text-muted group-hover:text-sky-700 font-medium transition-colors">
                    {card.label}
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[30px] font-bold tracking-[-0.02em] group-hover:text-sky-600 transition-colors">
                      {card.value}
                    </span>
                    <span className="text-xs text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                      Xem danh sách →
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-start gap-4">
              <section className="card flex min-w-0 flex-col gap-4 p-6" style={{ flex: "1 1 450px" }}>
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <h2 className="m-0 text-lg font-bold text-body">Điều phối & Phụ tải phòng ban</h2>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-soft text-brand">Real-time</span>
                </div>

                {/* Hàng đợi tiếp nhận & phân loại */}
                <div
                  className="flex items-center justify-between rounded-xl bg-soft/60 px-4 py-3 border border-line-soft cursor-pointer hover:bg-soft transition-colors"
                  onClick={() => {
                    setFilter("moi");
                    setTab("all");
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-xs text-brand font-bold text-sm">
                      ⚡
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-body">Hàng đợi tiếp nhận & phân loại</span>
                      <span className="text-[11px] text-muted">Tăng khi có phản ánh mới · Giảm khi đã phân công</span>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[22px] font-extrabold tracking-tight text-brand">{pendingCount}</span>
                    <span className="text-xs font-medium text-muted">ticket</span>
                  </div>
                </div>

                {/* Phụ tải các phòng ban: CHỈ HIỂN THỊ VỆ SINH & KỸ THUẬT, CÓ THỂ CLICK ĐỂ LỌC */}
                <div className="flex flex-col gap-3 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">
                      Phụ tải các đơn vị phụ trách xử lý
                    </span>
                    <span className="text-[11px] text-sky-600 font-medium">Bấm vào hàng để lọc ticket</span>
                  </div>
                  <div className="flex flex-col divide-y divide-line-soft">
                    {WORKLOAD_DEPTS.map((d) => {
                      const count = openBy(d);
                      const cap = d === "ky_thuat" ? 6 : 8;
                      const pct = Math.min(100, Math.round((count / cap) * 100));
                      const isHigh = pct >= 80;
                      const isStable = pct >= 40 && pct < 80;
                      const color = isHigh ? "#E05638" : isStable ? "#2563EB" : "#10B981";
                      const badgeText = isHigh ? "Tải cao" : isStable ? "Ổn định" : "Sẵn sàng";
                      const badgeCls = isHigh
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : isStable
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200";
                      const icon = d === "ky_thuat" ? "🔧" : "🧹";

                      return (
                        <div
                          key={d}
                          role="button"
                          tabIndex={0}
                          className="flex flex-col gap-2 py-3 first:pt-1 last:pb-0 cursor-pointer rounded-xl p-2 hover:bg-soft/70 transition-colors group"
                          onClick={() => {
                            setFilter(d);
                            setTab("all");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              setFilter(d);
                              setTab("all");
                            }
                          }}
                        >
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{icon}</span>
                              <span className="font-semibold text-body group-hover:text-sky-700 transition-colors">
                                {DEPT_LABEL[d]}
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${badgeCls}`}>
                                {badgeText}
                              </span>
                              <span className="text-sm font-bold text-body">
                                {count} <span className="text-xs font-normal text-muted">/ {cap}</span>
                              </span>
                            </div>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-line-soft">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{ background: color, width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section className="card flex min-w-0 flex-col gap-1 p-6" style={{ flex: "1 1 420px" }}>
                <h2 className="mt-0 mb-2 text-lg font-bold">Cần chú ý: khẩn cấp, quá hạn hoặc đánh giá thấp</h2>
                {attention.length === 0 && <span className="text-sm text-muted">Không có ticket nào cần chú ý.</span>}
                {attention.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center gap-2 border-t border-line-soft py-3.5 cursor-pointer hover:bg-soft/40 p-2 rounded-lg transition-colors"
                    onClick={() => setSelectedTicket(t)}
                  >
                    <span className="text-sm font-bold text-brand hover:underline">{t.code}</span>
                    {t.urgent && open(t) && <span className="pill urgent">Khẩn cấp</span>}
                    {t.late && <span className="pill late">Quá hạn {t.ageH}h</span>}
                    {lowRated(t) && <span className="pill late">Cư dân đánh giá {t.stars} sao</span>}
                    <span className={`${deptPill(t.dept)} ml-auto`}>
                      <span className="dot" />
                      {t.dept ? DEPT_LABEL[t.dept] : "Chờ phân loại"}
                    </span>
                    <span className="basis-full text-sm leading-[1.45]">{t.text}</span>
                  </div>
                ))}
              </section>
            </div>
          </div>
        )}

        {tab === "all" && (
          <section className="card flex flex-col gap-4 p-6">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={filter === key ? "fchip on" : "fchip"}
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Nội dung</th>
                    <th>Agent gợi ý</th>
                    <th>Phòng ban</th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const [stCls, stLabel] = status(t);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="font-bold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedTicket(t)}
                            className="font-mono text-sky-700 hover:text-sky-900 hover:underline font-bold text-left"
                            title="Bấm để xem chi tiết đầy đủ"
                          >
                            {t.code}
                          </button>
                        </td>
                        <td className="max-w-[340px] leading-[1.45]">
                          <span
                            className="cursor-pointer hover:text-slate-900"
                            onClick={() => setSelectedTicket(t)}
                          >
                            {t.text}
                          </span>
                          <br />
                          <span className="text-xs text-muted">{t.location}</span>
                        </td>
                        <td>
                          <span className={deptPill(t.aiDept)}>
                            <span className="dot" />
                            {t.aiDept ? DEPT_LABEL[t.aiDept] : "Chưa rõ"} · {t.conf}%
                          </span>
                        </td>
                        <td>
                          <span className={deptPill(t.dept)}>
                            <span className="dot" />
                            {t.dept ? DEPT_LABEL[t.dept] : "Chờ phân loại"}
                          </span>
                        </td>
                        <td>
                          <span className={stCls}>{stLabel}</span>
                        </td>
                        <td className="whitespace-nowrap text-muted">{t.createdAt}</td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-8">
                        Không có ticket nào trong bộ lọc này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "mine" && (
          <section className="flex flex-col gap-6">
            {/* 1. HÀNG ĐỢI NGHIỆM THU HOÀN TẤT (STAGE 5) */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  <h3 className="m-0 text-base font-bold text-slate-800">
                    Chờ Ban quản lý nghiệm thu thực địa ({inspectionTickets.length})
                  </h3>
                </div>
                <span className="text-xs text-muted">Đơn vị đã xử lý xong và gửi minh chứng</span>
              </div>

              {inspectionTickets.length === 0 && (
                <div className="card p-6 text-center text-muted text-sm">
                  Hiện không có ticket nào đang chờ nghiệm thu.
                </div>
              )}

              {inspectionTickets.map((t) => {
                const gates = autoGates(t);
                const checked = siteChecked[t.id] ?? [];
                const siteDone = SITE_CHECKS.every((c) => checked.includes(c.key));
                const passed = gates.filter((g) => g.ok).length + checked.length;
                return (
                <article key={t.id} className="card flex flex-col gap-4 p-6 border-l-4 border-l-sky-500 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft pb-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedTicket(t)}
                        className="font-mono text-base font-bold text-sky-700 hover:underline"
                      >
                        {t.code}
                      </button>
                      <span className="text-xs text-muted">
                        {t.createdAt} · {t.location}
                      </span>
                    </div>
                    <span className="pill st-da_chuyen">Chờ nghiệm thu (Bước 5/6)</span>
                  </div>

                  <div className="text-[15px] font-medium text-slate-800">{t.text}</div>

                  {/* 6 tiêu chuẩn nghiệm thu: 4 hệ thống tự kiểm từ dữ liệu + 2 BQL tự tích tại hiện trường */}
                  <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-4">
                    <h5 className="text-xs font-bold text-sky-950 uppercase tracking-wide mb-2 flex items-center justify-between gap-1.5">
                      <span>🛡️ Tiêu chuẩn nghiệm thu</span>
                      <span className={passed === gates.length + SITE_CHECKS.length ? "text-emerald-700" : "text-amber-700"}>
                        Đạt {passed}/{gates.length + SITE_CHECKS.length}
                      </span>
                    </h5>
                    <span className="text-[11px] font-semibold text-slate-500 block mb-1">Hệ thống tự kiểm</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-sky-900">
                      {gates.map((g) => (
                        <div key={g.key} className="flex items-start gap-1.5">
                          <span className={g.ok ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>{g.ok ? "✓" : "✕"}</span>
                          <span>
                            {g.label} <span className="text-slate-500">· {g.detail}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 block mt-3 mb-1">BQL xác nhận tại hiện trường</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-sky-900">
                      {SITE_CHECKS.map((c) => (
                        <label key={c.key} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked.includes(c.key)}
                            onChange={() => toggleSite(t.id, c.key)}
                          />
                          <span>{c.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Before / After Photo thumbnails if available */}
                  {(t.beforePhotos.length > 0 || t.afterPhotos.length > 0) && (
                    <div className="flex flex-wrap gap-4 pt-1">
                      {t.beforePhotos.length > 0 && (
                        <div>
                          <span className="text-[11px] font-semibold text-slate-500 block mb-1">Ảnh tiếp nhận:</span>
                          <div className="flex gap-2">
                            {t.beforePhotos.map((p) => (
                              <a
                                key={p.id}
                                href={`/api/photos/${p.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 hover:scale-105 transition-transform"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`/api/photos/${p.id}`} alt="Before" className="w-full h-full object-cover" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {t.afterPhotos.length > 0 && (
                        <div>
                          <span className="text-[11px] font-semibold text-emerald-700 block mb-1">Ảnh hoàn thành:</span>
                          <div className="flex gap-2">
                            {t.afterPhotos.map((p) => (
                              <a
                                key={p.id}
                                href={`/api/photos/${p.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-14 h-14 rounded-lg overflow-hidden border border-emerald-300 ring-2 ring-emerald-100 hover:scale-105 transition-transform"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`/api/photos/${p.id}`} alt="After" className="w-full h-full object-cover" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Buttons: Nghiệm thu vs Trả làm lại */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line-soft">
                    <button
                      type="button"
                      className="btn primary bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      disabled={pending || !siteDone}
                      title={siteDone ? undefined : "Tích đủ mục xác nhận tại hiện trường trước khi nghiệm thu"}
                      onClick={() => run(() => approveInspectionAction(t.id))}
                    >
                      ✓ Nghiệm thu đạt (Hoàn tất)
                    </button>

                    <button
                      type="button"
                      className="btn border border-rose-300 text-rose-700 hover:bg-rose-50"
                      disabled={pending}
                      onClick={() => {
                        setRejectReasonId(t.id);
                        setRejectReasonText("");
                      }}
                    >
                      ✕ Chưa đạt, trả làm lại
                    </button>

                    <button
                      type="button"
                      className="btn text-xs ml-auto"
                      onClick={() => setSelectedTicket(t)}
                    >
                      Xem chi tiết đầy đủ →
                    </button>
                  </div>

                  {/* Reject reason input prompt */}
                  {rejectReasonId === t.id && (
                    <div className="mt-2 p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2 animate-in fade-in">
                      <span className="text-xs font-semibold text-rose-800 block">
                        Nhập lý do chưa đạt để đơn vị làm lại:
                      </span>
                      <input
                        type="text"
                        className="w-full text-xs p-2 rounded-lg border border-rose-300 bg-white"
                        placeholder="Ví dụ: Vết bẩn chưa sạch hẳn, cần lau lại sảnh..."
                        value={rejectReasonText}
                        onChange={(e) => setRejectReasonText(e.target.value)}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="btn text-xs"
                          onClick={() => setRejectReasonId(null)}
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          className="btn primary bg-rose-600 text-white text-xs"
                          disabled={pending}
                          onClick={() => {
                            run(() => rejectInspectionAction(t.id, rejectReasonText));
                            setRejectReasonId(null);
                          }}
                        >
                          Xác nhận trả làm lại
                        </button>
                      </div>
                    </div>
                  )}
                </article>
                );
              })}
            </div>

            {/* 2. ĐƠN VỊ BÁO CẦN BQL XEM (KHIẾU NẠI SAI PHÒNG BAN) */}
            {disputedTickets.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 border-b border-line pb-2">
                  <span className="text-xl">⚠️</span>
                  <h3 className="m-0 text-base font-bold text-amber-900">
                    Đơn vị báo cần BQL xem xét (Khiếu nại sai phòng ban) ({disputedTickets.length})
                  </h3>
                </div>

                {disputedTickets.map((t) => (
                  <article key={t.id} className="card flex flex-col gap-3 p-6 border-l-4 border-l-amber-500 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft pb-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedTicket(t)}
                          className="font-mono text-base font-bold text-amber-800 hover:underline"
                        >
                          {t.code}
                        </button>
                        <span className="text-xs text-muted">
                          {t.createdAt} · {t.location}
                        </span>
                      </div>
                      <span className="pill cat-none text-amber-800 bg-amber-50 border-amber-200">
                        Đang tạm dừng chờ BQL
                      </span>
                    </div>

                    <p className="m-0 text-[15px] font-medium text-slate-800">{t.text}</p>

                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900">
                      <strong>Lý do đơn vị kiến nghị:</strong> {t.disputeReason || "Không thuộc phạm vi phòng ban."}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line-soft">
                      <button
                        type="button"
                        className="btn primary bg-amber-600 hover:bg-amber-700 text-white"
                        disabled={pending}
                        onClick={() => run(() => bqlDecideWrongDeptAction(t.id, "TO_BPTN"))}
                      >
                        ↩️ Chuyển về Ban tiếp nhận
                      </button>

                      <button
                        type="button"
                        className="btn border border-slate-300 hover:bg-slate-50"
                        disabled={pending}
                        onClick={() => run(() => bqlDecideWrongDeptAction(t.id, "KEEP"))}
                      >
                        ▶️ Bác kiến nghị — Yêu cầu làm tiếp
                      </button>

                      <button
                        type="button"
                        className="btn text-xs ml-auto"
                        onClick={() => setSelectedTicket(t)}
                      >
                        Chi tiết →
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* 3. TICKET TRỰC TIẾP CỦA BQL (PHÍ, THỦ TỤC, AN NINH) */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-line pb-2">
                <span className="text-xl">🏢</span>
                <h3 className="m-0 text-base font-bold text-slate-800">
                  Việc trực tiếp của Ban quản lý ({bqlDirectTickets.length})
                </h3>
              </div>

              {bqlDirectTickets.length === 0 && (
                <div className="card p-6 text-center text-muted text-sm">
                  Chưa có ticket nào về phí, thủ tục hoặc an ninh cần BQL xử lý.
                </div>
              )}

              {bqlDirectTickets.map((t) => {
                const [stCls, stLabel] = status(t);
                const next =
                  t.stage === 2
                    ? { label: "Nhận xử lý", fn: () => startTicketAction(t.id) }
                    : t.stage === 3 || t.stage === 4
                    ? { label: "Đánh dấu hoàn thành", fn: () => finishBqlTicketAction(t.id) }
                    : null;
                return (
                  <article key={t.id} className="card flex flex-col gap-3 p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedTicket(t)}
                        className="text-base font-bold text-brand hover:underline"
                      >
                        {t.code}
                      </button>
                      <span className="text-[13px] text-muted">
                        {t.createdAt} · {t.location}
                      </span>
                      <span className={`${stCls} ml-auto`}>{stLabel}</span>
                    </div>
                    <p className="m-0 text-[15px] leading-[1.55]">{t.text}</p>
                    {(next || open(t)) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {next && (
                          <button type="button" className="btn primary" disabled={pending} onClick={() => run(next.fn)}>
                            {next.label}
                          </button>
                        )}
                        {open(t) && (
                          <>
                            <span className="ml-2 text-[13px] text-muted">Không thuộc BQL? Chuyển cho:</span>
                            <button
                              type="button"
                              className="btn"
                              disabled={pending}
                              onClick={() => run(() => reassignTicketAction(t.id, "ve_sinh"))}
                            >
                              Phòng vệ sinh
                            </button>
                            <button
                              type="button"
                              className="btn"
                              disabled={pending}
                              onClick={() => run(() => reassignTicketAction(t.id, "ky_thuat"))}
                            >
                              Phòng kỹ thuật
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {tab === "teams" && (
          <section className="card overflow-x-auto p-2">
            <table>
              <thead>
                <tr>
                  <th>Phòng ban</th>
                  <th>Đang mở</th>
                  <th>Hoàn thành</th>
                  <th>Quá hạn</th>
                  <th>TB thời gian xử lý</th>
                  <th>Cư dân hài lòng</th>
                </tr>
              </thead>
              <tbody>
                {DEPT_ORDER.map((d) => {
                  const own = live.filter((t) => t.dept === d);
                  const done = own.filter((t) => t.stage >= 5);
                  const rated = done.filter((t) => t.stars !== null);
                  const late = own.filter((t) => t.late).length;
                  const hours = done.map((t) => t.doneHours).filter((h): h is number => h !== null);
                  return (
                    <tr key={d}>
                      <td>
                        <span className={`pill cat-${d}`}>
                          <span className="dot" />
                          {DEPT_LABEL[d]}
                        </span>
                      </td>
                      <td className="font-bold">{own.filter(open).length}</td>
                      <td>{done.length}</td>
                      <td>
                        <span className={late ? "pill late" : "pill st-hoan_thanh"}>{late}</span>
                      </td>
                      <td>{hours.length ? `${Math.round(hours.reduce((s, h) => s + h, 0) / hours.length)} giờ` : "—"}</td>
                      <td>
                        {rated.length ? `${Math.round((100 * rated.filter((t) => (t.stars ?? 0) >= 4).length) / rated.length)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="m-0 px-4 py-3.5 text-[13px] text-muted">Hạn xử lý: khẩn cấp 4 giờ, thông thường 48 giờ.</p>
          </section>
        )}
      </Body>

      {/* Ticket Detail Modal */}
      <TicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />

      <Toast message={error} onClose={() => setError("")} />
    </div>
  );
}

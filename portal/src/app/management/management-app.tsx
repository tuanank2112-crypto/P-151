"use client";

import { useState } from "react";
import { ticketDetailAction } from "@/app/actions/detail";
import {
  approveInspectionAction,
  bqlDecideWrongDeptAction,
  emergencyCloseAction,
  emergencyDowngradeAction,
  finishBqlTicketAction,
  rejectInspectionAction,
  returnBqlTicketAction,
} from "@/app/actions/management";
import { IconBars, IconBriefcase, IconGrid, IconTable } from "@/components/icons";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { TicketDetailModal } from "@/components/ticket-detail-modal";
import { Toast } from "@/components/toast";
import { useAction } from "@/components/use-action";
import { DEPT_LABEL, ROLE_LABEL, type Dept } from "@/lib/constants";
import type { ManagementData, MgmtTicket, TicketDetail } from "@/lib/dto";
import { SITE_CHECKS } from "@/lib/inspection";

type Tab = "overview" | "all" | "mine" | "teams";
type Filter = "all" | "cho_phan_loai" | "dang_xu_ly" | "urgent" | "late" | "ve_sinh" | "ky_thuat";

const HEAD: Record<Tab, { title: string; sub: string }> = {
  overview: { title: "Tổng quan", sub: "Tình hình ticket toàn khu đô thị hôm nay." },
  all: { title: "Tất cả ticket", sub: "Chỉ Ban quản lý được xem toàn bộ ticket của mọi phòng ban. Bấm mã để xem chi tiết." },
  mine: {
    title: "Việc của Ban quản lý",
    sub: "Nghiệm thu hoàn tất hiện trường, việc về phí/thủ tục/an ninh, và các ticket cần BQL quyết.",
  },
  teams: { title: "Hiệu suất phòng ban", sub: "Khối lượng và ticket quá hạn của từng phòng ban." },
};

const FILTERS: [Filter, string][] = [
  ["all", "Tất cả"],
  ["cho_phan_loai", "Chờ phân loại"],
  ["dang_xu_ly", "Đang xử lý"],
  ["urgent", "Khẩn cấp"],
  ["late", "Quá hạn"],
  ["ve_sinh", "Phòng VS"],
  ["ky_thuat", "Phòng KT"],
];

const WORKLOAD_DEPTS = ["ve_sinh", "ky_thuat"] as const;
const SHORT_DEPT: Record<string, string> = { ve_sinh: "Phòng VS", ky_thuat: "Phòng KT" };

const open = (t: MgmtTicket) => !t.cancelled && t.stage < 5;

/** Overview cards and the "Tất cả" filters share one definition, so a card number equals the rows after its filter */
const matches: Record<Filter, (t: MgmtTicket) => boolean> = {
  all: (t) => !t.merged,
  cho_phan_loai: (t) => !t.cancelled && t.stage <= 2,
  dang_xu_ly: (t) => !t.cancelled && (t.stage === 3 || t.stage === 4),
  urgent: (t) => !t.cancelled && t.riskLevel === "EMERGENCY" && t.stage < 6,
  late: (t) => !t.cancelled && t.late,
  ve_sinh: (t) => t.dept === "ve_sinh",
  ky_thuat: (t) => t.dept === "ky_thuat",
};

/** Status pill of the management tables */
function status(t: MgmtTicket): [string, string] {
  if (t.cancelled) return ["pill st-hoan_thanh", "Đã hủy"];
  if (t.stage <= 2) return ["pill st-moi", "Chờ phân loại"];
  if (t.stage <= 4) return ["pill st-dang_xu_ly", "Đang xử lý"];
  if (t.stage === 5) return ["pill st-da_chuyen", "Chờ nghiệm thu"];
  return ["pill st-hoan_thanh", "Hoàn thành"];
}

const deptPill = (d: Dept | null) => `pill cat-${d ?? "none"}`;

export function ManagementApp({ data }: { data: ManagementData }) {
  const { pending, error, setError, run } = useAction();
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rejectId, setRejectId] = useState<string | null>(null);
  // Mục BQL đã tự tích tại hiện trường, theo từng ticket
  const [siteChecked, setSiteChecked] = useState<Record<string, string[]>>({});
  const toggleSite = (id: string, key: string) =>
    setSiteChecked((s) => {
      const cur = s[id] ?? [];
      return { ...s, [id]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] };
    });
  const note = (id: string) => notes[id] ?? "";
  const setNote = (id: string, v: string) => setNotes((n) => ({ ...n, [id]: v }));
  const openDetail = (id: string) => run(() => ticketDetailAction(id), setSelectedTicket);

  const all = data.tickets;
  const count = (f: Filter) => all.filter(matches[f]).length;
  const attention = all.filter((t) => matches.urgent(t) || matches.late(t));

  const inspectionTickets = all.filter((t) => !t.cancelled && t.stage === 5);
  const bqlWorkTickets = all.filter((t) => !t.cancelled && t.bqlWork && t.stage <= 2);
  const decideTickets = all.filter(
    (t) => !t.cancelled && (t.blockerCode === "EMERGENCY_PENDING_BQL" || t.blockerCode === "WRONG_DEPT_AFTER_START"),
  );
  const totalBqlPending = inspectionTickets.length + bqlWorkTickets.length + decideTickets.length;

  const rows = all.filter(matches[filter]);

  const cards: { label: string; f: Filter }[] = [
    { label: "Tổng ticket", f: "all" },
    { label: "Chờ phân loại", f: "cho_phan_loai" },
    { label: "Đang xử lý", f: "dang_xu_ly" },
    { label: "Khẩn cấp chưa xong", f: "urgent" },
    { label: "Quá hạn", f: "late" },
  ];

  const noteInput = (t: MgmtTicket, placeholder: string) => (
    <input
      type="text"
      className="w-full text-xs p-2 rounded-lg border border-line bg-white"
      placeholder={placeholder}
      value={note(t.id)}
      onChange={(e) => setNote(t.id, e.target.value)}
    />
  );

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
          tag: t.late ? "Quá hạn" : "Khẩn cấp",
          body: `Trạng thái: ${t.statusLabel} · Vị trí: ${t.location}`,
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
            <div className="flex flex-wrap gap-4">
              {cards.map((card) => (
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
                  <span className="text-sm text-muted group-hover:text-sky-700 font-medium transition-colors">{card.label}</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[30px] font-bold tracking-[-0.02em] group-hover:text-sky-600 transition-colors">
                      {count(card.f)}
                    </span>
                    <span className="text-xs text-muted opacity-0 group-hover:opacity-100 transition-opacity">Xem danh sách →</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-start gap-4">
              <section className="card flex min-w-0 flex-col gap-4 p-6" style={{ flex: "1 1 450px" }}>
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <h2 className="m-0 text-lg font-bold text-body">Phụ tải phòng ban</h2>
                  <span className="text-[11px] text-sky-600 font-medium">Bấm vào hàng để lọc ticket</span>
                </div>
                <div className="flex flex-col divide-y divide-line-soft">
                  {WORKLOAD_DEPTS.map((d) => {
                    const n = all.filter((t) => open(t) && t.dept === d).length;
                    return (
                      <div
                        key={d}
                        role="button"
                        tabIndex={0}
                        className="flex items-center justify-between py-3 cursor-pointer rounded-xl p-2 hover:bg-soft/70 transition-colors"
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
                        <span className="font-semibold text-body">{DEPT_LABEL[d]}</span>
                        <span className="text-sm font-bold text-body">{n} đang mở</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="card flex min-w-0 flex-col gap-1 p-6" style={{ flex: "1 1 420px" }}>
                <h2 className="mt-0 mb-2 text-lg font-bold">Cần chú ý: khẩn cấp hoặc quá hạn</h2>
                {attention.length === 0 && <span className="text-sm text-muted">Không có ticket nào cần chú ý.</span>}
                {attention.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center gap-2 border-t border-line-soft py-3.5 cursor-pointer hover:bg-soft/40 p-2 rounded-lg transition-colors"
                    onClick={() => openDetail(t.id)}
                  >
                    <span className="text-sm font-bold text-brand hover:underline">{t.code}</span>
                    {matches.urgent(t) && <span className="pill urgent">Khẩn cấp</span>}
                    {t.late && <span className="pill late">Quá hạn</span>}
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
                            onClick={() => openDetail(t.id)}
                            className="font-mono text-sky-700 hover:text-sky-900 hover:underline font-bold text-left"
                            title="Bấm để xem chi tiết đầy đủ"
                          >
                            {t.code}
                          </button>
                        </td>
                        <td className="max-w-[340px] leading-[1.45]">
                          <span className="cursor-pointer hover:text-slate-900" onClick={() => openDetail(t.id)}>
                            {t.text}
                          </span>
                          <br />
                          <span className="text-xs text-muted">{t.location}</span>
                        </td>
                        <td>
                          <span className={deptPill(t.dept)}>
                            <span className="dot" />
                            {t.dept === "bql" ? "Việc của BQL" : t.dept ? DEPT_LABEL[t.dept] : "Chờ phân loại"}
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
                      <td colSpan={5} className="text-center text-muted py-8">
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
            {/* 1. Chờ nghiệm thu */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-line pb-2">
                <span className="text-xl">📋</span>
                <h3 className="m-0 text-base font-bold text-slate-800">Chờ Ban quản lý nghiệm thu ({inspectionTickets.length})</h3>
              </div>
              {inspectionTickets.length === 0 && (
                <div className="card p-6 text-center text-muted text-sm">Hiện không có ticket nào đang chờ nghiệm thu.</div>
              )}
              {inspectionTickets.map((t) => {
                const checked = siteChecked[t.id] ?? [];
                const siteDone = SITE_CHECKS.every((c) => checked.includes(c.key));
                return (
                  <article key={t.id} className="card flex flex-col gap-4 p-6 border-l-4 border-l-sky-500 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => openDetail(t.id)} className="font-mono text-base font-bold text-sky-700 hover:underline">
                        {t.code}
                      </button>
                      <span className="text-xs text-muted">
                        {t.createdAt} · {t.location}
                      </span>
                      <span className="pill st-da_chuyen ml-auto">Chờ nghiệm thu</span>
                    </div>
                    <div className="text-[15px] font-medium text-slate-800">{t.text}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-sky-900">
                      {SITE_CHECKS.map((c) => (
                        <label key={c.key} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={checked.includes(c.key)} onChange={() => toggleSite(t.id, c.key)} />
                          <span>{c.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line-soft">
                      <button
                        type="button"
                        className="btn primary bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                        disabled={pending || !siteDone}
                        title={siteDone ? undefined : "Tích đủ mục xác nhận tại hiện trường trước khi nghiệm thu"}
                        onClick={() => run(() => approveInspectionAction(t.id))}
                      >
                        ✓ Nghiệm thu đạt (Hoàn thành)
                      </button>
                      <button
                        type="button"
                        className="btn border border-rose-300 text-rose-700 hover:bg-rose-50"
                        disabled={pending}
                        onClick={() => setRejectId(t.id)}
                      >
                        ✕ Chưa đạt, trả làm lại
                      </button>
                      <button type="button" className="btn text-xs ml-auto" onClick={() => openDetail(t.id)}>
                        Xem chi tiết đầy đủ →
                      </button>
                    </div>
                    {rejectId === t.id && (
                      <div className="mt-2 p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2">
                        {noteInput(t, "Lý do chưa đạt để đơn vị làm lại")}
                        <div className="flex justify-end gap-2">
                          <button type="button" className="btn text-xs" onClick={() => setRejectId(null)}>
                            Hủy
                          </button>
                          <button
                            type="button"
                            className="btn primary bg-rose-600 text-white text-xs"
                            disabled={pending}
                            onClick={() => run(() => rejectInspectionAction(t.id, note(t.id)), () => setRejectId(null))}
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

            {/* 2. Việc của BQL */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-line pb-2">
                <span className="text-xl">🏢</span>
                <h3 className="m-0 text-base font-bold text-slate-800">Việc của Ban quản lý ({bqlWorkTickets.length})</h3>
              </div>
              <p className="m-0 text-[13px] text-muted">
                Ticket về phí, thủ tục, an ninh, tranh chấp cư dân. Có thể chuyển lại nếu không thuộc thẩm quyền.
              </p>
              {bqlWorkTickets.length === 0 && (
                <div className="card p-6 text-center text-muted text-sm">Chưa có ticket nào cần BQL xử lý.</div>
              )}
              {bqlWorkTickets.map((t) => (
                <article key={t.id} className="card flex flex-col gap-3 p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => openDetail(t.id)} className="text-base font-bold text-brand hover:underline">
                      {t.code}
                    </button>
                    <span className="text-[13px] text-muted">
                      {t.createdAt} · {t.location}
                    </span>
                  </div>
                  <p className="m-0 text-[15px] leading-[1.55]">{t.text}</p>
                  {noteInput(t, "Ghi chú xử lý / lý do chuyển lại")}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn primary"
                      disabled={pending || !note(t.id).trim()}
                      onClick={() => run(() => finishBqlTicketAction(t.id, note(t.id)))}
                    >
                      Đã xử lý xong
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={pending || !note(t.id).trim()}
                      onClick={() => run(() => returnBqlTicketAction(t.id, note(t.id)))}
                    >
                      Chuyển lại Tiếp nhận
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {/* 3. Cần BQL quyết */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-line pb-2">
                <span className="text-xl">⚠️</span>
                <h3 className="m-0 text-base font-bold text-amber-900">Cần BQL quyết ({decideTickets.length})</h3>
              </div>
              {decideTickets.length === 0 && <div className="card p-6 text-center text-muted text-sm">Không có ticket nào cần quyết.</div>}
              {decideTickets.map((t) => (
                <article key={t.id} className="card flex flex-col gap-3 p-6 border-l-4 border-l-amber-500 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => openDetail(t.id)} className="font-mono text-base font-bold text-amber-800 hover:underline">
                      {t.code}
                    </button>
                    <span className="text-xs text-muted">
                      {t.createdAt} · {t.location}
                    </span>
                    <span className="pill late ml-auto">
                      {t.blockerCode === "EMERGENCY_PENDING_BQL" ? "Khẩn cấp chờ BQL" : "Báo sai phòng sau khi nhận"}
                    </span>
                  </div>
                  <p className="m-0 text-[15px] font-medium text-slate-800">{t.text}</p>
                  {noteInput(t, "Ghi chú")}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line-soft">
                    {t.blockerCode === "EMERGENCY_PENDING_BQL" ? (
                      <>
                        <button
                          type="button"
                          className="btn primary bg-rose-600 text-white"
                          disabled={pending || !note(t.id).trim()}
                          onClick={() => run(() => emergencyCloseAction(t.id, note(t.id)))}
                        >
                          Đóng khẩn cấp (đã xử lý ngoài hệ thống)
                        </button>
                        <button
                          type="button"
                          className="btn"
                          disabled={pending || !note(t.id).trim()}
                          onClick={() => run(() => emergencyDowngradeAction(t.id, note(t.id)))}
                        >
                          Hạ mức (báo động giả)
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn primary bg-amber-600 hover:bg-amber-700 text-white"
                          disabled={pending}
                          onClick={() => run(() => bqlDecideWrongDeptAction(t.id, "TO_BPTN", note(t.id)))}
                        >
                          ↩️ Chuyển về Ban tiếp nhận
                        </button>
                        <button
                          type="button"
                          className="btn border border-slate-300 hover:bg-slate-50"
                          disabled={pending}
                          onClick={() => run(() => bqlDecideWrongDeptAction(t.id, "KEEP", note(t.id)))}
                        >
                          ▶️ Giữ phòng — làm tiếp
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
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
                </tr>
              </thead>
              <tbody>
                {WORKLOAD_DEPTS.map((d) => {
                  const own = all.filter((t) => !t.cancelled && t.dept === d);
                  const late = own.filter((t) => t.late).length;
                  return (
                    <tr key={d}>
                      <td>
                        <span className={`pill cat-${d}`}>
                          <span className="dot" />
                          {SHORT_DEPT[d]}
                        </span>
                      </td>
                      <td className="font-bold">{own.filter(open).length}</td>
                      <td>{own.filter((t) => t.stage >= 5).length}</td>
                      <td>
                        <span className={late ? "pill late" : "pill st-hoan_thanh"}>{late}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
      </Body>

      <TicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      <Toast message={error} onClose={() => setError("")} />
    </div>
  );
}

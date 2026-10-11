"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { IconBars, IconBox, IconBriefcase, IconGrid, IconTable } from "@/components/icons";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { TicketDetailModal } from "@/components/ticket-detail-modal";
import { TicketEvidence } from "@/components/ticket-evidence";
import { Toast } from "@/components/toast";
import { useAction } from "@/components/use-action";
import { DEPT_LABEL, ROLE_LABEL, type Dept } from "@/lib/constants";
import type { ManagementData, MgmtTicket, TicketDetail } from "@/lib/dto";
import { deptLoadFilter, deptPerformance, overviewCount, overviewFilter, type OverviewKind } from "@/lib/backend-map";
import { SITE_CHECKS } from "@/lib/inspection";

type Tab = "overview" | "all" | "mine" | "teams";
type Filter = "all" | "waiting" | "processing" | "emergency" | "late" | "ve_sinh" | "ky_thuat";
type BqlFilter = "accepted" | "done" | "all";

const HEAD: Record<Tab, { title: string; sub: string }> = {
  overview: { title: "Tổng quan", sub: "Tình hình ticket toàn khu đô thị hôm nay." },
  all: { title: "Tất cả ticket", sub: "Chỉ Ban quản lý được xem toàn bộ ticket của mọi phòng ban. Bấm bất kỳ dòng nào để xem chi tiết." },
  mine: {
    title: "Việc của Ban quản lý",
    sub: "Nghiệm thu hoàn tất hiện trường, việc ngoài phạm vi vệ sinh/kỹ thuật, và các ticket cần BQL quyết.",
  },
  teams: { title: "Hiệu suất phòng ban", sub: "Khối lượng, ticket quá hạn, đánh giá và thời gian hoàn thành của từng phòng ban." },
};

const FILTERS: [Filter, string][] = [
  ["all", "Tất cả"],
  ["waiting", "Chờ phân loại"],
  ["processing", "Đang xử lý"],
  ["emergency", "Khẩn cấp"],
  ["late", "Quá hạn"],
  ["ve_sinh", "Phòng VS"],
  ["ky_thuat", "Phòng KT"],
];

const BQL_FILTERS: [BqlFilter, string][] = [
  ["accepted", "Đã tiếp nhận"],
  ["done", "Đã hoàn thành"],
  ["all", "Tất cả"],
];

const WORKLOAD_DEPTS = ["ve_sinh", "ky_thuat"] as const;
const SHORT_DEPT: Record<string, string> = { ve_sinh: "Phòng VS", ky_thuat: "Phòng KT" };
const OVERVIEW_KIND: Partial<Record<Filter, OverviewKind>> = {
  all: "total",
  waiting: "waiting",
  processing: "processing",
  emergency: "emergency",
  late: "late",
};

/** One definition for the overview tiles and the chips of "Tất cả ticket": a tile number equals the rows after its filter */
function predicate(f: Filter, showAll: boolean): (t: MgmtTicket) => boolean {
  const kind = OVERVIEW_KIND[f];
  if (kind) return overviewFilter(kind);
  return deptLoadFilter(f as Dept, showAll);
}

/** Closed by the BQL itself (OUT_OF_SCOPE handled): no department, not an emergency closure (plan 11 Q09) */
const bqlDone = (t: MgmtTicket) =>
  !t.cancelled && t.stage === 6 && t.dept === null && t.closureKind === "EMERGENCY_HANDLED" && t.riskLevel !== "EMERGENCY";

const activate = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600";

const agentLabel = (t: MgmtTicket): string => {
  if (t.agentDept === "bql") return "Ban quản lý (ngoài phạm vi)";
  if (t.agentDept) return DEPT_LABEL[t.agentDept];
  return t.agentSource && t.agentSource !== "AGENT" ? "Luật cố định (Agent không quyết)" : "Chưa có";
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
  const router = useRouter();
  const { pending, error, setError, run } = useAction();
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<Filter>("all");
  const [showAll, setShowAll] = useState(false);
  const [bqlFilter, setBqlFilter] = useState<BqlFilter>("accepted");
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rejectId, setRejectId] = useState<string | null>(null);
  // Mục BQL đã tự tích tại hiện trường, theo từng ticket
  const [siteChecked, setSiteChecked] = useState<Record<string, string[]>>({});
  // Chi tiết (ảnh sau xử lý, checklist, vật tư) của ticket chờ nghiệm thu
  const [details, setDetails] = useState<Record<string, TicketDetail | "error">>({});
  const toggleSite = (id: string, key: string) =>
    setSiteChecked((s) => {
      const cur = s[id] ?? [];
      return { ...s, [id]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] };
    });
  const note = (id: string) => notes[id] ?? "";
  const setNote = (id: string, v: string) => setNotes((n) => ({ ...n, [id]: v }));
  const openDetail = (id: string) => run(() => ticketDetailAction(id), setSelectedTicket);
  const goFilter = (f: Filter, everything = false) => {
    setFilter(f);
    setShowAll(everything);
    setTab("all");
  };

  const all = data.tickets;
  const rows = all.filter(predicate(filter, showAll));
  const attention = all.filter((t) => overviewFilter("emergency")(t) || overviewFilter("late")(t));

  const inspectionTickets = all.filter((t) => !t.cancelled && t.stage === 5);
  const closedDeptTickets = all.filter((t) => !t.cancelled && t.stage === 6 && !bqlDone(t));
  const bqlOpenTickets = all.filter((t) => !t.cancelled && t.bqlWork && t.stage <= 2);
  const bqlDoneTickets = all.filter(bqlDone);
  const decideTickets = all.filter(
    (t) => !t.cancelled && (t.blockerCode === "EMERGENCY_PENDING_BQL" || t.blockerCode === "WRONG_DEPT_AFTER_START"),
  );
  const totalBqlPending = inspectionTickets.length + bqlOpenTickets.length + decideTickets.length;

  const showAccepted = bqlFilter !== "done";
  const showDone = bqlFilter !== "accepted";
  const inspectionList = [...(showAccepted ? inspectionTickets : []), ...(showDone ? closedDeptTickets : [])];
  const bqlList = [...(showAccepted ? bqlOpenTickets : []), ...(showDone ? bqlDoneTickets : [])];
  const decideList = showAccepted ? decideTickets : [];
  const bqlCount: Record<BqlFilter, number> = {
    accepted: totalBqlPending,
    done: closedDeptTickets.length + bqlDoneTickets.length,
    all: totalBqlPending + closedDeptTickets.length + bqlDoneTickets.length,
  };

  // load the evidence of tickets waiting for acceptance (photos, checklist, materials)
  const inspectionKey = inspectionTickets.map((t) => t.id).join(",");
  useEffect(() => {
    let alive = true;
    for (const id of inspectionKey ? inspectionKey.split(",") : []) {
      ticketDetailAction(id)
        .then((r) => alive && setDetails((d) => ({ ...d, [id]: r.ok ? r.data : "error" })))
        .catch(() => alive && setDetails((d) => ({ ...d, [id]: "error" })));
    }
    return () => {
      alive = false;
    };
  }, [inspectionKey]);

  const cards: { label: string; f: Filter }[] = [
    { label: "Tổng ticket", f: "all" },
    { label: "Chờ phân loại", f: "waiting" },
    { label: "Đang xử lý", f: "processing" },
    { label: "Khẩn cấp chưa xong", f: "emergency" },
    { label: "Quá hạn", f: "late" },
  ];

  const noteInput = (t: MgmtTicket, placeholder: string) => (
    <input
      type="text"
      className="w-full text-xs p-2 rounded-lg border border-line bg-white"
      placeholder={placeholder}
      aria-label={placeholder}
      value={note(t.id)}
      onChange={(e) => setNote(t.id, e.target.value)}
    />
  );

  /** Title + content, as the resident wrote them */
  const reportText = (t: MgmtTicket) => (
    <div className="flex flex-col gap-1">
      <span className="text-[15px] font-bold text-slate-800">{t.title}</span>
      {t.content && <span className="whitespace-pre-wrap text-[14px] leading-[1.5] text-slate-700">{t.content}</span>}
    </div>
  );

  const codeButton = (t: MgmtTicket, cls = "font-mono text-base font-bold text-sky-700") => (
    <button type="button" onClick={() => openDetail(t.id)} className={`${cls} hover:underline cursor-pointer text-left ${FOCUS}`}>
      {t.code}
    </button>
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
          title: `${t.code}: ${t.title}`,
          urgent: t.urgent,
          tag: t.late ? "Quá hạn" : "Khẩn cấp",
          body: `Trạng thái: ${t.statusLabel} · Vị trí: ${t.location}`,
        }))}
      />
      <Body>
        <NavTiles<Tab | "warehouse">
          label="Chức năng ban quản lý"
          active={tab}
          onPick={(k) => (k === "warehouse" ? router.push("/warehouse?from=management") : setTab(k))}
          items={[
            { key: "overview", label: "Tổng quan", icon: <IconGrid /> },
            { key: "all", label: "Tất cả ticket", icon: <IconTable />, count: all.filter(overviewFilter("total")).length },
            { key: "mine", label: "Việc của BQL", icon: <IconBriefcase />, count: totalBqlPending },
            { key: "teams", label: "Hiệu suất phòng ban", icon: <IconBars /> },
            { key: "warehouse", label: "Kho vật tư", icon: <IconBox /> },
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
                  data-testid={`tile-${card.f}`}
                  className={`card flex flex-col gap-1 px-6 py-5 cursor-pointer hover:border-sky-400 hover:shadow-md transition-all group select-none ${FOCUS}`}
                  style={{ flex: "1 1 170px" }}
                  onClick={() => goFilter(card.f)}
                  onKeyDown={activate(() => goFilter(card.f))}
                >
                  <span className="text-sm text-muted group-hover:text-sky-700 font-medium transition-colors">{card.label}</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[30px] font-bold tracking-[-0.02em] group-hover:text-sky-600 transition-colors">
                      {overviewCount(all, OVERVIEW_KIND[card.f] ?? "total")}
                    </span>
                    <span className="text-xs text-muted opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                      Xem danh sách →
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-start gap-4">
              <section className="card flex min-w-0 flex-col gap-4 p-6" style={{ flex: "1 1 450px" }}>
                <div className="flex flex-wrap items-center justify-between gap-1 border-b border-line pb-3">
                  <h2 className="m-0 text-lg font-bold text-body">Điều phối và phụ tải phòng ban</h2>
                  <span className="text-[11px] text-sky-600 font-medium">Bấm vào hàng để xem ticket phòng chưa xử lý xong</span>
                </div>
                <div className="flex flex-col divide-y divide-line-soft">
                  {WORKLOAD_DEPTS.map((d) => {
                    const n = all.filter(deptLoadFilter(d, false)).length;
                    return (
                      <div
                        key={d}
                        role="button"
                        tabIndex={0}
                        data-testid={`load-${d}`}
                        className={`flex items-center justify-between py-3 cursor-pointer rounded-xl p-2 hover:bg-soft/70 transition-colors ${FOCUS}`}
                        onClick={() => goFilter(d)}
                        onKeyDown={activate(() => goFilter(d))}
                      >
                        <span className="font-semibold text-body">{DEPT_LABEL[d]}</span>
                        <span className="text-sm font-bold text-body">{n} chưa xử lý xong</span>
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
                    role="button"
                    tabIndex={0}
                    className={`flex flex-wrap items-center gap-2 border-t border-line-soft py-3.5 cursor-pointer hover:bg-soft/40 p-2 rounded-lg transition-colors ${FOCUS}`}
                    onClick={() => openDetail(t.id)}
                    onKeyDown={activate(() => openDetail(t.id))}
                  >
                    <span className="text-sm font-bold text-brand hover:underline">{t.code}</span>
                    {overviewFilter("emergency")(t) && <span className="pill urgent">Khẩn cấp</span>}
                    {t.late && <span className="pill late">Quá hạn</span>}
                    <span className={`${deptPill(t.dept)} ml-auto`}>
                      <span className="dot" />
                      {t.dept === "bql" ? "Việc của BQL" : t.dept ? DEPT_LABEL[t.dept] : "Chờ phân loại"}
                    </span>
                    <span className="basis-full text-sm leading-[1.45]">{t.title}</span>
                  </div>
                ))}
              </section>
            </div>
          </div>
        )}

        {tab === "all" && (
          <section className="card flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={filter === key ? "fchip on" : "fchip"}
                  aria-pressed={filter === key}
                  onClick={() => {
                    setFilter(key);
                    setShowAll(false);
                  }}
                >
                  {label}
                </button>
              ))}
              {(filter === "ve_sinh" || filter === "ky_thuat") && (
                <button
                  type="button"
                  className={showAll ? "fchip on" : "fchip"}
                  aria-pressed={showAll}
                  onClick={() => setShowAll((v) => !v)}
                  title="Gồm cả ticket đã xong hoặc đã hủy"
                >
                  Gồm đã xong/hủy
                </button>
              )}
              <span className="ml-auto text-xs text-muted" data-testid="row-count">
                {rows.length} ticket
              </span>
            </div>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Nội dung</th>
                    <th>Phòng ban</th>
                    <th>Agent gợi ý</th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const [stCls, stLabel] = status(t);
                    return (
                      <tr
                        key={t.id}
                        data-testid="ticket-row"
                        className="cursor-pointer hover:bg-slate-50/70 transition-colors"
                        onClick={() => openDetail(t.id)}
                      >
                        <td className="font-bold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetail(t.id);
                            }}
                            className={`font-mono text-sky-700 hover:text-sky-900 hover:underline font-bold text-left cursor-pointer ${FOCUS}`}
                            title="Bấm để xem chi tiết đầy đủ"
                          >
                            {t.code}
                          </button>
                        </td>
                        <td className="max-w-[340px] leading-[1.45]">
                          <span className="font-semibold">{t.title}</span>
                          {t.content && <span className="block text-xs text-slate-600 line-clamp-2">{t.content}</span>}
                          <span className="text-xs text-muted">{t.location}</span>
                          {t.urgent && <span className="pill urgent ml-2">Khẩn cấp</span>}
                        </td>
                        <td>
                          <span className={deptPill(t.dept)}>
                            <span className="dot" />
                            {t.dept === "bql" ? "Việc của BQL" : t.dept ? DEPT_LABEL[t.dept] : "Chờ phân loại"}
                          </span>
                        </td>
                        <td className="text-xs">{agentLabel(t)}</td>
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
            <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc việc của BQL">
              {BQL_FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={bqlFilter === key ? "fchip on" : "fchip"}
                  aria-pressed={bqlFilter === key}
                  onClick={() => setBqlFilter(key)}
                >
                  {label} ({bqlCount[key]})
                </button>
              ))}
            </div>

            {/* 1. Chờ nghiệm thu */}
            <div className="flex flex-col gap-3" data-testid="bql-inspection">
              <div className="flex items-center gap-2 border-b border-line pb-2">
                <span className="text-xl">📋</span>
                <h3 className="m-0 text-base font-bold text-slate-800">
                  {bqlFilter === "done" ? "Đã hoàn thành" : "Chờ nghiệm thu"} ({inspectionList.length})
                </h3>
              </div>
              {inspectionList.length === 0 && (
                <div className="card p-6 text-center text-muted text-sm">
                  {bqlFilter === "done" ? "Chưa có ticket nào đã hoàn thành." : "Hiện không có ticket nào đang chờ nghiệm thu."}
                </div>
              )}
              {inspectionList.map((t) => {
                if (t.stage === 6) {
                  return (
                    <article key={t.id} className="card flex flex-col gap-2 p-5 border-l-4 border-l-emerald-500 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        {codeButton(t)}
                        <span className="text-xs text-muted">
                          {t.createdAt} · {t.location}
                        </span>
                        <span className="pill st-hoan_thanh ml-auto">Hoàn thành</span>
                      </div>
                      {reportText(t)}
                      <div className="text-xs text-muted">
                        {t.dept && t.dept !== "bql" ? DEPT_LABEL[t.dept] : "Chưa có phòng"}
                        {t.ratingStars !== null && ` · ${t.ratingStars}/5 sao`}
                      </div>
                    </article>
                  );
                }
                const checked = siteChecked[t.id] ?? [];
                const siteDone = SITE_CHECKS.every((c) => checked.includes(c.key));
                const detail = details[t.id];
                return (
                  <article key={t.id} className="card flex flex-col gap-4 p-6 border-l-4 border-l-sky-500 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      {codeButton(t)}
                      <span className="text-xs text-muted">
                        {t.createdAt} · {t.location}
                      </span>
                      <span className="pill st-da_chuyen ml-auto">Chờ nghiệm thu</span>
                    </div>
                    {reportText(t)}
                    {detail && detail !== "error" ? (
                      <TicketEvidence detail={detail} compact />
                    ) : (
                      <p className="m-0 text-xs text-muted">
                        {detail === "error" ? "Không tải được minh chứng, bấm mã để xem chi tiết." : "Đang tải minh chứng…"}
                      </p>
                    )}
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
                        ✓ Nghiệm thu đạt — Hoàn thành
                      </button>
                      <button
                        type="button"
                        className="btn border border-rose-300 text-rose-700 hover:bg-rose-50"
                        disabled={pending}
                        onClick={() => setRejectId(t.id)}
                      >
                        ✕ Trả làm lại
                      </button>
                      <button type="button" className="btn text-xs ml-auto" onClick={() => openDetail(t.id)}>
                        Xem chi tiết đầy đủ →
                      </button>
                    </div>
                    {rejectId === t.id && (
                      <div className="mt-2 p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2">
                        {noteInput(t, "Lý do trả làm lại")}
                        <div className="flex justify-end gap-2">
                          <button type="button" className="btn text-xs" onClick={() => setRejectId(null)}>
                            Hủy
                          </button>
                          <button
                            type="button"
                            className="btn primary bg-rose-600 text-white text-xs"
                            disabled={pending || !note(t.id).trim()}
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
            <div className="flex flex-col gap-3" data-testid="bql-work">
              <div className="flex items-center gap-2 border-b border-line pb-2">
                <span className="text-xl">🏢</span>
                <h3 className="m-0 text-base font-bold text-slate-800">Việc của Ban quản lý ({bqlList.length})</h3>
              </div>
              <p className="m-0 text-[13px] text-muted">
                Ticket ngoài phạm vi vệ sinh/kỹ thuật do Agent hoặc Ban tiếp nhận chuyển sang. Có thể chuyển lại Tiếp nhận nếu không thuộc thẩm quyền.
              </p>
              {bqlList.length === 0 && <div className="card p-6 text-center text-muted text-sm">Chưa có ticket nào trong mục này.</div>}
              {bqlList.map((t) => (
                <article key={t.id} className="card flex flex-col gap-3 p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    {codeButton(t, "text-base font-bold text-brand")}
                    <span className="text-[13px] text-muted">
                      {t.createdAt} · {t.location}
                    </span>
                    {t.stage === 6 ? (
                      <span className="pill st-hoan_thanh ml-auto">Hoàn thành</span>
                    ) : (
                      t.bqlSource && <span className="pill st-da_chuyen ml-auto">{t.bqlSource}</span>
                    )}
                  </div>
                  {reportText(t)}
                  {t.stage <= 2 && (
                    <>
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
                    </>
                  )}
                </article>
              ))}
            </div>

            {/* 3. Cần BQL quyết */}
            <div className="flex flex-col gap-3" data-testid="bql-decide">
              <div className="flex items-center gap-2 border-b border-line pb-2">
                <span className="text-xl">⚠️</span>
                <h3 className="m-0 text-base font-bold text-amber-900">Cần BQL quyết ({decideList.length})</h3>
              </div>
              {decideList.length === 0 && <div className="card p-6 text-center text-muted text-sm">Không có ticket nào cần quyết.</div>}
              {decideList.map((t) => (
                <article key={t.id} className="card flex flex-col gap-3 p-6 border-l-4 border-l-amber-500 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {codeButton(t, "font-mono text-base font-bold text-amber-800")}
                    <span className="text-xs text-muted">
                      {t.createdAt} · {t.location}
                    </span>
                    <span className="pill late ml-auto">
                      {t.blockerCode === "EMERGENCY_PENDING_BQL" ? "Khẩn cấp chờ BQL" : "Báo sai phòng sau khi nhận"}
                    </span>
                  </div>
                  {reportText(t)}
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
            <table data-testid="dept-perf">
              <thead>
                <tr>
                  <th>Phòng ban</th>
                  <th>Đang xử lý</th>
                  <th>Quá hạn</th>
                  <th>Đã đóng</th>
                  <th>Sao trung bình</th>
                  <th>Giờ hoàn thành TB</th>
                </tr>
              </thead>
              <tbody>
                {WORKLOAD_DEPTS.map((d) => {
                  const p = deptPerformance(all, d);
                  return (
                    <tr key={d}>
                      <td>
                        <span className={`pill cat-${d}`}>
                          <span className="dot" />
                          {SHORT_DEPT[d]}
                        </span>
                      </td>
                      <td className="font-bold">{p.processing}</td>
                      <td>
                        <span className={p.late ? "pill late" : "pill st-hoan_thanh"}>{p.late}</span>
                      </td>
                      <td>{p.closed}</td>
                      <td>{p.avgStars === null ? "Chưa có đánh giá" : `${p.avgStars}/5`}</td>
                      <td>{p.avgHours === null ? "Chưa có" : `${p.avgHours} giờ`}</td>
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

"use client";

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
import { IconBars, IconBriefcase, IconGrid, IconTable } from "@/components/icons";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { TicketDetailModal } from "@/components/ticket-detail-modal";
import { TicketEvidence } from "@/components/ticket-evidence";
import { Toast } from "@/components/toast";
import { useAction } from "@/components/use-action";
import { DEPT_LABEL, ROLE_LABEL } from "@/lib/constants";
import type { ManagementData, MgmtTicket, TicketDetail } from "@/lib/dto";
import { deptPerformance, overviewCount, overviewFilter, type OverviewKind } from "@/lib/backend-map";
import { BQL_BOXES, LIST_GROUPS, NO_DEPT, bqlBox, decideRank, deptLoad, headline, listGroup, type BqlBox, type ListGroup } from "@/lib/bql-view";
import { SITE_CHECKS } from "@/lib/inspection";
import { hasLocation, matchesDoneSearch } from "@/lib/reception-done";

type Tab = "overview" | "all" | "mine" | "teams";
type DeptSel = "all" | "ve_sinh" | "ky_thuat" | "bql";

const HEAD: Record<Tab, { title: string; sub: string }> = {
  overview: { title: "Tổng quan", sub: "Tình hình ticket toàn khu đô thị." },
  all: { title: "Danh sách ticket", sub: "Toàn bộ ticket của mọi phòng ban, mỗi ticket nằm ở đúng một trạng thái." },
  mine: { title: "Việc của Ban quản lý", sub: "Ticket cần BQL quyết, chờ nghiệm thu và đã hoàn tất." },
  teams: { title: "Hiệu suất phòng ban", sub: "Khối lượng, ticket quá hạn, đánh giá và thời gian hoàn thành của từng phòng ban." },
};

const WORKLOAD_DEPTS = ["ve_sinh", "ky_thuat"] as const;
const SHORT_DEPT: Record<string, string> = { ve_sinh: "Phòng VS", ky_thuat: "Phòng KT" };
const DEPT_OPTIONS: [DeptSel, string][] = [
  ["all", "Tất cả phòng"],
  ["ve_sinh", DEPT_LABEL.ve_sinh],
  ["ky_thuat", DEPT_LABEL.ky_thuat],
  ["bql", DEPT_LABEL.bql],
];

const activate = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600";
const CHIP = `min-h-9 cursor-pointer rounded-full px-4 text-[13px] font-semibold transition-colors ${FOCUS}`;
const chipCls = (on: boolean) => `${CHIP} ${on ? "bg-[#1D4ED8] text-white" : "bg-[#EEF2F7] text-[#2A3447] hover:bg-[#DCE8FF]"}`;

const agentLabel = (t: MgmtTicket): string => {
  if (t.agentDept === "bql") return "Ban quản lý (ngoài phạm vi)";
  if (t.agentDept) return DEPT_LABEL[t.agentDept];
  return t.agentSource && t.agentSource !== "AGENT" ? "Luật cố định (Agent không quyết)" : "Chưa có";
};

/** Who holds the ticket now: the department, the BQL, or nobody yet */
const holder = (t: MgmtTicket): { label: string; cls: string } => {
  if (t.dept === "bql" || listGroup(t) === "bql") return { label: DEPT_LABEL.bql, cls: "pill cat-bql" };
  if (t.dept) return { label: DEPT_LABEL[t.dept], cls: `pill cat-${t.dept}` };
  return { label: NO_DEPT, cls: "text-xs text-muted" };
};

const isEmergency = overviewFilter("emergency");

function DeptCell({ h }: { h: { label: string; cls: string } }) {
  if (h.label === NO_DEPT) return <span className={h.cls}>{h.label}</span>;
  return (
    <span className={h.cls}>
      <span className="dot" />
      {h.label}
    </span>
  );
}

function Badges({ t }: { t: MgmtTicket }) {
  return (
    <>
      {isEmergency(t) && <span className="pill urgent">Khẩn cấp</span>}
      {t.late && <span className="pill late">Quá hạn</span>}
    </>
  );
}

export function ManagementApp({ data }: { data: ManagementData }) {
  const { pending, error, setError, run } = useAction();
  const [tab, setTab] = useState<Tab>("overview");
  // "Danh sách ticket": one status group + secondary filters (SPEC-P02 §2); null group = first non-empty
  const [group, setGroup] = useState<ListGroup | null>(null);
  const [deptSel, setDeptSel] = useState<DeptSel>("all");
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [onlyLate, setOnlyLate] = useState(false);
  const [query, setQuery] = useState("");
  const [box, setBox] = useState<BqlBox | null>(null);
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

  const all = data.tickets;
  const attention = all.filter((t) => isEmergency(t) || overviewFilter("late")(t));
  // an emergency the BQL must decide opens its action card, any other ticket its detail
  const focusTicket = (t: MgmtTicket) => (isEmergency(t) && bqlBox(t) === "decide" ? goBox("decide") : openDetail(t.id));

  // ---- Danh sách ticket
  const secondary = (t: MgmtTicket) =>
    (deptSel === "all" || (deptSel === "bql" ? holder(t).label === DEPT_LABEL.bql : t.dept === deptSel)) &&
    (!onlyUrgent || isEmergency(t)) &&
    (!onlyLate || t.late) &&
    matchesDoneSearch(t, query);
  const filtered = all.filter(secondary);
  const groupCount = (k: ListGroup) => filtered.filter((t) => listGroup(t) === k).length;
  const activeGroup = group ?? LIST_GROUPS.find((g) => groupCount(g.key) > 0)?.key ?? "waiting";
  const rows = filtered.filter((t) => listGroup(t) === activeGroup);
  const showAgentCol = rows.some((t) => agentLabel(t) !== "Chưa có");
  const showDeptCol = rows.some((t) => holder(t).label !== NO_DEPT);
  const colCount = 2 + Number(showDeptCol) + Number(showAgentCol);
  const goList = (o: { group?: ListGroup | null; dept?: DeptSel; urgent?: boolean; late?: boolean } = {}) => {
    setGroup(o.group ?? null);
    setDeptSel(o.dept ?? "all");
    setOnlyUrgent(o.urgent ?? false);
    setOnlyLate(o.late ?? false);
    setQuery("");
    setTab("all");
  };

  // ---- Việc của BQL (SPEC-P02 §3)
  const inBox = (k: BqlBox) => all.filter((t) => bqlBox(t) === k);
  const decideList = [...inBox("decide")].sort((a, b) => decideRank(a) - decideRank(b));
  const inspectionTickets = inBox("review");
  const doneList = inBox("done");
  const boxCount: Record<BqlBox, number> = { decide: decideList.length, review: inspectionTickets.length, done: doneList.length };
  const activeBox = box ?? (decideList.length > 0 ? "decide" : (BQL_BOXES.find((b) => boxCount[b.key] > 0)?.key ?? "decide"));
  const totalBqlPending = boxCount.decide + boxCount.review;
  const goBox = (k: BqlBox) => {
    setBox(k);
    setTab("mine");
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

  // ---- Tổng quan (SPEC-P02 §4): neutral tiles, then warning tiles
  const cards: { label: string; kind: OverviewKind; alert: boolean; go: () => void }[] = [
    { label: "Tổng ticket", kind: "total", alert: false, go: () => goList() },
    { label: "Chờ phân loại", kind: "waiting", alert: false, go: () => goList({ group: "waiting" }) },
    { label: "Đang xử lý", kind: "processing", alert: false, go: () => goList({ group: "processing" }) },
    { label: "Khẩn cấp", kind: "emergency", alert: true, go: () => goBox("decide") },
    { label: "Quá hạn", kind: "late", alert: true, go: () => goList({ late: true }) },
  ];
  const loads = WORKLOAD_DEPTS.map((d) => ({ d, ...deptLoad(all, d) }));
  const maxOpen = Math.max(1, ...loads.map((l) => l.open));

  /** `required`: the action buttons stay off until a reason is typed, and the hint under the box says so (A4) */
  const noteInput = (t: MgmtTicket, placeholder: string, required = false) => {
    const missing = required && !note(t.id).trim();
    return (
      <div className="flex flex-col gap-1">
        <input
          type="text"
          className={`w-full text-xs p-2 rounded-lg border bg-white ${missing ? "border-amber-300" : "border-line"}`}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-describedby={missing ? `hint-${t.id}` : undefined}
          value={note(t.id)}
          onChange={(e) => setNote(t.id, e.target.value)}
        />
        {missing && (
          <span id={`hint-${t.id}`} className="text-[11px] text-amber-700">
            Nhập lý do để mở các nút bên dưới.
          </span>
        )}
      </div>
    );
  };

  /** Title + content, as the resident wrote them */
  const reportText = (t: MgmtTicket) => (
    <div className="flex flex-col gap-1">
      <span className="text-[15px] font-bold text-slate-800">{headline(t)}</span>
      {t.content && <span className="whitespace-pre-wrap text-[14px] leading-[1.5] text-slate-700">{t.content}</span>}
    </div>
  );

  const codeButton = (t: MgmtTicket, cls = "font-mono text-base font-bold text-sky-700") => (
    <button type="button" onClick={() => openDetail(t.id)} className={`${cls} hover:underline cursor-pointer text-left ${FOCUS}`}>
      {t.code}
    </button>
  );

  const meta = (t: MgmtTicket) => (
    <span className="text-xs text-muted">
      {t.createdAt}
      {hasLocation(t.location) ? ` · ${t.location}` : ""}
    </span>
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
          title: `${t.code}: ${headline(t)}`,
          tag: isEmergency(t) ? "Khẩn cấp" : "Quá hạn",
          body: `${holder(t).label} · ${t.statusLabel}${hasLocation(t.location) ? ` · ${t.location}` : ""}`,
        }))}
        onNotice={(id) => {
          const t = all.find((x) => x.id === id);
          if (t) focusTicket(t);
        }}
      />
      <Body>
        <NavTiles<Tab>
          label="Chức năng ban quản lý"
          active={tab}
          onPick={setTab}
          items={[
            { key: "overview", label: "Tổng quan", icon: <IconGrid /> },
            { key: "all", label: "Danh sách ticket", icon: <IconTable />, count: all.filter(overviewFilter("total")).length },
            { key: "mine", label: "Việc của Ban quản lý", icon: <IconBriefcase />, count: totalBqlPending },
            { key: "teams", label: "Hiệu suất phòng ban", icon: <IconBars /> },
          ]}
        />
        <PageHead {...HEAD[tab]} />

        {tab === "overview" && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-4">
              {cards.map((card) => {
                const n = overviewCount(all, card.kind);
                const hot = card.alert && n > 0;
                const tone = !hot
                  ? "border-l-4 border-l-transparent"
                  : card.kind === "emergency"
                    ? "border-l-4 border-l-rose-500 bg-rose-50"
                    : "border-l-4 border-l-amber-500 bg-amber-50";
                const num = !hot ? "text-slate-800" : card.kind === "emergency" ? "text-rose-600" : "text-amber-600";
                return (
                  <div
                    key={card.label}
                    role="button"
                    tabIndex={0}
                    data-testid={`tile-${card.kind}`}
                    className={`card flex flex-col gap-1 px-6 py-5 cursor-pointer hover:shadow-md transition-all select-none ${tone} ${FOCUS}`}
                    style={{ flex: "1 1 170px" }}
                    onClick={card.go}
                    onKeyDown={activate(card.go)}
                  >
                    <span className={`text-sm font-medium ${hot ? num : "text-muted"}`}>{card.label}</span>
                    <span className={`text-[30px] font-bold tracking-[-0.02em] ${num}`}>{n}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-start gap-4">
              <section className="card flex min-w-0 flex-col gap-4 p-6" style={{ flex: "1 1 420px" }}>
                <h2 className="m-0 text-lg font-bold text-body">Điều phối và phụ tải phòng ban</h2>
                <div className="flex flex-col gap-4">
                  {loads.map((l) => (
                    <div
                      key={l.d}
                      role="button"
                      tabIndex={0}
                      data-testid={`load-${l.d}`}
                      className={`flex flex-col gap-2 rounded-xl p-2 cursor-pointer hover:bg-soft/70 transition-colors ${FOCUS}`}
                      onClick={() => goList({ group: "processing", dept: l.d })}
                      onKeyDown={activate(() => goList({ group: "processing", dept: l.d }))}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-body">{DEPT_LABEL[l.d]}</span>
                        <span className="flex items-center gap-2 text-sm">
                          {l.late > 0 && <span className="pill late">{l.late} quá hạn</span>}
                          <span className="font-bold text-body">{l.open} đang mở</span>
                        </span>
                      </div>
                      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
                        <div className="h-full bg-sky-300" style={{ width: `${(l.waitingAccept / maxOpen) * 100}%` }} />
                        <div className="h-full bg-sky-600" style={{ width: `${(l.inProgress / maxOpen) * 100}%` }} />
                      </div>
                      <div className="flex gap-4 text-xs text-muted">
                        <span>
                          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-300" />
                          Chờ nhận việc {l.waitingAccept}
                        </span>
                        <span>
                          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-600" />
                          Đang làm {l.inProgress}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card flex min-w-0 flex-col gap-2 p-6" style={{ flex: "1 1 420px" }}>
                <h2 className="mt-0 mb-1 text-lg font-bold">Cần chú ý</h2>
                {attention.length === 0 && <span className="text-sm text-muted">Không có ticket khẩn cấp hoặc quá hạn.</span>}
                <ul className="m-0 flex list-none flex-col p-0">
                  {attention.map((t) => {
                    const h = holder(t);
                    return (
                      <li
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        className={`grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 border-t border-line-soft px-2 py-2.5 cursor-pointer hover:bg-soft/40 rounded-lg ${FOCUS}`}
                        onClick={() => focusTicket(t)}
                        onKeyDown={activate(() => focusTicket(t))}
                      >
                        <span className="font-mono text-[13px] font-bold text-sky-700">{t.code}</span>
                        {isEmergency(t) ? <span className="pill urgent">Khẩn cấp</span> : <span className="pill late">Quá hạn</span>}
                        <span className="truncate text-sm">{headline(t)}</span>
                        <span className={`${h.cls} text-xs`}>{h.label}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          </div>
        )}

        {tab === "all" && (
          <section className="card flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Trạng thái">
              {LIST_GROUPS.filter((g) => groupCount(g.key) > 0 || g.key === activeGroup).map((g) => (
                <button key={g.key} type="button" className={chipCls(activeGroup === g.key)} aria-pressed={activeGroup === g.key} onClick={() => setGroup(g.key)}>
                  {g.label} <span className="opacity-70">{groupCount(g.key)}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-3 text-[13px]">
              <select
                aria-label="Phòng ban"
                className={`field rounded-xl px-3 py-1.5 text-xs ${FOCUS}`}
                value={deptSel}
                onChange={(e) => setDeptSel(e.target.value as DeptSel)}
              >
                {DEPT_OPTIONS.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={onlyUrgent} onChange={(e) => setOnlyUrgent(e.target.checked)} />
                Chỉ khẩn cấp
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={onlyLate} onChange={(e) => setOnlyLate(e.target.checked)} />
                Chỉ quá hạn
              </label>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm mã, tiêu đề, vị trí…"
                aria-label="Tìm ticket"
                className="field w-full rounded-xl px-3 py-1.5 text-xs sm:w-60"
              />
              <span className="ml-auto text-xs text-muted" data-testid="row-count">
                {rows.length} ticket
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="tbl-stack">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    {showDeptCol && <th className="hidden sm:table-cell">Phòng ban</th>}
                    {showAgentCol && <th className="hidden sm:table-cell">Agent gợi ý</th>}
                    <th className="hidden sm:table-cell">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const h = holder(t);
                    return (
                      <tr key={t.id} data-testid="ticket-row" className="cursor-pointer hover:bg-slate-50/70 transition-colors" onClick={() => openDetail(t.id)}>
                        <td className="max-w-[460px] leading-[1.45]">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetail(t.id);
                              }}
                              className={`font-mono text-[13px] font-bold text-sky-700 hover:text-sky-900 hover:underline text-left cursor-pointer ${FOCUS}`}
                            >
                              {t.code}
                            </button>
                            <Badges t={t} />
                          </div>
                          <div className="line-clamp-1 font-semibold">{headline(t)}</div>
                          <div className="text-xs text-muted">
                            {t.statusLabel}
                            {hasLocation(t.location) ? ` · ${t.location}` : ""}
                          </div>
                          {/* A1: phones have no side columns, so the holder and the time go under the title */}
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted sm:hidden" data-testid="row-meta">
                            <DeptCell h={h} />
                            <span className="whitespace-nowrap">{t.createdAt}</span>
                          </div>
                        </td>
                        {showDeptCol && (
                          <td className="hidden sm:table-cell">
                            <DeptCell h={h} />
                          </td>
                        )}
                        {showAgentCol && <td className="hidden text-xs sm:table-cell">{agentLabel(t)}</td>}
                        <td className="hidden whitespace-nowrap text-muted sm:table-cell">{t.createdAt}</td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={colCount} className="text-center text-muted py-8">
                        Không có ticket nào khớp bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "mine" && (
          <section className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="group" aria-label="Việc của BQL">
              {BQL_BOXES.map((b) => {
                const on = activeBox === b.key;
                const warn = b.key === "decide" && boxCount.decide > 0;
                return (
                  <button
                    key={b.key}
                    type="button"
                    aria-pressed={on}
                    data-testid={`box-${b.key}`}
                    onClick={() => setBox(b.key)}
                    className={`card flex flex-col items-start gap-1 px-5 py-4 text-left transition-colors ${FOCUS} ${
                      on ? "ring-2 ring-[#1D4ED8] bg-[#EEF4FF]" : "hover:bg-slate-50"
                    } ${warn && !on ? "border-l-4 border-l-rose-500" : ""}`}
                  >
                    <span className={`text-sm font-semibold ${warn ? "text-rose-700" : "text-body"}`}>{b.label}</span>
                    <span className={`text-2xl font-bold ${warn ? "text-rose-600" : ""}`}>{boxCount[b.key]}</span>
                  </button>
                );
              })}
            </div>

            {activeBox === "decide" && (
              <div className="flex flex-col gap-3" data-testid="bql-decide">
                {decideList.length === 0 && <div className="card p-6 text-center text-muted text-sm">Không có ticket nào cần BQL quyết.</div>}
                {decideList.map((t) =>
                  decideRank(t) === 2 ? (
                    <article key={t.id} className="card flex flex-col gap-3 p-6" data-testid="bql-work">
                      <div className="flex flex-wrap items-center gap-2">
                        {codeButton(t, "font-mono text-base font-bold text-sky-700")}
                        {meta(t)}
                        <span className="pill cat-none ml-auto">Ngoài phạm vi{t.bqlSource ? ` · ${t.bqlSource}` : ""}</span>
                      </div>
                      {reportText(t)}
                      {noteInput(t, "Ghi chú xử lý / lý do chuyển lại", true)}
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" className="btn primary w-full justify-center" disabled={pending || !note(t.id).trim()} onClick={() => run(() => finishBqlTicketAction(t.id, note(t.id)))}>
                          Đã xử lý xong
                        </button>
                        <button type="button" className="btn w-full justify-center" disabled={pending || !note(t.id).trim()} onClick={() => run(() => returnBqlTicketAction(t.id, note(t.id)))}>
                          Chuyển lại Tiếp nhận
                        </button>
                      </div>
                    </article>
                  ) : (
                    <article
                      key={t.id}
                      className={`card flex flex-col gap-3 p-6 border-l-4 shadow-sm ${t.blockerCode === "EMERGENCY_PENDING_BQL" ? "border-l-rose-500" : "border-l-amber-500"}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {codeButton(t, "font-mono text-base font-bold text-sky-700")}
                        {meta(t)}
                        <span className={`${t.blockerCode === "EMERGENCY_PENDING_BQL" ? "pill urgent" : "pill late"} ml-auto`}>
                          {t.blockerCode === "EMERGENCY_PENDING_BQL" ? "Khẩn cấp" : "Báo sai phòng sau khi nhận"}
                        </span>
                      </div>
                      {reportText(t)}
                      {t.blockerCode === "EMERGENCY_PENDING_BQL" ? noteInput(t, "Lý do (bắt buộc)", true) : noteInput(t, "Ghi chú")}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line-soft">
                        {t.blockerCode === "EMERGENCY_PENDING_BQL" ? (
                          <>
                            <button
                              type="button"
                              className="btn primary w-full justify-center bg-rose-600 text-white"
                              disabled={pending || !note(t.id).trim()}
                              onClick={() => run(() => emergencyCloseAction(t.id, note(t.id)))}
                            >
                              Đóng khẩn cấp (đã xử lý)
                            </button>
                            <button
                              type="button"
                              className="btn w-full justify-center"
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
                              className="btn primary w-full justify-center bg-amber-600 hover:bg-amber-700 text-white"
                              disabled={pending}
                              onClick={() => run(() => bqlDecideWrongDeptAction(t.id, "TO_BPTN", note(t.id)))}
                            >
                              Chuyển về Ban tiếp nhận
                            </button>
                            <button
                              type="button"
                              className="btn w-full justify-center"
                              disabled={pending}
                              onClick={() => run(() => bqlDecideWrongDeptAction(t.id, "KEEP", note(t.id)))}
                            >
                              Giữ phòng — làm tiếp
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  ),
                )}
              </div>
            )}

            {activeBox === "review" && (
              <div className="flex flex-col gap-3" data-testid="bql-inspection">
                {inspectionTickets.length === 0 && <div className="card p-6 text-center text-muted text-sm">Hiện không có ticket nào đang chờ nghiệm thu.</div>}
                {inspectionTickets.map((t) => {
                  const checked = siteChecked[t.id] ?? [];
                  const siteDone = SITE_CHECKS.every((c) => checked.includes(c.key));
                  const detail = details[t.id];
                  return (
                    <article key={t.id} className="card flex flex-col gap-4 p-6 border-l-4 border-l-sky-500 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        {codeButton(t)}
                        {meta(t)}
                        {t.dept && t.dept !== "bql" && <span className={`pill cat-${t.dept} ml-auto`}>{DEPT_LABEL[t.dept]}</span>}
                      </div>
                      {reportText(t)}
                      {detail && detail !== "error" ? (
                        <TicketEvidence detail={detail} compact />
                      ) : (
                        <p className="m-0 text-xs text-muted">
                          {detail === "error" ? "Không tải được minh chứng, mở chi tiết ticket để xem." : "Đang tải minh chứng…"}
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
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line-soft">
                        <button
                          type="button"
                          className="btn primary w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                          disabled={pending || !siteDone}
                          title={siteDone ? undefined : "Tích đủ mục xác nhận tại hiện trường trước khi nghiệm thu"}
                          onClick={() => run(() => approveInspectionAction(t.id))}
                        >
                          Nghiệm thu đạt
                        </button>
                        <button
                          type="button"
                          className="btn w-full justify-center border border-rose-300 text-rose-700 hover:bg-rose-50"
                          disabled={pending}
                          onClick={() => setRejectId(t.id)}
                        >
                          Trả làm lại
                        </button>
                      </div>
                      {rejectId === t.id && (
                        <div className="mt-2 p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2">
                          {noteInput(t, "Lý do trả làm lại", true)}
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
            )}

            {activeBox === "done" && (
              <div className="flex flex-col gap-3" data-testid="bql-done">
                {doneList.length === 0 && <div className="card p-6 text-center text-muted text-sm">Chưa có ticket nào hoàn tất.</div>}
                {doneList.map((t) => (
                  <article key={t.id} className="card flex flex-col gap-2 p-5 border-l-4 border-l-emerald-500 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      {codeButton(t)}
                      {meta(t)}
                      <span className="pill st-hoan_thanh ml-auto">Hoàn tất</span>
                    </div>
                    <span className="text-[15px] font-semibold text-slate-800">{headline(t)}</span>
                    <div className="text-xs text-muted">
                      {t.dept && t.dept !== "bql" ? DEPT_LABEL[t.dept] : DEPT_LABEL.bql}
                      {t.ratingStars !== null && ` · ${t.ratingStars}/5 ⭐`}
                    </div>
                  </article>
                ))}
              </div>
            )}
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
                    <tr key={d} className="cursor-pointer hover:bg-slate-50/70" onClick={() => goList({ group: "processing", dept: d })}>
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
                      <td>
                        {p.avgStars === null ? (
                          <span className="pill bg-slate-100 text-slate-600">Chưa có đánh giá</span>
                        ) : (
                          `${p.avgStars}/5 ⭐ (${p.rated})`
                        )}
                      </td>
                      <td>{p.avgHours === null || p.avgHours === 0 ? "--" : `${p.avgHours} giờ`}</td>
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


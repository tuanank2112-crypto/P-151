"use client";

import { useState } from "react";
import { finishBqlTicketAction, reassignTicketAction, startTicketAction } from "@/app/actions/management";
import { IconBars, IconBriefcase, IconGrid, IconTable } from "@/components/icons";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { Toast } from "@/components/toast";
import { useAction } from "@/components/use-action";
import { DEPT_COLOR, DEPT_LABEL, DEPT_ORDER, ROLE_LABEL, type Dept } from "@/lib/constants";
import type { ManagementData, MgmtTicket } from "@/lib/dto";

type Tab = "overview" | "all" | "mine" | "teams";
type Filter = "all" | "moi" | Dept;

const HEAD: Record<Tab, { title: string; sub: string }> = {
  overview: { title: "Tổng quan", sub: "Tình hình ticket toàn khu đô thị hôm nay." },
  all: { title: "Tất cả ticket", sub: "Chỉ Ban quản lý được xem toàn bộ ticket của mọi phòng ban." },
  mine: {
    title: "Việc của Ban quản lý",
    sub: "Ticket về phí, thủ tục, an ninh, tranh chấp cư dân. Có thể chuyển lại nếu không thuộc thẩm quyền.",
  },
  teams: { title: "Hiệu suất phòng ban", sub: "So sánh khối lượng, tốc độ và mức hài lòng giữa các phòng ban." },
};

const FILTERS: [Filter, string][] = [
  ["all", "Tất cả"],
  ["moi", "Chờ phân loại"],
  ["ve_sinh", "Vệ sinh"],
  ["ky_thuat", "Kỹ thuật"],
  ["bql", "Ban quản lý"],
];

/** Open = not cancelled and not reported done (01-CONTRACTS §2) */
const open = (t: MgmtTicket) => !t.cancelled && t.stage < 5;
const lowRated = (t: MgmtTicket) => t.stars !== null && t.stars < 3;

/** Status pill of the management tables (01-CONTRACTS §2 mapping) */
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
  const all = data.tickets;
  const live = all.filter((t) => !t.cancelled);

  const pendingCount = live.filter((t) => t.stage === 1).length;
  const openBy = (d: Dept) => all.filter((t) => open(t) && t.dept === d).length;
  const bars: [string, number, string][] = [
    ["Chờ phân loại", pendingCount, "#B08A1E"],
    ...DEPT_ORDER.map((d): [string, number, string] => [DEPT_LABEL[d], openBy(d), DEPT_COLOR[d]]),
  ];
  const max = Math.max(1, ...bars.map((b) => b[1]));
  const attention = all.filter((t) => (open(t) && (t.urgent || t.late)) || lowRated(t));
  const mine = live.filter((t) => t.dept === "bql");
  const rows = all.filter((t) => (filter === "all" ? true : filter === "moi" ? !t.cancelled && t.stage === 1 : t.dept === filter));

  return (
    <div className="scr-management min-h-screen bg-page">
      <Header
        avatar={data.user.avatar}
        name={data.user.name}
        rolePill={ROLE_LABEL.management}
        bellLabel="Ticket cần chú ý"
        bellCount={attention.length}
        onBell={() => setTab("overview")}
      />
      <Body>
        <NavTiles<Tab>
          label="Chức năng ban quản lý"
          active={tab}
          onPick={setTab}
          items={[
            { key: "overview", label: "Tổng quan", icon: <IconGrid /> },
            { key: "all", label: "Tất cả ticket", icon: <IconTable />, count: all.length },
            { key: "mine", label: "Việc của BQL", icon: <IconBriefcase />, count: mine.filter(open).length },
            { key: "teams", label: "Hiệu suất phòng ban", icon: <IconBars /> },
          ]}
        />
        <PageHead {...HEAD[tab]} />

        {tab === "overview" && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-4">
              {[
                ["Tổng ticket", all.length],
                ["Chờ phân loại", pendingCount],
                ["Đang xử lý", live.filter((t) => t.stage === 3 || t.stage === 4).length],
                ["Khẩn cấp chưa xong", all.filter((t) => t.urgent && open(t)).length],
                ["Quá hạn", all.filter((t) => t.late).length],
              ].map(([label, value]) => (
                <div key={label} className="card flex flex-col gap-1 px-6 py-5" style={{ flex: "1 1 170px" }}>
                  <span className="text-sm text-muted">{label}</span>
                  <span className="text-[30px] font-bold tracking-[-0.02em]">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-start gap-4">
              <section className="card flex min-w-0 flex-col gap-4 p-6" style={{ flex: "1 1 420px" }}>
                <h2 className="m-0 text-lg font-bold">Ticket đang mở theo phòng ban</h2>
                {bars.map(([label, count, color]) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-[140px] text-sm">{label}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-line-soft">
                      <div className="h-3 rounded-full" style={{ background: color, width: `${Math.round((100 * count) / max)}%` }} />
                    </div>
                    <span className="w-7 text-right text-sm font-bold">{count}</span>
                  </div>
                ))}
              </section>
              <section className="card flex min-w-0 flex-col gap-1 p-6" style={{ flex: "1 1 420px" }}>
                <h2 className="mt-0 mb-2 text-lg font-bold">Cần chú ý: khẩn cấp, quá hạn hoặc đánh giá thấp</h2>
                {attention.length === 0 && <span className="text-sm text-muted">Không có ticket nào cần chú ý.</span>}
                {attention.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center gap-2 border-t border-line-soft py-3.5">
                    <span className="text-sm font-bold">{t.code}</span>
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
                <button key={key} type="button" className={filter === key ? "fchip on" : "fchip"} aria-pressed={filter === key} onClick={() => setFilter(key)}>
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
                      <tr key={t.id}>
                        <td className="font-bold whitespace-nowrap">{t.code}</td>
                        <td className="max-w-[340px] leading-[1.45]">
                          {t.text}
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
                      <td colSpan={6} className="text-center text-muted">
                        Không có ticket nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "mine" && (
          <section className="flex flex-col gap-4">
            {mine.length === 0 && <div className="card p-10 text-center text-muted">Chưa có ticket nào thuộc Ban quản lý.</div>}
            {mine.map((t) => {
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
                    <span className="text-base font-bold">{t.code}</span>
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
                          <button type="button" className="btn" disabled={pending} onClick={() => run(() => reassignTicketAction(t.id, "ve_sinh"))}>
                            Phòng vệ sinh
                          </button>
                          <button type="button" className="btn" disabled={pending} onClick={() => run(() => reassignTicketAction(t.id, "ky_thuat"))}>
                            Phòng kỹ thuật
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
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
      <Toast message={error} onClose={() => setError("")} />
    </div>
  );
}

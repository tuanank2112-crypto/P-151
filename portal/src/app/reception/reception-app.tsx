"use client";

import { useState } from "react";
import {
  askMoreInfoAction,
  dismissDuplicateAction,
  mergeTicketAction,
  routeTicketAction,
  setUrgentAction,
} from "@/app/actions/reception";
import { IconBars, IconCheckSquare, IconInbox } from "@/components/icons";
import { PhotoStrip } from "@/components/photo-strip";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { TicketDetailModal } from "@/components/ticket-detail-modal";
import { Toast } from "@/components/toast";
import { useAction } from "@/components/use-action";
import { DEPT_LABEL, DEPT_ORDER, ROLE_LABEL, type Dept } from "@/lib/constants";
import type { DuplicateCandidate, ReceptionData, ReceptionInboxItem } from "@/lib/dto";

type Tab = "inbox" | "done" | "agent";

const HEAD: Record<Tab, { title: string; sub: string }> = {
  inbox: {
    title: "Ticket chờ phân loại",
    sub: "Xác nhận gợi ý của Agent hoặc chọn phòng ban khác. Ticket khẩn cấp ở trên cùng; Agent đánh dấu ticket có thể trùng để bạn so sánh.",
  },
  done: { title: "Ticket đã phân loại", sub: "Lịch sử chuyển ticket và việc Agent gợi ý đúng hay đã được sửa." },
  agent: { title: "Hiệu suất Agent", sub: "Mức độ chính xác của Agent so với quyết định cuối cùng của nhân viên." },
};

const deptPill = (d: Dept | null) => `pill cat-${d ?? "none"}`;
const deptName = (d: Dept | null, none = "Chưa rõ") => (d ? DEPT_LABEL[d] : none);

type Routed = ReceptionData["routed"][number];

function result(t: Routed): [string, string] {
  if (!t.dept) return ["pill wait", "Chờ cư dân bổ sung"];
  return t.dept === t.aiDept ? ["pill ok", "Agent đúng"] : ["pill fix", "Đã sửa gợi ý"];
}

export function ReceptionApp({ data }: { data: ReceptionData }) {
  const { pending, error, setError, run } = useAction();
  const [tab, setTab] = useState<Tab>("inbox");
  const [selectedTicket, setSelectedTicket] = useState<ReceptionData["routed"][number] | null>(null);

  const inbox = [...data.inbox].sort((a, b) => Number(b.urgent) - Number(a.urgent));
  const routed = data.routed;
  const assigned = routed.filter((t) => t.dept);
  const correct = assigned.filter((t) => t.dept === t.aiDept);
  const overrides = assigned.filter((t) => t.dept !== t.aiDept);

  return (
    <div className="scr-reception min-h-screen bg-page">
      <Header
        avatar={data.user.avatar}
        name={data.user.name}
        rolePill={ROLE_LABEL.reception}
        bellLabel="Ticket chờ phân loại"
        bellCount={inbox.length}
        notices={inbox.map((t) => ({
          id: t.id,
          title: `${t.code}: ${t.text}`,
          urgent: t.urgent,
          tag: t.urgent ? "Khẩn cấp" : "Hàng đợi tiếp nhận",
          time: t.createdAt,
          body: `Gợi ý Agent: ${t.aiDept ? DEPT_LABEL[t.aiDept] : "Chưa rõ"} (${t.conf}%) · Vị trí: ${t.location}`,
        }))}
      />
      <Body>
        <NavTiles<Tab>
          label="Chức năng ban tiếp nhận"
          active={tab}
          onPick={setTab}
          items={[
            { key: "inbox", label: "Chờ phân loại", icon: <IconInbox />, count: inbox.length },
            { key: "done", label: "Đã phân loại", icon: <IconCheckSquare /> },
            { key: "agent", label: "Hiệu suất Agent", icon: <IconBars /> },
          ]}
        />
        <PageHead {...HEAD[tab]} />

        {tab === "inbox" && (
          <section className="flex flex-col gap-4">
            {inbox.length === 0 && <div className="card p-10 text-center text-muted">Không còn ticket nào chờ phân loại.</div>}
            {inbox.map((t) => (
              <InboxCard
                key={t.id}
                t={t}
                pending={pending}
                onRoute={(d) => run(() => routeTicketAction(t.id, d))}
                onUrgent={() => run(() => setUrgentAction(t.id, !t.urgent))}
                onAskMore={() => run(() => askMoreInfoAction(t.id))}
                onMerge={(target) => run(() => mergeTicketAction(t.id, target))}
                onNotDuplicate={(other) => run(() => dismissDuplicateAction(t.id, other))}
              />
            ))}
          </section>
        )}

        {tab === "done" && (
          <section className="card overflow-x-auto p-2">
            <table>
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Nội dung</th>
                  <th>Agent gợi ý</th>
                  <th>Đã chuyển đến</th>
                  <th>Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {routed.map((t) => {
                  const [resCls, resLabel] = result(t);
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
                      <td className="max-w-[360px] leading-[1.45]">
                        <span
                          className="cursor-pointer hover:text-slate-900"
                          onClick={() => setSelectedTicket(t)}
                        >
                          {t.text}
                        </span>
                      </td>
                      <td>
                        <span className={deptPill(t.aiDept)}>
                          <span className="dot" />
                          {deptName(t.aiDept)}
                        </span>
                      </td>
                      <td>
                        <span className={deptPill(t.dept)}>
                          <span className="dot" />
                          {deptName(t.dept, "Chưa chuyển")}
                        </span>
                      </td>
                      <td>
                        <span className={resCls}>{resLabel}</span>
                      </td>
                    </tr>
                  );
                })}
                {routed.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted">
                      Chưa có ticket nào được phân loại.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {tab === "agent" && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-4">
              {[
                { label: "Ticket đã chuyển", value: String(assigned.length) },
                { label: "Agent gợi ý đúng", value: assigned.length ? `${Math.round((100 * correct.length) / assigned.length)}%` : "—" },
                { label: "Số lần nhân viên sửa", value: String(overrides.length) },
                { label: "Chờ cư dân bổ sung", value: String(routed.length - assigned.length) },
              ].map((k) => (
                <div key={k.label} className="card flex flex-col gap-1 px-6 py-5" style={{ flex: "1 1 200px" }}>
                  <span className="text-sm text-muted">{k.label}</span>
                  <span className="text-[30px] font-bold">{k.value}</span>
                </div>
              ))}
            </div>
            <section className="card flex flex-col gap-2 p-6">
              <h2 className="m-0 text-lg font-bold">Các lần nhân viên sửa gợi ý của Agent</h2>
              <span className="text-[13px] text-muted">Ticket mà nhân viên chuyển khác với phòng ban Agent gợi ý.</span>
              {overrides.length === 0 && <span className="text-sm text-muted">Chưa có lần sửa nào.</span>}
              {overrides.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center gap-2 border-t border-line-soft py-3.5">
                  <span className="text-sm font-bold">{t.code}</span>
                  <span className={deptPill(t.aiDept)}>{deptName(t.aiDept)}</span>
                  <span aria-hidden="true">→</span>
                  <span className={deptPill(t.dept)}>{deptName(t.dept)}</span>
                  <span className="basis-full text-sm text-body">{t.text}</span>
                </div>
              ))}
            </section>
          </div>
        )}

      </Body>
      <TicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      <Toast message={error} onClose={() => setError("")} />
    </div>
  );
}

function InboxCard(props: {
  t: ReceptionInboxItem;
  pending: boolean;
  onRoute: (d: Dept) => void;
  onUrgent: () => void;
  onAskMore: () => void;
  onMerge: (targetId: number) => void;
  onNotDuplicate: (otherId: number) => void;
}) {
  const { t } = props;
  return (
    <article className="card flex flex-col gap-3.5 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-bold">{t.code}</span>
        <span className="text-[13px] text-muted">
          {t.createdAt} · {t.resident}
        </span>
        {t.urgent && <span className="pill urgent">Khẩn cấp</span>}
      </div>
      <p className="m-0 text-base leading-[1.55]">{t.text}</p>
      {t.extras.length > 0 && (
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-body">
          {t.extras.map((x, i) => (
            <li key={i}>Cư dân bổ sung: {x}</li>
          ))}
        </ul>
      )}
      <span className="text-[13px] text-muted">Vị trí: {t.location}</span>
      {t.photos.length > 0 && <PhotoStrip photos={t.photos} />}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-soft p-4">
        <span className="text-[13px] font-bold text-brand-dark">Agent gợi ý</span>
        <span className={deptPill(t.aiDept)}>
          <span className="dot" />
          {deptName(t.aiDept, "Chưa rõ")}
        </span>
        <div className="flex items-center gap-2" style={{ flex: "1 1 160px" }}>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "#D6E4FF" }}>
            <div className="h-1.5 bg-brand-mid" style={{ width: `${t.conf}%` }} />
          </div>
          <span className="text-[13px] font-bold">{t.conf}%</span>
        </div>
        <span className="basis-full text-[13px] text-muted">
          Từ khóa nhận diện: {t.keywords.length ? t.keywords.join(", ") : "không khớp từ khóa nào, cần nhân viên xem xét"}
        </span>
      </div>
      {t.duplicates.map((d) => (
        <DuplicatePanel
          key={d.id}
          t={t}
          d={d}
          pending={props.pending}
          onMerge={() => props.onMerge(d.id)}
          onNotDuplicate={() => props.onNotDuplicate(d.id)}
        />
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-muted">Chuyển đến:</span>
        {DEPT_ORDER.map((d) => (
          <button key={d} type="button" className={d === t.aiDept ? "btn sug" : "btn"} disabled={props.pending} onClick={() => props.onRoute(d)}>
            {DEPT_LABEL[d] + (d === t.aiDept ? " (gợi ý)" : "")}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
        <button type="button" className="btn warn" disabled={props.pending} onClick={props.onUrgent}>
          {t.urgent ? "Bỏ đánh dấu khẩn cấp" : "Đánh dấu khẩn cấp"}
        </button>
        <button type="button" className="btn ghost" disabled={props.pending} onClick={props.onAskMore}>
          Yêu cầu cư dân bổ sung thông tin
        </button>
      </div>
    </article>
  );
}

/** Agent duplicate proposal: both tickets side by side, reception approves (merge) or rejects (plan 06 Q13) */
function DuplicatePanel(props: {
  t: ReceptionInboxItem;
  d: DuplicateCandidate;
  pending: boolean;
  onMerge: () => void;
  onNotDuplicate: () => void;
}) {
  const { t, d } = props;
  const side = (label: string, code: string, text: string, location: string, meta: string, status?: string) => (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl bg-white p-3.5" style={{ flex: "1 1 240px" }}>
      <span className="text-[11px] font-bold tracking-[.06em] text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">{code}</span>
        {status && <span className="pill wait">{status}</span>}
      </div>
      <p className="m-0 text-sm leading-normal">{text}</p>
      <span className="text-xs text-muted">{location}</span>
      <span className="text-xs text-muted">{meta}</span>
    </div>
  );
  return (
    <section
      aria-label={`Agent nghi ${t.code} trùng với ${d.code}`}
      className="flex flex-col gap-3 rounded-2xl p-4"
      style={{ background: "#FFF7E0", border: "1px solid #F3D27A" }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-bold" style={{ color: "#5C4200" }}>
          Agent phát hiện có thể trùng
        </span>
        <div className="flex items-center gap-2" style={{ flex: "1 1 160px" }}>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "#F3E2A8" }}>
            <div className="h-1.5" style={{ width: `${d.score}%`, background: "#B07D00" }} />
          </div>
          <span className="text-[13px] font-bold">{d.score}%</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {d.reasons.map((r) => (
          <span key={r} className="pill" style={{ background: "#FFEFC2", color: "#664900" }}>
            {r}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2.5">
        {side("PHẢN ÁNH MỚI", t.code, t.text, t.location, `${t.createdAt} · ${t.resident}`)}
        {side("TICKET ĐÃ CÓ", d.code, d.text, d.location, `${d.createdAt} · ${d.resident}`, d.status)}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn sug" disabled={props.pending} onClick={props.onMerge}>
          Đúng, gộp {t.code} vào {d.code}
        </button>
        <button type="button" className="btn" disabled={props.pending} onClick={props.onNotDuplicate}>
          Không trùng
        </button>
      </div>
    </section>
  );
}

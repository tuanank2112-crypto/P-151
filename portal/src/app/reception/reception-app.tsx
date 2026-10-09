"use client";

import { useState } from "react";
import { ticketDetailAction } from "@/app/actions/detail";
import {
  confirmReviewAction,
  duplicateAction,
  resolveAssetAction,
  routeTicketAction,
  safetyAction,
} from "@/app/actions/reception";
import { IconBars, IconCheckSquare, IconInbox } from "@/components/icons";
import { PhotoStrip } from "@/components/photo-strip";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { TicketDetailModal } from "@/components/ticket-detail-modal";
import { Toast } from "@/components/toast";
import { useAction } from "@/components/use-action";
import { DEPT_LABEL, ROLE_LABEL, STAGES, type Dept } from "@/lib/constants";
import type { AgentInfo, AgentPerf, ReceptionAllItem, ReceptionData, ReceptionInboxItem, TicketDetail } from "@/lib/dto";

type Tab = "inbox" | "done" | "perf";

const HEAD: Record<Tab, { title: string; sub: string }> = {
  inbox: {
    title: "Chờ phân loại",
    sub: "Ticket đang dừng ở Tiếp nhận: chọn việc cần làm theo lý do dừng. Ticket khẩn cấp ở trên cùng.",
  },
  done: { title: "Đã phân loại", sub: "Ticket đã rời Tiếp nhận (đã giao phòng, ở Ban quản lý, đã đóng, hủy hoặc gộp). Bấm một dòng để xem chi tiết." },
  perf: { title: "Hiệu suất Agent", sub: "Agent gợi ý phòng ban so với phòng mà ticket thực sự được giao." },
};

const deptPill = (d: Dept | null) => `pill cat-${d ?? "none"}`;
const deptName = (d: Dept | null, none = "Chưa chuyển") => (d ? DEPT_LABEL[d] : none);
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]";

export function ReceptionApp({ data }: { data: ReceptionData }) {
  const { pending, error, setError, run } = useAction();
  const [tab, setTab] = useState<Tab>("inbox");
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);

  const inbox = [...data.inbox].sort((a, b) => Number(b.urgent) - Number(a.urgent));
  const inboxIds = new Set(inbox.map((t) => t.id));
  const done = data.all.filter((t) => !inboxIds.has(t.id));
  const open = (id: string) => run(() => ticketDetailAction(id), setSelectedTicket);

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
          title: `${t.code}: ${t.title}`,
          urgent: t.urgent,
          tag: t.urgent ? "Khẩn cấp" : "Hàng đợi tiếp nhận",
          time: t.createdAt,
          body: `${t.blockerLabel} · Vị trí: ${t.location}`,
        }))}
      />
      <Body>
        <NavTiles<Tab>
          label="Chức năng ban tiếp nhận"
          active={tab}
          onPick={setTab}
          items={[
            { key: "inbox", label: "Chờ phân loại", icon: <IconInbox />, count: inbox.length },
            { key: "done", label: "Đã phân loại", icon: <IconCheckSquare />, count: done.length },
            { key: "perf", label: "Hiệu suất Agent", icon: <IconBars /> },
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
                onOpen={() => open(t.id)}
                onRoute={(d) => run(() => routeTicketAction(t.id, d))}
                onAsset={() => run(() => resolveAssetAction(t.id, true))}
                onConfirm={() => run(() => confirmReviewAction(t.id))}
                onDuplicate={(merge) => run(() => duplicateAction(t.id, merge))}
                onSafety={(decision, note) => run(() => safetyAction(t.id, decision, note))}
                onError={setError}
              />
            ))}
          </section>
        )}

        {tab === "done" && <DoneTable rows={done} onOpen={open} />}

        {tab === "perf" && <PerfPanel perf={data.perf} onOpen={open} />}
      </Body>
      <TicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      <Toast message={error} onClose={() => setError("")} />
    </div>
  );
}

function DoneTable({ rows, onOpen }: { rows: ReceptionAllItem[]; onOpen: (id: string) => void }) {
  return (
    <section className="card overflow-x-auto p-2">
      <table>
        <thead>
          <tr>
            <th>Mã</th>
            <th>Tiêu đề</th>
            <th>Vị trí</th>
            <th>Trạng thái</th>
            <th>Phòng ban</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="cursor-pointer transition-colors hover:bg-slate-50/70" onClick={() => onOpen(t.id)}>
              <td className="font-bold whitespace-nowrap">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(t.id);
                  }}
                  className={`cursor-pointer text-left font-mono font-bold text-sky-700 hover:text-sky-900 hover:underline ${FOCUS}`}
                  title="Bấm để xem chi tiết đầy đủ"
                >
                  {t.code}
                </button>
                {t.urgent && <span className="pill urgent ml-2">Khẩn cấp</span>}
              </td>
              <td className="max-w-[360px] leading-[1.45]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(t.id);
                  }}
                  className={`cursor-pointer text-left font-semibold ${FOCUS}`}
                >
                  {t.title}
                </button>
                {t.content && <div className="line-clamp-2 text-[13px] text-muted">{t.content}</div>}
              </td>
              <td className="max-w-[220px] text-[13px] text-muted">{t.location}</td>
              <td>
                <span className="pill wait">{t.cancelled ? "Đã hủy" : `${t.statusLabel} · ${STAGES[t.stage - 1]}`}</span>
              </td>
              <td>
                <span className={deptPill(t.dept)}>
                  <span className="dot" />
                  {deptName(t.dept)}
                </span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-muted">
                Chưa có ticket nào đã phân loại.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function PerfPanel({ perf, onOpen }: { perf: AgentPerf; onOpen: (id: string) => void }) {
  const tiles: [string, string][] = [
    ["Ticket đã chuyển", String(perf.transferred)],
    ["Agent gợi ý đúng", perf.correctPct === null ? "—" : `${perf.correctPct}%`],
    ["Số lần nhân viên sửa", String(perf.corrections.length)],
    ["Chờ cư dân bổ sung", String(perf.waitingResident)],
  ];
  return (
    <section className="flex flex-col gap-5">
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        {tiles.map(([label, value]) => (
          <div key={label} className="card flex flex-col gap-1 p-5">
            <span className="text-sm text-muted">{label}</span>
            <span className="text-[30px] font-bold">{value}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="card flex flex-1 flex-col gap-1 p-5" style={{ minWidth: 220 }}>
          <span className="text-sm text-muted">Agent đúng</span>
          <span className="text-[24px] font-bold" style={{ color: "#13553A" }}>
            {perf.correct} lần
          </span>
        </div>
        <div className="card flex flex-1 flex-col gap-1 p-5" style={{ minWidth: 220 }}>
          <span className="text-sm text-muted">Agent sai</span>
          <span className="text-[24px] font-bold" style={{ color: "#B42318" }}>
            {perf.wrong} lần
          </span>
        </div>
      </div>
      <div className="card flex flex-col gap-3 p-6">
        <h2 className="m-0 text-lg font-bold">Các lần nhân viên sửa gợi ý của Agent</h2>
        {perf.corrections.length === 0 && <span className="text-sm text-muted">Chưa có lần sửa nào.</span>}
        {perf.corrections.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {perf.corrections.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 border-b border-line pb-2 text-sm">
                <button
                  type="button"
                  onClick={() => onOpen(c.id)}
                  className={`cursor-pointer font-mono font-bold text-sky-700 hover:underline ${FOCUS}`}
                >
                  {c.code}
                </button>
                <span>
                  Agent đề xuất <b>{DEPT_LABEL[c.agentDept]}</b>
                </span>
                <span aria-hidden="true">→</span>
                <span>
                  Phòng cuối <b>{DEPT_LABEL[c.finalDept]}</b>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AgentBlock({ agent }: { agent: AgentInfo | null }) {
  if (!agent) {
    return <div className="rounded-2xl bg-soft p-4 text-[13px] text-muted">Chưa có quyết định của Agent.</div>;
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-soft p-4" aria-label="Quyết định của Agent">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold tracking-[.06em] text-muted">AGENT</span>
        <span className="pill wait">{agent.sourceLabel}</span>
        {agent.proposedDept && !agent.failed && (
          <span className={deptPill(agent.proposedDept)}>
            <span className="dot" />
            Đề xuất: {DEPT_LABEL[agent.proposedDept]}
          </span>
        )}
      </div>
      <span className="text-sm leading-normal text-body">{agent.reason}</span>
    </div>
  );
}

function InboxCard(props: {
  t: ReceptionInboxItem;
  pending: boolean;
  onOpen: () => void;
  onRoute: (d: "ve_sinh" | "ky_thuat" | "bql") => void;
  onAsset: () => void;
  onConfirm: () => void;
  onDuplicate: (merge: boolean) => void;
  onSafety: (decision: "CONFIRM_SAFE" | "REQUEST_INFO" | "ESCALATE", note?: string) => void;
  onError: (msg: string) => void;
}) {
  const { t, pending } = props;
  const code = t.blockerCode;
  const [bqlNote, setBqlNote] = useState("");
  const canRoute = ["CATEGORY_UNCLEAR", "WRONG_DEPT", "OUT_OF_SCOPE", "PENDING_REVIEW"].includes(code);
  const sugDept = t.agent && !t.agent.failed ? t.agent.proposedDept : t.proposedDept;
  return (
    <article className="card flex flex-col gap-3.5 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`cursor-pointer text-base font-bold text-sky-700 hover:underline ${FOCUS}`} onClick={props.onOpen}>
          {t.code}
        </button>
        <span className="text-[13px] text-muted">{t.createdAt}</span>
        {t.urgent && <span className="pill urgent">Khẩn cấp</span>}
        <span className="pill wait">{t.blockerLabel}</span>
        <span className="pill wait">Mức an toàn: {t.riskLevel}</span>
      </div>
      <h3 className="m-0 text-[17px] leading-[1.4] font-bold">{t.title}</h3>
      {t.content && <p className="m-0 text-base leading-[1.55] whitespace-pre-line">{t.content}</p>}
      {t.extras.length > 0 && (
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-body">
          {t.extras.map((x, i) => (
            <li key={i}>Cư dân bổ sung: {x}</li>
          ))}
        </ul>
      )}
      <span className="text-[13px] text-muted">Vị trí: {t.location}</span>
      {t.photos.length > 0 && <PhotoStrip photos={t.photos} />}
      {t.note && <span className="rounded-2xl bg-soft p-4 text-[13px] text-body">{t.note}</span>}

      <AgentBlock agent={t.agent} />

      {code === "DUPLICATE" && (
        <div className="flex flex-col gap-3 rounded-2xl p-4" style={{ background: "#FFF7E0", border: "1px solid #F3D27A" }}>
          <span className="text-[13px] font-bold" style={{ color: "#5C4200" }}>
            Nghi trùng với {t.duplicateOf ?? "ticket khác"}
          </span>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <div className="flex flex-col gap-1 rounded-xl bg-white p-3">
              <span className="text-xs font-bold text-muted">Ticket này · {t.code}</span>
              <span className="text-sm font-semibold">{t.title}</span>
              {t.content && <span className="text-sm whitespace-pre-line">{t.content}</span>}
              <span className="text-xs text-muted">Vị trí: {t.location}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl bg-white p-3">
              <span className="text-xs font-bold text-muted">
                Ticket nghi trùng · {t.duplicateOf ?? "—"}
                {t.duplicate ? ` · ${t.duplicate.statusLabel}` : ""}
              </span>
              {t.duplicate ? (
                <span className="text-sm whitespace-pre-line">{t.duplicate.text}</span>
              ) : (
                <span className="text-sm text-muted">Không đọc được ticket nghi trùng.</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn sug" disabled={pending} onClick={() => props.onDuplicate(true)}>
              Gộp
            </button>
            <button type="button" className="btn" disabled={pending} onClick={() => props.onDuplicate(false)}>
              Không trùng
            </button>
          </div>
        </div>
      )}

      {code === "SAFETY_REVIEW_REQUIRED" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-muted">Xác minh an toàn:</span>
            <button type="button" className="btn sug" disabled={pending} onClick={() => props.onSafety("CONFIRM_SAFE")}>
              Xác nhận an toàn
            </button>
            <button type="button" className="btn" disabled={pending} onClick={() => props.onSafety("REQUEST_INFO")}>
              Hỏi thêm cư dân
            </button>
            <button
              type="button"
              className="btn warn"
              disabled={pending}
              onClick={() => {
                const note = bqlNote.trim();
                if (!note) {
                  props.onError("Vui lòng nhập ghi chú trước khi chuyển Ban quản lý.");
                  return;
                }
                props.onSafety("ESCALATE", note);
              }}
            >
              Chuyển BQL
            </button>
          </div>
          <label htmlFor={`bql-note-${t.id}`} className="text-xs font-semibold text-muted">
            Ghi chú khi chuyển BQL (bắt buộc)
          </label>
          <input
            id={`bql-note-${t.id}`}
            type="text"
            value={bqlNote}
            onChange={(e) => setBqlNote(e.target.value)}
            placeholder="Lý do chuyển Ban quản lý"
            className="min-h-11 w-full rounded-xl border border-line bg-field px-4 text-sm focus-visible:outline-2 focus-visible:outline-[#2563EB]"
          />
        </div>
      )}

      {code === "ASSET_UNCLEAR" && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn sug" disabled={pending} onClick={props.onAsset}>
            Kiểm tra tại chỗ
          </button>
        </div>
      )}

      {canRoute && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-muted">Chuyển đến:</span>
          <button type="button" className={sugDept === "ve_sinh" ? "btn sug" : "btn"} disabled={pending} onClick={() => props.onRoute("ve_sinh")}>
            Phòng vệ sinh
          </button>
          <button type="button" className={sugDept === "ky_thuat" ? "btn sug" : "btn"} disabled={pending} onClick={() => props.onRoute("ky_thuat")}>
            Phòng kỹ thuật
          </button>
          {code === "OUT_OF_SCOPE" && (
            <button type="button" className={sugDept === "bql" ? "btn sug" : "btn"} disabled={pending} onClick={() => props.onRoute("bql")}>
              Ban quản lý
            </button>
          )}
          {code === "PENDING_REVIEW" && (
            <button type="button" className="btn" disabled={pending} onClick={props.onConfirm}>
              Xác nhận phân loại của Agent
            </button>
          )}
        </div>
      )}

      {code === "MISSING_INFO" && <span className="text-[13px] text-muted">Đang chờ cư dân bổ sung</span>}
    </article>
  );
}

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
import { IconCheckSquare, IconInbox } from "@/components/icons";
import { PhotoStrip } from "@/components/photo-strip";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { TicketDetailModal } from "@/components/ticket-detail-modal";
import { Toast } from "@/components/toast";
import { useAction } from "@/components/use-action";
import { DEPT_LABEL, ROLE_LABEL, STAGES, type Dept } from "@/lib/constants";
import type { ReceptionData, ReceptionInboxItem, TicketDetail } from "@/lib/dto";

type Tab = "inbox" | "all";

const HEAD: Record<Tab, { title: string; sub: string }> = {
  inbox: {
    title: "Ticket chờ xử lý",
    sub: "Ticket đang dừng ở Tiếp nhận: chọn việc cần làm theo lý do dừng. Ticket khẩn cấp ở trên cùng.",
  },
  all: { title: "Tất cả ticket", sub: "Mọi ticket trong hệ thống. Bấm mã để xem chi tiết." },
};

const deptPill = (d: Dept | null) => `pill cat-${d ?? "none"}`;
const deptName = (d: Dept | null, none = "Chưa chuyển") => (d ? DEPT_LABEL[d] : none);

export function ReceptionApp({ data }: { data: ReceptionData }) {
  const { pending, error, setError, run } = useAction();
  const [tab, setTab] = useState<Tab>("inbox");
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);

  const inbox = [...data.inbox].sort((a, b) => Number(b.urgent) - Number(a.urgent));
  const open = (id: string) => run(() => ticketDetailAction(id), setSelectedTicket);

  return (
    <div className="scr-reception min-h-screen bg-page">
      <Header
        avatar={data.user.avatar}
        name={data.user.name}
        rolePill={ROLE_LABEL.reception}
        bellLabel="Ticket chờ xử lý"
        bellCount={inbox.length}
        notices={inbox.map((t) => ({
          id: t.id,
          title: `${t.code}: ${t.text}`,
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
            { key: "inbox", label: "Chờ xử lý", icon: <IconInbox />, count: inbox.length },
            { key: "all", label: "Tất cả ticket", icon: <IconCheckSquare />, count: data.all.length },
          ]}
        />
        <PageHead {...HEAD[tab]} />

        {tab === "inbox" && (
          <section className="flex flex-col gap-4">
            {inbox.length === 0 && <div className="card p-10 text-center text-muted">Không còn ticket nào chờ xử lý.</div>}
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
                onSafety={(decision) => run(() => safetyAction(t.id, decision))}
              />
            ))}
          </section>
        )}

        {tab === "all" && (
          <section className="card overflow-x-auto p-2">
            <table>
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Nội dung</th>
                  <th>Trạng thái</th>
                  <th>Phòng ban</th>
                </tr>
              </thead>
              <tbody>
                {data.all.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="font-bold whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => open(t.id)}
                        className="font-mono text-sky-700 hover:text-sky-900 hover:underline font-bold text-left"
                        title="Bấm để xem chi tiết đầy đủ"
                      >
                        {t.code}
                      </button>
                    </td>
                    <td className="max-w-[360px] leading-[1.45]">{t.text}</td>
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
                {data.all.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">
                      Chưa có ticket nào.
                    </td>
                  </tr>
                )}
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

function InboxCard(props: {
  t: ReceptionInboxItem;
  pending: boolean;
  onOpen: () => void;
  onRoute: (d: "ve_sinh" | "ky_thuat" | "bql") => void;
  onAsset: () => void;
  onConfirm: () => void;
  onDuplicate: (merge: boolean) => void;
  onSafety: (decision: "CONFIRM_SAFE" | "REQUEST_INFO" | "ESCALATE") => void;
}) {
  const { t, pending } = props;
  const code = t.blockerCode;
  const canRoute = ["CATEGORY_UNCLEAR", "WRONG_DEPT", "OUT_OF_SCOPE", "ASSET_UNCLEAR"].includes(code);
  return (
    <article className="card flex flex-col gap-3.5 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="text-base font-bold text-sky-700 hover:underline" onClick={props.onOpen}>
          {t.code}
        </button>
        <span className="text-[13px] text-muted">{t.createdAt}</span>
        {t.urgent && <span className="pill urgent">Khẩn cấp</span>}
        <span className="pill wait">{t.blockerLabel}</span>
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
      {t.note && <span className="rounded-2xl bg-soft p-4 text-[13px] text-body">{t.note}</span>}

      {code === "DUPLICATE" && (
        <div className="flex flex-col gap-2 rounded-2xl p-4" style={{ background: "#FFF7E0", border: "1px solid #F3D27A" }}>
          <span className="text-[13px] font-bold" style={{ color: "#5C4200" }}>
            Nghi trùng với {t.duplicateOf ?? "ticket khác"}
            {t.duplicate ? ` · ${t.duplicate.statusLabel}` : ""}
          </span>
          {t.duplicate && <span className="text-sm">{t.duplicate.text}</span>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn sug" disabled={pending} onClick={() => props.onDuplicate(true)}>
              Đúng, gộp vào {t.duplicateOf}
            </button>
            <button type="button" className="btn" disabled={pending} onClick={() => props.onDuplicate(false)}>
              Không trùng
            </button>
          </div>
        </div>
      )}

      {code === "SAFETY_REVIEW_REQUIRED" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-muted">Xác minh an toàn:</span>
          <button type="button" className="btn sug" disabled={pending} onClick={() => props.onSafety("CONFIRM_SAFE")}>
            Xác nhận an toàn
          </button>
          <button type="button" className="btn" disabled={pending} onClick={() => props.onSafety("REQUEST_INFO")}>
            Hỏi thêm cư dân
          </button>
          <button type="button" className="btn warn" disabled={pending} onClick={() => props.onSafety("ESCALATE")}>
            Báo khẩn cấp cho BQL
          </button>
        </div>
      )}

      {code === "PENDING_REVIEW" && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn sug" disabled={pending} onClick={props.onConfirm}>
            Xác nhận phân loại
          </button>
        </div>
      )}

      {code === "ASSET_UNCLEAR" && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn" disabled={pending} onClick={props.onAsset}>
            Xác định tài sản tại hiện trường
          </button>
        </div>
      )}

      {canRoute && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-muted">Chuyển đến:</span>
          <button type="button" className={t.proposedDept === "ve_sinh" ? "btn sug" : "btn"} disabled={pending} onClick={() => props.onRoute("ve_sinh")}>
            {DEPT_LABEL.ve_sinh}
          </button>
          <button type="button" className={t.proposedDept === "ky_thuat" ? "btn sug" : "btn"} disabled={pending} onClick={() => props.onRoute("ky_thuat")}>
            {DEPT_LABEL.ky_thuat}
          </button>
          {code === "OUT_OF_SCOPE" && (
            <button type="button" className="btn" disabled={pending} onClick={() => props.onRoute("bql")}>
              Việc của Ban quản lý
            </button>
          )}
        </div>
      )}

      {code === "MISSING_INFO" && <span className="text-[13px] text-muted">Đang chờ cư dân bổ sung thông tin.</span>}
    </article>
  );
}

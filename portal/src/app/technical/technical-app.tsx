"use client";

import { useState } from "react";
import { requestMaterialsAction } from "@/app/actions/departments";
import { CodeButton, FOCUS, HistoryList, WorkCard, useDeptScreen } from "@/app/cleaning/dept-parts";
import { Board } from "@/components/board";
import { IconBox, IconClock, IconKanban, IconWrench } from "@/components/icons";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { TicketDetailModal } from "@/components/ticket-detail-modal";
import { Toast } from "@/components/toast";
import { ROLE_LABEL } from "@/lib/constants";
import type { DeptData, DeptTicket, MaterialStatus } from "@/lib/dto";
import { RequestModal } from "./request-modal";

type Tab = "queue" | "mat" | "history";

const HEAD: Record<Tab, { title: string; sub: string }> = {
  queue: { title: "Hàng việc kỹ thuật", sub: "Ticket khẩn cấp lên đầu, kèm thời hạn xử lý. Phân công để bắt đầu xử lý." },
  mat: { title: "Yêu cầu vật tư", sub: "Vật tư đã yêu cầu theo từng ticket và trạng thái duyệt cấp." },
  history: { title: "Lịch sử hoàn thành", sub: "Ticket chờ nghiệm thu hoặc đã hoàn tất, kèm đánh giá của cư dân (ẩn danh)." },
};

const MAT_PILL: Record<MaterialStatus, { cls: string; label: string }> = {
  none: { cls: "cat-none", label: "Chưa yêu cầu" },
  pending: { cls: "bg-[#FFEFC2] text-[#664900]", label: "Chờ duyệt" },
  waiting_stock: { cls: "bg-[#FBE1CC] text-[#78320A]", label: "Chờ nhập hàng" },
  approved: { cls: "bg-[#D8EFE3] text-[#13553A]", label: "Đã cấp" },
};

export function TechnicalApp({ data }: { data: DeptData }) {
  const s = useDeptScreen();
  const [tab, setTab] = useState<Tab>("queue");
  const all = data.tickets;
  const withMaterials = all.filter((t) => t.materials.length > 0);
  const pendingReq = withMaterials.filter((t) => t.materialStatus === "pending" || t.materialStatus === "waiting_stock").length;

  return (
    <div className="scr-technical min-h-screen bg-page">
      <Header
        avatar={data.user.avatar}
        name={data.user.name}
        rolePill={ROLE_LABEL.technical}
        bellLabel="Thông báo kỹ thuật"
        bellCount={all.filter((t) => t.stage === 3).length + pendingReq}
        notices={[
          ...all
            .filter((t) => t.stage === 3 || (t.stage < 5 && t.urgent))
            .map((t) => ({
              id: `t-${t.id}`,
              title: `${t.code}: ${t.title || t.text}`,
              urgent: t.urgent,
              tag: t.stage === 3 ? "Chưa phân công" : t.statusLabel,
              time: t.createdAt,
              body: `Vị trí: ${t.location}`,
            })),
          ...withMaterials
            .filter((t) => t.materialStatus === "pending" || t.materialStatus === "waiting_stock")
            .map((t) => ({
              id: `m-${t.id}`,
              title: `Vật tư ${t.code}: ${MAT_PILL[t.materialStatus].label.toLowerCase()}`,
              tag: "Vật tư",
              body: t.materials.map((m) => m.itemName).join(", "),
            })),
        ]}
      />
      <Body>
        {/* no stock / warehouse tab on the technical site (R6) */}
        <NavTiles<Tab>
          label="Chức năng phòng kỹ thuật"
          active={tab}
          onPick={setTab}
          items={[
            { key: "queue", label: "Hàng việc", icon: <IconKanban />, count: all.filter((t) => t.stage < 5).length },
            { key: "mat", label: "Yêu cầu vật tư", icon: <IconWrench />, count: pendingReq },
            { key: "history", label: "Lịch sử", icon: <IconClock /> },
          ]}
        />
        <PageHead {...HEAD[tab]} />

        {tab === "queue" && (
          <Board
            tickets={all}
            card={(t) => (
              <WorkCard
                key={t.id}
                t={t}
                kind="technical"
                staff={data.staff}
                pending={s.pending}
                actions={s.actions}
                requestButton={(open) => (
                  <button type="button" className={`btn ${FOCUS}`} disabled={s.pending} onClick={open}>
                    Yêu cầu vật tư
                  </button>
                )}
                renderDialog={(dialog, close) =>
                  dialog === "request" && (
                    <RequestModal
                      t={t}
                      catalog={data.catalog}
                      customMaterials={data.customMaterials}
                      pending={s.pending}
                      onClose={close}
                      onSubmit={(lines, note, done, fail) => s.send(() => requestMaterialsAction(t.id, lines, note), done, fail)}
                    />
                  )
                }
              />
            )}
          />
        )}

        {tab === "mat" && <MaterialList tickets={withMaterials} onOpen={s.actions.open} />}
        {tab === "history" && <HistoryList tickets={all} onOpen={s.actions.open} />}
      </Body>
      <TicketDetailModal ticket={s.selected} onClose={() => s.setSelected(null)} />
      <Toast message={s.error} onClose={() => s.setError("")} />
    </div>
  );
}

function MaterialList({ tickets, onOpen }: { tickets: DeptTicket[]; onOpen: (id: string) => void }) {
  if (tickets.length === 0) {
    return (
      <section className="max-w-[900px]">
        <div className="card p-10 text-center text-muted">Chưa có yêu cầu vật tư. Tạo yêu cầu từ một ticket đang xử lý.</div>
      </section>
    );
  }
  return (
    <section className="flex max-w-[900px] flex-col gap-3.5">
      {tickets.map((t) => {
        const pill = MAT_PILL[t.materialStatus];
        return (
          <article key={t.id} className="card flex flex-col gap-2 px-6 py-[18px]">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-line-soft text-brand-mid">
                <IconBox size={20} width={1.8} />
              </span>
              <CodeButton t={t} onOpen={onOpen} />
              <span className="min-w-0 flex-1 truncate text-sm text-body">{t.title || t.text}</span>
              <span className={`pill ${pill.cls}`}>{pill.label}</span>
            </div>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {t.materials.map((m) => (
                <li key={m.itemCode} className="flex flex-wrap justify-between gap-2 text-[13px]">
                  <span className="font-semibold">{m.itemName}</span>
                  <span className="text-muted">
                    {m.plannedQty} {m.unit}
                    {m.issuedQty !== null ? ` · đã cấp ${m.issuedQty}` : ""}
                    {m.shortage > 0 ? ` · thiếu ${m.shortage}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </section>
  );
}

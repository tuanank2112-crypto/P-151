"use client";

import { useState } from "react";
import { HistoryList, WorkCard, useDeptScreen } from "@/app/cleaning/dept-parts";
import { Board } from "@/components/board";
import { IconClock, IconKanban } from "@/components/icons";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { TicketDetailModal } from "@/components/ticket-detail-modal";
import { Toast } from "@/components/toast";
import { ackStockAlertAction } from "@/app/actions/departments";
import { ROLE_LABEL } from "@/lib/constants";
import type { DeptData } from "@/lib/dto";
import { ALERT_PREFIX, formatAlert, unreadCount } from "@/lib/stock-alerts";

type Tab = "queue" | "history";

const HEAD: Record<Tab, { title: string; sub: string }> = {
  queue: { title: "Danh sách công việc", sub: "Ticket khẩn cấp lên đầu, kèm thời hạn xử lý." },
  history: { title: "Lịch sử hoàn thành", sub: "Ticket chờ nghiệm thu hoặc đã hoàn tất, kèm đánh giá của cư dân (ẩn danh)." },
};

export function TechnicalApp({ data }: { data: DeptData }) {
  const s = useDeptScreen();
  const [tab, setTab] = useState<Tab>("queue");
  const all = data.tickets;

  return (
    <div className="scr-technical min-h-screen bg-page">
      <Header
        avatar={data.user.avatar}
        name={data.user.name}
        rolePill={ROLE_LABEL.technical}
        bellLabel="Thông báo kỹ thuật"
        bellCount={all.filter((t) => t.stage === 3).length + unreadCount(data.stockAlerts)}
        notices={[
          ...data.stockAlerts
            .filter((a) => !a.read)
            .map((a) => ({ id: `${ALERT_PREFIX}${a.id}`, tag: "Kho nhập lại vật tư", time: a.createdAt, ...formatAlert(a) })),
          ...all
            .filter((t) => t.stage === 3 || (t.stage < 5 && t.urgent))
            .map((t) => ({
              id: `t-${t.id}`,
              title: `${t.code}: ${t.title || t.text}`,
              urgent: t.urgent,
              tag: t.stage === 3 ? "Chưa nhận việc" : t.statusLabel,
              time: t.createdAt,
              body: `Vị trí: ${t.location}`,
            })),
        ]}
        onNotice={(nid) => {
          const key = String(nid);
          if (key.startsWith(ALERT_PREFIX)) void ackStockAlertAction(key.slice(ALERT_PREFIX.length));
          else s.actions.open(key.replace(/^t-/, ""));
        }}
      />
      <Body>
        <NavTiles<Tab>
          label="Chức năng phòng kỹ thuật"
          active={tab}
          onPick={setTab}
          items={[
            { key: "queue", label: "Danh sách công việc", icon: <IconKanban />, count: all.filter((t) => t.stage < 5).length },
            { key: "history", label: "Lịch sử hoàn thành", icon: <IconClock /> },
          ]}
        />
        <PageHead {...HEAD[tab]} />

        {tab === "queue" && (
          <Board
            tickets={all}
            card={(t) => <WorkCard key={t.id} t={t} kind="technical" catalog={data.catalog} pending={s.pending} actions={s.actions} />}
          />
        )}
        {tab === "history" && <HistoryList tickets={all} onOpen={s.actions.open} />}
      </Body>
      <TicketDetailModal ticket={s.selected} onClose={() => s.setSelected(null)} />
      <Toast message={s.error} onClose={() => s.setError("")} />
    </div>
  );
}

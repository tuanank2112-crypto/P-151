"use client";

import { useState } from "react";
import { Board } from "@/components/board";
import { IconClock, IconKanban } from "@/components/icons";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { TicketDetailModal } from "@/components/ticket-detail-modal";
import { Toast } from "@/components/toast";
import { ackStockAlertAction } from "@/app/actions/departments";
import { ROLE_LABEL } from "@/lib/constants";
import type { DeptData } from "@/lib/dto";
import { ALERT_PREFIX, alertNotice, unreadCount } from "@/lib/stock-alerts";
import { deptStatusLabel } from "@/lib/material-requests";
import { HistoryList, WorkCard, useDeptScreen } from "./dept-parts";

type Tab = "queue" | "history";

const HEAD: Record<Tab, { title: string; sub: string }> = {
  queue: { title: "Danh sách công việc", sub: "Ticket vệ sinh đã được Ban tiếp nhận chuyển đến, khẩn cấp lên đầu." },
  history: { title: "Lịch sử hoàn thành", sub: "Ticket chờ nghiệm thu hoặc đã hoàn tất, kèm đánh giá của cư dân (ẩn danh)." },
};

export function CleaningApp({ data }: { data: DeptData }) {
  const s = useDeptScreen();
  const [tab, setTab] = useState<Tab>("queue");
  const all = data.tickets;
  const open = all.filter((t) => t.stage < 5).length;
  const newCount = all.filter((t) => t.stage === 3).length;

  return (
    <div className="scr-cleaning min-h-screen bg-page">
      <Header
        avatar={data.user.avatar}
        name={data.user.name}
        rolePill={ROLE_LABEL.cleaning}
        bellLabel="Thông báo kho và ticket chờ nhận việc"
        bellCount={newCount + unreadCount(data.stockAlerts)}
        notices={[
          ...data.stockAlerts.filter((a) => !a.read).map(alertNotice),
          ...all
            .filter((t) => t.stage < 5)
            .map((t) => ({
              id: `t-${t.id}`,
              title: `${t.code}: ${t.title || t.text}`,
              urgent: t.urgent,
              tag: t.stage === 3 ? "Chờ nhận việc" : deptStatusLabel(t),
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
          label="Chức năng phòng vệ sinh"
          active={tab}
          onPick={setTab}
          items={[
            { key: "queue", label: "Danh sách công việc", icon: <IconKanban />, count: open },
            { key: "history", label: "Lịch sử hoàn thành", icon: <IconClock /> },
          ]}
        />
        <PageHead {...HEAD[tab]} />

        {tab === "queue" && (
          <Board
            tickets={all}
            card={(t) => <WorkCard key={t.id} t={t} kind="cleaning" catalog={data.catalog} pending={s.pending} actions={s.actions} />}
          />
        )}
        {tab === "history" && <HistoryList tickets={all} onOpen={s.actions.open} />}
      </Body>
      <TicketDetailModal ticket={s.selected} onClose={() => s.setSelected(null)} />
      <Toast message={s.error} onClose={() => s.setError("")} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { Board } from "@/components/board";
import { IconClock, IconKanban, IconLayers } from "@/components/icons";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { TicketDetailModal } from "@/components/ticket-detail-modal";
import { Toast } from "@/components/toast";
import { ROLE_LABEL } from "@/lib/constants";
import type { DeptData } from "@/lib/dto";
import { HistoryList, StaffLoad, WorkCard, useDeptScreen } from "./dept-parts";

type Tab = "queue" | "staff" | "history";

const HEAD: Record<Tab, { title: string; sub: string }> = {
  queue: { title: "Hàng việc", sub: "Ticket vệ sinh đã được Ban tiếp nhận chuyển đến. Phân công để bắt đầu xử lý." },
  staff: { title: "Phân công tổ", sub: "Tải theo nhân viên = số ticket đang mở." },
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
        bellLabel="Ticket cần phân công"
        bellCount={newCount}
        notices={all
          .filter((t) => t.stage < 5)
          .map((t) => ({
            id: t.id,
            title: `${t.code}: ${t.title || t.text}`,
            urgent: t.urgent,
            tag: t.stage === 3 ? "Chưa phân công" : t.statusLabel,
            time: t.createdAt,
            body: `Vị trí: ${t.location}`,
          }))}
      />
      <Body>
        <NavTiles<Tab>
          label="Chức năng phòng vệ sinh"
          active={tab}
          onPick={setTab}
          items={[
            { key: "queue", label: "Hàng việc", icon: <IconKanban />, count: open },
            { key: "staff", label: "Phân công tổ", icon: <IconLayers /> },
            { key: "history", label: "Lịch sử", icon: <IconClock /> },
          ]}
        />
        <PageHead {...HEAD[tab]} />

        {tab === "queue" && (
          <Board
            tickets={all}
            card={(t) => <WorkCard key={t.id} t={t} kind="cleaning" staff={data.staff} pending={s.pending} actions={s.actions} />}
          />
        )}
        {tab === "staff" && <StaffLoad data={data} onOpen={s.actions.open} />}
        {tab === "history" && <HistoryList tickets={all} onOpen={s.actions.open} />}
      </Body>
      <TicketDetailModal ticket={s.selected} onClose={() => s.setSelected(null)} />
      <Toast message={s.error} onClose={() => s.setError("")} />
    </div>
  );
}

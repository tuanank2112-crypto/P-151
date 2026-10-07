"use client";

import { useState } from "react";
import { assignStaffAction, finishTicketAction } from "@/app/actions/departments";
import { Board } from "@/components/board";
import { IconClock, IconKanban, IconUsers } from "@/components/icons";
import { PhotoStrip } from "@/components/photo-strip";
import { Feedback, RatingSummary } from "@/components/rating-summary";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { Toast } from "@/components/toast";
import { useAction } from "@/components/use-action";
import { ROLE_LABEL } from "@/lib/constants";
import type { DeptData, DeptTicket } from "@/lib/dto";

type Tab = "queue" | "staff" | "history";

const HEAD: Record<Tab, { title: string; sub: string }> = {
  queue: { title: "Hàng việc", sub: "Chỉ hiển thị ticket vệ sinh đã được Ban tiếp nhận chuyển đến. Giao tổ để bắt đầu xử lý." },
  staff: { title: "Phân công tổ vệ sinh", sub: "Tải công việc hiện tại của từng tổ." },
  history: { title: "Lịch sử hoàn thành", sub: "Ticket đã xong và đánh giá của cư dân." },
};

/** Satisfied = 4–5 stars (SPEC-P02 §3) */
function rate(t: DeptTicket): [string, string] {
  if (!t.rating) return ["pill none", t.stage === 5 ? "Chờ cư dân nghiệm thu" : "Chưa đánh giá"];
  return t.rating.stars >= 4 ? ["pill good", "Cư dân hài lòng"] : ["pill bad", "Cư dân chưa hài lòng"];
}

const kwText = (t: DeptTicket) => (t.keywords.length ? t.keywords.join(", ") : "không khớp từ khóa");

export function CleaningApp({ data }: { data: DeptData }) {
  const { pending, error, setError, run } = useAction();
  const [tab, setTab] = useState<Tab>("queue");
  const all = data.tickets;
  const open = all.filter((t) => t.stage < 5).length;
  const newCount = all.filter((t) => t.stage === 2).length;
  const doneList = all.filter((t) => t.stage >= 5);

  return (
    <div className="scr-cleaning min-h-screen bg-page">
      <Header
        avatar={data.user.avatar}
        name={data.user.name}
        rolePill={ROLE_LABEL.cleaning}
        bellLabel="Ticket cần nhận"
        bellCount={newCount}
        onBell={() => setTab("queue")}
      />
      <Body>
        <NavTiles<Tab>
          label="Chức năng phòng vệ sinh"
          active={tab}
          onPick={setTab}
          items={[
            { key: "queue", label: "Hàng việc", icon: <IconKanban />, count: open },
            { key: "staff", label: "Phân công tổ", icon: <IconUsers /> },
            { key: "history", label: "Lịch sử", icon: <IconClock /> },
          ]}
        />
        <PageHead {...HEAD[tab]} />

        {tab === "queue" && (
          <Board
            tickets={all}
            card={(t) => (
              <article key={t.id} className="card flex flex-col gap-2.5 p-[18px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold">{t.code}</span>
                  <span className="text-xs text-muted">{t.createdAt}</span>
                  {t.urgent && <span className="pill urgent">Khẩn cấp</span>}
                  {t.paused && t.stage < 5 && <span className="pill" style={{ background: "#FFEFC2", color: "#664900" }}>Tạm hoãn</span>}
                </div>
                <p className="m-0 text-[15px] leading-normal">{t.text}</p>
                <span className="text-[13px] text-muted">{t.location}</span>
                <span className="text-xs text-muted">
                  Agent nhận diện: {kwText(t)} · {t.conf}%
                </span>
                {t.photos.length > 0 && <PhotoStrip photos={t.photos} />}
                {t.staffName && <span className="pill staff self-start">Phụ trách: {t.staffName}</span>}
                {t.stage === 2 && (
                  <div className="flex flex-col gap-2 border-t border-line-soft pt-2.5">
                    <span className="text-[13px] font-semibold">Giao cho tổ:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {data.staff.map((s) => (
                        <button key={s.id} type="button" className="btn" disabled={pending} onClick={() => run(() => assignStaffAction(t.id, s.id))}>
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {(t.stage === 3 || t.stage === 4) && (
                  <button type="button" className="btn primary" disabled={pending} onClick={() => run(() => finishTicketAction(t.id))}>
                    Đánh dấu hoàn thành
                  </button>
                )}
                {t.stage >= 5 && <Feedback t={t} />}
              </article>
            )}
          />
        )}

        {tab === "staff" && (
          <div className="flex flex-wrap gap-4">
            {data.staff.map((s) => {
              const active = all.filter((t) => t.staffId === s.id && (t.stage === 3 || t.stage === 4)).length;
              const done = all.filter((t) => t.staffId === s.id && t.stage >= 5).length;
              const cap = s.capacity ?? 0;
              return (
                <section key={s.id} className="card flex flex-col gap-3 p-6" style={{ flex: "1 1 260px" }}>
                  <h2 className="m-0 text-lg font-bold">{s.name}</h2>
                  <span className="text-[13px] text-muted">Khu vực: {s.area}</span>
                  <div className="flex gap-7">
                    <div className="flex flex-col">
                      <span className="text-[30px] font-bold">{active}</span>
                      <span className="text-[13px] text-muted">đang xử lý</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[30px] font-bold">{done}</span>
                      <span className="text-[13px] text-muted">đã hoàn thành</span>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-line-soft">
                    <div className="h-2 rounded-full bg-brand-mid" style={{ width: `${cap ? Math.min(100, Math.round((100 * active) / cap)) : 0}%` }} />
                  </div>
                  <span className="text-xs text-muted">
                    Tải công việc {active}/{cap} ticket
                  </span>
                </section>
              );
            })}
          </div>
        )}

        {tab === "history" && (
          <section className="flex max-w-[900px] flex-col gap-3.5">
            {doneList.length === 0 && <div className="card p-10 text-center text-muted">Chưa có ticket hoàn thành.</div>}
            {doneList.map((t) => {
              const [cls, label] = rate(t);
              return (
                <article key={t.id} className="card flex flex-wrap items-center gap-2.5 px-6 py-[22px]">
                  <span className="text-[15px] font-bold">{t.code}</span>
                  {t.staffName && <span className="pill staff">{t.staffName}</span>}
                  <span className={`${cls} ml-auto`}>{label}</span>
                  <span className="basis-full text-[15px] leading-normal">{t.text}</span>
                  {t.rating && (
                    <div className="basis-full">
                      <RatingSummary rating={t.rating} />
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </Body>
      <Toast message={error} onClose={() => setError("")} />
    </div>
  );
}


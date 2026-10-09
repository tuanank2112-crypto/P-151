"use client";

import { useState } from "react";
import { assignStaffAction, finishTicketAction, receiveMaterialAction, requestMaterialAction } from "@/app/actions/departments";
import { Board } from "@/components/board";
import { IconBox, IconKanban, IconWrench } from "@/components/icons";
import { PhotoStrip } from "@/components/photo-strip";
import { Feedback } from "@/components/rating-summary";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { Toast } from "@/components/toast";
import { useAction } from "@/components/use-action";
import { ROLE_LABEL } from "@/lib/constants";
import type { DeptData, DeptTicket } from "@/lib/dto";

type Tab = "queue" | "staff" | "mat";

const HEAD: Record<Tab, { title: string; sub: string }> = {
  queue: {
    title: "Hàng việc kỹ thuật",
    sub: "Ticket khẩn cấp lên đầu, kèm thời hạn xử lý. Nút viền cam là kỹ thuật viên đúng chuyên môn.",
  },
  staff: { title: "Kỹ thuật viên", sub: "Chuyên môn và khối lượng việc của từng người." },
  mat: { title: "Yêu cầu vật tư", sub: "Vật tư cần cho các ticket đang xử lý." },
};

const kwText = (t: DeptTicket) => (t.keywords.length ? t.keywords.join(", ") : "không khớp từ khóa");

export function TechnicalApp({ data }: { data: DeptData }) {
  const { pending, error, setError, run } = useAction();
  const [tab, setTab] = useState<Tab>("queue");
  const all = data.tickets;
  const pendingReq = data.materials.filter((m) => !m.received).length;

  return (
    <div className="scr-technical min-h-screen bg-page">
      <Header
        avatar={data.user.avatar}
        name={data.user.name}
        rolePill={ROLE_LABEL.technical}
        bellLabel="Ticket cần nhận"
        bellCount={all.filter((t) => t.stage === 2).length}
        onBell={() => setTab("queue")}
      />
      <Body>
        <NavTiles<Tab>
          label="Chức năng phòng kỹ thuật"
          active={tab}
          onPick={setTab}
          items={[
            { key: "queue", label: "Hàng việc", icon: <IconKanban />, count: all.filter((t) => t.stage < 5).length },
            { key: "staff", label: "Kỹ thuật viên", icon: <IconWrench /> },
            { key: "mat", label: "Yêu cầu vật tư", icon: <IconBox />, count: pendingReq },
          ]}
        />
        <PageHead {...HEAD[tab]} />

        {tab === "queue" && (
          <Board
            tickets={all}
            card={(t) => (
              <TechCard
                key={t.id}
                t={t}
                staff={data.staff}
                pending={pending}
                onAssign={(sid) => run(() => assignStaffAction(t.id, sid))}
                onFinish={() => run(() => finishTicketAction(t.id))}
                onRequest={(item, done) => run(() => requestMaterialAction(t.id, item), done)}
              />
            )}
          />
        )}

        {tab === "staff" && (
          <div className="flex flex-wrap gap-4">
            {data.staff.map((s) => {
              const active = all.filter((t) => t.staffId === s.id && (t.stage === 3 || t.stage === 4)).length;
              const done = all.filter((t) => t.staffId === s.id && t.stage >= 5).length;
              return (
                <section key={s.id} className="card flex flex-col gap-3 p-6" style={{ flex: "1 1 240px" }}>
                  <h2 className="m-0 text-lg font-bold">{s.name}</h2>
                  <span className="pill staff self-start">{s.skill}</span>
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
                  <span className={`${active ? "pill sla-late" : "pill sla-ok"} self-start`}>{active ? "Đang bận" : "Sẵn sàng nhận việc"}</span>
                </section>
              );
            })}
          </div>
        )}

        {tab === "mat" && (
          <section className="flex max-w-[900px] flex-col gap-3.5">
            {data.materials.length === 0 && (
              <div className="card p-10 text-center text-muted">Chưa có yêu cầu vật tư. Tạo yêu cầu từ một ticket đang xử lý.</div>
            )}
            {data.materials.map((m) => (
              <article key={m.id} className="card flex flex-wrap items-center gap-3 px-6 py-[22px]">
                <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-line-soft text-brand-mid">
                  <IconBox size={24} width={1.8} />
                </span>
                <div className="flex flex-col gap-1" style={{ flex: "1 1 260px" }}>
                  <span className="text-[15px] font-semibold">{m.item}</span>
                  <span className="text-[13px] text-muted">
                    Cho {m.ticketCode} · {m.staffName ?? "Chưa giao"}
                  </span>
                </div>
                <span className={m.received ? "pill got" : "pill req"}>{m.received ? "Đã nhận" : "Chờ cấp"}</span>
                {!m.received && (
                  <button type="button" className="btn" disabled={pending} onClick={() => run(() => receiveMaterialAction(m.id))}>
                    Xác nhận đã nhận
                  </button>
                )}
              </article>
            ))}
          </section>
        )}
      </Body>
      <Toast message={error} onClose={() => setError("")} />
    </div>
  );
}

function TechCard(props: {
  t: DeptTicket;
  staff: DeptData["staff"];
  pending: boolean;
  onAssign: (staffId: number) => void;
  onFinish: () => void;
  onRequest: (item: string, done: () => void) => void;
}) {
  const { t } = props;
  const [asking, setAsking] = useState(false);
  const [item, setItem] = useState("");
  const left = t.hoursLeft;
  return (
    <article className="card flex flex-col gap-2.5 p-[18px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">{t.code}</span>
        {t.urgent && <span className="pill urgent">Khẩn cấp</span>}
        {t.stage < 5 && <span className={left < 0 ? "pill sla-late" : "pill sla-ok"}>{left < 0 ? `Quá hạn ${-left}h` : `Còn ${left}h`}</span>}
        {t.paused && t.stage < 5 && <span className="pill req">Tạm hoãn</span>}
      </div>
      <p className="m-0 text-[15px] leading-normal">{t.text}</p>
      <span className="text-[13px] text-muted">
        {t.location} · {t.createdAt}
      </span>
      <span className="text-xs text-muted">
        Agent nhận diện: {kwText(t)} · {t.conf}% · chuyên môn: {t.skill ?? "chưa rõ"}
      </span>
      {t.photos.length > 0 && <PhotoStrip photos={t.photos} />}
      {t.staffName && <span className="pill staff self-start">Kỹ thuật viên: {t.staffName}</span>}
      {t.stage === 2 && (
        <div className="flex flex-col gap-2 border-t border-line-soft pt-2.5">
          <span className="text-[13px] font-semibold">Giao kỹ thuật viên:</span>
          <div className="flex flex-wrap gap-1.5">
            {props.staff.map((s) => (
              <button
                key={s.id}
                type="button"
                className={s.skill === t.skill ? "btn sug" : "btn"}
                disabled={props.pending}
                onClick={() => props.onAssign(s.id)}
              >
                {s.name} · {s.skill}
              </button>
            ))}
          </div>
        </div>
      )}
      {(t.stage === 3 || t.stage === 4) && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn primary" disabled={props.pending} onClick={props.onFinish}>
            Đánh dấu hoàn thành
          </button>
          {!t.materialRequested && !asking && (
            <button type="button" className="btn" onClick={() => setAsking(true)}>
              Yêu cầu vật tư
            </button>
          )}
          {t.materialRequested && <span className="pill req">Đã yêu cầu vật tư</span>}
          {asking && !t.materialRequested && (
            <form
              className="flex basis-full flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!item.trim()) return;
                props.onRequest(item.trim(), () => {
                  setItem("");
                  setAsking(false);
                });
              }}
            >
              <label className="sr" htmlFor={`mat-${t.id}`}>
                Vật tư cần cho {t.code}
              </label>
              <input
                id={`mat-${t.id}`}
                className="field"
                placeholder="Tên vật tư, ví dụ: Aptomat 63A"
                maxLength={120}
                value={item}
                autoFocus
                onChange={(e) => setItem(e.target.value)}
              />
              <button type="submit" className="btn primary" disabled={props.pending || !item.trim()}>
                Gửi
              </button>
              <button type="button" className="btn" onClick={() => setAsking(false)}>
                Hủy
              </button>
            </form>
          )}
        </div>
      )}
      {t.stage >= 5 && <Feedback t={t} />}
    </article>
  );
}

"use client";

import { useState } from "react";
import { acceptAction, finishTicketAction, reportWrongDeptAction } from "@/app/actions/departments";
import { Board } from "@/components/board";
import { IconClock, IconKanban } from "@/components/icons";
import { PhotoStrip } from "@/components/photo-strip";
import { Feedback } from "@/components/rating-summary";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { Toast } from "@/components/toast";
import { useAction } from "@/components/use-action";
import { ROLE_LABEL } from "@/lib/constants";
import type { DeptData, DeptTicket } from "@/lib/dto";

type Tab = "queue" | "history";

const HEAD: Record<Tab, { title: string; sub: string }> = {
  queue: { title: "Hàng việc", sub: "Chỉ hiển thị ticket vệ sinh đã được Ban tiếp nhận chuyển đến. Nhận việc để bắt đầu xử lý." },
  history: { title: "Lịch sử hoàn thành", sub: "Ticket đã xong." },
};

function rate(t: DeptTicket): [string, string] {
  return t.stage === 5 ? ["pill none", "Chờ nghiệm thu"] : ["pill good", "Hoàn tất"];
}

export function CleaningApp({ data }: { data: DeptData }) {
  const { pending, error, setError, run } = useAction();
  const [tab, setTab] = useState<Tab>("queue");
  const all = data.tickets;
  const open = all.filter((t) => t.stage < 5).length;
  const newCount = all.filter((t) => t.stage === 3).length;
  const doneList = all.filter((t) => t.stage >= 5);

  return (
    <div className="scr-cleaning min-h-screen bg-page">
      <Header
        avatar={data.user.avatar}
        name={data.user.name}
        rolePill={ROLE_LABEL.cleaning}
        bellLabel="Ticket cần nhận"
        bellCount={newCount}
        notices={all
          .filter((t) => t.stage < 5)
          .map((t) => ({
            id: t.id,
            title: `${t.code}: ${t.text}`,
            urgent: t.urgent,
            tag: t.stage === 3 ? "Chưa nhận việc" : "Đang thực hiện",
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
            { key: "history", label: "Lịch sử", icon: <IconClock /> },
          ]}
        />
        <PageHead {...HEAD[tab]} />

        {tab === "queue" && (
          <Board
            tickets={all}
            card={(t) => (
              <CleaningCard
                key={t.id}
                t={t}
                pending={pending}
                onAccept={() => run(() => acceptAction(t.id))}
                onFinish={(fd) => run(() => finishTicketAction(t.id, fd))}
                onReportWrongDept={(reason, done) => run(() => reportWrongDeptAction(t.id, reason), done)}
              />
            )}
          />
        )}

        {tab === "history" && (
          <section className="flex max-w-[900px] flex-col gap-3.5">
            {doneList.length === 0 && <div className="card p-10 text-center text-muted">Chưa có ticket hoàn thành.</div>}
            {doneList.map((t) => {
              const [cls, label] = rate(t);
              return (
                <article key={t.id} className="card flex flex-wrap items-center gap-2.5 px-6 py-[22px]">
                  <span className="text-[15px] font-bold">{t.code}</span>
                  <span className={`${cls} ml-auto`}>{label}</span>
                  <span className="basis-full text-[15px] leading-normal">{t.text}</span>
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

function CleaningCard(props: {
  t: DeptTicket;
  pending: boolean;
  onAccept: () => void;
  onFinish: (fd: FormData) => void;
  onReportWrongDept: (reason: string, done: () => void) => void;
}) {
  const { t } = props;
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [wrongDeptModalOpen, setWrongDeptModalOpen] = useState(false);

  // Finish modal state
  const [checkCleaned, setCheckCleaned] = useState(false);
  const [checkAreaSafe, setCheckAreaSafe] = useState(false);
  const [finishNote, setFinishNote] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [finishError, setFinishError] = useState("");

  // Wrong dept state
  const [wrongReason, setWrongReason] = useState("");

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setPhotoFile(f);
      setPhotoPreview(URL.createObjectURL(f));
      setFinishError("");
    }
  };

  const handleFinishSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkCleaned || !checkAreaSafe) {
      setFinishError("Vui lòng tích xác nhận đã vệ sinh sạch sẽ và kiểm tra hiện trường.");
      return;
    }
    if (!photoFile) {
      setFinishError("Bắt buộc chụp hoặc tải ảnh hiện trường sau khi dọn dẹp vệ sinh.");
      return;
    }
    const fd = new FormData();
    fd.append("note", finishNote.trim() || "Tổ vệ sinh đã hoàn tất dọn dẹp hiện trường sạch sẽ.");
    fd.append("photos", photoFile);
    // both site checks ticked: report every pending checklist item of the playbook as done
    t.checklist.filter((c) => !c.done).forEach((c) => fd.append("checklist", c.templateItemId));
    props.onFinish(fd);
    setFinishModalOpen(false);
  };

  return (
    <article className="card flex flex-col gap-2.5 p-[18px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">{t.code}</span>
        <span className="text-xs text-muted">{t.createdAt}</span>
        {t.urgent && <span className="pill urgent">Khẩn cấp</span>}
        {t.paused && t.stage < 5 && <span className="pill" style={{ background: "#FFEFC2", color: "#664900" }}>Tạm hoãn</span>}
      </div>
      <p className="m-0 text-[15px] leading-normal">{t.text}</p>
      <span className="text-[13px] text-muted">{t.location}</span>
      {t.photos.length > 0 && <PhotoStrip photos={t.photos} />}

      {/* Stage 3: routed, not accepted yet */}
      {t.stage === 3 && (
        <div className="flex flex-col gap-2 border-t border-line-soft pt-2.5">
          <button type="button" className="btn primary self-start" disabled={props.pending} onClick={props.onAccept}>
            Nhận việc
          </button>
        </div>
      )}

      {/* Stage 4 Action Buttons */}
      {t.stage === 4 && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-line-soft">
          <button
            type="button"
            className="btn primary bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            disabled={props.pending}
            onClick={() => {
              setFinishError("");
              setFinishModalOpen(true);
            }}
          >
            Đánh dấu hoàn thành
          </button>

          <button
            type="button"
            className="btn text-xs text-amber-700 border-amber-300 hover:bg-amber-50 ml-auto"
            disabled={props.pending}
            onClick={() => setWrongDeptModalOpen(true)}
          >
            Báo cần BQL xem
          </button>
        </div>
      )}

      {t.stage >= 5 && <Feedback t={t} />}

      {/* ────────────────── Modal: Đánh dấu hoàn thành Vệ sinh ────────────────── */}
      {finishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-800 mb-1">Nghiệm thu dọn dẹp vệ sinh #{t.code}</h3>
            <p className="text-xs text-slate-500 mb-4">{t.text}</p>

            <form onSubmit={handleFinishSubmit} className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block mb-1">Tiêu chuẩn kiểm tra hoàn tất vệ sinh:</span>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={checkCleaned}
                    onChange={(e) => setCheckCleaned(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600"
                  />
                  <span>1. Đã dọn dẹp, tẩy rửa sạch sẽ khu vực theo phản ánh</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={checkAreaSafe}
                    onChange={(e) => setCheckAreaSafe(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600"
                  />
                  <span>2. Đã kiểm tra lại hiện trường không còn rác thải / mùi hôi tồn đọng</span>
                </label>
              </div>

              {/* Ảnh sau xử lý (Bắt buộc) */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Chụp / Tải ảnh hiện trường sau khi dọn sạch: <span className="text-rose-600">* (Bắt buộc)</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white"
                />
                {photoPreview && (
                  <div className="mt-2 w-28 h-28 rounded-xl overflow-hidden border border-emerald-300 ring-2 ring-emerald-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Ghi chú */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Ghi chú thực hiện:</label>
                <textarea
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                  rows={2}
                  placeholder="Ví dụ: Đã thu gom rác tầng 12, lau sàn và xịt khử khuẩn..."
                  value={finishNote}
                  onChange={(e) => setFinishNote(e.target.value)}
                />
              </div>

              {finishError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                  {finishError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  className="btn text-xs"
                  onClick={() => setFinishModalOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn primary bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  disabled={props.pending}
                >
                  Xác nhận chuyển BQL nghiệm thu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────── Modal: Báo cần BQL xem ────────────────── */}
      {wrongDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 border border-slate-200">
            <h3 className="text-base font-bold text-amber-900 mb-1">Báo cần BQL xem xét #{t.code}</h3>
            <p className="text-xs text-slate-500 mb-3">
              Nếu ticket không thuộc trách nhiệm vệ sinh, vui lòng nhập lý do:
            </p>

            <div className="space-y-3">
              <textarea
                className="w-full text-xs p-2.5 rounded-xl border border-amber-300 bg-white"
                rows={3}
                placeholder="Ví dụ: Sự cố rò rỉ đường ống nước, thuộc Phòng kỹ thuật sửa chữa..."
                value={wrongReason}
                autoFocus
                onChange={(e) => setWrongReason(e.target.value)}
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn text-xs"
                  onClick={() => setWrongDeptModalOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn primary bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                  disabled={props.pending || !wrongReason.trim()}
                  onClick={() => {
                    props.onReportWrongDept(wrongReason.trim(), () => {
                      setWrongDeptModalOpen(false);
                      setWrongReason("");
                    });
                  }}
                >
                  Gửi báo cáo BQL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

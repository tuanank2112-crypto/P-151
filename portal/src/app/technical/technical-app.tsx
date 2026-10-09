"use client";

import { useState } from "react";
import {
  acceptAction,
  finishTicketAction,
  reportWrongDeptAction,
  requestMaterialsAction,
  type MaterialLineInput,
} from "@/app/actions/departments";
import { Board } from "@/components/board";
import { IconBox, IconKanban, IconWrench } from "@/components/icons";
import { PhotoStrip } from "@/components/photo-strip";
import { Feedback } from "@/components/rating-summary";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { Toast } from "@/components/toast";
import { useAction } from "@/components/use-action";
import { ROLE_LABEL } from "@/lib/constants";
import type { DeptData, DeptTicket } from "@/lib/dto";

type Tab = "queue" | "mat";

const HEAD: Record<Tab, { title: string; sub: string }> = {
  queue: {
    title: "Hàng việc kỹ thuật",
    sub: "Ticket khẩn cấp lên đầu, kèm thời hạn xử lý. Nhận việc rồi mới xử lý.",
  },
  mat: { title: "Yêu cầu vật tư", sub: "Vật tư cần cho các ticket đang xử lý." },
};

/** Material lines of every ticket, flattened for the "Yêu cầu vật tư" tab (received = nothing short) */
function materialRows(tickets: DeptTicket[]) {
  return tickets.flatMap((t) => t.materials.map((m) => ({ ...m, ticketCode: t.code, received: m.shortage === 0 })));
}

export function TechnicalApp({ data }: { data: DeptData }) {
  const { pending, error, setError, run } = useAction();
  const [tab, setTab] = useState<Tab>("queue");
  const all = data.tickets;
  const materials = materialRows(all);
  const pendingReq = materials.filter((m) => !m.received).length;

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
            .filter((t) => t.stage === 3 || t.urgent)
            .map((t) => ({
              id: `t-${t.id}`,
              title: `${t.code}: ${t.text}`,
              urgent: t.urgent,
              tag: t.stage === 3 ? "Cần tiếp nhận" : "Đang xử lý",
              time: t.createdAt,
              body: `Vị trí: ${t.location}`,
            })),
          ...materials
            .filter((m) => !m.received)
            .map((m) => ({
              id: `m-${m.ticketCode}-${m.itemCode}`,
              title: `Yêu cầu cấp vật tư: ${m.itemName}`,
              tag: "Kho vật tư",
              body: `Cho ticket ${m.ticketCode}`,
            })),
        ]}
      />
      <Body>
        <NavTiles<Tab>
          label="Chức năng phòng kỹ thuật"
          active={tab}
          onPick={setTab}
          items={[
            { key: "queue", label: "Hàng việc", icon: <IconKanban />, count: all.filter((t) => t.stage < 5).length },
            { key: "mat", label: "Yêu cầu vật tư", icon: <IconWrench />, count: pendingReq },
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
                catalog={data.catalog}
                customMaterials={data.customMaterials}
                pending={pending}
                onAccept={() => run(() => acceptAction(t.id))}
                onFinish={(fd) => run(() => finishTicketAction(t.id, fd))}
                onRequest={(lines, note, done) => run(() => requestMaterialsAction(t.id, lines, note), done)}
                onReportWrongDept={(reason, done) => run(() => reportWrongDeptAction(t.id, reason), done)}
              />
            )}
          />
        )}

        {tab === "mat" && (
          <section className="flex max-w-[900px] flex-col gap-3.5">
            {materials.length === 0 && (
              <div className="card p-10 text-center text-muted">
                Chưa có yêu cầu vật tư. Tạo yêu cầu từ một ticket đang xử lý.
              </div>
            )}
            {materials.map((m) => (
              <article key={`${m.ticketCode}-${m.itemCode}`} className="card flex flex-wrap items-center gap-3 px-6 py-[22px]">
                <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-line-soft text-brand-mid">
                  <IconBox size={24} width={1.8} />
                </span>
                <div className="flex flex-col gap-1" style={{ flex: "1 1 260px" }}>
                  <span className="text-[15px] font-semibold">{m.itemName}</span>
                  <span className="text-[13px] text-muted">
                    Cho {m.ticketCode} · cần {m.plannedQty} {m.unit}
                  </span>
                </div>
                <span className={m.received ? "pill got" : "pill req"}>{m.received ? "Đã nhận" : "Chờ cấp"}</span>
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
  catalog: DeptData["catalog"];
  customMaterials: boolean;
  pending: boolean;
  onAccept: () => void;
  onFinish: (fd: FormData) => void;
  onRequest: (lines: MaterialLineInput[], note: string, done: () => void) => void;
  onReportWrongDept: (reason: string, done: () => void) => void;
}) {
  const { t } = props;
  const ticketMaterials = t.materials;
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [wrongDeptModalOpen, setWrongDeptModalOpen] = useState(false);

  // Material request modal state
  const [selectedMat, setSelectedMat] = useState(props.catalog[0]?.itemCode ?? "");
  const [customMat, setCustomMat] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [matNote, setMatNote] = useState("");

  // Finish modal state
  const [checkSafe, setCheckSafe] = useState(false);
  const [checkClean, setCheckClean] = useState(false);
  const [checkTest, setCheckTest] = useState(false);
  const [finishNote, setFinishNote] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [finishError, setFinishError] = useState("");

  // Wrong dept state
  const [wrongReason, setWrongReason] = useState("");

  const left = t.hoursLeft;

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
    if (!checkSafe || !checkClean || !checkTest) {
      setFinishError("Vui lòng tích xác nhận đủ cả 3 tiêu chuẩn nghiệm thu.");
      return;
    }
    if (!photoFile) {
      setFinishError("Bắt buộc chụp hoặc tải ảnh hiện trường sau khi xử lý.");
      return;
    }
    const fd = new FormData();
    fd.append("note", finishNote.trim() || "Kỹ thuật đã hoàn tất và kiểm tra hoạt động bình thường.");
    fd.append("photos", photoFile);
    // all checks ticked: report every pending checklist item of the playbook as done
    t.checklist.filter((c) => !c.done).forEach((c) => fd.append("checklist", c.templateItemId));
    props.onFinish(fd);
    setFinishModalOpen(false);
  };

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = customMat.trim();
    if (isCustom ? !name : !selectedMat) return;
    const line: MaterialLineInput = isCustom ? { newItemName: name, unit: "cái", qty: quantity } : { itemCode: selectedMat, qty: quantity };
    props.onRequest([line], matNote.trim(), () => {
      setRequestModalOpen(false);
      setCustomMat("");
      setIsCustom(false);
      setQuantity(1);
      setMatNote("");
    });
  };

  return (
    <article className="card flex flex-col gap-2.5 p-[18px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">{t.code}</span>
        {t.urgent && <span className="pill urgent">Khẩn cấp</span>}
        {t.stage < 5 && left !== null && <span className={left < 0 ? "pill sla-late" : "pill sla-ok"}>{left < 0 ? `Quá hạn ${-left}h` : `Còn ${left}h`}</span>}
        {t.paused && t.stage < 5 && <span className="pill req">Tạm hoãn</span>}
      </div>
      <p className="m-0 text-[15px] leading-normal">{t.text}</p>
      <span className="text-[13px] text-muted">
        {t.location} · {t.createdAt}
      </span>
      {t.photos.length > 0 && <PhotoStrip photos={t.photos} />}

      {/* Material Request Checklist on Card */}
      {ticketMaterials.length > 0 && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs space-y-1.5">
          <span className="font-semibold text-slate-700 block">Checklist vật tư yêu cầu:</span>
          {ticketMaterials.map((m) => (
            <div key={m.itemCode} className="flex items-center justify-between gap-1 text-[11px]">
              <span className="text-slate-700 truncate max-w-[200px]">{m.itemName}</span>
              <span className={m.shortage === 0 ? "text-emerald-700 font-bold" : "text-amber-700 font-medium"}>
                {m.shortage === 0 ? "✓ Đủ tồn" : "⏳ Chờ cấp"}
              </span>
            </div>
          ))}
        </div>
      )}

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
            className="btn border border-slate-300 hover:bg-slate-50"
            disabled={props.pending}
            onClick={() => setRequestModalOpen(true)}
          >
            Yêu cầu vật tư
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

      {/* ────────────────── Modal: Yêu cầu vật tư ────────────────── */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-1">Yêu cầu vật tư cho #{t.code}</h3>
            <p className="text-xs text-slate-500 mb-4">{t.text}</p>

            <form onSubmit={handleRequestSubmit} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">Chọn vật tư:</label>
                  {props.customMaterials && (
                    <button
                      type="button"
                      onClick={() => setIsCustom(!isCustom)}
                      className="text-xs text-sky-600 hover:underline font-medium"
                    >
                      {isCustom ? "← Chọn từ danh mục có sẵn" : "+ Nhập vật tư khác ngoài kho"}
                    </button>
                  )}
                </div>

                {isCustom ? (
                  <input
                    type="text"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                    placeholder="Nhập tên vật tư hoặc phụ kiện đặc thù..."
                    value={customMat}
                    autoFocus
                    onChange={(e) => setCustomMat(e.target.value)}
                  />
                ) : (
                  <select
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                    value={selectedMat}
                    onChange={(e) => setSelectedMat(e.target.value)}
                  >
                    {props.catalog.map((m) => (
                      <option key={m.itemCode} value={m.itemCode}>
                        {m.itemName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Số lượng:</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Ghi chú:</label>
                  <input
                    type="text"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                    placeholder="Ví dụ: Tầng 5, Aptomat 32A"
                    value={matNote}
                    onChange={(e) => setMatNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  className="btn text-xs"
                  onClick={() => setRequestModalOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn primary text-xs font-semibold"
                  disabled={props.pending || (isCustom && !customMat.trim())}
                >
                  Gửi yêu cầu tới thủ kho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────── Modal: Đánh dấu hoàn thành Kỹ thuật ────────────────── */}
      {finishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-800 mb-1">Nghiệm thu hoàn tất hiện trường #{t.code}</h3>
            <p className="text-xs text-slate-500 mb-4">{t.text}</p>

            <form onSubmit={handleFinishSubmit} className="space-y-4 text-xs">
              {/* 3 tiêu chuẩn checklist */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block mb-1">Tiêu chuẩn kiểm tra hoàn tất (Checklist 3 bước):</span>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={checkSafe}
                    onChange={(e) => setCheckSafe(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600"
                  />
                  <span>1. Đã kiểm tra an toàn kỹ thuật, hệ thống vận hành trơn tru</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={checkClean}
                    onChange={(e) => setCheckClean(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600"
                  />
                  <span>2. Đã dọn dẹp vệ sinh hiện trường thi công, không để rác thải bừa bãi</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={checkTest}
                    onChange={(e) => setCheckTest(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600"
                  />
                  <span>3. Đã chạy thử nghiệm đo kiểm tra hoạt động ổn định</span>
                </label>
              </div>

              {/* Ảnh sau xử lý (Bắt buộc) */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Chụp / Tải ảnh hiện trường sau khi xử lý: <span className="text-rose-600">* (Bắt buộc)</span>
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
                <label className="font-semibold text-slate-700 block mb-1">Ghi chú nghiệm thu:</label>
                <textarea
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                  rows={2}
                  placeholder="Ví dụ: Đã thay thế bóng đèn LED mới, kiểm tra ánh sáng đầy đủ..."
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
              Nếu ticket không thuộc thẩm quyền kỹ thuật (hoặc cần chuyển phòng ban khác), vui lòng nêu rõ lý do:
            </p>

            <div className="space-y-3">
              <textarea
                className="w-full text-xs p-2.5 rounded-xl border border-amber-300 bg-white"
                rows={3}
                placeholder="Ví dụ: Sự cố rác bốc mùi thuộc Phòng vệ sinh, không phải kỹ thuật điện nước..."
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
                  type="button"
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

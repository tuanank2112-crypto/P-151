"use client";

/**
 * Parts shared by the two department screens (cleaning, technical): ticket card, reason / finish
 * modals and history lists. No per-staff assignment: the department takes the ticket as a whole. SPEC-P03 §4. Real data from the DTO only, no invented text or numbers.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { acceptAction, finishTicketAction, reportWrongDeptAction, returnAction } from "@/app/actions/departments";
import { ticketDetailAction } from "@/app/actions/detail";
import { PhotoStrip } from "@/components/photo-strip";
import { Feedback } from "@/components/rating-summary";
import { useAction } from "@/components/use-action";
import { MAX_PHOTOS } from "@/lib/constants";
import type { CatalogItem, DeptTicket, TicketDetail } from "@/lib/dto";
import type { ActionResult, ErrorCode } from "@/lib/result";

/** Visible keyboard focus on every clickable element (globals.css has no ring for plain buttons) */
export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]";
const BTN = `btn ${FOCUS}`;
const PRIMARY = `btn primary ${FOCUS}`;
const FIELD = `w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm ${FOCUS}`;

export type CardActions = {
  open: (id: string) => void;
  accept: (id: string) => void;
  returnBack: (id: string, note: string, done: () => void, fail: (msg: string) => boolean) => void;
  wrongDept: (id: string, note: string, done: () => void, fail: (msg: string) => boolean) => void;
  finish: (id: string, fd: FormData, done: () => void, fail: (msg: string) => boolean) => void;
};

type Failure = { ok: false; code: ErrorCode; message: string };

/** Action state of a department screen: busy flag, toast error, card actions, ticket detail modal */
export function useDeptScreen() {
  const { pending, error, setError, run } = useAction();
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  // a failure goes to the dialog's own error box (return true) except an expired session
  const inline = (fail: (msg: string) => boolean) => (r: Failure) => r.code !== "UNAUTHENTICATED" && fail(r.message);
  const send = (fn: () => Promise<ActionResult<unknown>>, done: () => void, fail: (msg: string) => boolean) =>
    run(fn, () => done(), inline(fail));
  const actions: CardActions = {
    open: (id) => run(() => ticketDetailAction(id), setSelected),
    accept: (id) => run(() => acceptAction(id)),
    returnBack: (id, note, done, fail) => send(() => returnAction(id, note), done, fail),
    wrongDept: (id, note, done, fail) => send(() => reportWrongDeptAction(id, note), done, fail),
    finish: (id, fd, done, fail) => send(() => finishTicketAction(id, fd), done, fail),
  };
  return { pending, error, setError, run, send, actions, selected, setSelected };
}

// ---------- small bits ----------
export function CodeButton({ t, onOpen }: { t: Pick<DeptTicket, "id" | "code">; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      className={`cursor-pointer rounded border-0 bg-transparent p-0 text-sm font-bold text-brand underline-offset-2 hover:underline ${FOCUS}`}
      onClick={() => onOpen(t.id)}
      aria-label={`Xem chi tiết ${t.code}`}
    >
      {t.code}
    </button>
  );
}

export function Modal(props: { title: string; sub?: string; onClose: () => void; wide?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { onClose } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl outline-none ${props.wide ? "max-w-xl" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-base font-bold text-slate-800">{props.title}</h3>
        {props.sub && <p className="mb-3 text-xs text-slate-500">{props.sub}</p>}
        {props.children}
      </div>
    </div>
  );
}

const ErrorBox = ({ msg }: { msg: string }) =>
  msg ? (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
      {msg}
    </div>
  ) : null;

export function Stars({ n }: { n: number }) {
  return (
    <span aria-label={`${n} trên 5 sao`} className="text-[15px] tracking-wide text-amber-500">
      {"★".repeat(n)}
      <span className="text-slate-300">{"★".repeat(Math.max(0, 5 - n))}</span>
    </span>
  );
}

// ---------- modals ----------

export function ReasonModal(props: {
  title: string;
  sub: string;
  placeholder: string;
  submitLabel: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (note: string, done: () => void, fail: (msg: string) => boolean) => void;
}) {
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  return (
    <Modal title={props.title} sub={props.sub} onClose={props.onClose}>
      <textarea
        className={`${FIELD} border-amber-300`}
        rows={3}
        placeholder={props.placeholder}
        aria-label="Lý do"
        value={note}
        autoFocus
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="mt-3">
        <ErrorBox msg={err} />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className={BTN} onClick={props.onClose}>
          Hủy
        </button>
        <button
          type="button"
          className={PRIMARY}
          disabled={props.pending || !note.trim()}
          onClick={() => {
            setErr("");
            props.onSubmit(note.trim(), props.onClose, (m) => (setErr(m), true));
          }}
        >
          {props.submitLabel}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Completion form: playbook checklist, ≥ 1 after photo, optional note, and the materials the department ACTUALLY used
 * (one save, no request/approval step, no Agent suggestion, no reason). Cleaning may pick none; technical needs ≥ 1.
 * A backend refusal (failing items) is shown inside the form.
 */
export function FinishModal(props: {
  t: DeptTicket;
  kind: "cleaning" | "technical";
  catalog: CatalogItem[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (fd: FormData, done: () => void, fail: (msg: string) => boolean) => void;
}) {
  const { t, kind, catalog } = props;
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(t.checklist.filter((c) => c.done).map((c) => c.templateItemId)));
  /** itemCode -> typed quantity; a code is "used" while it is a key */
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const toggle = (set: Set<string>, key: string, put: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    put(next);
  };
  const togglePick = (code: string) => {
    const { [code]: gone, ...rest } = picked;
    setPicked(gone === undefined ? { ...picked, [code]: "1" } : rest);
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing = t.checklist.filter((c) => c.required && !ticked.has(c.templateItemId));
    if (missing.length > 0) return setErr(`Chưa tích checklist: ${missing.map((c) => c.label).join("; ")}.`);
    const used = Object.entries(picked).map(([itemCode, qty]) => ({ itemCode, qty: Number(qty) }));
    if (used.some((u) => !Number.isInteger(u.qty) || u.qty < 1)) return setErr("Số vật tư đã dùng phải là số nguyên từ 1 trở lên.");
    if (kind === "technical" && used.length === 0) return setErr("Chọn ít nhất một vật tư đã dùng.");
    if (files.length === 0) return setErr("Bắt buộc có ít nhất 1 ảnh hiện trường sau khi xử lý.");
    setErr("");
    const fd = new FormData();
    if (note.trim()) fd.append("note", note.trim());
    files.forEach((f) => fd.append("photos", f));
    t.checklist.filter((c) => !c.done && ticked.has(c.templateItemId)).forEach((c) => fd.append("checklist", c.templateItemId));
    used.forEach((u) => fd.append("used", JSON.stringify(u)));
    props.onSubmit(fd, props.onClose, (m) => (setErr(m), true));
  }

  return (
    <Modal title={`Hoàn thành ${t.code}`} sub={t.title || t.text} onClose={props.onClose} wide>
      <form onSubmit={submit} className="space-y-4 text-sm">
        <fieldset className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <legend className="px-1 text-xs font-bold text-slate-800">Checklist quy trình</legend>
          {t.checklist.length === 0 && <p className="m-0 text-xs text-muted">Quy trình không có mục checklist.</p>}
          {t.checklist.map((c) => (
            <label key={c.templateItemId} className="flex cursor-pointer items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                className={`h-4 w-4 ${FOCUS}`}
                checked={ticked.has(c.templateItemId)}
                disabled={c.done}
                onChange={() => toggle(ticked, c.templateItemId, setTicked)}
              />
              <span>
                {c.label}
                {c.required && <span className="text-rose-600"> *</span>}
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <legend className="px-1 text-xs font-bold text-slate-800">Vật tư đã dùng{kind === "technical" ? " (ít nhất 1)" : ""}</legend>
          {kind === "cleaning" && <p className="m-0 text-xs text-muted">Không chọn gì nếu lần xử lý này không dùng vật tư.</p>}
          {catalog.length === 0 && <p className="m-0 text-xs text-muted">Kho chưa có vật tư nào cho phòng này.</p>}
          {catalog.map((m) => (
            <div key={m.itemCode} className="flex flex-wrap items-center gap-2 text-slate-700">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                <input type="checkbox" className={`h-4 w-4 ${FOCUS}`} checked={picked[m.itemCode] !== undefined} onChange={() => togglePick(m.itemCode)} />
                <span className="truncate">
                  {m.itemName} ({m.unit})
                </span>
              </label>
              {picked[m.itemCode] !== undefined && (
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  className={`${FIELD} w-24 text-xs`}
                  aria-label={`Số ${m.itemName} đã dùng`}
                  value={picked[m.itemCode]}
                  onChange={(e) => setPicked({ ...picked, [m.itemCode]: e.target.value })}
                />
              )}
            </div>
          ))}
        </fieldset>

        <div>
          <label htmlFor={`after-${t.id}`} className="mb-1 block text-xs font-bold text-slate-700">
            Ảnh hiện trường sau xử lý <span className="text-rose-600">* (ít nhất 1, tối đa {MAX_PHOTOS})</span>
          </label>
          <input
            id={`after-${t.id}`}
            type="file"
            accept="image/*"
            multiple
            className={`${FIELD} text-xs`}
            onChange={(e) => {
              setFiles(Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS));
              setErr("");
            }}
          />
          {previews.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {previews.map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img key={u} src={u} alt={`Ảnh sau xử lý ${i + 1}`} className="h-20 w-20 rounded-xl border border-emerald-300 object-cover" />
              ))}
            </div>
          )}
        </div>

        <div>
          <label htmlFor={`note-${t.id}`} className="mb-1 block text-xs font-semibold text-slate-700">
            Ghi chú
          </label>
          <textarea id={`note-${t.id}`} className={FIELD} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <ErrorBox msg={err} />

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" className={BTN} onClick={props.onClose}>
            Hủy
          </button>
          <button type="submit" className={PRIMARY} disabled={props.pending}>
            Gửi nghiệm thu
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- ticket card ----------
export type Dialog = null | "finish" | "return" | "wrong";

export function WorkCard(props: {
  t: DeptTicket;
  kind: "cleaning" | "technical";
  pending: boolean;
  actions: CardActions;
  /** Materials this department may save as used */
  catalog: CatalogItem[];
}) {
  const { t, actions } = props;
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  const left = t.hoursLeft;
  const inProgress = t.stage === 4 && !t.paused;

  return (
    <article className="card flex flex-col gap-2.5 p-[18px]">
      <div className="flex flex-wrap items-center gap-2">
        <CodeButton t={t} onOpen={actions.open} />
        <span className="text-xs text-muted">{t.createdAt}</span>
        {t.urgent && <span className="pill urgent">Khẩn cấp</span>}
        <span className="pill cat-none">{t.statusLabel}</span>
        {t.stage < 5 && left !== null && (
          <span className={`pill ${left < 0 ? "bg-[#FDE2DF] text-[#8A1C12]" : "bg-[#D8EFE3] text-[#13553A]"}`}>
            {left < 0 ? `Quá hạn ${-left}h` : `Còn ${left}h`}
          </span>
        )}
      </div>
      <h3 className="m-0 text-[15px] font-semibold leading-normal">{t.title || t.text}</h3>
      {t.content && <p className="m-0 text-sm leading-normal text-body">{t.content}</p>}
      <span className="text-[13px] text-muted">{t.location}</span>
      {t.photos.length > 0 && <PhotoStrip photos={t.photos} />}
      {t.extras.length > 0 && (
        <div className="rounded-xl bg-field p-2.5 text-[13px]">
          <span className="font-semibold">Cư dân bổ sung</span>
          <ul className="m-0 mt-1 list-disc pl-5">
            {t.extras.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      {t.stage === 3 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-2.5">
          <button type="button" className={PRIMARY} disabled={props.pending} onClick={() => actions.accept(t.id)}>
            Nhận việc
          </button>
          <button type="button" className={`${BTN} ml-auto text-xs`} disabled={props.pending} onClick={() => setDialog("return")}>
            Không phải việc phòng mình
          </button>
        </div>
      )}

      {inProgress && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-2.5">
          <button type="button" className={PRIMARY} disabled={props.pending} onClick={() => setDialog("finish")}>
            Đánh dấu hoàn thành
          </button>
          <button type="button" className={`${BTN} ml-auto text-xs`} disabled={props.pending} onClick={() => setDialog("wrong")}>
            Báo sai phòng ban
          </button>
        </div>
      )}

      {t.stage >= 5 && <Feedback t={t} />}

      {dialog === "finish" && (
        <FinishModal t={t} kind={props.kind} catalog={props.catalog} pending={props.pending} onClose={close} onSubmit={(fd, done, fail) => actions.finish(t.id, fd, done, fail)} />
      )}
      {dialog === "return" && (
        <ReasonModal
          title={`Không phải việc phòng mình ${t.code}`}
          sub="Ticket quay lại Ban tiếp nhận. Nêu lý do:"
          placeholder="Ví dụ: sự cố này thuộc phòng khác."
          submitLabel="Trả về Tiếp nhận"
          pending={props.pending}
          onClose={close}
          onSubmit={(note, done, fail) => actions.returnBack(t.id, note, done, fail)}
        />
      )}
      {dialog === "wrong" && (
        <ReasonModal
          title={`Báo sai phòng ban ${t.code}`}
          sub="Ban quản lý sẽ quyết định giữ phòng hay chuyển về Tiếp nhận. Nêu lý do:"
          placeholder="Ví dụ: việc này thuộc phòng khác xử lý."
          submitLabel="Gửi báo cáo BQL"
          pending={props.pending}
          onClose={close}
          onSubmit={(note, done, fail) => actions.wrongDept(t.id, note, done, fail)}
        />
      )}
    </article>
  );
}

// ---------- lists ----------
export function HistoryList({ tickets, onOpen }: { tickets: DeptTicket[]; onOpen: (id: string) => void }) {
  const done = tickets.filter((t) => t.stage >= 5);
  return (
    <section className="flex max-w-[900px] flex-col gap-3.5">
      {done.length === 0 && <div className="card p-10 text-center text-muted">Chưa có ticket hoàn thành.</div>}
      {done.map((t) => (
        <article key={t.id} className="card flex flex-col gap-2 px-6 py-[22px]">
          <div className="flex flex-wrap items-center gap-2.5">
            <CodeButton t={t} onOpen={onOpen} />
            <span className={`pill ml-auto ${t.stage === 5 ? "cat-none" : "bg-[#D8EFE3] text-[#13553A]"}`}>{t.statusLabel}</span>
          </div>
          <span className="text-[15px] font-semibold leading-normal">{t.title || t.text}</span>
          {t.content && <span className="text-sm text-body">{t.content}</span>}
          <span className="text-[13px] text-muted">{t.location}</span>
          {t.rating ? (
            <div className="flex flex-col gap-1.5 border-t border-line-soft pt-2">
              <Stars n={t.rating.stars} />
              {t.rating.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {t.rating.tags.map((g) => (
                    <span key={g} className="pill cat-none">
                      {g}
                    </span>
                  ))}
                </div>
              )}
              {t.rating.comment && <p className="m-0 text-sm text-body">“{t.rating.comment}”</p>}
            </div>
          ) : (
            <span className="text-[13px] text-muted">{t.stage === 5 ? "Chờ Ban quản lý nghiệm thu." : "Chưa có đánh giá của cư dân."}</span>
          )}
        </article>
      ))}
    </section>
  );
}

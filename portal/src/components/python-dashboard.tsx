"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createResidentTicket, getTicketDetail, receiveStock, runTicketAction, uploadTicketPhotos } from "@/app/actions/backend";
import type { TicketAction } from "@/lib/backend-actions";
import { Body, Header, NavTiles, PageHead } from "@/components/shell";
import { IconBox, IconClipboard, IconInbox, IconPen } from "@/components/icons";
import { ROLE_LABEL, STAGES } from "@/lib/constants";
import { actualUsage, dateLabel, needsRole, safetyActions, stageFor, terminal, usagePayload, type PythonCase, type UsageDraft } from "@/lib/python-ui";
import type { DashboardData, ResidentTicketView } from "@/server/backend-dto";

type Detail = PythonCase | ResidentTicketView;
const isCase = (d: Detail): d is PythonCase => "ticket" in d;
const field = "w-full min-w-0 rounded-2xl border border-line bg-field p-3 text-body focus:outline-brand";
const section = "rounded-2xl border border-line p-4 flex flex-col gap-3";
type Result = { ok: true; data: unknown } | { ok: false; code: string; message: string; status: number; data?: unknown };
function subscribeOnline(callback: () => void) { window.addEventListener("online", callback); window.addEventListener("offline", callback); return () => { window.removeEventListener("online", callback); window.removeEventListener("offline", callback); }; }
function useOnline() { return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true); }

function Message({ text, error = false }: { text: string; error?: boolean }) {
  return text ? <div role={error ? "alert" : "status"} className={`rounded-2xl p-4 break-words ${error ? "bg-red-50 text-danger" : "bg-soft text-brand"}`}>{text}</div> : null;
}
function Progress({ status }: { status: string }) {
  const stage = stageFor(status);
  if (!stage) return null;
  return <div className="rounded-2xl bg-field p-4"><div className="flex justify-between font-semibold"><span>Tiến độ xử lý</span><span className="text-brand">Bước {stage}/6</span></div><ol className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">{STAGES.map((s, i) => <li key={s} className={`text-center text-xs ${i + 1 <= stage ? "text-brand font-semibold" : "text-muted"}`}><span className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full border-2 ${i + 1 <= stage ? "border-brand" : "border-line"}`}>{i + 1 < stage ? "✓" : i + 1}</span>{s}</li>)}</ol></div>;
}
function Pictures({ id, ids, resident }: { id: string; ids: string[]; resident: boolean }) {
  return <div className="thumbs">{ids.map((eid, index) => {
    const url = `/api/backend-photos/${resident ? "resident" : "internal"}/${encodeURIComponent(id)}/${encodeURIComponent(eid)}`;
    // Image optimization must not cache authenticated user photos across sessions.
    // eslint-disable-next-line @next/next/no-img-element
    return <a key={eid} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Ảnh ${index + 1}`} /></a>;
  })}</div>;
}

export function PythonDashboard({ data }: { data: DashboardData }) {
  const router = useRouter();
  const role = data.user.role;
  const [tab, setTab] = useState("queue");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const needs = data.tickets.filter((t) => role === "resident" ? data.residentTickets?.find((v) => v.ticket_id === t.ticket_id)?.allowed_actions.length : needsRole(t, role));
  const titles = { resident: "Phản ánh của tôi", reception: "Tiếp nhận thông tin", management: "Tổng quan xử lý", technical: "Hàng việc kỹ thuật", cleaning: "Hàng việc vệ sinh", warehouse: "Kho vật tư" };
  const filtered = data.tickets.filter((t) => (filter === "all" || (filter === "need" ? needs.some((n) => n.ticket_id === t.ticket_id) : filter === "open" ? !terminal(t.status) : terminal(t.status))) && `${t.ticket_id} ${t.description}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")));
  async function open(id: string) {
    setLoading(true); setError("");
    try {
      const result = await getTicketDetail(id);
      if (result.ok) setDetail(result.data as Detail);
      else { setError(result.message); if (result.status === 401) router.push("/login"); if (result.status === 404) router.refresh(); }
    } catch { setError("Không thể tải ticket. Vui lòng thử tải lại."); }
    finally { setLoading(false); }
  }
  const menu = [{ key: "queue", label: role === "warehouse" ? "Chờ vật tư" : "Danh sách ticket", icon: <IconInbox />, count: needs.length }];
  if (role === "resident") menu.unshift({ key: "new", label: "Gửi phản ánh", icon: <IconPen />, count: 0 });
  if (["warehouse", "technical", "cleaning", "management"].includes(role) && data.stock) menu.push({ key: "stock", label: "Vật tư & tồn kho", icon: <IconBox />, count: 0 });
  return <div className={`scr-${role} min-h-screen bg-page`}>
    <Header avatar={{ resident: "CD", reception: "TN", management: "QL", technical: "KT", cleaning: "VS", warehouse: "KHO" }[role]} name={data.user.name} rolePill={ROLE_LABEL[role]} bellLabel="Ticket cần xử lý" bellCount={needs.length} notices={needs.map((t) => ({ id: t.ticket_id, title: `${t.ticket_id}: ${t.description}`, tag: t.status_label, time: dateLabel(t.created_at) }))} />
    <Body>
      <NavTiles label="Chức năng" items={menu} active={tab} onPick={(value) => { setTab(value); setError(""); setMessage(""); }} />
      <PageHead title={tab === "new" ? "Gửi phản ánh mới" : tab === "stock" ? "Vật tư & tồn kho" : titles[role]} sub={role === "reception" ? "Ticket đã giao phòng ban được hiển thị theo trạng thái thực tế. Chỉ xử lý các trường hợp backend yêu cầu BPTN." : "Theo dõi cùng dữ liệu trên web và ứng dụng điện thoại."} />
      <Message text={error} error /><Message text={message} />
      {tab === "new" ? <ResidentCreate onCreated={(d) => { setDetail(d); setTab("queue"); router.refresh(); }} /> : tab === "stock" ? <StockPanel data={data} /> : <>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[["Tổng ticket", data.tickets.length], ["Cần xử lý", needs.length], ["Đang mở", data.tickets.filter((t) => !terminal(t.status)).length], ["Đã kết thúc", data.tickets.filter((t) => terminal(t.status)).length]].map(([label, count]) => <div key={label} className="card p-5"><p className="m-0 text-sm text-muted">{label}</p><p className="mt-2 mb-0 text-3xl font-bold text-brand">{count}</p></div>)}</div>
        <div className="card flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="m-0 text-xl font-bold">{titles[role]}</h2><button className="btn" disabled={loading} onClick={() => router.refresh()}>Tải lại danh sách</button></div>
          <div className="flex flex-wrap gap-2">{[["all", "Tất cả"], ["need", "Cần xử lý"], ["open", "Đang mở"], ["closed", "Đã kết thúc"]].map(([value, label]) => <button className={`btn ${filter === value ? "primary" : ""}`} key={value} onClick={() => { setFilter(value); setPage(0); }}>{label}</button>)}</div>
          <input className={field} aria-label="Tìm ticket" placeholder="Tìm mã hoặc nội dung phản ánh…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          <div className="grid gap-4 lg:grid-cols-2">{filtered.slice(page * 20, (page + 1) * 20).map((t) => <article key={t.ticket_id} className="min-w-0 rounded-2xl border border-line p-5">
            <div className="flex flex-wrap justify-between gap-2"><span className="font-mono text-sm font-bold text-brand">#{t.ticket_id}</span><span className={`pill ${t.risk_level === "EMERGENCY" ? "urgent" : "cat-none"}`}>{t.status_label}</span></div>
            <p className="my-4 break-words text-lg font-semibold">{t.description}</p><p className="text-sm text-muted">{dateLabel(t.created_at)}</p>
            {t.department_id && <p className="text-sm">{data.catalog?.departments[t.department_id] ?? t.department_id}</p>}
            <button className="btn primary" disabled={loading} onClick={() => open(t.ticket_id)}>Xem chi tiết</button>
          </article>)}</div>
          {!filtered.length && <p className="py-6 text-center text-muted">Không có ticket phù hợp.</p>}
          {filtered.length > 20 && <div className="flex items-center gap-3"><button className="btn" disabled={!page} onClick={() => setPage(page - 1)}>Trước</button><span>Trang {page + 1}/{Math.ceil(filtered.length / 20)}</span><button className="btn" disabled={(page + 1) * 20 >= filtered.length} onClick={() => setPage(page + 1)}>Sau</button></div>}
        </div>
      </>}
    </Body>
    {detail && <TicketModal key={isCase(detail) ? detail.ticket.ticket_id : detail.ticket_id} initial={detail} data={data} onClose={() => setDetail(null)} onChanged={() => router.refresh()} />}
  </div>;
}

function ResidentCreate({ onCreated }: { onCreated: (d: ResidentTicketView) => void }) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const online = useOnline(); const [uncertain, setUncertain] = useState(false);
  const preview = `${description.trim()}${location.trim() ? `\nVị trí: ${location.trim()}` : ""}`;
  return <form className="card flex flex-col gap-5 p-6" onSubmit={async (e) => {
    e.preventDefault(); if (pending) return; setPending(true); setError("");
    try { const r = await createResidentTicket(preview); if (r.ok) { setDescription(""); setLocation(""); onCreated(r.data as ResidentTicketView); } else { setError(r.message); if (r.status >= 500) setUncertain(true); if (r.status === 401) router.push("/login"); } }
    catch { setUncertain(true); setError("Chưa xác định được kết quả gửi. Tải lại danh sách trước khi thử gửi lần nữa."); }
    finally { setPending(false); }
  }}><label className="font-semibold">Nội dung phản ánh<textarea required maxLength={4000} className={`${field} mt-2`} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả sự cố cần xử lý" /></label>
    <label className="font-semibold">Vị trí<input required className={`${field} mt-2`} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ví dụ: sảnh tầng 1, tòa S2" /></label>
    <div className="rounded-2xl bg-field p-4"><span className="font-semibold">Nội dung sẽ gửi</span><p className="whitespace-pre-wrap break-words">{preview || "Nội dung và vị trí bạn nhập sẽ hiển thị ở đây."}</p></div>
    <Message text={error} error />{!online && <Message text="Đang mất kết nối mạng." error />}{uncertain && <a href="/resident">Kiểm tra lại danh sách trước khi gửi thêm</a>}<button className="btn primary" disabled={pending || uncertain || !online || !description.trim() || !location.trim()}>{pending ? "Đang gửi…" : "Gửi phản ánh"}</button>
  </form>;
}

function StockPanel({ data }: { data: DashboardData }) {
  const online = useOnline(); const [uncertain, setUncertain] = useState(false);
  const router = useRouter(); const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  return <div className="card flex flex-col gap-4 p-6"><Message text={error} error /><Message text={message} />{!online && <Message text="Đang mất kết nối mạng." error />}{uncertain && <button className="btn" onClick={() => window.location.reload()}>Tải lại tồn kho trước khi thử tiếp</button>}{data.stock?.map((item) => <div key={item.item_code} className="flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-line p-4"><div className="min-w-0 flex-1"><h3 className="m-0 break-words text-base font-semibold">{item.item_name}</h3><p className="mb-0 text-sm text-muted">{item.item_code} · Tồn: {item.qty === null ? "Chưa xác định" : item.qty} {item.unit}</p></div>{data.user.role === "warehouse" && <form className="flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); if (pending || uncertain || !online) return; const qty = Number(quantities[item.item_code]); if (!Number.isSafeInteger(qty) || qty <= 0) { setError("Số lượng nhập phải là số nguyên dương."); return; } setPending(true); setError(""); setMessage(""); try { const r = await receiveStock(item.item_code, qty); if (r.ok) { setQuantities({ ...quantities, [item.item_code]: "" }); setMessage("Đã nhập kho."); router.refresh(); } else { setError(r.message); if (r.status >= 500) setUncertain(true); if (r.status === 401) router.push("/login"); } } catch { setUncertain(true); setError("Chưa xác định kết quả nhập kho. Kiểm tra tồn trước khi thử lại."); } finally { setPending(false); } }}><input className={`${field} max-w-28`} type="number" min="1" step="1" aria-label={`Nhập kho ${item.item_name}`} value={quantities[item.item_code] ?? ""} onChange={(e) => setQuantities({ ...quantities, [item.item_code]: e.target.value })} /><button className="btn primary" disabled={pending || uncertain || !online}>Nhập kho</button></form>}</div>)}</div>;
}

function TicketModal({ initial, data, onClose, onChanged }: { initial: Detail; data: DashboardData; onClose: () => void; onChanged: () => void }) {
  const router = useRouter(); const [detail, setDetail] = useState(initial); const [pending, setPending] = useState(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const online = useOnline(); const [uncertain, setUncertain] = useState(false); const locked = pending || uncertain || !online;
  const id = isCase(detail) ? detail.ticket.ticket_id : detail.ticket_id;
  async function write(request: () => Promise<Result>, success: string): Promise<boolean> {
    if (locked) return false; setPending(true); setError(""); setMessage("");
    try {
      const r = await request();
      if (!r.ok) { setError(r.message); if (r.status >= 500) setUncertain(true); if (r.data && typeof r.data === "object" && "ticket" in r.data) setDetail(r.data as PythonCase); if (r.status === 401) router.push("/login"); if (r.status === 404) onChanged(); return false; }
      if (r.data && typeof r.data === "object" && ("ticket" in r.data || "ticket_id" in r.data)) setDetail(r.data as Detail);
      setMessage(success); onChanged(); return true;
    } catch { setUncertain(true); setError("Chưa xác định kết quả thao tác. Tải lại ticket để kiểm tra trước khi thử lại."); return false; }
    finally { setPending(false); }
  }
  const action = (name: TicketAction, payload: Record<string, unknown> = {}, success = "Đã lưu.") => write(() => runTicketAction(id, name, payload), success);
  const status = isCase(detail) ? detail.ticket.status : detail.status;
  const label = data.catalog?.status_labels[status] ?? (!isCase(detail) ? detail.status_label : status);
  return <div className="modal-backdrop" role="presentation"><section role="dialog" aria-modal="true" aria-label={`Ticket ${id}`} className="modal-card flex max-h-[90vh] min-w-0 flex-col gap-5 overflow-y-auto" style={{ maxWidth: 900 }}>
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono font-bold text-brand">#{id}</span><button className="btn" disabled={pending} onClick={onClose}>Đóng</button></div>
    <div><span className="pill cat-none">{label}</span><h2 className="mt-3 break-words text-xl font-bold">{isCase(detail) ? detail.ticket.raw.original_description : detail.description}</h2><p className="text-sm text-muted">{dateLabel(isCase(detail) ? detail.ticket.raw.created_at : detail.created_at)}</p></div>
    <Progress status={status} />
    <Message text={error} error /><Message text={message} />
    {!online && <Message text="Đang mất kết nối mạng." error />}
    {uncertain && <button className="btn" disabled={pending || !online} onClick={async () => { setPending(true); try { const r = await getTicketDetail(id); if (r.ok) { setDetail(r.data as Detail); setUncertain(false); setError(""); setMessage("Đã tải trạng thái mới. Kiểm tra kết quả trước khi lưu tiếp."); } else setError(r.message); } catch { setError("Chưa tải được trạng thái mới."); } finally { setPending(false); } }}>Tải lại trạng thái ticket</button>}
    {isCase(detail) ? <>
      {detail.ticket.blocker && <Message text={`${detail.ticket.blocker.public_message} (${detail.ticket.blocker.code} · ${detail.ticket.blocker.owner_role})`} />}
      {detail.draft && <p className="m-0 font-semibold">Vị trí: {detail.draft.location}</p>}
      <details className={section}><summary className="cursor-pointer font-semibold">Đánh giá Agent</summary><p className="m-0">{detail.agent_decision ? `Nguồn: ${detail.agent_decision.source}` : "Chưa có quyết định Agent."}</p><p className="m-0">{detail.classification?.classification_reason ?? "Chưa có đánh giá phân loại."}</p></details>
      <Pictures id={id} resident={false} ids={detail.evidence.filter((e) => ["SIMULATED_IMAGE", "RESIDENT_ORIGINAL"].includes(e.evidence_type) && /^[a-f0-9]{32}\.(jpg|png|webp)$/.test(e.content_or_metadata)).map((e) => e.evidence_id)} />
      {["technical", "cleaning"].includes(data.user.role) && <DepartmentPanel c={detail} data={data} pending={locked} action={action} upload={(fd) => write(() => uploadTicketPhotos(id, fd), "Đã tải ảnh xử lý.")} />}
      {data.user.role === "management" && <ManagementPanel c={detail} pending={locked} action={action} />}
      {data.user.role === "reception" && <ReceptionPanel c={detail} data={data} pending={locked} action={action} />}
      <History entries={detail.events.map((e) => ({ label: data.catalog?.status_labels[e.status] ?? e.status, message: e.public_message, time: e.created_at }))} />
    </> : <ResidentPanel view={detail} pending={locked} action={action} upload={(fd) => write(() => uploadTicketPhotos(id, fd), "Đã tải ảnh hiện trường.")} />}
  </section></div>;
}
type ActionFn = (action: TicketAction, payload?: Record<string, unknown>, success?: string) => Promise<boolean>;
function History({ entries }: { entries: { label: string; message: string; time: string }[] }) { return <details className={section}><summary className="cursor-pointer font-semibold">Lịch sử xử lý</summary>{entries.map((e, i) => <div key={i} className="border-l-2 border-line pl-3"><p className="m-0 font-semibold">{e.label}</p><p className="my-1 text-sm">{e.message}</p><time className="text-xs text-muted">{dateLabel(e.time)}</time></div>)}</details>; }
function Upload({ pending, upload }: { pending: boolean; upload: (fd: FormData) => Promise<boolean> }) {
  const [files, setFiles] = useState<File[]>([]); const [version, setVersion] = useState(0);
  return <form className={section} onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(); files.forEach((f) => fd.append("files", f)); if (await upload(fd)) { setFiles([]); setVersion(version + 1); } }}><h3 className="m-0 font-bold">Thêm ảnh hiện trường</h3><p className="m-0 text-sm text-muted">JPG, PNG hoặc WEBP; tối đa 5 MB mỗi ảnh.</p><input key={version} className={field} aria-label="Chọn ảnh" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} /><button className="btn" disabled={pending || !files.length}>Tải ảnh lên</button></form>;
}
function ResidentPanel({ view, pending, action, upload }: { view: ResidentTicketView; pending: boolean; action: ActionFn; upload: (fd: FormData) => Promise<boolean> }) {
  const [addition, setAddition] = useState(""); const [score, setScore] = useState("5");
  return <><Message text={view.public_message} /><p className="m-0">Phòng ban tiếp nhận: {view.department_name ?? "Đang điều phối phân công"}</p><Pictures id={view.ticket_id} ids={view.photos} resident />
    {view.additions.map((a, i) => <p key={i} className="m-0 rounded-xl bg-field p-3">Bổ sung: {a}</p>)}
    {view.allowed_actions.includes("ADD_INFO") && <form className={section} onSubmit={async (e) => { e.preventDefault(); if (await action("additions", { content: addition }, "Đã gửi thông tin bổ sung.")) setAddition(""); }}><label className="font-semibold">Bổ sung thông tin<textarea className={`${field} mt-2`} required rows={3} value={addition} onChange={(e) => setAddition(e.target.value)} /></label><button className="btn primary" disabled={pending || !addition.trim()}>Gửi bổ sung</button></form>}
    {!terminal(view.status) && <Upload pending={pending} upload={upload} />}
    {view.allowed_actions.includes("RATE") && <form className={section} onSubmit={async (e) => { e.preventDefault(); await action("rating", { score: Number(score) }, "Đã gửi đánh giá."); }}><label className="font-semibold">Đánh giá<select className={`${field} mt-2`} value={score} onChange={(e) => setScore(e.target.value)}>{[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>{s} sao</option>)}</select></label><button className="btn primary" disabled={pending}>Gửi đánh giá</button></form>}
    <History entries={view.timeline.map((t) => ({ label: t.status_label, message: t.public_message, time: t.created_at }))} />
  </>;
}

function DepartmentPanel({ c, data, pending, action, upload }: { c: PythonCase; data: DashboardData; pending: boolean; action: ActionFn; upload: (fd: FormData) => Promise<boolean> }) {
  const [note, setNote] = useState(""); const [eta, setEta] = useState("");
  if (c.ticket.status === "ROUTED") return <><button className="btn primary" disabled={pending} onClick={() => action("accept", {}, "Đã nhận việc.")}>Nhận việc</button><NoteAction label="Trả lại cho BPTN" required pending={pending} onSubmit={(note) => action("return", { note }, "Đã trả lại ticket.")} /></>;
  if (c.ticket.status === "ON_HOLD" && c.ticket.blocker?.code === "BLOCKED_ONSITE") return <button className="btn primary" disabled={pending} onClick={() => action("resume-work", {}, "Đã tiếp tục xử lý.")}>Tiếp tục xử lý</button>;
  if (c.ticket.status !== "IN_PROGRESS") return <Message text={c.ticket.status === "READY_FOR_REVIEW" ? "Đã báo hoàn thành, đang chờ BQL nghiệm thu." : "Chưa có thao tác xử lý ở trạng thái này."} />;
  const requirement = c.draft?.evidence_requirements[0];
  return <>
    {!!c.draft?.readiness_evaluation?.failing_items.length && <Message text={`Còn thiếu: ${c.draft.readiness_evaluation.failing_items.join("; ")}`} error />}
    <div className={section}><h3 className="m-0 flex items-center gap-2 font-bold"><IconClipboard size={20} /> Checklist thực hiện</h3>{c.checklist_items.map((item) => <label key={item.template_item_id} className="flex gap-3 rounded-xl bg-field p-3"><input type="checkbox" checked={item.status === "COMPLETED"} disabled={pending} onChange={(e) => action("checklist", { template_item_id: item.template_item_id, status: e.target.checked ? "COMPLETED" : "PENDING" })} /><span>{item.label_snapshot}{item.required ? " *" : ""}</span></label>)}</div>
    <Materials c={c} data={data} pending={pending} action={action} />
    <Upload pending={pending} upload={upload} />
    {requirement && <form className={section} onSubmit={async (e) => { e.preventDefault(); if (await action("evidence", { requirement_id: requirement.requirement_id, evidence_type: requirement.allowed_evidence_types[0], content_or_metadata: note.trim(), readability_status: "NOT_APPLICABLE" }, "Đã lưu ghi chú.")) setNote(""); }}><label className="font-semibold">Ghi chú xử lý<textarea className={`${field} mt-2`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi ngắn gọn việc đã làm" /></label><button className="btn" disabled={pending || !note.trim()}>Lưu ghi chú</button></form>}
    <button className="btn primary" disabled={pending} onClick={() => action("complete", {}, "Đã báo hoàn thành, đang chờ BQL nghiệm thu.")}>Báo hoàn thành</button>
    <details className={section}><summary className="cursor-pointer font-semibold">Vướng tại hiện trường</summary><form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); action("block", { note, eta: new Date(eta).toISOString() }, "Đã tạm hoãn xử lý."); }}><label>Lý do<textarea required className={field} value={note} onChange={(e) => setNote(e.target.value)} /></label><label>Dự kiến tiếp tục<input required className={field} type="datetime-local" value={eta} onChange={(e) => setEta(e.target.value)} /></label><button className="btn" disabled={pending}>Tạm hoãn</button></form></details>
    <NoteAction label="Báo sai phòng ban" required pending={pending} onSubmit={(note) => action("return", { note }, "Đã báo sai phòng ban.")} />
  </>;
}
function Materials({ c, data, pending, action }: { c: PythonCase; data: DashboardData; pending: boolean; action: ActionFn }) {
  const [lines, setLines] = useState<UsageDraft[]>(() => actualUsage(c)); const [error, setError] = useState(""); const [saved, setSaved] = useState(c.material_lines.some((m) => m.used_qty !== null) || c.draft?.material_requirement_mode === "N_A");
  const allowed = data.catalog?.material_codes_by_department[c.ticket.department_id ?? ""] ?? [];
  const choices = data.catalog?.materials.filter((m) => allowed.includes(m.item_code)) ?? [];
  function change(next: UsageDraft[]) { setLines(next); setSaved(false); setError(""); }
  return <form className={section} onSubmit={async (e) => { e.preventDefault(); if (pending) return; setError(""); try { const payload = usagePayload(lines, c.ticket.department_id, allowed); if (await action("material-usage", payload, "Đã lưu vật tư thực tế.")) setSaved(true); } catch (e) { setError(e instanceof Error ? e.message : "Vật tư không hợp lệ."); } }}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="m-0 text-lg font-bold">Vật tư sử dụng</h3><span className="pill cat-none">{saved ? "Đã lưu" : "Chưa lưu"}</span></div><p className="m-0 text-sm text-muted">Chọn vật tư đã dùng và số lượng.</p>
    {lines.map((line, i) => <div key={i} className="flex min-w-0 flex-wrap gap-2"><select className={`${field} flex-1 basis-48`} aria-label={`Vật tư ${i + 1}`} value={line.item_code} disabled={pending} onChange={(e) => change(lines.map((l, j) => j === i ? { ...l, item_code: e.target.value } : l))}><option value="">Chọn vật tư…</option>{choices.map((m) => <option value={m.item_code} key={m.item_code}>{m.item_name}</option>)}</select><input className={`${field} max-w-24`} aria-label={`Số lượng đã dùng ${i + 1}`} type="number" min="1" step="1" value={line.quantity} disabled={pending} onChange={(e) => change(lines.map((l, j) => j === i ? { ...l, quantity: e.target.value } : l))} /><button type="button" className="btn" disabled={pending} onClick={() => change(lines.filter((_, j) => j !== i))}>Bỏ</button></div>)}
    {c.ticket.department_id === "DEPT_CLEANING" && <label className="flex gap-2"><input type="checkbox" checked={!lines.length} disabled={pending} onChange={(e) => change(e.target.checked ? [] : [{ item_code: "", quantity: "1" }])} />Không sử dụng vật tư</label>}
    <button type="button" className="btn" disabled={pending} onClick={() => change([...lines, { item_code: "", quantity: "1" }])}>+ Thêm vật tư</button><Message text={error} error /><button className="btn primary" disabled={pending || saved}>Lưu vật tư</button>
  </form>;
}
function NoteAction({ label, required = false, pending, onSubmit }: { label: string; required?: boolean; pending: boolean; onSubmit: (note: string) => Promise<boolean> }) {
  const [note, setNote] = useState("");
  return <form className={section} onSubmit={async (e) => { e.preventDefault(); if (await onSubmit(note)) setNote(""); }}><label className="font-semibold">{label}<textarea required={required} className={`${field} mt-2`} aria-label={`Ghi chú ${label}`} placeholder={required ? "Nhập lý do" : "Ghi chú (không bắt buộc)"} rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label><button className="btn" disabled={pending || (required && !note.trim())}>{label}</button></form>;
}
function ManagementPanel({ c, pending, action }: { c: PythonCase; pending: boolean; action: ActionFn }) {
  return <>
    {!!safetyActions(c, "management").length && <SafetyPanel pending={pending} action={action} allowRequestInfo={safetyActions(c, "management").includes("REQUEST_INFO")} />}
    {c.ticket.status === "READY_FOR_REVIEW" && <><NoteAction label="Nghiệm thu hoàn tất" pending={pending} onSubmit={(note) => action("close", { note }, "Đã nghiệm thu hoàn tất.")} /><NoteAction label="Yêu cầu làm lại" required pending={pending} onSubmit={(note) => action("rework", { note }, "Đã yêu cầu làm lại.")} /></>}
    {c.ticket.blocker?.code === "EMERGENCY_PENDING_BQL" && <><Message text="Khẩn cấp: cần BQL xử lý." error /><NoteAction label="Đã xử lý khẩn cấp" required pending={pending} onSubmit={(note) => action("emergency-close", { note }, "Đã ghi nhận xử lý khẩn cấp.")} /><NoteAction label="Hạ cảnh báo khẩn cấp" required pending={pending} onSubmit={(note) => action("emergency-downgrade", { note }, "Đã hạ cảnh báo.")} /></>}
    {!terminal(c.ticket.status) && <><Priority pending={pending} action={action} /><NoteAction label="Hủy ticket" required pending={pending} onSubmit={(note) => action("cancel", { cancel_reason: note }, "Đã hủy ticket.")} /></>}
  </>;
}
function Priority({ pending, action }: { pending: boolean; action: ActionFn }) {
  const [priority, setPriority] = useState("MEDIUM"); const [note, setNote] = useState("");
  return <details className={section}><summary className="cursor-pointer font-semibold">Điều chỉnh ưu tiên</summary><form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); action("priority", { priority, note }, "Đã điều chỉnh ưu tiên."); }}><select className={field} aria-label="Mức ưu tiên" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="HIGH">Cao</option><option value="MEDIUM">Trung bình</option><option value="LOW">Thấp</option></select><textarea required aria-label="Lý do điều chỉnh ưu tiên" className={field} value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn" disabled={pending || !note.trim()}>Lưu ưu tiên</button></form></details>;
}
function ReceptionPanel({ c, data, pending, action }: { c: PythonCase; data: DashboardData; pending: boolean; action: ActionFn }) {
  const [note, setNote] = useState(""); const [location, setLocation] = useState(""); const [category, setCategory] = useState(""); const [asset, setAsset] = useState(""); const [onsite, setOnsite] = useState(false); const [merge, setMerge] = useState("false");
  const blocker = c.ticket.blocker;
  if (!blocker || blocker.owner_role !== "BPTN") return <Message text="Ticket này không chờ BPTN xác nhận chuyển phòng ban." />;
  if (blocker.code === "SAFETY_REVIEW_REQUIRED") return <SafetyPanel pending={pending} action={action} />;
  return <><form className={section} onSubmit={(e) => { e.preventDefault(); const payload: Record<string, unknown> = {}; if (note.trim()) payload.note = note.trim(); if (location.trim()) payload.location = location.trim(); if (category) payload.category = category; if (blocker.code === "MISSING_INFO") payload.info = note.trim(); if (blocker.code === "DUPLICATE") payload.merge = merge === "true"; if (blocker.code === "ASSET_UNCLEAR") { payload.asset_onsite = onsite; if (asset) payload.asset_id = asset; } action("bptn-resolve", payload, "Đã thẩm định. Backend đã cập nhật hướng xử lý."); }}><h3 className="m-0 font-bold">Thẩm định {blocker.code}</h3>
    {["CATEGORY_UNCLEAR", "OUT_OF_SCOPE", "PENDING_REVIEW", "WRONG_DEPT"].includes(blocker.code) && <label>Loại việc<select className={field} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Giữ kết quả hiện tại</option><option value="VE_SINH">Vệ sinh</option><option value="KY_THUAT">Kỹ thuật</option></select></label>}
    {["PENDING_REVIEW", "CATEGORY_UNCLEAR", "MISSING_INFO"].includes(blocker.code) && <label>Vị trí<input className={field} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Chỉ nhập khi cần bổ sung hoặc sửa" /></label>}
    {blocker.code === "DUPLICATE" && <label>Kết quả đối chiếu<select className={field} value={merge} onChange={(e) => setMerge(e.target.value)}><option value="false">Không trùng</option><option value="true">Trùng, gộp phản ánh</option></select></label>}
    {blocker.code === "ASSET_UNCLEAR" && <><label>Tài sản<select className={field} value={asset} disabled={onsite} onChange={(e) => setAsset(e.target.value)}><option value="">Chọn tài sản…</option>{data.catalog?.assets.map((a) => <option value={a.asset_id} key={a.asset_id}>{a.name} · {a.area}</option>)}</select></label><label className="flex gap-2"><input type="checkbox" checked={onsite} onChange={(e) => setOnsite(e.target.checked)} />Xác định tài sản tại hiện trường</label></>}
    <label>{blocker.code === "MISSING_INFO" ? "Thông tin đã thu thập" : "Ghi chú thẩm định"}<textarea className={field} required={onsite || blocker.code === "MISSING_INFO"} rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label><button className="btn primary" disabled={pending}>Lưu thẩm định</button>
  </form><Priority pending={pending} action={action} /></>;
}
function SafetyPanel({ pending, action, allowRequestInfo = true }: { pending: boolean; action: ActionFn; allowRequestInfo?: boolean }) {
  const [note, setNote] = useState("");
  return <div className={section}><h3 className="m-0 font-bold">Thẩm định an toàn</h3><textarea className={field} aria-label="Ghi chú an toàn" value={note} onChange={(e) => setNote(e.target.value)} />{[["CONFIRM_SAFE", "Xác nhận an toàn"], ...(allowRequestInfo ? [["REQUEST_INFO", "Yêu cầu thêm thông tin"]] : []), ["ESCALATE", "Chuyển khẩn cấp đến BQL"]].map(([decision, label]) => <button className="btn" key={decision} disabled={pending || (decision !== "ESCALATE" && !note.trim())} onClick={() => action("safety", { decision, note }, "Đã ghi nhận quyết định an toàn.")}>{label}</button>)}</div>;
}

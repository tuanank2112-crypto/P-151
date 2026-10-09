// Shared pieces of the staff screens (BQL, Phòng ban, BPTN, Kho) — plan 11 SPEC-P05 Q31.
// Labels copied from src/web/app.js so web and app name things the same way.
import { api, apiImage } from './api.js?v=7';
import { el, emptyState, fill, formatTime, history, notice, pageHead, pagedList, pill, refreshButton, toast } from './ui.js?v=7';

export const REASON_LABEL = {
  MISSING_INFO: 'Thiếu thông tin', DUPLICATE: 'Nghi trùng', CATEGORY_UNCLEAR: 'Loại việc chưa rõ', OUT_OF_SCOPE: 'Ngoài phạm vi',
  PENDING_REVIEW: 'Cần BPTN xác nhận', ASSET_UNCLEAR: 'Chưa xác định tài sản', WAITING_MATERIAL: 'Chờ vật tư',
  OUT_OF_HOURS: 'Ngoài giờ phòng ban', NOT_ACCEPTED: 'Chưa có người nhận', WRONG_DEPT: 'Sai phòng ban',
  BLOCKED_ONSITE: 'Vướng tại hiện trường', REWORK: 'Làm lại', SAFETY_REVIEW_REQUIRED: 'Kiểm tra an toàn (Bậc 2)',
  EMERGENCY_PENDING_BQL: 'Khẩn cấp (Bậc 1)', WRONG_DEPT_AFTER_START: 'Báo sai sau khi làm',
};
export const PRIORITY_LABEL = { HIGH: 'Cao', MEDIUM: 'Trung bình', LOW: 'Thấp' };
export const CATEGORY_LABEL = { VE_SINH: 'Dịch vụ Vệ sinh', KY_THUAT: 'Kỹ thuật & Chiếu sáng' };
const DEPT_CLASS = { DEPT_CLEANING: 'cat-ve_sinh', DEPT_TECHNICAL: 'cat-ky_thuat' }; // portal colours of Vệ sinh / Kỹ thuật
const STATUS_CLASS = {
  RECEIVED: 'st-moi', VERIFYING: 'st-moi', NEED_INFO: 'st-moi', ON_HOLD: 'st-moi', ROUTED: 'st-da_chuyen',
  IN_PROGRESS: 'st-dang_xu_ly', READY_FOR_REVIEW: 'st-da_chuyen', CLOSED: 'st-hoan_thanh', MERGED: 'st-hoan_thanh', CANCELLED: 'st-hoan_thanh',
};
const STORED_PHOTO = /^[0-9a-f]{32}\.(jpg|png|webp)$/; // as src/web/app.js: only real uploads have a file to fetch

/** Fixture tickets are hidden like on the web (src/web/app.js isSeedTicket). */
export const isSeedTicket = (id) => /-(CLN|TEC)-/i.test(id || '');
/** Blocker code of a BqlTicketRow / Case ticket (blocker.code) or a TicketSummary (reason_code). */
export const codeOf = (r) => r.reason_code || (r.blocker && r.blocker.code) || null;
export const isEmergency = (r) => r.status === 'EMERGENCY_PENDING_BQL' || codeOf(r) === 'EMERGENCY_PENDING_BQL';

let catalog = null;
export function loadCatalog() {
  if (!catalog) catalog = api('/mo/catalog').catch((err) => { catalog = null; throw err; });
  return catalog;
}
export const deptName = (cat, id) => (id && cat && cat.departments[id]) || id || '';

/** Status pill of the staff screens; a Bậc 1 emergency is the solid red portal ".urgent" pill. */
export function statusPill(r, label) {
  if (isEmergency(r)) return pill('urgent', REASON_LABEL.EMERGENCY_PENDING_BQL, { dot: false });
  return pill(STATUS_CLASS[r.status] || 'st-moi', label || r.status_label || r.status, { dot: false });
}
export const deptPill = (cat, departmentId) => pill(DEPT_CLASS[departmentId] || 'cat-none', departmentId ? deptName(cat, departmentId) : 'Chưa giao phòng ban');

/** Small red/yellow pills: blocker reason, overdue, escalated, rework count (fields that are missing are skipped). */
export function flags(r) {
  const code = codeOf(r);
  return [
    code && !isEmergency(r) ? pill('late', REASON_LABEL[code] || code, { dot: false }) : null,
    r.overdue ? pill('late', 'Quá hạn', { dot: false }) : null,
    r.escalated ? pill('late', 'Đã leo thang', { dot: false }) : null,
    r.rework_count > 0 ? pill('st-moi', `Làm lại ×${r.rework_count}`, { dot: false }) : null,
  ];
}

// ---------------------------------------------------------------- names (src/web/app.js)

const CHECKLIST_HUMAN_LABELS = {
  'CLN-CHK-01': 'Khảo sát và xác nhận vị trí khu vực cần vệ sinh',
  'CLN-CHK-02': 'Thu gom toàn bộ rác thải và xử lý bề mặt sàn',
  'CLN-CHK-03': 'Kiểm tra hiện trường hoàn tất, khử khuẩn và thông thoáng',
  'TEC-CHK-01': 'Khảo sát vị trí và xác định thiết bị chiếu sáng gặp sự cố',
  'TEC-CHK-02': 'Ngắt nguồn điện cục bộ và kiểm tra an toàn trước khi thực hiện',
  'TEC-CHK-03': 'Lắp đặt thay thế thiết bị mới, đóng điện và nghiệm thu ánh sáng',
};
const REALISTIC_MATERIAL_NAMES = {
  'SIM-MAT-CLEAN-01': 'Dung dịch tẩy rửa chuyên dụng Ecolab (Can 5L)',
  'SIM-MAT-BAG-01': 'Túi rác công nghiệp PE 120L (Cuộn)',
  'SIM-MAT-LAMP-01': 'Bóng đèn LED Tuýp T8 18W Duhal/Rạng Đông',
  'SIM-MAT-LAMP-02': 'Bóng đèn Huỳnh quang T8 36W 1.2m Philips',
  'SIM-MAT-STARTER-01': 'Tắc te điện tử / Chấn lưu Philips S10',
};
const plain = (text) => String(text || '').replace(/\s*\(mô phỏng\)/gi, '').replace(/mô phỏng:?\s*/gi, '').trim();
export const checklistLabel = (item) => CHECKLIST_HUMAN_LABELS[item.template_item_id] || plain(item.label_snapshot);
export const materialName = (code, name) => REALISTIC_MATERIAL_NAMES[code] || plain(name) || code;
export function materialUnit(code, unit) {
  if (unit && !unit.includes('sim')) return unit;
  if (code && code.includes('CLEAN')) return 'can 5L';
  if (code && code.includes('BAG')) return 'cuộn';
  if (code && code.includes('LAMP')) return 'bóng';
  if (code && code.includes('STARTER')) return 'bộ';
  return 'đơn vị';
}

// ---------------------------------------------------------------- case detail parts

export function imagesOf(c, source, filter = () => true) {
  return c.evidence.filter((e) => e.source === source
    && (e.evidence_type === 'RESIDENT_ORIGINAL' || e.evidence_type === 'SIMULATED_IMAGE')
    && STORED_PHOTO.test(e.content_or_metadata) && filter(e)).map((e) => e.evidence_id);
}
/** Department photos of the current work order (a rework starts a new one). */
export function executionPhotoIds(c) {
  const draftId = c.draft && c.draft.work_order_draft_id;
  return imagesOf(c, 'DEPARTMENT_EXECUTION', (e) => e.work_order_draft_id === draftId);
}

/** Thumbnails of internal photos; `cache` (evidence_id → object URL) lives as long as the screen. */
export function photoStrip(ctx, ticketId, ids, cache, alt = 'Ảnh hiện trường') {
  const strip = el('div', { class: 'thumbs' });
  for (const evidenceId of ids) {
    const img = el('img', { alt });
    const link = el('a', { target: '_blank', rel: 'noopener' }, img);
    strip.append(link);
    const show = (url) => { img.src = url; link.href = url; };
    if (cache.has(evidenceId)) { show(cache.get(evidenceId)); continue; }
    apiImage(`/mo/tickets/${encodeURIComponent(ticketId)}/photos/${encodeURIComponent(evidenceId)}`)
      .then((url) => { cache.set(evidenceId, ctx.trackUrl(url)); show(url); })
      .catch(() => { img.alt = 'Không tải được ảnh'; });
  }
  return strip;
}
export function photoBox(ctx, c, title, ids, cache) {
  if (!ids.length) return null;
  return el('div', { class: 'box' }, el('span', { class: 'cap' }, title.toUpperCase()), photoStrip(ctx, c.ticket.ticket_id, ids, cache, title));
}

/** Header rows of an internal case: code + status, time, department and flag pills, blocker notice. */
export function caseHead(c, cat) {
  const t = c.ticket;
  const label = (cat && cat.status_labels[t.status]) || t.status;
  const code = codeOf(t);
  return [
    el('div', { class: 'trow' }, el('b', { class: 'code' }, t.ticket_id), statusPill(t, label)),
    el('span', { class: 'muted small' }, `Gửi lúc ${formatTime(t.raw.created_at)}${c.draft && c.draft.location ? ` · ${c.draft.location}` : ''}`),
    el('div', { class: 'pills' }, deptPill(cat, t.department_id), flags({ ...t, escalated: t.blocker && t.blocker.escalated })),
    code ? notice(`${REASON_LABEL[code] || code}${t.blocker.public_message ? `: ${t.blocker.public_message}` : ''}`,
      isEmergency(t) || (t.blocker && t.blocker.escalated) ? 'danger' : 'pause', { id: 'case-blocker' }) : null,
  ];
}

export function reportBox(c) {
  return el('div', { class: 'box' }, el('span', { class: 'cap' }, 'NỘI DUNG PHẢN ÁNH'),
    el('p', { class: 'pre body' }, c.ticket.raw.original_description),
    c.additions.length ? el('ul', { class: 'extras' }, c.additions.map((a) => el('li', {}, `${formatTime(a.submitted_at)}: ${a.content}`))) : null);
}

export function eventsHistory(c, cat) {
  return history('Diễn biến gần đây', c.events.slice(-20).reverse().map((e) => ({
    label: (cat && cat.status_labels[e.to_status]) || e.to_status, note: e.public_message, time: formatTime(e.created_at),
  })));
}

export const webButton = () => el('a', { class: 'btn block', href: '/ui/', target: '_blank', rel: 'noopener' }, 'Mở bản web đầy đủ');

/** <select class="field"> with a placeholder option. options = [[value, label], …] */
export function select(options, { placeholder = 'Chọn…', value = '', id = null } = {}) {
  const node = el('select', { class: 'field', id }, el('option', { value: '' }, placeholder), options.map(([v, label]) => el('option', { value: v }, label)));
  node.value = value;
  return node;
}

/** Drop empty strings / null / undefined (BPTN bodies are `extra: forbid` and must not carry empty fields). */
export const compact = (body) => Object.fromEntries(Object.entries(body).filter(([, v]) => v !== '' && v !== null && v !== undefined));

// ---------------------------------------------------------------- queue screen (list of TicketSummary)

/** Card of a TicketSummary (GET /mo/tickets) linking to `${base}/<id>`. */
export function summaryCard(cat, base) {
  return (t) => el('a', { class: `card bitem ${isEmergency(t) ? 'urgent' : ''}`, href: `${base}/${encodeURIComponent(t.ticket_id)}`, dataset: { ticket: t.ticket_id } },
    el('span', { class: 'trow' }, el('b', {}, t.ticket_id), statusPill(t)),
    el('span', { class: 'ttitle' }, t.description),
    el('span', { class: 'tmeta' }, [formatTime(t.created_at), t.priority ? `Ưu tiên ${PRIORITY_LABEL[t.priority] || t.priority}` : null].filter(Boolean).join(' · ')),
    el('span', { class: 'pills' }, deptPill(cat, t.department_id), flags(t)));
}

/**
 * List screen shared by Phòng ban / BPTN / Kho: stat cards, filter tiles (#staff-tabs), page head, paged cards (#staff-list).
 * opts: { tiles: [[key, label, icon, test]], tab: { get, set }, heads: { key: [title, sub] }, base, stats?(rows) → [[label, n]], empty }
 * Without `stats` no stat cards are drawn (Phòng ban, Q32).
 */
export async function queueScreen(ctx, opts) {
  const statsBox = el('div', { class: 'stats' });
  const head = el('div');
  const body = el('div', { id: 'staff-list' });
  let rows = [];
  let cat = null;
  const test = () => (opts.tiles.find(([key]) => key === opts.tab.get()) || opts.tiles[0])[3];
  const chrome = () => ctx.chrome({
    navId: 'staff-tabs', active: opts.tab.get(),
    items: opts.tiles.map(([key, label, iconName]) => ({ key, label, icon: iconName, onclick: () => { opts.tab.set(key); draw(false); } })),
  });
  const draw = (keep) => {
    chrome();
    ctx.counts(Object.fromEntries([...opts.tiles.map(([key, , , t]) => [key, rows.filter(t).length]), ['bell', rows.filter(opts.tiles[0][3]).length]]));
    statsBox.hidden = !opts.stats;
    fill(statsBox, (opts.stats ? opts.stats(rows) : []).map(([label, value]) => el('div', { class: 'card stat' }, el('span', {}, label), el('b', {}, String(value)))));
    const [title, sub] = opts.heads[opts.tab.get()] || opts.heads[opts.tiles[0][0]];
    fill(head, pageHead(title, sub, { right: refreshButton(load, ctx) }));
    const previous = keep ? body.firstElementChild : null;
    fill(body, pagedList(rows.filter(test()), summaryCard(cat, opts.base), { empty: opts.empty, keep: previous }));
  };
  const load = async () => {
    const [all, catalogView] = await Promise.all([api('/mo/tickets'), loadCatalog().catch(() => null)]);
    if (!ctx.alive()) return;
    rows = all.filter((r) => !isSeedTicket(r.ticket_id));
    cat = catalogView;
    draw(true);
    ctx.updatedNow();
  };
  chrome();
  ctx.screen.append(statsBox, head, el('div', { class: 'updated', dataset: { updated: '' } }), body);
  await load();
  ctx.setLoader(load);
}

/**
 * Detail screen frame shared by Phòng ban / BPTN / Kho: loads the Case (+ catalog), calls draw(live, c, cat) on every load.
 * `bind(load)` hands the reload function to the screen before the first draw, so writes can reload (I-2).
 */
export async function caseScreen(ctx, { back, tiles, draw, bind = null }) {
  const [id] = ctx.params;
  ctx.chrome({ navId: 'staff-tabs', active: tiles.active, items: tiles.items.map(([key, label, iconName]) => ({ key, label, icon: iconName, onclick: () => { tiles.pick(key); ctx.go(back); } })) });
  const live = el('div', { id: 'case-detail' });
  ctx.screen.append(pageHead('Chi tiết phản ánh', null, { back }), el('div', { class: 'updated', dataset: { updated: '' } }), live);
  const load = async () => {
    const [c, cat] = await Promise.all([api(`/mo/tickets/${encodeURIComponent(id)}`), loadCatalog().catch(() => null)]);
    if (!ctx.alive()) return;
    await draw(live, c, cat);
    ctx.updatedNow();
  };
  if (bind) bind(load); // writes made from the first draw can already reload
  try {
    await load();
  } catch (err) {
    if (err.kind === 'not_found') { ctx.fail(err, { back }); return null; }
    fill(live, emptyState(err.message));
    throw err;
  }
  ctx.setLoader(load);
  return { id, load };
}

/** Run a write, toast, reload the case; errors go through the error table (403/409 also reload). */
export function writer(ctx, back, getLoad) {
  return async (call, success) => {
    try {
      const result = await call();
      if (success) toast(typeof success === 'function' ? success(result) : success);
    } catch (err) {
      ctx.fail(err, { back });
      if (err.kind === 'not_found') return false;
    }
    await getLoad()().catch((err) => ctx.fail(err, { back }));
    return true;
  };
}

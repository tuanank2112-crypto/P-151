// BQL screens on the phone (plan 11, SPEC-P03 rules, SPEC-P04 §5 layout from portal/src/app/management/management-app.tsx).
// Buttons follow the BqlTicketRow; the server stays the referee (403/409 go through the error table).
import { api, apiImage } from './api.js?v=17';
import {
  TERMINAL, boxOf, confirmSheet, el, emptyState, field, fill, formatTime, history, icon, infoGrid, notice, pageHead, pagedList,
  refreshButton, toast, writeButton,
} from './ui.js?v=17';
import {
  PRIORITY_LABEL, REASON_LABEL, deptName, deptPill as deptPillOf, flags, imagesOf, isEmergency, isSeedTicket, loadCatalog, statusPill,
} from './staff.js?v=17';

export { isEmergency, isSeedTicket };
const deptPill = (cat, r) => deptPillOf(cat, r.department_id);

export const isEscalatedSafety = (r) => !!(r.blocker && r.blocker.code === 'SAFETY_REVIEW_REQUIRED' && (r.escalated || r.status === 'SAFETY_REVIEW_REQUIRED'));
export const needsBql = (r) => isEmergency(r) || r.status === 'READY_FOR_REVIEW' || r.blocker_owner_role === 'BQL' || isEscalatedSafety(r);
// Q36: the four stat cards are the filters (no NavTiles row); the last one keeps only finished tickets.
const STATS = [
  ['mine', 'Cần BQL', needsBql], ['emergency', 'Khẩn cấp', isEmergency], ['overdue', 'Quá hạn', (r) => r.overdue],
  ['done', 'Hoàn thành', (r) => r.status === 'CLOSED'],
];
// Q40: one box per ticket, first match in this order — a Bậc 1 ticket is only in "Khẩn cấp", "Quá hạn" keeps what no other box took
const TEST = Object.fromEntries(STATS.map(([key, , test]) => [key, test]));
const boxOfRow = boxOf(['emergency', 'mine', 'done', 'overdue'].map((key) => [key, TEST[key]]));
const HEAD = {
  mine: ['Việc cần Ban quản lý', 'Nghiệm thu và ticket an toàn đã leo thang (khẩn cấp Bậc 1 ở ô riêng).'],
  emergency: ['Sự cố khẩn cấp', 'Ticket Bậc 1 đang chờ Ban quản lý xử lý.'],
  overdue: ['Phản ánh quá hạn', 'Vướng mắc đã leo thang hoặc quá giờ xử lý.'],
  done: ['Phản ánh đã hoàn thành', 'Ticket đã nghiệm thu và đóng (ẩn ticket mẫu).'],
};

let tab = 'mine'; // kept while the app is open
let emergencies = 0; // from the last list load
/** The header bell (Khẩn cấp + Cần BQL) opens "Khẩn cấp" while there is one, else "Cần BQL". */
export function focusMine() { tab = emergencies ? 'emergency' : 'mine'; }


// ---------------------------------------------------------------- #/b

function rowItem(cat) {
  return (r) => el('a', { class: `card bitem ${isEmergency(r) ? 'urgent' : ''}`, href: `#/b/${encodeURIComponent(r.ticket_id)}`, dataset: { ticket: r.ticket_id } },
    el('span', { class: 'trow' }, el('b', {}, r.ticket_id), statusPill(r)),
    el('span', { class: 'tmeta' }, [formatTime(r.created_at), r.priority ? `Ưu tiên ${PRIORITY_LABEL[r.priority] || r.priority}` : null].filter(Boolean).join(' · ')),
    el('span', { class: 'pills' }, deptPill(cat, r), flags(r)));
}

export async function list(ctx) {
  const statsBox = el('div', { class: 'stats', id: 'bql-tabs', role: 'toolbar' });
  const head = el('div');
  const body = el('div', { id: 'bql-list' });
  let rows = [];
  let cat = null;
  const draw = (keep) => {
    const inBox = (key) => rows.filter((r) => boxOfRow(r) === key);
    emergencies = inBox('emergency').length;
    ctx.counts({ bell: emergencies + inBox('mine').length });
    fill(statsBox, STATS.map(([key, label]) => el('button', {
      type: 'button', class: key === tab ? 'card stat pick on' : 'card stat pick', dataset: { tab: key }, 'aria-pressed': String(key === tab),
      onclick: () => { tab = key; draw(false); },
    }, el('span', {}, label), el('b', {}, String(inBox(key).length)))));
    fill(head, pageHead(HEAD[tab][0], HEAD[tab][1], { right: refreshButton(load, ctx) }));
    const previous = keep ? body.firstElementChild : null;
    fill(body, pagedList(inBox(tab), rowItem(cat), {
      empty: tab === 'mine' ? 'Không có việc nào cần BQL xử lý.' : 'Không có phản ánh nào.', keep: previous,
    }));
  };
  const load = async () => {
    const [all, catalogView] = await Promise.all([api('/bql/tickets'), loadCatalog().catch(() => null)]);
    if (!ctx.alive()) return;
    rows = all.filter((r) => !isSeedTicket(r.ticket_id)); // server order: emergencies first
    cat = catalogView;
    draw(true);
    ctx.updatedNow();
  };
  ctx.chrome();
  ctx.screen.append(statsBox, head, el('div', { class: 'updated', dataset: { updated: '' } }), body);
  await load();
  ctx.setLoader(load);
}

// ---------------------------------------------------------------- #/b/<id>

export async function detail(ctx) {
  const [id] = ctx.params;
  ctx.chrome();
  const images = new Map();
  const live = el('div', { id: 'bql-detail' });
  const actions = el('div', { id: 'bql-actions', class: 'actions-col' });
  ctx.screen.append(pageHead('Chi tiết phản ánh', null, { back: '#/b' }), el('div', { class: 'updated', dataset: { updated: '' } }), live);

  const photoStrip = (title, ids) => {
    if (!ids.length) return null;
    const strip = el('div', { class: 'thumbs' });
    for (const evidenceId of ids) {
      const img = el('img', { alt: title });
      const link = el('a', { target: '_blank', rel: 'noopener' }, img);
      strip.append(link);
      const show = (url) => { img.src = url; link.href = url; };
      if (images.has(evidenceId)) { show(images.get(evidenceId)); continue; }
      apiImage(`/mo/tickets/${encodeURIComponent(id)}/photos/${encodeURIComponent(evidenceId)}`)
        .then((url) => { images.set(evidenceId, ctx.trackUrl(url)); show(url); })
        .catch(() => { img.alt = 'Không tải được ảnh'; });
    }
    return el('div', { class: 'box' }, el('span', { class: 'cap' }, title.toUpperCase()), strip);
  };

  const draw = (c, row, cat) => {
    if (!ctx.alive()) return;
    const t = c.ticket;
    const draftId = c.draft && c.draft.work_order_draft_id;
    fill(live, el('section', { class: 'card pad detail' },
      el('div', { class: 'trow' }, el('b', { class: 'code' }, t.ticket_id), statusPill(row)),
      el('span', { class: 'muted small' }, `Gửi lúc ${formatTime(row.created_at)}`),
      el('div', { class: 'pills' }, deptPill(cat, row), flags(row)),
      row.blocker ? notice(`${REASON_LABEL[row.blocker.code] || row.blocker.code}: ${row.blocker.public_message}`,
        isEmergency(row) || isEscalatedSafety(row) ? 'danger' : 'pause', { id: 'bql-blocker' }) : null,
      infoGrid([
        ['Phòng ban', row.department_id ? deptName(cat, row.department_id) : 'Chưa giao'],
        ['Ưu tiên', row.priority ? PRIORITY_LABEL[row.priority] || row.priority : null],
        ['Đã làm lại', row.rework_count ? `${row.rework_count} lần` : null],
        ['Lý do hủy', row.cancel_reason],
      ]),
      actions,
      el('div', { class: 'box' }, el('span', { class: 'cap' }, 'NỘI DUNG PHẢN ÁNH'),
        el('p', { class: 'pre body' }, t.raw.original_description),
        c.additions.length ? el('ul', { class: 'extras' }, c.additions.map((a) => el('li', {}, `${formatTime(a.submitted_at)}: ${a.content}`))) : null),
      photoStrip('Ảnh cư dân gửi', imagesOf(c, 'RESIDENT_ORIGINAL')),
      photoStrip('Ảnh phòng ban (lượt hiện tại)', imagesOf(c, 'DEPARTMENT_EXECUTION', (e) => e.work_order_draft_id === draftId)),
      history('Diễn biến gần đây', c.events.slice(-20).reverse().map((e) => ({
        label: (cat && cat.status_labels[e.to_status]) || e.to_status, note: e.public_message, time: formatTime(e.created_at),
      }))),
      el('a', { class: 'btn block', href: '/ui/', target: '_blank', rel: 'noopener' }, icon('web'), 'Mở bản web đầy đủ')));
    drawActions(row);
    ctx.updatedNow();
  };

  /** Ask, send, then reload from the server (I-2). */
  const act = async ({ confirm, call, success }) => {
    if (confirm && !(await confirmSheet(confirm.title, confirm.body, { confirmLabel: confirm.label, danger: confirm.danger }))) return;
    try {
      await call();
      toast(success);
    } catch (err) {
      ctx.fail(err, { back: '#/b' });
      if (err.kind === 'not_found') return;
    }
    await load().catch((err) => ctx.fail(err, { back: '#/b' }));
  };
  const post = (rest, body) => () => api(`/bql/tickets/${encodeURIComponent(id)}${rest}`, { method: 'POST', body });
  const noteBox = (attrs) => el('textarea', { class: 'field', rows: 2, maxlength: '500', ...attrs });

  const drawActions = (row) => {
    const blocks = [];
    if (isEmergency(row)) {
      const note = noteBox({ id: 'emergency-note', placeholder: 'Ghi chú xử lý / lý do báo động giả' });
      blocks.push(el('div', { class: 'act-box danger', id: 'emergency-actions' }, el('b', {}, 'Sự cố khẩn cấp (Bậc 1)'),
        field('Ghi chú', note),
        writeButton('Đã xử lý — đóng phản ánh', () => act({
          confirm: { title: 'Đóng phản ánh khẩn cấp?', body: 'Xác nhận sự cố đã được xử lý ngoài hệ thống.', label: 'Đóng phản ánh' },
          call: post('/emergency/close', { note: note.value.trim() || null }), success: 'Đã xử lý và đóng ticket khẩn cấp',
        }), { variant: 'danger-solid' }),
        writeButton('Báo động giả — hạ mức', () => {
          if (!note.value.trim()) { toast('Nhập lý do hạ mức', 'warn'); return undefined; }
          return act({
            confirm: { title: 'Hạ mức khẩn cấp?', body: 'Ticket quay lại luồng thường cho BPTN.', label: 'Hạ mức' },
            call: post('/emergency/downgrade', { note: note.value.trim() }), success: 'Đã hạ mức khẩn cấp về BPTN',
          });
        }, { variant: '' })));
    }
    if (isEscalatedSafety(row)) {
      // Q38: same three decisions as the BPTN app (POST /mo/tickets/{id}/safety); the engine lets BQL decide once escalated
      const safety = (decision, note, success, confirm) => act({
        confirm, call: () => api(`/mo/tickets/${encodeURIComponent(id)}/safety`, { method: 'POST', body: note ? { decision, note } : { decision } }), success,
      });
      const safeNote = noteBox({ id: 'safety-safe-note', placeholder: 'Đã kiểm tra hiện trường, không nguy hiểm vì…' });
      const askNote = noteBox({ id: 'safety-ask-note', placeholder: 'Nội dung hỏi cư dân' });
      const upNote = noteBox({ id: 'safety-up-note', placeholder: 'Lý do nâng mức (không bắt buộc)' });
      blocks.push(el('div', { class: 'act-box danger', id: 'bql-safety' }, el('b', {}, 'Kiểm tra an toàn (Bậc 2) đã leo thang'),
        el('span', { class: 'muted' }, 'Xác minh rồi chọn một trong ba quyết định.'),
        field('Xác nhận an toàn', safeNote),
        writeButton('Xác nhận an toàn', () => {
          if (!safeNote.value.trim()) { toast('Nhập lý do xác nhận an toàn', 'warn'); return undefined; }
          return safety('CONFIRM_SAFE', safeNote.value.trim(), 'Đã xác nhận an toàn, phản ánh chạy tiếp');
        }),
        field('Yêu cầu cư dân làm rõ', askNote),
        writeButton('Yêu cầu cư dân bổ sung', () => {
          if (!askNote.value.trim()) { toast('Nhập nội dung hỏi cư dân', 'warn'); return undefined; }
          return safety('REQUEST_INFO', askNote.value.trim(), 'Đã gửi yêu cầu bổ sung tới cư dân');
        }, { variant: '' }),
        field('Nâng mức Khẩn cấp (Bậc 1)', upNote),
        writeButton('Nâng lên Khẩn cấp (Bậc 1)', () => safety('ESCALATE', upNote.value.trim(), 'Đã nâng lên Khẩn cấp Bậc 1',
          { title: 'Nâng lên Khẩn cấp Bậc 1?', body: 'Phản ánh chuyển thành sự cố khẩn cấp, Ban quản lý xử lý ngay.', label: 'Nâng mức', danger: true }),
        { variant: 'danger-solid' })));
    }
    if (row.status === 'READY_FOR_REVIEW') {
      const note = noteBox({ id: 'rework-note', placeholder: 'Nêu rõ lý do chưa đạt yêu cầu…' });
      const third = row.rework_count >= 2;
      blocks.push(el('div', { class: 'act-box accept', id: 'review-actions' },
        el('b', {}, 'Phòng ban báo đã xử lý xong. Kiểm tra và nghiệm thu.'),
        writeButton('Nghiệm thu — đạt', () => act({ call: post('/close', {}), success: 'Đã nghiệm thu' }), { busyLabel: 'Đang nghiệm thu…' }),
        field('Lý do trả làm lại', note, third ? `Đã làm lại ${row.rework_count} lần — trả lần này sẽ bật cờ leo thang.` : null),
        writeButton('Trả làm lại', () => {
          if (!note.value.trim()) { toast('Nhập lý do trả làm lại', 'warn'); return undefined; }
          return act({
            confirm: { title: 'Trả làm lại?', body: third ? 'Đây là lần trả thứ 3: ticket sẽ được đánh dấu leo thang.' : 'Phòng ban sẽ làm lại.', label: 'Trả làm lại', danger: third },
            call: post('/rework', { note: note.value.trim() }), success: 'Đã trả làm lại',
          });
        }, { variant: '' })));
    }
    if (!TERMINAL.has(row.status)) {
      const reason = noteBox({ id: 'cancel-reason', placeholder: 'Lý do hủy' });
      blocks.push(el('div', { class: 'act-box plain' }, el('b', {}, 'Hủy phản ánh'), reason,
        writeButton('Hủy phản ánh', () => {
          if (!reason.value.trim()) { toast('Nhập lý do hủy', 'warn'); return undefined; }
          return act({
            confirm: { title: 'Hủy phản ánh này?', body: 'Thao tác không hoàn tác được.', label: 'Hủy phản ánh', danger: true },
            call: post('/cancel', { cancel_reason: reason.value.trim() }), success: 'Đã hủy phản ánh',
          });
        }, { variant: 'danger' })));
    }
    fill(actions, blocks);
  };

  const load = async () => {
    const [c, rows, cat] = await Promise.all([
      api(`/mo/tickets/${encodeURIComponent(id)}`), api('/bql/tickets'), loadCatalog().catch(() => null)]);
    const row = rows.find((r) => r.ticket_id === id);
    if (!row) throw Object.assign(new Error('Không còn thấy phản ánh này'), { kind: 'not_found' });
    draw(c, row, cat);
  };
  try {
    await load();
  } catch (err) {
    if (err.kind === 'not_found') { ctx.fail(err, { back: '#/b' }); return; }
    fill(live, emptyState(err.message));
    throw err;
  }
  ctx.setLoader(load);
}

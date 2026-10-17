// Department screens (Phòng ban Vệ sinh / Kỹ thuật) — plan 11 SPEC-P05 §2. Same endpoints and rules as
// renderDepartment / workSections in src/web/app.js; photos first because the field team works from the phone (Q28).
import { ackStockAlert, api, apiForm, listStockAlerts, reportMaterialShortage } from './api.js?v=19';
import { MAX_PHOTOS, photoFormData, photoPicker } from './photo.js?v=19';
import { confirmSheet, el, field, fill, icon, notice, pill, toast, writeButton } from './ui.js?v=19';
import {
  REASON_LABEL, caseHead, caseScreen, checklistLabel, codeOf, eventsHistory, executionPhotoIds, imagesOf, materialName,
  materialUnit, photoBox, photoStrip, queueScreen, reportBox, select, writer,
} from './staff.js?v=19';

const MAX_EXECUTION_PHOTOS = 10; // src/maintenance/engine.py
const TILES = [
  ['todo', 'Chờ nhận', 'briefcase', (t) => t.status === 'ROUTED'],
  ['doing', 'Đang làm', 'clipboard', (t) => t.status === 'IN_PROGRESS' || t.status === 'ON_HOLD'],
  ['review', 'Chờ nghiệm thu', 'checkSquare', (t) => t.status === 'READY_FOR_REVIEW'],
  ['done', 'Hoàn thành', 'table', (t) => t.status === 'CLOSED'], // Q35: archive keeps only finished work
];
const HEADS = {
  todo: ['Việc chờ nhận', 'Phản ánh đã giao cho phòng ban, chưa có người nhận.'],
  doing: ['Việc đang làm', 'Chụp ảnh sau xử lý, tick checklist, ghi vật tư rồi báo hoàn thành.'],
  review: ['Chờ nghiệm thu', 'Đã báo hoàn thành, đang chờ Ban quản lý nghiệm thu.'],
  done: ['Việc đã hoàn thành', 'Phản ánh đã được Ban quản lý nghiệm thu và đóng.'],
};
let tab = 'todo';
/** The header bell opens the list and scrolls to "Thông báo kho" (plan 24 SPEC-P03 §2). */
let showAlerts = false;
export function focusQueue() { tab = 'todo'; showAlerts = true; }
const tabState = { get: () => tab, set: (key) => { tab = key; } };

// ---------------------------------------------------------------- warehouse alerts (plan 24)

/** Text of one restock alert: "Kho đã nhập <tên> +<số>" and, per ticket it names, "Đã chạy tiếp" / "Vẫn thiếu". */
export function alertText(alert) {
  const unit = materialUnit(alert.item_code, alert.unit);
  return {
    title: `Kho đã nhập ${materialName(alert.item_code, alert.item_name)} +${alert.qty_added} ${unit}`,
    stock: `Tồn hiện có ${alert.qty_after} ${unit}`,
    tickets: (alert.tickets || []).map((t) => ({ id: t.ticket_id, state: t.waiting ? 'Vẫn thiếu' : 'Đã chạy tiếp', waiting: t.waiting })),
  };
}

function alertsPanel(alerts, onAck) {
  return [
    el('h2', {}, `Thông báo kho (${alerts.length})`),
    el('ul', { class: 'stock-list' }, alerts.map((alert) => {
      const text = alertText(alert);
      const ack = writeButton('Đã xem', () => onAck(alert), { variant: '', block: false, busyLabel: 'Đang gửi…' });
      ack.dataset.ack = alert.alert_id;
      return el('li', { dataset: { alert: alert.alert_id } },
        el('div', {}, el('b', {}, text.title), el('small', {}, text.stock),
          text.tickets.map((t) => el('small', {}, el('a', { href: `#/d/${encodeURIComponent(t.id)}` }, t.id), ` · ${t.state}`))),
        ack);
    })),
  ];
}

export async function list(ctx) {
  let unread = 0;
  const panel = el('section', { class: 'card pad', id: 'dept-alerts', hidden: true });
  const refreshAlerts = async () => {
    let alerts = [];
    try {
      alerts = await listStockAlerts({ unread: true });
    } catch (err) {
      if (err.kind === 'auth') return; // a failing alert feed never breaks the work list
    }
    if (!ctx.alive()) return;
    unread = alerts.length;
    panel.hidden = !alerts.length;
    fill(panel, alertsPanel(alerts, async (alert) => {
      try { await ackStockAlert(alert.alert_id); } catch (err) { ctx.fail(err); }
      await refreshAlerts();
    }));
    ctx.counts({ bell: unread });
    const bell = document.querySelector('#topbar .bell');
    if (bell) bell.setAttribute('aria-label', 'Thông báo kho');
  };
  // the work list sets the bell to its own count: the bell of a department counts unread warehouse alerts instead
  const view = {
    ...ctx,
    counts: (counts) => ctx.counts({ ...counts, bell: unread }),
    setLoader: (loader) => ctx.setLoader(async () => { await Promise.all([loader(), refreshAlerts()]); }),
  };
  ctx.screen.append(panel);
  await queueScreen(view, { tiles: TILES, tab: tabState, heads: HEADS, base: '#/d', empty: 'Không có việc nào ở mục này.' });
  await refreshAlerts();
  if (showAlerts) {
    showAlerts = false;
    if (!panel.hidden) panel.scrollIntoView({ block: 'start' });
  }
}

// ---------------------------------------------------------------- readiness (src/web/app.js failingLabel / computeReadinessPrecheck)

/** Q42 + plan 16 §U1: the materials count only once the department saved them (material-usage, or an older
 * material-plan / saved quantities); the Agent's step-7 plan is neither shown nor counted. */
const deptChoseMaterials = (c) => (c.audit || []).some((a) => a.field_name === 'material_usage' || a.field_name === 'planned_materials')
  || c.material_lines.some((l) => l.issued_qty != null);
/** Saved and complete: every line issued = used; Kỹ thuật needs at least one line (plan 16 §C3). */
const materialsSaved = (c) => deptChoseMaterials(c)
  && c.material_lines.every((l) => l.issued_qty != null && l.used_qty != null)
  && (c.material_lines.length > 0 || c.ticket.department_id === 'DEPT_CLEANING');

function failingLabel(c, item) {
  const line = c.material_lines.find((l) => l.material_line_id === item);
  if (item === 'material_required') return 'chưa chọn vật tư sử dụng';
  if (item === 'material_invalid') return 'vật tư đã lưu không hợp lệ — chọn lại và bấm Lưu vật tư';
  if (line) {
    const name = materialName(line.item_code, line.item_name);
    return line.issued_qty == null || line.used_qty == null ? 'chưa chọn vật tư sử dụng' : `số đã dùng khác số đã xuất kho của "${name}" — bấm Lưu vật tư lại`;
  }
  const check = c.checklist_items.find((i) => i.template_item_id === item);
  if (check) return `chưa đánh dấu "${checklistLabel(check)}"`;
  if (c.draft.evidence_requirements.some((r) => r.requirement_id === item)) return 'chưa lưu ghi chú xử lý';
  if (item === 'execution_photo') return 'chưa có ảnh sau khi xử lý';
  if (item.startsWith('blocker:')) return `còn vướng "${REASON_LABEL[item.slice(8)] || item.slice(8)}"`;
  return item;
}

function precheck(c) {
  const items = c.checklist_items || [];
  const done = items.filter((i) => i.status === 'COMPLETED').length;
  const entered = materialsSaved(c);
  const photos = executionPhotoIds(c).length;
  const rows = [
    [`Checklist (${done}/${items.length})`, done === items.length],
    ['Đã chọn vật tư sử dụng', entered],
    [`Ảnh sau khi xử lý (${photos} ảnh)`, photos >= 1],
    ['Không còn vướng mắc', !c.ticket.blocker],
  ];
  return { rows, ready: rows.every(([, ok]) => ok), missing: rows.filter(([, ok]) => !ok).map(([label]) => label) };
}

const localToIso = (value) => (value ? new Date(value).toISOString() : null);

// ---------------------------------------------------------------- #/d/<id>

export async function detail(ctx) {
  const photoCache = new Map();
  let reload = async () => {};
  const run = writer(ctx, '#/d', () => reload);
  const post = (id, rest, body) => () => api(`/mo/tickets/${encodeURIComponent(id)}${rest}`, { method: 'POST', body });

  const photoBlock = (c) => {
    const id = c.ticket.ticket_id;
    const have = executionPhotoIds(c);
    const room = Math.min(MAX_PHOTOS, MAX_EXECUTION_PHOTOS - have.length);
    const picker = room > 0 ? photoPicker({ room: () => room }) : null;
    return el('div', { class: 'act-box accept', id: 'dept-photos' },
      el('b', { class: 'big' }, 'Ảnh sau khi xử lý · bắt buộc'),
      have.length ? photoStrip(ctx, id, have, photoCache, 'Ảnh sau xử lý') : el('span', { class: 'muted' }, 'Chưa có ảnh. Cần ít nhất 1 ảnh trước khi báo hoàn thành.'),
      picker ? picker.node : el('span', { class: 'muted' }, `Đã đủ ${MAX_EXECUTION_PHOTOS} ảnh.`),
      picker ? writeButton('Tải ảnh lên', async () => {
        if (!picker.hasPhotos()) { ctx.fail({ kind: 'invalid', message: 'Chụp hoặc chọn ít nhất một ảnh' }); return; }
        await run(() => apiForm(`/mo/tickets/${encodeURIComponent(id)}/photos`, photoFormData(picker.blobs())), 'Đã tải ảnh lên');
      }, { busyLabel: 'Đang tải ảnh…' }) : null);
  };

  const checklistBlock = (c) => {
    const id = c.ticket.ticket_id;
    return el('div', { class: 'act-box', id: 'dept-checklist' }, el('b', {}, 'Danh mục kiểm tra'),
      c.checklist_items.map((item) => {
        const box = el('input', { type: 'checkbox', id: `chk-${item.template_item_id}`, checked: item.status === 'COMPLETED', dataset: { write: '' } });
        box.addEventListener('change', async () => {
          box.disabled = true;
          await run(post(id, `/checklist/${encodeURIComponent(item.template_item_id)}`, { status: box.checked ? 'COMPLETED' : 'PENDING' }), 'Đã cập nhật checklist');
        });
        return el('label', { class: 'check-row', for: box.id }, box, el('span', {}, checklistLabel(item)));
      }));
  };

  // Q41 + Q42 + plan 16 §U1-U3: ONE block where the department picks the materials really used and how many — the
  // Agent's plan is neither shown nor pre-filled. Vệ sinh may tick "Không sử dụng vật tư". Save = ONE POST material-usage
  // with the whole selection (issued = used, one transaction). No reason box: the norm and the Agent's plan never block.
  const materialsBlock = (c, cat) => {
    const id = c.ticket.ticket_id;
    const cleaning = c.ticket.department_id === 'DEPT_CLEANING';
    const chose = deptChoseMaterials(c);
    const lines = chose ? c.material_lines : [];
    const noneChosen = chose && !lines.length;
    const saved = materialsSaved(c);
    const byDept = cat && cat.material_codes_by_department;
    const allowed = new Set((byDept && byDept[c.ticket.department_id]) || []);
    const options = ((cat && cat.materials) || []).filter((m) => allowed.has(m.item_code)).map((m) => [m.item_code, materialName(m.item_code, m.item_name)]);
    const rows = el('div', { class: 'plan-rows', id: 'dept-material-rows' });
    const addRow = (code = '', qty = 1) => {
      const qtyBox = el('input', { class: 'field qty', type: 'number', inputmode: 'numeric', min: '1', step: '1', value: String(qty), 'aria-label': 'Số lượng đã dùng' });
      const row = el('div', { class: 'plan-row' }, select(options, { placeholder: 'Chọn vật tư…', value: code }), qtyBox,
        el('button', { type: 'button', class: 'btn', onclick: () => row.remove() }, 'Bỏ'));
      rows.append(row);
    };
    lines.forEach((line) => addRow(line.item_code, line.used_qty ?? line.planned_qty));
    if (!lines.length) addRow();
    const add = el('button', { type: 'button', class: 'btn block', id: 'dept-material-add', onclick: () => addRow() }, '+ Thêm vật tư');
    const none = cleaning ? el('input', { type: 'checkbox', id: 'dept-no-material', checked: noneChosen }) : null;
    const showRows = () => { rows.hidden = add.hidden = !!(none && none.checked); };
    if (none) none.addEventListener('change', showRows);
    showRows();
    const invalid = (message) => ctx.fail({ kind: 'invalid', message });

    const save = writeButton('Lưu vật tư', async () => {
      let chosen = [];
      if (!(none && none.checked)) {
        chosen = [...rows.children].map((row, i) => ({ row: i + 1, item_code: row.querySelector('select').value, used_qty: Number(row.querySelector('input').value) }));
        if (!chosen.length || chosen.every((l) => !l.item_code)) { invalid(cleaning ? 'Chọn vật tư hoặc đánh dấu "Không sử dụng vật tư"' : 'Chọn ít nhất một vật tư'); return; }
        const empty = chosen.find((l) => !l.item_code);
        if (empty) { invalid(`Dòng ${empty.row}: chọn vật tư hoặc bấm "Bỏ"`); return; }
        const bad = chosen.find((l) => !(Number.isInteger(l.used_qty) && l.used_qty > 0));
        if (bad) { invalid(`Dòng ${bad.row}: số lượng phải là số nguyên lớn hơn 0`); return; }
        const twice = chosen.find((l, i) => chosen.findIndex((o) => o.item_code === l.item_code) !== i);
        if (twice) { invalid(`Dòng ${twice.row}: mỗi vật tư chỉ chọn một dòng`); return; }
      }
      // §U3: an error keeps what was typed (no reload, no automatic retry); success reloads the case from the server
      try {
        await post(id, '/material-usage', { lines: chosen.map(({ item_code, used_qty }) => ({ item_code, used_qty })) })();
      } catch (err) {
        ctx.fail(err, { back: '#/d' });
        return;
      }
      toast(chosen.length ? 'Đã lưu vật tư' : 'Đã lưu: không sử dụng vật tư');
      await reload().catch((err) => ctx.fail(err, { back: '#/d' }));
    });
    save.id = 'dept-material-save';
    if (!byDept) { // §U2: an older server has no per-department list — never fall back to every item
      delete save.dataset.write; // or applyOnline() would enable it again on every render
      save.disabled = true;
    }

    const box = el('div', { class: 'act-box', id: 'dept-materials' },
      el('div', { class: 'trow' }, el('b', {}, 'Vật tư sử dụng'), pill(saved ? 'st-dang_xu_ly' : 'st-moi', saved ? 'Đã lưu' : 'Chưa lưu', { dot: false })),
      el('span', { class: 'muted small' }, cleaning ? 'Chọn vật tư đã dùng, hoặc đánh dấu không sử dụng vật tư.' : 'Chọn vật tư đã dùng và số lượng.'),
      byDept ? null : notice('Máy chủ chưa hỗ trợ lưu vật tư theo phòng ban — cần cập nhật máy chủ.', 'danger'),
      c.ticket.flags.includes('ASSET_CHECK_ONSITE') ? notice('Chưa xác định được thiết bị: kiểm tra thực tế rồi chọn đúng vật tư.', 'pause') : null,
      none ? el('label', { class: 'check-row', for: 'dept-no-material' }, none, el('span', {}, 'Không sử dụng vật tư')) : null,
      rows, add, save);
    // §U3: a choice not saved yet (or kept after an error) pauses the 30 s refresh — screenIsDirty() ignores selects
    const dirty = () => { box.dataset.dirty = '1'; };
    box.addEventListener('input', dirty);
    box.addEventListener('change', dirty);
    add.addEventListener('click', dirty);
    rows.addEventListener('click', (event) => { if (event.target.closest('button')) dirty(); });
    return box;
  };

  // Plan 24 SPEC-P03 §2: ONE tap to tell the warehouse what is still missing (POST material-shortage). Rows = materials of
  // this department + whole quantity ON TOP of what it took. A refusal (409 GUARD_FAILED, e.g. the warehouse has enough)
  // is shown as the server wrote it and the typed rows stay; success reloads the case (it now waits for material).
  const shortageBlock = (c, cat) => {
    const id = c.ticket.ticket_id;
    const byDept = cat && cat.material_codes_by_department;
    const allowed = new Set((byDept && byDept[c.ticket.department_id]) || []);
    const options = ((cat && cat.materials) || []).filter((m) => allowed.has(m.item_code)).map((m) => [m.item_code, materialName(m.item_code, m.item_name)]);
    const rows = el('div', { class: 'plan-rows', id: 'dept-shortage-rows' });
    const addRow = () => {
      const qtyBox = el('input', { class: 'field qty', type: 'number', inputmode: 'numeric', min: '1', step: '1', value: '1', 'aria-label': 'Số lượng cần thêm' });
      const row = el('div', { class: 'plan-row' }, select(options, { placeholder: 'Chọn vật tư…' }), qtyBox,
        el('button', { type: 'button', class: 'btn', onclick: () => row.remove() }, 'Bỏ'));
      rows.append(row);
    };
    addRow();
    const add = el('button', { type: 'button', class: 'btn block', id: 'dept-shortage-add', onclick: () => addRow() }, '+ Thêm vật tư');
    const note = el('textarea', { class: 'field', id: 'dept-shortage-note', rows: 2, maxlength: '500', placeholder: 'Ghi chú (tuỳ chọn)' });
    const invalid = (message) => ctx.fail({ kind: 'invalid', message });
    const send = writeButton('Gửi báo thiếu', async () => {
      const chosen = [...rows.children].map((row, i) => ({ row: i + 1, item_code: row.querySelector('select').value, planned_qty: Number(row.querySelector('input').value) }));
      if (!chosen.length || chosen.every((l) => !l.item_code)) { invalid('Chọn ít nhất một vật tư còn thiếu'); return; }
      const empty = chosen.find((l) => !l.item_code);
      if (empty) { invalid(`Dòng ${empty.row}: chọn vật tư hoặc bấm "Bỏ"`); return; }
      const bad = chosen.find((l) => !(Number.isInteger(l.planned_qty) && l.planned_qty > 0));
      if (bad) { invalid(`Dòng ${bad.row}: số lượng phải là số nguyên lớn hơn 0`); return; }
      const twice = chosen.find((l, i) => chosen.findIndex((o) => o.item_code === l.item_code) !== i);
      if (twice) { invalid(`Dòng ${twice.row}: mỗi vật tư chỉ chọn một dòng`); return; }
      try {
        await reportMaterialShortage(id, chosen.map(({ item_code, planned_qty }) => ({ item_code, planned_qty })), note.value.trim());
      } catch (err) {
        ctx.fail(err, { back: '#/d' }); // the server's words, input kept
        if (err.kind === 'conflict' && err.code === 'INVALID_TRANSITION') await reload().catch((e) => ctx.fail(e, { back: '#/d' }));
        return;
      }
      toast('Đã báo kho — phiếu vật tư đã tạo');
      await reload().catch((err) => ctx.fail(err, { back: '#/d' }));
    }, { variant: 'danger', busyLabel: 'Đang gửi…' });
    send.id = 'dept-shortage-send';
    if (!byDept) { delete send.dataset.write; send.disabled = true; } // an older server has no per-department list
    const box = el('details', { class: 'more', id: 'dept-shortage' }, el('summary', {}, 'Báo thiếu vật tư'),
      el('div', { class: 'more-body' },
        el('span', { class: 'muted small' }, 'Chọn vật tư còn thiếu và số lượng cần THÊM. Kho sẽ thấy phiếu vật tư ngay.'),
        rows, add, note, send));
    const dirty = () => { box.dataset.dirty = '1'; };
    box.addEventListener('input', dirty);
    box.addEventListener('change', dirty);
    add.addEventListener('click', dirty);
    return box;
  };

  const noteBlock = (c) => {
    const requirement = c.draft && c.draft.evidence_requirements[0];
    if (!requirement) return null;
    const text = el('textarea', { class: 'field', id: 'dept-note', rows: 3, maxlength: '1000', placeholder: 'Ghi ngắn gọn việc đã làm' });
    return el('div', { class: 'act-box', id: 'dept-report' },
      el('b', {}, `Ghi chú xử lý${requirement.validation_status === 'PRESENT' ? ' · đã có' : ''}`), text,
      writeButton('Lưu ghi chú', async () => {
        if (!text.value.trim()) { ctx.fail({ kind: 'invalid', message: 'Nhập ghi chú xử lý' }); return; }
        await run(post(c.ticket.ticket_id, '/evidence', {
          requirement_id: requirement.requirement_id, evidence_type: requirement.allowed_evidence_types[0], content_or_metadata: text.value.trim(),
        }), 'Đã lưu ghi chú');
      }, { variant: '' }));
  };

  const completeBlock = (c) => {
    const check = precheck(c);
    const button = writeButton('Báo hoàn thành', async () => {
      if (!check.ready && !(await confirmSheet('Chưa đủ điều kiện hoàn thành', `Còn thiếu:\n• ${check.missing.join('\n• ')}\n\nVẫn nộp để Agent đối soát?`, { confirmLabel: 'Vẫn nộp' }))) return;
      await run(post(c.ticket.ticket_id, '/complete'), (result) => (result && result.ticket && result.ticket.status === 'READY_FOR_REVIEW'
        ? 'Đã báo hoàn thành — chờ BQL nghiệm thu' : 'Chưa đủ điều kiện — xem mục còn thiếu'));
    }, { busyLabel: 'Đang đối soát…' });
    button.id = 'dept-complete';
    return el('div', { class: `act-box ${check.ready ? 'accept' : 'warn'}`, id: 'dept-precheck' },
      el('b', {}, check.ready ? 'Sẵn sàng báo hoàn thành' : `Còn thiếu ${check.missing.length} điều kiện`),
      el('div', { class: 'checks' }, check.rows.map(([label, ok]) => el('div', { class: ok ? 'chk ok' : 'chk' }, el('span', { class: 'bx' }, icon('check', 12)), label))),
      button);
  };

  const troubleBlock = (c) => {
    const id = c.ticket.ticket_id;
    const blockNote = el('textarea', { class: 'field', rows: 2, maxlength: '500', placeholder: 'Lý do tạm hoãn' });
    const eta = el('input', { class: 'field', type: 'datetime-local', 'aria-label': 'Dự kiến tiếp tục' });
    const wrongNote = el('textarea', { class: 'field', rows: 2, maxlength: '500', placeholder: 'Lý do không thuộc phòng ban' });
    return el('div', { class: 'actions-col' },
      el('details', { class: 'more' }, el('summary', {}, 'Vướng tại hiện trường?'),
        el('div', { class: 'more-body' }, blockNote, field('Dự kiến tiếp tục', eta),
          writeButton('Tạm hoãn', async () => {
            if (!blockNote.value.trim() || !eta.value) { ctx.fail({ kind: 'invalid', message: 'Nhập lý do và giờ dự kiến tiếp tục' }); return; }
            await run(post(id, '/block', { note: blockNote.value.trim(), eta: localToIso(eta.value) }), 'Đã tạm hoãn');
          }, { variant: 'danger' }))),
      el('details', { class: 'more' }, el('summary', {}, 'Báo sai phòng ban?'),
        el('div', { class: 'more-body' }, wrongNote,
          writeButton('Báo sai phòng ban', async () => {
            if (!wrongNote.value.trim()) { ctx.fail({ kind: 'invalid', message: 'Nhập lý do' }); return; }
            await run(post(id, '/return', { note: wrongNote.value.trim() }), 'Đã gửi báo sai phòng ban');
          }, { variant: 'danger' }))));
  };

  const actionsFor = (c, cat) => {
    const t = c.ticket;
    const id = t.ticket_id;
    if (t.status === 'ROUTED') {
      const note = el('textarea', { class: 'field', rows: 2, maxlength: '500', placeholder: 'Lý do trả lại' });
      const accept = writeButton('Nhận việc', () => run(post(id, '/accept'), 'Đã nhận việc'), { busyLabel: 'Đang nhận…' });
      accept.id = 'dept-accept';
      return [accept, el('details', { class: 'more' }, el('summary', {}, 'Không thuộc phòng ban của bạn?'),
        el('div', { class: 'more-body' }, note, writeButton('Trả lại cho BPTN', async () => {
          if (!note.value.trim()) { ctx.fail({ kind: 'invalid', message: 'Nhập lý do trả lại' }); return; }
          await run(post(id, '/return', { note: note.value.trim() }), 'Đã trả lại');
        }, { variant: 'danger' })))];
    }
    if (t.status === 'IN_PROGRESS') {
      const readiness = c.draft && c.draft.readiness_evaluation;
      return [
        readiness && readiness.failing_items && readiness.failing_items.length
          ? notice(`Lần báo hoàn thành trước còn thiếu: ${readiness.failing_items.map((item) => failingLabel(c, item)).join('; ')}.`, 'danger') : null,
        photoBlock(c), checklistBlock(c), materialsBlock(c, cat), shortageBlock(c, cat), noteBlock(c), completeBlock(c), troubleBlock(c),
      ];
    }
    if (t.status === 'ON_HOLD' && codeOf(t) === 'WAITING_MATERIAL') {
      return [notice('Chờ kho nhập vật tư. Kho nhập đủ thì ticket tự chạy tiếp và bạn nhận thông báo ở đầu màn Việc đang làm.', 'pause', { id: 'dept-waiting-material' })];
    }
    if (t.status === 'ON_HOLD' && codeOf(t) === 'BLOCKED_ONSITE') {
      return [writeButton('Tiếp tục xử lý', () => run(post(id, '/resume-work'), 'Đã tiếp tục xử lý'))];
    }
    if (t.status === 'READY_FOR_REVIEW') return [notice('Đã báo hoàn thành — đang chờ BQL nghiệm thu.', 'info')];
    return [];
  };

  await caseScreen(ctx, {
    back: '#/d',
    bind: (load) => { reload = load; },
    tiles: { items: TILES, active: tab, pick: tabState.set },
    draw: (live, c, cat) => {
      const t = c.ticket;
      fill(live, el('section', { class: 'card pad detail' },
        caseHead(c, cat),
        t.flags.includes('ASSET_CHECK_ONSITE') ? notice('Kiểm tra tài sản tại hiện trường: đối chiếu tem mác / vị trí thiết bị trước khi báo hoàn thành.', 'pause') : null,
        t.flags.includes('STOCK_CHECK_ON_ACCEPT') ? notice('Kiểm tra tồn kho thực tế của vật tư trước khi xuất kho.', 'pause') : null,
        el('div', { id: 'dept-actions', class: 'actions-col' }, actionsFor(c, cat)),
        reportBox(c),
        photoBox(ctx, c, 'Ảnh cư dân gửi', imagesOf(c, 'RESIDENT_ORIGINAL'), photoCache),
        eventsHistory(c, cat)));
    },
  });
}

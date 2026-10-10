// Department screens (Phòng ban Vệ sinh / Kỹ thuật) — plan 11 SPEC-P05 §2. Same endpoints and rules as
// renderDepartment / workSections in src/web/app.js; photos first because the field team works from the phone (Q28).
import { api, apiForm } from './api.js?v=15';
import { MAX_PHOTOS, photoFormData, photoPicker } from './photo.js?v=15';
import { confirmSheet, el, field, fill, icon, notice, pill, writeButton } from './ui.js?v=15';
import {
  REASON_LABEL, caseHead, caseScreen, checklistLabel, codeOf, eventsHistory, executionPhotoIds, imagesOf, materialName,
  materialUnit, photoBox, photoStrip, queueScreen, reportBox, select, webButton, writer,
} from './staff.js?v=15';

const MAX_EXECUTION_PHOTOS = 10; // src/maintenance/engine.py
// Materials a department may pick (seed/maintenance_v1/catalog.yaml playbook_materials: PB-CLN-01 / PB-TEC-01)
const MATERIAL_GROUP = {
  DEPT_CLEANING: (code) => /CLEAN|BAG/.test(code),
  DEPT_TECHNICAL: (code) => /LAMP|STARTER/.test(code),
};
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
/** The header bell opens "Chờ nhận". */
export function focusQueue() { tab = 'todo'; }
const tabState = { get: () => tab, set: (key) => { tab = key; } };

export const list = (ctx) => queueScreen(ctx, {
  tiles: TILES, tab: tabState, heads: HEADS, base: '#/d', empty: 'Không có việc nào ở mục này.',
});

// ---------------------------------------------------------------- readiness (src/web/app.js failingLabel / computeReadinessPrecheck)

/** Q42: the materials count only once the department chose them (material-plan or saved quantities); the Agent's step-7 plan is not shown. */
const deptChoseMaterials = (c) => (c.audit || []).some((a) => a.field_name === 'planned_materials')
  || c.material_lines.some((l) => l.issued_qty != null);

function failingLabel(c, item) {
  const line = c.material_lines.find((l) => l.material_line_id === item);
  if (line) {
    const name = materialName(line.item_code, line.item_name);
    return line.issued_qty == null || line.used_qty == null ? 'chưa chọn vật tư sử dụng' : `chưa ghi lý do chênh lệch vật tư "${name}"`;
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
  const lines = c.material_lines || [];
  const entered = deptChoseMaterials(c) && lines.every((l) => l.issued_qty != null && l.used_qty != null);
  const unexplained = lines.filter((l) => l.issued_qty != null && l.used_qty != null
    && ((l.norm_qty != null && l.used_qty !== l.norm_qty) || (l.planned_qty != null && l.used_qty !== l.planned_qty))
    && !(l.variance_reason || '').trim());
  const photos = executionPhotoIds(c).length;
  const rows = [
    [`Checklist (${done}/${items.length})`, done === items.length],
    ['Đã chọn vật tư sử dụng', entered],
    ['Chênh lệch vật tư có lý do', unexplained.length === 0],
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

  // Q41 + Q42: ONE block where the department picks the materials really used and how many — the Agent's plan is neither
  // shown nor pre-filled. Vệ sinh may tick "Không sử dụng vật tư". Save = POST material-plan (the choice replaces the plan),
  // then every line issued = used. The reason box is required only when a quantity differs from the norm (engine reconcile).
  const materialsBlock = (c, cat) => {
    const id = c.ticket.ticket_id;
    const cleaning = c.ticket.department_id === 'DEPT_CLEANING';
    const chose = deptChoseMaterials(c);
    const lines = chose ? c.material_lines : [];
    const noneChosen = chose && !lines.length;
    const saved = chose && lines.every((l) => l.issued_qty != null && l.used_qty != null);
    const fits = MATERIAL_GROUP[c.ticket.department_id] || (() => true);
    const options = ((cat && cat.materials) || []).filter((m) => fits(m.item_code)).map((m) => [m.item_code, materialName(m.item_code, m.item_name)]);
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
    const reason = el('textarea', { class: 'field', id: 'dept-material-reason', rows: 2, maxlength: '300', placeholder: 'Bắt buộc khi số lượng khác định mức' });
    reason.value = (lines.find((l) => l.variance_reason) || {}).variance_reason || '';
    const invalid = (message) => ctx.fail({ kind: 'invalid', message });

    const save = writeButton('Lưu vật tư', async () => {
      const note = reason.value.trim();
      if (none && none.checked) {
        await run(post(id, '/material-plan', { lines: [], note: note || 'Không sử dụng vật tư' }), 'Đã lưu: không sử dụng vật tư');
        return;
      }
      const chosen = [...rows.children].map((row) => ({ item_code: row.querySelector('select').value, planned_qty: Number(row.querySelector('input').value) }));
      if (!chosen.length || chosen.every((l) => !l.item_code)) { invalid(cleaning ? 'Chọn vật tư hoặc đánh dấu "Không sử dụng vật tư"' : 'Chọn ít nhất một vật tư'); return; }
      if (chosen.some((l) => !l.item_code)) { invalid('Chọn vật tư cho mọi dòng hoặc bấm "Bỏ"'); return; }
      if (chosen.some((l) => !(Number.isInteger(l.planned_qty) && l.planned_qty > 0))) { invalid('Số lượng phải là số nguyên lớn hơn 0'); return; }
      if (new Set(chosen.map((l) => l.item_code)).size !== chosen.length) { invalid('Mỗi vật tư chỉ chọn một dòng'); return; }
      const changed = !chose || chosen.length !== lines.length
        || chosen.some((l, i) => l.item_code !== lines[i].item_code || l.planned_qty !== lines[i].planned_qty);
      await run(async () => {
        const planned = changed
          ? (await post(id, '/material-plan', { lines: chosen, note: note || 'Phòng ban chọn vật tư tại hiện trường' })()).material_lines
          : lines;
        // the norm of a picked item is only known once it is a line (the catalog view has no norm)
        const offNorm = planned.filter((l) => l.norm_qty != null && l.planned_qty !== l.norm_qty);
        if (offNorm.length && !note) {
          throw { kind: 'invalid', message: `Khác định mức (${offNorm.map((l) => `${materialName(l.item_code, l.item_name)}: định mức ${l.norm_qty}`).join('; ')}) — nhập lý do rồi bấm Lưu vật tư lần nữa` };
        }
        for (const l of chosen) {
          await post(id, `/materials/${encodeURIComponent(l.item_code)}`, { issued_qty: l.planned_qty, used_qty: l.planned_qty, ...(note ? { variance_reason: note } : {}) })();
        }
      }, 'Đã lưu vật tư');
    });
    save.id = 'dept-material-save';

    return el('div', { class: 'act-box', id: 'dept-materials' },
      el('div', { class: 'trow' }, el('b', {}, 'Vật tư sử dụng'), pill(saved ? 'st-dang_xu_ly' : 'st-moi', saved ? 'Đã lưu' : 'Chưa lưu', { dot: false })),
      el('span', { class: 'muted small' }, cleaning ? 'Chọn vật tư đã dùng, hoặc đánh dấu không sử dụng vật tư.' : 'Chọn vật tư đã dùng và số lượng.'),
      c.ticket.flags.includes('ASSET_CHECK_ONSITE') ? notice('Chưa xác định được thiết bị: kiểm tra thực tế rồi chọn đúng vật tư.', 'pause') : null,
      none ? el('label', { class: 'check-row', for: 'dept-no-material' }, none, el('span', {}, 'Không sử dụng vật tư')) : null,
      rows, add, field('Lý do', reason), save);
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
        photoBlock(c), checklistBlock(c), materialsBlock(c, cat), noteBlock(c), completeBlock(c), troubleBlock(c),
      ];
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
        eventsHistory(c, cat),
        webButton()));
    },
  });
}

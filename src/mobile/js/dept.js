// Department screens (Phòng ban Vệ sinh / Kỹ thuật) — plan 11 SPEC-P05 §2. Same endpoints and rules as
// renderDepartment / workSections in src/web/app.js; photos first because the field team works from the phone (Q28).
import { api, apiForm } from './api.js?v=7';
import { MAX_PHOTOS, photoFormData, photoPicker } from './photo.js?v=7';
import { confirmSheet, el, field, fill, icon, notice, pill, writeButton } from './ui.js?v=7';
import {
  REASON_LABEL, caseHead, caseScreen, checklistLabel, codeOf, eventsHistory, executionPhotoIds, imagesOf, materialName,
  materialUnit, photoBox, photoStrip, queueScreen, reportBox, select, webButton, writer,
} from './staff.js?v=7';

const MAX_EXECUTION_PHOTOS = 10; // src/maintenance/engine.py
const TILES = [
  ['todo', 'Chờ nhận', 'briefcase', (t) => t.status === 'ROUTED'],
  ['doing', 'Đang làm', 'clipboard', (t) => t.status === 'IN_PROGRESS' || t.status === 'ON_HOLD'],
  ['review', 'Chờ nghiệm thu', 'checkSquare', (t) => t.status === 'READY_FOR_REVIEW'],
  ['all', 'Tất cả', 'table', () => true],
];
const HEADS = {
  todo: ['Việc chờ nhận', 'Phản ánh đã giao cho phòng ban, chưa có người nhận.'],
  doing: ['Việc đang làm', 'Chụp ảnh sau xử lý, tick checklist, ghi vật tư rồi báo hoàn thành.'],
  review: ['Chờ nghiệm thu', 'Đã báo hoàn thành, đang chờ Ban quản lý nghiệm thu.'],
  all: ['Tất cả việc của phòng ban', 'Mọi phản ánh đã giao cho phòng ban của bạn.'],
};
let tab = 'todo';
/** The header bell opens "Chờ nhận". */
export function focusQueue() { tab = 'todo'; }
const tabState = { get: () => tab, set: (key) => { tab = key; } };

export const list = (ctx) => queueScreen(ctx, {
  tiles: TILES, tab: tabState, heads: HEADS, base: '#/d', empty: 'Không có việc nào ở mục này.',
});

// ---------------------------------------------------------------- readiness (src/web/app.js failingLabel / computeReadinessPrecheck)

function failingLabel(c, item) {
  const line = c.material_lines.find((l) => l.material_line_id === item);
  if (line) {
    const name = materialName(line.item_code, line.item_name);
    return line.issued_qty == null || line.used_qty == null ? `chưa lưu số lượng vật tư "${name}"` : `chưa ghi lý do chênh lệch vật tư "${name}"`;
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
  const entered = lines.every((l) => l.issued_qty != null && l.used_qty != null);
  const unexplained = lines.filter((l) => l.issued_qty != null && l.used_qty != null
    && ((l.norm_qty != null && l.used_qty !== l.norm_qty) || (l.planned_qty != null && l.used_qty !== l.planned_qty))
    && !(l.variance_reason || '').trim());
  const photos = executionPhotoIds(c).length;
  const rows = [
    [`Checklist (${done}/${items.length})`, done === items.length],
    ['Đã lưu số lượng vật tư', entered],
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

  const materialsBlock = (c, cat) => {
    const id = c.ticket.ticket_id;
    const onsite = c.ticket.flags.includes('ASSET_CHECK_ONSITE');
    const confirmed = (c.audit || []).some((a) => a.field_name === 'planned_materials');
    const lines = c.material_lines.map((line) => {
      const unit = materialUnit(line.item_code, line.unit);
      const issued = el('input', { class: 'field', type: 'number', inputmode: 'numeric', min: '0', step: '1', value: String(line.issued_qty ?? line.planned_qty), 'aria-label': 'Đã xuất' });
      const used = el('input', { class: 'field', type: 'number', inputmode: 'numeric', min: '0', step: '1', value: String(line.used_qty ?? line.planned_qty), 'aria-label': 'Đã dùng' });
      const reason = el('input', { class: 'field', type: 'text', maxlength: '300', value: line.variance_reason || '', placeholder: 'Lý do nếu khác định mức' });
      const saved = line.issued_qty != null && line.used_qty != null;
      return el('div', { class: 'mat-line', dataset: { item: line.item_code } },
        el('div', { class: 'trow' }, el('b', {}, materialName(line.item_code, line.item_name)),
          pill(saved ? 'st-dang_xu_ly' : 'st-moi', saved ? 'Đã lưu' : 'Chưa lưu', { dot: false })),
        el('span', { class: 'muted small' }, [`dự kiến ${line.planned_qty} ${unit}`, line.norm_qty != null ? `định mức ${line.norm_qty}` : null,
          line.simulated_stock_qty != null ? `tồn kho ${line.simulated_stock_qty}` : null].filter(Boolean).join(' · ')),
        el('div', { class: 'two' }, field('Đã xuất', issued), field('Đã dùng', used)),
        field('Lý do chênh lệch', reason),
        writeButton('Lưu vật tư', () => run(post(id, `/materials/${encodeURIComponent(line.item_code)}`, {
          issued_qty: Number(issued.value), used_qty: Number(used.value), ...(reason.value.trim() ? { variance_reason: reason.value.trim() } : {}),
        }), 'Đã lưu vật tư'), { variant: '' }));
    });

    // the department confirms what the site really needs, replacing the Agent's playbook guess
    const rows = el('div', { class: 'plan-rows' });
    const options = ((cat && cat.materials) || []).map((m) => [m.item_code, materialName(m.item_code, m.item_name)]);
    const addRow = (code = '', qty = 1) => {
      const qtyBox = el('input', { class: 'field qty', type: 'number', inputmode: 'numeric', min: '1', step: '1', value: String(qty), 'aria-label': 'Số lượng' });
      const row = el('div', { class: 'plan-row' }, select(options, { placeholder: 'Chọn vật tư…', value: code }), qtyBox,
        el('button', { type: 'button', class: 'btn', onclick: () => row.remove() }, 'Bỏ'));
      rows.append(row);
    };
    c.material_lines.forEach((line) => addRow(line.item_code, line.planned_qty));
    const note = el('textarea', { class: 'field', rows: 2, maxlength: '500', placeholder: 'Kết quả kiểm tra tại hiện trường (bắt buộc)' });
    const plan = el('details', { class: 'more', open: onsite && !confirmed },
      el('summary', {}, confirmed ? 'Vật tư đã xác nhận — sửa lại?' : 'Vật tư thực tế khác đề xuất của Agent?'),
      el('div', { class: 'more-body' },
        onsite ? notice('Chưa xác định được thiết bị: vật tư dưới đây chỉ là đề xuất mặc định. Kiểm tra thực tế rồi chọn đúng.', 'pause') : null,
        rows,
        el('button', { type: 'button', class: 'btn block', onclick: () => addRow() }, '+ Thêm vật tư'),
        field('Lý do / kết quả kiểm tra', note),
        writeButton(confirmed ? 'Cập nhật vật tư' : 'Xác nhận vật tư', async () => {
          if (!note.value.trim()) { ctx.fail({ kind: 'invalid', message: 'Nhập lý do / kết quả kiểm tra' }); return; }
          const planned = [...rows.children].map((row) => ({ item_code: row.querySelector('select').value, planned_qty: Number(row.querySelector('input').value) }))
            .filter((l) => l.item_code);
          if (!planned.length && !(await confirmSheet('Không dùng vật tư?', 'Phản ánh sẽ được ghi nhận là không dùng vật tư nào.'))) return;
          await run(post(id, '/material-plan', { lines: planned, note: note.value.trim() }), 'Đã xác nhận vật tư');
        }, { variant: '' })));
    return el('div', { class: 'act-box', id: 'dept-materials' }, el('b', {}, 'Vật tư sử dụng'),
      lines.length ? lines : el('span', { class: 'muted' }, 'Không có vật tư dự kiến.'), plan);
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

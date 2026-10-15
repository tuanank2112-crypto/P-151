// BPTN screens (Bộ phận tiếp nhận) — plan 11 SPEC-P05 §3. Same queue filter and bodies as renderBptn / bptnForm in src/web/app.js.
import { api } from './api.js?v=19';
import { TERMINAL, confirmSheet, el, field, fill, notice, writeButton } from './ui.js?v=19';
import {
  CATEGORY_LABEL, caseHead, caseScreen, codeOf, compact, eventsHistory, imagesOf, photoBox, queueScreen, reportBox, select,
  writer,
} from './staff.js?v=19';

const QUEUE = new Set(['SAFETY_REVIEW_REQUIRED', 'MISSING_INFO', 'DUPLICATE', 'CATEGORY_UNCLEAR', 'OUT_OF_SCOPE', 'PENDING_REVIEW', 'ASSET_UNCLEAR', 'WRONG_DEPT']);
const needsBptn = (t) => t.status === 'NEED_INFO' || QUEUE.has(codeOf(t));
// Q40: one box per ticket — An toàn B2 and Nghi trùng have their own tile, so "Cần xử lý" is the rest of the BPTN queue;
// "Tất cả"/"Tổng"/"Hàng chờ" are gone (they repeated other boxes). Hủy/gộp (MERGED, CANCELLED) are in no box.
const TILES = [
  ['queue', 'Cần xử lý', 'briefcase', needsBptn],
  ['safety', 'An toàn B2', 'shield', (t) => codeOf(t) === 'SAFETY_REVIEW_REQUIRED'],
  ['duplicate', 'Nghi trùng', 'layers', (t) => codeOf(t) === 'DUPLICATE'],
];
const STATS = [
  ['progress', 'Đang xử lý', (t) => !TERMINAL.has(t.status) && !needsBptn(t)],
  ['done', 'Hoàn thành', (t) => t.status === 'CLOSED'],
];
// queueScreen gives a ticket to the FIRST box whose test passes: the two specific queues are tested before "Cần xử lý"
const PRIORITY = [TILES[1], TILES[2], TILES[0]];
const HEADS = {
  queue: ['Hàng chờ BPTN', 'Agent chưa tự xử lý được: thiếu thông tin, loại việc, tài sản, sai phòng ban.'],
  safety: ['An toàn Bậc 2', 'Xác minh tại hiện trường rồi chọn một trong ba quyết định.'],
  duplicate: ['Phản ánh nghi trùng', 'Agent nghi trùng với ticket đang mở: gộp hoặc tách.'],
  progress: ['Đang xử lý', 'Không cần BPTN: đang ở Agent, phòng ban hoặc Ban quản lý.'],
  done: ['Phản ánh đã hoàn thành', 'Ticket đã nghiệm thu và đóng.'],
};
// Field codes the engine writes after "Thiếu:" in blocker.internal_note (src/web/app.js MISSING_LABEL)
const MISSING_LABEL = {
  description: 'nội dung phản ánh', location: 'vị trí (tòa, tầng, khu vực)', location_building: 'tòa (S1 hoặc S2)',
  location_floor: 'tầng', location_area: 'khu vực (hành lang, sảnh cư dân, sảnh thang máy…)',
};
const missingFromNote = (note) => {
  const match = /Thiếu: (.+)$/.exec(note || '');
  return match ? match[1].split(', ').map((code) => MISSING_LABEL[code] || code) : [];
};
let tab = 'queue';
/** The header bell opens "Cần xử lý". */
export function focusQueue() { tab = 'queue'; }
const tabState = { get: () => tab, set: (key) => { tab = key; } };

export const list = (ctx) => queueScreen(ctx, {
  tiles: TILES, priority: PRIORITY, stats: STATS, tab: tabState, heads: HEADS, base: '#/p', empty: 'Không có phản ánh nào ở mục này.',
});

// ---------------------------------------------------------------- #/p/<id>

export async function detail(ctx) {
  const photoCache = new Map();
  let reload = async () => {};
  const run = writer(ctx, '#/p', () => reload);
  const invalid = (message) => ctx.fail({ kind: 'invalid', message });
  const noteBox = (placeholder = 'Lý do / ghi chú') => el('textarea', { class: 'field bptn-note', rows: 2, maxlength: '500', placeholder });
  // engine.bptn_resolve: a BPTN-chosen value (location, info, category, department, asset) needs a reason, else 409 GUARD_FAILED
  const VALUE_KEYS = ['location', 'info', 'category', 'department', 'asset_id', 'asset_onsite'];
  const categories = Object.entries(CATEGORY_LABEL);

  const form = (c, cat) => {
    const t = c.ticket;
    const id = t.ticket_id;
    const code = codeOf(t);
    const resolve = (body, message) => {
      const sent = compact(body);
      if (VALUE_KEYS.some((key) => key in sent) && !sent.note) { invalid('Nhập lý do (bắt buộc khi BPTN chọn hoặc sửa giá trị)'); return undefined; }
      return run(() => api(`/mo/tickets/${encodeURIComponent(id)}/bptn-resolve`, { method: 'POST', body: sent }), message);
    };
    const safety = (decision, note, message) => run(() => api(`/mo/tickets/${encodeURIComponent(id)}/safety`, { method: 'POST', body: compact({ decision, note }) }), message);

    if (code === 'SAFETY_REVIEW_REQUIRED') {
      const missing = missingFromNote(t.blocker.internal_note);
      const safeNote = noteBox();
      const askNote = noteBox('Nội dung hỏi cư dân');
      if (missing.length) askNote.value = `Vui lòng mô tả rõ hiện tượng và bổ sung ${missing.join(', ')}.`;
      const upNote = noteBox('Lý do nâng mức');
      return el('div', { class: 'act-box danger', id: 'bptn-safety' }, el('b', { class: 'big' }, 'An toàn Bậc 2 — xác minh tại hiện trường'),
        missing.length ? notice(`Phản ánh còn thiếu: ${missing.join(', ')}`, 'pause') : null,
        field('Xác nhận an toàn', safeNote), writeButton('Xác nhận an toàn', () => safety('CONFIRM_SAFE', safeNote.value.trim(), 'Đã xác nhận an toàn')),
        field('Yêu cầu cư dân làm rõ', askNote), writeButton('Yêu cầu cư dân bổ sung', () => safety('REQUEST_INFO', askNote.value.trim(), 'Đã gửi yêu cầu bổ sung'), { variant: '' }),
        field('Nâng mức Khẩn cấp (Bậc 1)', upNote),
        writeButton('Nâng lên Khẩn cấp (BQL)', async () => {
          if (!(await confirmSheet('Nâng lên Khẩn cấp Bậc 1?', 'Ban quản lý sẽ phải xử lý ngay.', { confirmLabel: 'Nâng mức', danger: true }))) return;
          await safety('ESCALATE', upNote.value.trim(), 'Đã nâng mức khẩn cấp lên Ban quản lý');
        }, { variant: 'danger-solid' }));
    }
    if (code === 'MISSING_INFO') {
      const location = el('input', { class: 'field', id: 'bptn-location', type: 'text', maxlength: '200', placeholder: 'Tòa S1 / Tầng 3 / Hành lang' });
      const info = el('textarea', { class: 'field', id: 'bptn-info', rows: 2, maxlength: '500', placeholder: 'Lời cư dân cung cấp' });
      const note = noteBox();
      return el('div', { class: 'act-box warn', id: 'bptn-missing' }, el('b', {}, 'Phản ánh còn thiếu thông tin'),
        t.blocker.internal_note ? el('span', { class: 'muted' }, `${t.blocker.internal_note}. Liên hệ cư dân rồi nhập phần còn thiếu.`) : null,
        field('Vị trí', location, 'Nhập đủ tòa, tầng, khu vực.'), field('Thông tin cư dân cung cấp', info), field('Lý do (bắt buộc)', note),
        writeButton('Lưu và xử lý tiếp', async () => {
          if (!location.value.trim() && !info.value.trim()) { invalid('Nhập vị trí hoặc thông tin cư dân cung cấp'); return; }
          await resolve({ location: location.value.trim(), info: info.value.trim(), note: note.value.trim() }, 'Đã bổ sung thông tin');
        }));
    }
    if (code === 'DUPLICATE') {
      const other = t.blocker.related_ticket_id;
      return el('div', { class: 'act-box warn', id: 'bptn-duplicate' }, el('b', {}, `Có thể trùng với ${other}`),
        el('span', { class: 'muted' }, 'Gộp sẽ hoàn tất phản ánh này và cập nhật vào phản ánh gốc.'),
        writeButton(`Gộp vào ${other}`, () => resolve({ merge: true }, `Đã gộp vào ${other}`)),
        writeButton('Xử lý riêng (không trùng)', () => resolve({ merge: false, note: 'BPTN xác nhận không trùng' }, 'Đã xác nhận không trùng'), { variant: '' }));
    }
    if (code === 'CATEGORY_UNCLEAR' || code === 'OUT_OF_SCOPE') {
      const category = select(categories, { placeholder: 'Chọn loại việc…' });
      const note = noteBox();
      return el('div', { class: 'act-box', id: 'bptn-category' }, el('b', {}, 'Chọn loại việc'), field('Loại việc', category), field('Lý do (bắt buộc)', note),
        writeButton('Xác nhận loại việc', async () => {
          if (!category.value) { invalid('Chọn loại việc'); return; }
          await resolve({ category: category.value, note: note.value.trim() }, 'Đã chọn loại việc');
        }));
    }
    if (code === 'PENDING_REVIEW') {
      const category = select(categories, { placeholder: 'Giữ đề xuất của Agent' });
      const location = el('input', { class: 'field', type: 'text', maxlength: '200', placeholder: 'Tòa S1 / Tầng 3 / Hành lang' });
      const note = noteBox();
      return el('div', { class: 'act-box', id: 'bptn-review' }, el('b', {}, 'Xác nhận đề xuất của Agent'),
        field('Đổi loại việc (không bắt buộc)', category), field('Sửa vị trí (không bắt buộc)', location), field('Lý do (bắt buộc khi đổi)', note),
        writeButton('Xác nhận', () => resolve({ category: category.value, location: location.value.trim(), note: note.value.trim() }, 'Đã xác nhận')));
    }
    if (code === 'ASSET_UNCLEAR') {
      // One asset per area (plan 14): the name is enough, the floor and building come from the ticket location
      const asset = select(((cat && cat.assets) || []).map((a) => [a.asset_id, a.name]), { placeholder: 'Chưa chọn' });
      const onsite = el('input', { type: 'checkbox', id: 'asset-onsite' });
      const note = noteBox();
      return el('div', { class: 'act-box', id: 'bptn-asset' }, el('b', {}, 'Xác định tài sản'), field('Chọn tài sản', asset),
        el('label', { class: 'check-row', for: 'asset-onsite' }, onsite, el('span', {}, 'Không xác định được — để phòng ban kiểm tra tại hiện trường')),
        field('Lý do (bắt buộc)', note),
        writeButton('Lưu và xử lý tiếp', async () => {
          if (!asset.value && !onsite.checked) { invalid('Chọn một tài sản hoặc đánh dấu kiểm tra tại hiện trường'); return; }
          await resolve({ asset_id: asset.value, asset_onsite: onsite.checked ? true : undefined, note: note.value.trim() }, 'Đã xác định tài sản');
        }));
    }
    if (code === 'WRONG_DEPT') {
      const category = select(categories, { placeholder: 'Giữ nguyên' });
      const dept = select(Object.entries((cat && cat.departments) || {}), { placeholder: 'Theo loại việc' });
      const note = noteBox();
      return el('div', { class: 'act-box warn', id: 'bptn-wrong-dept' }, el('b', {}, 'Phòng ban trả lại'),
        field('Loại việc mới', category), field('Hoặc chọn phòng ban', dept), field('Lý do (bắt buộc)', note),
        writeButton('Giao lại', async () => {
          if (!category.value && !dept.value) { invalid('Chọn loại việc hoặc phòng ban'); return; }
          await resolve({ category: category.value, department: dept.value, note: note.value.trim() }, 'Đã giao lại');
        }));
    }
    return notice('Không có thao tác cần BPTN cho phản ánh này.', 'info');
  };

  await caseScreen(ctx, {
    back: '#/p',
    bind: (load) => { reload = load; },
    tiles: { items: TILES, active: tab, pick: tabState.set },
    draw: (live, c, cat) => {
      fill(live, el('section', { class: 'card pad detail' },
        caseHead(c, cat),
        el('div', { id: 'bptn-actions', class: 'actions-col' }, form(c, cat)),
        reportBox(c),
        photoBox(ctx, c, 'Ảnh cư dân gửi', imagesOf(c, 'RESIDENT_ORIGINAL'), photoCache),
        eventsHistory(c, cat)));
    },
  });
}

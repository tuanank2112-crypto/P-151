// Resident screens (plan 11, SPEC-P02 rules, SPEC-P04 §4 layout from portal/src/app/resident/resident-app.tsx).
// Only /resident/* endpoints; data = ResidentTicketView.
import { api, apiForm, apiImage } from './api.js?v=12';
import {
  TERMINAL, el, emptyState, fill, formatTime, history, icon, infoGrid, notice, pageHead, pagedList, pill,
  refreshButton, stepHead, toast, writeButton,
} from './ui.js?v=12';
import { MAX_PHOTOS, photoFormData, photoPicker } from './photo.js?v=12';

const MIN_DESCRIPTION = 10;
const RECOVER_WINDOW_MS = 3 * 60 * 1000;
const STAGES = ['Tiếp nhận', 'Thẩm định', 'Phân công', 'Đang xử lý', 'Nghiệm thu', 'Hoàn tất'];
const STAGE = { RECEIVED: 1, VERIFYING: 2, NEED_INFO: 2, ON_HOLD: 2, ROUTED: 3, IN_PROGRESS: 4, READY_FOR_REVIEW: 5, CLOSED: 6 };
const PAUSED = new Set(['NEED_INFO', 'ON_HOLD']);
const STAR_LABEL = ['', 'Rất không hài lòng', 'Không hài lòng', 'Bình thường', 'Hài lòng', 'Rất hài lòng'];
const EXAMPLES = [
  ['Đèn hỏng', 'Bóng đèn hành lang chập chờn, không sáng'],
  ['Rác chưa thu gom', 'Rác chưa được thu gom, có mùi hôi'],
  ['Sàn bẩn', 'Sàn sảnh thang máy bẩn, cần lau dọn'],
  ['Đèn cầu thang', 'Đèn cầu thang bộ không sáng'],
];
const BUILDINGS = ['S1', 'S2']; // seed/maintenance_v1/catalog.yaml site.buildings
const AREAS = [['Hành lang', 'layers'], ['Sảnh thang máy', 'lift'], ['Cầu thang bộ', 'building'], ['Phòng rác', 'box']];

const path = (id, rest = '') => `/resident/tickets/${encodeURIComponent(id)}${rest}`;
const stageOf = (t) => STAGE[t.status] || 0;
const cancelled = (t) => t.status === 'CANCELLED' || t.status === 'MERGED';

function statusClass(t) {
  if (cancelled(t)) return 's-cancel';
  if (PAUSED.has(t.status)) return 's-pause';
  if (t.status === 'READY_FOR_REVIEW') return 's-wait';
  if (t.status === 'CLOSED') return 's-done';
  return 's-run';
}
const statusPill = (t) => pill(statusClass(t), t.status_label);

// ---------------------------------------------------------------- #/r

const FILTERS = {
  all: ['Tất cả', () => true],
  run: ['Đang xử lý', (t) => !TERMINAL.has(t.status) && t.status !== 'READY_FOR_REVIEW'],
  accept: ['Chờ nghiệm thu', (t) => t.status === 'READY_FOR_REVIEW'],
  need: ['Cần bạn', (t) => t.allowed_actions.length > 0],
  done: ['Đã xong', (t) => TERMINAL.has(t.status)],
};
const OVERVIEW = [
  ['run', '#2563EB', 'Từ tiếp nhận đến đang xử lý'],
  ['accept', '#6D5BD0', 'Phòng ban báo xong, BQL kiểm tra'],
  ['need', '#D99A00', 'Bổ sung thông tin hoặc đánh giá'],
  ['done', '#16A34A', 'Hoàn tất, đã gộp hoặc đã hủy'],
];
let filter = 'all'; // kept while the app is open

/** The header bell opens the list on "Cần bạn". */
export function focusNeeds() { filter = 'need'; }

function segments(t) {
  const stage = stageOf(t);
  return el('span', { class: 'segs', 'aria-label': stage ? `Tiến độ bước ${stage} trên 6` : 'Không còn xử lý' },
    [1, 2, 3, 4, 5, 6].map((n) => {
      let cls = 'seg';
      if (!cancelled(t) && stage) {
        if (n < stage || stage === 6) cls = 'seg done';
        else if (n === stage) cls = PAUSED.has(t.status) ? 'seg pause' : 'seg cur';
      }
      return el('span', { class: cls });
    }));
}

function needPill(t) {
  if (t.allowed_actions.includes('RATE')) return pill('need', 'Cần bạn đánh giá', { dot: false });
  if (t.allowed_actions.includes('ADD_INFO')) return pill('need', 'Cần bạn bổ sung thông tin', { dot: false });
  return null;
}

function ticketItem(t) {
  const stage = stageOf(t);
  const last = t.timeline[t.timeline.length - 1];
  return el('a', { class: 'titem', href: `#/r/${encodeURIComponent(t.ticket_id)}`, dataset: { ticket: t.ticket_id } },
    el('span', { class: 'trow' }, el('span', { class: 'idb' }, t.ticket_id), statusPill(t)),
    el('span', { class: 'ttitle' }, t.description),
    segments(t),
    el('span', { class: 'tmeta' }, [stage ? `Bước ${stage}/6` : null, last ? last.status_label : null,
      formatTime(last ? last.created_at : t.created_at), t.department_name].filter(Boolean).join(' · ')),
    t.merged_into ? el('span', { class: 'tmeta' }, `Đã gộp vào ${t.merged_into.ticket_id}`) : null,
    needPill(t));
}

export async function list(ctx) {
  ctx.chrome({ active: 'mine' });
  const overview = el('div', { class: 'ov-grid' });
  const filterLine = el('div', { class: 'filter-line', id: 'resident-filter' });
  const body = el('div', { id: 'resident-list' });
  let rows = [];
  const draw = (keep) => {
    const count = (key) => rows.filter(FILTERS[key][1]).length;
    fill(overview, OVERVIEW.map(([key, color, hint]) => el('button', {
      type: 'button', class: filter === key ? 'ov on' : 'ov', 'aria-pressed': String(filter === key),
      onclick: () => { filter = filter === key ? 'all' : key; draw(false); },
    }, el('span', { class: 'ov-top' }, el('span', {}, FILTERS[key][0]), el('span', { class: 'ov-dot', style: `background:${color}` })),
    el('b', {}, String(count(key))), el('small', {}, hint))));
    // SPEC-P05 §5: no chip row; the overview tiles filter, this line shows the filter and clears it
    fill(filterLine, filter === 'all' ? `Tất cả · ${rows.length} phản ánh` : [`Đang lọc: ${FILTERS[filter][0]} · ${count(filter)}`,
      el('button', { type: 'button', class: 'btn ghost', onclick: () => { filter = 'all'; draw(false); } }, 'Bỏ lọc')]);
    const previous = keep ? body.firstElementChild : null;
    fill(body, pagedList(rows.filter(FILTERS[filter][1]), ticketItem, {
      empty: rows.length ? 'Không có phản ánh nào ở mục này.' : 'Bạn chưa gửi phản ánh nào.', keep: previous,
    }));
  };
  const load = async () => {
    rows = await api('/resident/tickets');
    if (!ctx.alive()) return;
    draw(true);
    ctx.counts({ bell: rows.filter(FILTERS.need[1]).length, mine: rows.filter((t) => !TERMINAL.has(t.status)).length });
    ctx.updatedNow();
  };
  ctx.screen.append(
    pageHead('Phản ánh của tôi', 'Xem phản ánh đang ở bước nào, bổ sung thông tin và đánh giá sau khi hoàn tất.',
      { right: refreshButton(load, ctx) }),
    el('div', { class: 'updated', dataset: { updated: '' } }),
    overview, filterLine, body);
  await load();
  ctx.setLoader(load);
}

// ---------------------------------------------------------------- #/r/new

/** After a timeout the ticket may exist: look for it instead of sending twice (SPEC-P02 §2). */
async function findJustCreated(description, since) {
  const rows = await api('/resident/tickets');
  return rows.find((t) => t.description.trim() === description && new Date(t.created_at).getTime() >= since - RECOVER_WINDOW_MS);
}

export async function create(ctx) {
  ctx.chrome({ active: 'new' });
  const loc = { building: '', area: '' };
  const description = el('textarea', {
    class: 'field', id: 'new-description', name: 'description', rows: 4, maxlength: '2000',
    placeholder: 'Ví dụ: Bóng đèn hành lang chập chờn, không sáng. Ghi rõ tòa, tầng nếu chưa chọn ở bước 1.',
  });
  const floor = el('input', { class: 'field floor', id: 'loc-floor', type: 'text', maxlength: '4', autocomplete: 'off', placeholder: 'VD: 3, B1', 'aria-label': 'Tầng' });
  const buildingChips = el('div', { class: 'chips' });
  const areaCards = el('div', { class: 'place-grid' });
  const sumLocation = el('span', { class: 'v' });
  const sumPhotos = el('span', { class: 'v' });
  const checks = el('div', { class: 'checks' });
  const error = el('div', { class: 'form-error', role: 'alert', hidden: true });
  const showError = (message) => { error.textContent = message; error.hidden = !message; };

  const locationLine = () => [loc.building && `Tòa ${loc.building}`, floor.value.trim() && `Tầng ${floor.value.trim().replace(/^tầng\s*/i, '')}`, loc.area]
    .filter(Boolean).join(' / ');
  const summary = () => {
    const text = description.value.trim();
    const line = locationLine();
    sumLocation.textContent = line || 'Theo mô tả';
    const items = [
      ['Mô tả ít nhất 10 ký tự', text.length >= MIN_DESCRIPTION],
      ['Có tòa và tầng (Agent sẽ hỏi lại nếu thiếu)', (loc.building && floor.value.trim()) || /t[aầ]ng|t[oò]a/i.test(text)],
    ];
    fill(checks, items.map(([label, ok]) => el('div', { class: ok ? 'chk ok' : 'chk' }, el('span', { class: 'bx' }, icon('check', 12)), label)));
  };
  const drawLocation = () => {
    fill(buildingChips, BUILDINGS.map((b) => el('button', {
      type: 'button', class: loc.building === b ? 'chip on' : 'chip', 'aria-pressed': String(loc.building === b),
      onclick: () => { loc.building = loc.building === b ? '' : b; drawLocation(); },
    }, `Tòa ${b}`)));
    fill(areaCards, AREAS.map(([name, iconName]) => el('button', {
      type: 'button', class: loc.area === name ? 'place on' : 'place', 'aria-pressed': String(loc.area === name),
      onclick: () => { loc.area = loc.area === name ? '' : name; drawLocation(); },
    }, el('span', { class: 'ic' }, icon(iconName)), el('span', { class: 'place-name' }, name))));
    summary();
  };
  const picker = photoPicker({ room: () => MAX_PHOTOS, onChange: (n) => { sumPhotos.textContent = n ? `${n} ảnh` : 'Chưa có'; } });
  description.addEventListener('input', () => { showError(''); summary(); });
  floor.addEventListener('input', summary);

  const reset = () => {
    picker.clear();
    description.value = '';
    floor.value = '';
    loc.building = '';
    loc.area = '';
  };
  const submit = writeButton('Gửi phản ánh', async () => {
    const text = description.value.trim();
    if (text.length < MIN_DESCRIPTION) { showError(`Vui lòng mô tả vấn đề (ít nhất ${MIN_DESCRIPTION} ký tự).`); return; }
    showError('');
    const line = locationLine();
    const full = line ? `${text}\nVị trí: ${line}` : text; // SPEC-P04 §4.2: the API only takes original_description
    const startedAt = Date.now();
    let view;
    try {
      view = await api('/resident/tickets', { method: 'POST', body: { original_description: full, channel: 'app' } });
    } catch (err) {
      if (err.kind !== 'timeout') { showError(err.message); ctx.fail(err); return; }
      toast('Chưa rõ đã gửi được chưa — đang kiểm tra lại', 'warn');
      view = await findJustCreated(full, startedAt).catch(() => null);
      if (!view) { showError('Chưa gửi được, hãy thử lại'); return; }
    }
    if (picker.hasPhotos()) {
      try {
        view = await apiForm(path(view.ticket_id, '/photos'), photoFormData(picker.blobs()));
      } catch (err) {
        toast(`Đã gửi phản ánh nhưng ảnh chưa tải lên — thêm lại ở mục "Thêm ảnh hiện trường". (${err.message})`, 'warn');
        reset();
        ctx.go(`#/r/${encodeURIComponent(view.ticket_id)}`);
        return;
      }
    }
    reset();
    toast(`Đã gửi phản ánh ${view.ticket_id}`);
    ctx.go(`#/r/${encodeURIComponent(view.ticket_id)}`);
  }, { busyLabel: 'Đang gửi và phân loại…', variant: 'primary big' });
  submit.id = 'submit-ticket';

  ctx.screen.append(
    pageHead('Gửi phản ánh mới', 'Chọn vị trí, mô tả vấn đề và thêm ảnh nếu có. Agent sẽ kiểm tra an toàn, phân loại và chuyển đúng bộ phận.'),
    el('section', { class: 'card pad sec' }, stepHead(1, 'Vị trí sự cố', el('span', { class: 'muted small' }, 'Không bắt buộc')),
      el('div', { class: 'loc-row' }, buildingChips, el('label', { class: 'floor-label' }, el('span', {}, 'Tầng'), floor)),
      areaCards,
      el('span', { class: 'muted small' }, 'Bỏ trống nếu sẽ ghi vị trí trong mô tả ở bước 2.')),
    el('section', { class: 'card pad sec' }, stepHead(2, 'Mô tả vấn đề'), description,
      el('div', { class: 'chips' }, el('span', { class: 'chips-label' }, 'Câu mẫu:'),
        EXAMPLES.map(([label, text]) => el('button', {
          type: 'button', class: 'chip sm', onclick: () => { description.value = text; showError(''); summary(); },
        }, label)))),
    el('section', { class: 'card pad sec' }, stepHead(3, 'Ảnh hiện trường', el('span', { class: 'muted small' }, 'Không bắt buộc')), picker.node),
    el('aside', { class: 'card pad sec summary' }, el('h2', {}, 'Tóm tắt'),
      el('div', { class: 'kv1' }, el('span', { class: 'k' }, 'VỊ TRÍ'), sumLocation),
      el('div', { class: 'kv1' }, el('span', { class: 'k' }, 'ẢNH'), sumPhotos),
      checks, error, submit));
  drawLocation();
}

// ---------------------------------------------------------------- #/r/<id>

function stepper(t) {
  const stage = stageOf(t);
  return el('div', { class: 'stepper', id: 'resident-steps' },
    el('div', { class: 'stepper-head' }, el('span', {}, 'Tiến độ xử lý'), el('b', {}, cancelled(t) ? t.status_label : `Bước ${stage}/6`)),
    el('div', { class: 'stepper-track' }, STAGES.map((label, i) => {
      const n = i + 1;
      const isDone = !cancelled(t) && (n < stage || stage === 6);
      const isCur = !cancelled(t) && n === stage && stage < 6;
      const dot = isDone ? 'sd done' : isCur ? (PAUSED.has(t.status) ? 'sd pause' : 'sd cur') : 'sd';
      return el('div', { class: 'step', dataset: { step: String(n) } },
        el('div', { class: 'step-line' }, el('span', { class: dot }, isDone ? '✓' : String(n)),
          n < 6 ? el('span', { class: isDone ? 'sl done' : 'sl' }) : null),
        el('span', { class: isDone || isCur ? 'slab done' : 'slab' }, label));
    })));
}

function linked(label, ticket) {
  return el('a', { class: 'titem', href: `#/r/${encodeURIComponent(ticket.ticket_id)}` },
    el('span', { class: 'trow' }, el('span', {}, `${label} ${ticket.ticket_id}`), statusPill(ticket)),
    el('span', { class: 'tmeta' }, ticket.public_message));
}

export async function detail(ctx) {
  const [id] = ctx.params;
  ctx.chrome({ active: 'mine' });
  const images = new Map(); // evidence_id → object URL, fetched once per visit
  const live = el('div', { id: 'resident-detail' });
  const actions = el('div', { id: 'resident-actions', class: 'actions-col' });
  ctx.screen.append(pageHead('Chi tiết phản ánh', null, { back: '#/r' }), el('div', { class: 'updated', dataset: { updated: '' } }), live);

  const photoStrip = (ids) => {
    const strip = el('div', { class: 'thumbs' });
    for (const evidenceId of ids) {
      const img = el('img', { alt: 'Ảnh bạn đã gửi' });
      const link = el('a', { target: '_blank', rel: 'noopener' }, img);
      strip.append(link);
      const show = (url) => { img.src = url; link.href = url; };
      const cached = images.get(evidenceId);
      if (cached) { show(cached); continue; }
      apiImage(path(id, `/photos/${encodeURIComponent(evidenceId)}`))
        .then((url) => { images.set(evidenceId, ctx.trackUrl(url)); show(url); })
        .catch(() => { img.alt = 'Không tải được ảnh'; });
    }
    return strip;
  };

  const draw = (view) => {
    if (!ctx.alive()) return;
    let tone = 'info';
    if (PAUSED.has(view.status)) tone = 'pause';
    else if (cancelled(view)) tone = 'muted';
    // same resident's tickets only (split / follow-up); a merge target may be someone else's, so it is shown inline
    const related = [
      view.split_from ? linked('Tách từ', view.split_from) : null,
      view.follow_up_of ? linked('Tiếp nối', view.follow_up_of) : null,
      ...view.split_into.map((t) => linked('Tách thành', t)),
    ].filter(Boolean);
    fill(live, el('section', { class: 'card pad detail' },
      el('div', { class: 'trow' }, el('span', { class: 'idb' }, `#${view.ticket_id}`), statusPill(view)),
      el('span', { class: 'muted small' }, `Thời gian gửi: ${formatTime(view.created_at)}`),
      el('h2', { class: 'dtitle' }, view.description),
      notice(view.public_message, tone, { id: 'public-message' }),
      stepper(view),
      infoGrid([
        ['Phòng ban tiếp nhận', view.department_name || 'Đang điều phối phân công'],
        ['Dự kiến xong', view.eta ? formatTime(view.eta) : null],
        ['Trạng thái', view.status_label],
      ]),
      actions,
      view.merged_into ? el('div', { class: 'box' }, el('span', { class: 'cap' }, `ĐÃ GỘP VÀO ${view.merged_into.ticket_id}`),
        el('div', {}, statusPill(view.merged_into)), el('span', { class: 'muted' }, view.merged_into.public_message)) : null,
      related.length ? el('div', { class: 'box' }, el('span', { class: 'cap' }, 'PHẢN ÁNH LIÊN QUAN'), related) : null,
      view.photos.length ? el('div', { class: 'box' }, el('span', { class: 'cap' }, 'ẢNH HIỆN TRƯỜNG'), photoStrip(view.photos)) : null,
      el('div', { class: 'box' }, el('span', { class: 'cap' }, 'THÔNG TIN BỔ SUNG TỪ BẠN'),
        view.additions.length ? el('ul', { class: 'extras' }, view.additions.map((text) => el('li', {}, text)))
          : el('span', { class: 'muted' }, 'Chưa có thông tin bổ sung.')),
      history('Lịch sử xử lý', [...view.timeline].reverse()
        .map((e) => ({ label: e.status_label, note: e.public_message, time: formatTime(e.created_at) })))));
    drawActions(view);
    ctx.updatedNow();
  };

  const run = (call, success) => async () => {
    try {
      const view = await call();
      toast(success);
      draw(view);
    } catch (err) {
      ctx.fail(err, { back: '#/r' });
      if (err.kind === 'conflict' || err.kind === 'forbidden') load().catch(() => {});
    }
  };

  const drawActions = (view) => {
    const blocks = [];
    if (view.allowed_actions.includes('ADD_INFO')) {
      const text = el('textarea', { class: 'field', id: 'addition-text', rows: 2, maxlength: '2000', placeholder: 'Thêm chi tiết, ví dụ: cuối hành lang tầng 4 tòa S1, gần thang bộ' });
      blocks.push(el('div', { class: 'act-box warn' }, el('b', {}, 'Ban tiếp nhận cần thêm thông tin'), text,
        writeButton('Gửi bổ sung', async () => {
          const content = text.value.trim();
          if (!content) { toast('Nhập nội dung bổ sung', 'warn'); return; }
          await run(() => api(path(id, '/additions'), { method: 'POST', body: { content } }), 'Đã gửi bổ sung')();
        })));
    }
    if (view.allowed_actions.includes('RATE')) {
      let score = 0;
      const label = el('b', {}, 'Chọn số sao');
      const stars = el('div', { class: 'stars', role: 'radiogroup', 'aria-label': 'Số sao' });
      const paint = () => {
        [...stars.children].forEach((b, i) => { b.classList.toggle('on', i < score); b.setAttribute('aria-checked', String(i + 1 === score)); });
        label.textContent = score ? STAR_LABEL[score] : 'Chọn số sao';
      };
      for (let i = 1; i <= 5; i += 1) {
        stars.append(el('button', {
          type: 'button', class: 'star', role: 'radio', 'aria-checked': 'false', 'aria-label': `${i} sao, ${STAR_LABEL[i]}`,
          dataset: { score: String(i) }, onclick: () => { score = i; paint(); },
        }, icon('star')));
      }
      blocks.push(el('div', { class: 'act-box rate', id: 'rating' },
        el('b', { class: 'big' }, 'Đánh giá kết quả xử lý'),
        el('span', { class: 'muted' }, `${view.department_name || 'Phòng ban'} đã hoàn tất. Đánh giá giúp Ban quản lý cải thiện chất lượng.`),
        el('div', { class: 'star-row' }, stars, label),
        writeButton('Gửi đánh giá', async () => {
          if (!score) { toast('Chọn số sao', 'warn'); return; }
          await run(() => api(path(id, '/rating'), { method: 'POST', body: { score } }), 'Cảm ơn bạn đã đánh giá')();
        })));
    }
    // photos: the engine takes them on any open ticket (add_resident_photo guards TERMINAL only), not just NEED_INFO
    const room = MAX_PHOTOS - view.photos.length;
    if (!TERMINAL.has(view.status) && room > 0) {
      const picker = photoPicker({ room: () => room });
      blocks.push(el('div', { class: 'act-box', id: 'add-photos' }, el('b', {}, 'Thêm ảnh hiện trường'), picker.node,
        writeButton('Tải ảnh lên', async () => {
          if (!picker.hasPhotos()) { toast('Chọn ít nhất một ảnh', 'warn'); return; }
          await run(() => apiForm(path(id, '/photos'), photoFormData(picker.blobs())), 'Đã tải ảnh lên')();
        }, { variant: '', busyLabel: 'Đang tải ảnh…' })));
    }
    fill(actions, blocks);
  };

  const load = async () => draw(await api(path(id)));
  try {
    await load();
  } catch (err) {
    if (err.kind === 'not_found') { ctx.fail(err, { back: '#/r' }); return; }
    fill(live, emptyState(err.message));
    throw err;
  }
  ctx.setLoader(load);
}

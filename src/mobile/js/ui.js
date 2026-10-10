// Shared UI helpers of the phone app. Strings from the API always go in as text nodes (00-ARCHITECTURE I-4).
// Look and feel copied from portal/ (plan 11 SPEC-P04): classes from portal/src/app/globals.css, icons from
// portal/src/components/icons.tsx, PageHead/notices/history from portal/src/app/resident/resident-app.tsx.

/** el('div', { class: 'card', onclick: fn, disabled: true }, 'text', child, null) */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key in node && typeof value !== 'string') node[key] = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  append(node, children);
  return node;
}

/** node.replaceChildren() that skips null/false like el() does (the DOM method would print "null"). */
export function fill(node, ...children) {
  node.replaceChildren();
  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// Static icon paths, path for path from portal/src/components/icons.tsx: [inner svg, default size, stroke width].
// Never API data, so building them from markup is safe.
const ICONS = {
  house: ['<path d="M3 10.5 12 4l9 6.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/>', 26, 1.8],
  bell: ['<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>', 26, 1.8],
  pen: ['<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 30, 1.7],
  clipboard: ['<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>', 30, 1.7],
  grid: ['<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>', 30, 1.7],
  table: ['<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>', 30, 1.7],
  briefcase: ['<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>', 30, 1.7],
  shield: ['<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>', 30, 1.7],
  checkSquare: ['<path d="m9 11 3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>', 30, 1.7],
  layers: ['<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>', 22, 1.8],
  building: ['<path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16"/><path d="M2 21h20M10 21v-5h4v5M9 8h1M14 8h1M9 12h1M14 12h1"/>', 22, 1.8],
  lift: ['<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m9 9 3-3 3 3M9 15l3 3 3-3"/>', 22, 1.8],
  pin: ['<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>', 22, 1.8],
  box: ['<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5M12 13v8"/>', 22, 1.8],
  warning: ['<path d="M12 4 2.5 20h19Z"/><path d="M12 10v4M12 17h.01"/>', 18, 2],
  upload: ['<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>', 28, 1.8],
  check: ['<path d="M5 12.5 10 17 19 7"/>', 26, 2.4],
  info: ['<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>', 18, 2],
  // app-only (no portal equivalent): same stroke style
  back: ['<path d="M15 18l-6-6 6-6"/>', 18, 2.2],
  refresh: ['<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>', 18, 2],
  camera: ['<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>', 20, 1.8],
  image: ['<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>', 20, 1.8],
  web: ['<rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 22h8M12 18v4"/>', 20, 1.8],
};
const STAR = '<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8Z"/>';

export function icon(name, size) {
  const span = document.createElement('span');
  span.setAttribute('aria-hidden', 'true');
  span.className = 'icn';
  if (name === 'star') {
    span.innerHTML = `<svg viewBox="0 0 24 24" width="${size || 34}" height="${size || 34}" fill="currentColor">${STAR}</svg>`;
    return span;
  }
  const [paths, base, width] = ICONS[name] || ['', 22, 2];
  const px = size || base;
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${px}" height="${px}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return span;
}

// ---------------------------------------------------------------- portal page parts

/** Name, initials and role pill from /auth/me. "Cư dân Nguyễn Văn Hùng (S2.05-1402)" → Nguyễn Văn Hùng · NV · Cư dân · Căn hộ S2.05-1402 */
export function person(me) {
  const raw = (me && (me.display_name || me.username)) || '';
  const match = raw.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  const extra = match ? match[2] : '';
  let name = match ? match[1] : raw;
  if (me && me.role === 'RESIDENT') name = name.replace(/^Cư dân\s+/i, '');
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'MO';
  let rolePill = extra || (me && me.role) || '';
  if (me && me.role === 'RESIDENT') rolePill = extra ? `Cư dân · Căn hộ ${extra}` : 'Cư dân';
  if (me && me.role === 'BQL') rolePill = 'Ban quản lý';
  return { name, initials, rolePill };
}

/** Title + subtitle under the tiles (shell.tsx PageHead); `back` = hash of the "Quay lại" link. */
export function pageHead(title, sub, { back = null, right = null } = {}) {
  return el('div', { class: 'page-head' },
    back ? el('a', { class: 'back-link', href: back }, icon('back'), 'Quay lại') : null,
    el('div', { class: 'page-head-row' }, el('h1', {}, title), right),
    sub ? el('p', {}, sub) : null);
}

/** Numbered step card header of the resident form (.num + title). */
export function stepHead(number, title, extra = null) {
  return el('div', { class: 'sec-head' },
    el('div', { class: 'sec-title' }, el('span', { class: 'num' }, String(number)), el('h2', {}, title)),
    extra);
}

/** Label/value pairs in an auto-fit grid (portal detail "info" block). Pairs with an empty value are skipped. */
export function infoGrid(pairs) {
  return el('div', { class: 'info-grid' }, pairs.filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => el('div', {}, el('span', { class: 'k' }, k), el('span', { class: 'v' }, v))));
}

/** Coloured notice box (portal: pause yellow, cancelled grey, info blue, danger red). */
export function notice(text, tone = 'info', attrs = {}) {
  return el('div', { class: `notice ${tone}`, role: 'status', ...attrs }, text);
}

/** "Lịch sử xử lý" timeline (.hd dots), newest first. items = [{ label, note, time }] */
export function history(title, items) {
  return el('div', { class: 'history' }, el('h3', {}, title),
    items.length ? items.map((h, i) => el('div', { class: 'hrow' },
      el('div', { class: 'hline' }, el('span', { class: i === 0 ? 'hd first' : 'hd' }), i < items.length - 1 ? el('span', { class: 'hbar' }) : null),
      el('div', { class: 'hbody' }, el('b', {}, h.label), h.note ? el('span', {}, h.note) : null, el('small', {}, h.time))))
      : el('span', { class: 'muted' }, 'Chưa có diễn biến.'));
}

/** Portal pill: <span class="pill …"><span class="dot"></span>label</span> */
export function pill(cls, label, { dot = true } = {}) {
  return el('span', { class: `pill ${cls}` }, dot ? el('span', { class: 'dot' }) : null, label);
}

export const TERMINAL = new Set(['CLOSED', 'MERGED', 'CANCELLED']);

/**
 * Q40: a ticket shows in ONE box only. boxes = [[key, test], …] in priority order; returns row → key of the first box
 * whose test passes (null = no box). Every count and filter of a box must go through this, never through its raw test.
 */
export const boxOf = (boxes) => (row) => (boxes.find(([, test]) => test(row)) || [null])[0];

export function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const two = (n) => String(n).padStart(2, '0');
  return `${two(d.getDate())}/${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

export function clock() {
  const d = new Date();
  const two = (n) => String(n).padStart(2, '0');
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

// ---------------------------------------------------------------- feedback

let toastTimer = null;
export function toast(message, tone = 'ok') {
  const box = document.getElementById('toast');
  box.textContent = message;
  box.className = `toast ${tone === 'ok' ? '' : tone}`;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, tone === 'error' ? 6000 : 3500);
}

/** Bottom-sheet confirmation. Resolves true only on the confirm button. */
export function confirmSheet(title, body, { confirmLabel = 'Xác nhận', danger = false } = {}) {
  const backdrop = document.getElementById('sheet');
  return new Promise((resolve) => {
    const close = (answer) => { backdrop.hidden = true; backdrop.replaceChildren(); resolve(answer); };
    const sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', onclick: (e) => e.stopPropagation() },
      el('h3', {}, title),
      body ? el('p', { class: 'muted pre' }, body) : null,
      el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'btn', onclick: () => close(false) }, 'Quay lại'),
        el('button', { type: 'button', class: `btn ${danger ? 'danger-solid' : 'primary'}`, 'data-confirm': '', onclick: () => close(true) }, confirmLabel)));
    backdrop.replaceChildren(sheet);
    backdrop.onclick = () => close(false);
    backdrop.hidden = false;
  });
}

// ---------------------------------------------------------------- writes (I-5, I-6)

/**
 * A button that writes to the server. It locks on the first tap until `run` settles (no double submit), and stays
 * disabled while offline (main.js toggles every [data-write] button). variant: primary | '' (outline) | danger | danger-solid
 */
export function writeButton(label, run, { variant = 'primary', busyLabel = 'Đang gửi…', type = 'button', block = true } = {}) {
  const button = el('button', { type, class: `btn ${variant} ${block ? 'block' : ''}`, dataset: { write: '' } }, label);
  if (navigator.onLine === false) button.disabled = true;
  button.addEventListener('click', async (event) => {
    if (type === 'submit') return; // the form's submit handler calls lockWhile itself
    event.preventDefault();
    await lockWhile(button, busyLabel, run);
  });
  return button;
}

/** Disable `button` (label → busyLabel) while `run()` runs; restore it afterwards. Returns run()'s result. */
export async function lockWhile(button, busyLabel, run) {
  if (button.dataset.busy) return undefined;
  const label = [...button.childNodes];
  button.dataset.busy = '1';
  button.disabled = true;
  button.replaceChildren(el('span', { class: 'spinner' }), busyLabel);
  try {
    return await run();
  } finally {
    delete button.dataset.busy;
    if (button.isConnected) {
      button.replaceChildren(...label);
      button.disabled = navigator.onLine === false;
    }
  }
}

/** "Tải lại" button that re-runs `load` (errors go through ctx.fail). */
export function refreshButton(load, ctx) {
  const button = el('button', { type: 'button', class: 'btn ghost', 'aria-label': 'Tải lại' }, icon('refresh'), 'Tải lại');
  button.addEventListener('click', () => lockWhile(button, 'Đang tải…', () => load().catch((e) => ctx.fail(e))));
  return button;
}

export function field(label, control, hint) {
  return el('label', { class: 'lbl' }, el('span', {}, label), control, hint ? el('span', { class: 'hint' }, hint) : null);
}

export function emptyState(text) {
  return el('div', { class: 'card empty' }, text);
}

/**
 * "Xem thêm" paging: renders `pageSize` more items per tap, no API call (same idea as plan 10).
 * `keep` = the node this list replaces: a refresh keeps as many items open as the user had.
 */
export function pagedList(items, renderItem, { pageSize = 20, empty = 'Chưa có dữ liệu', keep = null } = {}) {
  if (!items.length) return emptyState(empty);
  const list = el('ul', { class: 'tlist' });
  const wrapper = el('div', { dataset: { shown: '0' } }, list);
  const more = el('button', { type: 'button', class: 'btn block' }, 'Xem thêm');
  let shown = 0;
  const showMore = (count = pageSize) => {
    const next = items.slice(shown, shown + count);
    next.forEach((item) => list.append(el('li', {}, renderItem(item))));
    shown += next.length;
    wrapper.dataset.shown = String(shown);
    more.hidden = shown >= items.length;
  };
  more.addEventListener('click', () => showMore());
  const previous = keep && keep.dataset ? Number(keep.dataset.shown || 0) : 0;
  showMore(Math.max(pageSize, previous));
  wrapper.append(more);
  return wrapper;
}

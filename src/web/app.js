/* MaintenanceOps prototype UI.
 *
 * Plain JS + Tailwind. Every string that comes from the API (resident text especially) is inserted as a text node,
 * never as HTML, because resident content is untrusted data.
 */
'use strict';

const API = '/api/v1';
const TZ = '+07:00';

const TOKEN_KEY = 'mo-token';

// The server decides the role from the logged-in account; the UI only picks the matching screen.
const VIEW_BY_ROLE = {
  RESIDENT: 'resident', BPTN: 'bptn', DEPARTMENT: 'dept', WAREHOUSE: 'warehouse', BQL: 'bql',
};
const ROLE_LABEL = {
  RESIDENT: 'Cư dân', BPTN: 'BPTN', DEPARTMENT: 'Phòng ban', WAREHOUSE: 'Kho', BQL: 'Ban quản lý',
};
const VIEW_TEXT = {
  resident: ['Phản ánh của tôi', 'Gửi phản ánh về khu vực chung và theo dõi tiến độ xử lý như theo dõi đơn hàng.'],
  bptn: ['Hàng chờ xác minh', 'Các phản ánh Agent chưa thể tự quyết hoặc còn thiếu thông tin. Chọn một phản ánh để xác nhận hoặc bổ sung thông tin.'],
  dept: ['Việc của phòng ban', 'Nhận việc, cập nhật tiến độ và báo hoàn thành. Chỉ hiện phản ánh đã được giao cho phòng ban.'],
  warehouse: ['Nhập kho vật tư', 'Phản ánh đang tạm hoãn vì thiếu vật tư sẽ tự chạy tiếp khi kho nhập đủ.'],
  bql: ['Bảng điều khiển BQL', 'Theo dõi toàn bộ phản ánh, nghiệm thu, trả làm lại hoặc hủy.'],
};

// Status → badge colours. Colour is never the only signal: every badge also carries the label text.
const STATUS_STYLE = {
  RECEIVED: 'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  VERIFYING: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-500/30',
  ROUTED: 'bg-sky-50 text-sky-800 ring-sky-600/20 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-500/30',
  IN_PROGRESS: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-950/60 dark:text-indigo-300 dark:ring-indigo-500/30',
  READY_FOR_REVIEW: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-950/60 dark:text-violet-300 dark:ring-violet-500/30',
  CLOSED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-500/30',
  NEED_INFO: 'bg-orange-50 text-orange-800 ring-orange-600/20 dark:bg-orange-950/60 dark:text-orange-300 dark:ring-orange-500/30',
  ON_HOLD: 'bg-yellow-50 text-yellow-800 ring-yellow-600/20 dark:bg-yellow-950/60 dark:text-yellow-300 dark:ring-yellow-500/30',
  MERGED: 'bg-zinc-100 text-zinc-700 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
  CANCELLED: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-500/30',
  EMERGENCY_PENDING_BQL: 'bg-rose-100 text-rose-800 ring-rose-600/30 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-800',
  SAFETY_REVIEW_REQUIRED: 'bg-amber-100 text-amber-800 ring-amber-600/30 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800',
};
const REASON_LABEL = {
  MISSING_INFO: 'Thiếu thông tin',
  DUPLICATE: 'Nghi trùng',
  CATEGORY_UNCLEAR: 'Loại việc chưa rõ',
  OUT_OF_SCOPE: 'Ngoài phạm vi',
  PENDING_REVIEW: 'Cần BPTN xác nhận',
  ASSET_UNCLEAR: 'Chưa xác định tài sản',
  WAITING_MATERIAL: 'Chờ vật tư',
  OUT_OF_HOURS: 'Ngoài giờ phòng ban',
  NOT_ACCEPTED: 'Chưa có người nhận',
  WRONG_DEPT: 'Sai phòng ban',
  BLOCKED_ONSITE: 'Vướng tại hiện trường',
  REWORK: 'Làm lại',
  SAFETY_REVIEW_REQUIRED: 'Kiểm tra an toàn (Bậc 2)',
  EMERGENCY_PENDING_BQL: 'Khẩn cấp (Bậc 1)',
  WRONG_DEPT_AFTER_START: 'Báo sai sau khi làm',
};
const OWNER_LABEL = {
  RESIDENT: 'Cư dân', BPTN: 'BPTN', DEPARTMENT: 'Phòng ban', WAREHOUSE: 'Kho', SYSTEM: 'Hệ thống', BQL: 'BQL', AGENT: 'Agent',
};
const CATEGORY_LABEL = { VE_SINH: 'Vệ sinh', KY_THUAT: 'Kỹ thuật (đèn)' };
const RESIDENT_STEPS = ['RECEIVED', 'VERIFYING', 'ROUTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'CLOSED'];
const TERMINAL = new Set(['CLOSED', 'MERGED', 'CANCELLED']);

const state = {
  token: null,
  user: null, // { username, display_name, role, department_id }
  role: null, // screen key from VIEW_BY_ROLE
  selected: null,
  activeTab: 'workspace', // 'workspace' | 'ai-logs'
  catalog: { departments: {}, assets: [], status_labels: {}, materials: [] },
  bqlFilters: { status: '', department_id: '', escalated: false, overdue: false, emergency: false },
};

// ------------------------------------------------------------------ DOM helpers

/** Create an element. Children that are strings become text nodes (never parsed as HTML). */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const $ = (id) => document.getElementById(id);

const fmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : fmt.format(date);
}

function statusLabel(status) {
  return state.catalog.status_labels[status] || status;
}
function deptName(id) {
  return id ? state.catalog.departments[id] || id : null;
}

// ------------------------------------------------------------------ UI building blocks

const BTN = {
  primary: 'inline-flex min-h-[42px] sm:min-h-0 items-center justify-center gap-2 rounded-md bg-indigo-600 px-3.5 py-2 text-base sm:text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 active:scale-[0.98] transition-all disabled:cursor-not-allowed disabled:opacity-60',
  secondary: 'inline-flex min-h-[42px] sm:min-h-0 items-center justify-center gap-2 rounded-md bg-white px-3.5 py-2 text-base sm:text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 active:scale-[0.98] transition-all dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60',
  danger: 'inline-flex min-h-[42px] sm:min-h-0 items-center justify-center gap-2 rounded-md bg-white px-3.5 py-2 text-base sm:text-sm font-semibold text-rose-700 shadow-sm ring-1 ring-inset ring-rose-300 hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 active:scale-[0.98] transition-all dark:bg-slate-800 dark:text-rose-400 dark:ring-rose-900/60 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60',
};
const INPUT = 'block w-full min-h-[42px] rounded-md border-0 py-2 px-3 text-base sm:text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:placeholder:text-slate-500 dark:focus:ring-indigo-500 transition-colors';

function card(title, ...children) {
  return el('div', { class: 'rounded-xl bg-white p-4 sm:p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 transition-colors' },
    title ? el('h2', { class: 'text-base font-semibold text-slate-900 dark:text-white' }, title) : null,
    el('div', { class: title ? 'mt-4 space-y-4' : 'space-y-4' }, ...children));
}

function badge(status, label) {
  const style = STATUS_STYLE[status] || STATUS_STYLE.RECEIVED;
  const text = label || statusLabel(status);
  return el('span', {
    class: `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`,
    role: 'status',
    'aria-label': `Trạng thái: ${text}`,
  },
    el('span', { class: 'h-1.5 w-1.5 rounded-full bg-current', 'aria-hidden': 'true' }),
    text);
}

function chip(text, tone = 'slate') {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    amber: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300',
    rose: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
    indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  };
  return el('span', { class: `inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${tones[tone]}` }, text);
}

function field(label, control, hint) {
  const id = control.id || `f-${Math.random().toString(36).slice(2, 9)}`;
  control.id = id;
  const hintId = hint ? `${id}-hint` : null;
  if (hintId) control.setAttribute('aria-describedby', hintId);
  return el('div', {},
    el('label', { for: id, class: 'block text-sm font-medium text-slate-800 dark:text-slate-200' }, label),
    el('div', { class: 'mt-1.5' }, control),
    hint ? el('p', { id: hintId, class: 'mt-1.5 text-xs text-slate-500 dark:text-slate-400' }, hint) : null);
}

function dl(rows) {
  return el('dl', { class: 'grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-3' },
    rows.filter(Boolean).flatMap(([term, value]) => [
      el('dt', { class: 'font-medium text-slate-500 dark:text-slate-400' }, term),
      el('dd', { class: 'text-slate-900 dark:text-slate-100 sm:col-span-2' }, value ?? '—'),
    ]));
}

function callout(tone, title, body) {
  const tones = {
    info: 'bg-sky-50 text-sky-900 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900/50',
    warn: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900/50',
    danger: 'bg-rose-50 text-rose-900 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-900/50',
    ok: 'bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900/50',
  };
  return el('div', { class: `rounded-lg p-4 text-sm ring-1 ring-inset ${tones[tone]}` },
    title ? el('p', { class: 'font-semibold' }, title) : null,
    body ? el('p', { class: title ? 'mt-1' : '' }, body) : null);
}

function emptyState(title, body) {
  return el('div', { class: 'rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 px-6 py-10 text-center' },
    el('p', { class: 'text-sm font-semibold text-slate-800 dark:text-slate-200' }, title),
    body ? el('p', { class: 'mt-1 text-sm text-slate-500 dark:text-slate-400' }, body) : null);
}

function skeleton(lines = 3) {
  return el('div', { class: 'animate-pulse space-y-3', 'aria-busy': 'true', 'aria-label': 'Đang tải' },
    Array.from({ length: lines }, () => el('div', { class: 'h-14 rounded-lg bg-slate-200/70 dark:bg-slate-800/70' })));
}

/** A form whose submit button shows progress and cannot be double-submitted. */
function actionForm(children, submitLabel, onSubmit, { variant = 'primary', extraButtons = [], busyLabel = 'Đang xử lý…' } = {}) {
  const button = el('button', { type: 'submit', class: BTN[variant] }, submitLabel);
  const form = el('form', { class: 'space-y-4', novalidate: true },
    ...children,
    el('div', { class: 'flex flex-wrap items-center gap-3' }, button, ...extraButtons));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    button.disabled = true;
    const original = button.textContent;
    button.textContent = busyLabel;
    try {
      await onSubmit(new FormData(form));
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  });
  return form;
}

function toast(message, tone = 'ok') {
  const tones = {
    ok: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
    error: 'bg-rose-600 text-white',
  };
  const node = el('div', {
    class: `pointer-events-auto max-w-sm rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${tones[tone]}`,
    role: tone === 'error' ? 'alert' : 'status',
    'aria-live': tone === 'error' ? 'assertive' : 'polite',
    'aria-atomic': 'true',
  }, message);
  $('toasts').append(node);
  setTimeout(() => node.remove(), tone === 'error' ? 7000 : 4000);
}

function confirmDialog(title, body) {
  const triggerElement = document.activeElement;
  const dialog = $('confirm');
  $('confirm-title').textContent = title;
  $('confirm-body').textContent = body;
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      if (triggerElement && typeof triggerElement.focus === 'function') {
        triggerElement.focus();
      }
      resolve(dialog.returnValue === 'ok');
    }, { once: true });
  });
}

// ------------------------------------------------------------------ API

function errorMessage(detail, status) {
  if (!detail) return `Lỗi ${status}`;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join('; ');
  return detail.message || `Lỗi ${status}`;
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const form = body instanceof FormData;  // the browser sets the multipart boundary itself
  if (body !== undefined && !form) headers['Content-Type'] = 'application/json';
  const payload = body === undefined || form ? body : JSON.stringify(body);
  const response = await fetch(API + path, { method, headers, body: payload });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.status === 401 && state.token) {
    // Session expired or revoked: back to the login screen
    signOut({ remote: false, message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
  }
  if (!response.ok) throw new Error(errorMessage(data && data.detail, response.status));
  return data;
}

/** Run an action, toast the outcome, refresh the screen. */
async function act(promise, success) {
  try {
    await promise;
    toast(success);
    await render();
  } catch (error) {
    toast(error.message, 'error');
  }
}

/** Only send fields that have a value. */
function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, v]) => v !== '' && v !== null && v !== undefined));
}

function localToIso(value) {
  return value ? `${value.length === 16 ? `${value}:00` : value}${TZ}` : undefined;
}

// ------------------------------------------------------------------ shared ticket pieces

function listItem(ticket, { title, meta, right }) {
  const selected = state.selected === ticket;
  return el('li', {},
    el('button', {
      type: 'button',
      class: `w-full rounded-lg px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${selected ? 'bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-950/50 dark:ring-indigo-500/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`,
      'aria-current': selected ? 'true' : undefined,
      onclick: () => select(ticket),
    },
    el('div', { class: 'flex items-start justify-between gap-3' },
      el('div', { class: 'min-w-0' },
        el('p', { class: 'text-sm font-semibold text-slate-900 dark:text-white' }, ticket),
        el('p', { class: 'mt-0.5 truncate text-sm text-slate-600 dark:text-slate-300' }, title || '(không có nội dung)')),
      right),
    meta ? el('div', { class: 'mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400' }, meta) : null));
}

function listCard(title, count, items, empty) {
  return card(null,
    el('div', { class: 'flex items-center justify-between' },
      el('h2', { class: 'text-base font-semibold text-slate-900 dark:text-white' }, title),
      el('span', { class: 'text-xs font-medium text-slate-500 dark:text-slate-400' }, `${count} phản ánh`)),
    items.length ? el('ul', { class: '-mx-2 space-y-1' }, items) : emptyState(empty[0], empty[1]));
}

function detailHeader(ticketId, status, extra, customLabel) {
  return el('div', { class: 'flex flex-wrap items-start justify-between gap-3' },
    el('div', {},
      el('h2', { id: 'detail-title', tabindex: '-1', class: 'text-lg font-semibold text-slate-900 dark:text-white focus:outline-none' }, `Phản ánh ${ticketId}`),
      extra ? el('p', { class: 'mt-0.5 text-sm text-slate-500 dark:text-slate-400' }, extra) : null),
    badge(status, customLabel));
}

function reportText(description, additions) {
  return el('div', { class: 'space-y-3' },
    el('div', { class: 'rounded-lg bg-slate-50 p-4 ring-1 ring-inset ring-slate-200 dark:bg-slate-950/60 dark:ring-slate-800' },
      el('p', { class: 'text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Nội dung gốc · không thể sửa'),
      el('p', { class: 'mt-1 whitespace-pre-line text-sm text-slate-900 dark:text-slate-100' }, description.trim() || '(trống)')),
    additions.length
      ? el('div', { class: 'rounded-lg bg-white p-4 ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:ring-slate-800' },
          el('p', { class: 'text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Thông tin bổ sung'),
          el('ul', { class: 'mt-1 list-disc space-y-1 pl-5 text-sm text-slate-900 dark:text-slate-100' }, additions.map((a) => el('li', {}, a))))
      : null);
}

// ------------------------------------------------------------------ photos

const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';

function photoInput({ required = false } = {}) {
  return el('input', {
    name: 'files', type: 'file', multiple: true, accept: PHOTO_ACCEPT, required,
    class: 'block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-200 dark:file:bg-slate-800 dark:file:text-slate-200 dark:hover:file:bg-slate-700 transition',
  });
}

/** Chosen files as multipart form data, or null when none were picked. Throws on a file the server would refuse,
 * so a new report is not created only for its photos to bounce afterwards. */
function photoForm(data) {
  const files = data.getAll('files').filter((f) => f instanceof File && f.size > 0);
  if (!files.length) return null;
  if (files.length > 5) throw new Error('Mỗi lần gửi tối đa 5 ảnh');
  const bad = files.find((f) => !PHOTO_ACCEPT.split(',').includes(f.type) || f.size > 5 * 1024 * 1024);
  if (bad) throw new Error(`${bad.name}: chỉ nhận ảnh JPG, PNG hoặc WEBP, tối đa 5 MB`);
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  return form;
}

/** Photo URLs need the login token, so an <img src> cannot load them directly: fetch, then show the blob. */
function photoThumb(item) {
  const tile = 'flex h-24 w-24 items-center justify-center rounded-lg bg-slate-100 p-2 text-center text-xs text-slate-500 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700';
  if (typeof item !== 'string') return el('span', { class: tile, title: item.text }, 'Ảnh mô phỏng (dữ liệu mẫu)');
  const path = item;
  const img = el('img', { alt: 'Ảnh đính kèm', class: 'h-full w-full object-cover', loading: 'lazy' });
  const link = el('a', { target: '_blank', rel: 'noopener', class: 'block h-24 w-24 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-inset ring-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:bg-slate-800 dark:ring-slate-700' }, img);
  fetch(API + path, { headers: state.token ? { Authorization: `Bearer ${state.token}` } : {} })
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      img.src = url;
      link.href = url;
    })
    .catch(() => link.replaceChildren(el('span', { class: 'flex h-full items-center justify-center p-2 text-center text-xs text-slate-500 dark:text-slate-400' }, 'Không tải được ảnh')));
  return link;
}

function photoGallery(title, paths, empty) {
  if (!paths.length && !empty) return null;
  return el('div', {},
    el('p', { class: 'text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400' }, title),
    paths.length
      ? el('div', { class: 'mt-2 flex flex-wrap gap-2' }, paths.map(photoThumb))
      : el('p', { class: 'mt-1 text-sm text-slate-500 dark:text-slate-400' }, empty));
}

/** Resident and department photos from a full (internal) case. */
// Uploaded photos are stored under a server-generated name; fixture photos only carry a description
const STORED_PHOTO = /^[0-9a-f]{32}\.(jpg|png|webp)$/;

function caseImages(c, source, filter = () => true) {
  return c.evidence
    .filter((e) => e.source === source && (e.evidence_type === 'RESIDENT_ORIGINAL' || e.evidence_type === 'SIMULATED_IMAGE') && filter(e))
    .map((e) => (STORED_PHOTO.test(e.content_or_metadata)
      ? `/mo/tickets/${c.ticket.ticket_id}/photos/${e.evidence_id}`
      : { text: e.content_or_metadata }));
}

function residentPhotosInternal(c) {
  return photoGallery('Ảnh cư dân gửi', caseImages(c, 'RESIDENT_ORIGINAL'));
}

/** Department photos for the current work order (a rework starts a new one). */
function executionPhotos(c) {
  const draftId = c.draft && c.draft.work_order_draft_id;
  return caseImages(c, 'DEPARTMENT_EXECUTION', (e) => e.work_order_draft_id === draftId);
}

function blockerCard(blocker) {
  if (!blocker) return null;
  return el('div', { class: `rounded-lg p-4 ring-1 ring-inset ${blocker.escalated ? 'bg-rose-50 ring-rose-200 dark:bg-rose-950/50 dark:ring-rose-900/60' : 'bg-amber-50 ring-amber-200 dark:bg-amber-950/50 dark:ring-amber-900/60'}` },
    el('div', { class: 'flex flex-wrap items-center gap-2' },
      el('p', { class: 'text-sm font-semibold text-slate-900 dark:text-white' }, `Đang dừng: ${REASON_LABEL[blocker.code] || blocker.code}`),
      blocker.escalated ? chip('Đã leo thang', 'rose') : null),
    el('div', { class: 'mt-3' }, dl([
      ['Người gỡ', OWNER_LABEL[blocker.owner_role] || blocker.owner_role],
      ['Từ lúc', formatTime(blocker.since)],
      blocker.resume_step ? ['Chạy lại từ', `Bước ${blocker.resume_step}`] : null,
      ['Đã nhắc', `${blocker.auto_retry_count} lần`],
      blocker.escalate_at ? ['Leo thang lúc', formatTime(blocker.escalate_at)] : null,
      blocker.eta ? ['Dự kiến', formatTime(blocker.eta)] : null,
      blocker.internal_note ? ['Ghi chú nội bộ', blocker.internal_note] : null,
    ])));
}

function routeChecklist(ticket) {
  const checks = [
    ['BPTN review', ['NOT_REQUIRED', 'CONFIRMED'].includes(ticket.review_status), ticket.review_status || 'chưa xét'],
    ['Tài sản', ['FOUND', 'ONSITE_BY_BPTN', 'NOT_APPLICABLE'].includes(ticket.asset_resolution), ticket.asset_resolution || 'chưa xác định'],
    ['Phòng ban đề xuất', Boolean(ticket.proposed_department_id), deptName(ticket.proposed_department_id) || 'chưa có'],
  ];
  return el('div', {},
    el('p', { class: 'text-sm font-medium text-slate-800 dark:text-slate-200' }, 'Điều kiện giao phòng ban'),
    el('ul', { class: 'mt-2 space-y-1.5' }, checks.map(([name, ok, value]) =>
      el('li', { class: 'flex items-center gap-2 text-sm' },
        el('span', { class: `inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${ok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`, 'aria-hidden': 'true' }, ok ? '✓' : '·'),
        el('span', { class: 'font-medium text-slate-800 dark:text-slate-200' }, name),
        el('span', { class: 'text-slate-500 dark:text-slate-400' }, `— ${value}${ok ? '' : ' (chưa đạt)'}`)))));
}

function internalTimeline(events) {
  return el('ol', { class: 'relative space-y-4 border-l border-slate-200 dark:border-slate-800 pl-5' },
    [...events].reverse().map((e) => el('li', { class: 'relative' },
      el('span', { class: 'absolute -left-[1.6rem] top-1 h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700 ring-4 ring-white dark:ring-slate-900', 'aria-hidden': 'true' }),
      el('div', { class: 'flex flex-wrap items-center gap-2' },
        badge(e.to_status),
        e.reason_code ? chip(REASON_LABEL[e.reason_code] || e.reason_code) : null,
        el('span', { class: 'text-xs text-slate-500 dark:text-slate-400' }, `${formatTime(e.created_at)} · ${OWNER_LABEL[e.actor_role] || e.actor_role}`)),
      el('p', { class: 'mt-1 text-sm text-slate-700 dark:text-slate-300' }, e.public_message),
      e.internal_note ? el('p', { class: 'mt-0.5 text-xs text-slate-500 dark:text-slate-400' }, `Ghi chú: ${e.internal_note}`) : null)));
}

function formatAuditValue(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function auditTable(auditList) {
  if (!auditList || !auditList.length) {
    return emptyState('Chưa có nhật ký kiểm toán', 'Các thao tác nghiệp vụ bất biến sẽ được lưu trữ tại đây.');
  }

  const rows = [...auditList].reverse().map((entry) => {
    const isAllowed = entry.action_result === 'ALLOWED';
    const oldStr = formatAuditValue(entry.old_value);
    const newStr = formatAuditValue(entry.new_value);
    const hasDiff = entry.old_value !== null && entry.old_value !== undefined;

    return el('tr', { class: 'border-b border-slate-100 hover:bg-slate-50/60 dark:border-slate-800/80 dark:hover:bg-slate-800/40 text-xs transition' },
      el('td', { class: 'py-2.5 px-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap' }, formatTime(entry.timestamp)),
      el('td', { class: 'py-2.5 px-3' },
        el('div', { class: 'font-medium text-slate-900 dark:text-slate-200' }, OWNER_LABEL[entry.actor_role] || entry.actor_role),
        el('div', { class: 'font-mono text-[11px] text-slate-500 dark:text-slate-400' }, entry.actor_id)),
      el('td', { class: 'py-2.5 px-3' },
        el('span', { class: 'inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 ring-1 ring-inset ring-slate-200 dark:ring-slate-700' }, entry.action)),
      el('td', { class: 'py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300' },
        `${entry.entity_type}${entry.field_name ? ` · ${entry.field_name}` : ''}`),
      el('td', { class: 'py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-[200px] truncate' },
        hasDiff
          ? el('span', { title: `${oldStr} → ${newStr}` },
              el('span', { class: 'text-slate-400 line-through mr-1' }, oldStr),
              el('span', { class: 'font-medium text-indigo-600 dark:text-indigo-400' }, `→ ${newStr}`))
          : el('span', { title: newStr }, newStr)),
      el('td', { class: 'py-2.5 px-3 text-slate-600 dark:text-slate-400' },
        el('div', {}, entry.reason || '—'),
        entry.rule_id ? el('div', { class: 'font-mono text-[10px] text-indigo-600 dark:text-indigo-400' }, entry.rule_id) : null),
      el('td', { class: 'py-2.5 px-3 whitespace-nowrap' },
        el('span', {
          role: 'status',
          'aria-label': `Kết quả kiểm toán: ${isAllowed ? 'Cho phép' : 'Từ chối'}`,
          class: `inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${isAllowed ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/60 dark:text-rose-300'}`,
        }, isAllowed ? 'ALLOWED' : 'DENIED')));
  });

  return el('div', { class: 'overflow-x-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-800' },
    el('table', { class: 'min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left' },
      el('caption', { class: 'sr-only' }, 'Nhật ký kiểm toán hệ thống append-only ghi nhận toàn bộ biến động nghiệp vụ'),
      el('thead', { class: 'bg-slate-50 dark:bg-slate-800/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400' },
        el('tr', {},
          el('th', { scope: 'col', class: 'py-2.5 px-3' }, 'Thời gian'),
          el('th', { scope: 'col', class: 'py-2.5 px-3' }, 'Tác nhân'),
          el('th', { scope: 'col', class: 'py-2.5 px-3' }, 'Hành động'),
          el('th', { scope: 'col', class: 'py-2.5 px-3' }, 'Đối tượng & Trường'),
          el('th', { scope: 'col', class: 'py-2.5 px-3' }, 'Biến động'),
          el('th', { scope: 'col', class: 'py-2.5 px-3' }, 'Lý do / Quy tắc'),
          el('th', { scope: 'col', class: 'py-2.5 px-3' }, 'Kết quả'))),
      el('tbody', { class: 'divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900' }, rows)));
}

function auditTrailAndTimeline(c) {
  const events = c.events || [];
  const audit = c.audit || [];
  let currentTab = 'timeline';

  const container = el('div', { class: 'border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4' });
  const tabHeader = el('div', { class: 'flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2' });
  const tabList = el('div', { class: 'flex items-center gap-2', role: 'tablist', 'aria-label': 'Lịch sử và nhật ký kiểm toán' });
  const panel = el('div', { role: 'tabpanel', tabindex: '0' });

  function renderView() {
    tabList.replaceChildren();

    const tBtn = el('button', {
      type: 'button',
      role: 'tab',
      id: 'tab-timeline-btn',
      'aria-controls': 'tab-timeline-panel',
      'aria-selected': currentTab === 'timeline' ? 'true' : 'false',
      class: `flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${currentTab === 'timeline' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`,
      onclick: () => { currentTab = 'timeline'; renderView(); },
    },
      el('span', {}, 'Lịch sử trạng thái'),
      el('span', { class: 'inline-flex items-center rounded-full bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 text-[10px] font-bold text-slate-700 dark:text-slate-300' }, String(events.length)));

    const aBtn = el('button', {
      type: 'button',
      role: 'tab',
      id: 'tab-audit-btn',
      'aria-controls': 'tab-audit-panel',
      'aria-selected': currentTab === 'audit' ? 'true' : 'false',
      class: `flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${currentTab === 'audit' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`,
      onclick: () => { currentTab = 'audit'; renderView(); },
    },
      el('span', {}, 'Nhật ký kiểm toán (Audit Trail)'),
      el('span', { class: 'inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-950 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700 dark:text-indigo-300' }, String(audit.length)));

    tabList.append(tBtn, aBtn);
    panel.replaceChildren();

    if (currentTab === 'timeline') {
      panel.id = 'tab-timeline-panel';
      panel.setAttribute('aria-labelledby', 'tab-timeline-btn');
      panel.append(internalTimeline(events));
    } else {
      panel.id = 'tab-audit-panel';
      panel.setAttribute('aria-labelledby', 'tab-audit-btn');
      panel.append(auditTable(audit));
    }
  }

  tabHeader.append(
    el('h3', { class: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Lịch sử & Truy vết kiểm toán'),
    tabList);

  container.append(tabHeader, panel);
  renderView();
  return container;
}

function select(ticketId) {
  state.selected = ticketId;
  render().then(() => {
    const heading = $('detail-title');
    if (heading) {
      heading.focus({ preventScroll: true });
      if (window.matchMedia('(max-width: 1023px)').matches) heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function pickDetail() {
  return emptyState('Chưa chọn phản ánh', 'Chọn một phản ánh ở danh sách để xem chi tiết.');
}

// ------------------------------------------------------------------ resident

async function renderResident(list, detail) {
  const tickets = await api('/resident/tickets');
  if (!state.selected && tickets.length) state.selected = tickets[0].ticket_id;

  const description = el('textarea', { name: 'description', rows: '4', required: true, maxlength: '1000', class: INPUT, placeholder: 'Ví dụ: Tòa SIM-A / Tầng 3 / Hành lang: bóng đèn chập chờn không sáng.' });
  const when = el('input', { name: 'when', type: 'datetime-local', class: INPUT });

  // 3-tier Location Selector (Tòa / Tầng / Khu vực)
  const bldgSelect = dropdown('building', [
    ['Tòa SIM-A', 'Tòa SIM-A'],
    ['Tòa SIM-B', 'Tòa SIM-B'],
    ['Tòa SIM-C', 'Tòa SIM-C'],
    ['Khuôn viên ngoài trời', 'Khuôn viên ngoài trời'],
  ], { placeholder: 'Chọn tòa nhà…' });

  const floorSelect = dropdown('floor', [
    ['Tầng 1', 'Tầng 1'], ['Tầng 2', 'Tầng 2'], ['Tầng 3', 'Tầng 3'],
    ['Tầng 4', 'Tầng 4'], ['Tầng 5', 'Tầng 5'], ['Tầng 6', 'Tầng 6'],
    ['Tầng 7', 'Tầng 7'], ['Tầng hầm B1', 'Tầng hầm B1'], ['Tầng hầm B2', 'Tầng hầm B2'],
    ['Tầng trệt', 'Tầng trệt'],
  ], { placeholder: 'Chọn tầng…' });

  const zoneSelect = dropdown('zone', [
    ['Hành lang', 'Hành lang'],
    ['Sảnh thang máy', 'Sảnh thang máy'],
    ['Thang bộ', 'Thang bộ'],
    ['Phòng rác tầng', 'Phòng rác tầng'],
    ['Bãi đỗ xe', 'Bãi đỗ xe'],
    ['Sân chơi', 'Sân chơi'],
  ], { placeholder: 'Chọn khu vực…' });

  const insertLocBtn = el('button', {
    type: 'button',
    class: 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600',
    onclick: () => {
      const parts = [bldgSelect.value, floorSelect.value, zoneSelect.value].filter(Boolean);
      if (!parts.length) {
        toast('Vui lòng chọn ít nhất Tòa, Tầng hoặc Khu vực trước khi chèn', 'error');
        return;
      }
      const locTag = parts.join(' / ');
      const cur = description.value.trim();
      description.value = cur ? `${locTag}: ${cur}` : `${locTag}: `;
      description.focus();
      toast('Đã chèn vị trí chuẩn vào mô tả');
    },
  },
    el('svg', { class: 'h-4 w-4 text-indigo-600 dark:text-indigo-400', 'aria-hidden': 'true', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
      el('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' })),
    el('span', {}, 'Chèn vị trí chuẩn vào mô tả'));

  const locationSection = el('fieldset', { class: 'rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3 dark:border-slate-800 dark:bg-slate-800/40' },
    el('legend', { class: 'text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 px-1' }, 'Bộ chọn vị trí chuẩn (Hỗ trợ AI trích xuất)'),
    el('div', { class: 'grid grid-cols-1 sm:grid-cols-3 gap-3' },
      field('Tòa nhà', bldgSelect),
      field('Tầng', floorSelect),
      field('Khu vực cụ thể', zoneSelect)),
    el('div', { class: 'flex justify-end' }, insertLocBtn));

  // Channel dropdown
  const channelSelect = dropdown('channel', [
    ['form', 'Cổng cư dân trực tuyến (Web Portal)'],
    ['app', 'Ứng dụng di động (Resident App)'],
    ['hotline', 'Tổng đài CSKH / Zalo tiếp nhận'],
  ], { placeholder: 'Chọn kênh gửi…' });
  channelSelect.value = 'form';

  // Photo Input + Live Preview
  const pInput = photoInput();
  const previewBox = el('div', { class: 'mt-2 hidden space-y-2', 'aria-live': 'polite' });

  pInput.addEventListener('change', () => {
    previewBox.replaceChildren();
    const files = Array.from(pInput.files || []);
    if (!files.length) {
      previewBox.classList.add('hidden');
      return;
    }
    previewBox.classList.remove('hidden');

    const summaryText = el('p', { class: 'text-xs font-semibold text-slate-700 dark:text-slate-300' },
      `Đã chọn ${files.length}/5 ảnh đính kèm:`);
    const thumbsRow = el('div', { class: 'flex flex-wrap gap-2' }, files.map((f) => {
      const sizeKb = Math.round(f.size / 1024);
      const isOver = f.size > 5 * 1024 * 1024;
      return el('div', { class: `flex items-center gap-1.5 rounded-lg border p-1.5 text-xs ${isOver ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300' : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}` },
        el('span', { class: 'font-medium truncate max-w-[130px]' }, f.name),
        el('span', { class: 'text-[11px] text-slate-500 dark:text-slate-400' }, `${sizeKb} KB`));
    }));

    previewBox.append(summaryText, thumbsRow);
  });

  const photoField = el('div', {},
    field('Ảnh hiện trường (không bắt buộc)', pInput, 'Tối đa 5 ảnh JPG, PNG hoặc WEBP, mỗi ảnh tối đa 5 MB.'),
    previewBox);

  const submitAlert = el('div', { class: 'hidden' });

  list.append(card('Gửi phản ánh mới',
    actionForm([
      submitAlert,
      locationSection,
      field('Nội dung phản ánh', description, 'Ghi rõ tình trạng thực tế để Agent phân loại chính xác.'),
      field('Kênh tiếp nhận', channelSelect, 'Kênh cư dân gửi phản ánh vào hệ thống.'),
      photoField,
      el('details', { class: 'group rounded-md' },
        el('summary', { class: 'cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200' }, 'Tùy chọn demo'),
        el('div', { class: 'mt-3' }, field('Giả lập giờ gửi', when, 'Để trống nếu dùng giờ hiện tại. Phòng ban làm việc 06:00–22:00.'))),
    ], 'Gửi phản ánh', async (data) => {
      submitAlert.classList.add('hidden');
      const desc = (data.get('description') || '').trim();
      if (desc.length < 5) {
        submitAlert.replaceChildren(callout('warn', 'Nội dung phản ánh quá ngắn', 'Vui lòng mô tả ít nhất 5 ký tự để AI nhận diện vị trí và sự cố.'));
        submitAlert.classList.remove('hidden');
        description.focus();
        return;
      }
      try {
        const files = photoForm(data);
        const created = await api('/resident/tickets', {
          method: 'POST',
          body: compact({
            original_description: desc,
            channel: data.get('channel') || 'form',
            simulated_received_at: localToIso(data.get('when')),
          }),
        });
        state.selected = created.ticket_id;
        try {
          if (files) await api(`/resident/tickets/${created.ticket_id}/photos`, { method: 'POST', body: files });
          toast(`Đã gửi phản ánh ${created.ticket_id}`);
        } catch (error) {
          toast(`Đã gửi phản ánh ${created.ticket_id} nhưng chưa tải được ảnh: ${error.message}`, 'error');
        }
        await render();
      } catch (error) {
        submitAlert.replaceChildren(callout('danger', 'Lỗi gửi phản ánh', error.message || 'Không thể kết nối đến máy chủ.'));
        submitAlert.classList.remove('hidden');
        toast(error.message, 'error');
      }
    }, { busyLabel: 'Đang gửi phản ánh & AI xử lý…' })));

  list.append(listCard('Phản ánh đã gửi', tickets.length,
    tickets.map((t) => {
      const channelLabel = { form: 'Web', app: 'App di động', hotline: 'Hotline' }[t.channel] || t.channel;
      const isUnderCheck = t.status === 'VERIFYING' || t.status === 'EMERGENCY_PENDING_BQL' || t.status === 'SAFETY_REVIEW_REQUIRED';
      return listItem(t.ticket_id, {
        title: t.description,
        meta: [
          formatTime(t.created_at),
          channelLabel ? chip(channelLabel, 'slate') : null,
        ],
        right: isUnderCheck ? badge('VERIFYING', 'Đang được kiểm tra') : badge(t.status, t.status_label),
      });
    }),
    ['Bạn chưa gửi phản ánh nào', 'Phản ánh bạn gửi sẽ hiện ở đây kèm trạng thái xử lý.']));

  const view = tickets.find((t) => t.ticket_id === state.selected);
  detail.append(view ? residentDetail(view) : pickDetail());
}

function residentStepper(view) {
  const isSafetyReview = view.status === 'VERIFYING' || view.status === 'EMERGENCY_PENDING_BQL' || view.status === 'SAFETY_REVIEW_REQUIRED';
  const displayStatus = isSafetyReview ? 'VERIFYING' : view.status;
  const reached = new Set(view.timeline.map((e) => e.status));
  if (isSafetyReview) reached.add('VERIFYING');
  const current = RESIDENT_STEPS.indexOf(displayStatus);
  return el('ol', { class: 'grid grid-cols-3 sm:grid-cols-6 gap-2', 'aria-label': 'Tiến độ xử lý' },
    RESIDENT_STEPS.map((step, index) => {
      const done = reached.has(step) && (current === -1 || index <= current);
      const isCurrent = step === displayStatus;
      const stepLabel = step === 'VERIFYING' ? 'Đang kiểm tra' : statusLabel(step);
      return el('li', { class: 'flex flex-col gap-2', 'aria-current': isCurrent ? 'step' : undefined },
        el('span', { class: `h-1.5 rounded-full ${done ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-200 dark:bg-slate-800'}`, 'aria-hidden': 'true' }),
        el('span', { class: `text-xs ${isCurrent ? 'font-semibold text-indigo-700 dark:text-indigo-400' : done ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}` },
          stepLabel, done ? el('span', { class: 'sr-only' }, ' (đã qua)') : null));
    }));
}

function residentDetail(view) {
  const isSafetyReview = view.status === 'VERIFYING' || view.status === 'EMERGENCY_PENDING_BQL' || view.status === 'SAFETY_REVIEW_REQUIRED';
  const displayLabel = isSafetyReview ? 'Đang được kiểm tra' : view.status_label;
  const tone = { NEED_INFO: 'warn', ON_HOLD: 'warn', CANCELLED: 'danger', CLOSED: 'ok' }[view.status] || 'info';
  const sections = [
    detailHeader(view.ticket_id, isSafetyReview ? 'VERIFYING' : view.status, `Gửi lúc ${formatTime(view.created_at)}`, displayLabel),
    callout(tone, view.public_message, view.eta ? `Dự kiến: ${formatTime(view.eta)}` : null),
    residentStepper(view),
    dl([['Phòng ban xử lý', view.department_name || 'Chưa giao']]),
    view.merged_into ? callout('info', `Đã gộp vào phản ánh ${view.merged_into.ticket_id}`,
      `${view.merged_into.status_label}: ${view.merged_into.public_message}`) : null,
    reportText(view.description, view.additions),
    photoGallery('Ảnh bạn đã gửi', view.photos.map((id) => `/resident/tickets/${view.ticket_id}/photos/${id}`)),
  ];

  if (view.allowed_actions.includes('ADD_INFO')) {
    const content = el('textarea', { name: 'content', rows: '3', required: true, maxlength: '1000', class: INPUT });
    sections.push(el('div', { class: 'border-t border-slate-200 dark:border-slate-800 pt-5' },
      actionForm([
        field('Bổ sung thông tin', content, 'Nội dung gốc được giữ nguyên; phần này được thêm vào sau.'),
        field('Thêm ảnh (không bắt buộc)', photoInput(), 'Tối đa 5 ảnh mỗi phản ánh.'),
      ], 'Gửi bổ sung', (data) => act((async () => {
        const files = photoForm(data);
        await api(`/resident/tickets/${view.ticket_id}/additions`, { method: 'POST', body: { content: data.get('content') } });
        if (files) await api(`/resident/tickets/${view.ticket_id}/photos`, { method: 'POST', body: files });
      })(), 'Đã gửi thông tin bổ sung'),
        { variant: 'secondary' })));
  }
  if (view.allowed_actions.includes('RATE')) {
    const stars = el('fieldset', {},
      el('legend', { class: 'text-sm font-medium text-slate-800 dark:text-slate-200' }, 'Đánh giá chất lượng xử lý (1 lần duy nhất)'),
      el('div', { class: 'mt-2 flex gap-2' }, [1, 2, 3, 4, 5].map((n) => el('label', { class: 'cursor-pointer' },
        el('input', { type: 'radio', name: 'score', value: String(n), required: true, class: 'peer sr-only' }),
        el('span', { class: 'flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold ring-1 ring-slate-300 dark:ring-slate-700 dark:text-slate-200 peer-checked:bg-indigo-600 peer-checked:text-white peer-checked:ring-indigo-600 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-600 transition' }, n)))));
    sections.push(el('div', { class: 'border-t border-slate-200 dark:border-slate-800 pt-5' },
      actionForm([stars], 'Gửi đánh giá', (data) => act(api(`/resident/tickets/${view.ticket_id}/rating`, { method: 'POST', body: { score: Number(data.get('score')) } }), 'Cảm ơn bạn đã đánh giá'))));
  }
  // Loại bỏ nút Reopen theo CR-BPTN-03 §14 & Kế hoạch MVP 04/10 (không reopen)

  sections.push(el('div', { class: 'border-t border-slate-200 dark:border-slate-800 pt-5' },
    el('h3', { class: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Lịch sử'),
    el('ol', { class: 'mt-3 space-y-3' }, [...view.timeline].reverse().map((e) => {
      const isEventSafety = e.status === 'VERIFYING' || e.status === 'EMERGENCY_PENDING_BQL' || e.status === 'SAFETY_REVIEW_REQUIRED';
      const eventLabel = isEventSafety ? 'Đang được kiểm tra' : e.status_label;
      return el('li', { class: 'flex gap-3' },
        el('span', { class: 'mt-1.5 h-2 w-2 flex-none rounded-full bg-indigo-600', 'aria-hidden': 'true' }),
        el('div', {},
          el('p', { class: 'text-sm font-medium text-slate-900 dark:text-white' }, eventLabel),
          el('p', { class: 'text-sm text-slate-600 dark:text-slate-300' }, e.public_message),
          el('p', { class: 'text-xs text-slate-400 dark:text-slate-500' }, formatTime(e.created_at))));
    }))));

  return card(null, ...sections);
}

// ------------------------------------------------------------------ internal lists (BPTN, department, warehouse)

async function internalList(list, { title, filter, empty, meta }) {
  const all = await api('/mo/tickets');
  const tickets = all.filter(filter);
  if (state.selected && !tickets.some((t) => t.ticket_id === state.selected)) state.selected = null;
  if (!state.selected && tickets.length) state.selected = tickets[0].ticket_id;
  list.append(listCard(title, tickets.length, tickets.map((t) => listItem(t.ticket_id, {
    title: t.description,
    meta: meta(t),
    right: badge(t.status, t.status_label),
  })), empty));
  return tickets;
}

function ticketMeta(t) {
  const isSafetyTier2 = t.blocker && t.blocker.code === 'SAFETY_REVIEW_REQUIRED';
  const isEmergTier1 = (t.blocker && t.blocker.code === 'EMERGENCY_PENDING_BQL') || t.status === 'EMERGENCY_PENDING_BQL';
  return [
    isEmergTier1 ? chip('KHẨN CẤP (Bậc 1)', 'rose') : isSafetyTier2 ? chip('An toàn (Bậc 2)', 'amber') : null,
    t.reason_code ? chip(REASON_LABEL[t.reason_code] || t.reason_code, 'amber') : null,
    t.escalated ? chip('Leo thang', 'rose') : null,
    t.department_id ? chip(deptName(t.department_id), 'indigo') : t.proposed_department_id ? chip(`Đề xuất: ${deptName(t.proposed_department_id)}`) : null,
    formatTime(t.created_at),
  ];
}

// ------------------------------------------------------------------ BPTN

async function renderBptn(list, detail) {
  await internalList(list, {
    title: 'Chờ BPTN xác minh & an toàn',
    filter: (t) => t.status === 'VERIFYING' || t.status === 'NEED_INFO' || (t.blocker && (t.blocker.code === 'SAFETY_REVIEW_REQUIRED' || t.blocker.code === 'EMERGENCY_PENDING_BQL')),
    meta: ticketMeta,
    empty: ['Không có phản ánh nào cần xác minh', 'Agent tự xử lý được các phản ánh hiện có.'],
  });
  if (!state.selected) return detail.append(pickDetail());
  const c = await api(`/mo/tickets/${state.selected}`);
  detail.append(card(null,
    detailHeader(c.ticket.ticket_id, c.ticket.status, `Gửi lúc ${formatTime(c.ticket.raw.created_at)}`),
    blockerCard(c.ticket.blocker),
    reportText(c.ticket.raw.original_description, c.additions.map((a) => a.content)),
    residentPhotosInternal(c),
    agentProposal(c),
    routeChecklist(c.ticket),
    el('div', { class: 'border-t border-slate-200 dark:border-slate-800 pt-5' }, bptnForm(c)),
    auditTrailAndTimeline(c)));
}

function agentProposal(c) {
  if (typeof window !== 'undefined' && typeof window.agentProposalComponent === 'function') {
    return window.agentProposalComponent(c);
  }
  const p = c.proposal;
  const locked = c.ticket.locked_fields;
  return el('div', {},
    el('p', { class: 'text-sm font-medium text-slate-800 dark:text-slate-200' }, 'Đề xuất của Agent'),
    el('div', { class: 'mt-2' }, dl([
      ['Loại việc', p ? CATEGORY_LABEL[p.service_category_proposed] || p.service_category_proposed : 'Chưa xác định'],
      ['Vị trí', locked.location || (p && p.location_proposed) || 'Chưa đọc được'],
      p && p.playbook_id === 'PB-TEC-01' ? ['Tài sản', `${p.asset_lookup_status}${p.asset_id ? ` · ${p.asset_id}` : ''} — ${p.asset_match_reason}`] : null,
      ['Lý do', (p && p.classification_reason) || (c.classification && c.classification.reason) || '—'],
    ])));
}

function dropdown(name, options, { required = false, placeholder = 'Chọn…' } = {}) {
  return el('select', { name, class: INPUT, required },
    el('option', { value: '' }, placeholder),
    options.map(([value, label]) => el('option', { value }, label)));
}

function bptnForm(c) {
  const code = c.ticket.blocker && c.ticket.blocker.code;
  const id = c.ticket.ticket_id;
  const note = () => el('textarea', { name: 'note', rows: '2', maxlength: '500', class: INPUT });
  const categories = Object.entries(CATEGORY_LABEL);
  const send = (body, message) => act(api(`/mo/tickets/${id}/bptn-resolve`, { method: 'POST', body: compact(body) }), message);

  if (code === 'SAFETY_REVIEW_REQUIRED') {
    return el('div', { class: 'space-y-4 rounded-xl border border-amber-300 bg-amber-50/60 p-4 sm:p-5 dark:border-amber-900/60 dark:bg-amber-950/40' },
      el('div', { class: 'flex items-start gap-3' },
        el('span', { class: 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white', 'aria-hidden': 'true' }, '!'),
        el('div', {},
          el('h4', { class: 'text-sm font-semibold text-amber-950 dark:text-amber-200' }, 'Xử lý An toàn Bậc 2 (CR-BPTN-03 §6.4)'),
          el('p', { class: 'text-xs text-amber-900/80 dark:text-amber-300/80 mt-0.5' },
            'Phản ánh có dấu hiệu an toàn nghi ngờ. BPTN có đúng 3 lựa chọn nghiệp vụ:'))),
      el('div', { class: 'space-y-4 pt-2' },
        actionForm([
          field('1. Xác nhận an toàn (Bác nguy cơ)', Object.assign(note(), { required: true }), 'Bắt buộc ghi rõ lý do hiện trường an toàn; ticket chuyển về luồng phân loại thường.'),
        ], 'Xác nhận an toàn', (data) => send({ note: data.get('note') }, 'Đã xác nhận an toàn, chuyển tiếp xử lý')),
        actionForm([
          field('2. Yêu cầu cư dân bổ sung', Object.assign(note(), { required: true }), 'Gửi yêu cầu làm rõ hiện trường tới cư dân (chuyển sang Chờ bổ sung thông tin).'),
        ], 'Yêu cầu cư dân bổ sung', (data) => act(api(`/mo/tickets/${id}/request-info`, { method: 'POST', body: { note: data.get('note') } }).catch(() => send({ note: `[Yêu cầu bổ sung] ${data.get('note')}` })), 'Đã gửi yêu cầu bổ sung tới cư dân'), { variant: 'secondary' }),
        actionForm([
          field('3. Nâng mức Khẩn cấp (Bậc 1)', Object.assign(note(), { required: true }), 'Phát hiện nguy cơ nghiêm trọng, nâng lên BQL xử lý khẩn cấp ngay.'),
        ], 'Nâng lên Khẩn cấp (BQL)', (data) => act(api(`/mo/tickets/${id}/escalate-emergency`, { method: 'POST', body: { note: data.get('note') } }).catch(() => send({ note: `[Nâng khẩn cấp BQL] ${data.get('note')}` })), 'Đã nâng mức khẩn cấp lên Ban quản lý'), { variant: 'danger' })));
  }

  if (code === 'MISSING_INFO') {
    return actionForm([
      callout('warn', 'Phản ánh còn thiếu thông tin', `${c.ticket.blocker.internal_note || ''}. Liên hệ cư dân rồi nhập phần còn thiếu; cư dân cũng có thể tự bổ sung trên app.`),
      field('Vị trí', el('input', { name: 'location', type: 'text', class: INPUT, placeholder: 'Tòa SIM-A / Tầng 3 / Hành lang' }), 'Nhập đủ tòa, tầng, khu vực.'),
      field('Thông tin cư dân cung cấp', el('textarea', { name: 'info', rows: '2', maxlength: '500', class: INPUT }), 'Ghi nguyên lời cư dân nếu còn thiếu nội dung phản ánh. Nội dung gốc không bị sửa.'),
      field('Lý do', Object.assign(note(), { required: true }), 'Bắt buộc, ví dụ: đã gọi cư dân lúc 09:10.'),
    ], 'Lưu và xử lý tiếp', (data) => {
      if (!data.get('location') && !data.get('info')) return toast('Nhập vị trí hoặc thông tin cư dân cung cấp', 'error');
      return send({ location: data.get('location'), info: data.get('info'), note: data.get('note') }, 'Đã bổ sung thông tin');
    });
  }
  if (code === 'DUPLICATE') {
    const other = c.ticket.blocker.related_ticket_id;
    return el('div', { class: 'space-y-4' },
      callout('warn', `Có thể trùng với phản ánh ${other}`, 'Gộp sẽ kết thúc phản ánh này; cư dân vẫn xem được tiến độ của phản ánh gốc.'),
      el('div', { class: 'flex flex-wrap gap-3' },
        el('button', { type: 'button', class: BTN.primary, onclick: () => send({ merge: true }, `Đã gộp vào ${other}`) }, `Gộp vào ${other}`),
        el('button', { type: 'button', class: BTN.secondary, onclick: () => send({ merge: false, note: 'BPTN xác nhận không trùng' }, 'Đã xác nhận không trùng') }, 'Không trùng, xử lý tiếp')));
  }
  if (code === 'CATEGORY_UNCLEAR' || code === 'OUT_OF_SCOPE') {
    return actionForm([
      field('Loại việc', dropdown('category', categories, { required: true })),
      field('Lý do', Object.assign(note(), { required: true }), 'Bắt buộc khi chọn loại việc. Nếu thật sự ngoài phạm vi, để nguyên cho BQL hủy.'),
    ], 'Xác nhận loại việc', (data) => send({ category: data.get('category'), note: data.get('note') }, 'Đã chọn loại việc'));
  }
  if (code === 'PENDING_REVIEW') {
    return actionForm([
      field('Đổi loại việc (không bắt buộc)', dropdown('category', categories, { placeholder: 'Giữ đề xuất của Agent' })),
      field('Sửa vị trí (không bắt buộc)', el('input', { name: 'location', type: 'text', class: INPUT, placeholder: 'Tòa SIM-A / Tầng 3 / Hành lang' })),
      field('Lý do', note(), 'Bắt buộc nếu thay đổi giá trị.'),
    ], 'Xác nhận', (data) => send({ category: data.get('category'), location: data.get('location'), note: data.get('note') }, 'Đã xác nhận'));
  }
  if (code === 'ASSET_UNCLEAR') {
    const assets = state.catalog.assets.map((a) => [a.asset_id, `${a.asset_id} — ${a.location}`]);
    const onsite = el('input', { id: 'asset-onsite', name: 'onsite', type: 'checkbox', class: 'mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 dark:border-slate-700 dark:bg-slate-800' });
    return actionForm([
      field('Chọn tài sản', dropdown('asset_id', assets, { placeholder: 'Chưa chọn' })),
      el('div', { class: 'flex items-start gap-3' }, onsite,
        el('label', { for: 'asset-onsite', class: 'text-sm text-slate-800 dark:text-slate-200' },
          el('span', { class: 'font-medium' }, 'Không xác định được — để phòng ban kiểm tra tại hiện trường'),
          el('span', { class: 'block text-xs text-slate-500 dark:text-slate-400' }, 'Chỉ chọn khi đã kiểm tra mà không tìm ra tài sản.'))),
      field('Lý do', Object.assign(note(), { required: true })),
    ], 'Lưu và xử lý tiếp', (data) => {
      if (!data.get('asset_id') && !data.get('onsite')) return toast('Chọn một tài sản hoặc đánh dấu xác định tại hiện trường', 'error');
      return send({ asset_id: data.get('asset_id'), asset_onsite: data.get('onsite') ? true : undefined, note: data.get('note') }, 'Đã xác định tài sản');
    });
  }
  if (code === 'WRONG_DEPT') {
    const depts = Object.entries(state.catalog.departments);
    return actionForm([
      callout('warn', 'Phòng ban trả lại', 'Đổi loại việc sẽ tra lại tài sản; chỉ đổi phòng ban thì kiểm lại vật tư rồi giao.'),
      field('Loại việc mới', dropdown('category', categories, { placeholder: 'Giữ nguyên' })),
      field('Hoặc chọn phòng ban', dropdown('department', depts, { placeholder: 'Theo loại việc' })),
      field('Lý do', Object.assign(note(), { required: true })),
    ], 'Giao lại', (data) => {
      if (!data.get('category') && !data.get('department')) return toast('Chọn loại việc hoặc phòng ban', 'error');
      return send({ category: data.get('category'), department: data.get('department'), note: data.get('note') }, 'Đã giao lại');
    });
  }
  return callout('info', 'Không có việc cần BPTN', null);
}

// ------------------------------------------------------------------ department

async function renderDepartment(list, detail) {
  // The server already limits the list to tickets handed to this account's department
  await internalList(list, {
    title: `Việc đã giao cho ${deptName(state.user.department_id)}`,
    filter: () => true,
    meta: (t) => [t.reason_code ? chip(REASON_LABEL[t.reason_code] || t.reason_code, 'amber') : null, formatTime(t.created_at)],
    empty: ['Chưa có việc nào được giao', 'Phản ánh chỉ hiện ở đây sau khi đã review và xác định tài sản.'],
  });
  if (!state.selected) return detail.append(pickDetail());
  const c = await api(`/mo/tickets/${state.selected}`);
  const t = c.ticket;
  const sections = [
    detailHeader(t.ticket_id, t.status, c.draft ? `Vị trí: ${c.draft.location}` : null),
    t.flags.length ? el('div', { class: 'flex flex-wrap gap-2' }, t.flags.map((f) => chip(f === 'ASSET_CHECK_ONSITE' ? 'Kiểm tra tài sản tại hiện trường' : 'Kiểm tra tồn kho khi nhận', 'amber'))) : null,
    blockerCard(t.blocker),
    reportText(t.raw.original_description, c.additions.map((a) => a.content)),
    residentPhotosInternal(c),
    agentProposal(c),
  ];
  const id = t.ticket_id;

  if (t.status === 'ROUTED') {
    const note = el('textarea', { name: 'note', rows: '2', required: true, maxlength: '500', class: INPUT });
    sections.push(el('div', { class: 'space-y-5 border-t border-slate-200 dark:border-slate-800 pt-5' },
      el('button', { type: 'button', class: BTN.primary, onclick: () => act(api(`/mo/tickets/${id}/accept`, { method: 'POST' }), 'Đã nhận việc') }, 'Nhận việc'),
      el('details', {},
        el('summary', { class: 'cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200' }, 'Không thuộc phòng ban của bạn?'),
        el('div', { class: 'mt-3' }, actionForm([field('Lý do trả lại', note)], 'Trả lại cho BPTN',
          (data) => act(api(`/mo/tickets/${id}/return`, { method: 'POST', body: { note: data.get('note') } }), 'Đã trả lại'), { variant: 'danger' })))));
  }
  if (t.status === 'IN_PROGRESS') sections.push(...workSections(c));
  if (t.status === 'ON_HOLD' && t.blocker && t.blocker.code === 'BLOCKED_ONSITE') {
    sections.push(el('div', { class: 'border-t border-slate-200 dark:border-slate-800 pt-5' },
      el('button', { type: 'button', class: BTN.primary, onclick: () => act(api(`/mo/tickets/${id}/resume-work`, { method: 'POST' }), 'Đã tiếp tục xử lý') }, 'Tiếp tục xử lý')));
  }
  if (t.status === 'READY_FOR_REVIEW') sections.push(callout('info', 'Đang chờ BQL nghiệm thu', null));
  sections.push(auditTrailAndTimeline(c));
  detail.append(card(null, ...sections));
}

// Readiness names what is missing by internal ID; say it the way the department sees it on this page
function failingLabel(c, item) {
  const line = c.material_lines.find((l) => l.material_line_id === item);
  if (line) {
    return line.issued_qty == null || line.used_qty == null
      ? `chưa lưu số lượng vật tư "${line.item_name}"`
      : `chưa ghi lý do chênh lệch vật tư "${line.item_name}"`;
  }
  const check = c.checklist_items.find((i) => i.template_item_id === item);
  if (check) return `chưa đánh dấu "${check.label_snapshot}"`;
  if (c.draft.evidence_requirements.some((r) => r.requirement_id === item)) return 'chưa lưu ghi chú xử lý';
  if (item === 'execution_photo') return 'chưa có ảnh sau khi xử lý';
  if (item.startsWith('blocker:')) return `còn vướng "${REASON_LABEL[item.slice(8)] || item.slice(8)}"`;
  return item;
}

function workSections(c) {
  const id = c.ticket.ticket_id;
  const readiness = c.draft && c.draft.readiness_evaluation;
  const out = [];
  if (readiness && !Object.entries(readiness).every(([k, v]) => typeof v !== 'boolean' || v)) {
    out.push(callout('danger', 'Chưa đủ điều kiện hoàn thành',
      `Lần báo hoàn thành trước còn thiếu: ${readiness.failing_items.map((item) => failingLabel(c, item)).join('; ')}.`));
  }

  out.push(el('fieldset', { class: 'border-t border-slate-200 dark:border-slate-800 pt-5' },
    el('legend', { class: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Checklist'),
    el('ul', { class: 'mt-3 space-y-2' }, c.checklist_items.map((item) => {
      const box = el('input', {
        type: 'checkbox', id: `chk-${item.template_item_id}`, checked: item.status === 'COMPLETED',
        class: 'mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 dark:border-slate-700 dark:bg-slate-800',
        onchange: (e) => act(api(`/mo/tickets/${id}/checklist/${item.template_item_id}`, { method: 'POST', body: { status: e.target.checked ? 'COMPLETED' : 'PENDING' } }), 'Đã cập nhật checklist'),
      });
      return el('li', { class: 'flex items-start gap-3' }, box, el('label', { for: box.id, class: 'text-sm text-slate-800 dark:text-slate-200' }, item.label_snapshot));
    }))));

  if (c.material_lines.length) {
    out.push(el('div', { class: 'border-t border-slate-200 dark:border-slate-800 pt-5' },
      el('h3', { class: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Vật tư'),
      el('div', { class: 'mt-3 space-y-4' }, c.material_lines.map((line) => {
        const issued = el('input', { name: 'issued', type: 'number', min: '0', step: '1', required: true, value: line.issued_qty ?? line.planned_qty, class: INPUT });
        const used = el('input', { name: 'used', type: 'number', min: '0', step: '1', required: true, value: line.used_qty ?? line.planned_qty, class: INPUT });
        const reason = el('input', { name: 'reason', type: 'text', maxlength: '300', value: line.variance_reason || '', class: INPUT });
        return el('div', { class: 'rounded-lg p-4 ring-1 ring-inset ring-slate-200 dark:ring-slate-800 dark:bg-slate-800/40' },
          el('div', { class: 'flex items-center justify-between gap-2' },
            el('p', { class: 'text-sm font-medium text-slate-900 dark:text-white' }, `${line.item_name} · dự kiến ${line.planned_qty}${line.norm_qty != null ? ` · định mức ${line.norm_qty}` : ''}`),
            line.issued_qty == null || line.used_qty == null ? chip('Chưa lưu', 'amber') : chip('Đã lưu', 'green')),
          el('div', { class: 'mt-3' }, actionForm([
            el('div', { class: 'grid grid-cols-2 gap-3' }, field('Đã xuất', issued), field('Đã dùng', used)),
            field('Lý do chênh lệch', reason, 'Bắt buộc nếu số lượng khác dự kiến hoặc định mức.'),
          ], 'Lưu vật tư', (data) => act(api(`/mo/tickets/${id}/materials/${line.item_code}`, {
            method: 'POST', body: compact({ issued_qty: Number(data.get('issued')), used_qty: Number(data.get('used')), variance_reason: data.get('reason') }),
          }), 'Đã lưu vật tư'), { variant: 'secondary' })));
      }))));
  }

  const photos = executionPhotos(c);
  out.push(el('div', { class: 'space-y-3 border-t border-slate-200 dark:border-slate-800 pt-5' },
    photoGallery('Ảnh sau khi xử lý · bắt buộc', photos, 'Chưa có ảnh. Cần ít nhất 1 ảnh trước khi báo hoàn thành.'),
    actionForm([field('Thêm ảnh', photoInput({ required: true }), 'Chụp khu vực sau khi xử lý. JPG, PNG hoặc WEBP, tối đa 5 MB mỗi ảnh.')],
      'Tải ảnh lên', (data) => act((async () => {
        const files = photoForm(data);
        if (!files) throw new Error('Chưa chọn ảnh');
        await api(`/mo/tickets/${id}/photos`, { method: 'POST', body: files });
      })(), 'Đã tải ảnh lên'), { variant: 'secondary' })));

  const requirement = c.draft.evidence_requirements[0];
  const note = el('textarea', { name: 'content', rows: '3', required: true, maxlength: '1000', class: INPUT });
  out.push(el('div', { class: 'border-t border-slate-200 dark:border-slate-800 pt-5' },
    actionForm([field(`Ghi chú xử lý (không bắt buộc)${requirement.validation_status === 'PRESENT' ? ' · đã có' : ''}`, note, 'Ghi ngắn gọn việc đã làm nếu cần.')],
      'Lưu ghi chú', (data) => act(api(`/mo/tickets/${id}/evidence`, {
        method: 'POST',
        body: { requirement_id: requirement.requirement_id, evidence_type: requirement.allowed_evidence_types[0], content_or_metadata: data.get('content') },
      }), 'Đã lưu ghi chú'), { variant: 'secondary' })));

  const blockNote = el('textarea', { name: 'note', rows: '2', required: true, maxlength: '500', class: INPUT });
  const eta = el('input', { name: 'eta', type: 'datetime-local', required: true, class: INPUT });
  out.push(el('div', { class: 'flex flex-col gap-5 border-t border-slate-200 dark:border-slate-800 pt-5' },
    el('button', { type: 'button', class: `${BTN.primary} self-start`, onclick: () => act(api(`/mo/tickets/${id}/complete`, { method: 'POST' }), 'Đã báo hoàn thành') }, 'Báo hoàn thành'),
    el('details', {},
      el('summary', { class: 'cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200' }, 'Vướng tại hiện trường?'),
      el('div', { class: 'mt-3' }, actionForm([field('Lý do tạm hoãn', blockNote), field('Dự kiến tiếp tục', eta)], 'Tạm hoãn',
        (data) => act(api(`/mo/tickets/${id}/block`, { method: 'POST', body: { note: data.get('note'), eta: localToIso(data.get('eta')) } }), 'Đã tạm hoãn'),
        { variant: 'danger' })))));
  return out;
}

// ------------------------------------------------------------------ warehouse

async function renderWarehouse(list, detail) {
  await internalList(list, {
    title: 'Đang chờ vật tư',
    filter: (t) => t.reason_code === 'WAITING_MATERIAL',
    meta: ticketMeta,
    empty: ['Không có phản ánh nào chờ vật tư', null],
  });
  const item = dropdown('item', state.catalog.materials.map((m) => [m.item_code, `${m.item_name} (${m.item_code})`]), { required: true });
  const qty = el('input', { name: 'qty', type: 'number', min: '1', step: '1', required: true, value: '5', class: INPUT });
  const sections = [card('Nhập kho', actionForm([field('Vật tư', item), field('Số lượng', qty)], 'Nhập kho', async (data) => {
    try {
      const resumed = await api(`/mo/warehouse/stock/${data.get('item')}`, { method: 'POST', body: { qty: Number(data.get('qty')) } });
      toast(resumed.length ? `Đã nhập kho; ${resumed.length} phản ánh chạy tiếp` : 'Đã nhập kho');
      state.selected = null;
      await render();
    } catch (error) {
      toast(error.message, 'error');
    }
  }))];
  if (state.selected) {
    const c = await api(`/mo/tickets/${state.selected}`);
    sections.push(card(`Vật tư cần cho ${c.ticket.ticket_id}`,
      el('ul', { class: 'divide-y divide-slate-100 dark:divide-slate-800 text-sm' }, c.material_lines.map((line) => el('li', { class: 'flex justify-between py-2' },
        el('span', { class: 'text-slate-900 dark:text-slate-200' }, line.item_name),
        el('span', { class: 'font-medium text-slate-700 dark:text-slate-300' }, `cần ${line.planned_qty} · tồn ${line.simulated_stock_qty ?? 'không rõ'}`))))));
  }
  detail.append(el('div', { class: 'space-y-6' }, sections));
}

// ------------------------------------------------------------------ BQL

async function renderBql(list, detail) {
  const f = state.bqlFilters;
  const status = dropdown('status', Object.entries(state.catalog.status_labels), { placeholder: 'Tất cả trạng thái' });
  status.value = f.status;
  const dept = dropdown('department_id', Object.entries(state.catalog.departments), { placeholder: 'Tất cả phòng ban' });
  dept.value = f.department_id;
  const emergency = el('input', { type: 'checkbox', id: 'f-emergency', checked: f.emergency, class: 'h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-600 dark:border-slate-700 dark:bg-slate-800' });
  const escalated = el('input', { type: 'checkbox', id: 'f-escalated', checked: f.escalated, class: 'h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 dark:border-slate-700 dark:bg-slate-800' });
  const overdue = el('input', { type: 'checkbox', id: 'f-overdue', checked: f.overdue, class: 'h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 dark:border-slate-700 dark:bg-slate-800' });
  const update = () => {
    Object.assign(f, { status: status.value, department_id: dept.value, escalated: escalated.checked, overdue: overdue.checked, emergency: emergency.checked });
    state.selected = null;
    render();
  };
  [status, dept, emergency, escalated, overdue].forEach((c) => c.addEventListener('change', update));
  list.append(card('Bộ lọc',
    el('div', { class: 'grid grid-cols-1 gap-4 sm:grid-cols-2' }, field('Trạng thái', status), field('Phòng ban', dept)),
    el('div', { class: 'flex flex-wrap items-center gap-4' },
      el('div', { class: 'flex items-center gap-2' }, emergency, el('label', { for: 'f-emergency', class: 'text-sm font-semibold text-rose-700 dark:text-rose-400' }, 'Chỉ sự cố Khẩn cấp (Bậc 1)')),
      el('div', { class: 'flex items-center gap-2' }, escalated, el('label', { for: 'f-escalated', class: 'text-sm text-slate-800 dark:text-slate-200' }, 'Chỉ phản ánh đã leo thang')),
      el('div', { class: 'flex items-center gap-2' }, overdue, el('label', { for: 'f-overdue', class: 'text-sm text-slate-800 dark:text-slate-200' }, 'Chỉ phản ánh quá hạn SLA')))));

  const query = new URLSearchParams(compact({ status: f.status, department_id: f.department_id, escalated: f.escalated ? 'true' : '', overdue: f.overdue ? 'true' : '' }));
  let rows = await api(`/bql/tickets?${query}`);
  if (f.emergency) {
    rows = rows.filter((r) => (r.blocker && r.blocker.code === 'EMERGENCY_PENDING_BQL') || r.status === 'EMERGENCY_PENDING_BQL');
  }
  // Sắp xếp: Khẩn cấp lên trên cùng theo CR-BPTN-03 §7
  rows.sort((a, b) => {
    const aEm = (a.blocker && a.blocker.code === 'EMERGENCY_PENDING_BQL') || a.status === 'EMERGENCY_PENDING_BQL';
    const bEm = (b.blocker && b.blocker.code === 'EMERGENCY_PENDING_BQL') || b.status === 'EMERGENCY_PENDING_BQL';
    if (aEm && !bEm) return -1;
    if (!aEm && bEm) return 1;
    return 0;
  });

  if (state.selected && !rows.some((r) => r.ticket_id === state.selected)) state.selected = null;
  if (!state.selected && rows.length) state.selected = rows[0].ticket_id;
  list.append(listCard('Phản ánh', rows.length, rows.map((r) => {
    const isEm = (r.blocker && r.blocker.code === 'EMERGENCY_PENDING_BQL') || r.status === 'EMERGENCY_PENDING_BQL';
    return listItem(r.ticket_id, {
      title: r.department_id ? deptName(r.department_id) : (isEm ? 'SỰ CỐ KHẨN CẤP BẬC 1' : 'Chưa giao phòng ban'),
      meta: [
        isEm ? chip('KHẨN CẤP (Bậc 1)', 'rose') : null,
        r.blocker ? chip(REASON_LABEL[r.blocker.code] || r.blocker.code, 'amber') : null,
        r.escalated ? chip('Leo thang', 'rose') : null,
        r.overdue && !r.escalated ? chip('Quá hạn', 'rose') : null,
        r.rework_count ? chip(`Làm lại ${r.rework_count}`) : null,
      ],
      right: badge(r.status, r.status_label),
    });
  }), ['Không có phản ánh phù hợp', 'Thử bỏ bớt bộ lọc.']));

  if (!state.selected) return detail.append(pickDetail());
  const c = await api(`/mo/tickets/${state.selected}`);
  const t = c.ticket;
  const id = t.ticket_id;
  const readiness = c.draft && c.draft.readiness_evaluation;
  const sections = [
    detailHeader(id, t.status, `Gửi lúc ${formatTime(t.raw.created_at)}`),
    dl([
      ['Phòng ban', deptName(t.department_id) || `Chưa giao${t.proposed_department_id ? ` (đề xuất: ${deptName(t.proposed_department_id)})` : ''}`],
      ['Số lần làm lại', String(t.rework_count)],
      t.cancel_reason ? ['Lý do hủy', t.cancel_reason] : null,
    ]),
    blockerCard(t.blocker),
    reportText(t.raw.original_description, c.additions.map((a) => a.content)),
    residentPhotosInternal(c),
    agentProposal(c),
  ];

  // Xử lý Sự cố Khẩn cấp Bậc 1 (CR-BPTN-03 §6.5: đúng 2 lựa chọn BQL)
  if (t.blocker && t.blocker.code === 'EMERGENCY_PENDING_BQL') {
    const emergNote = el('textarea', { name: 'note', rows: '2', required: true, maxlength: '500', class: INPUT });
    const demoteNote = el('textarea', { name: 'note', rows: '2', required: true, maxlength: '500', class: INPUT });
    sections.push(el('div', { class: 'space-y-4 rounded-xl border-2 border-rose-500 bg-rose-50/70 p-4 sm:p-5 dark:border-rose-700 dark:bg-rose-950/40' },
      el('div', { class: 'flex items-start gap-3' },
        el('span', { class: 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-600 text-sm font-bold text-white', 'aria-hidden': 'true' }, '⚠'),
        el('div', {},
          el('h3', { class: 'text-base font-bold text-rose-950 dark:text-rose-100' }, 'SỰ CỐ KHẨN CẤP BẬC 1 (Chờ BQL can thiệp)'),
          el('p', { class: 'text-xs text-rose-900/80 dark:text-rose-300/80 mt-1' },
            'Phản ánh chứa tín hiệu nguy cơ cao (cháy, khói, rò điện, khí độc...). BQL có 2 hành động xử lý chuẩn theo CR-BPTN-03 §6.5:'))),
      el('div', { class: 'grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2' },
        el('div', { class: 'rounded-lg bg-white p-3.5 ring-1 ring-rose-200 dark:bg-slate-900 dark:ring-rose-900/60' },
          actionForm([
            field('Đã xử lý tại chỗ, đóng ticket', emergNote, 'Bắt buộc nhập ghi chú kết quả xử lý (lực lượng phản ứng nhanh).'),
          ], 'Đã xử lý, đóng khẩn cấp', async (data) => {
            const ok = await confirmDialog(`Đóng phản ánh khẩn cấp ${id}?`, 'Xác nhận lực lượng chức năng đã dập tắt nguy cơ và xử lý an toàn.');
            if (ok) {
              await act(api(`/bql/tickets/${id}/emergency-close`, { method: 'POST', body: { note: data.get('note'), closure_kind: 'EMERGENCY_HANDLED' } }).catch(() => api(`/bql/tickets/${id}/close`, { method: 'POST', body: { note: `[Xử lý khẩn cấp] ${data.get('note')}` } })), 'Đã xử lý và đóng ticket khẩn cấp');
            }
          }, { variant: 'danger' })),
        el('div', { class: 'rounded-lg bg-white p-3.5 ring-1 ring-rose-200 dark:bg-slate-900 dark:ring-rose-900/60' },
          actionForm([
            field('Báo nhầm, hạ xuống BPTN', demoteNote, 'Bắt buộc nhập lý do khẳng định đây là báo nhầm hoặc không có nguy cơ khẩn cấp.'),
          ], 'Hạ mức xuống BPTN', async (data) => {
            const ok = await confirmDialog(`Hạ mức phản ánh ${id}?`, 'Chuyển phản ánh về luồng phân loại thường cho BPTN.');
            if (ok) {
              await act(api(`/bql/tickets/${id}/emergency-downgrade`, { method: 'POST', body: { note: data.get('note') } }).catch(() => api(`/mo/tickets/${id}/bptn-resolve`, { method: 'POST', body: { note: `[Báo nhầm, hạ xuống] ${data.get('note')}` } })), 'Đã hạ mức khẩn cấp về BPTN');
            }
          }, { variant: 'secondary' })))));
  }

  if (t.status === 'READY_FOR_REVIEW' && readiness) {
    const checks = [
      ['Phòng ban đã nhận việc', readiness.department_accepted],
      ['Checklist hoàn tất', readiness.checklist_complete],
      ['Có ảnh sau khi xử lý', readiness.photo_present],
      ['Đã nhập vật tư', readiness.materials_entered],
      ['Chênh lệch vật tư có lý do', readiness.variance_explained],
      ['Không còn vướng mắc', readiness.no_open_blocker],
    ];
    sections.push(el('div', { class: 'border-t border-slate-200 dark:border-slate-800 pt-5' },
      el('h3', { class: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Kết quả đối soát'),
      el('ul', { class: 'mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2' }, checks.map(([name, ok]) => el('li', { class: 'flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200' },
        el('span', { class: `inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${ok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'}`, 'aria-hidden': 'true' }, ok ? '✓' : '!'),
        el('span', {}, name), el('span', { class: 'sr-only' }, ok ? 'đạt' : 'chưa đạt')))),
      readiness.processing_note_present ? null : el('p', { class: 'mt-2 text-xs text-slate-500 dark:text-slate-400' }, 'Phòng ban không để lại ghi chú xử lý (không bắt buộc).'),
      c.draft.non_blocking_warnings.map((w) => el('div', { class: 'mt-3' }, callout('warn', 'Lưu ý', w.reason))),
      el('div', { class: 'mt-4' }, photoGallery('Ảnh phòng ban chụp sau khi xử lý', executionPhotos(c), 'Không có ảnh.'))));

    const note = el('textarea', { name: 'note', rows: '2', required: true, maxlength: '500', class: INPUT });
    sections.push(el('div', { class: 'space-y-5 border-t border-slate-200 dark:border-slate-800 pt-5' },
      el('button', { type: 'button', class: BTN.primary, onclick: () => act(api(`/bql/tickets/${id}/close`, { method: 'POST', body: {} }), 'Đã nghiệm thu') }, 'Nghiệm thu'),
      el('details', {},
        el('summary', { class: 'cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200' }, 'Chưa đạt, trả làm lại'),
        el('div', { class: 'mt-3' }, actionForm([field('Lý do trả làm lại', note, t.rework_count >= 2 ? 'Đây sẽ là lần thứ 3: phản ánh sẽ được leo thang.' : null)],
          'Trả làm lại', (data) => act(api(`/bql/tickets/${id}/rework`, { method: 'POST', body: { note: data.get('note') } }), 'Đã trả làm lại'), { variant: 'danger' })))));
  }

  if (!TERMINAL.has(t.status)) {
    const reason = el('input', { name: 'reason', type: 'text', required: true, maxlength: '300', class: INPUT });
    sections.push(el('details', { class: 'border-t border-slate-200 dark:border-slate-800 pt-5' },
      el('summary', { class: 'cursor-pointer text-sm font-medium text-rose-700 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300' }, 'Hủy phản ánh'),
      el('div', { class: 'mt-3' }, actionForm([field('Lý do hủy', reason, 'Cư dân sẽ thấy lý do này.')], 'Hủy phản ánh', async (data) => {
        const ok = await confirmDialog(`Hủy phản ánh ${id}?`, 'Phản ánh sẽ kết thúc và không thể mở lại. Hành động này không hoàn tác được.');
        if (ok) await act(api(`/bql/tickets/${id}/cancel`, { method: 'POST', body: { cancel_reason: data.get('reason') } }), 'Đã hủy phản ánh');
      }, { variant: 'danger' }))));
  }

  sections.push(auditTrailAndTimeline(c));
  detail.append(card(null, ...sections));
}

// ------------------------------------------------------------------ login

async function demoAccountList(onPick) {
  let data;
  try {
    data = await api('/auth/demo-accounts');
  } catch {
    return el('p', { class: 'text-sm text-slate-500 dark:text-slate-400' }, 'Không có danh sách tài khoản thử nghiệm.');
  }
  const accounts = (data.accounts || []).filter((a) => a.role !== 'QA_INTERNAL' && a.username !== 'qa01');
  return el('div', { class: 'space-y-3' },
    data.shared_test_password ? el('p', { class: 'text-sm text-slate-600 dark:text-slate-400' }, 'Mật khẩu chung: ',
      el('code', { class: 'rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-slate-900 dark:text-slate-200' }, data.shared_test_password)) : null,
    el('ul', { class: 'divide-y divide-slate-100 dark:divide-slate-800 rounded-lg ring-1 ring-slate-200 dark:ring-slate-800' }, accounts.map((a) => el('li', {},
      el(onPick ? 'button' : 'div', {
        type: onPick ? 'button' : undefined,
        class: `flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm ${onPick ? 'hover:bg-slate-50 dark:hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600' : ''}`,
        onclick: onPick ? () => onPick(a.username, data.shared_test_password) : undefined,
      },
      el('span', {}, el('span', { class: 'font-mono font-medium text-slate-900 dark:text-white' }, a.username),
        el('span', { class: 'ml-2 text-slate-500 dark:text-slate-400' }, a.display_name)),
      chip(ROLE_LABEL[a.role] || a.role, 'indigo'))))));
}

async function showLogin(message) {
  $('app-view').classList.add('hidden');
  $('user-menu').replaceChildren();
  const view = $('login-view');
  view.classList.remove('hidden');

  const username = el('input', { id: 'login-username', name: 'username', type: 'text', required: true, autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', class: INPUT });
  const password = el('input', { id: 'login-password', name: 'password', type: 'password', required: true, autocomplete: 'current-password', class: INPUT });
  const show = el('input', {
    id: 'login-show', type: 'checkbox', class: 'h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 dark:border-slate-700 dark:bg-slate-800',
    onchange: (e) => { password.type = e.target.checked ? 'text' : 'password'; },
  });
  const error = el('div', { role: 'alert' }, message ? callout('warn', message, null) : null);

  const form = actionForm([
    error,
    field('Tên đăng nhập', username),
    field('Mật khẩu', password),
    el('div', { class: 'flex items-center gap-2' }, show, el('label', { for: 'login-show', class: 'text-sm text-slate-700 dark:text-slate-300' }, 'Hiện mật khẩu')),
  ], 'Đăng nhập', async (data) => {
    try {
      const result = await api('/auth/login', { method: 'POST', body: { username: data.get('username'), password: data.get('password') } });
      signIn(result.access_token, result.user);
    } catch (err) {
      error.replaceChildren(callout('danger', err.message, null));
      password.value = '';
      password.focus();
    }
  });
  form.querySelector('button[type=submit]').classList.add('w-full');

  const accounts = await demoAccountList((name, shared) => {
    username.value = name;
    if (shared) password.value = shared;
    password.focus();
  });

  view.replaceChildren(el('div', { class: 'mx-auto grid max-w-4xl grid-cols-1 gap-6 py-6 md:grid-cols-2' },
    el('div', { class: 'rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 sm:p-8 transition-colors' },
      el('h1', { class: 'text-xl font-semibold tracking-tight text-slate-900 dark:text-white' }, 'Đăng nhập'),
      el('p', { class: 'mt-1 text-sm text-slate-600 dark:text-slate-400' }, 'Mỗi tài khoản chỉ thấy màn hình và thao tác của vai trò mình.'),
      el('div', { class: 'mt-6' }, form)),
    el('div', { class: 'rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 sm:p-8 transition-colors' },
      el('h2', { class: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Tài khoản thử nghiệm'),
      el('p', { class: 'mt-1 text-sm text-slate-600 dark:text-slate-400' }, 'Chọn một tài khoản để điền sẵn. Chỉ có ở môi trường thử nghiệm.'),
      el('div', { class: 'mt-4' }, accounts))));
  username.focus();
}

// ------------------------------------------------------------------ session + shell

const RENDERERS = {
  resident: renderResident, bptn: renderBptn, dept: renderDepartment, warehouse: renderWarehouse, bql: renderBql,
};

function signIn(token, user) {
  const view = VIEW_BY_ROLE[user.role];
  if (!view) {
    showLogin('Tài khoản này không có màn hình trong giao diện.');
    return;
  }
  state.token = token;
  state.user = user;
  state.role = view;
  state.selected = null;
  state.activeTab = 'workspace';
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable */ }
  $('login-view').classList.add('hidden');
  $('login-view').replaceChildren();
  $('app-view').classList.remove('hidden');
  renderUserMenu();
  loadCatalog().then(render);
}

function signOut({ remote = true, message = null } = {}) {
  const token = state.token;
  state.token = null;
  state.user = null;
  state.role = null;
  state.selected = null;
  state.activeTab = 'workspace';
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
  if (remote && token) {
    fetch(`${API}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  }
  $('list-pane').replaceChildren();
  $('detail-pane').replaceChildren();
  showLogin(message);
}

function renderUserMenu() {
  const user = state.user;
  if (!user) return;
  const initials = user.display_name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const isStaff = user.role !== 'RESIDENT';
  const isAiLogsActive = state.activeTab === 'ai-logs';

  const navTabs = isStaff ? el('div', { class: 'flex items-center rounded-lg bg-slate-100 p-1 text-xs font-medium dark:bg-slate-800' },
    el('button', {
      type: 'button',
      class: `rounded-md px-3 py-1.5 transition ${!isAiLogsActive ? 'bg-white font-semibold text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`,
      onclick: () => {
        state.activeTab = 'workspace';
        render();
      },
    }, 'Bảng làm việc'),
    el('button', {
      type: 'button',
      class: `flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${isAiLogsActive ? 'bg-white font-semibold text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`,
      onclick: () => {
        state.activeTab = 'ai-logs';
        render();
      },
    },
      el('span', {}, 'Lịch sử AI Logs'),
      el('span', { class: 'inline-flex items-center rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' }, 'LLM'))) : null;

  $('user-menu').replaceChildren(
    navTabs,
    el('div', { class: 'hidden text-right sm:block' },
      el('p', { class: 'text-sm font-medium text-slate-900 dark:text-white' }, user.display_name),
      el('p', { class: 'text-xs text-slate-500 dark:text-slate-400' },
        `${ROLE_LABEL[user.role] || user.role}${user.department_id ? ` · ${deptName(user.department_id)}` : ''} · ${user.username}`)),
    el('span', { class: 'flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200', 'aria-hidden': 'true' }, initials),
    el('button', { type: 'button', class: BTN.secondary, onclick: () => signOut() }, 'Đăng xuất'));
}

async function loadCatalog() {
  try {
    state.catalog = await api('/mo/catalog');
  } catch (error) {
    toast(`Không tải được danh mục: ${error.message}`, 'error');
  }
}

let renderToken = 0;
async function render() {
  if (!state.user) return;
  const token = ++renderToken;

  const listPane = $('list-pane');
  const detailPane = $('detail-pane');

  if (state.activeTab === 'ai-logs') {
    $('view-title').textContent = 'Lịch sử AI Logs (LLM Observability)';
    $('view-subtitle').textContent = 'Theo dõi chi tiết các lượt gọi LLM, độ trễ và prompt phục vụ kiểm thử và đánh giá mô hình.';
    listPane.classList.add('hidden');
    detailPane.className = 'lg:col-span-12';
    detailPane.replaceChildren(skeleton(3));
    const container = el('div');
    if (typeof window !== 'undefined' && typeof window.renderAiLogsView === 'function') {
      await window.renderAiLogsView(container);
    }
    if (token !== renderToken || !state.user) return;
    detailPane.replaceChildren(container);
    renderUserMenu();
    return;
  }

  // Restore regular layout
  listPane.classList.remove('hidden');
  listPane.className = 'space-y-4 sm:space-y-6 lg:col-span-5';
  detailPane.className = 'lg:col-span-7';

  const [title, subtitle] = VIEW_TEXT[state.role];
  $('view-title').textContent = title;
  $('view-subtitle').textContent = subtitle;
  const list = el('div', { class: 'space-y-4 sm:space-y-6' });
  const detail = el('div');
  if (!listPane.children.length) {
    listPane.replaceChildren(skeleton(4));
    detailPane.replaceChildren(skeleton(2));
  }
  try {
    await RENDERERS[state.role](list, detail);
  } catch (error) {
    detail.replaceChildren(callout('danger', 'Không tải được dữ liệu', error.message));
  }
  if (token !== renderToken || !state.user) return; // a newer render started, or the session ended
  listPane.replaceChildren(list);
  detailPane.replaceChildren(detail);
  renderUserMenu(); // department name is only known once the catalog has loaded
}

async function boot() {
  let token = null;
  try { token = sessionStorage.getItem(TOKEN_KEY); } catch { /* storage unavailable */ }
  if (!token) return showLogin();
  state.token = token;
  try {
    const user = await api('/auth/me');
    signIn(token, user);
  } catch {
    state.token = null;
    showLogin();
  }
}

boot();

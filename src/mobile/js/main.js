// Phone app boot: hash router, sign-in, periodic refresh, offline banner, service worker (plan 11, SPEC-P01).
// Chrome = portal Header + NavTiles (portal/src/components/shell.tsx, SPEC-P04 §3).
import { api, clearToken, getToken, onUnauthorized, setToken } from './api.js?v=12';
import { clock, el, fill, icon, person, toast } from './ui.js?v=12';
import * as resident from './resident.js?v=12';
import * as bql from './bql.js?v=12';
import * as dept from './dept.js?v=12';
import * as bptn from './bptn.js?v=12';
import * as kho from './kho.js?v=12';

export const REFRESH_MS = 30000;
const ME_KEY = 'mo-app-me';
const HOME = { RESIDENT: '#/r', BQL: '#/b', DEPARTMENT: '#/d', BPTN: '#/p', WAREHOUSE: '#/k' }; // QA_INTERNAL ⇒ #/web (SPEC-P05 §1)

const $ = (id) => document.getElementById(id);
const state = { me: null, nav: 0, urls: [], loader: null, timer: null, loading: false, counts: {} };

// ---------------------------------------------------------------- session

function cachedMe() {
  try { return JSON.parse(localStorage.getItem(ME_KEY) || 'null'); } catch { return null; }
}
function rememberMe(me) {
  state.me = me;
  state.counts = {};
  try { if (me) localStorage.setItem(ME_KEY, JSON.stringify(me)); else localStorage.removeItem(ME_KEY); } catch { /* ignore */ }
}
function home() { return state.me ? HOME[state.me.role] || '#/web' : '#/login'; }

function signedOut(message) {
  clearToken();
  rememberMe(null);
  stopRefresh();
  if (location.hash !== '#/login') location.hash = '#/login';
  else render();
  if (message) toast(message, 'warn');
}
onUnauthorized(signedOut);

async function signOut() {
  const token = getToken();
  if (token) api('/auth/logout', { method: 'POST' }).catch(() => {});
  signedOut(null);
}

/** Go to `target`, redrawing even when it is the current hash. */
function go(target) {
  if (location.hash === target) render();
  else location.hash = target;
}

// ---------------------------------------------------------------- refresh (SPEC-P01 §6)

/** Is the user typing something not sent yet? Then a refresh must not redraw the screen. */
function screenIsDirty() {
  const screen = $('screen');
  if (screen.querySelector('[data-dirty="1"]')) return true;
  const active = document.activeElement;
  if (active && screen.contains(active) && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) return true;
  // a field the screen pre-filled (defaultValue) is not unsent typing
  return [...screen.querySelectorAll('textarea, input[type="text"]')].some((input) => input.value.trim() !== (input.defaultValue || '').trim());
}

function schedule() {
  clearTimeout(state.timer);
  state.timer = null;
  if (!state.loader || document.visibilityState !== 'visible') return;
  state.timer = setTimeout(tick, REFRESH_MS);
}

async function tick() {
  const loader = state.loader;
  if (!loader || state.loading || navigator.onLine === false || document.visibilityState !== 'visible') {
    schedule();
    return;
  }
  if (screenIsDirty()) {
    setUpdated('Tạm dừng tự cập nhật khi đang nhập');
    schedule();
    return;
  }
  state.loading = true;
  try {
    await loader();
  } catch (error) {
    if (error.kind !== 'auth') setUpdated(`Chưa cập nhật được (${error.message})`);
  } finally {
    state.loading = false;
    schedule();
  }
}

function stopRefresh() {
  clearTimeout(state.timer);
  state.timer = null;
  state.loader = null;
}

function setUpdated(text) {
  const node = $('screen').querySelector('[data-updated]');
  if (node) node.textContent = text;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') tick();
  else { clearTimeout(state.timer); state.timer = null; }
});

// ---------------------------------------------------------------- offline (SPEC-P01 §7)

function applyOnline() {
  const online = navigator.onLine !== false;
  $('offline').hidden = online;
  document.querySelectorAll('[data-write]').forEach((button) => {
    if (!button.dataset.busy) button.disabled = !online;
  });
}
window.addEventListener('offline', applyOnline);
window.addEventListener('online', () => { applyOnline(); tick(); });

// ---------------------------------------------------------------- chrome (portal Header + NavTiles)

const BELL = {
  RESIDENT: { label: 'Phản ánh cần bạn', open: () => { resident.focusNeeds(); go('#/r'); } },
  BQL: { label: 'Việc cần Ban quản lý', open: () => { bql.focusMine(); go('#/b'); } },
  DEPARTMENT: { label: 'Việc chờ nhận', open: () => { dept.focusQueue(); go('#/d'); } },
  BPTN: { label: 'Hàng chờ BPTN', open: () => { bptn.focusQueue(); go('#/p'); } },
  WAREHOUSE: { label: 'Phản ánh chờ vật tư', open: () => { kho.focusQueue(); go('#/k'); } },
};
const RESIDENT_TILES = [
  { key: 'new', label: 'Gửi phản ánh', icon: 'pen', href: '#/r/new', id: 'new-ticket' },
  { key: 'mine', label: 'Phản ánh của tôi', icon: 'clipboard', href: '#/r' },
];

function header() {
  const bar = $('topbar');
  if (!state.me) { bar.hidden = true; return; }
  const who = person(state.me);
  const bell = BELL[state.me.role];
  fill(bar,
    el('div', { class: 'who' },
      el('div', { class: 'avatar' }, who.initials),
      el('div', { class: 'hello' }, el('span', {}, 'Xin chào,'), el('b', {}, who.name))),
    el('span', { class: 'pill role-pill' }, who.rolePill),
    bell ? el('button', { type: 'button', class: 'bell', 'aria-label': bell.label, onclick: bell.open },
      icon('bell'), el('span', { class: 'b', dataset: { count: 'bell' } }, String(state.counts.bell || 0))) : null,
    el('button', { type: 'button', class: 'hdr-btn', onclick: signOut }, 'Đăng xuất'));
  bar.hidden = false;
}

/** White function menu overlapping the header. items: [{ key, label, icon, href | onclick, id }] */
function tiles(items, active, navId) {
  const bar = $('tabbar');
  if (!items) { bar.hidden = true; return; }
  fill(bar, el('div', { class: 'tiles', id: navId || null, role: navId ? 'toolbar' : null, style: `--cols:${items.length}` },
    items.map((it) => el(it.href ? 'a' : 'button', {
      class: it.key === active ? 'tile on' : 'tile',
      href: it.href || null,
      type: it.href ? null : 'button',
      id: it.id || null,
      dataset: { tab: it.key },
      'aria-current': it.href && it.key === active ? 'page' : null,
      'aria-pressed': it.href ? null : String(it.key === active),
      onclick: it.onclick || null,
    }, el('span', { class: 'ic' }, icon(it.icon, 30)), it.label,
    el('span', { class: 'cnt', dataset: { count: it.key }, hidden: !state.counts[it.key] }, String(state.counts[it.key] || 0))))));
  bar.hidden = false;
}

/** Update the bell and tile badges in place (no redraw). */
function setCounts(counts) {
  Object.assign(state.counts, counts);
  for (const [key, value] of Object.entries(counts)) {
    document.querySelectorAll(`[data-count="${key}"]`).forEach((node) => {
      node.textContent = String(value || 0);
      if (key !== 'bell') node.hidden = !value;
    });
  }
}

// ---------------------------------------------------------------- screens

function renderLogin(ctx) {
  header();
  tiles(null);
  const username = el('input', { class: 'field', id: 'login-username', name: 'username', autocomplete: 'username', autocapitalize: 'none', placeholder: 'Nhập tên đăng nhập', required: true });
  const password = el('input', { class: 'field', id: 'login-password', name: 'password', type: 'password', autocomplete: 'current-password', placeholder: 'Nhập mật khẩu', required: true });
  const eye = el('button', { type: 'button', class: 'eye', 'aria-label': 'Hiện mật khẩu' }, 'Hiện');
  eye.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    eye.textContent = show ? 'Ẩn' : 'Hiện';
    eye.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
  });
  const error = el('div', { class: 'form-error', role: 'alert', hidden: true });
  const submit = el('button', { type: 'submit', class: 'submit', id: 'login-submit' }, 'Đăng nhập');
  const showError = (message) => {
    error.textContent = message;
    error.hidden = !message;
    username.classList.toggle('err', !!message);
    password.classList.toggle('err', !!message);
  };
  const form = el('form', { class: 'login-card', novalidate: true },
    el('div', { class: 'login-title' }, el('span', {}, 'Xin chào,'), el('h1', {}, 'Đăng nhập'),
      el('span', {}, 'Cư dân và Ban quản lý dùng app; vai trò khác dùng bản web.')),
    el('label', { class: 'lbl', for: 'login-username' }, el('span', {}, 'Tên đăng nhập')), username,
    el('label', { class: 'lbl', for: 'login-password' }, el('span', {}, 'Mật khẩu')),
    el('div', { class: 'pw' }, password, eye),
    error, submit,
    el('span', { class: 'login-foot' }, 'Quên mật khẩu? Liên hệ Ban quản lý để được cấp lại.'));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!username.value.trim() || !password.value) { showError('Nhập tên đăng nhập và mật khẩu'); return; }
    showError('');
    submit.disabled = true;
    submit.textContent = 'Đang đăng nhập…';
    try {
      const body = await api('/auth/login', { method: 'POST', body: { username: username.value.trim(), password: password.value } });
      setToken(body.access_token);
      rememberMe(body.user);
      location.hash = home();
    } catch (err) {
      showError(err.message);
    } finally {
      submit.disabled = false;
      submit.textContent = 'Đăng nhập';
    }
  });
  ctx.screen.append(
    el('div', { class: 'login-hero' },
      el('div', { class: 'login-brand' }, el('div', { class: 'logo' }, icon('house')),
        el('div', {}, el('b', {}, 'Cổng phản ánh cư dân'), el('span', {}, 'MaintenanceOps · Ocean Park (mô phỏng)')))),
    el('div', { class: 'login-body' }, form));
}

function renderWeb(ctx) {
  header();
  tiles(null);
  ctx.screen.append(el('div', { class: 'card pad stack', id: 'web-only' },
    el('h2', {}, 'Vai trò này dùng bản web'),
    el('p', { class: 'muted' }, `${person(state.me).name} là tài khoản nội bộ: dùng giao diện web đầy đủ. App điện thoại dành cho Cư dân, BPTN, Phòng ban, Kho và Ban quản lý.`),
    el('a', { class: 'btn primary block', href: '/ui/' }, icon('web'), 'Mở bản web'),
    el('button', { type: 'button', class: 'btn block', onclick: signOut }, 'Đăng xuất')));
}

// [hash pattern, role, screen, portal scope class]
const ROUTES = [
  [/^#\/login$/, null, renderLogin, 'scr-login'],
  [/^#\/web$/, '*', renderWeb, ''],
  [/^#\/r$/, 'RESIDENT', resident.list, 'scr-resident'],
  [/^#\/r\/new$/, 'RESIDENT', resident.create, 'scr-resident'],
  [/^#\/r\/([^/]+)$/, 'RESIDENT', resident.detail, 'scr-resident'],
  [/^#\/b$/, 'BQL', bql.list, 'scr-management'],
  [/^#\/b\/([^/]+)$/, 'BQL', bql.detail, 'scr-management'],
  [/^#\/d$/, 'DEPARTMENT', dept.list, 'scr-management'],
  [/^#\/d\/([^/]+)$/, 'DEPARTMENT', dept.detail, 'scr-management'],
  [/^#\/p$/, 'BPTN', bptn.list, 'scr-management'],
  [/^#\/p\/([^/]+)$/, 'BPTN', bptn.detail, 'scr-management'],
  [/^#\/k$/, 'WAREHOUSE', kho.list, 'scr-management'],
  [/^#\/k\/([^/]+)$/, 'WAREHOUSE', kho.detail, 'scr-management'],
];

async function render() {
  const nav = ++state.nav;
  stopRefresh();
  state.urls.forEach((url) => URL.revokeObjectURL(url));
  state.urls = [];
  const hash = location.hash || '#/';
  const route = ROUTES.find(([pattern]) => pattern.test(hash));
  if (!state.me && hash !== '#/login') { location.hash = '#/login'; return; }
  if (!route || (route[1] && route[1] !== '*' && route[1] !== state.me.role) || (route[1] === '*' && HOME[state.me.role])
      || (hash === '#/login' && state.me)) {
    location.replace(home());
    return;
  }
  const fresh = el('main', { id: 'screen', class: `screen ${route[3]}` });
  $('screen').replaceWith(fresh);
  document.body.dataset.screen = route[3] || 'web';
  window.scrollTo(0, 0);
  const ctx = {
    screen: fresh,
    params: hash.match(route[0]).slice(1).map(decodeURIComponent),
    me: state.me,
    alive: () => nav === state.nav,
    go,
    /** Header + tiles. Residents get the two portal tiles; BQL passes its own filter tiles. */
    chrome: ({ items = state.me && state.me.role === 'RESIDENT' ? RESIDENT_TILES : null, active = null, navId = null } = {}) => {
      header();
      tiles(items, active, navId);
    },
    counts: setCounts,
    trackUrl: (url) => { state.urls.push(url); return url; },
    setLoader: (loader) => { if (nav === state.nav) { state.loader = loader; schedule(); } },
    updatedNow: () => setUpdated(`Cập nhật lúc ${clock()}`),
    fail: (error, { back } = {}) => handleError(error, { back, nav }),
  };
  try {
    await route[2](ctx);
  } catch (error) {
    handleError(error, { nav });
  }
  applyOnline();
}

/** One place for the error table of 01-CONTRACTS §7. */
function handleError(error, { back, nav } = {}) {
  if (!error || error.kind === 'auth') return;
  if (nav !== undefined && nav !== state.nav) return; // the user already left that screen
  switch (error.kind) {
    case 'offline': toast('Mất kết nối — chưa gửi được', 'warn'); break;
    case 'timeout': toast(error.message, 'warn'); break;
    case 'not_found': toast('Không còn thấy phản ánh này', 'error'); if (back) location.hash = back; break;
    case 'server': toast(`Hệ thống đang bận, thử lại sau. ${error.message}`, 'error'); break;
    default: toast(error.message || 'Có lỗi xảy ra', 'error');
  }
}

window.addEventListener('hashchange', render);

async function boot() {
  const token = getToken();
  if (token) {
    try {
      rememberMe(await api('/auth/me'));
    } catch (error) {
      if (error.kind === 'offline' || error.kind === 'timeout') state.me = cachedMe();
      else { clearToken(); rememberMe(null); }
    }
  }
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {}); // I-7: the app works without it
  }
  applyOnline();
  if (!location.hash || location.hash === '#/') location.replace(home());
  else render();
}

boot();

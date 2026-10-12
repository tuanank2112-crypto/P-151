// API client of the phone app (plan 11, 01-CONTRACTS §4 and §7). Same origin as the backend: no CORS, Bearer token.
export const API = '/api/v1';
export const TOKEN_KEY = 'mo-app-token';
export const WRITE_TIMEOUT_MS = 90000; // creating a ticket may call the LLM
export const READ_TIMEOUT_MS = 20000;

export class ApiError extends Error {
  constructor(message, { status = 0, code = null, kind = 'server' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.kind = kind; // offline | timeout | auth | throttle | forbidden | not_found | conflict | invalid | server
  }
}

let memoryToken = null; // fallback when localStorage throws (private mode)
let unauthorizedHandler = () => {};
/** Called once by main.js: what to do when the server says the session is gone. */
export function onUnauthorized(handler) { unauthorizedHandler = handler; }

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable: the session lasts this tab only */ }
  memoryToken = token;
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
  memoryToken = null;
}
function currentToken() { return memoryToken || getToken(); }

/** Same rules as errorMessage() in src/web/app.js. */
export function errorMessage(detail, status) {
  if (!detail) return `Lỗi ${status}`;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join('; ');
  return detail.message || `Lỗi ${status}`;
}

function kindOf(status) {
  if (status === 401) return 'auth';
  if (status === 429) return 'throttle';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 413 || status === 415 || status === 422) return 'invalid';
  return 'server';
}

async function send(path, init, timeoutMs) {
  if (navigator.onLine === false) throw new ApiError('Mất kết nối mạng', { kind: 'offline' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { Accept: 'application/json', ...init.headers };
  const token = currentToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(API + path, { ...init, headers, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new ApiError('Máy chủ phản hồi quá lâu', { kind: 'timeout' });
    throw new ApiError('Không kết nối được máy chủ', { kind: 'offline' });
  } finally {
    clearTimeout(timer);
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.ok) return data;
  const detail = data && data.detail;
  const error = new ApiError(errorMessage(detail, response.status), {
    status: response.status,
    code: detail && typeof detail === 'object' && !Array.isArray(detail) ? detail.code || null : null,
    kind: kindOf(response.status),
  });
  if (response.status === 401 && token) {
    clearToken();
    unauthorizedHandler('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }
  throw error;
}

/** JSON request. Returns the parsed body, or null for 204. */
export function api(path, { method = 'GET', body, timeoutMs } = {}) {
  const init = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return send(path, init, timeoutMs || (method === 'GET' ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS));
}

/** Multipart request; the browser sets the boundary, so no Content-Type here. */
export function apiForm(path, formData, { timeoutMs } = {}) {
  return send(path, { method: 'POST', body: formData }, timeoutMs || WRITE_TIMEOUT_MS);
}

/** An image the API serves behind the Bearer token, as an object URL (caller revokes it). */
export async function apiImage(path) {
  if (navigator.onLine === false) throw new ApiError('Mất kết nối mạng', { kind: 'offline' });
  const token = currentToken();
  const response = await fetch(API + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new ApiError(`Lỗi ${response.status}`, { status: response.status, kind: kindOf(response.status) });
  return URL.createObjectURL(await response.blob());
}

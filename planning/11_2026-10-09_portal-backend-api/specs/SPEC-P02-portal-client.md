# SPEC-P02 — Lớp gọi backend, phiên, ảnh (WP2, 🟠)

## 1. `portal/src/server/backend.ts` (`import "server-only"`)
```ts
export class BackendError extends Error { status: number; code: ActionCode; detail: unknown }
export class BackendUnavailable extends Error {}
export async function api<T>(path: string, init?: { method?: "GET"|"POST"; json?: unknown; form?: FormData; token?: string | null; query?: Record<string, string|undefined> }): Promise<T>
export async function apiRaw(path: string, token: string): Promise<Response>   // ảnh
export function errorFrom(status: number, body: unknown): BackendError          // 01 §8, thuần, có test
```
- URL = `${process.env.BACKEND_URL}/api/v1${path}`. Thiếu `BACKEND_URL` ⇒ `BackendUnavailable("BACKEND_URL chưa cấu hình")`.
- `token` mặc định = token trong cookie hiện tại (`getToken()` §2). `json` ⇒ `Content-Type: application/json`; `form` ⇒ để fetch tự đặt boundary.
- `cache: "no-store"` cho mọi lời gọi. Timeout 15 s (`AbortSignal.timeout`) ⇒ `BackendUnavailable`.
- 401 ⇒ xoá cookie rồi ném `BackendError(401, "UNAUTHENTICATED")`.
- Không log token, không log thân request của cư dân.

## 2. Phiên — `portal/src/server/session.ts` viết lại
- Cookie `portal_session` = `base64url(JSON {t: token, u: Me, exp})` ký HMAC-SHA256 bằng `SESSION_SECRET` (bắt buộc ở production; dev thiếu ⇒ sinh ngẫu nhiên mỗi lần khởi động, log cảnh báo). `httpOnly`, `sameSite=lax`, `path=/`, `maxAge` = `expires_in` backend (28 800 s), `secure` như cũ.
- `getSessionUser(): Promise<SessionUser|null>` — đọc + kiểm chữ ký + hạn; KHÔNG gọi backend mỗi request (backend tự trả 401 khi token chết ⇒ §1 xoá cookie).
- `SessionUser = { username, name (=display_name), role: Role (01 §2), actorId, departmentId, tower, floor, apartment }` (3 trường cuối từ `profile`, chuỗi rỗng nếu không có).
- `requireUser(roles?)` như cũ (redirect `/login` / `ROLE_HOME`).
- `createSession(login: LoginResponse)`, `destroySession()` (gọi `POST /auth/logout` rồi xoá cookie, lỗi mạng bỏ qua).
- Xoá: bảng `sessions` khỏi luồng chạy; `server/password.ts` không còn dùng ở luồng chạy (giữ file cho script cũ).

## 3. `act()` mới — `portal/src/server/act.ts`
`act(fn: (user: SessionUser) => Promise<T>): Promise<ActionResult<T>>`: không phiên ⇒ `UNAUTHENTICATED`; `BackendError` ⇒ `fail(code, message)`; `BackendUnavailable` ⇒ `fail("CONFLICT", "Không kết nối được máy chủ")`; thành công ⇒ `refresh()`. Không còn tham số `db`.

## 4. Đăng nhập
- `login(prev, fd)`: `POST /auth/login {username: trim, password}`; 401 ⇒ "Tên đăng nhập hoặc mật khẩu không đúng."; 429 ⇒ "Đăng nhập sai quá nhiều lần, thử lại sau 5 phút."; vai `QA_INTERNAL` ⇒ đăng xuất ngay + "Tài khoản này không dùng cổng cư dân."; còn lại `createSession` ⇒ redirect `ROLE_HOME`.
- Nút điền nhanh giữ 6 tài khoản + "mật khẩu: 123456" (R5).

## 5. Ảnh
- Route `portal/src/app/api/photos/[ticketId]/[evidenceId]/route.ts` (xoá route cũ `[id]`): phiên bắt buộc; cư dân ⇒ `/resident/tickets/{t}/photos/{e}`, vai khác ⇒ `/mo/tickets/{t}/photos/{e}`; trả nguyên bytes + `Content-Type` của backend, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`; lỗi ⇒ 404 rỗng.
- DTO ảnh: `{ id: evidenceId, url: "/api/photos/<ticketId>/<evidenceId>", name: "Ảnh N" }`.
- Upload: server action chuyển thẳng `File` từ `FormData` của trình duyệt vào `FormData` mới field `files` (nhiều file). Kiểm ở backend (≤ 5 ảnh, 5 MB, JPEG/PNG/WEBP); portal chỉ kiểm sơ bộ số lượng/kích thước để báo sớm.

## 6. Dọn DB cũ
- `src/server/queries.ts`, `src/server/workflow.ts` ⇒ thay bằng `src/server/data/<role>.ts` (đọc) + `src/app/actions/*.ts` (ghi, gọi `api`). Không để hai đường dữ liệu song song.
- `src/db/**`, `drizzle/**`, `scripts/migrate.mts|seed.mts`, `tests/db/**`: GIỮ file (lịch sử, có thể cần đọc dữ liệu portal cũ) nhưng không import từ luồng chạy; `tests/db` loại khỏi `vitest` mặc định (đã tách project `db`). `lib/agent.ts`, `lib/duplicates.ts`: xoá phần dùng ở UI; xoá file nếu không còn ai import (test của chúng xoá theo).
- Grep nghiệm thu: `rg "@/db|server/workflow|server/queries|lib/agent|lib/duplicates" portal/src` ⇒ 0 dòng.

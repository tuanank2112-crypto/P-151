# 01 — Contracts: file, route, hàm, endpoint, lỗi

## §1. Cấu trúc file (BẮT BUỘC đúng tên)
```text
src/mobile/
├── index.html          # vỏ: <meta viewport>, theme-color, manifest, apple-touch-icon, <main id="screen">, #toast, #offline
├── app.css             # token (chép giá trị từ src/web/theme.css :root) + class riêng app
├── manifest.json       # §3
├── sw.js               # service worker, §4 + SPEC-P01 §3
├── icons/icon-192.png, icons/icon-512.png, icons/icon-maskable-512.png, icons/apple-touch-icon-180.png
└── js/
    ├── main.js         # boot, router hash, đăng ký SW, vòng tải lại
    ├── api.js          # api(), apiForm(), lỗi, token
    ├── ui.js           # el(), toast(), confirmSheet(), badge(), formatTime(), STATUS_LABEL
    ├── photo.js        # compressImage()
    ├── resident.js     # màn Cư dân (SPEC-P02)
    └── bql.js          # màn BQL (SPEC-P03)
```
Mỗi file JS ≤ 400 dòng. Nạp bằng `<script type="module" src="js/main.js?v=N">`; mọi `import` cùng `?v=N`.

## §2. Route tĩnh (thay đổi backend DUY NHẤT)
`src/main.py`, ngay sau dòng mount `/ui`:
```python
app.mount("/app", StaticFiles(directory=Path(__file__).parent / "mobile", html=True), name="app")
```
| Request | Kết quả bắt buộc |
|---|---|
| `GET /app/` | 200, `text/html`, chứa `<link rel="manifest" href="manifest.json">` |
| `GET /app/manifest.json` | 200, `application/json`, parse được, `start_url` = `/app/` |
| `GET /app/sw.js` | 200, `content-type` chứa `javascript` |
| `GET /ui/`, `GET /api/v1/...`, `GET /health` | Không đổi so với trước |

## §3. `manifest.json`
```json
{ "name": "MaintenanceOps — Phản ánh cư dân", "short_name": "MaintenanceOps",
  "start_url": "/app/", "scope": "/app/", "display": "standalone",
  "background_color": "<--bg của theme.css>", "theme_color": "<--brand của theme.css>", "lang": "vi",
  "icons": [ {"src":"icons/icon-192.png","sizes":"192x192","type":"image/png"},
             {"src":"icons/icon-512.png","sizes":"512x512","type":"image/png"},
             {"src":"icons/icon-maskable-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"} ] }
```

## §4. Hằng và lưu trữ phía client
| Tên | Giá trị | Ghi chú |
|---|---|---|
| `API` | `'/api/v1'` | đường tương đối, cùng origin |
| `TOKEN_KEY` | `'mo-app-token'` | `localStorage`; mọi đọc/ghi bọc `try/catch` |
| `REFRESH_MS` | `30000` | SPEC-P01 §6 |
| `WRITE_TIMEOUT_MS` | `90000` | tạo ticket có thể gọi LLM |
| `READ_TIMEOUT_MS` | `20000` | |
| `PHOTO_MAX_EDGE` / `PHOTO_QUALITY` | `1600` / `0.82` | SPEC-P01 §8 |
| `MAX_PHOTOS` | `5` | khớp `MAX_RESIDENT_PHOTOS` + `MAX_FILES_PER_REQUEST` |
| `SHELL_CACHE` | `'mo-app-shell-v<N>'` | đổi N mỗi lần sửa file vỏ |

### `api.js` — chữ ký
```js
export async function api(path, { method = 'GET', body, timeoutMs } = {}) // JSON; trả data hoặc null (204)
export async function apiForm(path, formData, { timeoutMs } = {})        // multipart, KHÔNG tự đặt Content-Type
export class ApiError extends Error { status; code; kind }                 // kind: §7
export function getToken(); export function setToken(t); export function clearToken();
```
- Header: `Accept: application/json`, `Authorization: Bearer <token>` khi có token.
- Thông điệp lỗi = như `errorMessage()` ở `src/web/app.js:399`: `detail` chuỗi ⇒ chính nó; mảng ⇒ nối `msg` bằng `; `; object ⇒ `detail.message`; còn lại `Lỗi <status>`.
- 401 khi đang có token ⇒ `clearToken()` + về màn đăng nhập với "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."

## §5. Endpoint — Cư dân (role `RESIDENT`)
| Hành động | Method + path | Body | Trả |
|---|---|---|---|
| Đăng nhập | `POST /auth/login` | `{username, password}` | `{access_token, token_type, user: Me}` |
| Ai đang đăng nhập | `GET /auth/me` | — | `Me {username, display_name, actor_id, role, department_id}` |
| Đăng xuất | `POST /auth/logout` | — | 204 |
| Danh sách của tôi | `GET /resident/tickets` | — | `ResidentTicketView[]` mới nhất trước |
| Gửi phản ánh | `POST /resident/tickets` | `{original_description, channel: "app"}` | 201 `ResidentTicketView` |
| Chi tiết | `GET /resident/tickets/{id}` | — | `ResidentTicketView` |
| Bổ sung | `POST /resident/tickets/{id}/additions` | `{content}` (≥1 ký tự) | `ResidentTicketView` |
| Thêm ảnh | `POST /resident/tickets/{id}/photos` | multipart field `files` (1–5) | `ResidentTicketView` |
| Xem ảnh | `GET /resident/tickets/{id}/photos/{evidence_id}` | — | ảnh (fetch kèm Bearer → `blob:` URL) |
| Đánh giá | `POST /resident/tickets/{id}/rating` | `{score: 1..5}` | `ResidentTicketView` |

CẤM gửi `simulated_received_at`. `allowed_actions` (`"ADD_INFO"`, `"RATE"`) quyết định nút nào hiện.

## §6. Endpoint — BQL (role `BQL`)
| Hành động | Method + path | Body |
|---|---|---|
| Danh sách | `GET /bql/tickets` (KHÔNG query) | — ⇒ `BqlTicketRow[]`, khẩn cấp đã ở trên |
| Chi tiết | `GET /mo/tickets/{id}` | — ⇒ `Case` |
| Ảnh nội bộ | `GET /mo/tickets/{id}/photos/{evidence_id}` | — |
| Nghiệm thu | `POST /bql/tickets/{id}/close` | `{}` hoặc `{note}` |
| Trả làm lại | `POST /bql/tickets/{id}/rework` | `{note}` bắt buộc |
| Hủy | `POST /bql/tickets/{id}/cancel` | `{cancel_reason}` bắt buộc |
| Đóng khẩn cấp đã xử lý | `POST /bql/tickets/{id}/emergency/close` | `{note}` |
| Hạ mức khẩn cấp | `POST /bql/tickets/{id}/emergency/downgrade` | `{note}` bắt buộc |

Body các route BQL là `extra: forbid` (trừ emergency) ⇒ CẤM gửi trường thừa.

## §7. Bảng phân loại lỗi và hành vi bắt buộc
| `kind` | Nhận biết | Hành vi app |
|---|---|---|
| `offline` | `navigator.onLine === false` trước khi gửi, hoặc `TypeError` từ fetch | Không gửi; banner "Mất kết nối"; giữ nguyên nội dung form |
| `timeout` | AbortController hết `timeoutMs` | Ghi: toast "Chưa rõ đã gửi được chưa — đang kiểm tra lại", gọi lại GET danh sách, KHÔNG tự gửi lại. Đọc: toast + giữ dữ liệu cũ |
| `auth` | 401 | §4: xoá token, về đăng nhập |
| `throttle` | 429 (đăng nhập) | Hiện nguyên `detail` dưới form |
| `forbidden` | 403 | Toast thông điệp; tải lại màn (trạng thái có thể đã đổi) |
| `not_found` | 404 | Toast "Không còn thấy phản ánh này"; về danh sách |
| `conflict` | 409 | Toast thông điệp server (guard/đồng thời/quá số ảnh); tải lại chi tiết |
| `invalid` | 413/415/422 | Hiện thông điệp cạnh form; giữ nội dung |
| `server` | 5xx (gồm 503 store) | Toast "Hệ thống đang bận, thử lại sau" + thông điệp; giữ form |

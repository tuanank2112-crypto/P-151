# OPERATIONS — Chạy, thử trên điện thoại, deploy, rollback

## §1. Chạy local (KHÔNG đụng DB chung)
```bash
MO_STORE=memory MO_PHOTO_STORE=local LLM_MODE=mock DATABASE_URL= \
  python -m uvicorn src.main:app --host 0.0.0.0 --port 8001
```
- Máy tính: http://127.0.0.1:8001/app/ (app) · http://127.0.0.1:8001/ui/ (web). Tài khoản `seed/maintenance_v1/accounts.yaml`, mật khẩu `Demo@2026`:
  `cudan01`, `cudan02` (Cư dân) · `bql01` (BQL) · `bptn01` (thử màn "Dùng bản web").
- CẤM đo trên `:8000` (Supabase chung) bằng thao tác ghi; `:8000` chỉ đọc (như plan 07/10).

## §2. Thử trên điện thoại khi CHƯA deploy
| Cách | Lệnh / thao tác | Được gì | Không được gì |
|---|---|---|---|
| DevTools Device Mode | Chrome F12 → Ctrl+Shift+M → iPhone 12 Pro (390×844) | Bố cục, luồng, harness Playwright | Camera thật |
| Điện thoại cùng Wi-Fi | §1 với `--host 0.0.0.0`; `ipconfig` lấy IPv4; mở cổng: `New-NetFirewallRule -DisplayName "MO 8001" -Direction Inbound -Protocol TCP -LocalPort 8001 -Action Allow` (PowerShell admin); điện thoại mở `http://<IPv4>:8001/app/` | Toàn bộ luồng, chụp/chọn ảnh qua `<input capture>` | Cài lên màn hình chính, service worker (không phải HTTPS) |
| Android + USB | Bật USB debugging; Chrome máy tính `chrome://inspect` → Port forwarding `8001 → localhost:8001`; điện thoại mở `http://localhost:8001/app/` | Như trên + service worker + cài app (localhost được coi là an toàn) | — |
| Tunnel HTTPS tạm | `cloudflared tunnel --url http://localhost:8001` | Link HTTPS gửi người khác, iPhone cài thử | ⚠️ Mở máy local ra Internet: chỉ backend memory dữ liệu `SIM-`, tắt ngay sau khi thử |

Xoá luật firewall sau khi thử: `Remove-NetFirewallRule -DisplayName "MO 8001"`.

## §3. Deploy (gate server)
- App nằm trong `src/` ⇒ image `backend` đã chép; KHÔNG cần service mới: `docker compose up -d --build backend` (local `:8000`) hoặc deploy image lên Render.
- Điều kiện gate server: URL **HTTPS công khai** của backend (Render) — hiện CHƯA có. 🖐 Người lo deploy (Notion: Châm Anh) cung cấp URL.
- Sau deploy: mở `https://<host>/app/` trên điện thoại thật Android + iPhone, cài lên màn hình chính, chạy kịch bản G6–G8 (TESTING).
- Bump `?v=` + `SHELL_CACHE` mỗi lần đổi file vỏ; nếu không, điện thoại đã cài giữ bản cũ tới lần mở sau.

## §4. Thứ tự bắt buộc khi thi công
1. WP1 (mount + vỏ) ⇒ chạy `test_mobile_static.py` xanh.
2. WP2, WP3 (có thể song song — khác file `resident.js`/`bql.js`, chung `ui.js`/`api.js` chỉ do WP1 tạo; WP2/3 CHỈ thêm export, không sửa chữ ký có sẵn).
3. WP4 harness ⇒ phép phá ⇒ G1–G5.
4. WP6 docs/não/version. WP5 khi có HTTPS.

## §5. Rollback
- Gỡ app hoàn toàn: xoá dòng mount `/app` trong `src/main.py` (+ thư mục `src/mobile/`), build lại `backend`. Web `/ui/` và API không bị ảnh hưởng vì app không đổi chúng.
- Điện thoại đã cài: SW cũ trả `index.html` cache nhưng mọi `/api/` đi mạng ⇒ không có dữ liệu lệch; người dùng gỡ app khỏi màn hình chính.
- Không có migration DB ⇒ không cần rollback dữ liệu.

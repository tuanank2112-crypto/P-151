# SPEC-P01 — Dữ liệu, đăng nhập, phân quyền

## 1. Kết nối DB — `portal/src/db/index.ts`
- `DATABASE_URL` bắt buộc (postgres://…). Thiếu ⇒ ném lỗi ngay khi import ở server (fail closed), KHÔNG mặc định DB nào.
- Một `pg.Pool` dùng lại qua `globalThis` (tránh rò kết nối khi HMR). `db = drizzle(pool, { schema })`.
- `import 'server-only'` ở mọi file trong `src/db/` và `src/server/`.

## 2. Mật khẩu & session — `portal/src/server/auth.ts`
```ts
hashPassword(plain: string): Promise<string>        // "scrypt$16384$8$1$<saltB64>$<hashB64>", salt 16 byte, keylen 64
verifyPassword(plain: string, stored: string): Promise<boolean>  // timingSafeEqual; stored không đúng định dạng ⇒ false
createSession(userId: number): Promise<string>      // token 32 byte base64url; lưu sha256(token); hạn 7 ngày
getSessionUser(): Promise<SessionUser | null>       // đọc cookie, join users, hết hạn ⇒ xoá + null
requireUser(roles?: Role[]): Promise<SessionUser>   // trang: không session ⇒ redirect('/login'); sai vai ⇒ redirect(homeOf(role))
destroySession(): Promise<void>
type SessionUser = { id: number; username: string; name: string; role: Role; tower: string|null; floor: string|null; apartment: string|null }
```
- Cookie `portal_session`: `httpOnly`, `sameSite: 'lax'`, `secure` khi `NODE_ENV=production`, `path: '/'`, `maxAge` 7 ngày.
- Đăng nhập sai (không có user, sai mật khẩu, `password_hash` khoá `'!'`) ⇒ cùng một thông báo, cùng một nhánh `verifyPassword` (chạy scrypt giả khi không có user để thời gian phản hồi gần như nhau).
- CẤM: lưu token thô trong DB; đặt vai trò trong cookie; tin vai trò gửi từ client.

## 3. Trang chủ theo vai — `homeOf(role)`
`resident → /resident`, `reception → /reception`, `management → /management`, `cleaning → /cleaning`, `technical → /technical`.
`/` ⇒ có session thì `redirect(homeOf)`, không thì `/login`. `/login` khi đã đăng nhập ⇒ `redirect(homeOf)`.

## 4. Ma trận quyền — `portal/src/lib/permissions.ts`
Bảng `PERMS` của `Management.dc.html` BỎ dòng "Sửa từ khóa của Agent" (Q12) ⇒ 9 dòng × 5 vai. Hàm `can(role, perm)` dùng trong Server Actions; KHÔNG còn hiển thị trên UI (tab Phân quyền đã bỏ).
| Perm key | resident | reception | management | cleaning | technical |
|---|---|---|---|---|---|
| submit_ticket "Gửi phản ánh" | ✔ | | | | |
| view_own "Xem ticket của chính mình" | ✔ | ✔ | ✔ | ✔ | ✔ |
| view_agent "Xem gợi ý của Agent" | ✔ | ✔ | ✔ | ✔ | ✔ |
| route_ticket "Phân loại và chuyển ticket" | | ✔ | ✔ | | |
| update_progress "Nhận và cập nhật tiến độ ticket" | | | ✔ | ✔ | ✔ |
| assign_staff "Phân công nhân viên xử lý" | | | | ✔ | ✔ |
| view_all "Xem toàn bộ ticket" | | | ✔ | | |
| view_reports "Xem báo cáo hiệu suất" | | ✔ | ✔ | | |
| manage_notices "Đăng thông báo, phân quyền" | | | ✔ | | |

## 5. Phạm vi đọc dữ liệu (`portal/src/server/queries.ts`)
| Vai | Đọc được |
|---|---|
| resident | ticket `resident_id = mình` (đủ lịch sử, đánh giá, ảnh, extras), notices, keywords (để xem trước Agent) |
| reception | ticket stage 1 chưa huỷ (hộp chờ) + ticket đã chuyển/`need_info` (bảng đã phân loại), keywords |
| cleaning / technical | ticket `dept = phòng mình` và chưa huỷ, staff phòng mình, materials (kỹ thuật), **đánh giá đầy đủ (sao, thẻ, bình luận)** của ticket phòng mình. **CẤM** gửi xuống tên/tài khoản/`resident_id` của người gửi và tên file ảnh gốc (đổi "Ảnh N") — plan Q11. Ngoại lệ có chủ đích: số căn hộ trong `location` khi sự cố "Trong căn hộ" |
| management | toàn bộ ticket, ratings |
DTO gửi xuống client chỉ gồm trường cần hiển thị (không `password_hash`, không dữ liệu ảnh — chỉ id ảnh).

## 6. Seed — `portal/scripts/seed.ts`
- Chỉ seed khi bảng `users` rỗng. `--reset` ⇒ TRUNCATE mọi bảng của app rồi seed (CẤM khi `NODE_ENV=production`).
- 5 tài khoản mật khẩu `123456`: `cudan` (Nguyễn Minh Anh, S2.05, tầng 12, căn 1208), `tiepnhan`, `quanly`, `vesinh`, `kythuat`.
  Cư dân phụ (chủ các ticket mẫu) có `password_hash = '!'` (không đăng nhập được).
- Từ khóa = hợp nhất `rules` (Reception) + `CATS` (Resident) theo phòng ban; staff: Tổ A/B/C (vệ sinh), Kỹ thuật viên 1–4 (kỹ thuật).
- ~20 ticket mẫu phủ mọi stage/cờ (huỷ, tạm hoãn, cần bổ sung, quá hạn, đánh giá thấp), thời gian TƯƠNG ĐỐI theo lúc seed; Agent chạy thật trên mô tả.

# 01 — Contracts: schema, stage, Agent, action, lỗi

## 1. Schema PostgreSQL (Drizzle `portal/src/db/schema.ts`, migration SQL trong `portal/drizzle/`)
```text
enum role  = resident | reception | management | cleaning | technical
enum dept  = ve_sinh | ky_thuat | bql
enum place = floor | lobby | lift | common

users     (id serial PK, username text UNIQUE NOT NULL, password_hash text NOT NULL, name text NOT NULL,
           role role NOT NULL, tower text, floor text, apartment text, created_at timestamptz NOT NULL default now())
sessions  (id text PK  -- sha256(token) hex, user_id int NOT NULL → users ON DELETE CASCADE,
           expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL default now())
staff     (id serial PK, dept dept NOT NULL, name text NOT NULL, skill text, area text, capacity int,
           UNIQUE(dept, name))
tickets   (id serial PK, resident_id int NOT NULL → users, description text NOT NULL, location text NOT NULL,
           place place NOT NULL, place_detail text, urgent bool NOT NULL default false,
           ai_dept dept, ai_confidence int NOT NULL default 0, ai_keywords text[] NOT NULL default '{}',
           dept dept, assignee_id int → staff, stage smallint NOT NULL default 1 CHECK (stage BETWEEN 1 AND 6),
           need_info bool NOT NULL default false, paused bool NOT NULL default false, paused_until timestamptz,
           cancelled bool NOT NULL default false, merged_into int → tickets, merged_from int[] NOT NULL default '{}',
           extras text[] NOT NULL default '{}', dup_dismissed int[] NOT NULL default '{}'  -- migration 0001, done_at timestamptz, created_at timestamptz NOT NULL default now(),
           updated_at timestamptz NOT NULL default now())
           INDEX (resident_id), INDEX (dept, stage), INDEX (stage)
photos    (id serial PK, ticket_id int NOT NULL → tickets CASCADE, name text NOT NULL, mime text NOT NULL,
           size int NOT NULL, data bytea NOT NULL, created_at timestamptz NOT NULL default now())
history   (id serial PK, ticket_id int NOT NULL → tickets CASCADE, label text NOT NULL, note text NOT NULL default '',
           actor_id int → users, created_at timestamptz NOT NULL default now())  INDEX (ticket_id)
ratings   (ticket_id int PK → tickets CASCADE, stars smallint NOT NULL CHECK (1..5), tags text[] NOT NULL default '{}',
           comment text NOT NULL default '', created_at timestamptz NOT NULL default now())
keywords  (id serial PK, dept dept NOT NULL, word text NOT NULL, UNIQUE(dept, word))
materials (id serial PK, ticket_id int NOT NULL → tickets CASCADE, item text NOT NULL, requested_by int NOT NULL → users,
           staff_id int → staff, received bool NOT NULL default false, created_at timestamptz NOT NULL default now())
notices   (id serial PK, title text NOT NULL, body text NOT NULL, published_at timestamptz NOT NULL default now())
```
- Mã hiển thị ticket: `PA-` + `id` đệm 4 chữ số (`ticketCode(id)`), KHÔNG lưu cột riêng.
- CẤM xoá cứng ticket từ UI. Huỷ = `cancelled = true`.

## 2. Stage & cờ (một mô hình cho mọi vai trò)
| stage | Nhãn cư dân | Nghĩa | Vào bằng |
|---|---|---|---|
| 1 | Tiếp nhận | Chờ Ban tiếp nhận (`need_info` có thể true) | cư dân gửi |
| 2 | Thẩm định | Ban tiếp nhận đã xác nhận, `dept` đã đặt, chờ phòng ban nhận | `reception.route`, `management.reassign` |
| 3 | Phân công | Không lưu lâu: được đánh dấu xong bằng sự kiện "Phân công" | — |
| 4 | Đang xử lý | Đã giao người (`assignee_id`) hoặc BQL nhận | `dept.assign`, `management.start`, `resident.reject` |
| 5 | Nghiệm thu | Phòng ban báo xong (`done_at`), chờ cư dân | `dept.finish` |
| 6 | Hoàn tất | Cư dân xác nhận | `resident.accept` |

Cờ phụ: `paused` (+`paused_until`) chỉ ở stage 2–4; `cancelled` (huỷ hoặc bị gộp: `merged_into` khác null).

Ánh xạ nhãn theo dashboard:
- Ban quản lý: stage 1 → "Chờ phân loại" (`st-moi`); 2 → "Đã chuyển phòng ban" (`st-da_chuyen`); 3–4 → "Đang xử lý" (`st-dang_xu_ly`); 5 → "Chờ nghiệm thu" (`st-da_chuyen`); 6 → "Hoàn thành" (`st-hoan_thanh`); huỷ → "Đã hủy" (`st-hoan_thanh`).
- Phòng ban: cột "Cần nhận" = stage 2; "Đang xử lý" = 3–4; "Hoàn thành" = 5–6.
- "Đang mở" (SLA, quá hạn): `!cancelled && stage < 5`.
- Cư dân: theo `status()` của `Resident.dc.html` (huỷ › tạm hoãn › 5 "Chờ nghiệm thu" › 6 "Hoàn tất" › nhãn bước).

## 3. Agent — `portal/src/lib/agent.ts`
```ts
type Dept = 've_sinh' | 'ky_thuat' | 'bql'
type KeywordRules = Record<Dept, string[]>
type AgentResult = { dept: Dept | null; confidence: number; keywords: string[]; urgent: boolean; locationFromText: string | null }
function classify(text: string, rules: KeywordRules, home: { tower: string; floor: string }): AgentResult
```
- So khớp NGUYÊN TỪ trên `text.toLowerCase()` (giữ dấu): từ khóa không được dính chữ/số khác (`hasWord`, ranh giới `\p{L}\p{N}`; plan Q08). CẤM quay lại chuỗi con — "ồn" sẽ khớp "cộng đồng". `hits[d]` = từ khóa của `d` xuất hiện.
- `total = Σ|hits|`. `total = 0` ⇒ `{dept: null, confidence: 0, keywords: []}`.
- Ngược lại `dept` = phòng ban có `|hits|` lớn nhất (hoà ⇒ thứ tự `ve_sinh, ky_thuat, bql`),
  `confidence = min(97, round(48 + 38·best/total + 5·min(best,3)))`, `keywords = hits[dept]`.
- `urgent` = text chứa một trong `URGENT_WORDS = [cháy, khói, chập, kẹt, ngập, gas, vỡ ống, tràn, có người bên trong]`.
- `locationFromText`: `/tầng\s*(b?\d{1,2})/i`, `/tòa\s*(s\d\.\d{2})/i`; khác tầng/tòa nhà của cư dân (tầng "1" không tính)
  ⇒ `"Tòa <T>[ · Tầng <F>]"`, ngược lại `null`.
- `techSkill(text): 'Điện' | 'Cấp thoát nước' | 'Thang máy' | null` — chuyên môn gợi ý cho Phòng kỹ thuật (từ khóa cố định trong code).

## 3b. Agent phát hiện trùng — `portal/src/lib/duplicates.ts` (Q13)
`findDuplicates(t, others, dismissed) → { id, score, reasons[] }[]` (tối đa 3, cao trước). Ứng viên khi ĐỦ: ticket khác cũ hơn `t`
trong 7 ngày, chưa huỷ, stage ≤ 4, cùng phòng ban (gợi ý sống khi stage 1, phòng ban đã chuyển sau đó), cùng `placeKey`
(tòa + tầng / tòa + thang máy / nguyên chuỗi khu vực chung), ≥ 1 từ khóa chung, không nằm trong `dup_dismissed`.
`score = min(97, round(55 + 35·chung/hợp + 10 nếu cách ≤ 24 giờ))`. Ticket mới hơn luôn là bản trùng (gộp mới vào cũ).

## 4. Server Actions (`portal/src/app/actions/*.ts`, `'use server'`)
Mọi action trả `ActionResult`:
```ts
type ActionResult<T = null> = { ok: true; data: T } | { ok: false; code: ErrorCode; message: string }
type ErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'CONFLICT'
```
| Action | Vai trò | Tiền điều kiện | Kết quả |
|---|---|---|---|
| `login(prev, formData)` | — | — | đặt cookie, `redirect(homeOf(role))` |
| `logout()` | mọi vai | — | xoá session + cookie, `redirect('/login')` |
| `submitTicket(formData)` | resident | mô tả ≥10 ký tự (trim); ≤5 ảnh JPG/PNG/WEBP (magic bytes), ≤5 MB/ảnh | stage 1, `{id, code, dept, urgent}` |
| `cancelTicket(id)` | resident chủ | stage ≤ 2, chưa huỷ | `cancelled` |
| `addExtra(id, text)` | resident chủ | chưa huỷ, stage < 6, text không rỗng | extras += text; `need_info=false` |
| `acceptTicket(id)` / `rejectTicket(id)` | resident chủ | stage 5 | 6 / 4 (`done_at=null`) |
| `rateTicket(id, {stars, tags, comment})` | resident chủ | stage 6, chưa có rating, stars 1..5 | rating |
| `routeTicket(id, dept)` | reception, management | stage 1, chưa huỷ | stage 2, `dept`, lưu snapshot Agent hiện tại |
| `setUrgent(id, urgent)` | reception | stage 1 | `urgent` |
| `askMoreInfo(id)` | reception | stage 1 | `need_info = true` |
| `mergeTicket(sourceId, targetId)` | reception | nguồn stage 1; đích chưa huỷ, stage ≤ 4, ≠ nguồn; **đích phải nằm trong `duplicatesFor(nguồn)`** (Agent đề xuất), không thì INVALID_INPUT | nguồn huỷ + `merged_into`; đích extras += `[Gộp từ PA-x] …`, `merged_from` += nguồn |
| `dismissDuplicate(id, otherId)` | reception | stage 1, chưa huỷ, `otherId` đang được Agent đề xuất (không thì CONFLICT) | `dup_dismissed += otherId`, Agent thôi đề xuất cặp này |
| `assignStaff(id, staffId)` | cleaning (ve_sinh), technical (ky_thuat) | ticket.dept = phòng mình, stage 2, staff cùng phòng | stage 4, `assignee_id`, `paused=false` |
| `finishTicket(id)` | cleaning, technical, management (bql) | ticket.dept = phòng mình, stage 3–4 | stage 5, `done_at=now()` |
| `startTicket(id)` | management | dept bql, stage 2 | stage 4 |
| `reassignTicket(id, dept)` | management | ticket.dept = bql, stage 2–4, dept ∈ {ve_sinh, ky_thuat} | stage 2, `assignee_id=null` |
| `requestMaterial(id, item)` | technical | dept ky_thuat, stage 3–4, item 1..120 ký tự | materials += 1 |
| `receiveMaterial(materialId)` | technical | chưa nhận | `received = true` |
Sau khi ghi thành công: `refresh()` (next/cache).

## 5. Bảng lỗi & hành vi bắt buộc của caller
| Code | Khi nào | Caller (client) BẮT BUỘC |
|---|---|---|
| UNAUTHENTICATED | không có/hết hạn session | `router.push('/login')` |
| FORBIDDEN | sai vai trò cho action | hiện `message` trong hộp lỗi, không thử lại |
| NOT_FOUND | ticket không tồn tại HOẶC ngoài phạm vi (cư dân xem ticket người khác) | hiện `message`; KHÔNG phân biệt hai trường hợp |
| INVALID_INPUT | dữ liệu không hợp lệ | hiện `message` cạnh form |
| CONFLICT | stage/cờ đã đổi (UPDATE có điều kiện ảnh hưởng 0 dòng) | hiện "Ticket vừa được cập nhật, đã tải lại." và `router.refresh()` |

## 6. Route Handler
`GET /api/photos/[id]` — trả ảnh (`Content-Type` = mime đã kiểm, `Cache-Control: private, no-store` — máy dùng chung không được phát lại ảnh cho người đăng nhập sau).
Quyền: cư dân chủ ticket, reception, management, phòng ban của ticket. Khác ⇒ 404.

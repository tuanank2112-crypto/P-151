# OPERATIONS — DEPLOY, BIẾN MÔI TRƯỜNG, SEED, ROLLBACK, CÔNG TẮC NGẮT

> Đọc trước lần deploy đầu tiên **và mọi lần sau**. Không bỏ qua được.
> Phụ thuộc đọc: [`00-ARCHITECTURE.md`](00-ARCHITECTURE.md) §10,
> [`01-CONTRACTS.md`](01-CONTRACTS.md) §3, §6.

---

## 1. Luật vận hành số một `[Đ11]`

> **Deploy ở D2, không để cuối.**

*"Web đã deploy"* là gạch đầu tiên của rubric (R1). Nó phải xanh sớm rồi bồi lên, chứ
không phải chờ tới D7 mới biết Vercel không build được. Deploy một trang trắng ghi
*"Resident Agent v1.0 — đang dựng"* vào D2 vẫn tốt hơn một app hoàn hảo chưa deploy.

**Nhịp bắt buộc:** từ D2 trở đi, **mỗi ngày ít nhất một lần deploy thành công**. Hai
ngày liền không deploy được là tín hiệu đỏ, dừng viết tính năng và sửa deploy.

---

## 2. Môi trường đã đo

Đo trên máy dev ngày 2026-09-20, lệnh
`node --version; npm --version; git --version; psql --version`:

| Công cụ | Kết quả đo | Hệ quả |
| :-- | :-- | :-- |
| Node | `v24.12.0` | ✅ đủ cho Next.js 15 |
| npm | `11.6.2` | ✅ |
| git | `2.55.0.windows.3` | ✅ |
| **psql** | **`NOT FOUND`** | ⚠️ **Mọi lệnh nghiệm thu chạm DB phải có bản Node** — xem §6 |
| Shell | PowerShell 5.1 + Git Bash | Script viết `.mjs` chạy được cả hai; **CẤM** viết `.sh` là đường duy nhất |
| Hệ điều hành | Windows 11 Pro 10.0.26200 | Đường dẫn dùng `/`, Node tự chuẩn hoá |

**Hệ quả bắt buộc cho worker:** mọi lệnh trong các file SPEC ghi dạng `psql -c "..."`
đều có bản thay thế `node scripts/sql.mjs "..."`. Dùng bản Node khi chạy trên máy này.

---

## 3. Biến môi trường

| Biến | Bắt buộc | Nơi đặt | Giá trị / ghi chú |
| :-- | :-- | :-- | :-- |
| `DATABASE_URL` | ✅ | Vercel + `.env.local` | Chuỗi Neon, **có** `?sslmode=require` |
| `GEMINI_API_KEY` | ✅ | Vercel + `.env.local` | Khoá Gemini API. **Chỉ đọc ở `lib/adapters/model.ts`** (BB-07) |
| `SESSION_SECRET` | ✅ | Vercel + `.env.local` | ≥ 32 byte ngẫu nhiên, ký cookie HMAC |
| `RETRIEVAL_MODE` | ✅ | **Vercel = `hybrid`; local = `hybrid`** | `01-CONTRACTS.md` §4.1. Đặt `lexical` là đường lùi tức thì khi hạn mức embedding căng `[Đ18]` |
| `SEED_RESIDENT_PASSWORD` | ✅ | chỉ khi seed | Mật khẩu demo |
| `SEED_BQL_PASSWORD` | ✅ | chỉ khi seed | Mật khẩu demo |
| `VYCE_API_KEY` | ❌ | Vercel + `.env.local` | Đ53 — chỉ dùng khi bật fallback Vyce. Đọc DUY NHẤT ở `lib/adapters/model.ts` |
| `MODEL_FALLBACK_VYCE` / `_A1` / `_A2` / `_A3` | ❌ | Vercel + `.env.local` | Đ53 — chuỗi model Vyce (id không tiền tố) chạy SAU khi cả chuỗi Gemini 429/503. Chủ tịch chốt: `_A2=deepseek-v4.1,claude-sonnet-4-6` (soạn), `_A3=claude-sonnet-4-6,deepseek-v4.1` (chấm). Trống ⇒ tắt |
| `GOLDEN_CONCURRENCY` | ❌ | chỉ local | Số lời gọi song song của bộ chạy Golden. Mặc định **4**, **chặn cứng trong khoảng 3–5** `[Đ19]` |
| `KILL_SWITCH_AGENTS` | ❌ | Vercel | `1` ⇒ bật chế độ dự phòng, xem §7 |
| `DEMO_CLOCK_ISO` | ❌ | chỉ local | Ghi đè `now()` cho kịch bản 23:39 (`SPEC-P05` §9). **CẤM đặt trên Vercel** |

> **`ANTHROPIC_API_KEY` đã BỊ BỎ** `[Đ17]`. Không còn biến đó ở bất kỳ đâu. Gói
> `@anthropic-ai/sdk` cũng gỡ khỏi `package.json`. Ai thấy tên cũ còn sót trong mã hay
> trong `.env.example` thì đó là rác của lượt trước, xoá.

**Ghi chú về hình dạng khoá — đọc trước khi kết luận khoá hỏng.** Khoá đang dùng có dạng
`AQ.…` (53 ký tự), **không** phải dạng `AIzaSy…` quen thuộc. Đây **vẫn là khoá API hợp
lệ**: đã đo `GET /v1beta/models?key=…` → **HTTP 200**. Ghi ra đây vì lượt trước đã có
người kết luận nhầm nó là token phiên OAuth và suýt loại bỏ một khoá dùng được `[Đ17]`.

**CẤM** commit `.env.local`. **CẤM** in `GEMINI_API_KEY` ra log, ra thông báo lỗi, ra
report, hay chép vào bất kỳ file nào trong repo — **kể cả một phần, kể cả để "thử
nhanh"**. Kiểm: `git check-ignore .env.local` phải in `.env.local`.

---

## 4. Thứ tự dựng — làm đúng thứ tự này

Mỗi bước có lệnh kiểm. Bước chưa xanh thì **không** sang bước sau.

| # | Bước | Lệnh | Kiểm xong khi |
| :-- | :-- | :-- | :-- |
| 1 | Tạo dự án Next.js + TS strict | `npx create-next-app@latest --ts` | `npx tsc --noEmit` exit 0 |
| 2 | Tạo DB Neon, lấy `DATABASE_URL` | (bảng điều khiển Neon) | `node scripts/sql.mjs "select 1"` in `1` |
| 3 | Bật extension | `node scripts/sql.mjs "create extension if not exists vector; create extension if not exists unaccent"` | `node scripts/sql.mjs "select extname from pg_extension"` có `vector`, `unaccent` |
| 4 | Migration schema | `npm run db:migrate` | `node scripts/dump_schema.mjs` in **15** `reason_code` |
| 5 | **Deploy lần đầu** | `vercel --prod` | Mở URL, trang tải được. **Đây là R1** |
| 6 | Seed người dùng | `npm run db:seed:users` | `node scripts/sql.mjs "select email, role from users"` in **2** dòng |
| 7 | Seed tri thức ⚠ **nay cần `GEMINI_API_KEY`** | `npm run db:seed:knowledge` | `documents=19`, `sections>=97`, `chunks>=97`, **`embedded=<số chunk>`** |
| 8 | Kiểm khuyết tật | `node scripts/validate_knowledge.mjs` | `defects_ok: 4/4`, exit 0 |
| 9 | Kiểm Golden | `node scripts/validate_golden.mjs` | `faq: 50 · safety: 16 · canonical_codes_covered: 10/10` |
| 10 | Chạy Golden | `npm run eval:golden` | `answerable >= 34/40`, `safety >= 15/16` |

**Bước 5 nằm giữa, không nằm cuối** — đúng tinh thần §1.

### 4.1 — Seed người dùng: hai tài khoản, không hơn

```text
resident@demo.local  role=resident  resident_id=R-0001  owned_property_ids={S1.120817}
bql@demo.local       role=bql       resident_id=NULL    owned_property_ids={}
```

Mật khẩu từ `SEED_RESIDENT_PASSWORD` / `SEED_BQL_PASSWORD`, băm bằng `scrypt`.
**CẤM** hardcode mật khẩu trong mã. **CẤM** tạo tài khoản thứ ba (NG-09).

Dữ liệu cư dân mô phỏng dùng tên `Cư dân A`, số điện thoại dạng `0900000001` (VC-08).

---

## 5. Seed tri thức — luật chạy

```bash
npm run db:seed:knowledge          # mặc định: CHỈ chèn thứ chưa có
npm run db:seed:knowledge -- --reset   # xoá sạch documents/sections/chunks rồi seed lại
```

| Luật | Nội dung |
| :-- | :-- |
| Idempotent | Chạy hai lần ⇒ cùng kết quả. Dùng `ON CONFLICT (document_id) DO UPDATE` |
| Một transaction | Hỏng giữa chừng ⇒ rollback sạch. **CẤM** để DB ở trạng thái nửa vời |
| Kiểm trước khi ghi | Gọi `validate_knowledge.mjs` **trước**; fail ⇒ không chạm DB |
| `--reset` không đụng | `users`, `conversations`, `messages`, `answer_turns`, `review_queue`, `bookings`, `receipts` |
| Thứ tự | `documents` → `sections` → `chunks`. Khoá ngoại bắt buộc thứ tự này |
| **Embedding trước, ghi DB sau** | **BẮT BUỘC** — xem khối ngay dưới |
| **Song song khi embedding** | **3–5**, backoff cho cả 429 lẫn 503, **y như bộ chạy Golden** (§9.3) |

> ### ⚠ Seed nay TỐN HẠN MỨC — đổi thứ tự thi hành, không đổi bất biến
>
> Từ Đ18, seed không còn tính embedding tại chỗ bằng model tải sẵn mà **gọi API**:
> `≥ 97` chunk ⇒ **`≥ 97` lời gọi `embedContent`**, trong khi trần đo được chỉ nằm
> **giữa 15 và 40 lời gọi/phút** (§9.1). Đây là chỗ va hạn mức nặng nhất của cả dự án,
> nặng hơn một lượt Golden tính trên mỗi phút.
>
> **Va chạm với luật "Một transaction" ở bảng trên:** nếu vừa gọi API vừa ghi trong một
> transaction, thì một lỗi 429 ở chunk thứ 90 sẽ **rollback sạch** và **đốt bỏ 89 lời
> gọi đã trả tiền bằng hạn mức**. Lần chạy lại rất có thể lại 429, thành vòng luẩn quẩn.
>
> **Chốt — hai pha tách bạch, giữ nguyên cả hai bất biến:**
>
> 1. **Pha A (chỉ mạng, không DB):** tính đủ embedding cho **toàn bộ** chunk, có backoff,
>    ghi ra **một file đệm cục bộ** (ví dụ `.cache/embeddings.json`, **phải nằm trong
>    `.gitignore`**). Pha này **có thể chạy lại nhiều lần** và **BẮT BUỘC bỏ qua chunk đã
>    có trong file đệm** — để lần chạy lại chỉ tốn hạn mức cho phần còn thiếu.
> 2. **Pha B (chỉ DB, không mạng):** mở **một transaction**, ghi `documents → sections →
>    chunks` kèm vector đọc từ file đệm. Không một lời gọi mạng nào trong pha này.
>
> Nhờ vậy: lỗi mạng **không** làm bẩn DB, và lỗi DB **không** đốt hạn mức. Luật "Một
> transaction" và luật "Idempotent" ở bảng trên **giữ nguyên, không nới**.
>
> **CẤM** ghi vector vào DB theo từng lời gọi API một (ghi lắt nhắt ngoài transaction) —
> đó chính là trạng thái nửa vời mà bảng trên cấm.

**Cảnh báo:** `--reset` xoá `chunks` kéo theo mọi citation lịch sử trỏ vào section đã
mất. Trước buổi demo thì chạy `--reset` một lần rồi thôi, đừng chạy giữa buổi.
**Thêm một lý do nữa để đừng chạy `--reset` bừa:** nó buộc phải embed lại toàn corpus,
tức tiêu lại `≥ 97` lời gọi hạn mức. Giữ file đệm ở Pha A thì `--reset` rẻ lại — đó là
lợi ích thứ hai của việc tách hai pha.

---

## 6. Không có `psql` — bản thay thế bằng Node

`psql` **không có trên máy dev** (§2). Mọi lệnh SQL trong các file SPEC dùng script này:

```js
// scripts/sql.mjs — dùng: node scripts/sql.mjs "select count(*) from documents"
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const q = process.argv[2];
if (!q) { console.error("usage: node scripts/sql.mjs \"<sql>\""); process.exit(2); }
try {
  const rows = await sql(q);
  if (rows.length === 0) console.log("(0 rows)");
  else { console.log(Object.keys(rows[0]).join(" | "));
         rows.forEach(r => console.log(Object.values(r).join(" | "))); }
  process.exit(0);
} catch (e) { console.error(`SQL_ERROR: ${e.message}`); process.exit(1); }
```

Bảng quy đổi dùng khi đọc các file SPEC khác:

| Trong SPEC ghi | Chạy trên máy này |
| :-- | :-- |
| `psql -c "<q>"` | `node scripts/sql.mjs "<q>"` |
| `psql -f scripts/x.sql` | `node scripts/sql.mjs "$(cat scripts/x.sql)"` (Git Bash) |

---

## 7. Công tắc ngắt (kill switch)

Một biến, một tác dụng, bật được từ bảng điều khiển Vercel mà **không cần deploy lại**.

### `KILL_SWITCH_AGENTS=1`

Khi bật, `runTurn()` **bỏ qua A2 và A3**, chỉ chạy tới chặng `eligibility`, rồi:

- Có chunk eligible ⇒ trả **nguyên văn** `content_vi` của chunk tốt nhất + citation
  đầy đủ. Ghi nhãn *"Trích nguyên văn từ tài liệu"*.
- Không có ⇒ `no_eligible_source` như bình thường.
- `answer_turns.reason_code = NULL`, `decision = 'answer'`, `s3_faithfulness = 1.0`
  (trích nguyên văn thì mọi claim đều neo được — đúng theo định nghĩa, không phải mẹo).
- Ghi `pipeline_steps` có `note: "kill_switch_agents"`.
- **BẮT BUỘC ép `RETRIEVAL_MODE=lexical` trong lượt này, bất kể biến môi trường đang
  đặt gì.** Xem khối cảnh báo ngay dưới.

> ### ⚠ Phao thủng — hệ quả bắt buộc của Đ18, phải xử ở P02
>
> Từ Đ18, `hybrid` cần **một lời gọi embedding tới đúng nhà cung cấp đang hỏng** để dựng
> vector truy vấn. Mà công tắc này được bật **chính vì** nhà cung cấp đó sập hoặc hết hạn
> mức. Để nguyên thì chặng `retrieval` chết trước khi tới `eligibility`, và **cái phao
> chìm cùng con tàu**.
>
> **Chốt:** `KILL_SWITCH_AGENTS=1` ⇒ truy hồi chạy **lexical thuần**, không gọi ra ngoài
> một lời nào. Lexical là SQL thuần trên Postgres, không phụ thuộc nhà cung cấp model.
>
> Đây cũng là điều kiện để số đo `OP-M8` (*"**0** lời gọi model"*) còn đúng. Nếu để
> `hybrid` chạy thì lượt kill-switch tốn 1 lời gọi embedding và **OP-M8 tự mâu thuẫn**.

**Đây là phao cứu sinh cho buổi demo.** Gemini API sập, trả 503 *"high demand"*, hoặc
hết hạn mức giữa buổi thì bật công tắc: sản phẩm vẫn trả lời có trích dẫn (R3), vẫn lưu
lịch sử (R4), vẫn escalate đúng (R5). Chỉ mất R6 (3 agent) — và giám khảo đã xem trang
trace trước đó.

**Bắt buộc thử công tắc này ít nhất một lần trước buổi demo.** Phao chưa thử không
phải phao. Đây là Exit Gate G13.

**CẤM** dùng công tắc để "vượt" một Exit Gate. Nó là dự phòng lúc trình diễn, không
phải đường tắt nghiệm thu.

---

## 8. Rollback

| Sự cố | Cách lùi | Thời gian | Mất gì |
| :-- | :-- | :-- | :-- |
| Deploy hỏng | Bảng Vercel → **Instant Rollback** về bản trước | < 1 phút | Không mất dữ liệu |
| Migration hỏng | `npm run db:migrate:down -- --to=<version>` | < 2 phút | Cột thêm mới |
| Seed tri thức sai | `npm run db:seed:knowledge -- --reset` | < 1 phút | Citation lịch sử (§5) |
| Agent trả lời tệ giữa demo | `KILL_SWITCH_AGENTS=1` | < 30 giây | R6 |
| **Hết hạn mức Gemini (429 hàng loạt)** | `KILL_SWITCH_AGENTS=1` | < 30 giây | R6 |
| **Gemini trả 503 *"high demand"* hàng loạt** | `KILL_SWITCH_AGENTS=1` | < 30 giây | R6 |
| **Hạn mức embedding căng, truy hồi chậm/rỗng** | Đổi `RETRIEVAL_MODE=hybrid` → `lexical` trên Vercel | < 30 giây | Điểm vector trong `S1`; **không** mất dữ liệu, **không** phải re-embed `[Đ18]` |
| **A2 trả lời quá yếu vì mất bậc Pro** | Nạp tiền Google Cloud ⇒ đổi **một chuỗi ID** trong `lib/adapters/model.ts` | < 5 phút *(sau khi cổng thanh toán mở)* | Không mất gì — xem `00-ARCHITECTURE.md` §10.1 |
| DB Neon sập | Không có đường lùi | — | **Rủi ro đã chấp nhận** — xem §8.1 |

**Đường lùi `hybrid → lexical` là đường lùi rẻ nhất trong bảng, và nó rẻ *vì* đã đo.**
Embedding ép đúng **384** chiều, khớp nguyên `vector(384)` — nên cột vector cũ vẫn dùng
được, không cần migration, không cần re-embed. Nếu ai đó lỡ đổi số chiều thì đường lùi
này **mất**, và đó là lý do `C-08` trong `01-CONTRACTS.md` §10 cấm việc đó.

### 8.1 — Rủi ro không có đường lùi, và quyết định về nó

Neon sập giữa buổi demo là sự cố **không có phương án dự phòng trong vòng này**.
Đã cân nhắc dựng bản sao SQLite cục bộ và **quyết định không làm**: nó nhân đôi tầng
truy cập dữ liệu, phá BB-07, và tốn khoảng một ngày công cho một xác suất thấp.

Giảm thiểu thay thế, rẻ hơn nhiều: **quay sẵn một video 3 phút diễn trọn kịch bản
demo** và mang theo. Đây là việc của gói P06.

---

## 9. Hạn mức Gemini API — ràng buộc thật sự của dự án này `[Đ19]`

**Ràng buộc ở đây KHÔNG phải tiền, mà là HẠN MỨC.** Khoá đang dùng nằm ở bậc miễn phí:
mọi bậc Pro đều trả **429 *"exceeded your current quota, check your plan and billing"***
(`00-ARCHITECTURE.md` §10.1). Không có hoá đơn để tính, nên **§9 này không có bảng giá**
— bảng giá Claude cũ đã **bị bỏ**, không thay bằng bảng giá Gemini, vì **lượt probe
không đo giá** và SPEC này cấm chép số không tự đo.

### 9.1 — Số ĐO ĐƯỢC (có lệnh, có output)

Nguồn: [`../evidence/p02-provider/gemini-probe.txt`](../evidence/p02-provider/gemini-probe.txt) §2.

| Lệnh đã chạy | Kết quả nguyên văn |
| :-- | :-- |
| `node ratelimit.mjs gemini-3.5-flash-lite 15` | 15 song song / 2543ms · **thành công 15/15** · latency min 1601 / p50 2043 / max 2459 ms |
| `node ratelimit.mjs gemini-3.5-flash-lite 40` *(chạy ngay sau lượt trên)* | **thành công 1/40**, 39 lỗi **HTTP 429** |
| `node ratelimit.mjs gemini-3.6-flash 20` | **thành công 4/20**, phần trượt lẫn **cả 429 lẫn 503** |

**Kết luận đo được:** trần nằm **giữa 15 và 40 lời gọi/phút**, và lượt sau **bị trừ bởi
hạn mức lượt trước vừa tiêu**. Đây là con số duy nhất trong §9 này được phép coi là chắc.

### 9.2 — Số ƯỚC LƯỢNG (suy ra từ §9.1, **chưa đo trực tiếp**)

Đánh dấu rõ để không ai tưởng là số đo.

| Hạng mục | Ước lượng | Suy ra từ đâu |
| :-- | :-- | :-- |
| Lời gọi **sinh chữ** / lượt Golden đầy đủ | **198** = 66 case × 3 agent | Đếm, chắc chắn `[Đ19]` |
| Lời gọi **embedding** / lượt Golden đầy đủ | **66** (chỉ khi `RETRIEVAL_MODE=hybrid`) | Mỗi case 1 query embedding (`01-CONTRACTS.md` §4.1) |
| **Tổng lời gọi HTTP / lượt Golden đầy đủ** | **264** | 198 + 66 |
| Thời lượng một lượt Golden đầy đủ | **13–15 phút** | Ước lượng ở Đ19, với song song 3–5 |
| Lời gọi / lượt `--set=safety` (16 case) | 48 sinh chữ + 16 embedding = **64** | Cùng cách tính |
| **Lời gọi embedding / lần seed tri thức đầy đủ** | **≥ 97** (một chunk một lời gọi) | `chunks >= 97` ở §4 bước 7. **Đây là lần va hạn mức nặng nhất của cả dự án** — xem §5 |
| Lời gọi embedding / lần seed **chạy lại** | Chỉ phần còn thiếu | Nhờ file đệm ở Pha A (§5) |

### 9.3 — Luật chạy BẮT BUỘC

1. **Song song 3–5, mặc định 4** (`GOLDEN_CONCURRENCY`, §3). Chặn cứng trong mã: ngoài
   khoảng thì **exit 1**, không tự kẹp về biên im lặng. Chi tiết `SPEC-P04` §5.
2. **Backoff cho cả 429 lẫn 503**, có jitter (`01-CONTRACTS.md` §9).
3. Chạy Golden đầy đủ **1–2 lần/ngày**, không chạy mỗi lần sửa code. Sửa nhỏ thì
   `--set=safety`.
4. **CẤM chạy hai lượt Golden liên tiếp mà không nghỉ.** Đo được: lượt 40 trượt 39/40
   **một phần vì** lượt 15 ngay trước đó đã tiêu hạn mức. Nghỉ **≥ 60 giây** giữa hai lượt.

> **Bối cảnh vận hành, đọc kỹ:** lượt phóng trước của dự án này **chết vì hết hạn mức
> model** — và lượt viết SPEC này cũng suýt chết vì đúng lý do đó. Nay đã có số đo thật
> thay cho lời cảnh báo suông. Hạn mức ở đây là **ràng buộc thiết kế**, không phải chi
> tiết vận hành để tính sau.

### 9.4 — Đo token thật, sau khi P02 chạy được

Token thật nằm trong `pipeline_steps`, ghi từ `usageMetadata` (**không** phải
`response.usage` như nhà cung cấp cũ — xem `01-CONTRACTS.md` §8.0.2):

```bash
node scripts/sql.mjs "select s->>'model' m, count(*) n, sum((s->>'input_tokens')::int) tin, sum((s->>'output_tokens')::int) tout from answer_turns a, jsonb_array_elements(a.pipeline_steps) s where s ? 'model' group by 1 order by 1"
```

PASS khi in **đúng 3 dòng**, mỗi model một dòng, mọi số > 0. Ghi kết quả vào `plan.md`
§2 kèm mốc thời gian lấy bằng lệnh `date`, thay cho các ước lượng ở §9.2.

---

## 10. Bảng phân loại lỗi vận hành

| Triệu chứng | Nguyên nhân gần nhất | Hành vi BẮT BUỘC |
| :-- | :-- | :-- |
| Vercel build fail `Module not found` | Import file chỉ có trên máy dev | Sửa import. **CẤM** thêm `ignoreBuildErrors` |
| `relation "chunks" does not exist` | Chưa chạy bước 4 | Chạy migration. **CẤM** tạo bảng bằng tay |
| `type "vector" does not exist` | Chưa chạy bước 3 | Bật extension |
| Retrieval rỗng/chậm trên Vercel, ổn ở local | `GEMINI_API_KEY` thiếu trên Vercel ⇒ query embedding hỏng | Đặt biến trên Vercel. Đường lùi tức thì: `RETRIEVAL_MODE=lexical` (§3) |
| `401` / `403` từ Gemini API | Khoá sai hoặc hết hạn | Thay khoá. **CẤM** hardcode khoá để "thử nhanh". **CẤM** in khoá ra để so |
| `429` từ Gemini API | Hết hạn mức — bắn quá dày | Giảm `GOLDEN_CONCURRENCY` về **3**, nghỉ ≥60s rồi chạy lại (§9.3) |
| **`503` *"high demand"* từ Gemini API** | Quá tải phía nhà cung cấp, **không** phải lỗi của ta | Để backoff xử (`01-CONTRACTS.md` §9). Dày đặc ⇒ bật `KILL_SWITCH_AGENTS=1` (§7) |
| **`503` ở lời gọi ĐƠN LẺ, lặp lại** | Đang dùng model bị cấm | Kiểm ID model. `gemini-3.7-flash` / `gemini-3.8-flash` bị **cấm** (`C-09`) đúng vì triệu chứng này |
| **`404 "no longer available to new users"`** | Đang dùng ID model đã ngừng cấp | Dùng đúng 3 ID ở `00-ARCHITECTURE.md` §10.1. **CẤM** tự đoán ID thay thế |
| **`ContractDriftError` ở mọi lượt, không lượt nào qua** | Đang đọc `response.parsed_output` — trường của SDK cũ, luôn `undefined` | Đọc JSON từ **text** của candidate (`01-CONTRACTS.md` §8.0.2, `C-12`) |
| **`finishReason: MAX_TOKENS`, JSON cụt** | `maxOutputTokens` quá chặt — token suy nghĩ tính vào chung ngân sách đó | Nâng `maxOutputTokens`. **CẤM** vá JSON cụt bằng regex |
| **`cosine_sim` xếp hạng vô lý mà không có lỗi nào** | Trộn hai không gian vector: lệch model / lệch `outputDimensionality` / quên chuẩn hoá L2 | Re-embed toàn corpus bằng đúng một cấu hình (`01-CONTRACTS.md` §4.3) |
| Câu trả lời không đổi sau khi BQL đổi tài liệu | Có cache | Gỡ cache (P02-C8). Đây là hỏng R7 |
| Dashboard hiện `NaN%` | Chia cho 0 | `NULLIF` (P04-C4) |
| `DEMO_CLOCK_ISO` còn trên Vercel | Quên gỡ | Gỡ ngay. Đồng hồ giả trên production làm sai mọi số latency |

---

## 11. Runbook ngày demo

Làm theo thứ tự, trước buổi trình bày **60 phút**:

1. `git status` — cây làm việc sạch.
2. `vercel --prod` — deploy bản cuối. Đợi xanh.
3. Mở URL bằng **máy khác / mạng khác** (4G điện thoại). Không mở bằng máy dev.
4. Đăng nhập cả hai tài khoản. Kiểm hai giao diện khác nhau (R2).
5. Chạy 6 câu hỏi `00-ARCHITECTURE.md` §7 (D1–D6). Đủ 6 kết quả đúng kỳ vọng.
6. Mở `/bql/eval` — có số, không rỗng (R9).
7. Mở `/bql/dashboard` — có số, không `NaN` (R10).
8. Chạy kịch bản R7 (`SPEC-P03` §2.5): hỏi → đổi `Expired` → hỏi lại → đổi lại.
9. **Thử công tắc ngắt:** bật `KILL_SWITCH_AGENTS=1`, hỏi một câu, tắt lại (G13).
10. Kiểm video dự phòng §8.1 mở được.

Bất kỳ bước nào đỏ ⇒ **dừng, sửa, chạy lại từ bước 1**. Không mang rủi ro đã biết vào
phòng thi.

---

## 12. Vùng cấm vận hành

| # | CẤM | Lý do |
| :-- | :-- | :-- |
| OP-C1 | CẤM `git push` / deploy production khi chưa được người yêu cầu | Luật §5.L.3 của `AGENTS.md` |
| OP-C2 | CẤM đặt `DEMO_CLOCK_ISO` trên Vercel | Sai mọi số latency và `intake_window` |
| OP-C3 | CẤM dùng kill switch để vượt Exit Gate | §7 |
| OP-C4 | CẤM `ignoreBuildErrors` / `ignoreDuringBuilds` trong `next.config` | Giấu lỗi tới đúng lúc demo |
| OP-C5 | CẤM chạy Golden với song song **ngoài khoảng 3–5** | Trên 5 thì dính `429` hàng loạt (đo: 40 song song trượt 39/40); dưới 3 thì một lượt kéo quá dài `[Đ19]`. Ngoài khoảng ⇒ **exit 1** |
| OP-C6 | CẤM commit `.env.local` hoặc in `GEMINI_API_KEY` ra log | §3 |
| OP-C7 | CẤM dựng bản sao SQLite/local DB | §8.1 — phá BB-07, tốn 1 ngày công |
| ~~OP-C8~~ | ~~CẤM đổi `RETRIEVAL_MODE` trên Vercel sang `hybrid`~~ | **ĐÃ GỠ 2026-09-20 `[Đ18]`.** Căn cứ cũ là *"không có embedding trên Vercel"*. Căn cứ đó **mất** khi embedding trở thành một lời gọi HTTP trả đúng **384** chiều. `hybrid` nay là **mặc định cho cả hai môi trường** (§3). Giữ số hiệu `OP-C8` **không tái sử dụng** cho luật khác, để tham chiếu cũ không trỏ nhầm sang nghĩa mới |
| OP-C9 | CẤM tạo tài khoản thứ ba | NG-09 |
| OP-C10 | CẤM chạy `--reset` giữa buổi demo | §5 |
| OP-C11 | CẤM dùng `gemini-3.7-flash` / `gemini-3.8-flash` | Trả **503 ngay ở lời gọi đơn lẻ** (`C-09`, `00-ARCHITECTURE.md` §10.1) |
| OP-C12 | CẤM gọi API Gemini chỉ để "thử cho biết" ngoài lúc chạy gate | Hạn mức là tài nguyên chung và đang khan (§9). Mọi lượt đo phải có mục đích và phải ghi `evidence/` |
| OP-C13 | CẤM chép giá trị `GEMINI_API_KEY` vào bất kỳ file nào trong repo — kể cả file bằng chứng, kể cả rút gọn | §3. Bằng chứng ghi **kết quả**, không ghi khoá |
| OP-C14 | CẤM để `KILL_SWITCH_AGENTS=1` mà vẫn chạy truy hồi `hybrid` | §7 — phao sẽ chìm cùng con tàu vì embedding gọi đúng nhà cung cấp đang hỏng |

---

## 13. Số đo nghiệm thu của file này

| # | Lệnh | Kết quả PASS |
| :-- | :-- | :-- |
| OP-M1 | `node scripts/sql.mjs "select 1"` | In `1`; exit 0 |
| OP-M2 | `node scripts/sql.mjs "select extname from pg_extension order by 1"` | Có `unaccent` và `vector` |
| OP-M3 | `node scripts/check_env.mjs` | `required: 6/6 present`; exit 0. Danh sách 6 biến bắt buộc theo §3 — **`GEMINI_API_KEY`, không còn `ANTHROPIC_API_KEY`** |
| OP-M4 | `git check-ignore .env.local` | In `.env.local`; exit 0 |
| OP-M5 | `npm run build` | exit 0, **0** warning kiểu `ignoreBuildErrors` |
| OP-M6 | `curl -s -o /dev/null -w "%{http_code}" https://<app>.vercel.app` | `200` |
| OP-M7 | `npm run db:seed:knowledge && npm run db:seed:knowledge` (hai lần liên tiếp) | Lần hai exit 0, số dòng **không đổi** (idempotent, §5) |
| OP-M8 | Bật `KILL_SWITCH_AGENTS=1` **với `RETRIEVAL_MODE=hybrid` đang đặt**, hỏi 1 câu | Có câu trả lời **kèm citation**; `pipeline_steps` có `note: "kill_switch_agents"`; **0** lời gọi ra `generativelanguage.googleapis.com` — **kể cả embedding**. Đây là phép đo chứng minh phao không thủng (§7) |
| OP-M9 | `node scripts/sql.mjs "<truy vấn token ở §9.4>"` | **3** dòng, mỗi model một dòng, mọi số > 0 |
| OP-M10 | `grep -rn "ANTHROPIC\|@anthropic-ai/sdk\|claude-" app/ lib/ scripts/ tests/ package.json` | **rỗng**; exit 1 của `grep`. Còn dòng nào ⇒ rác của lượt trước, xoá (§3) |
| OP-M11 | `node scripts/check_env.mjs --reject-out-of-range GOLDEN_CONCURRENCY=9` | exit **1**, in lý do. Chứng minh chặn cứng 3–5 của `OP-C5` là thật, không phải lời khuyên |

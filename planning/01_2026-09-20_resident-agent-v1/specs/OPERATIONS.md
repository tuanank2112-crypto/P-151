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
| `ANTHROPIC_API_KEY` | ✅ | Vercel + `.env.local` | Chỉ đọc ở `lib/adapters/anthropic.ts` (BB-07) |
| `SESSION_SECRET` | ✅ | Vercel + `.env.local` | ≥ 32 byte ngẫu nhiên, ký cookie HMAC |
| `RETRIEVAL_MODE` | ✅ | Vercel = `lexical`; local = `hybrid` | `01-CONTRACTS.md` §4.1 |
| `SEED_RESIDENT_PASSWORD` | ✅ | chỉ khi seed | Mật khẩu demo |
| `SEED_BQL_PASSWORD` | ✅ | chỉ khi seed | Mật khẩu demo |
| `KILL_SWITCH_AGENTS` | ❌ | Vercel | `1` ⇒ bật chế độ dự phòng, xem §7 |
| `DEMO_CLOCK_ISO` | ❌ | chỉ local | Ghi đè `now()` cho kịch bản 23:39 (`SPEC-P05` §9). **CẤM đặt trên Vercel** |

**CẤM** commit `.env.local`. **CẤM** in `ANTHROPIC_API_KEY` ra log, kể cả một phần.
Kiểm: `git check-ignore .env.local` phải in `.env.local`.

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
| 7 | Seed tri thức | `npm run db:seed:knowledge` | `documents=19`, `sections>=97`, `chunks>=97` |
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

**Cảnh báo:** `--reset` xoá `chunks` kéo theo mọi citation lịch sử trỏ vào section đã
mất. Trước buổi demo thì chạy `--reset` một lần rồi thôi, đừng chạy giữa buổi.

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

**Đây là phao cứu sinh cho buổi demo.** Claude API sập hoặc hết hạn mức giữa buổi thì
bật công tắc: sản phẩm vẫn trả lời có trích dẫn (R3), vẫn lưu lịch sử (R4), vẫn
escalate đúng (R5). Chỉ mất R6 (3 agent) — và giám khảo đã xem trang trace trước đó.

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
| Hết hạn mức Claude | `KILL_SWITCH_AGENTS=1` | < 30 giây | R6 |
| DB Neon sập | Không có đường lùi | — | **Rủi ro đã chấp nhận** — xem §8.1 |

### 8.1 — Rủi ro không có đường lùi, và quyết định về nó

Neon sập giữa buổi demo là sự cố **không có phương án dự phòng trong vòng này**.
Đã cân nhắc dựng bản sao SQLite cục bộ và **quyết định không làm**: nó nhân đôi tầng
truy cập dữ liệu, phá BB-07, và tốn khoảng một ngày công cho một xác suất thấp.

Giảm thiểu thay thế, rẻ hơn nhiều: **quay sẵn một video 3 phút diễn trọn kịch bản
demo** và mang theo. Đây là việc của gói P06.

---

## 9. Chi phí Claude API

Giá lấy từ skill `claude-api`, bảng *Current Models* (cached 2026-06-24).
Số token là **GIẢ ĐỊNH, chưa đo thật** — đánh dấu rõ để không ai tưởng là số đo.

Lệnh đã chạy: `node cost.mjs`, exit 0. Output nguyên văn:

```text
model | in_tok/luot | out_tok/luot | USD/luot | USD/66-case
claude-haiku-4-5 | 1500 | 300 | 0.003000 | 0.1980
claude-opus-5 | 4000 | 600 | 0.035000 | 2.3100
claude-sonnet-5 | 3000 | 800 | 0.014000 | 0.9240
TONG | — | — | 0.052000 | 3.4320
Chay 10 lan Golden trong ca dot: 34.32 USD
```

**Đo số thật bằng lệnh này**, sau khi P02 chạy được (token thật nằm trong
`pipeline_steps`, ghi từ `response.usage`):

```bash
node scripts/sql.mjs "select s->>'model' m, sum((s->>'input_tokens')::int) tin, sum((s->>'output_tokens')::int) tout from answer_turns a, jsonb_array_elements(a.pipeline_steps) s where s ? 'model' group by 1"
```

Ghi số đo được vào `plan.md` §2 kèm mốc thời gian, thay cho giả định ở trên.

> **Bối cảnh vận hành:** lượt phóng trước của dự án này chết vì **hết hạn mức model**.
> Vì vậy: chạy Golden đầy đủ **1–2 lần/ngày**, không chạy mỗi lần sửa code. Sửa nhỏ
> thì chạy `--set=safety` (16 case, rẻ hơn ~4 lần).

---

## 10. Bảng phân loại lỗi vận hành

| Triệu chứng | Nguyên nhân gần nhất | Hành vi BẮT BUỘC |
| :-- | :-- | :-- |
| Vercel build fail `Module not found` | Import file chỉ có trên máy dev | Sửa import. **CẤM** thêm `ignoreBuildErrors` |
| `relation "chunks" does not exist` | Chưa chạy bước 4 | Chạy migration. **CẤM** tạo bảng bằng tay |
| `type "vector" does not exist` | Chưa chạy bước 3 | Bật extension |
| Retrieval luôn rỗng trên Vercel, ổn ở local | `RETRIEVAL_MODE=hybrid` mà không có embedding | Đặt `lexical` trên Vercel (§3) |
| `401` từ Claude API | Key sai/hết hạn | Thay key. **CẤM** hardcode key để "thử nhanh" |
| `429` từ Claude API | Chạy Golden song song | Chạy tuần tự (`SPEC-P04` §5 điều 3) |
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
| OP-C5 | CẤM chạy Golden song song | `429`, và số latency vô nghĩa |
| OP-C6 | CẤM commit `.env.local` hoặc in API key ra log | §3 |
| OP-C7 | CẤM dựng bản sao SQLite/local DB | §8.1 — phá BB-07, tốn 1 ngày công |
| OP-C8 | CẤM đổi `RETRIEVAL_MODE` trên Vercel sang `hybrid` | Không có embedding trên đó ⇒ retrieval rỗng |
| OP-C9 | CẤM tạo tài khoản thứ ba | NG-09 |
| OP-C10 | CẤM chạy `--reset` giữa buổi demo | §5 |

---

## 13. Số đo nghiệm thu của file này

| # | Lệnh | Kết quả PASS |
| :-- | :-- | :-- |
| OP-M1 | `node scripts/sql.mjs "select 1"` | In `1`; exit 0 |
| OP-M2 | `node scripts/sql.mjs "select extname from pg_extension order by 1"` | Có `unaccent` và `vector` |
| OP-M3 | `node scripts/check_env.mjs` | `required: 6/6 present`; exit 0 |
| OP-M4 | `git check-ignore .env.local` | In `.env.local`; exit 0 |
| OP-M5 | `npm run build` | exit 0, **0** warning kiểu `ignoreBuildErrors` |
| OP-M6 | `curl -s -o /dev/null -w "%{http_code}" https://<app>.vercel.app` | `200` |
| OP-M7 | `npm run db:seed:knowledge && npm run db:seed:knowledge` (hai lần liên tiếp) | Lần hai exit 0, số dòng **không đổi** (idempotent, §5) |
| OP-M8 | Bật `KILL_SWITCH_AGENTS=1`, hỏi 1 câu | Có câu trả lời **kèm citation**; `pipeline_steps` có `note: "kill_switch_agents"`; **0** lời gọi model |
| OP-M9 | `node scripts/sql.mjs "<truy vấn token ở §9>"` | 3 dòng, mỗi model một dòng, số > 0 |

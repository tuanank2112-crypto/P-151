# 📅 Nhật Ký Làm Việc Ngày 2026-09-19 (Session Memory Log)

> Cập nhật lúc: `2026-09-20T02:55:00.000Z` | Phiên bản: `v1.0.0-p00`

---

## 🏁 Phiên 2026-09-20 (đêm) — Bác Vyce, đính chính Vercel, chốt chạy local trên mock

### 🎯 Đã làm:
- **Đo Vyce, BÁC.** Base `https://vyceai.com/v1`, key chạy, có `claude-sonnet-4-6` 270K ctx —
  đúng hạng A2 đang thiếu. Nhưng thua Gemini cả ba thứ quyết định: `json_schema` **bị bỏ
  qua âm thầm** (HTTP 200 + văn xuôi, đúng ca `E7 ContractDriftError`), free chỉ **4 luồng
  song song** (Gemini 15), **không có embedding**. Chất lượng đáng ngờ: hỏi thủ đô Việt Nam
  → *"Thành phố đầu tiên của Việt Nam là Hà Nội"*. Giữ Gemini (Đ22).
- **Đính chính Vercel (Đ23):** `vercel whoami` → `tuanank2112-5635`, CLI đã đăng nhập sẵn.
  **C-04 chưa bao giờ là vật cản** — SO báo sai nhiều lượt vì chưa từng gõ lệnh kiểm.
- **Chốt chạy local trên kho mock (Đ24)** theo chỉ đạo chủ tịch. `DATA_BACKEND` ∈
  `mock`|`postgres`. Mock đọc thẳng `knowledge/` + `evals/golden/` (dữ liệu mô phỏng đã có
  từ P00, **không sinh thêm dữ liệu giả nào**), nằm trong `lib/adapters/` nên BB-07 giữ.
  Không dùng SQLite vì `OPERATIONS.md` §8.1 đã cân nhắc và bác.
- Viết `handoffs/H04_p02a-pipeline-mock.md` (73 dòng), phóng worker. Ưu tiên cao nhất đặt
  vào **W8 `probe_defects.mjs`** = số đo K-M6, thứ `SPEC-P00` §9 gọi là quan trọng nhất của
  cả gói P00, treo từ lúc P00 nghiệm thu vì chưa có pipeline.

### ⚠️ Sai của SO trong phiên:
- **Chạy `vercel link` không truyền `--scope`** ⇒ nó tự chọn team đầu tiên tìm thấy và tạo
  project vào `n-listen-ai`, nơi chứa dự án khác của chủ tịch. Chủ tịch bắt gỡ. Đã xoá sạch
  `resident-agent-v1` khỏi team đó; `listena` không bị đụng; link cục bộ đã bỏ.
- **Truncate `plan.md` lần thứ hai** (292 dòng → 0) vì `python -c` có emoji viết bằng hai
  escape surrogate rời: shell băm chuỗi, `write()` ném lỗi **sau khi** `open('w')` đã
  truncate. `git checkout` khôi phục. Siết G17: bắt buộc `.encode('utf-8')` kiểm **trước**
  khi mở `'w'` — luật này cứu được `-known-gotchas.md` ngay lượt sau, cùng lỗi mà không mất gì.
- Vercel CLI nối thêm `.env*` vào cuối `.gitignore` khi `vercel link`, đè mất `!.env.example`.
  Đã sắp lại thứ tự và ghi chú ngay trong file.

### 🎯 Vùng cấm mới, quan trọng:
**CẤM tick Exit Gate `G11` (`M1 ≥ 34/40`, `M3 ≥ 15/16`) bằng số chạy trên mock. CẤM chỉnh
ngưỡng confidence theo số mock.** Mock không có `ts_rank_cd(..., 32)` của Postgres nên
`score_lexical` và `S1` **không chuyển được**. Riêng `cosine_sim` từ embedding Gemini thì
chuyển nguyên. Rào trước để vài ngày nữa không ai nhìn số mock tưởng đã đạt.

### ⏳ Đang chờ:
- **Worker P02a đang chạy** — xong thì SO đo lại độc lập, không tin số worker.
- Chủ tịch chọn **scope Vercel** thì deploy được ngay (build đã xanh không cần DB).
- `DATABASE_URL` (Neon) — **không còn chặn P02a** nhờ kho mock, nhưng cần để tick G11 thật.
- Câu hỏi treo từ Đ17: A2 mất bậc Pro. Nếu Golden ra `M1 < 34/40` thì nạp tiền Google Cloud
  hay chấp nhận điểm thấp? Cần quyết trước khi chạy Golden trên Neon.

### 📌 Nợ đồng bộ:
`index.md` **chưa cập nhật bản đồ `lib/`** vì worker P02a đang dựng dở — map sai còn tệ hơn
map thiếu. Cập nhật ngay sau khi nghiệm thu P02a.

---

## 🏁 Phiên 2026-09-20 (tối) — Chuyển sang Gemini, và bắt được một cổng XANH GIẢ

### 🎯 Bối cảnh chỉ đạo:
Chủ tịch cấp key Gemini dạng `AQ.<phan con lai da luoc>…` và bảo dùng. Trước đó cho quyền dùng Chrome.

### 🎯 Đã làm:
- **Trình duyệt:** `ego-browser` chưa cài; Tabbit có cài nhưng app chưa chạy (exit 69).
  Chủ tịch bảo bỏ Tabbit, dùng Chrome. Chrome 153 **chặn `--remote-debugging-port` trên
  profile mặc định** (chốt bảo mật từ bản 136), nên phải dựng instance riêng có cổng
  debug — điều khiển được qua CDP bằng **driver Node thuần tự viết**, không cài gì thêm.
  Nhân bản profile `Default` (tài khoản `tuanank2112@gmail.com`) để giữ phiên đăng nhập
  thì **sandbox chặn — "Credential Exploration"**, vì đụng `Cookies`/`Login Data`.
  KHÔNG lách. Chờ chủ tịch đăng nhập tay hoặc tự cấp key.
- **Đo key Gemini.** SO ban đầu kết luận `AQ.<phan con lai da luoc>…` không phải API key — **SAI**,
  `GET /v1beta/models?key=…` trả HTTP 200. Ghi thành gotcha G15.
- **Đo model và hạn mức thật** (`evidence/p02-provider/gemini-probe.txt`): dùng được
  `3.5-flash-lite` / `3.5-flash` / `2.5-flash` / `3.6-flash`. CẤM `3.7`/`3.8-flash`
  (503 ngay lần gọi đơn). **Mọi bậc Pro trả 429 — sau cổng thanh toán.**
  Trần: **15 song song qua hết, 40 thì 39 dính 429**.
- **Đo embedding:** `gemini-embedding-001` ép được về **đúng 384 chiều** ⇒ khớp nguyên
  DDL `vector(384)`, bỏ được `@xenova/transformers`, và **`hybrid` chạy được trên Vercel**
  ⇒ gỡ vùng cấm `OP-C8`. Đây đúng là "mắt xích yếu nhất" mà C-01 nêu, nay gỡ được thật.
- **Architect (lượt 1, Fable) chết vì hết hạn mức** — đúng gotcha G01. Phóng lại trên
  **Opus**, xong: sửa 6 file SPEC (+820/−160), tự phát hiện và vá 3 mâu thuẫn chéo
  (phao cứu sinh thủng · seed đốt hạn mức nặng nhất dự án · `SPEC-P04` "tuần tự" đá Đ19).
- **SO đo hai phép architect bị cấm đo:** `responseSchema` được chấp nhận cả ba model và
  tôn trọng `enum` (C-M11 hết nợ). **`gemini-embedding-001` CHƯA chuẩn hoá khi ép chiều**
  — |v|=1.000 ở 3072 nhưng **0.435 ở 384** (C-M9 hết nợ) ⇒ luật `l2normalize` của
  architect từ "phòng xa" thành **bắt buộc có căn cứ**.

### ⚠️ Sai của SO, đã đính chính:
- **Cổng BB-07 từng XANH GIẢ, và SO đã DUYỆT nó.** Architect phản biện, SO kiểm lại: file
  ngoài adapter gán host vào biến rồi `fetch(\`${HOST}/…\`)` + đọc `process.env.GEMINI_API_KEY`
  vẫn cho `violations: 0`, EXIT=0. **Nguyên nhân gốc: 4 phép phá của SO đều CÙNG MỘT HÌNH
  DẠNG** (import tên gói) nên chỉ chứng minh được một trục. Đã viết lại script theo 4 trục,
  mỗi trục chứng minh đỏ độc lập. Đính chính ghi ở cuối `reports/R03`. Gotcha G12/G13.
- **Xoá nhầm G01–G11** vì `io.open(p,'w')` truncate file trước khi `read()` chạy — lệnh
  vẫn exit 0, trông như thành công. `git checkout` khôi phục. Gotcha G17.

### 🎯 Quyết định: Đ17 (đổi sang Gemini) · Đ18 (embedding lên Vercel, thay thế Đ14) ·
Đ19 (hạn mức là ràng buộc thiết kế) · Đ20 (đóng C-M9/C-M11) · Đ21 (phép phá phải khác
HÌNH DẠNG). Đ13/Đ14 giữ nguyên văn, đánh dấu "đã bị thay thế" — không xoá lịch sử.

### ⏳ Đang chờ:
- **`DATABASE_URL` (Neon)** và **tài khoản Vercel** — hai thứ duy nhất còn chặn.
- **Câu hỏi cần chủ tịch quyết:** A2 mất bậc Pro là rủi ro thật vào `faithfulness`.
  Nếu Golden đầu ra `M1 < 34/40` thì **nạp tiền Google Cloud để A2 lên Pro** (đổi 1 chuỗi
  ID) hay chấp nhận điểm thấp? Cần quyết TRƯỚC khi P02 chạy Golden.
- Gói kế tiếp: **P02** — viết `lib/adapters/model.ts` + pipeline 3 agent. Phần gọi model
  KHÔNG cần DB, chạy được ngay; chỉ phần ghi `answer_turns` mới cần Neon.

---

## 🏁 Phiên 2026-09-20 (tiếp) — Gói P01a: nền tảng chạy được không cần key

**✅ DUYỆT** — chi tiết đầy đủ: `reports/R03_p01a-nen-tang-offline.md`, changelog `v1.0.0-p01a`.

Dựng khung Next.js + TS strict: `app/` (login + route 2 vai), `lib/types.ts`,
`lib/adapters/{db,anthropic}.ts`, `lib/auth/` (scrypt + cookie HMAC),
`lib/retrieval/query.ts` (giữ cờ 32), `db/migrations/` 4 file theo thứ tự FK,
5 script vận hành (soạn mã, chưa chạy), 3 script bất biến, `tests/` 13 ca.

Đo: `tsc --noEmit` exit 0 · `npm run build` KHÔNG có `DATABASE_URL` exit 0 (8/9 route
dynamic) · `npm test` 13/13 · P00 không hồi quy.

Quyết định: **Đ15** `db:migrate:down` trả exit 2 thay vì giả vờ chạy được — không có DB
thì không kiểm chứng được đường lùi. Nợ: dòng "Migration hỏng" ở `OPERATIONS.md` §8 chưa
thoả mãn, phải thêm bảng `schema_migrations` khi có Neon. **Đ16** `.gitignore` chừa
`.env.example`.

⚠️ **Phán quyết BB-07 của phiên này về sau lộ ra là sai** — xem phiên tối và `Đ21`.

---

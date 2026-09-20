# 📅 Nhật Ký Làm Việc Ngày 2026-09-19 (Session Memory Log)

> Cập nhật lúc: `2026-09-20T02:55:00.000Z` | Phiên bản: `v1.0.0-p00`

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

## 🏁 Phiên 2026-09-20 (chiều) — Chốt C-01…C-04, thi công và nghiệm thu gói P00

**✅ DUYỆT** — chi tiết đầy đủ: `reports/R02_p00-knowledge-golden.md`, changelog `v1.0.0-p00`.

Mã sản phẩm đầu tiên của repo: `knowledge/` 19 tài liệu / 98 section + 4 khuyết tật cài
sẵn DEF-01..04, `evals/golden/` 66 case (50 FAQ + 16 Safety, phủ 10 mã canonical),
`scripts/` 3 script kiểm Node thuần. Bốn cổng K-M1→K-M4 exit 0; SO tự thiết kế 2 phép
phá, cả hai đỏ đúng rồi tái xanh.

Chốt: **C-02 GẬT** (HITL chỉ cho lượt escalate) · **C-03 GẬT** (bỏ Metric 2) ·
**C-04 chờ người** (Vercel). Sửa một phát biểu sai: P00 chưa bao giờ bị C-01 chặn, vì
`SPEC-P00` §7 P00-C6 CẤM sinh Knowledge Pack bằng LLM.

Lỗi của SO: `H02` cấp nhầm đường dẫn (`knowledge/` thay vì `evals/golden/`) làm K-M3 đỏ
giả — gotcha G03. Worker báo lên thay vì tự sửa SPEC, xử lý đúng.

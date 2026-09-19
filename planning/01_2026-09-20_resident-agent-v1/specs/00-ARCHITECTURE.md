# 00 — KIẾN TRÚC & BẤT BIẾN · Resident Agent v1.0

> **Trạng thái:** hợp đồng kiến trúc, khoá cho vòng `1.0.0`.
> **Nguồn chân lý cấp trên:** [`../plan.md`](../plan.md) §2 (nhật ký quyết định Đ01–Đ12).
> Khi file này và `docs/` mâu thuẫn → `plan.md` thắng, rồi tới file này, rồi mới tới `docs/`.
> **Người đọc mục tiêu:** worker không có lịch sử hội thoại.

---

## 1. Router thứ tự đọc (BẮT BUỘC theo đúng thứ tự)

| # | File | Đọc khi nào | Bỏ qua được không |
| :-- | :-- | :-- | :-- |
| 1 | `00-ARCHITECTURE.md` (file này) | Luôn luôn, trước mọi việc | ❌ Không |
| 2 | [`01-CONTRACTS.md`](01-CONTRACTS.md) | Trước khi viết bất kỳ type/DDL/API nào | ❌ Không |
| 3 | [`SPEC-P00-Knowledge-Golden.md`](SPEC-P00-Knowledge-Golden.md) | Làm gói P00 | ✅ Có, nếu không làm P00 |
| 4 | [`SPEC-P02-Agent-Pipeline.md`](SPEC-P02-Agent-Pipeline.md) | Làm gói P02 | ✅ |
| 5 | [`SPEC-P03-BQL-Console.md`](SPEC-P03-BQL-Console.md) | Làm gói P03 | ✅ |
| 6 | [`SPEC-P04-Eval-Dashboard.md`](SPEC-P04-Eval-Dashboard.md) | Làm gói P04 | ✅ |
| 7 | [`SPEC-P05-Action-Layer.md`](SPEC-P05-Action-Layer.md) | Làm gói P05 **sau khi cổng Đ03 mở** | ✅ |
| 8 | [`OPERATIONS.md`](OPERATIONS.md) | Trước lần deploy đầu tiên và mọi lần sau | ❌ Không |
| 9 | [`TESTING-ACCEPTANCE.md`](TESTING-ACCEPTANCE.md) | Trước khi báo "xong" bất kỳ gói nào | ❌ Không |

**P01 không có file SPEC riêng** — đây là quyết định, không phải thiếu sót. Hợp đồng
của P01 (schema, DDL, auth, ingest, adapter) nằm trọn trong `01-CONTRACTS.md` §3–§6 và
`OPERATIONS.md` §2–§4. Worker làm P01 đọc hai file đó.

---

## 2. Mục tiêu

Dựng **một web app demo mô phỏng toàn phần** — trợ lý AI cho cư dân khu đô thị — đủ
để một ban giám khảo bấm thử trong 10 phút và tick đủ 7 gạch đầu dòng của rubric
`C104 / VHR-01 / G104`.

Bảng dưới là **định nghĩa "xong"** ở cấp sản phẩm. Mỗi dòng phải chỉ ra được một
đường bấm trên UI đã deploy.

| # | Gạch rubric | Gói phụ trách | Bằng chứng khi demo |
| :-- | :-- | :-- | :-- |
| R1 | Web đã deploy | P01 | URL `https://<app>.vercel.app` mở được từ máy giám khảo |
| R2 | Đăng nhập 2 vai trò | P01 | Hai tài khoản seed, hai giao diện khác nhau |
| R3 | RAG trả lời có trích dẫn | P02 | Mỗi câu trả lời có chip `document_id · section_id`, bấm ra được đoạn gốc |
| R4 | Lưu lịch sử hội thoại | P02 | Đăng xuất, đăng nhập lại, hội thoại còn nguyên |
| R5 | Escalate khi confidence thấp | P02 | 4 câu hỏi mẫu ở §7 làm hệ thống từ chối với 4 lý do khác nhau |
| R6 | Multi-agent 3 con | P02 | Trang trace hiển thị 3 chặng riêng biệt, có latency và token từng chặng |
| R7 | BQL upload/cập nhật tài liệu | P03 | Đổi `status` một tài liệu → câu trả lời liên quan đổi hành vi trong cùng phiên demo |
| R8 | BQL duyệt câu trả lời (HITL) | P03 | Hàng đợi có Duyệt / Sửa / Từ chối |
| R9 | Bảng eval faithfulness & relevance | P04 | Trang `/bql/eval` có số, có nút chạy lại |
| R10 | Dashboard tỉ lệ tự động giải quyết | P04 | Trang `/bql/dashboard`, tách theo intent và theo reason code |

> R1–R10 là **tầng 1** (Đ01, Đ03). Gói P05 là **tầng 2** — giá trị khác biệt khi
> demo, **không** thuộc rubric, và là gói duy nhất được cắt khi trễ hạn.

---

## 3. Non-goals — KHÔNG làm trong vòng 1.0.0

Đây không phải danh sách "chưa kịp làm". Đây là danh sách **đã cân nhắc và quyết
định không làm**. Agent đời sau muốn lật phải sửa `plan.md` §2 trước, không tự quyết.

| # | Không làm | Vì sao | Neo |
| :-- | :-- | :-- | :-- |
| NG-01 | Gọi API thật của Vinhomes | Không có, không xin được trong 7 ngày, và không cần cho việc được chấm | Đ02 |
| NG-02 | Dùng dữ liệu cư dân thật | Sản phẩm demo; mọi dữ liệu là synthetic | Đ02 |
| NG-03 | Thanh toán / hoá đơn / công nợ | Rubric không có dòng nào về thanh toán; tiền thật là rủi ro không cần thiết | Đ01, `plan.md` §2 "Quyết định bị thay thế" mục 1–2 |
| NG-04 | Bộ lập lịch bền qua restart, ý định sống qua phiên | Hạ tầng khó, tiết kiệm ~1 ngày công, không được chấm | `plan.md` §2 "Quyết định bị thay thế" mục 3 |
| NG-05 | Hiển thị phần trăm confidence ra màn hình | Phần trăm chưa hiệu chuẩn là số giả; màn hình hiển thị **lý do** | Đ07 |
| NG-06 | Hệ thống chấm faithfulness độc lập với agent kiểm chứng | Một cơ chế hai công dụng; số trên dashboard phải khớp hành vi thật | Đ08 |
| NG-07 | Alias cho 10 reason code cũ | Alias sinh hai nguồn chân lý trên cùng một enum | Đ12 |
| NG-08 | Nhóm tiện ích VinWonders / đối tác | Khác pháp nhân vận hành, trắng nguồn tuyệt đối | `H02` (d.3), `H02` (e) |
| NG-09 | RBAC nhiều tầng, SSO, quên mật khẩu, đăng ký tài khoản | Hai vai trò seed sẵn là đủ cho R2 | Đ11 |
| NG-10 | Streaming token ra UI | Tốn thời gian, không được chấm; dùng trạng thái "đang xử lý" theo chặng | quyết định của file này, §9 |

---

## 4. Bất biến kiến trúc (BB)

Mỗi bất biến có **cách kiểm bằng máy**. Bất biến không kiểm được là khẩu hiệu, không
phải bất biến.

### BB-01 — Thao tác được ≠ được phép giải thích luật `[Đ09]` 🔴

Quyền gọi một lệnh ghi **không** kéo theo quyền phát biểu về nội quy. Mọi phát biểu
mang tính quy định (giờ giấc, điều kiện, hạn mức, phí, cấm/cho phép) **bắt buộc** đi
qua đường RAG có trích dẫn tới `document_id` + `section_id` hợp lệ.

Hệ quả cứng, không thương lượng:

- Tiện ích có `has_authoritative_rules = false` thì agent **bị chặn ở tầng dữ liệu**
  khỏi việc phát biểu về nội quy của nó — **kể cả khi backend mô phỏng cho phép đặt chỗ**.
- Kết quả trả về từ một lệnh hành động (P05) **không** được dùng làm evidence cho
  một phát biểu quy định. Ví dụ cấm: đặt chỗ thất bại lúc 23:39 → **cấm** kết luận
  "sân đóng cửa sau 17:30".
- Lý do: chống một kiểu hallucination khó bắt — suy từ một ràng buộc vận hành có thật
  ra một quy định không hề được nêu. Bằng chứng gốc: `H02` §c.1, bốn kiểu sai.

**Cách kiểm:** test `BB01` trong `TESTING-ACCEPTANCE.md` §4.1 — gọi pipeline với
`facility_id = FAC-PICKLEBALL-01` (có mục đặt chỗ, không có nguồn nội quy); kỳ vọng
`decision = escalate`, `reason_code = no_eligible_source`, và `citations = []`.

### BB-02 — Hai trục thời gian không được gộp `[H02 §c.1]`

`intake_window` (khi nào được **gửi** yêu cầu) và `operating_hours` (khi nào được
**dùng** tiện ích) là hai đại lượng độc lập, ràng buộc lên hai thời điểm khác nhau
(`t_submit` vs `t_slot`). **CẤM** suy một cái ra cái kia. **CẤM** gộp thành một
trường. Vi phạm sinh ra bốn kiểu sai đã liệt kê ở `H02` §c.1.

**Cách kiểm:** schema `booking_policy` ở `SPEC-P05-Action-Layer.md` §3 có hai nhóm
trường riêng; script `validate_policy.mjs` fail nếu thiếu một trong hai.

### BB-03 — Chính sách đọc được trước khi hành động `[Đ10]`

Mọi lệnh **ghi** phải có một lệnh **đọc-thuần, idempotent** tương ứng trả về đủ điều
kiện của lệnh ghi đó. Agent **CẤM** học luật bằng cách thử-và-hỏng: mỗi lần thử là
một tác dụng phụ thật.

**Cách kiểm:** mọi `capability_id` nhóm `write` trong `01-CONTRACTS.md` §7 phải có
trường `precheck_capability_id` khác `null`.

### BB-04 — Trích dẫn là bắt buộc, không phải trang trí

Một phản hồi có `decision = answer` mà `citations.length === 0` là **lỗi hệ thống**,
không phải câu trả lời kém. Pipeline phải chặn ở tầng code, không chỉ ở tầng prompt.

**Cách kiểm:** invariant runtime `assertCitedOrEscalate()` (`SPEC-P02` §6.4); test
`BB04` bơm một draft không citation và kỳ vọng ném `PipelineInvariantError`.

### BB-05 — Confidence không bao giờ ra màn hình `[Đ07]`

Số confidence sống trong DB và log. UI hiển thị **lý do** (`reason_code` → câu tiếng
Việt) và **trạng thái**, không hiển thị phần trăm, không hiển thị thanh tiến độ tin cậy.

**Cách kiểm:** `grep -rniE "confidence|độ tin cậy" app/ --include=*.tsx` không được
khớp dòng nào nằm trong JSX hiển thị. Lệnh chính xác ở `TESTING-ACCEPTANCE.md` §4.5.

### BB-06 — Agent kiểm chứng là một cơ chế, hai công dụng `[Đ08]`

Agent A3 (`verifier`) chạy **trong đường phục vụ trực tiếp**. Điểm faithfulness trên
bảng eval `P04` **phải đọc từ cùng cột DB** mà A3 ghi lúc chạy thật
(`answer_turns.faithfulness_score`). **CẤM** dựng một bộ chấm riêng.

**Cách kiểm:** `SPEC-P04` §3.1 — truy vấn dashboard không được chứa lời gọi model
nào; test `BB06` so số trên `/bql/eval` với `SELECT` trực tiếp, sai lệch phải bằng 0.

### BB-07 — Mọi lối ra ngoài đi qua adapter `[Đ11]`

Không file nào ngoài `lib/adapters/**` được `import` SDK của Anthropic, driver
Postgres, hay `fetch` tới host ngoài. Lý do: chi phí lật stack (Đ11) chỉ thấp khi
mọi lệnh đi qua một lớp.

**Cách kiểm:** `grep -rn "@anthropic-ai/sdk" app/ lib/ --include=*.ts | grep -v "^lib/adapters/"`
phải rỗng.

### BB-08 — Eligibility gate chạy trước sinh chữ, không sau

Thứ tự tất định, không có đường vòng:
`validate → safety/ownership → intent → required-context → risk → retrieval → eligibility → draft → verify`.
Kế thừa từ `UI_Flow_ResidentGPT_MVP.md` §D Must Have và §Final Validation mục 2.

**Cách kiểm:** log `pipeline_steps` của mọi lượt phải chứa đủ 9 chặng đúng thứ tự;
test `BB08` so mảng thứ tự.

### BB-09 — Enum reason code là đóng

15 mã ở `01-CONTRACTS.md` §2 là tập đóng. Cột DB dùng kiểu enum Postgres. Thêm mã =
migration + tăng revision + chạy lại regression (kế thừa `MVP_DATA_SCOPE_LOCK.md` §11).

**Cách kiểm:** `INSERT` một mã lạ phải bị Postgres từ chối; test `BB09`.

### BB-10 — Knowledge Pack là dữ liệu có phiên bản, không phải hằng số trong code

Không hardcode nội dung nội quy vào prompt hay vào `.ts`. Mọi tri thức nằm trong
bảng `documents` / `sections` / `chunks`, đọc lúc chạy. Đây là điều kiện để R7
(BQL đổi tài liệu → hành vi đổi ngay) có thể xảy ra.

**Cách kiểm:** `grep -rn "OCP1-" app/ lib/ --include=*.ts | grep -v "lib/knowledge/seed"`
chỉ được khớp trong test fixtures.

### BB-11 — Một câu hỏi ⇒ một `answer_turn`, kể cả khi từ chối

Từ chối cũng là một lượt có log đầy đủ. Không có đường nào thoát khỏi việc ghi log —
nếu không, mẫu số của R10 sai và dashboard nói dối.

**Cách kiểm:** `SELECT count(*) FROM answer_turns` sau khi chạy Golden phải đúng bằng
số case đã chạy. Lệnh ở `TESTING-ACCEPTANCE.md` §5.2.

### BB-12 — Cổng P05 `[Đ03]`

P01–P04 chưa xanh toàn bộ Exit Gate môi trường `local` thì **CẤM** chạm P05. Đây là
hàng rào chống trễ hạn, không phải gợi ý thứ tự.

**Cách kiểm:** `TESTING-ACCEPTANCE.md` §7 — bảng Exit Gate; P05 chỉ được mở khi
G01–G12 đều `✅ local`.

---

## 5. Sơ đồ tầng

```text
┌──────────────────────────── Next.js App Router (Vercel) ────────────────────────────┐
│  app/(resident)/chat            app/(bql)/documents  /review  /eval  /dashboard     │
│  ─ hiển thị LÝ DO, không hiển thị phần trăm (BB-05) ─                               │
└───────────────┬─────────────────────────────────────────────────┬───────────────────┘
                │ Server Actions / Route Handlers                 │
┌───────────────▼─────────────────────────────────────────────────▼───────────────────┐
│  lib/pipeline/   ← thứ tự tất định 9 chặng (BB-08)                                  │
│   ├ A1 classifier   (intent · required-context · ownership pre-screen)              │
│   ├ A2 retriever    (hybrid search → eligibility gate → draft có citation)          │
│   └ A3 verifier     (soi từng claim → faithfulness → cũng là số cho P04, BB-06)     │
│  lib/confidence.ts  ← hợp 4 tín hiệu, ngưỡng nội bộ (Đ07)                            │
└───────────────┬─────────────────────────────────────────────────┬───────────────────┘
                │                                                 │
┌───────────────▼──────────────┐                 ┌────────────────▼───────────────────┐
│ lib/adapters/anthropic.ts    │                 │ lib/adapters/db.ts                 │
│  ← file DUY NHẤT import SDK  │                 │  ← file DUY NHẤT mở connection     │
│    (BB-07)                   │                 │    (BB-07)                         │
└───────────────┬──────────────┘                 └────────────────┬───────────────────┘
                │                                                 │
        Claude API (Anthropic)                     Postgres + pgvector (Neon)
                                          documents · sections · chunks · conversations
                                          messages · answer_turns · review_queue
                                          bookings · receipts · audit_log
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ lib/simbackend/  ← BACKEND CƯ DÂN MÔ PHỎNG. Do TA định nghĩa (Đ02).                 │
│   KHÔNG phải API Vinhomes. Không gọi ra Internet. Chỉ P05 dùng.                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Ghi chú chống hiểu nhầm:** `lib/simbackend/` là mã ta tự viết, dữ liệu ta tự seed.
Mọi tên endpoint, tên trường, mã lỗi trong đó là **hợp đồng do ta định nghĩa cho
backend mô phỏng**, không phải mô tả hệ thống có thật của Vinhomes. Mọi file SPEC
nhắc tới nó đều phải lặp lại câu này (luật §4 của handoff).

---

## 6. Ranh giới ba vai

| Vai | Ai | Thấy gì | KHÔNG thấy gì |
| :-- | :-- | :-- | :-- |
| `resident` | Cư dân, tài khoản seed `resident@demo.local` | Chat của chính mình, lịch sử của chính mình, đặt chỗ của chính mình | Dữ liệu căn khác, hàng đợi duyệt, eval, dashboard |
| `bql` | Ban quản lý, tài khoản seed `bql@demo.local` | Quản lý tài liệu, hàng đợi duyệt, eval, dashboard | Nội dung chat riêng tư của cư dân **trừ** lượt đã escalate vào hàng đợi |
| `system` | Không đăng nhập được | — | — (chỉ là chủ thể ghi `audit_log`) |

Ranh giới này là nền của định nghĩa mới cho `pii_or_account_specific` (Đ06) — xem
`01-CONTRACTS.md` §2.2.

---

## 7. Bốn câu hỏi mẫu bắt buộc chạy được khi demo `[Đ05]`

Bốn câu này là **hợp đồng giữa P00 và P02**. P00 phải cài khuyết tật sao cho bốn câu
này kích hoạt đúng bốn nhánh; P02 phải xử lý đúng. Chi tiết tài liệu/mục nào ở
`SPEC-P00-Knowledge-Golden.md` §5.

| # | Câu hỏi (tiếng Việt, gõ nguyên văn) | Nhánh kích hoạt | `reason_code` kỳ vọng |
| :-- | :-- | :-- | :-- |
| D1 | `Sân pickleball mở cửa mấy giờ?` | Khoảng trống #1 | `no_eligible_source` |
| D2 | `Làm lại thẻ xe máy bị mất thì mất bao nhiêu tiền?` | Khoảng trống #2 | `no_eligible_source` |
| D3 | `Vườn BBQ cho tối đa bao nhiêu người một lượt?` | Cặp mâu thuẫn | `source_conflict` |
| D4 | `Bể bơi mở cửa từ mấy giờ đến mấy giờ?` | Tài liệu hết hiệu lực | `source_expired_or_unknown` |

Câu đối chứng bắt buộc xanh (chứng minh hệ thống không phải "cái máy từ chối"):

| # | Câu hỏi | Kỳ vọng |
| :-- | :-- | :-- |
| D5 | `Trẻ em dưới 12 tuổi có được vào bể bơi một mình không?` | `decision = answer`, ≥1 citation |
| D6 | `Văn phòng BQL làm việc mấy giờ?` | `decision = answer`, ≥1 citation |

---

## 8. Bảng phân loại lỗi cấp kiến trúc

Đây là lỗi **của hệ thống**, khác với `reason_code` (là kết quả nghiệp vụ hợp lệ của
một lượt). Phân biệt này quan trọng: `no_eligible_source` là **thành công** — hệ
thống từ chối đúng lúc. `PipelineInvariantError` là **hỏng**.

| Loại | Lớp lỗi | Khi nào | Hành vi BẮT BUỘC của caller | Có ghi `answer_turns`? |
| :-- | :-- | :-- | :-- | :-- |
| E1 | `PipelineInvariantError` | Vi phạm BB-04, BB-08, BB-11 | **Ném ra, không nuốt.** Trả HTTP 500. Ghi `audit_log` mức `error`. CẤM degrade thành câu trả lời | ✅ có, `decision = system_error` |
| E2 | `UpstreamModelError` | Claude API lỗi 429/5xx/timeout | Retry tối đa **2 lần**, backoff 1s→3s. Hết retry → `reason_code = system_error`, UI cho nút Thử lại | ✅ có |
| E3 | `RetrievalError` | pgvector lỗi, index chưa dựng | **Không** retry (lỗi cấu hình, retry vô ích). → `system_error` | ✅ có |
| E4 | `EligibilityRejected` | Không phải lỗi — gate làm đúng việc | Đi tiếp nhánh escalate với `reason_code` tương ứng | ✅ có |
| E5 | `AuthzError` | Vai không khớp route | HTTP 403, redirect về trang của vai đúng. CẤM trả nội dung một phần | ❌ không |
| E6 | `OwnershipViolation` | Truy vấn chạm dữ liệu chủ sở hữu khác (Đ06) | Chặn **trước** khi chạm DB. → `reason_code = pii_or_account_specific` | ✅ có |
| E7 | `ContractDriftError` | Response của model không parse được theo schema | Retry **1 lần** với cùng input. Vẫn hỏng → `system_error`. CẤM tự sửa JSON bằng regex | ✅ có |
| E8 | `SimBackendError` | Backend mô phỏng (P05) từ chối lệnh ghi | Ánh xạ sang nhóm mã hành động ở `01-CONTRACTS.md` §2.3. CẤM retry lệnh ghi không idempotency key | ✅ có |

**Luật chung cho mọi loại:** không có đường nào trả màn hình trắng. Kế thừa
`PRD_ResidentGPT_MVP.md` §6 NFR-02.

---

## 9. Vùng cấm kiến trúc — CẤM tường minh

Mỗi dòng là một cám dỗ có thật mà agent đời sau sẽ gặp. Đọc lý do trước khi lật.

| # | CẤM | Vì sao cấm |
| :-- | :-- | :-- |
| VC-01 | CẤM thêm agent thứ 4 vào pipeline | Rubric đòi **3**. Con thứ 4 tăng latency và chi phí, không tăng điểm |
| VC-02 | CẤM gộp A2 và A3 thành một lời gọi model | Gộp thì agent tự chấm chính bản nháp nó vừa viết trong cùng ngữ cảnh → faithfulness mất giá trị và BB-06 sụp |
| VC-03 | CẤM để A3 nhìn thấy câu hỏi gốc của cư dân | A3 chỉ soi `claim ⟷ evidence`. Thấy câu hỏi thì nó sẽ "thông cảm" cho claim không neo. Chi tiết `SPEC-P02` §5.2 |
| VC-04 | CẤM dùng LLM để quyết định eligibility | Eligibility là **luật**, phải tất định và giải thích được bằng SQL. LLM chỉ sinh chữ và soi chữ |
| VC-05 | CẤM streaming token ra UI (NG-10) | Không được chấm; làm hỏng việc hiển thị 3 chặng tách bạch cho R6 |
| VC-06 | CẤM tự "sửa lại cho tốt hơn" enum reason code | Đ12. Đổi nghĩa mã cũ = phá mọi số liệu lịch sử và Golden |
| VC-07 | CẤM đưa `confidence` vào bất kỳ props nào của component React | Chặn ngay từ tầng type, đừng dựa vào kỷ luật người viết (BB-05) |
| VC-08 | CẤM seed dữ liệu cư dân trông giống người thật (tên đầy đủ, CCCD, SĐT thật) | Đ02 + giữ demo sạch. Dùng `Cư dân A`, `0900000001` |
| VC-09 | CẤM để P05 ghi trực tiếp vào bảng của P02 | Sổ biên nhận là bảng riêng. Trộn thì log lượt hỏi và log hành động lẫn nhau, dashboard sai |
| VC-10 | CẤM "cải tiến" bằng cách cho agent tự thử lệnh ghi để dò luật | BB-03, Đ10. Đây là kiểu sai #3 ở `H02` §c.1 |
| VC-11 | CẤM mở rộng ra ngoài 7 gói P00–P06 | Deadline 7 ngày. Mọi ý tưởng mới ghi vào `plan.md` §4 dạng chưa tick, không code |
| VC-12 | CẤM đổi `plan.md` — file đó của Super Orchestrator | Hai người cùng ghi một file kế hoạch = mất lịch sử quyết định |

---

## 10. Quyết định kỹ thuật đã chốt (không hỏi lại)

| Hạng mục | Chốt | Neo |
| :-- | :-- | :-- |
| Framework | Next.js 15 App Router + TypeScript strict | Đ11 |
| Hosting | Vercel | Đ11 |
| DB | Postgres + `pgvector` trên Neon — RAG, state, sổ biên nhận **chung một kho** | Đ11 |
| Auth | Credential 2 vai, cookie phiên ký HMAC, seed sẵn 2 tài khoản | Đ11, NG-09 |
| Model A1 `classifier` | `claude-haiku-4-5` | §10.1 |
| Model A2 `retriever` | `claude-opus-5` | §10.1 |
| Model A3 `verifier` | `claude-sonnet-5` | §10.1 |
| Embedding | Xem `01-CONTRACTS.md` §4.3 — **không** dùng Claude (không có endpoint embedding) | §10.1 |
| Ngôn ngữ UI | Tiếng Việt toàn bộ | Luật §4 handoff |
| Ngôn ngữ mã | Tên biến/hàm/file/bảng tiếng Anh | Luật §4 handoff |

### 10.1 — Chọn model: căn cứ và số

Bảng giá và ID lấy từ skill `claude-api` (bảng *Current Models*, cached 2026-06-24).
**CẤM** thêm hậu tố ngày vào ID — `claude-opus-5`, không phải `claude-opus-5-2026xxxx`.

| Agent | Model ID | Giá in/out ($/1M tok) | Vì sao tầng này |
| :-- | :-- | :-- | :-- |
| A1 `classifier` | `claude-haiku-4-5` | 1.00 / 5.00 | Phân loại 5 intent + rút trường context. Việc có nhãn đúng/sai rõ ràng, không cần suy luận sâu |
| A2 `retriever` | `claude-opus-5` | 5.00 / 25.00 | Sinh bản nháp phải **không bịa**, phải biết dừng khi evidence mỏng. Đây là chỗ chất lượng quyết định điểm R3 |
| A3 `verifier` | `claude-sonnet-5` | 2.00 / 10.00 | Soi entailment từng claim. Có rubric rõ, tự biết đúng/sai; **khác họ với A2 là cố ý** — người chấm không nên là người viết |

Ràng buộc API bắt buộc nhớ (từ skill `claude-api`, sai là lỗi 400):

- `claude-opus-5` và `claude-sonnet-5`: dùng `thinking: { type: "adaptive" }`.
  `budget_tokens` **bị từ chối 400**. `temperature` / `top_p` / `top_k` **bị từ chối 400**.
- `claude-haiku-4-5`: ngược lại — dùng `thinking: { type: "enabled", budget_tokens: N }`
  (N ≥ 1024, < `max_tokens`), và `output_config.effort` **báo lỗi** trên Haiku 4.5.
- **Không có assistant prefill** trên Opus 5 / Sonnet 5 (400). Muốn ép định dạng thì
  dùng structured outputs.
- Structured outputs: `output_config: { format: ... }`. Tham số `output_format` (không
  có `_config`) đã **deprecated**, CẤM dùng.

---

## 11. Số đo nghiệm thu của file này

File này là kiến trúc, nên nghiệm thu của nó là: **12 bất biến đều có lệnh kiểm chạy
được**. Lệnh cụ thể nằm ở `TESTING-ACCEPTANCE.md` §4; đây là bảng đối chiếu.

| Bất biến | Test id | Lệnh (rút gọn — bản đầy đủ ở TESTING §4) | Kết quả PASS |
| :-- | :-- | :-- | :-- |
| BB-01 | `BB01` | `npm run test -- bb01` | `reason_code=no_eligible_source`, `citations=[]` |
| BB-02 | `BB02` | `node scripts/validate_policy.mjs` | `exit 0`, in `intake_windows: ok / operating_hours: ok` |
| BB-03 | `BB03` | `node scripts/validate_capabilities.mjs` | `exit 0`, `write without precheck: 0` |
| BB-04 | `BB04` | `npm run test -- bb04` | ném `PipelineInvariantError` |
| BB-05 | `BB05` | `scripts/check_no_confidence_ui.sh` | `exit 0`, `matches: 0` |
| BB-06 | `BB06` | `npm run test -- bb06` | `delta = 0` |
| BB-07 | `BB07` | `scripts/check_adapter_boundary.sh` | `exit 0`, `violations: 0` |
| BB-08 | `BB08` | `npm run test -- bb08` | mảng 9 chặng đúng thứ tự |
| BB-09 | `BB09` | `psql -f scripts/check_enum_closed.sql` | Postgres báo `invalid input value for enum` |
| BB-10 | `BB10` | `scripts/check_no_hardcoded_knowledge.sh` | `exit 0`, `matches: 0` |
| BB-11 | `BB11` | `npm run eval:golden && psql -c "select count(*) from answer_turns"` | count == số case đã chạy |
| BB-12 | `BB12` | đọc bảng Exit Gate `TESTING` §7 | G01–G12 đều `✅ local` trước khi có commit nào chạm `lib/simbackend/` |

**Đo lúc viết SPEC (2026-09-20 02:19 +0700, lệnh `date "+%Y-%m-%d %H:%M:%S %z"`):**
0/12 bất biến có mã nguồn — repo chưa có dòng code nào. Đây là **mốc gốc**; worker
P01 phải đưa BB-07 và BB-10 lên xanh trước tiên vì chúng là ràng buộc cấu trúc thư mục.

**Môi trường đã đo (lệnh `node --version; npm --version; git --version`):**
`node v24.12.0` · `npm 11.6.2` · `git 2.55.0.windows.3` · `psql` **không có trên
máy này** (lệnh `psql --version` → `NOT FOUND`). Hệ quả bắt buộc: mọi lệnh nghiệm thu
chạm DB phải có **đường thay thế bằng Node** — xem `OPERATIONS.md` §6.

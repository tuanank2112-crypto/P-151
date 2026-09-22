# TỔNG QUAN HIỆN TRẠNG — Resident Agent v1.0

> **File này là NGOẠI LỆ trong thư mục `docs/`.** Sáu tài liệu còn lại ở đây (`PRD_ResidentGPT_MVP.md`,
> `Product_Brief_*`, `UI_Flow_*`, `MVP_*`, `Problem_Card.md`) mô tả một **sản phẩm CŨ đã bị hạ cấp**
> — bản v0.2 "ResidentGPT", actor khác, mục tiêu khác. Chúng chỉ còn là nguồn tham chiếu nội dung và
> giọng văn. **File này mô tả sản phẩm ĐANG CHẠY, đo trực tiếp trên đĩa và trên DB thật.**
>
> **Mốc đo: 2026-09-22, tại commit `504b7a9`.** Deadline demo: **2026-09-27** (còn 5 ngày).
> Nguồn chân lý thiết kế: [`planning/01_2026-09-20_resident-agent-v1/plan.md`](../planning/01_2026-09-20_resident-agent-v1/plan.md)
> (nhật ký 46 quyết định Đ01–Đ46) → [`specs/`](../planning/01_2026-09-20_resident-agent-v1/specs/) → rồi mới tới `docs/`.

---

## 1. Sản phẩm này là gì

Trợ lý AI cho cư dân khu đô thị, **mô phỏng toàn phần** — không nối API Vinhomes, không dữ liệu cư dân
thật. Mục đích duy nhất: để ban giám khảo AI20K bấm thử trong 10 phút và tick đủ rubric `C104 / VHR-01 / G104`.

Điểm khác biệt của nó không nằm ở chỗ "trả lời được", mà ở chỗ **biết khi nào KHÔNG được trả lời**:
kho tri thức bị **cố tình cài 4 khuyết tật**, và sản phẩm phải phát hiện đúng từng cái, từ chối đúng lý do,
thay vì bịa ra một câu trả lời trôi chảy.

| Khuyết tật | Loại | Hiện ở đâu |
| :-- | :-- | :-- |
| `DEF-01` | thiếu nguồn | không tài liệu nào chứa "pickleball" |
| `DEF-02` | thiếu nguồn | không mục nào nêu phí cấp lại thẻ gửi xe |
| `DEF-03` | **mâu thuẫn** | `BBQ-CAP-01` nói 10 người, `BLD-AMEN-07` nói 15 người — cả hai còn hiệu lực |
| `DEF-04` | hết hiệu lực | `OCP1-POOL-RULES-2024` đã hết hạn |

`DEF-03` là cảnh demo mạnh nhất: agent **không chọn bên**, nó đưa cả hai nguồn ra để cư dân đối chiếu.

---

## 2. Kiến trúc — cái gì gọi cái gì

```mermaid
flowchart TB
    subgraph NGUOI["👥 Hai vai"]
        CD["Cư dân"]
        BQL["Ban quản lý"]
    end

    subgraph MAN["🖥️ 6 màn hình — tất cả đều THẬT, không màn nào là khung rỗng"]
        LOGIN["/login<br/>đăng nhập 2 vai"]
        CHAT["/chat<br/>hỏi–đáp có trích dẫn"]
        DOCS["/documents<br/>upload · đổi version · đổi status"]
        REV["/review<br/>hàng đợi duyệt HITL"]
        DASH["/dashboard<br/>tỉ lệ tự giải quyết"]
        EVAL["/eval<br/>bảng chấm Golden"]
    end

    API["POST /api/chat<br/><b>cửa HTTP DUY NHẤT</b> của luồng hỏi–đáp<br/>cắt confidence + gate trước khi trả"]
    PIPE["lib/pipeline/index.ts :: runTurn()<br/><b>điểm vào DUY NHẤT</b> của 9 chặng"]

    subgraph ADAPT["🔒 Hai biên giới bất khả xâm phạm"]
        DB["lib/adapters/db.ts<br/><b>nơi DUY NHẤT mở connection</b>"]
        MODEL["lib/adapters/model.ts<br/><b>nơi DUY NHẤT gọi Gemini</b>"]
    end

    subgraph AG["🤖 3 agent, 3 model khác nhau"]
        A1["A1 phân loại<br/>flash-lite"]
        A2["A2 soạn nháp<br/>flash"]
        A3["A3 kiểm chứng<br/>2.5-flash"]
    end

    PG[("Postgres · Supabase<br/>9 bảng")]
    KN["knowledge/<br/>19 tài liệu · 98 mục<br/><b>nguồn chân lý TRI THỨC</b>"]

    CD --> LOGIN --> CHAT --> API --> PIPE
    BQL --> LOGIN
    BQL --> DOCS & REV & DASH & EVAL

    PIPE --> DB & MODEL
    MODEL --> A1 & A2 & A3
    DB --> PG
    KN -.->|seed, một chiều| PG
    DOCS -->|"bql-store.ts"| PG
    REV -->|"bql-store.ts"| PG
    DASH -->|"metrics-store.ts"| PG
    EVAL -->|"metrics-store.ts"| PG

    classDef gate fill:#fde68a,stroke:#b45309,color:#1f2937
    classDef core fill:#bfdbfe,stroke:#1d4ed8,color:#1f2937
    classDef data fill:#bbf7d0,stroke:#15803d,color:#1f2937
    class ADAPT,DB,MODEL gate
    class API,PIPE core
    class PG,KN data
```

**Hai biên giới ở giữa là điều kiện sống của dự án**, không phải sở thích kiến trúc: đổi nhà cung cấp DB
hay model chỉ phải sửa đúng một file. Cả hai đều có script canh tự động (`check_adapter_boundary.sh`)
và script đó **đã được chứng minh là bắt được vi phạm thật**, không phải cổng trang trí.

---

## 3. Một lượt hỏi đi qua 9 chặng và có 5 lối thoát

Đây là phần đáng khoe nhất với ban giám khảo: **mỗi lối thoát nói một lý do khác nhau**, không gộp thành
"xin lỗi tôi không biết".

```mermaid
flowchart LR
    Q["Câu hỏi"] --> S1["1 validate"] --> S2["2 safety"] --> S3["3 intent"]
    S3 --> S4["4 context"] --> S5["5 risk"] --> S6["6 retrieval"]
    S6 --> S7["7 eligibility<br/>7 điều kiện"] --> S8["8 draft · A2"] --> S9["9 verify · A3"]
    S9 --> OK["✅ answer<br/>kèm citation tới document_id + section_id"]

    S2 -.-> G0["🛑 PII / khẩn cấp / pháp lý"]
    S7 -.-> G1["🛑 G1 mâu thuẫn nguồn<br/><b>đưa CẢ HAI nguồn ra</b>"]
    S7 -.-> G2["🛑 G2 không có nguồn nào"]
    S7 -.-> G3["🛑 G3 nguồn hết hiệu lực<br/>chỉ khi nguồn ĐÚNG CHỦ ĐỀ"]
    S9 -.-> G4["🛑 G4 claim không có neo"]

    classDef ok fill:#bbf7d0,stroke:#15803d,color:#1f2937
    classDef stop fill:#fecaca,stroke:#b91c1c,color:#1f2937
    class OK ok
    class G0,G1,G2,G3,G4 stop
```

Câu *"chỉ khi nguồn ĐÚNG CHỦ ĐỀ"* ở `G3` là bài học đắt nhất của dự án. Trước đó sản phẩm nói
*"tài liệu đã hết hiệu lực"* cho một tiện ích **chưa bao giờ có tài liệu** — tức là bịa một lý do nghe
có vẻ chuyên nghiệp. Xem `plan.md` Đ28 → Đ41 → Đ46.

---

## 4. ĐÃ CÓ GÌ — số đo thật, không phải mô tả

Tất cả chạy lại tại commit `504b7a9`, mã thoát kiểm trực tiếp:

| Hạng mục | Số đo | Trạng thái |
| :-- | :-- | :-- |
| Biên dịch | `npx tsc --noEmit` | ✅ exit 0 |
| Build | `npm run build` — 9/10 route dynamic | ✅ exit 0 |
| Bộ test | **172 ca · 172 pass · 0 fail · 0 skip** | ✅ exit 0 |
| Biên giới adapter | `violations: 0` | ✅ |
| Không lộ confidence ra UI | `matches: 0` | ✅ |
| Không hardcode tri thức | `matches: 0` | ✅ |
| Kho tri thức | 19 tài liệu · 98 mục · **4/4 khuyết tật đúng chỗ** | ✅ exit 0 |
| Bộ Golden | 50 ca FAQ (40 trả lời được) · 16 ca an toàn · phủ 10/10 mã | ✅ exit 0 |
| Mã nguồn | `lib/` 18 file · 4.356 dòng — `app/` 10 route · 1.934 dòng — `tests/` 23 file · 3.450 dòng | — |

**Dữ liệu thật đang nằm trong Supabase:**

| Bảng | Dòng | | Bảng | Dòng |
| :-- | --: | :-- | :-- | --: |
| `documents` | 19 | | `conversations` | 398 |
| `sections` | 98 | | `messages` | 571 |
| `chunks` | 98 | | `answer_turns` | 377 |
| `users` | 2 | | `review_queue` | **1** |

Và một điều đáng ghi nhận: **không màn nào trong `app/` là khung rỗng.** Cả 10 route đều có logic thật —
Server Action, truy vấn SQL, hoặc `fetch`. Giao diện **không** phải điểm yếu của dự án này.

---

## 5. Tiến độ 7 gói việc

```mermaid
flowchart TD
    P00["P00 · Kho tri thức + Golden<br/>19 tài liệu · 66 ca"] --> P01["P01 · Nền tảng + auth 2 vai"]
    P01 --> P02["P02 · RAG + 3 agent + bộ nhớ"]
    P01 --> P03["P03 · Console BQL"]
    P02 --> P03
    P02 --> P04["P04 · Eval + Dashboard"]
    P00 --> P04
    P03 --> P05["P05 · Lớp hành động<br/>đặt chỗ · biên nhận · hoàn tác"]
    P04 --> P05
    P05 --> P06["P06 · Kịch bản demo"]

    P01 --- D1["⛔ deploy: chờ chọn scope Vercel"]
    P02 --- D2["⛔ nhãn gate DEF-01/DEF-04: chờ phán quyết"]
    P04 --- D3["⛔ M1: chờ hạn mức Gemini"]

    classDef done fill:#bbf7d0,stroke:#15803d,color:#1f2937
    classDef part fill:#fde68a,stroke:#b45309,color:#1f2937
    classDef none fill:#e5e7eb,stroke:#6b7280,color:#1f2937
    classDef blk fill:#fecaca,stroke:#b91c1c,color:#1f2937
    class P00,P03 done
    class P01,P02,P04 part
    class P05,P06 none
    class D1,D2,D3 blk
```

| Gói | Trạng thái | Còn thiếu chính xác cái gì |
| :-- | :-- | :-- |
| **P00** Tri thức + Golden | ✅ xong | — |
| **P01** Nền tảng, auth | 🟡 gần xong | chỉ còn **deploy** — chờ chọn scope Vercel |
| **P02** RAG, 3 agent, bộ nhớ | 🟡 gần xong | chạy end-to-end thật rồi; còn nhãn `gate` của `DEF-01`/`DEF-04` chờ phán quyết |
| **P03** Console BQL | ✅ xong | còn thiếu màn `setSectionExcluded` (loại một mục khỏi RAG) |
| **P04** Eval + Dashboard | 🟡 gần xong | màn hình xong; **con số nghiệm thu `M1` chưa có** (cạn hạn mức) |
| **P05** Lớp hành động | ⬜ chưa động | `lib/simbackend/` chưa tồn tại; bảng `bookings`/`receipts` chưa có (cố ý — khoá sau cổng) |
| **P06** Kịch bản demo | ⬜ chưa động | — |

---

## 6. THIẾU GÌ

### 6.1. Tám script mà SPEC nhắc tới nhưng không có trên đĩa

| Script | Dùng để | Hệ quả khi thiếu |
| :-- | :-- | :-- |
| `demo_r7.mjs` | chứng minh BQL đổi tài liệu → agent đổi hành vi **ngay trong phiên** | **gate `G09` không đóng được** — đây là cảnh demo thuyết phục nhất của vai BQL |
| `check_enum_closed.mjs` | canh enum 15 mã lý do không bị nới | gate `G16` treo |
| `probe_embedding.mjs` · `probe_model.mjs` | kiểm 384 chiều, chuẩn hoá L2, responseSchema | gate `G27`–`G29` treo |
| `compare_faithfulness.mjs` | đối chiếu faithfulness | một phần `G11` |
| `validate_capabilities.mjs` · `validate_policy.mjs` · `demo_2339.mjs` | nghiệm thu P05 | chưa cần — P05 chưa mở |

### 6.2. Ba thứ chỉ người quyết được, không agent nào tự làm

1. **Nhãn `gate` cho `DEF-01` và `DEF-04`.** Hành vi đã đúng, mã lý do đã đúng; chỉ còn nhãn `gate` lệch
   so với kỳ vọng ghi trong bộ Golden. **Một phán quyết đóng được cả hai ca.** Đây là việc rẻ nhất trong
   danh sách và đang chặn gate rubric quan trọng nhất.
2. **Hạn mức Gemini.** Bộ `safety` 16 ca đã chạy hết; bộ `faq` 40 ca **chưa chạy được ca nào** — cạn quota.
   Không có `M1` thì `G11` không tick được. Nạp tiền Google Cloud, hay chia nhỏ chạy rải trong 5 ngày còn lại?
3. **Scope Vercel.** CLI đã đăng nhập sẵn, `npm run build` xanh không cần DB. Chỉ thiếu một lựa chọn scope.
   *(Kèm một việc kỹ thuật bắt buộc trước khi deploy: `DATABASE_URL` hiện trỏ cổng `5432`, serverless phải
   đổi sang pooler `6543`.)*

### 6.3. Repo chưa có remote

`git remote -v` rỗng. **Toàn bộ 15 commit chỉ tồn tại trên một ổ đĩa.** Đây là rủi ro lớn nhất mà cũng
rẻ nhất để gỡ trong toàn bộ danh sách này.

---

## 7. RỦI RO DEMO — ba thứ sẽ lộ ra ngay khi bấm thử

Đây là phần tôi muốn anh đọc kỹ nhất, vì cả ba đều **không** hiện ra ở bất kỳ cổng test nào.

```mermaid
flowchart LR
    subgraph R1["🔴 Màn /review gần như trống"]
        A["review_queue có 1 dòng<br/>và dòng đó đã 'rejected'<br/><b>0 dòng pending</b>"]
        B["Ban giám khảo mở hàng đợi HITL<br/>→ không có gì để duyệt"]
        A --> B
    end
    subgraph R2["🟠 Số trên /dashboard bị nhuộm"]
        C["377 lượt: escalate 288 · answer 56 · clarify 33<br/>phần lớn là traffic test và probe"]
        D["'Tỉ lệ tự động giải quyết' đọc ra ~15%<br/>→ số trông tệ hơn sản phẩm thật"]
        C --> D
    end
    subgraph R3["🟠 Bảng Golden vừa mới có số"]
        E["22/377 dòng có is_golden_run=true<br/>tất cả đều sinh ra HÔM NAY, sau bản vá Đ44"]
        F["Trước đó panel này RỖNG VĨNH VIỄN<br/>dù build xanh, test xanh"]
        E --> F
    end
    classDef bad fill:#fecaca,stroke:#b91c1c,color:#1f2937
    classDef warn fill:#fde68a,stroke:#b45309,color:#1f2937
    class R1,A,B bad
    class R2,R3,C,D,E,F warn
```

**Rủi ro 1 là nghiêm trọng nhất và cũng dễ sửa nhất.** Hàng đợi HITL là một trong những màn được chấm,
nhưng hiện không có lượt nào ở trạng thái `pending` để BQL bấm Duyệt/Sửa/Từ chối. Cần **seed vài lượt
nháp chờ duyệt** trước buổi demo.

**Rủi ro 2:** năm panel vận hành lọc `is_golden_run = false`, nên chúng hứng trọn traffic test. Hai cách
xử: dọn dữ liệu thử nghiệm (xoá nhiều dòng — cần anh gật), hoặc thêm một cờ phân biệt traffic demo.

**Rủi ro 3** đã được vá hôm nay và số bắt đầu chảy vào, nhưng mới 22 dòng. Chạy đủ bộ Golden sẽ lấp đầy —
lại quay về vấn đề hạn mức ở mục 6.2.

---

## 8. ĐƯỜNG GĂNG TỚI DEMO — 5 ngày

```mermaid
flowchart TD
    START(["Hôm nay · 2026-09-22"]) --> H1["🖐 Phán quyết nhãn gate<br/>DEF-01 + DEF-04<br/><i>1 câu trả lời</i>"]
    START --> H2["🖐 Chọn scope Vercel"]
    START --> H3["🖐 Quyết hạn mức Gemini"]
    START --> A1["🤖 Seed hàng đợi HITL<br/><i>gỡ rủi ro demo số 1</i>"]
    START --> A2["🤖 Đẩy repo lên remote<br/><i>gỡ rủi ro mất trắng</i>"]

    H1 --> G05["Gate G05 · 4/4 khuyết tật"]
    H3 --> M1["Chạy đủ bộ Golden<br/>→ số M1 + M3"]
    M1 --> G11["Gate G11 · số nghiệm thu"]
    H2 --> DEP["Deploy · đổi pooler 6543"] --> G02["Gate G02 · URL công khai"]
    A1 --> DEMO
    A2 --> DEMO

    G05 --> DEMO["🎬 P06 · kịch bản demo<br/>diễn trọn không vấp"]
    G11 --> DEMO
    G02 --> DEMO
    R7["🤖 viết demo_r7.mjs<br/>→ gate G09"] --> DEMO

    classDef human fill:#fecaca,stroke:#b91c1c,color:#1f2937
    classDef agent fill:#bfdbfe,stroke:#1d4ed8,color:#1f2937
    classDef gate fill:#fde68a,stroke:#b45309,color:#1f2937
    classDef goal fill:#bbf7d0,stroke:#15803d,color:#1f2937
    class H1,H2,H3 human
    class A1,A2,R7,M1,DEP agent
    class G05,G11,G02 gate
    class DEMO goal
```

Ba ô đỏ là **ba câu trả lời của anh**. Không câu nào cần quá một phút, nhưng cả ba đều đang chặn một
nhánh riêng. Mọi ô xanh dương agent làm được ngay khi có lệnh.

**Thứ tự tôi đề nghị:** phán quyết nhãn gate trước (rẻ nhất, mở khoá gate rubric quan trọng nhất) → seed
hàng đợi HITL và đẩy remote (agent tự làm, không chờ ai) → rồi mới tới hạn mức và deploy.

---

## 9. TỐI ƯU GÌ

Xếp theo tỉ lệ *giá trị / công sức*, không theo thứ tự kỹ thuật.

| # | Việc | Vì sao đáng làm |
| :-- | :-- | :-- |
| 1 | **Đẩy repo lên remote** | 15 commit đang nằm trên một ổ đĩa. Mất ổ là mất cả dự án. Tốn 2 phút |
| 2 | **Seed hàng đợi HITL** | Gỡ rủi ro demo nghiêm trọng nhất. Một màn được chấm đang trống trơn |
| 3 | **Tách traffic demo khỏi traffic thật** | Dashboard hiện đọc ra ~15% tự giải quyết vì bị test nhuộm — số trông tệ hơn sản phẩm thật rất nhiều |
| 4 | **Viết `demo_r7.mjs`** | Mở gate `G09`, và nó chính là cảnh demo thuyết phục nhất của vai BQL: sửa tài liệu → agent đổi câu trả lời ngay |
| 5 | **Bơm lỗi dai dẳng cho ca `S14`** (Đ45) | Ca này hiện xanh **một phần nhờ hạn mức đang cạn**. Quota hồi thì nó đổi màu mà không ai chạm code |
| 6 | **Nối `RETRIEVAL_MODE=hybrid`** | Hiện **0/98 chunk có embedding** — đang chạy thuần lexical. Hybrid là điểm cộng kỹ thuật, nhưng tốn quota |
| 7 | **Màn `setSectionExcluded`** | Nốt phần còn thiếu của P03 |

**Việc KHÔNG nên làm trong 5 ngày còn lại:** P05 (lớp hành động). Nó là gói **duy nhất được thiết kế để
cắt khi trễ hạn**, và cắt nó không đụng một dòng nào của rubric. `SPEC-P05` đã viết xong đầy đủ — để đó,
làm sau demo.

---

## 10. Một đặc điểm của dự án này, ghi lại để đừng quên

Trong phiên làm việc gần nhất, **sáu lần** gặp cùng một họ lỗi: **cổng kiểm xanh nhưng không canh gì cả.**

- script canh biên giới adapter từng xanh giả (Đ21)
- bộ chấm Golden thiếu 3/7 checkpoint nên mọi điểm đều cao hơn sự thật (Đ36)
- một assertion `≤ 300 ký tự` có mặt nhưng **chưa bao giờ được đọc**, vì dữ liệu test dài tối đa 200 (Đ42)
- hàm `isValidUuid` tồn tại nhưng là **mã chết**, không chỗ nào gọi (Đ43)
- cột `is_golden_run` không có đường nào để ghi `true`, panel nghiệm thu rỗng vĩnh viễn (Đ44)
- ca `S14` xanh **một phần nhờ hạn mức thật đang cạn**, không phải nhờ logic (Đ45)

Không lần nào có test đỏ. Tất cả đều chỉ lộ ra khi **đối chiếu tay với dữ liệu thật**.

Từ đó có một luật đang áp dụng, ghi ở Đ45: *một con số chỉ được coi là số nghiệm thu khi nó **không đổi
theo điều kiện môi trường***. Và một luật thi công: **mọi bộ đo mới phải được chứng minh là từng ĐỎ**
trước khi được tin.

---

## 11. Đọc tiếp ở đâu

| Cần gì | Đọc file nào |
| :-- | :-- |
| Vì sao một quyết định được chốt như vậy | [`planning/01_.../plan.md`](../planning/01_2026-09-20_resident-agent-v1/plan.md) §2 — 46 quyết định có mốc thời gian |
| Hợp đồng dữ liệu, DDL, 15 mã lý do | [`specs/01-CONTRACTS.md`](../planning/01_2026-09-20_resident-agent-v1/specs/01-CONTRACTS.md) |
| Ma trận test và 31 Exit Gate | [`specs/TESTING-ACCEPTANCE.md`](../planning/01_2026-09-20_resident-agent-v1/specs/TESTING-ACCEPTANCE.md) |
| Bẫy kỹ thuật đã gặp | [`brain4agent/-known-gotchas.md`](../brain4agent/-known-gotchas.md) — G01→G32 |
| Việc đang treo, theo thứ tự | [`brain4agent/roadmap.md`](../brain4agent/roadmap.md) |
| Bằng chứng máy của từng gói | [`planning/01_.../evidence/`](../planning/01_2026-09-20_resident-agent-v1/evidence/) |

---

*Tài liệu này mô tả hiện trạng tại một thời điểm. Khi số liệu ở mục 4 và mục 7 lệch với thực tế, hãy đo
lại rồi cập nhật file này — đừng tin nó hơn kết quả đo.*

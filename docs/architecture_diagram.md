# Architecture Diagram

> Nguồn số liệu và ngữ cảnh đầy đủ: [`docs/OVERVIEW.md`](OVERVIEW.md) §2, §3, §5.
> Ba sơ đồ dưới đây lấy nguyên nội dung từ đó, tách riêng cho deliverable BTC.

## 1. System Overview — cái gì gọi cái gì

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

## 2. Agent Flow — một lượt hỏi đi qua 9 chặng, 5 lối thoát

Mỗi lối thoát nói một lý do khác nhau, không gộp chung "xin lỗi tôi không biết".

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

## 3. Data Flow — BQL sửa tài liệu → DB → retrieval

BQL đổi `status` một tài liệu ở `/documents` phải làm câu trả lời liên quan đổi
hành vi **ngay trong cùng phiên demo** (gạch rubric R7) — không có bước rebuild
hay cache tách rời giữa ghi và đọc.

```mermaid
flowchart TB
    BQL["BQL · /documents"] -->|"đổi status/version<br/>(bql-store.ts, 1 câu SQL)"| PG[("Postgres<br/>documents · sections · chunks")]
    SEED["knowledge/<br/>19 tài liệu nguồn"] -.->|"seed, một chiều<br/>(Đ02 — không ghi ngược)"| PG

    PG -->|"lexical ts_rank_cd<br/>+ vector cosine (384 chiều)"| RET["lib/retrieval/query.ts<br/>hybrid retrieval"]
    RET --> PIPE["lib/pipeline/index.ts<br/>chặng 6-7 (retrieval + eligibility)"]
    PIPE -->|"citations + reason_code"| CHAT["/chat — câu trả lời hoặc từ chối"]
    PIPE -->|"1 dòng / lượt (BB-11)"| AT[("answer_turns")]
    AT --> DASH["/dashboard, /eval<br/>(metrics-store.ts, is_golden_run tách traffic)"]

    classDef data fill:#bbf7d0,stroke:#15803d,color:#1f2937
    classDef core fill:#bfdbfe,stroke:#1d4ed8,color:#1f2937
    class PG,AT data
    class RET,PIPE core
```

## Component Details

| Component (file) | Vai trò |
| :-- | :-- |
| `app/(resident)/chat/` | Màn hỏi–đáp cư dân, hiển thị trích dẫn `document_id · section_id` |
| `app/(bql)/documents/` | BQL upload tài liệu mới, đổi version, đổi `status`/`effective_status`/`allowed_for_rag` |
| `app/(bql)/review/` | Hàng đợi HITL: `pending → approved \| edited_approved \| rejected` |
| `app/(bql)/dashboard/` | Tỉ lệ tự động giải quyết, tách theo intent và reason code |
| `app/(bql)/eval/` | Bảng eval Golden (faithfulness/relevance), nút chạy lại |
| `app/api/chat/route.ts` | Cửa HTTP DUY NHẤT của luồng hỏi–đáp — cắt confidence trước khi trả về client |
| `lib/pipeline/index.ts` | `runTurn()` — điểm vào DUY NHẤT của 9 chặng (validate → verify) |
| `lib/adapters/db.ts` | Nơi DUY NHẤT mở connection Postgres (BB-07) |
| `lib/adapters/model.ts` | Nơi DUY NHẤT gọi Gemini, đọc `GEMINI_API_KEY` (BB-07) |
| `lib/adapters/bql-store.ts` | Toàn bộ truy vấn của console BQL (documents + review) |
| `lib/adapters/metrics-store.ts` | Toàn bộ truy vấn dashboard + eval |
| `lib/eval/score.ts` | Bộ chấm Golden DUY NHẤT — dùng chung bởi `scripts/eval_golden.mjs` và `/bql/eval` (BB-06) |
| `knowledge/` | 19 tài liệu nguồn tri thức, nguồn chân lý TRI THỨC, 4 khuyết tật cài sẵn (DEF-01…04) |
| Postgres (Supabase) | 9 bảng: `documents`, `sections`, `chunks`, `users`, `conversations`, `messages`, `answer_turns`, `review_queue`, `schema_migrations` |

## Hai bất biến kiến trúc bắt buộc

### BB-05 — Confidence không bao giờ ra màn hình `[Đ07]`

Số confidence chỉ sống trong DB và log. UI chỉ hiển thị **lý do** (`reason_code`
→ câu tiếng Việt) và **trạng thái**, không hiển thị phần trăm hay thanh tiến độ
tin cậy. Canh bằng `scripts/check_no_confidence_ui.sh` — `grep -rniE
"confidence|độ tin cậy" app/ --include=*.tsx` không được khớp dòng nào trong
JSX hiển thị.

### BB-07 — Mọi lối ra ngoài đi qua adapter `[Đ11, Đ17]`

Không file nào ngoài `lib/adapters/**` được gọi tới nhà cung cấp model, đọc
khoá nhà cung cấp, `import` driver Postgres, hay `fetch` tới host ngoài.

| File | Độc quyền cái gì |
| :-- | :-- |
| `lib/adapters/model.ts` | Gọi `generativelanguage.googleapis.com` · đọc `GEMINI_API_KEY` |
| `lib/adapters/db.ts` | Mở connection Postgres |

Canh bằng `scripts/check_adapter_boundary.sh` — `violations: 0`. Lý do bất
biến này tồn tại không phải sở thích kiến trúc: Đ17 đã chứng minh bằng một lần
lật nhà cung cấp model thật (TokenRouter → Gemini) mà không đụng call site
nào ở tầng trên, chính vì mọi lời gọi đi qua đúng một file.

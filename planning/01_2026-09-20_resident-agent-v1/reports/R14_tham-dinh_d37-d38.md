# R14 — Thẩm định đối kháng cô lập Đ37 (`conversation_id` uuid) + Đ38 (citations cho `source_conflict`)

Vai · **worker** · loại **thẩm định** (chỉ đọc + chạy lệnh) · họ/model: Claude Opus 5 (1M) · Bước 0 exit **0** · hiểu việc: **phạm vi** = đo đối kháng hai bản vá đang nằm trong working tree (`lib/adapters/db.ts`, `lib/pipeline/index.ts`, 4 script đo, 2 file test mới), tự thiết kế ≥3 cách phá; **xong khi** mỗi cách phá có lệnh + mã thoát nguyên văn và một phán quyết 3 dạng; **cấm** sửa bất kỳ file nào trong repo, cấm kết luận qua `grep` output, lỗi Tầng 1 không tính là trượt.
Handoff: [`handoffs/H11_tham-dinh-d37-d38.md`](../handoffs/H11_tham-dinh-d37-d38.md)
Base: `27c38f5c086c1d432d489e651f9b23687970e158`
Head: working tree chưa commit — `lib` + `scripts` **y nguyên** trước và sau lượt thẩm định (6 file sửa +207/−18, 2 file test untracked)

Bộ đột biến chạy trong **bản sao tạm** ở scratchpad (`node_modules` nối bằng junction, đã tháo bằng `rmdir` trước khi xoá). Repo gốc không bị sửa một byte.

## 1. Bảng các cách phá đã thiết kế

| # | Cách phá | Mã thoát nguyên văn | Kết luận |
| :-- | :-- | :-- | :-- |
| M1 | Trả `escalateResult()` về đúng lỗi G28 cũ (luôn `citations: []`) | `EXIT=1`, `pass 1 / fail 1`, `AssertionError: G1_conflict phải trả >= 2 citations (Đ38), được 0` | **ĐỎ THẬT** — test Đ38 canh đúng lỗi nó sinh ra để canh |
| M2 | Xoá **toàn bộ** giới hạn 300 ký tự của `toSnippet` (`return trimmed;`) | `EXIT=0`, `tests 2 / pass 2 / fail 0` | **ĐỎ THẬT (test vô giá trị)** — bỏ sạch hợp đồng `≤300` mà suite vẫn XANH. Họ lỗi **G12** |
| M3 | Phá tất định: `update(label + Math.random())` | `EXIT=1`, `pass 5 / fail 2` (đỏ đúng ca "TẤT ĐỊNH" + "resume") | **ĐỎ THẬT** |
| M4 | Tắt upsert `ensureConversationOwner` (`if (false && …)`) | `EXIT=1`, `pass 5 / fail 2`, FK `messages_conversation_id_fkey` | **ĐỎ THẬT** |
| M5 | Mô phỏng seed lại user: đổi uuid hardcode trong test | `EXIT=1`, `pass 0 / fail 2`, `conversations_user_id_fkey … Key (user_id)=(1111…) is not present in table "users"` | **ĐỎ THẬT (test giòn)** |
| P1 | `toSnippet` ca biên: 330 ký tự không có `.?!` trong 300 đầu; dấu chấm ở vị trí 1; ở vị trí 0 | `EXIT=0` — `A snippet len = 301 | <=300 ? false` · `B2 snippet = "1." len = 2` · `C snippet = "." len = 1` | **ĐỎ THẬT — vi phạm hợp đồng** |
| P2 | Ca biên nhãn (rỗng, unicode có dấu, emoji, 10 000 ký tự, toàn khoảng trắng, null byte, khác hoa/thường) + va chạm trên **87 nhãn thật** | `EXIT=0` — `nhan that: 87 | uuid duy nhat: 87 | va cham: 0 | khong hop le: 0`; version nibble `5`, variant ∈ {8,9,a,b} | **xanh** |
| P3 | Postgres có thật chấp nhận: `select $1::uuid` mọi ca biên + tìm dương tính giả của `isValidUuid` | `EXIT=0` — 8/8 round-trip khớp, `TONG SAI: 0`; không có dương tính giả | **xanh** |
| P4 | `ensureConversationOwner` có THẬT kiểm chủ? BQL tạo hội thoại → CƯ DÂN ghi vào | `EXIT=0` — `appendMessage KHONG nem loi`; chủ hội thoại sau khi cư dân ghi **vẫn là BQL**; tin nhắn cư dân nằm trong hội thoại BQL | **ĐỎ THẬT (bẫy tên gọi)** |
| P5 | Còn đường nào truyền nhãn dạng chữ vào `conversation_id`? grep toàn repo | 6 chỗ còn lại: `tests/citations.test.ts:70,96` · `tests/pipeline-order.test.ts:67,94,109,136` — XANH vì kho mock nhận mọi chuỗi | **ĐỎ THẬT (cổng canh chưa có)** |
| P6 | Có ai ghi `is_golden_run = true`? | `EXIT=0` — `answer_turns TONG: 230 · is_golden_run = TRUE: 0 · golden_case_id NOT NULL: 0` | **ĐỎ THẬT** |
| P7 | Đ38 có lọt citations sang gate khác G1? | `lib/confidence.ts:66` kiểm `conflict_detected` **TRƯỚC** mọi cổng ⇒ `conflictDetected ⟺ gate === "G1_conflict"`; `eligibility.ts:150` chỉ sinh `reason:"conflict"` khi có conflict group | **xanh** |
| P8 | Đ38 có tới được màn hình + bộ chấm? | UI render khi `citations.length > 0` (không phụ thuộc `decision`) · `lib/eval/score.ts:206` đọc `turn.citations` · `insertAnswerTurn` lưu citations cho lượt escalate | **xanh** |
| P9 | BB-04 / BB-07 vỡ? | BB-04 chỉ chặn `answer` + `citations=[]` (`index.ts:533`) ⇒ escalate kèm nguồn không vi phạm · SQL upsert nằm trong `db.ts` · `violations: 0` | **xanh** |

## 2. Cổng đã chạy (repo THẬT)

```
init_brain.js --check                                                    EXIT=0
npx tsc --noEmit                                                         EXIT=0
npm run build                                                            EXIT=0
node scripts/run_tests.mjs   → tests 143 / pass 143 / fail 0 / skipped 0 EXIT=0
… conflict-citations          → tests 2 / pass 2                          EXIT=0
… conversation-id             → tests 7 / pass 7                          EXIT=0
check_adapter_boundary.sh     → violations: 0                             EXIT=0
check_no_hardcoded_knowledge.sh → matches: 0                              EXIT=0
check_no_confidence_ui.sh     → matches: 0                                EXIT=0
validate_knowledge.mjs → documents: 19 · sections: 98 · defects_ok: 4/4   EXIT=0
validate_golden.mjs    → faq: 50 (answerable 40) · safety: 16 · 10/10     EXIT=0
```

Không có lỗi Tầng 1 nào; DB Postgres truy cập được nên **không phép đo nào bị blocked**.

## 3. Bảy phát hiện thật

### 1. 🔴 `toSnippet()` trả **301** ký tự — vi phạm `snippet_vi ≤ 300`
[`lib/pipeline/index.ts:187`](../../../lib/pipeline/index.ts#L187) — nhánh dự phòng `slice(0, 300)` rồi nối `…` ⇒ 300 + 1. Hợp đồng: [`specs/01-CONTRACTS.md:514`](../specs/01-CONTRACTS.md#L514) (nhắc lại ở `:816`).
**Với tới được trong sản phẩm, không phải giả thuyết:** `conflict_group` là **trường của upload** (`lib/adapters/bql-store.ts:210`), và `chunkSection()` (`:169–197`) để nguyên một "câu" không dấu thành MỘT chunk dài bao nhiêu cũng được (`if (candidate.length > 400 && current)` — `current` rỗng thì không cắt). BQL upload một section dài, không dấu câu, có `conflict_group` ⇒ citation 301 ký tự. Hôm nay chưa vỡ chỉ vì section seed dài nhất là **201** ký tự; hai section DEF-03 là 200/158.
**Sửa tối thiểu:** `slice(0, 299)` trước khi nối `…`.

### 2. 🔴 `toSnippet()` trả snippet vô nghĩa 1–2 ký tự
[`lib/pipeline/index.ts:186`](../../../lib/pipeline/index.ts#L186) cắt theo câu **không có sàn độ dài**. Tái lập: `"1." + …` ⇒ snippet `"1."`; `"." + …` ⇒ snippet `"."`. Rất thực với văn bản quy định tiếng Việt đánh số `1. …`. Sản phẩm sẽ hiện "Nguồn (2)" rồi trưng hai dòng `"1."` — tệ hơn không hiện gì.
**Sửa tối thiểu:** chỉ cắt theo câu khi `lastSentenceEnd >=` một sàn (vd 80), ngược lại cắt cứng kèm `…`.

### 3. 🔴 Bộ test mới KHÔNG canh được `toSnippet` — assertion `≤ 300` rỗng nghĩa
`tests/conflict-citations.test.ts:92` có `assert.ok(len > 0 && len <= 300)` nhưng dữ liệu cố định của DEF-03 dài tối đa 200 ⇒ **nhánh cắt chưa bao giờ chạy**. Chứng minh bằng M2. `toSnippet` hiện **0% được test**, đúng lúc nó chứa hai lỗi ở mục 1–2.

### 4. 🔴 Đ37 hứa "kèm một cổng canh" — cổng đó chưa tồn tại
`isValidUuid()` (`lib/adapters/db.ts:57`) **chỉ được dùng trong test**, 0 chỗ ở mã sản phẩm. Test chỉ khẳng định 4 nhãn hardcode không phải uuid; nó không chặn tầng ghi. Vẫn còn 6 chỗ truyền nhãn dạng chữ (`tests/citations.test.ts:70,96`; `tests/pipeline-order.test.ts:67,94,109,136`), XANH vì kho **mock** (`store-mock.ts:262–268`) nhận mọi chuỗi mà không kiểm — **đúng chỗ lệch mock↔postgres đã sinh ra G26 vẫn còn nguyên**.
**Sửa tối thiểu:** `appendMessage()`/`insertAnswerTurn()` ném ngay khi `!isValidUuid(conversationId)` ở CẢ hai cài đặt — một dòng, và nó biến `isValidUuid` từ mã chết thành cổng thật.

### 5. 🟠 `ensureConversationOwner` KHÔNG kiểm chủ sở hữu — tên gọi nói sai việc nó làm
`lib/adapters/db.ts:343–352` dùng `ON CONFLICT (id) DO NOTHING`, nên khi hàng đã tồn tại nó **không so** `user_id`. Đo trực tiếp (P4): tin nhắn của cư dân nằm trong hội thoại của BQL mà không lỗi.
**Hôm nay KHÔNG phải lỗ HTTP:** `app/api/chat/route.ts:168` chặn trước (403), và id chưa tồn tại thì `owner === null` ⇒ cũng 403. Luật 403 của BB-11 vẫn đứng.
**Rủi ro thật là tên gọi + JSDoc:** một agent sau đọc `ensureConversationOwner` rất dễ tin tầng adapter đã lo authz rồi bỏ cửa 403 ở route.

### 6. 🟠 Hai file test mới hardcode uuid mà chính bản vá này tuyên bố là KHÔNG được hardcode
`tests/conversation-id.test.ts:27` và `tests/conflict-citations.test.ts:31` ghim `"86e44c36-…"`. Nhưng `scripts/_fixtures.mjs` **cùng bản vá** viết ngược lại: *"không thể hardcode một uuid snapshot — sẽ vỡ lại sau lần seed kế tiếp"*, và `db/migrations/002_users.sql:14` xác nhận `DEFAULT gen_random_uuid()`. **Mâu thuẫn nội bộ trong một bản vá.** Đo được (M5): trên DB dựng lại, hai file này đỏ bằng lỗi FK khó hiểu trong khi `_fixtures.mjs` sống.

### 7. 🔴 **KHÔNG mã nào ghi `is_golden_run = true` / `golden_case_id`** — lý do thứ BA chặn `G11`
`lib/pipeline/index.ts:327` ghim cứng `is_golden_run: false`, và `RunTurnArgs` không có tham số nào để đổi. Đo trên Postgres thật **sau** lượt Golden chạy hôm nay: `answer_turns TONG: 230 · is_golden_run = TRUE: 0 · golden_case_id NOT NULL: 0`.
Hệ quả đo được:
- `lib/adapters/metrics-store.ts:238` (panel faithfulness Golden) và `:345` (bảng từng ca Golden) truy vấn `WHERE is_golden_run = true` ⇒ **rỗng vĩnh viễn**, trong khi `app/(bql)/eval/page.tsx:31` **nói thẳng với ban giám khảo** rằng panel này đọc `is_golden_run = true`.
- Năm panel vận hành (`:62`, `:108`, `:141`, `:169`, `:194`) lọc `is_golden_run = false` ⇒ **hứng trọn** traffic Golden + probe + test. Số thật: `reason_code=NULL 65 · system_error 57 · legal_or_compensation 53 · unsupported_intent 28 · source_conflict 14`; riêng câu đối chứng của test mới đã 51 dòng; `lifecycle_state='failed' 57` đến từ ca test cố tình làm hỏng — **chúng đang nằm trong hàng đợi HITL của BQL**.
**Quy trách nhiệm cho đúng:** `is_golden_run: false` có TRƯỚC bản vá này. Nhưng trước Đ37 mọi script đo vỡ ở lệnh ghi đầu tiên nên **không ghi gì**; sau Đ37 chúng ghi thành công. Đúng câu Đ37 tự viết: *"một thay đổi đúng đắn ở chỗ A kích hoạt một lỗi vốn đã nằm sẵn ở chỗ B."*

## 4. Những gì đã ĐỨNG VỮNG (không nương tay mà vẫn xanh)

- **`conversationIdFromLabel` sạch.** Tất định (M3 đỏ khi phá), 87/87 nhãn thật không va chạm, mọi ca biên ra uuid hợp lệ, Postgres `::uuid` round-trip khớp 8/8, `isValidUuid` không có dương tính giả.
- **Upsert `conversations` cần thật** — M4: tắt đi là FK vỡ ngay.
- **Đ38 đúng phạm vi "chỉ `G1_conflict`" — do CẤU TRÚC, không do câu `if`.** `confidence.ts:66` kiểm `conflict_detected` trước mọi cổng; `eligibility.ts:150` chỉ sinh `reason:"conflict"` khi có conflict group ⇒ G2/G3/G4/G5 trả `[]` **kể cả khi ai đó gỡ điều kiện `conflictDetected ?`**. Không đường escalate nào lọt nguồn, không nhánh conflict nào thiếu nguồn.
- **`buildConflictCitations` KHÔNG rỗng ở đúng ca DEF-03** — đo thật: 2 citations `BBQ-CAP-01` + `BLD-AMEN-07`, đủ `document_title_vi`/`heading_vi`, `gate_triggered="G1_conflict"`, `reason_code="source_conflict"`.
- **BB-04 và BB-07 không vỡ.**

## 5. Bảng phân công thực tế

| Gói | Tầng yêu cầu | Họ/model đã dùng |
| :-- | :-- | :-- |
| Thẩm định đối kháng cô lập Đ37 + Đ38 (cổng 🔴) | 🔴 | Claude Opus 5 (1M) — làm trọn, không giao xuống |

## 6. Việc KHÔNG làm + lý do

- **Không sửa một file nào trong repo** — luật handoff; mọi đột biến chạy trong bản sao tạm.
- **Không chạy `eval_golden.mjs` / `probe_defects.mjs`** — vùng cấm Đ36 và hạn mức Gemini là tài nguyên chung.
- **Không dọn `answer_turns` nhiễm** — xoá dữ liệu nhiều dòng là ngoại lệ bắt buộc dừng hỏi (Luật L.3). **Công khai phần tự thêm:** các lượt đo làm `answer_turns` 225 → 230, `conversations` 262 → 266; riêng 2 hàng của phép đo quyền (P4) đã tự xoá, xác nhận `con lai: 0`.
- **Ghi nhận ngoài phạm vi:** `check_adapter_boundary.sh` có `SCOPE=(app lib)`, **không quét `scripts/` và `tests/`**, nên test đọc `DATABASE_URL` trực tiếp nằm ngoài tầm cổng. Đây là **tiền lệ có trước** (`tests/memory.test.ts`), không phải vi phạm mới.

## 7. Câu hỏi cần người quyết

1. **Mục 7 là quyết định 🔴 mới:** ai ghi `is_golden_run = true` — thêm tham số vào `RunTurnArgs`, hay script đo `UPDATE` lại sau lượt chạy? Chốt xong mới nên chạy lượt Golden lấy `G11`.
2. **Hàng đợi HITL và dashboard đang chứa ~239 lượt gần như toàn bộ là test/probe.** Có dọn `answer_turns`/`conversations`/`messages` trước buổi demo không (xoá dữ liệu ⇒ cần chủ tịch gật)?
3. **Đổi tên `ensureConversationOwner`** có tính là đổi hợp đồng `DataStore` lần thứ hai và cần một Đ riêng?

---

**🔁 SỬA: mục 1 + 2 (`toSnippet` — `lib/pipeline/index.ts:186–187` vi phạm `01-CONTRACTS.md:514` và sinh snippet 1–2 ký tự), mục 3 (bổ sung test unit cho `toSnippet` — đã chứng minh xoá sạch giới hạn 300 mà suite vẫn xanh), mục 4 (cổng canh uuid mà Đ37 tự hứa: `isValidUuid` đang là mã chết, còn 6 chỗ nhãn dạng chữ sống nhờ mock không kiểm), mục 6 (bỏ uuid hardcode trong 2 file test, tra qua `findUserByEmail` như `_fixtures.mjs`). Phần lõi Đ37 (tất định + hình dạng uuid + upsert) và lõi Đ38 (chỉ `G1_conflict` kèm nguồn, DEF-03 ra đúng 2 citations thật) đã qua 5 đột biến đối kháng và ĐỨNG VỮNG — không phải làm lại. Mục 5 và 7 tách ra quyết định 🔴 riêng, KHÔNG chặn lượt sửa này, nhưng mục 7 chặn `G11`.**

---

## Phụ lục — SO ĐO LẠI, không tin report (Luật K.5)

Bốn điểm quyết định, đo độc lập tại working tree, cùng kết quả:

| Điểm | Phép đo của SO | Khớp? |
| :-- | :-- | :-- |
| Mục 1 — `toSnippet` 301 | Đọc `lib/pipeline/index.ts:184–188`: `slice(0, 300)` rồi `` `${cut}…` `` ⇒ 301 theo cấu trúc mã | ✅ khớp |
| Mục 4 — `isValidUuid` là mã chết | `grep -rn isValidUuid lib app scripts tests` ⇒ chỉ định nghĩa `db.ts:57` + 6 lần trong `tests/conversation-id.test.ts`. **0** chỗ ở mã sản phẩm | ✅ khớp |
| Mục 6 — uuid hardcode | `grep -n 86e44c36 tests/*.test.ts` ⇒ `conversation-id.test.ts:27`, `conflict-citations.test.ts:30` | ✅ khớp |
| Mục 7 — không ai ghi `true` | `grep -rn is_golden_run lib app scripts` ⇒ writer duy nhất là `lib/pipeline/index.ts:327` ghim `false`; đọc DB thật: `answer_turns TONG=239 · is_golden_run=true: 0 · golden_case_id NOT NULL: 0` | ✅ khớp (số cao hơn 230 vì lượt đo của SO tiếp tục ghi) |

**Phán quyết của SO:** nhận nguyên phán quyết 🔁 SỬA ở trên. Bốn mục 1/2/3/4/6 vào một gói vá 🟠 có SPEC rõ; mục 7 nâng thành quyết định 🔴 riêng (xem `plan.md` Đ44); mục 5 xử bằng đổi tên + JSDoc nói thật (xem Đ44).

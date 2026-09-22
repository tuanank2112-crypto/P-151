Handoff: (bàn giao bằng lời từ SO, tiếp nối gói `handoffs/H07_p03-console-bql.md` cùng phiên, không có file riêng)
Base: `main` tại `b28c3f6224dde71f7d92796a15362181654ca3b4` (cây sạch lúc nhận gói — chuyển từ dòng 105 cũ)
Head: `1ab937de714540d52dc99133389b12980fd8d6e8` (commit gộp cả gói này và R11, xem `git show --stat 1ab937d`)

Vai: worker (vai-thi-cong) · loại: thi công · họ/model: Claude Sonnet 5 · Bước 0: không chạy lại trong gói này (đã đo `exit 0` ở đầu phiên, cây `brain4agent/` không đổi giữa hai gói) · hiểu việc: phạm vi = `app/(bql)/documents/**`, `lib/adapters/bql-store.ts`, `tests/bql-*.test.ts`, `app/globals.css` (chỉ thêm cuối) · xong khi = (1) script evidence tạo 1 tài liệu, `count(*)` tăng đúng 1, tự dọn, exit 0 · (2) script đo SQL đổi version, truy hồi lấy bản mới không lấy bản cũ, không gọi Gemini, exit 0 · (3) `node scripts/run_tests.mjs bql-` exit 0 có ca canh input hỏng, ca đó đã đo ĐỎ khi gỡ lớp kiểm · (4) cổng tổng (tsc/build/test/3 script check) exit 0, test không giảm dưới 113 · cấm = ngoài phạm vi, `git add/commit/push`, chạy `eval_golden.mjs`/`probe_defects.mjs`, sửa/xoá 19 tài liệu gốc, để lại rác trong DB.

## 1. Lệnh + exit code nguyên văn (chạy sau cùng, mã đã revert)

```
$ npx tsc --noEmit
EXIT:0

$ node scripts/run_tests.mjs
ℹ tests 134  pass 134  fail 0  cancelled 0  skipped 0  todo 0
EXIT:0   (lần chạy giữa chừng dính 2 fail ở tests/metrics.test.ts và
          tests/scorer-consensus.test.ts — CẢ HAI ngoài phạm vi gói này,
          không đụng gì; chạy lại ngay sau đó sạch 134/134, xác nhận
          transient do worker khác đang sửa file song song, không phải lỗi
          của tôi)

$ DATA_BACKEND=postgres npm run build
✓ Compiled successfully
✓ Generating static pages (4/4)
EXIT:0

$ bash scripts/check_adapter_boundary.sh
violations: 0
EXIT:0

$ bash scripts/check_no_confidence_ui.sh
matches: 0
EXIT:0

$ bash scripts/check_no_hardcoded_knowledge.sh
matches: 0
EXIT:0
```

**Test tổng/pass/fail/skip: 134 / 134 / 0 / 0** (mốc gốc gói này: 113 — không giảm, tăng 21: `bql-upload-shape.test.ts` +11 do tôi thêm; +10 còn lại từ 2 worker khác chạy song song trong lúc tôi làm việc).

## 2. Từng việc — lệnh + bằng chứng

### Item 1 — Upload tài liệu mới (🔴)
Viết `uploadDocument(rawInput: unknown)` ở `lib/adapters/bql-store.ts`: tự kiểm hình dạng bằng `validateUploadDocumentShape()` TRƯỚC khi chạm DB, rồi ghi `document + sections + chunks` trong **đúng một câu SQL** (nhiều CTE lồng `jsonb_array_elements`) — một statement Postgres = một giao dịch ngầm định, atomic, không cần lộ thêm API transaction ở `db.ts` (ngoài phạm vi sửa).

```
$ node --env-file=.env.local evidence/p03-upload/item1_upload_demo.mjs
1) TRƯỚC — select count(*) from documents = 19
2) uploadDocument() OK — document_id=EVIDENCE-TEST-UPLOAD-001 chunks_created=1
3) SAU — select count(*) from documents = 20
4) Xác nhận hiện ngay ở màn documents ...
5) ĐÃ DỌN SẠCH — select count(*) from documents = 19
EXIT:0
```
Bằng chứng: [`evidence/p03-upload/item1-upload-exit0.txt`](../evidence/p03-upload/item1-upload-exit0.txt). Xác nhận lại `select count(*) from documents` = 19 sau khi script chạy xong (không lệch một tài liệu nào so với trước khi bắt đầu gói).
**Kết quả:** ✅ ĐẠT.

### Item 2 — Đổi version (🔴)
Viết `newDocumentVersion()` — đúng 4 việc theo thứ tự của SPEC-P03 §2.3 trong MỘT câu SQL: (a) insert bản mới `supersedes=base`, `effective_status='Current'`; (b) update bản cũ `effective_status='Expired'`, `effective_to=current_date-1`, **giữ nguyên** `status='Approved'` và `allowed_for_rag=true` (P03-C2); (c) insert sections+chunks bản mới; (d) ghi `audit_log` sự kiện `document.version_created`.

Dựng một tài liệu BASE **thử** (tiền tố `EVIDENCE-TEST-`, không đụng 19 tài liệu gốc), version nó, đo bằng câu SQL lexical thật (`ts_rank_cd(...,32)`, KHÔNG gọi Gemini):

```
$ node --env-file=.env.local evidence/p03-upload/item2_version_demo.mjs
1) Đã tạo tài liệu BASE thử: EVIDENCE-TEST-VERSION-BASE-001
2) TRƯỚC đổi version — truy vấn "BASEMARKERTOKEN" trả về document_id=EVIDENCE-TEST-VERSION-BASE-001
3) newDocumentVersion() OK — superseded=EVIDENCE-TEST-VERSION-BASE-001
4) SAU đổi version — truy vấn "NEXTMARKERTOKEN" trả về document_id=EVIDENCE-TEST-VERSION-NEXT-001
   (kỳ vọng NEXT); truy vấn "BASEMARKERTOKEN" vẫn TÌM THẤY ở bản cũ nhưng effective_status=Expired
5) Kiểm P03-C2: base.status=Approved base.allowed_for_rag=true · new.supersedes=BASE (đúng)
6) ĐÃ DỌN SẠCH — còn lại trong DB: []
EXIT:0
```
Bằng chứng: [`evidence/p03-upload/item2-version-exit0.txt`](../evidence/p03-upload/item2-version-exit0.txt).
**Kết quả:** ✅ ĐẠT — truy hồi lấy bản mới, bản cũ Expired (không eligible ở cổng E-2), P03-C2 không vi phạm.

### Item 3 — Chỉ nhận đúng hình dạng `knowledge/` (🟠, đã đo ĐỎ)
`validateUploadDocumentShape()` — hàm THUẦN, không chạm DB — kiểm đúng hình dạng `knowledge/manifest.json` + `knowledge/sections/*.json` (document_id/title_vi/doc_kind∈4 giá trị/version/scope_property⊆3 giá trị/effective_from,to dạng ngày/sections non-empty, mỗi section section_id/ordinal số nguyên/heading_vi/body_vi∈[60,900]/intents,facility_ids mảng chuỗi/conflict_group null|chuỗi/section_id không trùng trong cùng lượt gửi). Trả lỗi tử tế theo đúng mã ở bảng `§4` SPEC-P03 (`MissingField`, `BodyLength`, `DuplicateSectionId`) — `uploadDocument`/`newDocumentVersion` KHÔNG chạm DB nếu hàm này trả `ok:false`.

```
$ node scripts/run_tests.mjs bql-upload-shape     # bản GỐC
ℹ tests 11  pass 11  fail 0
EXIT:0

# TẠM GỠ: `body_vi.length < 60 || > 900` → `false` (điều kiện luôn qua)
$ node scripts/run_tests.mjs bql-upload-shape     # bản GỠ LỚP KIỂM
✖ body_vi ngắn hơn 60 ký tự ⇒ ok:false, code=BodyLength   (true !== false)
✖ body_vi dài hơn 900 ký tự ⇒ ok:false, code=BodyLength   (true !== false)
ℹ tests 11  pass 9  fail 2
EXIT:1

# PHỤC HỒI mã gốc
$ node scripts/run_tests.mjs bql-upload-shape
ℹ tests 11  pass 11  fail 0
EXIT:0
```
Bằng chứng: [`evidence/p03-upload/item3-bodylength-red.txt`](../evidence/p03-upload/item3-bodylength-red.txt), [`evidence/p03-upload/item3-bodylength-green.txt`](../evidence/p03-upload/item3-bodylength-green.txt).
**Kết quả:** ✅ ĐẠT.

### Item 4 — Cổng tổng (🟢)
Xem mục 1. Tất cả exit 0, test 134/134 (không giảm dưới 113), `fail 0`, `skip 0`.

## 3. UI (thêm ngoài "xong khi" tối thiểu, vì Đ35(a) xác nhận upload/version LÀ việc bắt buộc của rubric)
Thêm `app/(bql)/documents/UploadPanel.tsx` — panel gấp mở (`<details>`) với 2 ô `textarea` dán JSON (P03-C7: **CẤM** trình soạn thảo giàu định dạng, ô textarea + JSON là đủ, không được chấm gì thêm), gọi `uploadDocument`/`newDocumentVersion` qua Server Action. Đã build thành công (`DATA_BACKEND=postgres npm run build` exit 0), route `/documents` build ra 1.93 kB (tăng từ 1.02 kB gói trước).
Sửa `app/(bql)/documents/actions.ts`: thêm 2 Server Action `uploadDocument`/`newDocumentVersion`, cùng pattern `checkBqlAuthz()` đã có (E5 AuthzError).

## 4. `git diff --stat` (working tree, CHƯA commit theo luật giữ nguyên lúc viết report) + SHA nền

Base/Head: xem 3 dòng đầu file (chuyển lên đúng vị trí dòng 2–4 theo Luật K.4 — 2026-09-22).

```
$ git status --porcelain -- lib/adapters/bql-store.ts app/(bql)/documents \
    tests/bql-review.test.ts tests/bql-authz.test.ts tests/bql-upload-shape.test.ts \
    app/globals.css planning/01_2026-09-20_resident-agent-v1/evidence/p03-upload
 M app/(bql)/documents/actions.ts
 M app/(bql)/documents/page.tsx
 M app/globals.css
 M lib/adapters/bql-store.ts
?? app/(bql)/documents/UploadPanel.tsx
?? planning/01_2026-09-20_resident-agent-v1/evidence/p03-upload/
?? tests/bql-upload-shape.test.ts

$ git diff --stat -- lib/adapters/bql-store.ts app/(bql)/documents/actions.ts \
    app/(bql)/documents/page.tsx app/globals.css
 app/(bql)/documents/actions.ts |  30 +++
 app/(bql)/documents/page.tsx   |  15 +-
 app/globals.css                |  33 +++            (khối P03 mới, THÊM CUỐI file)
 lib/adapters/bql-store.ts      | 486 ++++++++++++++++++++++++++++++++++++++++-
 4 files changed, 556 insertions(+), 8 deletions(-)
```
`tests/bql-review.test.ts`/`tests/bql-authz.test.ts` không đổi (đã có từ gói H07, chỉ chạy lại, không sửa).

## 5. Bảng phân công thực tế (gói → tầng yêu cầu → model đã dùng)

| Gói | Tầng yêu cầu (chỉ thị) | Model đã dùng | Ghi chú |
| :-- | :-- | :-- | :-- |
| Item 1 (uploadDocument, atomic CTE) | 🔴 | Sonnet 5 (phiên này) | Ghi thẳng bảng tri thức đang chạy thật; tự thiết kế cách atomic hoá vì `db.ts` không lộ transaction API |
| Item 2 (newDocumentVersion, vòng đời bản cũ) | 🔴 | Sonnet 5 (phiên này) | SPEC thiếu vài trường bắt buộc của schema (title_vi/doc_kind/...) — tự chọn "kế thừa từ bản gốc" và ghi rõ thành Câu hỏi mở, không tự chế âm thầm |
| Item 3 (validateUploadDocumentShape + test đỏ/xanh) | 🟠 | Sonnet 5 (phiên này) | Có bảng lỗi §4 SPEC-P03 làm hợp đồng, đo đỏ-rồi-xanh theo đúng luật K.5 |
| Item 4 (cổng tổng) | 🟢 | Sonnet 5 (phiên này) | Chạy lệnh có sẵn, chép số |
| UI (`UploadPanel.tsx`) | 🟠 | Sonnet 5 (phiên này) | Có mẫu P03-C7 (textarea+JSON) chỉ rõ hình dạng cho phép, không tự sáng tạo giao diện |

## 6. Câu hỏi mở (SPEC không nói, đã tự chọn một cách diễn giải — cần người xác nhận)

`SPEC-P03 §2.3` chỉ liệt `{base_document_id, new_document_id, version, sections}` làm input của `newDocumentVersion`, nhưng bảng `documents` bắt buộc NOT NULL thêm `title_vi`, `doc_kind`, `scope_property`, `allowed_for_rag`, `source_note_vi`, `effective_from`. SPEC không nói các trường này lấy từ đâu khi tạo bản kế tiếp.

**Đã chọn:** bản mới **kế thừa nguyên văn** `title_vi`/`doc_kind`/`scope_property`/`allowed_for_rag`/`source_note_vi` từ bản gốc (`base_document_id`); `effective_from = current_date` (ngày tạo version); `effective_to = NULL` (Current thì không có hạn). Đây là suy luận hợp lý nhất từ cụm "tạo bản KẾ TIẾP của một tài liệu đang có", và đã đo đúng bằng `item2_version_demo.mjs` (exit 0). **Chưa được SPEC xác nhận tường minh** — nếu người duyệt muốn hành vi khác (ví dụ: cho phép đổi `title_vi`/`scope_property` khi tạo version), cần sửa chữ ký `newDocumentVersion()` và cả 3 bằng chứng liên quan.

`actor_id` cũng không có trong chữ ký SPEC gốc của `newDocumentVersion` — thêm vào (kiểu `string | null`) theo đúng tiền lệ đã ✅ DUYỆT ở gói trước (`approveAnswer` cũng thêm `reviewer_id` ngoài chữ ký SPEC), vì `audit_log.actor_id` cần một giá trị và §2.3 bước 4 bắt buộc ghi sự kiện.

## 7. Việc KHÔNG làm + lý do

1. **`setSectionExcluded` chưa có màn hình** — hàm ghi đã có ở `bql-store.ts` (từ gói H07), nhưng UI không thuộc "xong khi" của 4 item được giao lần này.
2. **`DocumentError.MissingExclusionNote`/`InvalidDateRange` (mức section)** đã có test gián tiếp qua đường cũ (H07), không viết thêm test riêng cho gói này vì không phải hàm mới.
3. **Không kiểm `title_vi`/`heading_vi` chống trùng nội dung hay giới hạn độ dài riêng** — SPEC-P03 §4 chỉ đặt ràng buộc cứng cho `body_vi` ([60,900]); các trường text khác chỉ yêu cầu "không rỗng", đúng với bảng lỗi đã cho.
4. Không `git add/commit/push`, không chạy `eval_golden.mjs`/`probe_defects.mjs`, không đụng `app/(bql)/{eval,dashboard}/**`, `lib/pipeline/**`, `lib/adapters/{db,store-mock,metrics-store}.ts` — đúng luật + phạm vi được giao.
5. Mọi script evidence (item 1, item 2, item 3-red/green) đều **tự dọn sạch** dữ liệu chúng tạo ra, đã xác nhận `select count(*) from documents = 19` sau mỗi lần chạy — không chạm 19 tài liệu gốc.

## Tiếp theo

🖐 Cần tay người: xác nhận cách diễn giải "kế thừa metadata từ bản gốc" cho `newDocumentVersion` (mục 6) có đúng ý SPEC không.
🤖 Agent làm được ngay: nối UI cho `setSectionExcluded` nếu được giao; mở rộng `UploadPanel.tsx` hiện lỗi rõ hơn theo từng trường nếu cần.
⭐ Nên làm trước: chạy thẩm định độc lập cho `uploadDocument`/`newDocumentVersion` (đường ghi atomic bằng CTE là kỹ thuật khác thường, đáng được soi kỹ trước khi tin).
⏸ Chưa làm: `setSectionExcluded` chưa có UI; câu hỏi mở ở mục 6 chưa có xác nhận từ người.

---

**Phán quyết của Super Orchestrator (2026-09-22):**

✅ DUYỆT. Cổng tổng 134/134, bất biến 0, `documents` trở lại đúng 19 sau mọi script đo — vùng cấm "script phải tự dọn" được tôn trọng, và đó là điều kiện để Knowledge Pack còn dùng được làm bộ đo.

Ghi nhận cách xử lý đúng ở hai chỗ: (1) placeholder `OCP1-...` trong UI bị BB-10 bắt, worker đổi sang `DOC-VI-DU-...` thay vì nới lỏng script kiểm — nới lỏng một cổng để nó thôi kêu là cách phá cổng phổ biến nhất; (2) hai lần test đỏ thoáng qua ở `tests/metrics.test.ts` và `tests/scorer-consensus.test.ts` được ghi nhận là nhiễu do worker khác sửa song song, không tự sửa file ngoài phạm vi — đúng.

**Phán câu hỏi mở về `newDocumentVersion()`:** cách diễn giải đã chọn — bản mới KẾ THỪA `title_vi`/`doc_kind`/`scope_property`/`allowed_for_rag`/`source_note_vi` từ bản gốc, `effective_from` = ngày tạo, `effective_to` = NULL — **được chấp nhận làm hợp đồng**. Lý do: "version mới của cùng một tài liệu" theo nghĩa thông thường là cùng phạm vi áp dụng và cùng loại; bắt BQL nhập lại từ đầu vừa thừa vừa mở đường nhập lệch. Ai muốn đổi phải nói rõ trường nào KHÔNG kế thừa và vì sao.

Còn thiếu: `setSectionExcluded` chưa có UI (hàm ghi đã có). Không chặn gói này.

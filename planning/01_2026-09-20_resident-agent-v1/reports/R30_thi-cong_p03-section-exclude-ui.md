Vai: worker (vai-thi-cong) · loại: THI CÔNG · họ/model: Claude Sonnet 5 · Bước 0: exit 0 · hiểu việc: phạm vi = `lib/adapters/bql-store.ts` (chỉ thêm `listSectionsForConsole`) · `app/(bql)/documents/actions.ts` (thêm action `setSectionExcluded`) · `app/(bql)/documents/SectionsPanel.tsx` (mới) · `app/(bql)/documents/page.tsx` (gắn panel) · `app/globals.css` (khi cần) · `tests/bql-section-exclude.test.ts` (mới) · evidence · report. Xong khi = mỗi W có tiêu chí đo riêng (xem bảng dưới) + cổng W5 xanh. Cấm bằng lời mình: không chạm `db/**`, `lib/pipeline/**`, `planning/**/specs/**`, `brain4agent/**`, `package.json`; không SQL trong `app/`; không git add/commit/push/stash/checkout--/reset/clean; không lưu cookie vào evidence.

Handoff: `planning/01_2026-09-20_resident-agent-v1/handoffs/H26_p03-section-exclude-ui.md`
Base: f4374f4
Head: f4374f4 (chưa commit — CẤM commit theo luật §2 handoff)

## Lệnh + exit code nguyên văn

- `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` → exit 0 (NÃO ĐÃ OK — KHÔNG CẦN NÂNG CẤP THÊM)
- `npx tsc --noEmit` → exit 0 (chạy 2 lần, trước và sau khi sửa chữ tĩnh SSR — cả hai lần 0)
- `npm run build` → exit 0 (Compiled successfully, 13 route, `/documents` 2.7 kB)
- `node scripts/run_tests.mjs` → exit 0
- `bash scripts/check_adapter_boundary.sh` → `violations: 0` → exit 0
- `bash scripts/check_no_confidence_ui.sh` → `matches: 0` → exit 0
- `netstat -ano | findstr :31` (G40, trước khi mở dev server) → không có tiến trình LISTENING nào ở dải 31xx → exit 1 (không khớp — đúng ý muốn)
- `rm -rf .next && npm run dev -- --port 3106` → Ready in 2.4s
- `node --env-file=.env.local evidence/h23-dashboard-actioned/make_bql_cookie.mjs` → exit 0 (in cookie ra stdout, không ghi file)
- `curl -s -o ... -w "HTTP_STATUS:%{http_code}"` với cookie BQL tới `/documents` → `HTTP_STATUS:200`
- `grep -c "Loại khỏi trả lời" /tmp/documents_page2.html` → `1`
- Tắt dev server: `Stop-Process -Id <pid>` theo pid tra bằng `Get-NetTCPConnection -LocalPort 3106` → sau đó `netstat -ano | findstr :3106` chỉ còn `TIME_WAIT` (không còn `LISTENING`)
- `grep -cP '[\x08\x0c\x0b]'` trên 6 file đã sửa/tạo (`lib/adapters/bql-store.ts`, `app/(bql)/documents/actions.ts`, `app/(bql)/documents/page.tsx`, `app/(bql)/documents/SectionsPanel.tsx`, `app/globals.css`, `tests/bql-section-exclude.test.ts`) → cả 6 file = 0

## Test tổng/pass/fail/skip

`node scripts/run_tests.mjs` (toàn bộ, DATA_BACKEND=mock ép bởi wrapper):
`tests 253 · pass 253 · fail 0 · cancelled 0 · skipped 0 · todo 0`
(nền trước khi làm: 251/251 theo bối cảnh handoff → tăng đúng 2 test mới của `bql-section-exclude.test.ts`.)

Riêng `node scripts/run_tests.mjs bql-section-exclude`: `tests 2 · pass 2 · fail 0 · skipped 0`.

Bằng chứng ĐỎ (W4, luật §3 handoff): tạm sửa `lib/adapters/bql-store.ts` dòng chặn `MissingExclusionNote` thành `if (false && ...)`, chạy `node --test --test-name-pattern="MissingExclusionNote" tests/bql-section-exclude.test.ts` → **1 fail** (`AssertionError: actual 'NotFound' !== expected 'MissingExclusionNote'`), lưu `planning/01_2026-09-20_resident-agent-v1/evidence/h26-section-exclude/red.txt`. Phục hồi mã gốc ngay sau đó, chạy lại xanh, lưu `green.txt` cùng thư mục.

## `git diff --stat` + SHA

```
 app/(bql)/documents/actions.ts | 26 ++++++++++++++++++++++++++
 app/(bql)/documents/page.tsx   | 22 ++++++++++++++++------
 app/globals.css                | 19 +++++++++++++++++++
 lib/adapters/bql-store.ts      | 20 ++++++++++++++++++++
 4 files changed, 81 insertions(+), 6 deletions(-)
```
File mới (không nằm trong `git diff --stat` vì chưa `git add`): `app/(bql)/documents/SectionsPanel.tsx`, `tests/bql-section-exclude.test.ts`, `planning/01_2026-09-20_resident-agent-v1/evidence/h26-section-exclude/{red.txt,green.txt}`.
SHA làm việc: `f4374f4` (Base = Head, không commit).

## Bảng phân công thực tế

| Gói | Tầng yêu cầu | Tầng thực tế đã làm | Ghi chú |
| :-- | :-- | :-- | :-- |
| W1 `listSectionsForConsole` | 🟢 | 🟢 | Một SELECT, theo mẫu `listDocumentsForConsole`. `tsc` 0. |
| W2 Server Action `setSectionExcluded` + `listSections` | 🟢 | 🟢 | Theo mẫu `setDocumentStatus`/`setEffectiveStatus` cùng file. `grep -c "checkBqlAuthz(session)"` = 6 = số `export async function` = 6. |
| W3 `SectionsPanel` | 🟠 | 🟠 | Client component mới, chọn tài liệu → liệt kê mục → loại (bắt buộc lý do, hiện lỗi `MissingExclusionNote` tiếng Việt) / đưa lại; theo mẫu `DocumentsTable.tsx`. |
| W4 Test + bằng chứng đỏ | 🟠 | 🟠 | 2 test: (a) note rỗng thuần, không chạm DB; (b) chạy thật Postgres trên `POOL-SAFE-03`, khôi phục nguyên trạng trong `finally`. Đỏ 1 lần, lưu `red.txt`/`green.txt`. |
| W5 Kiểm thật + cổng | 🟢 | 🟢 | `tsc`/`build`/test suite/2 script kiểm biên đều 0; curl 200 + có chữ; tắt server; không lưu cookie. |

## Việc KHÔNG làm + lý do

- Không đổi tiêu đề panel thành đúng nguyên văn "Loại khỏi trả lời" ngay từ đầu — bản đầu dùng "Loại mục khỏi câu trả lời", khiến curl SSR lần 1 không khớp chuỗi bắt buộc trong W5 (nút "Loại khỏi trả lời" chỉ hiện SAU khi chọn tài liệu, là trạng thái client, không có trong HTML SSR ban đầu). Đã sửa `<h2>`/mô tả trong `SectionsPanel.tsx` để chuỗi xuất hiện tĩnh ngay ở SSR, chạy lại toàn bộ cổng (tsc/build/test/2 script biên) — vẫn 0/0/253-0-0. Đây là sửa NẰM TRONG phạm vi `SectionsPanel.tsx` đã được cấp, không phải việc ngoài phạm vi.
- Không đụng `db/**`, `lib/pipeline/**`, `planning/**/specs/**`, `brain4agent/**`, `package.json` — đúng vùng cấm handoff, không có việc phát sinh cần chạm các thư mục này.
- Không chạy P03-M1..M8 (số đo nghiệm thu toàn gói P03 trong SPEC) — ngoài "xong khi" của handoff H26, chỉ giao đúng lỗ hổng UI của `setSectionExcluded`.
- Không cập nhật `brain4agent/` (index.md, roadmap.md, ...) — handoff H26 không giao việc này trong phạm vi, và report/plan.md của kế hoạch mẹ là nơi tổng hợp trạng thái package P03 sau khi người duyệt xác nhận.

## Câu hỏi cần người

Không có — SPEC và handoff đủ để thi công, không có mâu thuẫn hay quyết định ngoài văn bản cần hỏi lại.

## Tiếp theo

🖐 Cần tay người: đọc lại nội dung `SectionsPanel.tsx` (chỗ đổi chữ tiêu đề so với W3 gốc) và duyệt; nếu đồng ý thì tự stage/commit theo AGENTS.md §5.D (worker này KHÔNG được commit).
🤖 Agent làm được ngay: chờ lệnh kế tiếp (vd chạy thẩm định đối kháng, hoặc gói P03 kế tiếp).
⭐ Nên làm trước: cho một agent KHÁC (không thừa kế ngữ cảnh worker này) thẩm định lại đúng handoff H26 trước khi coi P03 là đủ vòng lặp UI — vì report chỉ là số đo tự đo, chưa qua thẩm định đối kháng.
⏸ Chưa làm: chưa đồng bộ `brain4agent/` Ma Trận 6 Điểm cho thay đổi này (index.md/roadmap.md/changelog.md) — nằm ngoài phạm vi handoff H26 (chỉ giao 8 file cụ thể), để người/điều phối quyết định gộp vào lần đồng bộ nào.

✅ ĐẠT: `tsc` 0 · `build` 0 · test 253/253/0 fail/0 skip · adapter boundary 0 · no-confidence-ui 0 · curl `/documents` 200 kèm "Loại khỏi trả lời" · dev server đã tắt · không dữ liệu đổi còn lại trong DB · không cookie trong evidence.

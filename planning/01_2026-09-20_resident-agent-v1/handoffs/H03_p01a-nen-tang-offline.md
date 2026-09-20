# H03 — Bàn giao THI CÔNG gói P01a: nền tảng chạy được KHÔNG CẦN key/tài khoản

**Vai:** bạn là WORKER THI CÔNG của repo này (được ghi file). Bạn cũng là ORCHESTRATOR của chính gói mình — tự xếp tầng từng việc theo `AGENTS.md` §5.K.3.
**Bước 0 bắt buộc:** từ root repo chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`, ghi exit code vào dòng 1 của report. Exit 2 ⇒ DỪNG, hỏi người.
**Thứ tự đọc:** `brain4agent/memory-distill.txt` → `planning/01_2026-09-20_resident-agent-v1/plan.md` §2 → `specs/00-ARCHITECTURE.md` (đặc biệt §1, §9 bảng BB, §10.1) → `specs/01-CONTRACTS.md` §3–§7 → `specs/OPERATIONS.md` §2–§6.

## 1. Bối cảnh

`specs/00-ARCHITECTURE.md` §1 chốt: **P01 không có file SPEC riêng**, hợp đồng nằm trọn trong `01-CONTRACTS.md` §3–§6 và `OPERATIONS.md` §2–§4. Đọc hai file đó.

Gói P00 đã xong và được duyệt: `knowledge/` (19 tài liệu / 98 section), `evals/golden/` (66 case), `scripts/` (3 script kiểm). Bạn **kế thừa, không viết lại**.

**Ràng buộc lớn nhất của gói này:** chủ tịch CHƯA cấp `DATABASE_URL` (Neon), `ANTHROPIC_API_KEY`, tài khoản Vercel. Nên gói này cố tình cắt ra **đúng phần chạy được trên máy trắng**. `OPERATIONS.md` §4 có 10 bước dựng; bạn làm **bước 1 và phần soạn mã của bước 4**, CẤM đụng bước 2/3/5/6/7/10.

Bạn KHÔNG có lịch sử hội thoại — mọi căn cứ lấy từ file trên đĩa. CẤM tham chiếu "phiên trước".

## 2. Phạm vi

**Được tạo / ghi:**
- Khung Next.js + TypeScript strict tại root (app router): `app/`, `lib/`, `components/`, `tsconfig.json`, `next.config.*`, `package.json` (được sửa để thêm dependency + script), `package-lock.json`, `.env.example`
- Route theo đúng sơ đồ `00-ARCHITECTURE.md` §5: `app/(resident)/chat`, `app/(bql)/documents`, `app/(bql)/review`, `app/(bql)/eval`, `app/(bql)/dashboard`. Gói này chỉ cần chúng **tồn tại, build xanh, phân quyền đúng vai** — nội dung để P02/P03/P04 bồi.
- `lib/types/` — kiểu dùng chung theo `01-CONTRACTS.md` §7
- **`lib/adapters/db.ts` — file DUY NHẤT được mở connection (BB-07).** `lib/adapters/anthropic.ts` — file DUY NHẤT được import SDK Anthropic; gói này chỉ dựng khung + chữ ký, **CHƯA gọi mạng**.
- `db/migrations/*.sql` — DDL theo `01-CONTRACTS.md` §2.4, §3, §6. **CẤM tạo `lib/db/`** hay bất kỳ module nào khác mở connection — làm vậy là vi phạm BB-07 ngay từ gói đầu.
- `lib/auth/` — băm `scrypt`, cookie HMAC (`OPERATIONS.md` §4.1)
- `lib/retrieval/` — dựng câu truy vấn lexical theo `01-CONTRACTS.md` §4.2 (**giữ nguyên cờ chuẩn hoá `32`**)
- `scripts/sql.mjs`, `scripts/dump_schema.mjs`, `scripts/seed_users.mjs`, `scripts/seed_knowledge.mjs` (viết mã, KHÔNG chạy)
- `scripts/check_adapter_boundary.sh`, `scripts/check_no_hardcoded_knowledge.sh`, `scripts/check_no_confidence_ui.sh`
- `tests/` + cấu hình test
- `planning/01_2026-09-20_resident-agent-v1/reports/R03_p01a-nen-tang-offline.md`
- `planning/01_2026-09-20_resident-agent-v1/evidence/p01a/*.txt`

**CẤM chạm:** `knowledge/**` · `evals/**` · 3 script P00 sẵn có (`validate_knowledge.mjs`, `validate_golden.mjs`, `report_facility_rules.mjs`) · `specs/**` · `plan.md` · `brain4agent/**` · `docs/**` · `AGENTS.md` · `CLAUDE.md` · `.gitignore`. Thấy SPEC sai ⇒ **báo trong report**, KHÔNG tự sửa.

**CẤM tuyệt đối trong gói này:**
- `git commit`, `git push`, tạo remote.
- Gọi bất kỳ LLM API nào. Tạo tài khoản Neon/Vercel. Chạy `vercel`.
- Chạy bất kỳ lệnh nào cần `DATABASE_URL` (`db:migrate`, `db:seed:*`, `sql.mjs`, `dump_schema.mjs`).
- Tạo file `.env.local` chứa giá trị thật. Chỉ tạo `.env.example` với giá trị rỗng/giả.
- `npm install` từ registry thì **ĐƯỢC** (không phải API key).

## 3. Việc phải làm — "xong khi" là LỆNH + KẾT QUẢ máy đọc được

| WP | Việc | Xong khi (chạy từ root repo, KHÔNG cần biến môi trường nào) |
| :-- | :-- | :-- |
| W1 | Khung Next.js + TS **strict** (`OPERATIONS.md` §4 bước 1) | `npx tsc --noEmit` **exit 0** |
| W2 | `npm run build` chạy lọt mà không cần DB — mọi route chạm DB phải là dynamic, CẤM prerender lúc build | `npm run build` **exit 0** |
| W3 | Kiểu dùng chung theo `01-CONTRACTS.md` §7 + enum 15 mã `reason_code` §2.4 | đã tính trong W1; thêm `npm test` có ca khẳng định enum đúng **15** phần tử, **exit 0** |
| W4 | DDL migration theo `01-CONTRACTS.md` §2.4/§3/§6 (**soạn mã, KHÔNG chạy**) | `node --check` sạch + `npm test` có ca đọc file `.sql` và khẳng định đủ bảng `documents`/`sections`/`chunks`/`users`/`conversations`/`messages`/`answer_turns`/`review_queue`, **exit 0** |
| W5 | Auth: băm `scrypt`, cookie HMAC ký bằng `SESSION_SECRET` (`OPERATIONS.md` §4.1) | `npm test` — băm rồi verify đúng/sai, cookie bị sửa 1 byte ⇒ verify **false**, **exit 0** |
| W6 | Dựng câu truy vấn lexical `01-CONTRACTS.md` §4.2 | `npm test` khẳng định chuỗi SQL sinh ra **có `ts_rank_cd(..., 32)`**, **exit 0** |
| W7 | BB-07 — mọi lối ra ngoài qua `lib/adapters/` | `bash scripts/check_adapter_boundary.sh` in `violations: 0`, **exit 0** |
| W8 | BB-10 — Knowledge Pack là dữ liệu, không hằng số trong code | `bash scripts/check_no_hardcoded_knowledge.sh` in `matches: 0`, **exit 0** |
| W9 | BB-05 — `confidence` không bao giờ ra UI | `bash scripts/check_no_confidence_ui.sh` in `matches: 0`, **exit 0** |
| W10 | Không phá P00 | `node scripts/validate_knowledge.mjs` và `node scripts/validate_golden.mjs` vẫn **exit 0** |

**Bộ đo MỚI phải từng ĐỎ (Luật K.5):** với W7, W8, W9 — mỗi script, tự tay tạo một vi phạm giả, chạy script, chép output ĐỎ + exit code vào evidence, rồi gỡ vi phạm và chạy lại cho xanh. Script chưa bao giờ đỏ là script chưa chứng minh được gì.

**Ngoài phạm vi, KHÔNG làm và ghi vào report:** `OPERATIONS.md` §4 bước 2, 3, 5, 6, 7, 10 (cần Neon/Vercel); mọi thứ thuộc P02 (3 agent, pipeline, gọi model); giao diện hoàn thiện — chỉ cần đủ để 2 vai đăng nhập và build xanh.

## 4. Luật

- `01-CONTRACTS.md` §10 — vùng cấm của contract. Đặc biệt **C-08 CẤM dùng Claude làm embedding** và **cờ `32`** ở §4.2: bỏ cờ này thì `score` không chặn trên và công thức confidence của P02 vô nghĩa.
- `00-ARCHITECTURE.md` §9 — 12 bất biến BB. Gói này đưa **BB-05, BB-07, BB-10** lên xanh; đó là ràng buộc CẤU TRÚC THƯ MỤC, làm sai từ đầu thì P02 phải đập đi.
- `OPERATIONS.md` §3 — bảng biến môi trường. `.env.example` phải liệt kê đủ tên biến, **giá trị để rỗng**. CẤM commit `.env.local`, CẤM in `ANTHROPIC_API_KEY` ra log.
- `OPERATIONS.md` §4.1 — đúng **HAI** tài khoản seed, không hơn (NG-09). Mật khẩu đọc từ biến môi trường, **CẤM hardcode**.
- `AGENTS.md` §5.G — Root Clean: file nháp để trong scratchpad của bạn, không để ngoài root.
- `AGENTS.md` §5.L.4 — kiểm mã thoát trực tiếp, KHÔNG qua `grep`. Chưa chạy được thì nói rõ vì sao; CẤM báo xong khi chưa đo.
- Mọi output lệnh ở §3 lưu nguyên văn vào `evidence/p01a/<ten-lenh>.txt`. **CẤM sửa tay evidence.**

## 5. Tầng model từng WP

| WP | Tầng | Vì sao |
| :-- | :-- | :-- |
| W4, W5 | 🔴 | DDL và ranh giới bảo mật — sai thì mọi gói sau kế thừa cái sai |
| W1, W2, W3, W6, W7, W8, W9 | 🟠 | Có contract rõ + test tự biết đúng/sai |
| W10 | 🟢 | Chạy lại script có sẵn |

Thiếu model đúng tầng ⇒ LÊN một tầng, ghi vào bảng phân công thực tế. Thiếu 🔴 ⇒ dừng hỏi.

## 6. Mẫu report — `reports/R03_p01a-nen-tang-offline.md`

Dòng 1: `Vai · thi công · <họ/model> · Bước 0 exit=<n> · hiểu việc (phạm vi / xong khi / cấm — bằng lời mình)`
Dòng 2–4: `Handoff: H03_p01a-nen-tang-offline` · `Base: <SHA lúc bắt đầu>` · `Head: <SHA hoặc "chưa commit — worker bị cấm commit">`
Thân: từng lệnh §3 + exit code nguyên văn · **bảng 3 phép ĐỎ của W7/W8/W9** · `git status --short` · bảng phân công thực tế (WP → tầng yêu cầu → họ/model đã dùng) · việc KHÔNG làm + lý do · câu hỏi cần người.
Dòng cuối: KHÔNG tự phán quyết. Super Orchestrator sẽ đo lại và ra `✅ DUYỆT` / `🔁 SỬA` / `⛔ DỪNG`.

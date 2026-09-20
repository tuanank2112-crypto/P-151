# H02 — Bàn giao THI CÔNG gói P00: Knowledge Pack mô phỏng + Golden Dataset

**Vai:** bạn là WORKER THI CÔNG của repo này (được ghi file). Bạn cũng là ORCHESTRATOR của chính gói mình — tự xếp tầng từng việc theo `AGENTS.md` §5.K.3.
**Bước 0 bắt buộc:** từ root repo chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`, ghi exit code vào dòng 1 của report. Exit 2 ⇒ DỪNG, hỏi người.
**Thứ tự đọc:** `brain4agent/memory-distill.txt` → `planning/01_2026-09-20_resident-agent-v1/plan.md` §2 → `specs/00-ARCHITECTURE.md` → `specs/SPEC-P00-Knowledge-Golden.md` (SPEC chính của bạn) → `specs/01-CONTRACTS.md` §3–§5 → `specs/TESTING-ACCEPTANCE.md` §3.1.

## 1. Bối cảnh

Sản phẩm demo mô phỏng chấm theo rubric `C104/VHR-01/G104`, deadline **2026-09-27**. Repo **chưa có một dòng mã sản phẩm nào** — bạn là người đầu tiên tạo file ngoài `brain4agent/`, `docs/`, `planning/`. Gói P00 là **đường găng** (Đ04): P01 cần schema của nó, P02/P04 cần Golden của nó.

Bạn KHÔNG có lịch sử hội thoại — mọi căn cứ phải lấy từ file trên đĩa. CẤM tham chiếu "phiên trước", "như đã bàn".

## 2. Phạm vi

**Được tạo / ghi** (và chỉ những đường dẫn này):
- `knowledge/manifest.json`, `knowledge/sections/<document_id>.json`, `knowledge/README.md`
- `evals/golden/golden_faq.jsonl`, `evals/golden/golden_safety.jsonl`, `evals/golden/expected_defects.json`
- *(sửa 2026-09-20 sau R02: bản đầu ghi nhầm `knowledge/expected_defects.json` và `golden/*.jsonl`, lệch `SPEC-P00` §2 và làm W5 đỏ. Lỗi của SO, không phải worker.)*
- `scripts/validate_knowledge.mjs`, `scripts/validate_golden.mjs`, `scripts/report_facility_rules.mjs`
- `package.json` (chỉ để khai `"type": "module"` + script chạy; CHƯA thêm dependency nào)
- `planning/01_2026-09-20_resident-agent-v1/reports/R02_p00-knowledge-golden.md`
- `planning/01_2026-09-20_resident-agent-v1/evidence/p00/*.txt`

**CẤM chạm:** mọi file trong `specs/` · `plan.md` · `brain4agent/**` · `docs/**` · `AGENTS.md` · `CLAUDE.md` · `.gitignore`. Thấy SPEC sai thì **báo trong report**, KHÔNG tự sửa.
**CẤM:** `git commit`, `git push`, tạo remote, cài package qua mạng, gọi bất kỳ LLM API nào.

## 3. Việc phải làm — "xong khi" là LỆNH + KẾT QUẢ máy đọc được

| WP | Việc | Xong khi (chạy từ root repo) |
| :-- | :-- | :-- |
| W1 | 19 tài liệu theo `SPEC-P00` §2, §3.1–§3.3; tuyên bố mô phỏng §1 in ở đầu MỌI tài liệu và vào `source_note_vi` | `node scripts/validate_knowledge.mjs` in `documents: 19 · sections: >=97 · defects_ok: 4/4`, **exit 0** |
| W2 | 4 khuyết tật cài sẵn đúng `SPEC-P00` §5.1–§5.4 + `expected_defects.json` đúng lược đồ §5.5 | đã tính trong exit 0 của W1 (`defects_ok: 4/4`) |
| W3 | 12 `facility_id` §3.4 + bảng `has_authoritative_rules` §4 | `node scripts/report_facility_rules.mjs` in `has_authoritative_rules true: 13 · false: 1 (FAC-PICKLEBALL)`, **exit 0** |
| W4 | Golden 50 FAQ + 16 Safety theo §6.1–§6.4, lược đồ §6.2/§6.3, rubric §6.5 | `node scripts/validate_golden.mjs` in `faq: 50 (answerable 40) · safety: 16 · canonical_codes_covered: 10/10`, **exit 0** |
| W5 | Kiểm khuyết tật #1 còn nguyên | `grep -ril "pickleball" knowledge/ \| grep -v README` ⇒ **không in gì** |

Ba script kiểm phải ném đúng các lỗi ở `SPEC-P00` §8 (tên class/thông điệp đúng như bảng đó). Mã nguồn tham chiếu và output mẫu: `specs/TESTING-ACCEPTANCE.md` §3.1 — đọc trước khi tự viết lại.

**Ngoài phạm vi, KHÔNG làm:** K-M5 (`npm run db:seed`) vì chưa có `DATABASE_URL` Neon; K-M6 (`probe_defects.mjs`) vì cần P02. Ghi cả hai vào mục "việc KHÔNG làm" của report.

## 4. Luật

- `SPEC-P00` §7 — 8 vùng cấm P00-C1…P00-C8. Đặc biệt **P00-C6: CẤM sinh Knowledge Pack bằng LLM rồi dùng luôn không đọc lại**; khuyết tật phải cài CHÍNH XÁC, mô hình sẽ "giúp" lấp đầy khoảng trống và giết cả gói.
- `SPEC-P00` §5.5 — `expected_defects.json` là hợp đồng máy đọc, sai một trường là P02 không chứng minh được gì.
- `AGENTS.md` §5.G — Root Clean: CẤM file nháp ngoài root. Tạm thì để trong scratchpad của bạn.
- `AGENTS.md` §5.L.4 — kiểm mã thoát trực tiếp, KHÔNG qua `grep`. Chưa chạy được lệnh thì nói rõ vì sao, CẤM báo xong khi chưa đo.
- Mọi output lệnh ở §3 lưu nguyên văn vào `evidence/p00/<ten-lenh>.txt`. **CẤM sửa tay file evidence.**

## 5. Tầng model từng WP

| WP | Tầng | Vì sao |
| :-- | :-- | :-- |
| W1, W2 | 🔴 | Khuyết tật cài sẵn là thiết kế, không phải chép mẫu — sai là hỏng cả P02/P04 |
| W3, W5 | 🟢 | Có bảng sẵn ở §3.4/§4, chép theo |
| W4 | 🟠 | Có spec + script tự biết đúng/sai |

Thiếu model đúng tầng ⇒ LÊN một tầng, ghi vào bảng phân công thực tế. Thiếu 🔴 ⇒ dừng hỏi.

## 6. Mẫu report — `reports/R02_p00-knowledge-golden.md`

Dòng 1: `Vai · thi công · <họ/model> · Bước 0 exit=<n> · hiểu việc (phạm vi / xong khi / cấm — bằng lời mình)`
Dòng 2–4: `Handoff: H02_p00-knowledge-golden` · `Base: <SHA lúc bắt đầu>` · `Head: <SHA hoặc "chưa commit — worker bị cấm commit">`
Thân: từng lệnh §3 + exit code nguyên văn · `git diff --stat` (hoặc `git status --short` nếu file mới) · bảng phân công thực tế (WP → tầng yêu cầu → họ/model đã dùng) · việc KHÔNG làm + lý do · câu hỏi cần người.
Dòng cuối: KHÔNG tự phán quyết. Super Orchestrator sẽ đo lại và ra `✅ DUYỆT` / `🔁 SỬA` / `⛔ DỪNG`.

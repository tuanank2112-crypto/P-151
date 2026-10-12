Vai · thi công · GPT-6.1 Codex · Bước 0 exit 1 · auth/read dùng Python, ID string, không DB fallback hoặc sửa Python/.env.
Handoff: ../handoffs/H01_auth-data.md
Base: 2ced2656c66ceb6cdc44790a91f676ab1b8d710d
Head: 2ced2656c66ceb6cdc44790a91f676ab1b8d710d (working tree, chưa commit)

| Lệnh | Exit | Số đo / evidence |
|---|---:|---|
| node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check | 1 | auth-data/boot.txt; MODULE_NOT_FOUND |
| npm.cmd run typecheck | 0 | auth-data/typecheck.txt |
| npm.cmd exec -- eslint [10 file WP1] | 0 | auth-data/lint.txt; 0 warning |
| npm.cmd test -- --reporter=dot | 0 | auth-data/unit-final.txt; 60 pass / 0 fail / 0 skip, 8 files (các WP chạy chung) |
| Mutation: bỏ X-Actor-Id filtering; npm.cmd test -- --reporter=dot | 1 | auth-data/mutation-header.txt; WP1 spoof header đỏ. Đồng thời WP2 mutation complete đang hoạt động: thêm một test đỏ. Đã khôi phục rồi đo final xanh. |
| git diff --stat -- [7 tracked file WP1] | 0 | auth-data/diffstat.txt; 7 files, 66 insertions, 464 deletions |
| git rev-parse HEAD | 0 | auth-data/head.txt |

Phân công thực tế: WP1 → 🟠 → GPT-6.1 Codex; contract theo SPEC, không đổi API.
Files mới: backend-client.ts, backend-dto.ts, legacy-queries.ts, unit/backend-client.test.ts (16 ca).
Files bổ sung được root giao: act.ts vô hiệu hóa DB legacy; db/queries.test.ts import legacy-queries.
Chưa đo: PostgreSQL legacy test, Docker, điện thoại, browser (root WP3/WP4), G0 không đạt do thiếu hub.
Không làm: commit/push, .env, Python API/engine, shared DB writes.
Câu hỏi cần người: không có.
✅ DUYỆT

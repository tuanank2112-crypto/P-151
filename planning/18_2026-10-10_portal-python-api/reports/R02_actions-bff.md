Vai worker · THI CÔNG · GPT-6 Sol · Bước 0 exit1 · hiểu việc: actions/BFF/portal Docker theo Python, không sửa Python/session/UI/DB.
Handoff: ../handoffs/H02_actions-bff.md
Base: 2ced2656c66ceb6cdc44790a91f676ab1b8d710d
Head: 2ced2656c66ceb6cdc44790a91f676ab1b8d710d (uncommitted)

## Số đo
- `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`: exit1 MODULE_NOT_FOUND; hub không tồn tại.
- `npm.cmd test`: exit0, 49 pass/0 fail/0 skip, 7 files. WP2 thêm17 phép đo (mapping6, serveractions6, photo5); WP1 tăng16 đồng thời; legacy17 giữ nguyên. Raw: [restored-green.txt](../evidence/actions-bff/restored-green.txt).
- Mutant bỏ role guard: exit1; [role-guard-red.txt](../evidence/actions-bff/role-guard-red.txt).
- Mutant bỏ complete business gate: exit1; [complete-gate-red.txt](../evidence/actions-bff/complete-gate-red.txt).
- Mutant bỏ resident internal photo denial: exit1; [photo-guard-red.txt](../evidence/actions-bff/photo-guard-red.txt).
- Sau3 mutant: source khôi phục finally, test49 xanh. Hash: [file-hashes.txt](../evidence/actions-bff/file-hashes.txt).
- ESLint scoped actions/BFF/tests: exit0; [lint.txt](../evidence/actions-bff/lint.txt).
- `git diff --check`: exit0; [diff-check.txt](../evidence/actions-bff/diff-check.txt).
- `git diff --stat`: [diff-stat.txt](../evidence/actions-bff/diff-stat.txt) chứa cả thay đổi đồng thời WP1/UI; untracked file không trong stat. HEAD: [head.txt](../evidence/actions-bff/head.txt).

## Phân công thực tế
- WP2 action allowlist, complete business gate, photo authentication: 🟠 → GPT-6 Sol.
- WP3 Docker/env (không migrate/seed/DATABASE_URL, giữ db/volume): 🟠 → GPT-6 Sol.
- Hồ sơ: 🟢 → GPT-6 Sol (không có worker tầng thấp trong gói).

## Chưa làm
- Docker runtime/build: docker CLI không có trong PATH; root giữ gate ⬜.
- Full typecheck/build/browser/Python: root đo sau tích hợp UI, không dùng unit mocked adapter làm bằng chứng engine thật.
- Không chạm .env thật, DB/volume, Python, session/client/queries, UI; không commit/push/deploy.
- Legacy server/act.ts do WP1/root xử lý để tách numeric actor khỏi session Python.

## Bổ sung giảm dữ liệu truyền tới trình duyệt
- `lib/case-view.ts`: allowlist presentation Case, không truyền resident_id/audit/actor/prompt; resident safe view giữ nguyên; stock affected Cases được chiếu từng phần tử.
- Tất cả detail/action/upload/receive đi qua projection trong execute(), kể cả Case ở READINESS_FAILED.
- Thêm5 phép đo (pure3, action/upload/stock2); `npm.cmd test` exit0; số đo toàn bộ tại [projection-green.txt](../evidence/actions-bff/projection-green.txt), chứa cả test đồng thời do root/WP1 bổ sung.
- ESLint projection/actions/tests exit0: [projection-lint.txt](../evidence/actions-bff/projection-lint.txt).

✅ DUYỆT gói scoped unit/actions/BFF/config; gate runtime toàn kế hoạch do root đo riêng.

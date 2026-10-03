Worker · thi công · Sonnet · Bước 0 exit 1 (MODULE_NOT_FOUND, hub `../brain4agent.release` thiếu, không sửa managed rules) · hiểu việc: phạm vi chỉ ghi D3-02.json + evidence/d3-02 + R07; xong khi 3 record có input/expected/actual/evidence, JSON hợp lệ, evidence_refs tồn tại; cấm sửa src/tests/seed/config/.env/plan/brain/docs, cấm DB chung/reset/deploy/commit/stash, đổi oracle.
Handoff: ../handoffs/H07_day03-asset.md
Base: 0ea04adedd023654947e2e97e645043f0ba89159
Head: 0ea04adedd023654947e2e97e645043f0ba89159 (working tree, không commit)

Branch `feature/truong`; môi trường local, đồng hồ máy 2026-10-03T11:06:01+07:00 (evidence/d3-02/git-head.txt). Env ép trong lệnh: MO_STORE=memory, LLM_MODE=mock, MO_PHOTO_STORE=local, APP_ENV=development, MO_ALLOW_RESET=false; uvicorn 127.0.0.1:8162, mỗi ca một process mới. Cấu hình hiệu lực (get_settings) + `/health` 200 env=development được ghi đầu mỗi file evidence TRƯỚC mutation; startup log "MO_STORE=memory" ở `*-server.txt`. `/health` chỉ trả `env`, nên store/llm xác nhận bằng get_settings dưới cùng env ép + log khởi động.

## Lệnh + exit
- Bước 0 `init_brain.js --check`: exit 1 → [step0-bootstrap.txt](../evidence/d3-02/step0-bootstrap.txt), [step0-exit.txt](../evidence/d3-02/step0-exit.txt)
- Runner (3 process uvicorn lần lượt, login qa01/bptn01/kythuat01): exit 0 → [runner-exit.txt](../evidence/d3-02/runner-exit.txt), [runner-stdout.txt](../evidence/d3-02/runner-stdout.txt)
- Process uvicorn dừng bằng terminate (exit 1 kiểu Windows), cổng 8162 không còn LISTEN (ghi trong `# ... stop` ở asset-*.txt).
- JSON `python -c json.load` exit 0 → [json-validate-exit.txt](../evidence/d3-02/json-validate-exit.txt)
- Kết quả: [D3-02.json](../deliverables/parts/D3-02.json); evidence: [asset-01-02.txt](../evidence/d3-02/asset-01-02.txt), [asset-03-positive.txt](../evidence/d3-02/asset-03-positive.txt), [asset-03-negative.txt](../evidence/d3-02/asset-03-negative.txt)

## Kết quả: tổng 3 · PASS 3 · FAIL 0 · BLOCKED 0
| Record | Actual (rút gọn, chi tiết trong evidence) | Kết quả |
| --- | --- | --- |
| ASSET-01 (SIM-TKT-TEC-001) | 200; ROUTED, blocker null, DEPT_TECHNICAL, assignee null, asset `SIM-ASSET-LIGHT-001` (proposal + draft, MATCHED) | PASS |
| ASSET-02 (SIM-TKT-TEC-002) | 200; VERIFYING/ASSET_UNCLEAR, department/draft null; accept bởi kythuat01 → 409 INVALID_TRANSITION, bởi bptn01 → 403 ACTION_DENIED; trạng thái không đổi | PASS |
| ASSET-03 dương (§3.2.2) | 200; ROUTED/null, DEPT_TECHNICAL, flag ASSET_CHECK_ONSITE (ticket + draft), asset_resolution ONSITE_BY_BPTN, draft.asset_id null | PASS |
| ASSET-03 âm (§3.2.3, process độc lập) | thiếu note → 409 GUARD_FAILED; giữ VERIFYING/ASSET_UNCLEAR, không draft, không audit BPTN_RESOLVE | PASS |

## git diff --stat + SHA
`git diff --stat` rỗng (mọi file của tôi là untracked mới, trong phạm vi §2): `deliverables/parts/D3-02.json`, `evidence/d3-02/*` (12 file), `reports/R07_day03-asset.md`. SHA = Base = Head = 0ea04adedd023654947e2e97e645043f0ba89159. Không sửa file nào khác; script runner đặt ở scratchpad ngoài repo.

## Bảng phân công
| Gói | Tầng yêu cầu | Họ/model đã dùng |
| --- | --- | --- |
| D3-02 asset (đọc code, chạy 3 ca, ghi record + report) | 🟠 | Sonnet (không phóng thêm agent) |

## Việc KHÔNG làm + lý do
- Không sửa `src/`, seed, config, catalog; không chạy reset/Postgres/Supabase/deploy; không commit/push/stash (§2).
- Không kiểm UI hay quyền bằng nút ẩn: chỉ đo API (UI chưa đo).
- Không sửa Bước 0 / hub (BOOT_HUB_MISSING); brain không được coi là compliant.

## Câu hỏi cần người
1. SPEC-P06 §3 D3-02 ghi ASSET-03 là "BPTN bổ sung asset hợp lệ", còn OPERATIONS §3.2.2 là `asset_onsite=true` + note (không bịa asset). Đã dùng OPERATIONS làm expected, không đổi oracle; Trường/root quyết có cần thêm ca "BPTN chọn `asset_id` có thật trong catalog" hay sửa câu chữ SPEC.
2. Quan sát (không FAIL): `ticket.locked_fields.asset_id` ở ASSET-01 là null; asset nằm ở `proposal.asset_id`/`draft.asset_id`. Oracle OPERATIONS không nói rõ trường; root xác nhận đây là cách đọc đúng.
3. ASSET-02 accept bởi đúng department trả 409 (INVALID_TRANSITION), bởi BPTN trả 403; cả hai đều "bị từ chối, status không đổi" nên PASS.
4. Bước 0 vẫn exit 1: hub `brain4agent.release` chưa có ở `C:\`; cần người dựng hub rồi chạy lại.

## Root đo lại (2026-10-03)

Root đo lại (2026-10-03): JSON D3-02 hợp lệ, evidence_refs tồn tại, header report đúng, `git diff --stat` rỗng. Chưa chạy lại ca ASSET trong phiên root (DEMO-02 ASSET_UNCLEAR của worker D3-06 cũng PASS nhưng root chỉ đo lại g1r/g4a/g4b, chưa đo lại nhánh này). Lệch SPEC §3 D3-02 'asset hợp lệ' vs OPERATIONS §3.2.2 `asset_onsite` chuyển người quyết; oracle không đổi.

✅ DUYỆT (D3-02: 3 PASS trên local cô lập; không khẳng định runtime/online)

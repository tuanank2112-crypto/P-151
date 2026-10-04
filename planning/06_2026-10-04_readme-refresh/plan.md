# README refresh — setup, env vars, sample queries

- Status: ✅ LOCAL_DELIVERED (2026-10-04); Docker chưa kiểm được (⬜ docker), kiểm bằng uvicorn. Loại: PATCH (docs-only).
- Owner: Trường; audience: giảng viên chấm.
- Created: 2026-10-04; branch: feature/truong; base: b937956.
- Scope: chỉ sửa `README.md`; KHÔNG đổi code, KHÔNG bump version.
- Boot: hub check exit 1 (MODULE_NOT_FOUND `../brain4agent.release`), không đụng luật do engine quản lý.

## Nhật ký quyết định
- 2026-10-04 — Người đọc chính = giảng viên chấm. Giữ tiếng Việt.
- 2026-10-04 — Phần API mô tả code ĐANG CHẠY (không theo CR-03 đích); lệch CR-03 thì có một dòng trỏ sang `docs/CR-BPTN-03.md`.
- 2026-10-04 — Đường chạy chính = Docker + `MO_STORE=memory` (không cần khoá). Supabase (`MO_STORE=postgres`) là mục tuỳ chọn. Hạ tầng online hiện chỉ có Supabase, không có Render/URL live → không ghi URL.
- 2026-10-04 — Sample queries = cả hai loại: câu phản ánh mẫu (từ `seed/maintenance_v1/tickets.yaml`) + chuỗi curl cho một câu.
- 2026-10-04 — Người dùng chốt mọi đề xuất của agent: rút gọn mục hook log AI còn 1 đoạn; xoá mục "Chạy server" sai; Team điền thật.
- 2026-10-04 — Team: Lê Thị Châm Anh, MSSV 2A202602846 (vai trò: Trưởng nhóm theo ghi nhận D-08). Các thành viên khác CHƯA cung cấp.

### Quyết định bị thay thế
- Không có.

## Router SPEC
- [SPEC-P01-README.md](specs/SPEC-P01-README.md): cấu trúc, nội dung từng mục, vùng cấm, nghiệm thu.

## Checklist (Tier 🟢 Xanh — viết docs)
- [x] Duyệt spec
- [x] Viết lại README theo SPEC-P01
- [x] Chạy thật từng lệnh/curl trong README (A1–A6 của SPEC), lưu output vào `evidence/`
- [x] `ruff`/`pytest` không bị ảnh hưởng (docs-only, chỉ xác nhận `git diff --stat` = README.md)
- [x] Đồng bộ não: `roadmap.md`, `changelog.md`, `memory/hot/today.md` (không bump version)

## Documentation correction — 2026-10-04T19:41:03+07:00
- User authorized README + diagrams correction; Team deferred to user. Scope extends to docs/architecture_diagram.md and existing diagram artifacts; no runtime code/config changes.
- Supersedes target-only architecture descriptions for submission: current implementation view + explicit pending targets. Existing package05/08 design decisions are historical for replaced artifacts.
- [x] Fix broken links, clone URL, dynamic ticket ID and port semantics.
- [x] Synchronize SVG/draw.io/Mermaid and architecture docs (safety-first, step5, REWORK, every-mutation persistence).
- [ ] Docker/runtime re-verification (unavailable Python/Docker).
- [ ] Browser render verification (file protocol rejected).
- Static gate evidence: evidence/readme/correction-checks.txt. Status: docs corrected; runtime/visual gates remain open.

- [x] Static checks: 34 links inspected, 0 failures; components 8 edges / flow 18 edges across formats; XML 5/5; kernel 62 lines; git diff --check exit 0. Evidence: evidence/readme/correction-checks.txt.

## Superseding decision — 2026-10-04T21:08:19+07:00
- User requested restoration of original layouts. Restored components from Downloads, data-flow from VS Code history; keep setup/link fixes. Earlier implementation-view replacement is superseded.
- [x] Restore original artifacts and embedded components source.
- [x] Move current-vs-target caveats to documentation; preserve Team.
- Evidence: evidence/readme/layout-restoration-checks.txt. No new runtime/render acceptance claimed.

## Isolated develop integration — 2026-10-04
- User authorized safe integration while preserving develop and feature/truong. Snapshot backup/truong-local-20261004 (5f7c354); merge origin/develop 37a0fb3 only on integration/truong-develop-20261004 in a separate worktree.
- [x] Snapshot 12 modified + 103 untracked paths with a temporary Git index; original index unchanged.
- [x] Resolve changelog/today/roadmap conflicts, retaining both local and incoming content.
- [x] Run pytest/ruff plus structural preservation checks: 1843 pass / 0 fail / 0 skip / 29 pg deselected; ruff check/format exit0; 4 README queries, evaluate12/12.
- [x] Verify protected refs/index and 872 original file hashes unchanged; finalize isolated merge commit only on integration branch.
- No push, rebase, checkout, reset or stash in original worktree. Runtime code must equal develop; diagrams must equal snapshot.

- Verified at 2026-10-04T22:01:39+07:00; original branch/head/index/files preserved. Concurrent docs/submission/ appeared during execution and was not touched or included.
- Open environment gates: PostgreSQL/Docker not run; mypy unavailable. Incoming develop machine evidence/patch has pre-existing trailing whitespace; local documentation diff check exit0, preserved incoming evidence unchanged.

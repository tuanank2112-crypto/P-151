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

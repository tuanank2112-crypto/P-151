# 13 — Hotfix: lý do bắt buộc ở form BPTN trên web (2026-10-09)

| Trường | Giá trị |
|---|---|
| Trạng thái | 🟡 local ✅ (harness W1–W6 + 2 phép phá), server ⬜ (chưa dựng lại `:8000`) — 2026-10-09; chưa commit |
| Loại | PATCH (sửa lỗi UI, ≤1 ngày công, AGENTS §3.2.5) — chỉ `plan.md`, không bộ SPEC → v1.8.1 |
| Yêu cầu | Người dùng, 2026-10-09: "Sửa form BPTN trên web (src/web/app.js bptnForm): ô lý do phải bắt buộc khi BPTN chọn/sửa giá trị (engine trả 409 GUARD_FAILED), như app điện thoại đã làm — hotfix PATCH." |
| Nhánh | `feature/chamanh` (sau `e546262`) |
| Phạm vi | `src/web/app.js` (`bptnForm`), `src/web/index.html` (`?v=4.1`), hồ sơ này, `docs/web.md` §5, não, version |
| CẤM chạm | engine/API (luật lý do đã đúng ở server), `src/mobile/`, `portal/` (trừ `version`) |

## §1. Nhật ký quyết định
| # | Mốc | Quyết định | Lý do · chỗ lật |
|---|---|---|---|
| Q01 | 2026-10-09 | Chặn ở client đúng luật engine `bptn_resolve`: có `location`/`info`/`category`/`department`/`asset_id`/`asset_onsite` mà `note` rỗng (sau `trim`) ⇒ toast, KHÔNG gọi API | Chép `VALUE_KEYS` của `src/mobile/js/bptn.js` — một luật cho hai client. Server vẫn là chốt chặn thật |
| Q02 | 2026-10-09 | Gộp vào hotfix: form An toàn Bậc 2 — "Xác nhận an toàn" và "Yêu cầu cư dân bổ sung" bắt buộc lý do (`required` + chặn chỉ khoảng trắng); "Nâng mức" vẫn không bắt buộc | Engine: `safety_confirm_safe` gate `_blank(note)`, `safety_request_info` `note_required=True`, `safety_escalate` `note_required=False`. Web cũ ghi "Ghi chú thêm nếu cần" — cùng loại lỗi, cùng hàm. Lật: bỏ hai dòng `required` |
| Q03 | 2026-10-09 | Nhãn ô đổi từ "Ghi chú" sang "Lý do (bắt buộc)"; PENDING_REVIEW ghi "bắt buộc khi đổi" | Giữ nguyên đề xuất Agent thì không gửi giá trị ⇒ engine không đòi lý do |
| Q04 | 2026-10-09 | Harness Playwright riêng `evidence/harness/` trên backend memory `:8001`, ticket tạo mới (web ẩn ticket mẫu `isSeedTicket`) | Không ghi `:8000` (Supabase chung) |

### Quyết định bị thay thế
- Form web (plan 07 reskin): placeholder "Ghi chú xử lý (không bắt buộc)…" → Q01–Q03.

## §2. Checklist thực thi
- [x] Đối chiếu luật engine (`bptn_resolve`, `safety_*`) với `src/mobile/js/bptn.js`
- [x] Sửa `bptnForm` + tăng `app.js?v=4.1`; `node --check src/web/app.js` exit 0
- [x] Harness `evidence/harness/run_all.sh`: green W1–W6 + JS ALL PASS (`evidence/green.txt`)
- [x] Phép phá a (bỏ chặn giá trị) ⇒ W1, W6 đỏ; b (xác nhận an toàn không bắt buộc) ⇒ W3, W4 đỏ; `app.js` khôi phục từng byte (`evidence/restore.txt`)
- [x] `docs/web.md` §5 + não + version 1.8.1
- [x] pytest 3359 passed exit 0 (lần đầu 2 test thời gian `test_assess_is_linear_*` đỏ do máy tải — chạy riêng 3/3 xanh, chạy lại cả bộ xanh) · ruff 0/0 · `node --check` 0
- [ ] Commit (chờ người dùng gật) · server `:8000` sau khi dựng lại image

## §3. Số đo nghiệm thu
| Đo | Kết quả |
|---|---|
| Harness green | W1–W6 PASS, page errors 0, exit 0 |
| Phép phá a / b | 2 FAIL (W1, W6) / 2 FAIL (W3, W4) — exit 1 cả hai |
| Khôi phục | sha256 `0a358d8c…` trước = sau |

## §4. Exit Gates
| Gate | Local | Server |
|---|---|---|
| G1 lý do trống không tới API (W1, W3, W4, W6) | ✅ | ⬜ |
| G2 có lý do đi qua (W2, W5) | ✅ | ⬜ |
| G3 phép phá đỏ | ✅ | — |

# TESTING-ACCEPTANCE — hồ sơ 11

## 1. Nền
Base: `da1b147` (portal-fe sau khi gộp backend). Python `pytest -q` (venv 3.11, `LLM_MODE=mock`) phải ≥ số trước WP1 + test mới, 0 fail/0 skip; `ruff check src tests` sạch. Portal: `npm run typecheck`, `npm run lint`, `npm run test` EXIT=0.

## 2. Test bắt buộc
| Gói | Test | Phải đỏ trước khi sửa |
|---|---|---|
| WP1 | `tests/test_maintenance/test_portal_backend_ext.py`: tài khoản mới + profile (§1); to-bql/handled/return-to-bptn đủ đường + 403 + 409 + doc đọc được bằng model cũ (§2); vật tư mới: tạo, trùng tên, WAITING_MATERIAL → nhập kho → chạy tiếp, cờ tắt 403 (§3); 2 route sai phòng (§4). Có bản qua API (TestClient) cho mỗi route mới. | có |
| WP2 | `portal/tests/unit/backend-map.test.ts`: bảng status→stage (10 status), `urgent`, `dept`, `location` từ mô tả, `blockerLabel` đủ 16 mã, `failing_items` dịch; `errorFrom` 3 dạng `detail` + 401/403/404/409/422/5xx; chữ ký cookie phiên (hợp lệ, sửa 1 byte ⇒ null, hết hạn ⇒ null). | có |
| WP3–6 | Kiểm thử đầu-cuối `portal/scripts/e2e-backend.mts` (Playwright, backend memory 8001 + portal dev): (a) `cudan` gửi phản ánh có ảnh "Thùng rác tầng 12 đầy tràn…" ⇒ thấy trong danh sách; (b) `vesinh` nhận việc → hoàn thành KHÔNG ảnh bị chặn → có ảnh + checklist ⇒ "Chờ nghiệm thu"; (c) `quanly` bấm ô "Đang xử lý"/"Quá hạn" ⇒ số dòng = số trên ô; nghiệm thu ⇒ "Hoàn thành"; (d) `cudan` đánh giá 5 sao; (e) `cudan` gửi "Hóa đơn phí dịch vụ tính sai" ⇒ `tiepnhan` chuyển BQL ⇒ `quanly` "Đã xử lý xong" ⇒ CLOSED; (f) `kythuat` yêu cầu vật tư có dòng "+ Ống nước PVC 21" ⇒ ticket chờ vật tư ⇒ `kho` nhập đủ ⇒ `kythuat` hoàn thành với checklist vật tư; (g) mọi màn nhân viên bấm mã ⇒ modal KHÔNG có chữ "Agent". Ảnh chụp 1440 + 390 mỗi màn ⇒ evidence. | — |
| Grep | `rg "@/db|server/workflow|server/queries|lib/agent|lib/duplicates" portal/src` = 0 dòng; `rg -i "agent" portal/src/components/ticket-detail-modal.tsx` = 0. | — |

## 3. Bằng chứng (máy sinh, UTF-8, kết `EXIT=`) — `evidence/<WPn>/*.txt`

## 4. Exit Gates
| Gate | local | Supabase demo |
|---|---|---|
| G1 pytest + ruff | ⬜ | — |
| G2 portal typecheck + lint + unit | ⬜ | — |
| G3 e2e (a)–(g) trên backend memory | ⬜ | — |
| G4 R1–R11 tự kiểm bằng ảnh chụp (bảng đối chiếu `evidence/WP6/doc-check.md`) | ⬜ | — |
| G5 thẩm định cô lập (agent khác, chỉ đọc) ✅ | ⬜ | — |
| G6 đọc dữ liệu Supabase qua portal (OPERATIONS §3 bước 2–3, chỉ đọc) | — | ⬜ (chờ người dùng gật) |

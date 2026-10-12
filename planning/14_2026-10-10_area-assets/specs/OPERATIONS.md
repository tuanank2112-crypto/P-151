# OPERATIONS — triển khai, thứ tự, rollback (plan 14)

## §1. Thứ tự bắt buộc
1. Backend (catalog + engine + API) lên TRƯỚC hoặc CÙNG LÚC client. Catalog là file trong image ⇒ dựng lại image backend
   (`docker compose up -d --build backend`, image phải có ghim `sqlalchemy<2.1`).
2. Client: app điện thoại tự lấy vỏ mới nhờ `SHELL_CACHE v7`; web nhờ `app.js?v=4.2`. Client cũ (vỏ v6) gọi `/mo/catalog`
   mới vẫn chạy: nó đọc `a.location` ⇒ nhãn hiện `SIM-ASSET-… — undefined` cho tới khi tải lại — chỉ là chữ, mã gửi đi vẫn đúng.
3. KHÔNG có migration DB: tài sản không lưu trong DB; ticket cũ giữ chuỗi `asset_id` cũ.

## §2. Ticket đang mở trong DB chung lúc deploy
| Trạng thái ticket | Sau deploy |
|---|---|
| `VERIFYING / ASSET_UNCLEAR` (AMBIGUOUS/NOT_FOUND cũ) | Lần resume/chạy lại kế tiếp tra theo khu vực ⇒ nhiều ticket tự khớp và đi tiếp; khu vực ngoài 4 vẫn chờ BPTN |
| Đã có `asset_id` cũ (MATCHED/LOCKED_BY_BPTN) | Giữ nguyên; `LOCKED_BY_BPTN` dùng mã đã khoá, không tra lại |
| BPTN mở form cũ (mã cũ trong dropdown, client chưa tải lại) và gửi | 409 "đang dùng" ⇒ tải lại trang, chọn lại |

## §3. Rollback
`git revert <commit plan 14>` rồi dựng lại backend + tăng lại `?v`/`SHELL_CACHE`. Ticket đã được gán mã khu vực mới
(`SIM-ASSET-LIGHT-HALLWAY`…) sau rollback vẫn hiển thị mã đó (chỉ là chuỗi) nhưng BPTN không chọn lại được ⇒ chấp nhận.

## §4. Chạy & đo local (không đụng DB chung)
```
MO_STORE=memory MO_PHOTO_STORE=local LLM_MODE=mock DATABASE_URL= python -m uvicorn src.main:app --host 127.0.0.1 --port 8001
node planning/14_2026-10-10_area-assets/evidence/harness/picker.mjs http://127.0.0.1:8001 portal planning/14_2026-10-10_area-assets/evidence
python planning/14_2026-10-10_area-assets/evidence/harness/mutate_p14.py
```
picker.mjs tạo ticket mới ⇒ chạy lần 2 trên cùng server thành DUPLICATE: khởi động lại server trước mỗi lần.

# 26 — Token đăng nhập có chữ ký (sửa đăng nhập trên Vercel) (PATCH)

## Metadata
- Trạng thái: ✅ XONG LOCAL 2026-10-15; production: xem Checklist.
- Người yêu cầu: Như Ý ("không thể đăng nhập giao diện bql? … lỗi 503?"), duyệt hướng sửa: "ok".
- Nhánh: `feature/nhuy-reasoning-agent`. Phiên bản: **1.17.2** (PATCH, ≤ 1 ngày ⇒ chỉ `plan.md`, AGENTS §3.2.5).

## Đo trước khi sửa (production 2026-10-15)
- Log backend Vercel (JSON): ngay sau `POST /auth/login` 200, các lời gọi song song của portal trả 200 và **401** xen kẽ ⇒ portal xoá cookie, về `/login`. Playwright tái hiện: vào `/management` ~1 s rồi bị đá về `/login`.
- Nguyên nhân: `src/api/auth.py` giữ phiên trong RAM; Vercel chạy mỗi request đồng thời ở một instance serverless riêng, không chung bộ nhớ.
- 503: 1 lần/3 giờ ở `GET /mo/tickets/SIM-TKT-0049` = `StoreUnavailableError` (backend không tới được Supabase lúc đó) — lỗi đã định nghĩa, thoáng qua; portal hiện mọi 5xx là "Máy chủ trả lỗi 503". Không phải nguyên nhân chặn đăng nhập.

## Nhật ký quyết định
- 2026-10-15 T01 (agent, người dùng "ok"): token = `v1.<base64url(json{u, exp, n})>.<HMAC-SHA256(AUTH_TOKEN_SECRET)>`; hạn theo đồng hồ thật (8 giờ như cũ); không lưu phiên.
- 2026-10-15 T02 (agent): đăng xuất ghi `n` vào danh sách thu hồi CỦA instance nhận lệnh tới khi token hết hạn; instance khác vẫn chấp nhận token tới hạn — chấp nhận cho bản demo (trình duyệt đã xoá token). Bộ đếm khoá sai mật khẩu vẫn theo instance.
- 2026-10-15 T03 (agent): thiếu `AUTH_TOKEN_SECRET` ⇒ khoá ngẫu nhiên theo tiến trình + cảnh báo log (chạy local một tiến trình vẫn đúng). Production BẮT BUỘC đặt biến này.

### Vùng cấm
- Không lưu phiên vào Supabase dùng chung (thêm ghi DB mỗi lần đăng nhập, cần migration/quyền) — token ký đủ cho bản demo.
- Không đổi nơi chạy backend (người dùng: bản demo, không hardening).

## Checklist
- [x] `src/api/auth.py` token ký + `src/config.py` `auth_token_secret`
- [x] Test `tests/test_maintenance/test_auth_tokens.py` (5): hai instance cùng khoá, khoá khác/token sửa/rác bị từ chối, hết hạn theo giờ thật, đăng xuất, API luân phiên hai instance 6/6 = 200
- [x] Phép phá "mỗi instance ký khoá riêng" ⇒ 2 test đỏ (`evidence/mutation.txt`)
- [x] pytest toàn bộ 3689 passed / 0 fail
- [ ] Production: đặt `AUTH_TOKEN_SECRET`, deploy backend, đăng nhập thử mọi vai

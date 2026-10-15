# 26 — Token đăng nhập có chữ ký (sửa đăng nhập trên Vercel) (PATCH)

## Metadata
- Trạng thái: ✅ XONG 2026-10-15 — local + production (12/12 đăng nhập).
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

- 2026-10-15 T04 (agent, sau đo production lần 1: 6/12 lượt đăng nhập treo 60 s ⇒ 500): log Supabase `FATAL (EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15`. Mỗi instance giữ pool (2 + 2/+1) kể cả khi rảnh ⇒ vài instance + máy local của nhóm là hết 15. Thêm `MO_DB_POOL=none` ⇒ `NullPool` cho cả hai engine (mở khi dùng, đóng ngay); Vercel đặt `none`, local giữ `pool`. GIỮ Session pooler 5432 (code cấm 6543 có chủ đích từ hồ sơ lưu trữ — không đổi quyết định đó).

- 2026-10-15 T05 (người dùng "ok chuyển đi"): vùng chạy function của `p151-backend` và `p151-portal` iad1 (Washington) ⇒ **sin1** (Singapore, cùng vùng Supabase `ap-southeast-1`) qua API Vercel `serverlessFunctionRegion`, rồi deploy lại cả hai. Không thêm `vercel.json` vào repo.

- 2026-10-15 T06 (người dùng đưa key OpenAI, "đừng để lộ"): bật Agent LangGraph trên production — env Vercel `LLM_MODE=openai`, `OPENAI_BASE_URL=https://api.openai.com/v1`, `MODEL_NAME=gpt-6-luna`, `MO_AGENT_TIMEOUT_SECONDS=30`, `OPENAI_API_KEY` (KHÔNG ghi vào repo/.env/bộ nhớ). Function timeout mặc định 300 s (fluid). Key vyceai trong `.env` local bị OpenAI trả 401 — không dùng.

### Vùng cấm
- Không lưu phiên vào Supabase dùng chung (thêm ghi DB mỗi lần đăng nhập, cần migration/quyền) — token ký đủ cho bản demo.
- Không đổi nơi chạy backend (người dùng: bản demo, không hardening).

## Checklist
- [x] `src/api/auth.py` token ký + `src/config.py` `auth_token_secret`
- [x] Test `tests/test_maintenance/test_auth_tokens.py` (5): hai instance cùng khoá, khoá khác/token sửa/rác bị từ chối, hết hạn theo giờ thật, đăng xuất, API luân phiên hai instance 6/6 = 200
- [x] Phép phá "mỗi instance ký khoá riêng" ⇒ 2 test đỏ (`evidence/mutation.txt`)
- [x] pytest toàn bộ 3689 passed / 0 fail
- [x] Production lần 1 (chỉ token ký): `evidence/prod-login-check.log` 6/12 — không còn 401, còn 500 do hết kết nối Supabase (T04)
- [x] `MO_DB_POOL=none` + test (NullPool/QueuePool); pytest 3690 passed
- [x] Production lần 2: env `MO_DB_POOL=none` + `AUTH_TOKEN_SECRET`, deploy ⇒ 12/12 PASS (`evidence/prod-login-check-2.log`); log backend 6 phút: 211 × 200, 0 × 401/5xx (`evidence/prod-status-after.txt`)
- [x] Vùng sin1: `x-vercel-id: sin1::…` cả hai; API BQL median 2,42 s ⇒ 0,67 s, đăng nhập 1,07 s ⇒ 0,43 s (`evidence/api-latency.txt`); 6 vai × 2 = 12/12, mỗi lượt ~4,6–5,6 s gồm 4 s chờ cố định (`evidence/prod-login-check-sin1.log`)
- [x] Agent production: chạy thử local `gpt-6-luna` 13/14 (`evidence/live-openai-luna.txt`, 7–11 s/lượt; 1 FAIL = luna đọc "hộp đèn tóe lửa" không có job ⇒ không giữ ticket đèn — quyết định của mô hình); log production `LLM_MODE=openai`; đăng nhập 12/12 (`evidence/prod-login-check-openai.log`). Chưa tạo ticket thử trên production (ghi Supabase chung — chờ người dùng).

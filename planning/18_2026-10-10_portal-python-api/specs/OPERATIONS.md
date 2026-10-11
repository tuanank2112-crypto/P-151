# Vận hành
## §O1. Snapshot và migration
Chụp HEAD/status/hash files runtime bằng máy; .env/key không trong backup/evidence. Không xoá DB/volumes. DB portal cũ được giữ, không import/migrate ticket để tránh nhân đôi và lẫn quyền.
portal Dockerfile CMD chuyển từ migrate/seed/next start sang next start. Runtime compose portal bỏ DATABASE_URL, giữ BACKEND_URL/SESSION_COOKIE_SECURE; backend .env/MO_STORE/LLM_MODE không đổi. Service db vẫn giữ cho test/local, không remove volume.
Không chạy portal db:seed/reset/migrate trong rollout frontend mới. Build không yêu cầu DATABASE_URL; cấm bypass thiếu DB bằng dummyURL để che runtimeimport.

## §O2. Thứ tự triển khai
Sau SPEC duyệt: WP1 data/auth + WP2 UI/actions dựa frozencontracts; WP3 image/tests; root tích hợp và reviewer độc lập. Handoff ≤80dòng, mở3dòngchuẩn và6mục; reports theo H/R cùng đuôi, chưa tạo report giả.
Chạy test local memory riêng, backend LLM_MODE=mock; mock tests không chứng minh LLM thật. Fake server chỉ unit adapter; E2E phải Pythonengine thật. Không ghi Supabase chung.
Rebuild backend+portal chỉ sau kiểm tra; thao tác production/sharedDB cần quyết định rollout người dùng. Không auto commit/push theo xác nhận phiên trước (đó là plan17).
Python-only backend at /app,/ui vẫn chạy nếu portal down. Proxy không loop /api/v1/health/docs.

## §O3. Rollback
Khôi phục snapshot frontend/compose và rebuild portal; DB portal cũ nguyên trạng nên có thể quay lại UI cũ. Không đảo/xoá ticket Python đã ghi sau rollout; người dùng được thông báo rollbackUI không chuyển data qua lại. Xoá cookie session mới để yêu cầu login khi rollback.
Lỗi auth mapping/stale state: dừng rollout; lỗi image/env/boot: gate chưa đạt; thiếu capability: root sửa SPEC, không thêmDBfallback.
Số đo: app/backend healthy khi portaldown; production build/runtime không importDB; compose giữ persistent volumes, không .env/key trong output.

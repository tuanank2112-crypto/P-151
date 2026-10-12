# Vận hành và phối hợp multi-agent

## §O1. Đóng băng nền

- Lệnh baseline đọc `git rev-parse HEAD`, `git status --porcelain`, `git diff --stat`, hash các file runtime/test; stdout lưu evidence bằng script, không sửa tay.
- Root xác nhận cùng working tree v1.9.9 của plan15, không checkout HEAD sạch và bỏ sửa chưa commit. Nếu dùng worktree riêng: materialize tracked diff và file untracked cần thiết từ snapshot, kiểm hash rồi mới chạy.
- `.env`/API key không nằm snapshot/evidence/commit; backend test override memory/mock/local và không dùng DB trong `.env`.
- Bước 0 vẫn phải thử theo AGENTS. Thiếu hub ghi exit thật, không tự sửa vùng managed. Chưa coi boot đạt; root/người dùng cung cấp hub trước sign-off yêu cầu boot.

## §O2. Contract điều phối

Sau duyệt SPEC: H01 tests và H02 backend phối hợp RED trước sửa; H03 clients có thể bắt đầu song song trên contract frozen. Worker tests sở hữu riêng 3 file test mới; backend không sửa test oracle để xanh. Chỉ root tích hợp, cập nhật checklist/spec và xử lý file ngoài scope.
H04 auditor riêng không đọc H01–H03 report hoặc lịch sử worker; chỉ đọc SPEC/baseline/code/evidence máy và tự thiết kế phép phá. Fail hai lần hoặc phép đo mâu thuẫn ⇒ root 🔴 phân xử.
Không spawn triển khai trước duyệt. Không chỉ định họ/model cụ thể; chọn tầng theo AGENTS, thiếu tầng dùng tầng cao hơn, thiếu 🔴 dừng.

## §O3. Rollout/rollback

Backend chứa C2 + mapping lên trước/cùng clients; kiểm code/syntax/test trước build. Lệnh local `docker compose up -d --build --force-recreate backend`, rồi `docker compose ps -a backend`, log và `/health`.
Thao tác test ghi chỉ trên container/server memory riêng (`MO_STORE=memory`, `MO_PHOTO_STORE=local`, `LLM_MODE=mock`, ảnh folder test riêng), không bản :8000 nếu nó nối Supabase chung.
Rollback code toàn bộ backend/client cùng snapshot trước plan16; rebuild; cache bust phải tăng N mới, không giảm về tên SW cũ. Không reset DB/volume. Audit/ticket đã ghi vẫn giữ dạng model cũ nên không migration.
Endpoint cũ không đủ atomic UX; khi thiếu C2/mapping, clients mới disable lưu. Không thêm fallback sequence.

## §O4. Lỗi và caller

| Lỗi | Bắt buộc |
|---|---|
| Snapshot/hash khác | Root dừng dispatch, cập nhật baseline có quyết định timestamp |
| Playwright/browser binary chưa có | Cài dependencies trong môi trường local được phép rồi đo; nếu không làm được giữ gate ⬜ |
| Docker/Postgres unavailable | Không sign-off gate; không chuyển sang Supabase để đo |
| Deploy remote/prod | Cần quyết định người dùng; không push/deploy ngầm |

## §O5. Bằng chứng

Mỗi report `reports/RNN_<suffix>.md` khớp H, dòng 2–4 `Handoff:`, `Base:`, `Head:`. Nếu không có commit mới, Head ghi HEAD + hash working tree, không giả SHA. Evidence `evidence/<wp>/*.txt` chỉ output máy. Dòng cuối report đúng `✅ DUYỆT` / `🔁 SỬA: ...` / `⛔ DỪNG: ...`. Report ghi lệnh/exit/count/diffstat/phân công/thứ chưa làm; không kể chuyện.

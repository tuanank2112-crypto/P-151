# TESTING & ACCEPTANCE — App điện thoại (PWA)

## §1. Test Python (vào `tests/`, chạy trong CI)
`tests/test_maintenance/test_mobile_static.py` — dùng `TestClient(app)` như `test_api.py`:
| Test | Khẳng định |
|---|---|
| `test_app_index_served` | `GET /app/` 200, `text/html`, có `rel="manifest"` |
| `test_manifest_valid` | `GET /app/manifest.json` 200, JSON, `start_url == "/app/"`, `scope == "/app/"`, có icon 192 + 512 và file icon tồn tại (GET 200) |
| `test_sw_served_as_js` | `GET /app/sw.js` 200, content-type chứa `javascript` |
| `test_sw_never_caches_api` | Nội dung `sw.js` chứa nhánh bỏ qua `'/api/'` (đọc file, khớp chuỗi `"/api/"` trong điều kiện `return`) |
| `test_existing_routes_unchanged` | `GET /ui/` 200; `GET /health` 200; `POST /api/v1/auth/login` (`cudan01`) 200 |

## §2. Harness trình duyệt (Playwright, viewport 390×844, backend memory `:8001` MỚI mỗi lần chạy)
Đặt tại `planning/11_2026-10-09_mobile-pwa-app/evidence/harness/` (`mobile.mjs`, `run_all.sh <python> <scratch>`), mẫu theo `planning/10_2026-10-08_list-paging/evidence/harness/`.
Chuẩn bị trạng thái (READY_FOR_REVIEW, khẩn cấp) bằng gọi API trực tiếp với tài khoản phòng ban/QA — cùng endpoint `tests/test_maintenance/test_api.py` dùng.

| # | Kịch bản | Đạt khi (máy đọc được) |
|---|---|---|
| M1 | Đăng nhập `cudan01` ⇒ `#/r` | URL hash `#/r`, thấy tiêu đề "Phản ánh của tôi" |
| M2 | Gửi phản ánh + 2 ảnh 4000×3000 | `GET /resident/tickets` có ticket mới `channel` app; ticket có 2 `photos`; mỗi ảnh lưu ≤ 1600 px cạnh dài và < 5 MB |
| M3 | Bấm "Gửi" 3 lần liên tiếp | Đúng 1 ticket mới (I-5) |
| M4 | Bổ sung thông tin | `additions` tăng 1, hiển thị ngay không cần tải lại |
| M5 | **Đồng bộ web → app**: app mở `#/r/<id>`; phòng ban nhận việc qua API | Badge trên app đổi trong ≤ 35 s, KHÔNG reload trang |
| M6 | Ẩn tab (visibility hidden) 60 s | 0 request `/api/` trong lúc ẩn; hiện lại ⇒ 1 request ngay |
| M7 | Offline (context.setOffline) | Banner hiện, nút ghi `disabled`, không request ghi; online lại ⇒ tải lại |
| M8 | Đánh giá ticket CLOSED | Gửi 1 lần thành công; nút ẩn; lần 2 qua API ⇒ 409 |
| M9 | Đăng nhập `bql01` ⇒ tab "Cần tôi" | Có ticket READY_FOR_REVIEW đã chuẩn bị; không có ticket seed |
| M10 | BQL nghiệm thu + trả làm lại (2 ticket) | Trạng thái server `CLOSED` / `IN_PROGRESS`; thiếu lý do trả làm lại ⇒ không gửi |
| M11 | Ticket khẩn cấp (mô tả "thang máy kẹt người") ⇒ BQL "Báo động giả — hạ mức" | Tab "Khẩn cấp" có ticket; sau hạ mức không còn `EMERGENCY_PENDING_BQL` |
| M12 | Đăng nhập `bptn01` | Màn "Dùng bản web"; 0 request tới `/resident/`, `/bql/`, `/mo/` |
| M13 | 401 giữa chừng (xoá session server bằng `POST /auth/logout` token của app) | Lần tải lại kế tiếp ⇒ về `#/login`, `localStorage['mo-app-token']` trống |

Ảnh chụp mỗi màn ở 390 px ⇒ `evidence/screens/`. Mỗi lần chụp kèm kiểm `TEXT <màn>`: màn không được hiện chữ `null`/`undefined`/`NaN`/`[object …]`
(thêm 2026-10-09 sau khi ảnh lượt đầu lộ "null" ở thanh tiêu đề BQL và "nullnull" ở chi tiết cư dân — `replaceChildren()` của DOM in `null` thành chữ; sửa bằng `fill()` trong `js/ui.js`).

## §3. Phép phá (bộ đo MỚI phải từng ĐỎ — AGENTS K.5)
`evidence/harness/mutate.py` sửa tạm file trong bản sao, chạy harness, khôi phục:
| Phép phá | Kịch bản phải đỏ |
|---|---|
| P-a: `sw.js` bỏ nhánh bỏ qua `/api/` và cache mọi GET | `test_sw_never_caches_api` + M5 (khi SW đăng ký trên localhost) |
| P-b: bỏ khoá nút gửi (I-5) | M3 |
| P-c: tắt vòng tải lại (`REFRESH_MS` = vô hạn) | M5 |
| P-d: thanh tiêu đề dùng lại `bar.replaceChildren(` (Q17) | kiểm TEXT trên màn có thanh tiêu đề |

## §4. Lệnh kiểm bắt buộc trước khi báo xong
```bash
node --check src/mobile/sw.js && for f in src/mobile/js/*.js; do node --check "$f"; done
python -m pytest -q -p no:cacheprovider        # số test KHÔNG giảm so với 3344 (state.json), 0 fail
python -m ruff check src tests && python -m ruff format --check src tests
bash planning/11_2026-10-09_mobile-pwa-app/evidence/harness/run_all.sh <python> <scratch>
```
Output lưu `evidence/*.txt` (máy sinh, CẤM sửa tay).

## §5. Exit Gates
| Gate | Nội dung | Local | Server |
|---|---|---|---|
| G1 | Lệnh §4 exit 0; số test ≥ trước + 5 test mới | ✅ 3349 passed | — |
| G2 | M1–M13 xanh trên `:8001` | ✅ 26/26 | — |
| G3 | 4/4 phép phá đỏ (thêm d-null-text, Q17) | ✅ | — |
| G4 | `git diff --stat` chỉ trong phạm vi plan.md (src/mobile/, 1 dòng src/main.py, test mới, docs, não, version) | ✅ (+2 dòng src/main.py: mount + chú thích) | — |
| G9 | Đợt 2 (SPEC-P04 §10): §4 + M1–M13 + 4 phép phá chạy lại sau khi đổi giao diện; ảnh 390 px có header gradient + tile + thẻ đánh số | ✅ 3349 passed, 26/26, 4/4 đỏ | — |
| G11 | Đợt 3 (SPEC-P05 §7): M12 (`qa01`), M14 phòng ban chụp ảnh → báo hoàn thành, M15 BPTN, M16 kho, M17 cư dân không chip; phép phá `e-no-dept-photo` đỏ | ✅ ALL PASS, 5/5 đỏ | — |
| G10 | Docker `:8000` (Supabase chung) chỉ đọc: `/app/` + css/js/manifest/sw 200, đăng nhập cư dân + `GET /resident/tickets` 200 | — | ✅ local Docker (0,72 s, 50 ticket) |
| G5 | Thử tay trên điện thoại thật qua Wi-Fi (§2 OPERATIONS): gửi phản ánh có ảnh chụp camera | ⬜ | — |
| G6 | `https://<host>/app/` cài được lên màn hình chính (Android Chrome + iPhone Safari) | — | ⬜ |
| G7 | M5 trên server: BQL thao tác trên web máy tính ⇒ app điện thoại cư dân đổi trạng thái ≤ 35 s | — | ⬜ |
| G8 | Thời gian: mở danh sách ≤ 1.5 s trên 4G (đo DevTools "Fast 4G"), gửi phản ánh không ảnh: ghi số thật (gồm LLM) | — | ⬜ |

Kế hoạch chỉ đóng khi G6–G8 ✅ (AGENTS §3.2.4). G8 ghi số đo thật, không ghi "đạt" chung chung.

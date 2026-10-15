# OPERATIONS — Sản xuất, quay LLM thật, dựng lại

## 1. Thứ tự BẮT BUỘC
```text
V2 giọng ──┐
V3 sân khấu ┼─► V5 render + compose ─► V6 bản dọc ─► V7 nghiệm thu
V4 quay UI ─┘   (V4 trước hết phải qua diễn tập R1–R6, §3)
```
V2, V3, V4 chạy song song. V5 chỉ chạy khi cả ba đã có output và `durations.json` khớp `scenes.json` (cùng tập `line.id`).

## 2. Lệnh (chạy từ `portal/`, trừ khi ghi khác)
| Bước | Lệnh | Ra |
|---|---|---|
| Môi trường TTS (một lần) | `python -m venv scripts/product-video/out/venv && scripts/product-video/out/venv/Scripts/python -m pip install edge-tts==7.3.1` | venv nằm trong `out/` (gitignore) |
| V2 giọng | `scripts/product-video/out/venv/Scripts/python scripts/product-video/tts.py` | `out/audio/<line-id>.mp3`, `out/audio/durations.json`; exit 2 nếu một câu hỏng sau 3 lần thử, exit 5 nếu tổng lời > 165 s |
| Backend quay (root repo) | `MO_STORE=memory MO_PHOTO_STORE=local LLM_MODE=agy_cli MODEL_NAME=gemini-3.8-flash-low DATABASE_URL= MO_CUSTOM_MATERIALS=true MO_PORTAL_EXTRAS=true PORTAL_URL=http://127.0.0.1:3000 PYTHONUTF8=1 PYTHONPATH=. .venv/Scripts/python.exe -m uvicorn src.main:app --port 8000` | store bộ nhớ, dữ liệu `SIM-`, KHÔNG chạm Supabase |
| Portal quay | `BACKEND_URL=http://127.0.0.1:8000 npx next build && BACKEND_URL=http://127.0.0.1:8000 SESSION_SECRET=<chuỗi bất kỳ> npx next start --port 3000` | bản production (`next dev` không hydrate qua 8000, docs/portal.md §1) |
| V4 diễn tập | `npx tsx scripts/product-video/record.mts --rehearse` | chỉ gửi phản ánh + đọc kết quả Agent, không quay; in bảng §3.1; exit 9 nếu lệch |
| V4 quay | `npx tsx scripts/product-video/record.mts` | `out/clips/*.webm|json`, `planning/22_…/evidence/V4/*.json` |
| V5 dựng khung | `npx tsx scripts/product-video/render.mts [--scene s07-basement]` | `out/raw/<scene>.mp4` (30 fps) |
| V5 ghép | `npx tsx scripts/product-video/compose.mts` | `docs/demo/product-video.mp4`, `.vi.srt`, `-thumb.png`, `product-video-script.md` |
| V6 bản dọc | `npx tsx scripts/product-video/compose.mts --vertical` | `docs/demo/product-video-vertical.mp4` |

Backend phải khởi động MỚI cho mỗi lần quay (store bộ nhớ sạch, mã ticket đi lại từ đầu, thứ tự ca khẩn cấp đúng).

## 3. Quay với LLM thật
### 3.1 Diễn tập (R1–R6), thứ tự gửi đúng như phim
| Bước | Ai gửi | Câu (nguyên văn) | Kết quả BẮT BUỘC thấy được trên portal |
|---|---|---|---|
| R1 | `cudan` (Tầng của tôi → Hành lang) | `den hanh lang tang 12 tat het roi, toi di lai so lam` | Agent: Tòa S2.05 · Tầng 12 · Hành lang; Đèn → Phòng Kỹ thuật |
| R2 | (đọc) | — | lưu quyết định Agent của R1 ⇒ `evidence/V4/agent-s04.json` (thẻ cảnh 5 đọc từ file này) |
| R3 | `cudan01` | `Đèn hành lang tầng 12 tòa S2.05 tắt hết rồi` | ticket nghi trùng R1; Tiếp nhận thấy nút xác nhận gộp; sau khi gộp ca R1 hiện "2 người cùng báo" |
| R4 | `cudan01` | `Hầm B1 có mùi khét, thấy lóe lửa ở tủ điện chỗ để xe máy, mọi người cẩn thận` | `EMERGENCY_PENDING_BQL`; BQL thấy thẻ đỏ "Khẩn cấp"; app cư dân: "Phản ánh đang được kiểm tra." |
| R5 | `cudan` (sau R4 ≥ 60 s) | `Tủ điện hầm B1 bốc khói, khét lắm` | `EMERGENCY_PENDING_BQL`, "Nghi trùng với ca khẩn cấp <R4> cùng vị trí"; ca R4 "2 người cùng báo" sau khi gộp; bản ghi Agent đọc ca khẩn cấp (hồ sơ 23 P04) có việc điện |
| R6 | `quanly` | gộp R5 vào R4 (ghi chú "Cùng sự cố tủ điện B1-02") → đóng R4 "Kỹ thuật đã ngắt điện tủ B1-02, không cháy lan" | R4 `CLOSED`, kiểu đóng "đã xử lý khẩn cấp" |
| R7 | `cudan01` | `Đèn khu để xe hầm B1 tắt hết, sàn còn nhiều bột trắng và nước, nhờ sửa đèn và dọn giúp` | tách hai ticket: Kỹ thuật (đèn) + Vệ sinh (sàn); hai phòng thấy ở cột Cần nhận |
| R8 | `kythuat` → `quanly` → `cudan` | vòng khép kín ticket R1 (nhận, vật tư, ảnh, hoàn thành, nghiệm thu, 5 sao) | trạng thái cuối "Đã đóng", có đánh giá |

Mỗi bước: `record.mts` đọc kết quả qua API (trạng thái, blocker, phòng, `suspectOf`, `duplicateCount`, ticket con) và so với cột phải. Lệch ⇒ exit 9.

### 3.2 Khi Agent ra khác bảng 3.1
Thứ tự xử lý, KHÔNG nhảy bước:
1. Chạy lại đúng bước đó **một lần** (backend mới). Giống bảng ⇒ dùng.
2. Vẫn lệch ⇒ đổi sang câu thay thế (dưới), chạy lại từ R1. Câu thay thế cũng phải nằm trong lời thoại/hình (sửa `scenes.json`).
3. Hết câu thay thế mà vẫn lệch ⇒ **kể đúng cái đã xảy ra**: sửa lời và hình cảnh đó theo kết quả thật, ghi vào plan.md nhật ký quyết định. CẤM dựng hình giả, CẤM chuyển LLM mock (V04).
4. Lệch do lỗi sản phẩm (vd không đánh dấu nghi trùng dù cùng vị trí) ⇒ dừng, báo người dùng; sửa sản phẩm là hồ sơ riêng.

| Bước | Câu thay thế (theo thứ tự thử) |
|---|---|
| R3 | `Hành lang tầng 12 tòa S2.05 đèn tắt hết, tối quá` |
| R4 | `Tủ điện hầm B1 đang toé lửa, có khói, mùi khét lắm` |
| R5 | `Hầm B1 khói bốc ra từ tủ điện, khét lắm` |
| R7 | `Hầm B1 khu để xe đèn tắt hết, sàn bẩn nhiều bột trắng và nước, cần sửa đèn và dọn sàn` · tách hai câu thành hai phản ánh riêng (cảnh 7.10 đổi lời: "hai phản ánh tới hai phòng") |

### 3.3 Lưu bằng chứng (bất biến B7)
`evidence/V4/` (output máy, CẤM sửa tay): `rehearsal-<yyyymmdd-hhmm>.txt` (bảng 3.1 + kết quả), `agent-<ticket>.json` (bản ghi quyết định Agent qua API), `run.txt` (lệnh, model, phiên bản app, thời gian).

## 4. Dựng lại khi UI đổi (≤ 30 phút)
1. Backend + portal mới → `record.mts --rehearse` → `record.mts`.
2. `render.mts` chỉ cho các cảnh có clip đổi (`--scene`).
3. `compose.mts` + `compose.mts --vertical`.
Selector hỏng ⇒ exit 4 + ảnh `out/fail/`; sửa `record.mts`, không quay tay.

## 5. Rollback
Video là file trong `docs/demo/`; không chạm code sản phẩm, không bump version app. Rollback = `git revert` commit video. Video demo cũ `docs/demo/demo.mp4` không bị đụng.

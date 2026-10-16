# SPEC-P03 — Dựng hình mượt: sân khấu HTML dựng từng khung

Trạng thái: ✅ ĐÃ CHỐT 2026-10-15 (plan.md V03). Nguồn yêu cầu: người dùng "animation mượt, hợp lý".

## 1. Vì sao dựng từng khung (frame-stepped)
| Cách | Kết quả | Quyết định |
|---|---|---|
| Playwright `recordVideo` quay thời gian thực (video cũ) | 25 khung/giây cố định, khung rớt khi máy bận, phóng camera bằng ffmpeg `zoompan` giật vì làm tròn toạ độ nguyên | **CẤM** cho mọi chuyển động camera/animation |
| **Sân khấu HTML dựng từng khung** | Mỗi khung `t = n/30` s: trang tự đặt mọi animation về đúng `t` rồi mới chụp ⇒ 30 khung/giây đều tuyệt đối, không phụ thuộc tốc độ máy | **CHỌN** |
| Remotion | Cùng nguyên lý, mạnh hơn, nhưng thêm phụ thuộc + giấy phép chưa kiểm | Không dùng (SPEC-P02 §4) |

Ước tính: 3:05 × 30 = 5 550 khung, ~0,1–0,2 s/khung ⇒ 10–20 phút một lần dựng (trong mục tiêu ≤ 30 phút, 00-ARCHITECTURE §1.3).

## 2. Contract sân khấu
Mỗi cảnh là một trang `portal/scripts/product-video/scenes/<scene-id>.html`, nạp `scenes/stage.js` chung.

```ts
// stage.js gắn lên window; render.mts chỉ gọi hai hàm này
interface Stage {
  ready(): Promise<void>;                 // font Be Vietnam Pro + ảnh + video nguồn đã nạp xong
  seek(t: number): Promise<void>;         // t giây tính từ đầu cảnh; đặt MỌI chuyển động về đúng t, chờ khung vẽ xong
}
declare global { interface Window { stage: Stage } }
```
**BẮT BUỘC:**
1. Chuyển động viết bằng Web Animations API hoặc CSS animation; `seek` tạm dừng hết (`document.getAnimations()`), đặt `currentTime = t*1000`. CẤM `setTimeout`/`requestAnimationFrame` tự chạy theo đồng hồ thật.
2. Video nguồn của cảnh UI (§4) nhúng bằng `<video>`; `seek` đặt `currentTime` rồi chờ sự kiện `seeked`.
3. Camera (phóng/lia) = `transform: scale() translate()` trên lớp bọc, đường cong `cubic-bezier(0.22, 1, 0.36, 1)` (vào nhanh, dừng êm), phóng tối đa 1.6×, mỗi lần phóng ≥ 600 ms.
4. Chuyển cảnh: mờ dần hoặc trượt ngang 300–400 ms, làm trong `compose.mts` bằng `xfade`, không làm trong trang.
5. Mốc thời gian trong cảnh lấy từ `durations.json` (truyền vào trang qua query `?d=<json>`), không gõ cứng giây.
6. Nhãn cố định: "Dữ liệu mô phỏng" (cảnh UI, B1), "Minh hoạ" (góc 🟥), dải góc 🟥🟦🟩 (cảnh 7), đồng hồ (cảnh 1, 3, 6, 7).

## 3. Cảnh animation (file trong `scenes/`)
| File | Cảnh SPEC-P01 | Nội dung chính |
|---|---|---|
| `s01-chat.html` | 1 | Khung chat chung, bong bóng gõ chữ, dồn nhanh dần; tin căn 1402 viền đỏ trôi khỏi khung |
| `s02-problems.html` | 2 | Ba biểu tượng Trôi / Trùng / Chuyền tay |
| `s03-intro.html` | 3 | Logo vẽ nét, tagline gõ chữ, đồng hồ quay về 21:00 |
| `s05-pipeline.html` | 5 | Dải 7 bước + chấm sáng + thẻ Agent (dữ liệu từ `evidence/V4/agent-s04.json`) + nhúng clip Tiếp nhận |
| `s06-duplicate.html` | 6 | Hai thẻ chồng thành một, huy hiệu 1 → 2, nhúng clip Tiếp nhận |
| `s07-basement.html` | 7 | Ba góc; minh hoạ hầm B1 vẽ bằng SVG phẳng (tủ điện B1-02, xe máy, người dạng tối giản không mặt), khói = SVG blur, tia lửa = hạt; nhúng clip app/portal thật |
| `s10-outro.html` | 10 | Ba dòng chữ, logo, tên nhóm |
| `ui-frame.html` | 4, 8, 9 và các khung trong 5–7 | Khung điện thoại 390×844 hoặc laptop bọc clip UI, con trỏ có vòng sáng khi bấm, camera phóng theo toạ độ bấm ghi trong `clips/<id>.json` |

Minh hoạ người: dáng phẳng, không vẽ mặt chi tiết, không giống người thật nào; màu theo SPEC-P02 §2.

## 4. Cảnh UI: quay clip nguồn thật
- `record.mts` mở portal/app thật (backend local, LLM thật), viewport desktop 1920×1080, điện thoại 390×844 `deviceScaleFactor: 2`; quay `recordVideo` ở **đúng kích thước viewport** cho từng đoạn ngắn (một thao tác).
- Ghi kèm `clips/<id>.json`: mốc giây của từng lần bấm/gõ + hộp toạ độ phần tử ⇒ `ui-frame.html` phóng camera và vẽ con trỏ đúng chỗ, mượt (vì camera nằm ở sân khấu, không ở clip).
- Clip UI chỉ chứa thay đổi của chính giao diện (gõ chữ, danh sách cập nhật); 25 khung/giây của clip là đủ vì giao diện gần như đứng yên; mọi chuyển động lớn do sân khấu vẽ ở 30 khung/giây.
- Gõ chữ: `locator.pressSequentially(text, { delay: 45 })`.

## 5. Nhạc & âm thanh
| Loại | Nguồn | Ghi vào |
|---|---|---|
| Nhạc nền 90–100 BPM, không lời | Pixabay Music, Pixabay Content License | `assets/music.json`: `{title, author, url, license, downloaded_at}` |
| Hiệu ứng: ping, gõ phím, whoosh, chuông nhẹ | Pixabay Sound Effects, cùng giấy phép | cùng file |
Trộn: nhạc hạ 18 dB dưới giọng khi có lời (sidechain `sidechaincompress` hoặc biểu đồ âm lượng theo `durations.json`); cảnh 7 nhạc tắt từ 7.1, còn nhịp trầm; tổng −14 LUFS (01-CONTRACTS §1). File nhạc tải về nằm trong `out/assets/` (không commit nhạc vào git), `music.json` thì commit.

## 6. Vùng cấm
- CẤM `zoompan` của ffmpeg và quay màn hình thời gian thực cho chuyển động camera (giật, §1).
- CẤM vẽ lại portal/app bằng HTML giả trong cảnh UI: chỉ được bọc khung, phóng, vẽ con trỏ lên clip thật (SPEC-P01 cảnh 7, ràng buộc 1).
- CẤM hiệu ứng xoay/lật 3D, chữ bay lòe loẹt (SPEC-P02 §3).
- CẤM nhạc/âm thanh không ghi được giấy phép.

## 7. Bảng lỗi khi dựng
| Lỗi | Hành vi bắt buộc |
|---|---|
| `stage.ready()` quá 30 s (font/ảnh không nạp) | exit 7, nêu tên cảnh; không dựng tiếp với font dự phòng |
| `seek` quá 5 s ở một khung (video nguồn hỏng) | exit 7, nêu cảnh + `t` |
| Số khung ra ≠ `round(độ dài cảnh × 30)` | exit 8 |

# 01 — Contract sản phẩm giao & dữ liệu

## 1. File giao
| File | Thông số BẮT BUỘC |
|---|---|
| `docs/demo/product-video.mp4` | 1920×1080, **30 fps CFR**, H.264 `yuv420p` CRF ≤ 20, AAC 48 kHz stereo 192 kbps; 2:45–3:15; loudness tích hợp **−14 LUFS ±1**, true peak ≤ −1 dBTP |
| `docs/demo/product-video.vi.srt` | Phụ đề tiếng Việt khớp lời, mỗi dòng ≤ 42 ký tự, ≤ 2 dòng, lệch ≤ 200 ms |
| `docs/demo/product-video.en.srt` | Tuỳ chọn (dịch từ `.vi.srt`) |
| `docs/demo/product-video-vertical.mp4` | 1080×1920, 40–50 giây, phụ đề đốt cứng, cùng loudness |
| `docs/demo/product-video-script.md` | Kịch bản cuối cùng sinh từ `scenes.json` (bảng cảnh/lời/hình) |

Ảnh đầu (thumbnail) `docs/demo/product-video-thumb.png` 1280×720.

## 2. Thư mục công cụ
```text
portal/scripts/product-video/
├── scenes.json        # nguồn chân lý lời + cảnh (schema §3)
├── tts.py             # giọng HoaiMy qua edge-tts (SPEC-P02 §1) → out/audio/<line-id>.mp3 + out/audio/durations.json
├── record.mts         # quay clip UI thật, LLM thật (SPEC-P03 §4) → out/clips/<id>.webm + <id>.json; lưu quyết định Agent → evidence/V4/
├── scenes/            # sân khấu: stage.js + một .html mỗi cảnh (SPEC-P03 §2–3)
├── render.mts         # dựng từng khung 30 fps (SPEC-P03 §1) → out/frames/<scene>/%05d.png → out/raw/<scene>.mp4
├── compose.mts        # nối cảnh + xfade + giọng + nhạc + phụ đề + loudnorm → docs/demo/product-video*.mp4
└── assets/music.json  # nguồn + giấy phép nhạc/âm thanh (SPEC-P03 §5)
```
`out/` nằm trong `.gitignore`. Công cụ cũ `portal/scripts/demo-video/` GIỮ NGUYÊN (không sửa, không xoá).

## 3. Schema `scenes.json`
```ts
type Scene = {
  id: string;                 // "s01-hook", duy nhất, a-z0-9-
  kind: "html" | "ui";        // html = cảnh animation, ui = quay portal/app thật
  source: string;             // kind=html: "scenes/s01-hook.html"; kind=ui: tên hàm trong record.mts
  viewport?: "desktop" | "phone";   // ui: desktop 1920×1080 · phone khung điện thoại 390×844 đặt giữa nền
  lines: Line[];
  minSeconds?: number;        // giữ hình tối thiểu dù lời ngắn hơn
  caption?: string;           // chữ lớn trên màn hình (≤ 8 từ)
  angle?: "site" | "system" | "people";   // chỉ cảnh 7: 🟥 HIỆN TRƯỜNG · 🟦 HỆ THỐNG · 🟩 CON NGƯỜI
  clock?: string;             // "21:05": đồng hồ trên màn hình (SPEC-P01 C4)
  crop?: { x: number; y: number; w: number; h: number };  // cắt clip UI (vd bỏ thanh tên cư dân, SPEC-P01 §2)
};
type Line = {
  id: string;                 // "s01-1"
  speaker: "narrator" | "resident" | "staff";   // map sang giọng ở SPEC-P02 §2
  text: string;               // lời đọc (cũng là phụ đề)
  say?: string;               // chữ đưa cho TTS khi cách đọc khác chữ phụ đề (vd tên riêng tiếng Anh); vắng ⇒ dùng text
  cue?: string;               // tên sự kiện animation/thao tác bắt đầu cùng câu này
};
```
Luật: `record.mts` đọc `durations.json` để chờ đúng độ dài lời mới sang thao tác kế (cùng cơ chế video cũ). Thiếu file giọng ⇒ dừng, mã thoát ≠ 0, không ghép bản thiếu tiếng.

## 4. Bảng lỗi khi dựng
| Lỗi | Hành vi bắt buộc |
|---|---|
| TTS mạng lỗi/timeout/file mp3 rỗng (đo 2026-10-15: 4/19 câu lỗi lần đầu) | thử lại 3 lần cách 2 s, kiểm `ffprobe` đọc được độ dài; vẫn lỗi ⇒ exit 2, nêu `id` câu lỗi; **CẤM** tự rơi về Microsoft An (giọng lệch giữa video) |
| Backend/portal chưa chạy | exit 3 trước khi mở trình duyệt |
| Selector UI không thấy (UI đổi) | exit 4, chụp màn hình lỗi vào `out/fail/`; sửa `record.mts`, không quay tay |
| Thời lượng tổng ngoài 2:45–3:15, hoặc tổng lời > 165 s | exit 5, in bảng thời lượng từng cảnh |
| Loudness ngoài −14 ±1 LUFS | `compose.mts` chạy `loudnorm` hai lượt; vẫn lệch ⇒ exit 6 |
| Agent ra kết quả khác kịch bản (không nghi trùng, không tách, sai phòng) | exit 9, in ticket + quyết định; xử lý theo OPERATIONS §3.2, CẤM dựng tiếp |
| Lỗi dựng khung (SPEC-P03 §7) | exit 7/8 |

# 01 — Contract sản phẩm giao & dữ liệu

## 1. File giao
| File | Thông số BẮT BUỘC |
|---|---|
| `docs/demo/product-video.mp4` | 1920×1080, 30 fps, H.264 `yuv420p` CRF ≤ 20, AAC 48 kHz stereo 192 kbps; 2:45–3:15; loudness tích hợp **−14 LUFS ±1**, true peak ≤ −1 dBTP |
| `docs/demo/product-video.vi.srt` | Phụ đề tiếng Việt khớp lời, mỗi dòng ≤ 42 ký tự, ≤ 2 dòng, lệch ≤ 200 ms |
| `docs/demo/product-video.en.srt` | Tuỳ chọn (dịch từ `.vi.srt`) |
| `docs/demo/product-video-vertical.mp4` | 1080×1920, 40–50 giây, phụ đề đốt cứng, cùng loudness |
| `docs/demo/product-video-script.md` | Kịch bản cuối cùng sinh từ `scenes.json` (bảng cảnh/lời/hình) |

Ảnh đầu (thumbnail) `docs/demo/product-video-thumb.png` 1280×720.

## 2. Thư mục công cụ
```text
portal/scripts/product-video/
├── scenes.json        # nguồn chân lý lời + cảnh (schema §3)
├── tts-neural.mjs     # giọng (SPEC-P02 §3) → out/audio/<id>.mp3 + durations.json
├── scenes/            # cảnh animation HTML/CSS (SPEC-P03 §3), mỗi cảnh một file .html
├── record.mts         # quay cảnh HTML + cảnh UI theo durations.json → out/raw/<scene>.webm
└── compose.mts        # ghép hình + tiếng + nhạc + phụ đề → docs/demo/product-video*.mp4
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
};
type Line = {
  id: string;                 // "s01-1"
  speaker: "narrator" | "resident" | "staff";   // map sang giọng ở SPEC-P02 §2
  text: string;               // lời đọc (cũng là phụ đề)
  cue?: string;               // tên sự kiện animation/thao tác bắt đầu cùng câu này
};
```
Luật: `record.mts` đọc `durations.json` để chờ đúng độ dài lời mới sang thao tác kế (cùng cơ chế video cũ). Thiếu file giọng ⇒ dừng, mã thoát ≠ 0, không ghép bản thiếu tiếng.

## 4. Bảng lỗi khi dựng
| Lỗi | Hành vi bắt buộc |
|---|---|
| TTS mạng lỗi/timeout | thử lại 3 lần cách 2 s; vẫn lỗi ⇒ exit 2, nêu `id` câu lỗi; **CẤM** tự rơi về Microsoft An (giọng lệch giữa video) |
| Backend/portal chưa chạy | exit 3 trước khi mở trình duyệt |
| Selector UI không thấy (UI đổi) | exit 4, chụp màn hình lỗi vào `out/fail/`; sửa `record.mts`, không quay tay |
| Thời lượng tổng ngoài 2:45–3:15 | exit 5, in bảng thời lượng từng cảnh |
| Loudness ngoài −14 ±1 LUFS | `compose.mts` chạy `loudnorm` hai lượt; vẫn lệch ⇒ exit 6 |

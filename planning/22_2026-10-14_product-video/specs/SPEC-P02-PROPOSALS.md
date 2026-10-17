# SPEC-P02 — Đề xuất giọng đọc, hình ảnh, animation, âm nhạc

Trạng thái: ✅ ĐÃ CHỐT 2026-10-15 (plan.md V02–V04). Bảng phương án giữ lại làm lịch sử; phần **Đã chốt** ở đầu mỗi mục là luật.

## 1. Giọng đọc

**Đã chốt (V02, người dùng: "chỉ cần phù hợp để nói tiếng Việt"):** một giọng thuyết minh `vi-VN-HoaiMyNeural` qua `edge-tts` 7.3.1, tốc độ **+0%** (đo 2026-10-15: −5% làm lời dài thêm 5%, vượt khung). Sinh thử đủ 19 câu ngày 2026-10-15: tổng 162,3 s; 4/19 câu lỗi mạng ở lần đầu, chạy lại thì được ⇒ luật thử lại ở 01-CONTRACTS §4 là bắt buộc. Không thu giọng người thật, không có giọng nam dự phòng trong cùng video.

| Phương án | Chất lượng tiếng Việt | Chi phí / công | Sửa lời | Rủi ro |
|---|---|---|---|---|
| **A. Azure Neural `vi-VN-HoaiMyNeural` qua `edge-tts` (đề xuất)** | Tự nhiên, ấm, giọng Bắc chuẩn | Miễn phí, chạy bằng lệnh | Sửa chữ → chạy lại ~1 phút | Dựa trên dịch vụ đọc của Edge (không phải API chính thức) ⇒ sinh xong lưu mp3 vào repo, không phụ thuộc lúc trình chiếu |
| B. Người thật trong nhóm thu âm | Cảm xúc nhất, hợp pitch | 1–2 giờ thu + lọc ồn; cần micro + phòng yên | Phải thu lại câu đó | Âm phòng/giọng không đều giữa các lần thu |
| C. FPT.AI / Viettel AI / Zalo AI TTS | Giọng Việt bản địa, có giọng Bắc/Nam | Cần tài khoản + key, có gói miễn phí giới hạn | Chạy lại lệnh | Thêm tài khoản/bí mật cần quản lý |
| D. ElevenLabs Multilingual | Rất mượt nhưng đôi lúc lơ lớ dấu tiếng Việt | Trả phí | Chạy lại | Dấu thanh sai ở tên riêng |
| E. Microsoft An (đang dùng ở video cũ) | Máy móc, ngắt nghỉ cứng | Miễn phí, offline | Chạy lại | Nghe như đọc máy, kém thuyết phục khi pitch |

**Đề xuất:**
- **Một giọng thuyết minh duy nhất: HoaiMy**, tốc độ −5%, cao độ mặc định. Thuyết minh xuyên suốt dễ nghe hơn nhiều giọng nhân vật.
- **Lời cư dân không lồng tiếng** — hiện thành bong bóng chat có hiệu ứng gõ chữ + tiếng gõ phím nhẹ. Tránh cảnh một giọng máy đóng nhiều vai (điểm yếu của video cũ).
- Tuỳ chọn nâng cấp: câu mở cảnh 1 và câu kết cảnh 10 do **người thật** đọc (B) nếu nhóm có người giọng tốt — hai câu này quyết định ấn tượng.
- Giọng nam dự phòng: `vi-VN-NamMinhNeural` (nếu nhóm thích thuyết minh giọng nam).

**Cách đọc:** chậm ở cảnh 1–2 (kể chuyện), nhịp vừa ở cảnh 4–5, **ngắt một nhịp trước "Nhưng khi phản ánh có dấu hiệu nguy hiểm…"** (cảnh 6), nhấn ở ba câu kết. Ngắt nghỉ điều khiển bằng dấu câu trong `text`, không chèn SSML phức tạp.

## 2. Phong cách hình ảnh
- **Nhận diện:** dùng đúng nhận diện portal — font **Be Vietnam Pro**, gradient xanh của header, thẻ bo góc. Video nhìn liền mạch với sản phẩm thật.
- **Mã màu xuyên suốt (người xem học một lần, hiểu cả video):** xanh dương = luồng thường · **đỏ = khẩn cấp** · cam = chờ người xem · xanh lá = hoàn thành.
- **Khung thiết bị:** cư dân luôn ở **khung điện thoại** (app `/app/`), nhân viên/BQL ở **khung laptop** (portal). Người xem phân biệt vai bằng thiết bị, không cần đọc chữ.
- **Zoom theo thao tác** (kiểu Screen Studio): mỗi lần bấm, khung hình phóng 1.0 → 1.5 vào vùng bấm rồi lùi ra; con trỏ có vòng sáng khi bấm (tái dùng của video cũ).
- **Nhãn "Dữ liệu mô phỏng"** cố định góc trên phải mọi cảnh quay UI (00-ARCHITECTURE B1).

### 2.3 Agent lúc quay (D-V04)
**Đã chốt (V04): LLM thật.** Backend agent theo cấu hình đang dùng ở local (`agy_cli`, `gemini-3.8-flash-low`). Thẻ Agent, "nghi trùng", tách đôi trên hình đều là kết quả thật của lần quay, bản ghi quyết định lưu vào `evidence/V4/` (OPERATIONS §3). CẤM chuyển sang mock khi LLM ra kết quả khác kịch bản; xử lý theo OPERATIONS §3.2.
- **Đề xuất: LLM thật**, quay một lần, lưu lại quyết định Agent của các ticket dùng trong video làm bằng chứng — cảnh 5–6 nói về "Agent đọc hiểu" thì nên là Agent thật.
- Phương án mock: ổn định, quay lại bao nhiêu lần cũng giống nhau, nhưng thẻ Agent là dữ liệu giả ⇒ phải ghi "minh hoạ" trên màn hình.

## 3. Animation (theo SPEC-P01; cách dựng cho mượt ở SPEC-P03)
| Cảnh | Animation | Ý nghĩa |
|---|---|---|
| 1 | Bong bóng chat dồn lên nhanh dần, tin khẩn viền đỏ bị đẩy trôi | Cảm giác quá tải, tin khẩn bị chôn |
| 2 | Ba biểu tượng Trôi / Trùng / Chuyền tay bật lên kèm rung nhẹ | Ba nỗi đau |
| 3 | Logo vẽ nét, tagline gõ chữ | Chuyển sang giải pháp |
| 5 | Dải 7 bước, chấm sáng chạy qua từng bước; thẻ Agent trượt vào, căn cứ được tô vàng | Agent làm gì, theo thứ tự nào |
| 6 | Hai thẻ bay vào chồng thành một + huy hiệu đếm 1 → 2 | Gộp trùng |
| 7 | Ba góc 🟥🟦🟩 (SPEC-P01 §3 cảnh 7): minh hoạ hầm B1 có khói, tia lửa; chấm sáng đổi đỏ ở bước An toàn, nhảy thẳng sang BQL; đường nối "nghi trùng"; thẻ tách đôi trượt sang hai khung portal; thẻ số đo đếm 0/16 vs 16/16 | Cao trào: an toàn trước tiên, con người xử lý |
| 10 | Ba dòng chữ hiện lần lượt, logo + tên nhóm | Kết |

Chuyển cảnh: trượt ngang/mờ dần 300–400 ms, không dùng hiệu ứng lòe loẹt (xoay, lật 3D).

## 4. Công cụ dựng (D-V03)

**Đã chốt (V03, người dùng: "sao cũng được, miễn là animation mượt, hợp lý"):** phương án A, nhưng **dựng từng khung hình** (frame-stepped) thay vì quay thời gian thực: mọi chuyển động (animation, phóng camera, con trỏ, phụ đề) do trang "sân khấu" HTML vẽ theo thời gian ảo, chụp đúng 30 khung/giây, nên không thể rớt khung hay giật. Chi tiết và lý do ở [SPEC-P03](SPEC-P03-RENDER.md). Không dùng Remotion (giấy phép chưa kiểm, thêm 1 ngày làm quen), không dựng tay.
| Phương án | Ưu | Nhược |
|---|---|---|
| **A. Cảnh HTML/CSS + Playwright + ffmpeg (đề xuất)** | Tái dùng nguyên quy trình video cũ (`portal/scripts/demo-video/`); không thêm phụ thuộc; dựng lại bằng một lệnh khi UI đổi | Zoom/ghép lớp phải viết bằng ffmpeg, công phu hơn |
| B. Remotion (video bằng React) | Ghép lớp, zoom, khung thiết bị rất mạnh; hợp stack TypeScript của portal | Thêm ~1 ngày làm quen; giấy phép miễn phí chỉ cho cá nhân/nhóm ≤ 3 người — cần kiểm lại điều khoản trước khi dùng |
| C. CapCut / Premiere dựng tay | Nhanh cho bản đầu, nhiều hiệu ứng sẵn | Không dựng lại được; UI đổi là làm lại từ đầu |

**Đề xuất A** vì hạn 19/10 còn 5 ngày và UI còn có thể đổi. Nếu nhóm muốn hiệu ứng zoom/ghép lớp mượt hơn và đã kiểm xong giấy phép ⇒ chuyển B.

## 5. Âm nhạc & âm thanh
- **Nhạc nền:** ambient/corporate nhẹ 90–100 BPM, không lời. Cảnh 1–2 trầm, hơi căng; từ cảnh 3 sáng lên; cảnh 6 nhạc tắt còn nhịp trầm khi hiện ca khẩn cấp; cảnh 10 nâng nhẹ.
- **Nguồn:** Pixabay Music (giấy phép Pixabay Content License, dùng được không ghi công) — ghi tên bài, tác giả, link vào [SPEC-P03](SPEC-P03-RENDER.md) §5 và kịch bản cuối. YouTube Audio Library chỉ tải được khi đăng nhập ⇒ không dùng.
- **Hiệu ứng:** ping tin nhắn (cảnh 1), gõ phím nhẹ (bong bóng chat), "whoosh" khi chuyển cảnh, chuông cảnh báo **nhẹ** ở cảnh 6 (không dùng còi báo động gây giật mình khi trình chiếu).
- **Trộn:** nhạc thấp hơn giọng ~18 dB khi có lời; tổng −14 LUFS.

## 6. Phụ đề
- **Đốt cứng phụ đề tiếng Việt** ở bản chính: trình chiếu ở phòng họp thường không bật được phụ đề, loa phòng hay nhỏ.
- Font Be Vietnam Pro ~40 px, nền mờ bán trong suốt, ≤ 2 dòng; tách `.srt` riêng để đăng online.
- Tuỳ chọn: `.en.srt` cho người chấm không đọc tiếng Việt.

## 7. Định dạng giao
Bản chính 16:9 1920×1080, ~3:05 · bản dọc 9:16 45 giây (SPEC-P01 §5) · ảnh thumbnail. Thông số kỹ thuật chi tiết: [01-CONTRACTS](01-CONTRACTS.md) §1.

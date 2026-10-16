# TESTING-ACCEPTANCE — Nghiệm thu video thuyết minh

## 1. Ma trận kiểm (máy đo; lệnh chạy trên file giao)
| # | Kiểm | Lệnh | Đạt khi |
|---|---|---|---|
| A1 | Kích thước, khung hình | `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,avg_frame_rate,pix_fmt,codec_name -of csv=p=0 docs/demo/product-video.mp4` | `h264,1920,1080,yuv420p,30/1,30/1` (r = avg ⇒ CFR) |
| A2 | Âm thanh | `ffprobe … -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels` | `aac,48000,2` |
| A3 | Thời lượng | `ffprobe … -show_entries format=duration` | 165–195 s |
| A4 | Loudness | `ffmpeg -i … -af ebur128=peak=true -f null -` | I = −14 ±1 LUFS; True peak ≤ −1 dBTP |
| A5 | Không rớt/lặp khung trong cảnh animation | `ffprobe -show_frames` trên `out/raw/<scene>.mp4` | số khung = `round(dài × 30)`; mọi `pkt_duration` bằng nhau |
| A6 | Phụ đề | script kiểm `.vi.srt` | mọi `line.id` có một khối; dòng ≤ 42 ký tự, ≤ 2 dòng; đầu khối lệch đầu tiếng ≤ 200 ms (so `durations.json`) |
| A7 | Lời khớp nguồn | so `.vi.srt` với `scenes.json` | chữ phụ đề = `text` 100% |
| A8 | Bằng chứng LLM thật | `evidence/V4/rehearsal-*.txt` + `agent-*.json` | R1–R8 đều "khớp"; model ghi trong `run.txt` không phải mock |
| A9 | Bản dọc | ffprobe | 1080×1920, 40–50 s, cùng loudness A4 |
| A10 | Dựng lại được | đo thời gian §4 OPERATIONS từ backend mới tới file ra | ≤ 30 phút, không thao tác tay |

## 2. Kiểm bằng mắt (người duyệt xem trọn video, đánh dấu từng dòng)
| # | Kiểm | Nguồn luật |
|---|---|---|
| M1 | Cảnh UI luôn có "Dữ liệu mô phỏng"; cảnh vẽ luôn có "Minh hoạ" | B1, B8 |
| M2 | Không thấy tên đăng nhập, mật khẩu, thanh tên "Nguyễn Văn Hùng" của `cudan01` | B2, SPEC-P01 §2 |
| M3 | Không có câu "Agent tự xử lý/tự gộp/tự đóng/điều người"; cuộc gọi 7.6 có nhãn "Gọi điện, ngoài hệ thống" | B4, SPEC-P01 cảnh 7 |
| M4 | Số trên màn hình chỉ là 0/16, 16/16 và số đọc trên portal lúc quay | B3, SPEC-P01 §4 |
| M5 | Cảnh 7: dải góc 🟥🟦🟩 hiện đúng góc; đồng hồ không lùi; người xem chưa biết dự án hiểu được ai làm gì ở đâu | SPEC-P01 C4, cảnh 7 |
| M6 | Chuyển động không giật: phóng camera, chấm sáng, thẻ bay, khói | SPEC-P03 |
| M7 | Giọng đọc đúng dấu tên riêng (MaintenanceOps, S2.05, B1-02); sai ⇒ thêm `say` | 01-CONTRACTS §3 |
| M8 | Tin "khét dưới hầm" ở cảnh 1 được trả ở cảnh 7 (C2) | SPEC-P01 §1 |

## 3. Phép phá (bộ kiểm mới phải từng đỏ, AGENTS.md K.5)
| Phá | Kỳ vọng |
|---|---|
| Xoá một file `out/audio/*.mp3` rồi chạy `compose.mts` | exit ≠ 0, không ra mp4 |
| Đổi `r=25` khi encode | A1 đỏ |
| Sửa một chữ trong `.vi.srt` | A7 đỏ |
| Đổi câu R5 thành câu không cùng vị trí (vd "tủ điện hầm B2") ở `--rehearse` | exit 9 (không nghi trùng) |

## 4. Exit Gates
| Gate | Nội dung | local | bàn giao |
|---|---|---|---|
| G1 | V2 giọng: 19 câu, tổng ≤ 165 s | ⬜ | — |
| G2 | V4 diễn tập R1–R8 khớp, có evidence | ⬜ | — |
| G3 | A1–A10 xanh | ⬜ | — |
| G4 | M1–M8 người duyệt đánh dấu ✅ | ⬜ | — |
| G5 | Nhóm xem thử trước buổi 19/10, phản hồi đã xử lý | — | ⬜ |
Hồ sơ chỉ đóng khi G5 ✅.

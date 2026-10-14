# 22 — Video thuyết minh sản phẩm MaintenanceOps Agent

## Metadata
- Trạng thái: 🟡 PROPOSED — chờ người dùng chốt D-V01..D-V05 (mục "Câu hỏi chờ chốt").
- Người yêu cầu: Như Ý (2026-10-14). Người dùng video: cả nhóm, buổi bàn giao/pitch 19/10/2026 (Trường trình bày).
- Nhánh: `feature/nhuy-reasoning-agent`. Base: `fc434d6` (develop). Không đổi code sản phẩm; không tăng version app.
- Khác video cũ: [`docs/demo/demo.mp4`](../../docs/demo/demo.mp4) (3:29) là **demo thao tác** đi theo một ticket qua 6 vai. Video này là **video thuyết minh** (~3 phút): kể vấn đề → giải pháp → điểm mạnh của Agent → kết quả. Video cũ giữ làm phụ lục.

## Bảng trỏ SPEC
| File | Nội dung |
|---|---|
| [specs/00-ARCHITECTURE.md](specs/00-ARCHITECTURE.md) | Mục tiêu, non-goals, bất biến (trung thực dữ liệu, không lộ đăng nhập, dựng lại được bằng lệnh) |
| [specs/01-CONTRACTS.md](specs/01-CONTRACTS.md) | Thông số file giao, cấu trúc thư mục, schema `scenes.json` |
| [specs/SPEC-P01-STORY-SCRIPT.md](specs/SPEC-P01-STORY-SCRIPT.md) | 3 hướng dẫn dắt + kịch bản phân cảnh đầy đủ (lời, hình, chữ trên màn hình, thời lượng) |
| [specs/SPEC-P02-PROPOSALS.md](specs/SPEC-P02-PROPOSALS.md) | Đề xuất giọng đọc, phong cách hình, animation, công cụ, nhạc, phụ đề |
| `specs/OPERATIONS.md` | CHƯA VIẾT — viết sau khi người dùng duyệt D-V01..05 (quy trình sản xuất, lịch, lệnh dựng lại) |
| `specs/TESTING-ACCEPTANCE.md` | CHƯA VIẾT — viết sau khi duyệt (ma trận nghiệm thu + Exit Gates) |

## Câu hỏi chờ chốt (đề xuất của agent in đậm)
- **D-V01 Hướng kể chuyện:** **A "Một tối ở tòa S2"** · B Trước/Sau · C Đi theo một ticket (SPEC-P01 §1).
- **D-V02 Giọng thuyết minh:** **Azure Neural `vi-VN-HoaiMyNeural` qua edge-tts** · người thật trong nhóm · FPT.AI/Zalo TTS · giữ Microsoft An (SPEC-P02 §1).
- **D-V03 Công cụ animation:** **Cảnh HTML/CSS quay bằng Playwright + ffmpeg (tái dùng công cụ cũ)** · Remotion · CapCut tay (SPEC-P02 §4).
- **D-V04 Agent khi quay:** **LLM thật, quay một lần, lưu bằng chứng quyết định** · LLM mock (SPEC-P02 §2.3).
- **D-V05 Cảnh khẩn cấp trùng/hai phòng ban (cảnh 6):** chỉ quay sau khi sửa lỗi khẩn cấp đang mở (xem roadmap); chưa sửa kịp ⇒ cắt cảnh 6 còn ý "gộp trùng/tách việc" của ticket thường.

## Nhật ký quyết định
- 2026-10-14 V00 (agent): lập hồ sơ dạng spec package; video là sản phẩm truyền thông, không phải bản phát hành ⇒ không bump SemVer app.
- 2026-10-14 V00b (agent): mọi cảnh quay màn hình phải dựng lại được bằng lệnh (Playwright), không quay tay — UI còn đổi tới 19/10.

### Quyết định bị thay thế
- (chưa có)

## Work Packages
| WP | Việc | Tầng | Phụ thuộc |
|---|---|---|---|
| V1 | Chốt D-V01..05; khoá kịch bản SPEC-P01 §3 | 🔴 người + agent | — |
| V2 | Sinh giọng `tts-neural` theo SPEC-P02 §3, đo thời lượng từng câu | 🟢 | V1 |
| V3 | Dựng 6 cảnh HTML animation (SPEC-P03 §3) | 🟠 | V1 |
| V4 | Kịch bản Playwright quay cảnh màn hình (SPEC-P01 §3 cảnh 3–8) | 🟠 | V1, dữ liệu demo seed |
| V5 | Ghép: zoom, phụ đề, nhạc, loudness (OPERATIONS §2) | 🟠 | V2–V4 |
| V6 | Bản dọc 45 giây (01-CONTRACTS §1) | 🟢 | V5 |
| V7 | Nghiệm thu TESTING-ACCEPTANCE + nhóm duyệt | 🔴 người | V5 |

## Checklist thực thi
- [ ] V1 chốt D-V01..D-V05
- [ ] V2 giọng + bảng thời lượng
- [ ] V3 cảnh animation
- [ ] V4 quay màn hình
- [ ] V5 bản chính 16:9
- [ ] V6 bản dọc
- [ ] V7 nghiệm thu (TESTING-ACCEPTANCE §2 toàn ✅)

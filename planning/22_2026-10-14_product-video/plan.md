# 22 — Video thuyết minh sản phẩm MaintenanceOps Agent

## Metadata
- Trạng thái: 🟠 ĐANG THI CÔNG — người dùng chốt D-V01..D-V05 ngày 2026-10-15 (nhật ký V01–V05).
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
| [specs/SPEC-P03-RENDER.md](specs/SPEC-P03-RENDER.md) | Dựng từng khung 30 fps cho mượt: contract sân khấu, cảnh animation (§3), quay clip UI (§4), nhạc (§5) |
| [specs/OPERATIONS.md](specs/OPERATIONS.md) | Lệnh sản xuất, diễn tập LLM thật R1–R8, câu thay thế, dựng lại, rollback |
| [specs/TESTING-ACCEPTANCE.md](specs/TESTING-ACCEPTANCE.md) | Ma trận máy đo A1–A10, kiểm mắt M1–M8, phép phá, Exit Gates |

## Câu hỏi đã chốt (giữ để tra; câu trả lời ở nhật ký V01–V05)
- **D-V01 Hướng kể chuyện:** **A "Một tối ở tòa S2"** · B Trước/Sau · C Đi theo một ticket (SPEC-P01 §1).
- **D-V02 Giọng thuyết minh:** **Azure Neural `vi-VN-HoaiMyNeural` qua edge-tts** · người thật trong nhóm · FPT.AI/Zalo TTS · giữ Microsoft An (SPEC-P02 §1).
- **D-V03 Công cụ animation:** **Cảnh HTML/CSS quay bằng Playwright + ffmpeg (tái dùng công cụ cũ)** · Remotion · CapCut tay (SPEC-P02 §4).
- **D-V04 Agent khi quay:** **LLM thật, quay một lần, lưu bằng chứng quyết định** · LLM mock (SPEC-P02 §2.3).
- **D-V05 Cảnh khẩn cấp trùng/hai phòng ban (cảnh 6):** chỉ quay sau khi sửa lỗi khẩn cấp đang mở (xem roadmap); chưa sửa kịp ⇒ cắt cảnh 6 còn ý "gộp trùng/tách việc" của ticket thường.

## Nhật ký quyết định
- 2026-10-14 V00 (agent): lập hồ sơ dạng spec package; video là sản phẩm truyền thông, không phải bản phát hành ⇒ không bump SemVer app.
- 2026-10-14 V00b (agent): mọi cảnh quay màn hình phải dựng lại được bằng lệnh (Playwright), không quay tay — UI còn đổi tới 19/10.

- 2026-10-15 V01 (người dùng: "dẫn dắt sao cho hợp lý cốt truyện"): hướng A "Một tối ở tòa S2.05", agent đặt luật cốt truyện C1–C6 (SPEC-P01 §1): hai mạch (đèn tầng 12 · tủ điện hầm B1), cài ở cảnh 1 thì trả ở cảnh sau, đồng hồ không lùi, cao trào dời sang cảnh 7 sau khi người xem đã hiểu luồng thường; nhân vật khớp tài khoản seed.
- 2026-10-15 V02 (người dùng: "chỉ cần phù hợp để nói tiếng Việt"): HoaiMy Neural qua edge-tts 7.3.1, tốc độ +0% (−5% làm lời dài vượt khung). Sinh thử 19 câu: tổng 162,3 s; 4/19 câu lỗi mạng lần đầu ⇒ giữ luật thử lại 3 lần.
- 2026-10-15 V03 (người dùng: "sao cũng được, miễn là animation mượt, hợp lý"): HTML + Playwright + ffmpeg nhưng dựng TỪNG KHUNG 30 fps qua trang sân khấu (SPEC-P03), camera/con trỏ vẽ ở sân khấu; cấm `zoompan` và quay thời gian thực cho chuyển động.
- 2026-10-15 V04 (người dùng: "LLM thật"): `LLM_MODE=agy_cli`, `gemini-3.8-flash-low`, store bộ nhớ; diễn tập R1–R8 trước khi quay, lệch thì xử lý theo OPERATIONS §3.2, cấm mock, cấm hình giả (B7).
- 2026-10-15 V05 (người dùng: cảnh khẩn cấp phải rõ ba góc: hiện trường · luồng hệ thống · con người ở phòng ban có trách nhiệm): cảnh 7 viết lại thành 10 nhịp cắt xen 🟥🟦🟩 (SPEC-P01 §3 cảnh 7). Lỗi khẩn cấp trùng/hai việc đã sửa ở hồ sơ 23 (v1.17.0) ⇒ không cắt cảnh. Bám đúng sản phẩm: BQL gộp + đóng ca; sản phẩm KHÔNG điều người ⇒ cuộc gọi có nhãn "ngoài hệ thống"; việc sửa sau sự cố đi qua phản ánh mới sáng hôm sau, Agent tách hai phòng (Kỹ thuật + Vệ sinh).
- 2026-10-15 V06 (agent): bỏ khỏi video "giữ ticket thường chờ khẩn cấp" (hồ sơ 23 P03) và nút "Hạ mức (báo động giả)" — lý do ở SPEC-P01 §6.
- 2026-10-15 V07 (agent): thêm SPEC-P03-RENDER.md để các chỗ trỏ "SPEC-P03 §3/§5" có file thật; WP V3 trỏ đúng file này.

### Quyết định bị thay thế
- V00 thứ tự cảnh 6 (khẩn cấp) → 7 (trùng/tách) ⇒ THAY bởi V01/V05: cảnh 6 = báo trùng đèn tầng 12, cảnh 7 = khẩn cấp ba góc; "tách hai việc tầng 3" bỏ, thay bằng tách hai việc sau sự cố hầm B1 (một mạch truyện).
- SPEC-P02 §1 "tốc độ −5%" ⇒ THAY bởi V02 "+0%".
- SPEC-P01 bản 2026-10-14 nhân vật "Bác Tư" (không có tài khoản) ⇒ THAY bởi "chú căn 1402" (`cudan01`).

## Work Packages
| WP | Việc | Tầng | Phụ thuộc |
|---|---|---|---|
| V1 | Chốt D-V01..05; khoá kịch bản SPEC-P01 §3 | 🔴 người + agent | — |
| V2 | Sinh giọng `tts-neural` theo SPEC-P02 §3, đo thời lượng từng câu | 🟢 | V1 |
| V3 | Sân khấu `stage.js` + 8 trang cảnh (SPEC-P03 §2–3) | 🟠 | V1 |
| V4 | `record.mts`: diễn tập R1–R8 + quay clip UI, LLM thật (OPERATIONS §3) | 🟠 | V1 |
| V5 | `render.mts` + `compose.mts`: khung 30 fps, phụ đề, nhạc, loudness (OPERATIONS §2) | 🟠 | V2–V4 |
| V6 | Bản dọc 45 giây (01-CONTRACTS §1) | 🟢 | V5 |
| V7 | Nghiệm thu TESTING-ACCEPTANCE + nhóm duyệt | 🔴 người | V5 |

## Checklist thực thi
- [x] V1 chốt D-V01..D-V05 (2026-10-15) + viết SPEC-P03, OPERATIONS, TESTING-ACCEPTANCE
- [ ] V2 giọng + bảng thời lượng
- [ ] V3 cảnh animation
- [ ] V4 quay màn hình
- [ ] V5 bản chính 16:9
- [ ] V6 bản dọc
- [ ] V7 nghiệm thu (TESTING-ACCEPTANCE §2 toàn ✅)

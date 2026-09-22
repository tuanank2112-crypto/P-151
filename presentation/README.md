# Pitch Deck & Demo Materials — Resident Agent v1.0

> Nguồn số liệu, sơ đồ, và các câu hỏi mẫu: [`docs/OVERVIEW.md`](../docs/OVERVIEW.md),
> [`docs/architecture_diagram.md`](../docs/architecture_diagram.md),
> [`specs/00-ARCHITECTURE.md`](../planning/01_2026-09-20_resident-agent-v1/specs/00-ARCHITECTURE.md) §7.

## Files

- `pitch_deck.pptx` — Slide thuyết trình Demo Day (đội tự tạo — CHƯA có trên đĩa)
- `video_demo.mp4` — Video demo sản phẩm, tối đa 5 phút (đội tự làm — CHƯA có trên đĩa)
- `demo_script.md` — Kịch bản demo local từng bước bấm, 10 phút (có trong thư mục này)

## Pitch Deck Structure (10 slides)

Nội dung thật của dự án, không phải khung mẫu:

1. **Title** — Resident Agent v1.0 · Team [điền] · AI20K Build Phase Cohort 4
2. **Problem** — Cư dân hỏi lặp đi lặp lại nội quy tiện ích qua nhiều kênh;
   BQL trả lời thủ công, dễ không nhất quán khi nội quy cập nhật lệch nhau
3. **Solution** — Trợ lý AI có trích dẫn, 9 chặng / 5 lối thoát, biết khi nào
   KHÔNG được trả lời (4 khuyết tật cài sẵn: thiếu nguồn, mâu thuẫn, hết hiệu lực)
4. **Demo** — Screenshot `/chat` (câu trả lời có citation) + `/review` (hàng đợi HITL)
5. **Architecture** — Sơ đồ hệ thống từ `docs/architecture_diagram.md` §1 (2 biên
   giới adapter: `lib/adapters/db.ts`, `lib/adapters/model.ts`)
6. **Tech Stack** — Next.js 15 + TypeScript · Postgres/Supabase (`pgvector`,
   `ts_rank_cd`) · 3 agent Gemini (`flash-lite`/`flash`/`2.5-flash`)
7. **Traction** — Số đo thật, không tô hồng: 172 test pass, `knowledge/` 19 tài
   liệu/98 mục, `M1 2.5%`/`M3 12.5%` (CHƯA đạt ngưỡng — xem `eval/results/report.md`)
8. **Market** — [điền] (ngoài phạm vi kỹ thuật của gói này — đội tự điền quy mô
   thị trường thật, không bịa số)
9. **Team** — Bảng git author thật ở `README.md` §Team (ô `[điền]` chờ xác nhận vai trò)
10. **Ask** — Ba việc chỉ người quyết được: nhãn `gate` DEF-01/DEF-04, hạn mức
    Gemini, scope Vercel (`docs/OVERVIEW.md` §8)

## Video Demo Checklist

- [ ] Giới thiệu problem (< 30 giây) — 4 khuyết tật kho tri thức là điểm khác biệt
- [ ] Demo live: đăng nhập cư dân → 1 câu trả lời có citation → 1 câu bị từ chối
      (DEF-03 mâu thuẫn BBQ 10 vs 15 người) (2-3 phút)
- [ ] Đăng nhập BQL → đổi `status` tài liệu → quay lại thấy câu trả lời đổi hành vi
      ngay trong phiên (1 phút) — đây là cảnh thuyết phục nhất theo `docs/OVERVIEW.md` §9
- [ ] Tóm tắt: số đo thật (172 test, 19 tài liệu, M1/M3 hiện trạng) (< 30 giây)

Chi tiết từng bước bấm, kèm phương án dự phòng nếu model chậm: xem
[`demo_script.md`](demo_script.md).

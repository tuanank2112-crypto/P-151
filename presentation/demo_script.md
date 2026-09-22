# Kịch bản Demo Local — Resident Agent v1.0 (10 phút)

> Chạy local (`npm run dev`), `DATA_BACKEND=postgres`. Nguồn câu hỏi mẫu:
> `planning/01_2026-09-20_resident-agent-v1/specs/00-ARCHITECTURE.md` §7.
> Nguồn số đo hiện trạng: `docs/OVERVIEW.md`, `eval/results/report.md`.

## Checklist 15 phút trước demo

- [ ] `DATA_BACKEND=postgres` trong `.env.local` (không phải `mock`)
- [ ] **Xoá cache trước khi chạy:** `rm -rf .next` rồi mới `npm run dev` — `.next` lẫn giữa `next build` và `next dev` làm `/chat` văng `__webpack_require__.n is not a function` trên trình duyệt dù curl vẫn 200 (G40)
- [ ] Server đang chạy: `npm run dev`, mở thử `http://localhost:3000/login` **bằng trình duyệt thật** (không chỉ curl), bấm một câu ở `/chat` để chắc UI hydrate được
- [ ] Probe 3 model bằng curl trước (A1/A2/A3) — tránh model đang `429`/`503`
      giữa lúc demo. `.env.local` đã có CHUỖI dự phòng
      `MODEL_A2=gemini-3.6-flash,gemini-3.5-flash,gemini-2.5-flash` — hệ thống tự
      nhảy model khi 429/503; lượt trả lời đầu có thể mất 40–60 s, nói trước với giám khảo
- [ ] Kiểm `review_queue` có ít nhất 1 dòng `pending` — từ 2026-09-23 mọi lượt escalate
      TỰ vào hàng đợi (G36 đã vá); chỉ cần hỏi trước 1–2 câu bị từ chối ở `/chat`
- [ ] Hai tài khoản demo đã seed: `resident@demo.local` / `bql@demo.local`
      (mật khẩu từ `SEED_RESIDENT_PASSWORD`/`SEED_BQL_PASSWORD`)

## Kịch bản từng bước (≈10 phút)

| # | Bước | Thao tác | Kỳ vọng | Thời lượng |
| :-- | :-- | :-- | :-- | :-- |
| 1 | Đăng nhập cư dân | `/login` → `resident@demo.local` | Vào `/chat` | 20s |
| 2 | Câu trả lời được | Gõ: *"Trẻ em dưới 12 tuổi có được vào bể bơi một mình không?"* | `decision=answer`, ≥1 citation `document_id · section_id`, panel 3 agent hiện latency + token từng chặng | 40s |
| 3 | 4 câu bị từ chối, 4 lý do khác nhau (nhấn D3) | Lần lượt: *"Sân pickleball mở cửa mấy giờ?"* → *"Làm lại thẻ xe máy bị mất thì mất bao nhiêu tiền?"* → **"Vườn BBQ cho tối đa bao nhiêu người một lượt?"** (nhấn mạnh) → *"Bể bơi mở cửa từ mấy giờ đến mấy giờ?"* | Lần lượt `no_eligible_source` · `no_eligible_source` · `source_conflict` (đưa CẢ HAI nguồn 10 và 15 người) · `source_expired_or_unknown` | 2 phút |
| 4 | Đăng xuất / đăng nhập lại | Logout → login lại `resident@demo.local` | Lịch sử hội thoại 5 câu ở bước 2–3 còn nguyên (BB-11) | 30s |
| 5 | Đăng nhập BQL | Logout → login `bql@demo.local` | Vào `/documents` | 20s |
| 6 | Hạ status tài liệu | Mở `OCP1-POOL-RULES-001` → đổi `status` xuống hết hiệu lực | Ghi thành công, 1 câu SQL (`bql-store.ts`) | 40s |
| 7 | Quay lại hỏi câu 1 | Đăng nhập lại cư dân, hỏi lại câu bể bơi trẻ em dưới 12 tuổi | Nay bị từ chối — chứng minh R7 (đổi tài liệu → agent đổi hành vi ngay trong phiên) | 40s |
| 8 | Khôi phục | BQL trả `status` tài liệu về như cũ | Câu hỏi ở bước 2 trả lời được lại | 30s |
| 9 | `/review` | Duyệt một lượt trong hàng đợi HITL (Duyệt/Sửa/Từ chối) | Trạng thái đổi, không quay lại được `pending` (3 trạng thái cuối) | 40s |
| 10 | `/dashboard`, `/eval` | Mở hai màn, chỉ vào số tách theo intent/reason code và bảng eval | Nói thẳng: `M1 2.5%`, `M3 12.5%` hiện CHƯA đạt ngưỡng — lý do ở `eval/results/report.md` §4 | 40s |

Tổng: ~7-8 phút thao tác + đệm hỏi đáp.

## Nếu hỏng thì nói gì

| Sự cố | Nói gì |
| :-- | :-- |
| A2 chậm 20–30s hoặc lỗi `429`/`503` | "Đây là bậc Flash miễn phí của Gemini, không có model Pro khả dụng ở hạn mức hiện tại (Đ17) — hạ cấp có chủ ý, đã ghi rõ trong hồ sơ quyết định, không phải bug." Chờ hoặc chuyển sang `MODEL_A2=gemini-3.6-flash` đã chuẩn bị sẵn. |
| `/review` không có dòng `pending` | "Hàng đợi hiện có 0 dòng đang chờ — đây là gap đã biết (`docs/OVERVIEW.md` §7 rủi ro #1), tụi em ưu tiên seed trước demo thật." Chuyển sang mô tả luồng bằng lời + code `bql-store.ts`. |
| Dashboard đọc ra số tự động giải quyết thấp bất thường | "Số này đang lẫn traffic test (377 lượt phần lớn là escalate/test, chưa tách theo `is_golden_run` ở panel vận hành) — không phải hiệu năng thật của sản phẩm, xem `docs/OVERVIEW.md` §7 rủi ro #2." |
| M1/M3 bị hỏi tại sao thấp | "Cạn hạn mức Gemini giữa lượt chạy Golden — blocked Tầng 1, không phải trượt logic (Đ26). Chi tiết và bốn lý do trong `eval/results/report.md` §4." |
| Chưa có Live URL (R1) | "Đang chờ chọn scope Vercel — CLI đã đăng nhập sẵn, `npm run build` xanh không cần DB, chỉ còn một lựa chọn." |

## Sau demo — nếu giám khảo hỏi thêm

- Kiến trúc chi tiết: `docs/architecture_diagram.md`
- 46 quyết định có mốc thời gian, gồm lý do bác Turso/TokenRouter:
  `planning/01_2026-09-20_resident-agent-v1/plan.md` §2
- Ma trận test và 31 exit gate: `specs/TESTING-ACCEPTANCE.md`

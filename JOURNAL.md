# Weekly Journal — Resident Agent v1.0 (AI20K Build Phase Cohort 4)

> Ghi lại mỗi tuần: học được gì, khó khăn gì, quyết định gì, kế hoạch tiếp.
> Nguồn dữ liệu: `git log` nhánh `main`, `brain4agent/memory/hot/` và
> `planning/01_2026-09-20_resident-agent-v1/plan.md` §2 (46 quyết định có mốc
> thời gian). Cột giờ công không có nguồn đo tự động — xem `WORKLOG.md`.

---

## Week 1: 2026-09-20 - 2026-09-27 (deadline demo)

### Mục tiêu tuần này
- [x] Chốt kiến trúc và contract (rubric `C104/VHR-01/G104`, mô phỏng toàn phần — Đ01, Đ02)
- [x] Dựng kho tri thức mô phỏng + bộ Golden có chủ đích cài khuyết tật (P00)
- [x] Nối pipeline 9 chặng, 3 agent vào web app thật (P02)
- [x] Console BQL: upload/đổi tài liệu, hàng đợi duyệt HITL (P03)
- [x] Bảng eval + dashboard (P04)
- [ ] Chạy đủ bộ Golden lấy số `M1`/`M3` đạt ngưỡng — **chưa đạt, xem bên dưới**
- [ ] Deploy public URL (R1) — chờ chọn scope Vercel
- [ ] 10 deliverables BTC (README/architecture/AI logs/JOURNAL/WORKLOG/eval report/presentation) — đang làm, gói này (H18)

### Đã hoàn thành
- Kho tri thức 19 tài liệu · 98 mục, 4/4 khuyết tật cài đúng chỗ (DEF-01..04)
- Bộ Golden 50 FAQ (40 answerable) + 16 safety, phủ 10/10 mã lý do
- Pipeline `runTurn()` chạy end-to-end thật trên Postgres (không còn mock) —
  9 chặng, 5 lối thoát, mỗi lối một `reason_code` riêng
- Console BQL: đổi `status` tài liệu, hàng đợi HITL 3 trạng thái cuối
- Bảng eval + dashboard đọc từ `answer_turns`, một bộ chấm Golden duy nhất
  (`lib/eval/score.ts`) dùng chung cho script và UI (BB-06)
- Bộ nhớ hội thoại bền qua phiên đăng nhập lại (BB-11)
- Lượt `eval:golden` **đầu tiên trong đời dự án** chạy thật trên Postgres
  (2026-09-22): bộ `safety` 11 pass/4 fail/1 blocked; bộ `faq` 0/40 vì cạn hạn
  mức Gemini
- Audit đối kháng nội bộ 2 lần (agent khác người làm), tìm ra 8+ phát hiện
  thật (G25–G38), đã vá phần lớn — chi tiết `brain4agent/-known-gotchas.md`

### Khó khăn & Giải pháp
| Khó khăn | Giải pháp | Kết quả |
| :-- | :-- | :-- |
| Model được chỉ định ban đầu (`stealth/union-alpha` qua TokenRouter) không dùng được — đo ra `401`, không có endpoint embeddings | Đo thật trước khi chốt, chuyển sang Gemini (key định dạng mới `AQ.…`), đổi contract 3 agent sang Flash (Đ17) | Pipeline chạy được nhưng A2 mất model mạnh — hạ cấp chất lượng có chủ ý, ghi rõ trong Đ17 |
| Turso/SQLite được đề nghị thay Postgres | Đo schema thật: `ts_rank_cd(..., 32)`, `pgvector`, `text[]`, `jsonb` đều không có ở SQLite/libSQL cùng dạng | Bác Turso, chốt Supabase (Đ25), đổi driver Neon→`pg` không đụng call site tầng trên (BB-07) |
| `plainto_tsquery` nối AND làm truy vấn 10 từ trả 0 dòng trên DB thật | Đổi hợp đồng truy vấn retrieval (Đ32, chờ phê chuẩn) | Câu hỏi thật không còn rơi hết về `no_eligible_source` |
| Cạn hạn mức Gemini giữa lượt chạy Golden `faq` | Cầu dao `QUOTA_STREAK_STOP` dừng sớm, phân loại đúng là blocked Tầng 1 (Đ26), không phải trượt | `M1` chưa có số thật — chặn gate `G11`, cần người quyết nạp tiền hay chia nhỏ chạy |
| Cổng kiểm xanh nhưng không canh gì cả — lặp lại 6 lần trong một phiên (biên giới adapter xanh giả, checkpoint Golden thiếu 3/7, assertion không bao giờ được đọc, hàm chết, cột không có đường ghi, ca xanh nhờ hạn mức cạn) | Đối chiếu tay với dữ liệu thật thay vì tin build/test xanh; thêm luật thi công "mọi bộ đo mới phải chứng minh từng ĐỎ" | 6 gotcha mới (G33–G38 + trước đó), kernel `memory-distill.txt` được vá |

### Bài học
- Một con số chỉ được coi là số nghiệm thu khi nó **không đổi theo điều kiện
  môi trường** (Đ45) — ca test xanh nhờ hạn mức API đang cạn không phải bằng
  chứng.
- Đo trước khi quyết, kể cả khi chủ tịch đã chỉ định sẵn (model, DB) — hai lần
  liền việc đo ra kết quả khác chỉ định ban đầu và tiết kiệm được công sửa sai
  sau này.
- "Build xanh, test xanh" không đồng nghĩa "canh đúng thứ cần canh" — phải có
  bằng chứng ĐỎ trên hệ cố tình hỏng thì một bộ đo mới mới đáng tin.

### Kế hoạch tuần sau (tới 2026-09-27)
- [ ] Ba quyết định cần người: nhãn `gate` cho `DEF-01`/`DEF-04`, hạn mức
      Gemini (nạp tiền hay chia nhỏ chạy), scope Vercel
- [ ] Seed hàng đợi HITL (đang 0 dòng `pending`) — rủi ro demo nghiêm trọng nhất
- [ ] Đẩy repo lên remote (hiện 100% commit chỉ nằm trên một ổ đĩa)
- [ ] Viết `demo_r7.mjs` để đóng gate `G09`/R7
- [ ] Chạy đủ bộ Golden khi hạn mức hồi, lấy số `M1`/`M3` thật cho `/bql/eval`
- [ ] Hoàn tất 10 deliverables BTC (gói đang làm ở đây) và cài hook AI-log

---

<!-- Chỉ một tuần tính tới thời điểm viết journal (2026-09-23); nếu deadline
     lùi hoặc có tuần 2, copy block trên. -->

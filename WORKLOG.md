# Worklog — Resident Agent v1.0 (AI20K Build Phase Cohort 4)

> Ghi lại tất cả công việc đã làm theo ngày. Nguồn: `git log --date=short
> --format='%ad %an %s'` trên nhánh `main` + `brain4agent/memory/hot/today.md`.
> Cột **Time** không có nguồn đo tự động trong repo ⇒ ghi `[điền]` (luật §2
> handoff H18 — không bịa giờ công).

---

## 2026-09-20

| Member | Task | Status | Output | Time |
| :-- | :-- | :-- | :-- | :-- |
| lenq | Khởi tạo git repo, chốt hồ sơ spec-design cho `resident-agent-v1` | ✅ Done | commit `chore: initialize git repo...` | [điền] |
| lenq | Giải quyết C-01..C-04, thêm D13/D14, bàn giao P00 | ✅ Done | `plan.md` §2 | [điền] |
| lenq | Dựng kho tri thức mô phỏng + bộ Golden (P00) | ✅ Done | `knowledge/` 19 tài liệu, `evals/golden/` | [điền] |
| lenq | Scaffold nền tảng Next.js build được không cần key nào (P01a) | ✅ Done | `app/`, `npm run build` xanh | [điền] |
| lenq | Đổi nhà cung cấp model sang Google Gemini | ✅ Done | `lib/adapters/model.ts`, Đ17 | [điền] |
| lenq | Đo lại Vyce, giữ Gemini, sửa nhận định sai về Vercel | ✅ Done | `plan.md` | [điền] |
| lenq | Ghi D24 (mock backend), đồng bộ não sau đợt Vyce/Vercel | ✅ Done | `brain4agent/` | [điền] |

**Tổng kết ngày:** Chốt kiến trúc, nhà cung cấp model (Gemini) và nhà cung cấp
DB đo thật thay vì theo chỉ định ban đầu; P00 (kho tri thức + Golden) xong.

---

## 2026-09-21

| Member | Task | Status | Output | Time |
| :-- | :-- | :-- | :-- | :-- |
| lenq | Nối pipeline agent vào web, vá 4 khuyết tật lộ ra khi chạy end-to-end (P02b) | ✅ Done | `app/api/chat/route.ts`, 4 gotcha vá (G22–G24 và liên quan) | [điền] |
| lenq | Viết handoff H06 (bộ nhớ BB-11), H07 (console BQL), H08 (eval dashboard) | ✅ Done | `planning/01_.../handoffs/` | [điền] |
| lenq | Ghi một dòng `answer_turns`/lượt, lưu lịch sử hội thoại bền qua phiên (BB-11) | ✅ Done | `lib/pipeline/`, test bộ nhớ | [điền] |
| lenq | Dựng console quản lý toà nhà: tài liệu + duyệt câu trả lời (P03) | ✅ Done | `app/(bql)/documents/`, `app/(bql)/review/` | [điền] |
| lenq | Thêm bảng eval, dashboard, rubric chấm điểm (P04) | ✅ Done | `app/(bql)/eval/`, `app/(bql)/dashboard/`, `evals/golden/rubric.md` | [điền] |
| lenq | Ghi D34 (một bộ chấm duy nhất), D35 (phán quyết câu hỏi P03) | ✅ Done | `plan.md` | [điền] |

**Tổng kết ngày:** Lượt hỏi–đáp end-to-end đầu tiên chạy được thật trên web;
P03 và P04 dựng xong khung chính; test từ 53 lên 82.

---

## 2026-09-22

| Member | Task | Status | Output | Time |
| :-- | :-- | :-- | :-- | :-- |
| lenq | Viết H09 (handoff audit đối kháng), bằng chứng gate SO | ✅ Done | `planning/01_.../handoffs/H09*`, `evidence/` | [điền] |
| lenq | Ghi D36 và các phán quyết đợt 1 sau audit đối kháng | ✅ Done | `plan.md` | [điền] |
| lenq | Gom bộ chấm Golden về một chỗ (`lib/eval/score.ts`), thêm upload tài liệu | ✅ Done | `lib/eval/score.ts`, test `scorer-consensus.test.ts` | [điền] |
| lenq | Đồng bộ não sau đợt console/eval/bộ nhớ | ✅ Done | `brain4agent/` | [điền] |
| lenq | Vá `conversation_id` phải là uuid, thêm citation cho `source_conflict` (Đ37/Đ38) | ✅ Done | `lib/pipeline/`, test mới, tests 134→143 | [điền] |
| lenq | Ghi D39–D44, lượt Golden thật đầu tiên, R14 audit trail | ✅ Done | `plan.md`, `evidence/uuid-conflict/` | [điền] |
| lenq | Vá: ngừng bịa "hết hiệu lực" cho nguồn lạc đề; đặt tên đúng cho từ chối PII; sửa hướng chạy S16/S14 | ✅ Done | `lib/pipeline/`, gotcha G29–G32 | [điền] |
| lenq | Ghi D45, D46 — căn cứ các bản vá lỗi Golden | ✅ Done | `plan.md` | [điền] |
| lenq | Viết tổng quan dự án có số đo + sơ đồ, chuẩn bị demo | ✅ Done | `docs/OVERVIEW.md` (bản đầu) | [điền] |

**Tổng kết ngày:** Ngày nặng nhất — audit đối kháng tìm ra 4 lỗi thật (G25–G28),
vá xong, chạy được lượt Golden thật đầu tiên trên Postgres (safety 11/16 pass,
faq bị chặn vì cạn hạn mức); test 82→172 tính đến cuối ngày.

---

## 2026-09-23

| Member | Task | Status | Output | Time |
| :-- | :-- | :-- | :-- | :-- |
| lenq | Rà toàn repo đối chiếu mục tiêu ban đầu chuẩn bị demo (3 agent độc lập) | ✅ Done | `brain4agent/memory/hot/today.md`, gotcha G33–G38 | [điền] |
| lenq | Ghi lại audit trước demo, gotcha G33–G38, sửa kernel bị lệch | ✅ Done | `brain4agent/-known-gotchas.md`, `memory-distill.txt` | [điền] |
| lenq | Giữ kernel dưới 100 dòng | ✅ Done | `brain4agent/memory-distill.txt` | [điền] |
| lenq | Cho phép `gemini-3.6-flash` làm fallback A2 khi `3.5-flash` trả 429/503 | ✅ Done | `lib/adapters/model.ts` | [điền] |
| lenq | Viết handoff H15–H17 cho các bản vá trước demo | ✅ Done | `planning/01_.../handoffs/H15*..H17*` | [điền] |
| lenq | Ghi D47 — các phán quyết trước demo | ✅ Done | `plan.md` | [điền] |
| lenq | 🔄 WIP song song: vá G33–G38 (đăng nhập, A2, nav, review_queue, nhuộm dữ liệu test) | 🔄 WIP | `lib/adapters/db.ts`, `lib/adapters/store-mock.ts`, `tests/hitl-enqueue.test.ts` (đang sửa, ngoài phạm vi gói này) | [điền] |
| lenq | Viết 10 deliverables BTC + hook AI-log (gói H18, tài liệu này) | 🔄 WIP | `README.md`, `docs/architecture_diagram.md`, `JOURNAL.md`, `WORKLOG.md`, `eval/results/report.md`, `presentation/`, bộ hook `scripts/log_*.py` | [điền] |

**Tổng kết ngày:** Audit trước demo tìm 6 lỗ hổng chặn demo (G33–G38, gồm việc
`origin/main` không có mã sản phẩm và chưa có 10 deliverables BTC); một gói
đang vá lỗi runtime song song, gói này (H18) dựng tài liệu/deliverables.

---

<!-- Cập nhật thêm mỗi ngày còn lại tới 2026-09-27, copy block trên. -->

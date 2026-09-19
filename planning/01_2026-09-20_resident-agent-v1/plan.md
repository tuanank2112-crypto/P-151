# Kế hoạch 01 — Resident Agent v1.0 (demo mô phỏng cho ban giám khảo)

> Hồ sơ kế hoạch. **KHÔNG chứa thiết kế chi tiết** — thiết kế nằm ở `specs/` (bảng Mục 5).

## 1. Metadata Header

| Trường | Giá trị |
| :-- | :-- |
| Mã hồ sơ | `01_2026-09-20_resident-agent-v1` |
| Ngày mở | 2026-09-20 |
| Chủ trì | Super Orchestrator (cửa sổ này) |
| Trạng thái | 🟡 ĐANG LẬP KẾ HOẠCH |
| Deadline | **2026-09-27** (7 ngày) |
| Nguồn yêu cầu | AI20K Build Phase Cohort 4 — ngân hàng đề `C104 / VHR-01 / G104` |
| Mục đích | Sản phẩm demo cho doanh nghiệp + ban giám khảo. Không phải hệ thống chạy thật. |
| SemVer dự kiến | `1.0.0` (MAJOR — dựng mới, chưa có mã nguồn) |
| Đặc tả kế thừa | `docs/PRD_ResidentGPT_MVP.md` và 5 tài liệu v0.2 khác — hạ cấp thành **nguồn đặc tả cho lõi trả lời**, không còn là định nghĩa sản phẩm |

## 2. Nhật ký quyết định

Mỗi mục: quyết định · lý do · **chỗ có thể lật + chi phí lật**.

### Đ01 — 2026-09-20 · Mục tiêu là rubric, không phải v0.2

Đầu ra được chấm là rubric `C104/VHR-01`: web deploy, 2 vai trò, RAG có trích dẫn + memory + escalate, multi-agent 3 con, BQL upload tài liệu + duyệt câu trả lời, bảng eval faithfulness/relevance, dashboard tỉ lệ tự động giải quyết. Bộ v0.2 mô tả một sản phẩm khác (công cụ soạn nháp cho BQL) và tự cấm đúng thứ đề bài cần ở tầng nâng cao.

**Lật được:** nếu rubric được diễn giải khác. **Chi phí lật:** cao sau D3 — cấu trúc 3 agent và schema log bám theo rubric.

### Đ02 — 2026-09-20 · Mô phỏng toàn phần

Không API Vinhomes, không dữ liệu cư dân thật. Web app tự viết **đóng luôn vai backend cư dân**. Hệ quả: mọi ràng buộc PII và điều khoản dịch vụ của v0.2 không còn hiệu lực ràng buộc; 3 ảnh trong `docs/assets/` là tư liệu tham chiếu để dựng giao diện và danh mục tiện ích, không phải hợp đồng phải đi xin.

**Lật được:** khi có API thật. **Chi phí lật:** thấp nếu mọi lệnh đi qua lớp adapter của P01; cao nếu gọi thẳng.

### Đ03 — 2026-09-20 · Hai tầng mục tiêu, khoá sau cổng

Tầng 1 = rubric (P01–P04), bắt buộc. Tầng 2 = lớp hành động (P05), là điểm khác biệt khi demo. **P01–P04 chưa xanh thì CẤM chạm P05.** P05 là gói duy nhất được cắt khi trễ, và cắt nó không đụng dòng nào của rubric.

**Lật được:** không. Đây là hàng rào chống trễ hạn.

### Đ04 — 2026-09-20 · Knowledge Pack và Golden phải dựng — ĐƯỜNG GĂNG

Xác nhận của chủ tịch 2026-09-20. Knowledge Pack `1.18` (21 tài liệu `OCP1-*`) và Golden `0.1` (50 FAQ / 30 E2E) mà v0.2 mô tả **không tồn tại** — chỉ có đặc tả mô tả chúng. Không có tri thức thì P02 và P04 đều đứng.

**Lật được:** nếu tìm thấy bộ nội quy có sẵn. **Chi phí lật:** âm (rút ngắn lịch).

### Đ05 — 2026-09-20 · Cố tình cài khuyết tật vào Knowledge Pack

Dựng kèm **2 khoảng trống có chủ ý + 1 cặp tài liệu mâu thuẫn + 1 tài liệu hết hiệu lực**. Lý do: hành vi từ chối đúng lúc là thứ khó chứng minh nhất và thuyết phục nhất khi demo. Không có khuyết tật cài sẵn thì `no_eligible_source`, `source_conflict`, `source_expired_or_unknown` không bao giờ được kích hoạt để cho xem.

**Lật được:** có. **Chi phí lật:** thấp — gỡ khuyết tật là xoá vài file.

### Đ06 — 2026-09-20 · Đảo nội hàm `pii_or_account_specific`

v0.2 định nghĩa mã này là "chạm dữ liệu account/cá nhân thì chặn", vì actor cũ là bên thứ ba chưa xác thực danh tính. Bê nguyên sang agent phục vụ chính chủ thì **agent tự chặn ca dùng của chính nó**. Ranh giới dời từ *loại dữ liệu* sang *chủ sở hữu dữ liệu*: chặn khi chạm **dữ liệu người khác**. Mức nghiêm giữ nguyên.

**Lật được:** không nên. Giữ định nghĩa cũ là mâu thuẫn logic, không phải lựa chọn an toàn hơn.

### Đ07 — 2026-09-20 · Confidence là hợp của 4 tín hiệu đo được

Rubric đòi "escalate khi confidence thấp"; v0.2 cấm "fake confidence percentage". Giải: confidence ghép từ điểm truy hồi top-k, kết quả cổng eligibility, điểm faithfulness của agent kiểm chứng, và cờ phát hiện mâu thuẫn nguồn. Ngưỡng dùng nội bộ để escalate; **màn hình hiển thị lý do, không hiển thị phần trăm**.

**Lật được:** ngưỡng thì có, hiển thị phần trăm thì không.

### Đ08 — 2026-09-20 · Agent kiểm chứng vừa là chốt chặn vừa là thước đo

Con agent thứ ba soi từng mệnh đề của bản nháp có neo vào evidence không. Cùng một cơ chế sinh ra cả hành vi an toàn lúc chạy lẫn cột faithfulness trong bảng eval. Đỡ được một hệ thống chấm riêng, và số trên dashboard khớp hành vi thật của sản phẩm.

**Lật được:** có, nếu cần thước đo độc lập với hệ thống đang bị chấm. **Chi phí lật:** trung bình.

### Đ09 — 2026-09-20 · Bất biến: thao tác được không có nghĩa là được phép giải thích luật

Quyền gọi một lệnh ghi không kéo theo quyền phát biểu về nội quy. Mọi phát biểu vẫn phải đi đường RAG có trích dẫn. Chống một kiểu hallucination khó bắt: suy từ một ràng buộc vận hành có thật ra một quy định không hề được nêu.

**Lật được:** không.

### Đ10 — 2026-09-20 · Chính sách là dữ liệu đọc được trước khi hành động

Backend mô phỏng phải lộ điều kiện của một thao tác dưới dạng dữ liệu đọc-thuần, gọi được **trước** lệnh ghi (còn chỗ trống không, có đủ điều kiện không, hạn huỷ tới khi nào). Lý do: agent không được học luật bằng cách thử và hỏng — mỗi lần thử là một lệnh ghi thật.

**Lật được:** có, nếu P05 bị cắt. **Chi phí lật:** thấp.

### Đ11 — 2026-09-20 · Stack và thời điểm deploy

Next.js + TypeScript trên Vercel · Postgres + pgvector trên Neon (RAG, state, sổ biên nhận chung một kho) · auth credential 2 vai trò · Claude cho 3 agent. **Deploy ở D2, không để cuối** — "web đã deploy" là gạch đầu dòng đầu tiên của rubric, phải xanh sớm rồi bồi lên.

**Lật được:** có, tại lớp adapter P01. **Chi phí lật:** thấp trước D3, cao sau.

### Đ12 — 2026-09-20 · Enum reason code: giữ 10, thêm nhóm hành động

Giữ nguyên 10 mã canonical của v0.2. Bổ sung nhóm hành động: vượt hạn mức, bất khả hoàn tác, thực thi một phần, thiếu uỷ quyền, trùng lặp. Không tạo alias cho mã cũ.

**Lật được:** thêm mã thì có, đổi nghĩa mã cũ thì không (trừ Đ06 đã nêu).

### Quyết định bị thay thế

- **2026-09-20 — "Lật actor sang cư dân, agent tự chủ thanh toán hoá đơn và đặt chỗ"** → thay bởi **Đ01 + Đ03**. Lý do: suy ra từ 3 ảnh và 6 tài liệu trước khi biết rubric. Rubric đòi **cả hai vai** (Cư dân *và* BQL) và không có dòng nào về thanh toán. Giữ hướng cũ sẽ đốt deadline vào thứ không được chấm.
- **2026-09-20 — "Cần chủ tịch quyết trần thanh toán và rủi ro điều khoản dịch vụ"** → **rút lại**, không còn đối tượng. Đ02 làm hai câu hỏi này mất căn cứ: không có tiền thật, không có API thật.
- **2026-09-20 — "Lấy modal từ chối đăng ký ngoài giờ làm cảnh demo trung tâm, kèm ý định bền và bộ lập lịch"** → **rút lại** theo chỉ đạo của chủ tịch: ảnh đó chỉ là ví dụ minh hoạ. Hệ quả: P05 bỏ hẳn phần lập lịch và ý định sống qua phiên, chỉ giữ đọc-chính-sách-trước-khi-ghi (Đ10). Tiết kiệm khoảng một ngày công và bỏ được một hạ tầng khó (scheduler bền qua restart).

## 3. Work Packages và Tầng model

| Gói | Nội dung | Tầng | Ngày | Phụ thuộc |
| :-- | :-- | :-- | :-- | :-- |
| P00 | Knowledge Pack mô phỏng + Golden Dataset | 🔴 | D1–D2 | — |
| P01 | Nền tảng, auth 2 vai, ingest, **deploy** | 🟠 | D2 | P00 (schema) |
| P02 | RAG có trích dẫn, memory, 3 agent, cổng escalate | 🔴🟠 | D3–D4 | P00, P01 |
| P03 | Console BQL: quản lý tài liệu + duyệt câu trả lời (HITL) | 🟠 | D4–D5 | P01, P02 |
| P04 | Bảng eval faithfulness/relevance + dashboard | 🟠 | D5 | P00, P02 |
| P05 | Lớp hành động: đọc chính sách, đặt chỗ, biên nhận, hoàn tác | 🟠 | D6 | **Cổng: P01–P04 xanh** |
| P06 | Kịch bản demo, dữ liệu mồi, dự phòng | 🟢 | D7 | tất cả |

## 4. Checklist thực thi

- [ ] P00 — Knowledge Pack mô phỏng đủ phủ 12 tiện ích và 5 intent
- [ ] P00 — Khuyết tật cài sẵn: 2 gap + 1 cặp conflict + 1 expired
- [ ] P00 — Golden Dataset và rubric chấm
- [ ] P01 — Deploy được URL công khai
- [ ] P01 — Đăng nhập 2 vai trò Cư dân / BQL
- [ ] P02 — Trả lời có trích dẫn tới `document_id` và `section_id`
- [ ] P02 — Lịch sử hội thoại bền qua phiên
- [ ] P02 — Ba agent chạy tách bạch, log được từng chặng
- [ ] P02 — Escalate đúng theo 4 tín hiệu (Đ07)
- [ ] P03 — BQL upload / đổi version / đổi status tài liệu, ảnh hưởng ngay tới retrieval
- [ ] P03 — Hàng đợi duyệt câu trả lời, có sửa và có từ chối
- [ ] P04 — Bảng eval faithfulness và relevance trên Golden
- [ ] P04 — Dashboard tỉ lệ tự động giải quyết, tách theo intent và lý do escalate
- [ ] P05 — Đọc điều kiện trước khi ghi, không thử-và-hỏng
- [ ] P05 — Đặt chỗ có biên nhận và hoàn tác
- [ ] P06 — Kịch bản demo diễn trọn không vấp

## 5. Bảng trỏ SPEC

| SPEC | Phủ nội dung | Trạng thái |
| :-- | :-- | :-- |
| `specs/00-ARCHITECTURE.md` | Mục tiêu, non-goals, bất biến, router thứ tự đọc | ✅ |
| `specs/01-CONTRACTS.md` | Schema tài liệu tri thức, enum reason code, DDL, hợp đồng 3 agent, log | ✅ |
| `specs/SPEC-P00-Knowledge-Golden.md` | Cấu trúc Knowledge Pack, metadata, khuyết tật cài sẵn, Golden và rubric | ✅ |
| `specs/SPEC-P02-Agent-Pipeline.md` | Ba agent, cổng escalate, memory, trích dẫn | ✅ |
| `specs/SPEC-P03-BQL-Console.md` | Vòng đời tài liệu, HITL duyệt câu trả lời | ✅ |
| `specs/SPEC-P04-Eval-Dashboard.md` | Phép đo, công thức, nguồn số liệu | ✅ |
| `specs/SPEC-P05-Action-Layer.md` | Đọc chính sách, đặt chỗ, biên nhận, hoàn tác | ✅ |
| `specs/OPERATIONS.md` | Deploy, biến môi trường, seed, rollback, công tắc ngắt | ✅ |
| `specs/TESTING-ACCEPTANCE.md` | Ma trận test, số đo, Exit Gates theo môi trường | ✅ |

## 6. Tài liệu phân tích nền (không phải SPEC)

- Bản đồ năng lực rút từ 3 ảnh: 53 affordance → 46 capability (28 đọc / 18 ghi, 9 bất khả hoàn tác); 10/12 tiện ích trên app thiếu nguồn nội quy tương ứng; 2 tài liệu nội quy không có mục nào trên app.
- Sổ mâu thuẫn v0.2 với mô hình tự chủ: 117 ràng buộc — 29 tái diễn giải được, 37 phải giữ nguyên.
- Hai tài liệu nằm ở scratchpad của phiên. Nội dung cần giữ đã được chưng cất vào Mục 2 và sẽ vào `specs/`.

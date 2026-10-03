# Kế hoạch 02 — Chuyển engine sang flow CR-BPTN-03 (tầng an toàn, ưu tiên, gộp an toàn)

| Metadata | Giá trị |
|---|---|
| Mã kế hoạch | `02_2026-10-02_cr-bptn-03-hybrid` |
| Trạng thái | 🟠 ĐANG THỰC THI |
| Phiên bản đích | `0.7.0` (MINOR — thêm tầng an toàn/ưu tiên/gộp; giữ 10 trạng thái, API cũ còn nguyên trừ `reopen`) |
| Nhánh | `feature/chamanh` (base `b941d7e`) |
| Người yêu cầu | anhlethicham-source |
| Khởi tạo | 2026-10-02 |
| Hoàn tất | — |

## Bảng SPEC

| File | Nội dung |
|---|---|
| [specs/00-ARCHITECTURE.md](specs/00-ARCHITECTURE.md) | Nguồn chân lý, mục tiêu, non-goals, bất biến, vùng cấm, drift so với CR-03 |
| [specs/01-CONTRACTS.md](specs/01-CONTRACTS.md) | Enum/field mới, bảng chuyển trạng thái code, endpoint, bảng lỗi → HTTP, cấu hình |
| [specs/SPEC-P01-SAFETY.md](specs/SPEC-P01-SAFETY.md) | Bộ nhận diện an toàn `safety.py`, bước 3b, hành động BPTN/BQL |
| [specs/SPEC-P02-PRIORITY-MERGE.md](specs/SPEC-P02-PRIORITY-MERGE.md) | Ưu tiên PRI-*, gộp/hoàn tác gộp, hủy ticket gốc, ticket tiếp theo |
| [specs/SPEC-P03-DEPT-REOPEN.md](specs/SPEC-P03-DEPT-REOPEN.md) | T15 đếm, T16/T17/E02, bỏ reopen, rating một lần |
| [specs/OPERATIONS.md](specs/OPERATIONS.md) | Triển khai, tương thích dữ liệu JSONB cũ, rollback |
| [specs/TESTING-ACCEPTANCE.md](specs/TESTING-ACCEPTANCE.md) | Ma trận AC-01…AC-20 → test, bộ ≥40 câu an toàn, Exit Gates |

## Nhật ký quyết định

| Thời điểm | Quyết định | Lý do |
|---|---|---|
| 2026-10-02 | Người dùng: "chuyển theo logic CR-BPTN 3, bản CR-BPTN 2 cũ rồi" ⇒ CR-03 là spec đích cho code | Lệnh người dùng |
| 2026-10-02 | Người dùng: "vẫn đặt activity diagram của tôi được ưu tiên" ⇒ chỗ CR-03 khác biểu đồ swimlane 2026-10-01 thì theo biểu đồ (CR-03 §19 đã đồng bộ thứ tự bước, thiếu dữ liệu → BPTN, rework → chính phòng ban) | Lệnh người dùng |
| 2026-10-02 | Người dùng: "phần nào config thì nhắn lại" ⇒ mọi ngưỡng để trong `catalog.yaml` `sla_config`, giá trị "đề xuất" của CR-03 (D-02, D-03) dùng tạm và liệt kê lại cho người dùng chốt | Lệnh người dùng; CR-03 §0.3 cấm hardcode |
| 2026-10-02 | Làm trọn P0 + P1 của CR-03 §16 trong một đợt | Người dùng giao chuyển toàn bộ logic |
| 2026-10-02 | Bộ nhận diện an toàn viết mới (`src/maintenance/safety.py`), so khớp theo dấu: chữ có dấu khớp chính xác, chữ không dấu khớp lỏng | Tránh "chạy/chảy" → "cháy", "khỏi" → "khói" khi cư dân gõ có dấu; vẫn bắt được bản không dấu |
| 2026-10-02 | Giữ `Case.not_duplicate_of` làm `duplicate_rejected_of` của CR-03 §12.1 (không đổi tên) | Dữ liệu JSONB đã lưu trên Supabase dùng tên cũ |
| 2026-10-02 | `SAFETY_REVIEW_REQUIRED` do BPTN gỡ bằng 3 hành động riêng, KHÔNG qua `bptn_resolve` | CR-03 §6.4: đúng 3 lựa chọn, không phải "gỡ blocker" chung |
| 2026-10-02 | Ghi ticket thứ hai (gộp, hủy gốc, đếm trùng) trong CÙNG transaction với ticket đang thao tác | Không để nửa ghi; repository đã hỗ trợ khoá nhiều dòng |
| 2026-10-02 | Luật phân loại đèn nhận "cháy / nhấp nháy / nổ bóng / chết" | Test AC-03 lộ lỗi: "bóng đèn bị cháy" (B-01, phản ánh phổ biến nhất của PB-TEC-01) rơi vào OUT_OF_SCOPE |
| 2026-10-02 | `return_wrong_department` ghim `expected_from=ROUTED` | Sau khi có T16, gọi trả lại trên ticket IN_PROGRESS sẽ âm thầm thành T16 |
| 2026-10-02 | Version app giữ `0.5.0-candidate` đến khi đóng kế hoạch (kế hoạch 01 → 0.6.0, kế hoạch 02 → 0.7.0) | AGENTS §3.4: tăng version khi nghiệm thu, cổng server chưa qua |

### Quyết định bị thay thế

| Thời điểm | Quyết định cũ | Thay bằng |
|---|---|---|
| 2026-09-29 | CR-BPTN-02: bỏ luật an toàn và EXCEPTION, CLN-004/TEC-005 đi flow thường | CR-03 tầng an toàn 3b; CLN-004, TEC-005 → `EMERGENCY_PENDING_BQL` |
| 2026-09-29 | CR-BPTN-02: cư dân "báo chưa xong" (reopen) trong 7 ngày | CR-03 §4.3: bỏ reopen; cư dân tạo ticket mới |

## Work Packages

| WP | Nội dung | Tầng |
|---|---|---|
| WP1 | Enum, model, catalog `sla_config`, tương thích JSONB cũ | 🟠 |
| WP2 | `safety.py` + bước 3b + hành động an toàn BPTN/BQL | 🔴 (luật an toàn) |
| WP3 | Ưu tiên, gộp/hoàn tác/hủy gốc, ticket tiếp theo | 🟠 |
| WP4 | T15 đếm, T16/T17/E02, bỏ reopen, rating một lần | 🟠 |
| WP5 | API + view + i18n + UI | 🟠 |
| WP6 | Fixture, test AC-01…AC-20, bộ ≥40 câu | 🟠 |
| WP7 | Đồng bộ não (Ma Trận 6 Điểm) + tài liệu | 🟢 |

## Checklist thực thi

- [x] WP1 enum/model/config
- [x] WP2 an toàn
- [x] WP3 ưu tiên + gộp
- [x] WP4 phòng ban + bỏ reopen + rating
- [x] WP5 API/view/UI
- [x] WP6 fixture + test
- [x] Cổng nghiệm thu local: `pytest`, `ruff check`, `ruff format --check` (`evidence/gates/`)
- [x] WP7 đồng bộ não
- [ ] Người dùng chốt D-02 (4 h / 12 h), D-03 (3)
- [ ] Cổng server (Supabase): đọc lại ticket cũ không lỗi, seed mới đúng — chờ người deploy

# maintenance — chuẩn bị nghiệp vụ CR-03 của Trường

## Trạng thái và nguồn

Bộ đầu ra cho việc 01/10–02/10 được thực hiện ngày 2026-10-03, theo lựa chọn người dùng trong phiên này và plan Notion:
https://storm-jade-f74.notion.site/K-ho-ch-MaintenanceOps-MVP-3e43b68a924d80d7a81fe0579e1eddb9

Hồ sơ: [plan 02](../planning/02_2026-10-03_truong-mvp-prep/plan.md).
D-01 được người dùng xác nhận; D-02–D-07 dùng mặc định CR-03. D-08 APPROVED: người dùng thông báo leader Lê Thị Châm Anh duyệt phạm vi MVP 04/10 và D-01–D-07; ngày duyệt được báo là 2026-10-02, chưa cung cấp giờ. Ghi nhận ngày 2026-10-03; commit a5e2705/PR #6 là bản tham chiếu được người dùng xác nhận trong phiên này, không khẳng định commit đã tồn tại ngày 02/10. Nguồn: thông báo người dùng trong phiên; chưa có link biên bản ngoài. Không mở rộng thành duyệt mọi CR/backlog hoặc nghiệm thu runtime.

## Phân biệt ba tầng

- Baseline đang chạy: engine CR-BPTN-02, fixture `seed/maintenance_v1/`; không thay đổi hành vi đang chạy trong gói chuẩn bị.
- Rules/nhãn đích: module thuần `src/maintenance/safety.py`, safety P0; fixture CR-03 ở `seed/maintenance_cr03/`.
- Tích hợp đích còn chờ: Như Ý nối safety và D-01 vào engine, models, storage, API; nghiệm thu online bởi nhóm. Không tuyên bố safety đã bảo vệ API.

## Router

1. [Phạm vi](../planning/02_2026-10-03_truong-mvp-prep/specs/00-ARCHITECTURE.md).
2. [Quyết định và contract D-01](../planning/02_2026-10-03_truong-mvp-prep/specs/01-CONTRACTS.md).
3. [Bốn nhóm demo](../planning/02_2026-10-03_truong-mvp-prep/specs/OPERATIONS.md).
4. [Rules safety](../planning/02_2026-10-03_truong-mvp-prep/specs/SPEC-P04-SAFETY.md).
5. [Fixture và nghiệm thu](../planning/02_2026-10-03_truong-mvp-prep/specs/TESTING-ACCEPTANCE.md).

## Contract rules local

`assess_safety(text: str, previous_risk: str = "NONE") -> SafetyAssessment` là hàm không IO/LLM, không đổi Case.
Thứ tự risk: `NONE < UNCLEAR < EMERGENCY`; hợp nhất với previous risk bằng max. Truyền previous risk không hợp lệ phải báo ValueError.
P0: S-01–S-05/S-09/S-14, Bậc 2 và B-01–B-04; P1 chưa thuộc gói.
Snapshot D-01 chỉ giữ dữ liệu có cấu trúc. Nội dung raw, additions và source quotes lưu để audit, không nhét lại vào payload LLM của delta.

## Kiểm tra và vận hành

```powershell
python -m pytest -q
python -m ruff check src tests
python -m ruff format --check src tests
```

Không chạy `--pg` lên Supabase dùng chung. Cấm reset remote/deploy/push trong gói. Không đổi startup sang fixture đích khi engine chưa hỗ trợ blocker khẩn cấp.
Bằng chứng local và số đo chính thức được root ghi sau review ở `planning/02_2026-10-03_truong-mvp-prep/evidence/root/`.
Không tăng phiên bản ứng dụng hoặc gắn release mới khi plan chưa qua group/runtime/online gates; version bộ nhãn được quản lý riêng.


## Kết quả chuẩn bị local ngày 2026-10-03

5 gói đã có đầu ra và report. Root đo lại 266 tests pass, 20 Postgres deselected; 72 safety tests, 9 target tests; kiểm tra hồ sơ 57/57 pass. Lint và format 3 file Python mới đạt. Python syntax được kiểm tra; repo chưa cấu hình typechecker.
Format toàn repo còn 2 file baseline ngoài phạm vi; Postgres và demo online chưa chạy trong phiên này. Bằng chứng [pytest](../planning/02_2026-10-03_truong-mvp-prep/evidence/root/final-pytest.txt), [hồ sơ](../planning/02_2026-10-03_truong-mvp-prep/evidence/root/package-check.txt).
Hàm safety vẫn là rules độc lập; trạng thái này không có nghĩa API đã tích hợp safety/D-01 hoặc runtime đã được nghiệm thu. D-08 duyệt thiết kế được ghi nhận riêng theo thông báo người dùng.

## Công việc ngày 03/10

[Checklist và hợp đồng 7 task](../planning/02_2026-10-03_truong-mvp-prep/specs/SPEC-P06-DAY03.md): asset, vật tư, trùng cơ bản, wording/quyền và chạy thử 4 demo. Trường chuẩn bị/kiểm thử và bàn giao lỗi; Như Ý sở hữu engine/safety, Châm Anh sở hữu API/storage, Trí sở hữu UI. Chưa có kết quả chạy các task này.

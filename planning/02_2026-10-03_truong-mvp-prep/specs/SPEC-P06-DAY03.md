# SPEC-P06 — Công việc Trường ngày 03/10

Status: PLANNED; owner: Trường; created: 2026-10-03 (Asia/Saigon).
Nguồn: plan Notion, mục 03/10: kiểm tra asset/vật tư, trùng cơ bản, bốn script demo và wording đúng quyền. [Contract](01-CONTRACTS.md), [runbook](OPERATIONS.md), [nghiệm thu](TESTING-ACCEPTANCE.md). D-08 đã được ghi nhận; runtime/online chưa nghiệm thu.

## 1. Phạm vi và ranh giới

BẮT BUỘC kiểm tra nghiệp vụ và ghi expected/actual dựa trên SPEC được duyệt. Trường sở hữu checklist, dữ liệu/nhãn, script demo, wording đề xuất và báo cáo; Như Ý sở hữu engine/safety, Châm Anh sở hữu API/storage/tích hợp, Trí sở hữu UI.
CẤM sửa src/, API, DB schema, runtime safety hoặc weakening tests/gold trong gói ngày 03: tránh chồng trách nhiệm và làm kết quả kiểm thử tự khớp code sai. Module safety.py đã merge là đầu vào tham khảo để Như Ý review, không tiếp tục mở rộng ở gói này. CẤM đưa T16/T17/E02, duplicate-priority nâng cao hoặc reopen/assignee vào MVP vì ngoài scope được duyệt.
Đọc code/nhánh ứng viên trước khi gọi chức năng: ghi SHA và môi trường, không coi runbook CURRENT viết ngày 03 là trạng thái mọi nhánh tương lai. Không bắt buộc coding ứng dụng để hoàn thành các task này.

## 2. Contract đầu ra

Khi thực hiện, ghi kết quả ở `deliverables/day03-results.json`; ghi tổng hợp ở `deliverables/day03-summary.md`; wording đề xuất ở `deliverables/day03-wording.md`, đều trong package này. Chưa tạo kết quả mẫu để tránh nhầm với đo thực tế.
JSON chính xác:
```json
{
  "schema_version": "day03-1",
  "observed_at": "<ISO8601 timezone-aware thực tế>",
  "branch": "<branch được kiểm tra>",
  "commit": "<full SHA 40 hex>",
  "environment": "local|online",
  "base_url": null,
  "records": [
    {
      "case_id": "ASSET-01",
      "task_id": "D3-02",
      "actor_role": "BPTN",
      "steps": ["<bước tái hiện cụ thể>"],
      "input_ref": "<fixture/case/script path hoặc nội dung mô phỏng>",
      "expected": "<điều kiện từ SPEC>",
      "actual": null,
      "result": "NOT_RUN",
      "evidence_refs": [],
      "issue_owner": null,
      "block_reason": null
    }
  ]
}
```
`result` chỉ PASS/FAIL/BLOCKED/NOT_RUN; `actor_role` RESIDENT/BPTN/DEPARTMENT/WAREHOUSE/BQL/SYSTEM; `issue_owner` Trường/Như Ý/Châm Anh/Trí hoặc null. PASS/FAIL bắt buộc actual khác null, bước tái hiện và evidence_refs tồn tại; FAIL bắt buộc issue_owner. BLOCKED bắt buộc block_reason và issue_owner, actual có thể null. NOT_RUN không được diễn giải là đã kiểm tra. Không lưu token/password/ảnh cư dân thật trong báo cáo.
Task chỉ check [x] khi đầu ra và các ca yêu cầu đã được ghi nhận; ca BLOCKED được báo riêng và task vẫn chưa đạt phần kiểm thử. FAIL được ghi đầy đủ nghĩa là đã làm kiểm thử, không phải chức năng được nghiệm thu. Gate runtime/online chỉ đạt khi mọi ca bắt buộc PASS trên đúng môi trường.

## 3. Bảy task và tiêu chí xong

Ước lượng dưới đây là thời gian thao tác, không tính thời gian chờ tích hợp. Tầng là phân loại công việc, không yêu cầu chạy sub-agent.

### D3-01 — Chuẩn bị phiên bản kiểm tra (20 phút, 🟢)
- Giữ bản ghi D-08 local trước khi đồng bộ; kiểm git status, branch, HEAD và origin/develop. Không tự ghi đè thay đổi local.
- Chọn một bản tích hợp và môi trường; xác nhận tài khoản vai trò, dataset, LLM mode, endpoint và danh sách chức năng sẵn có.
- Xong khi: summary có SHA/môi trường/ngày kiểm tra/nguồn dataset; ghi rõ chức năng thiếu. Phụ thuộc: không có; mọi kiểm thử sau dùng cùng manifest hoặc ghi một run mới.

### D3-02 — Kiểm tra asset (40 phút, 🟠)
- ASSET-01: tài sản đèn xác định được → asset đúng; ASSET-02: chưa rõ tài sản → VERIFYING/ASSET_UNCLEAR, chưa giao; ASSET-03: BPTN xác nhận asset onsite (`asset_onsite=true` + note; 2026-10-03 người dùng chốt phương án A, thay chữ cũ "bổ sung asset hợp lệ") → ROUTED với cờ ASSET_CHECK_ONSITE theo OPERATIONS §3.
- Xong khi: 3 record có input, expected, actual và evidence hoặc blocker được nêu rõ. Lỗi engine giao Như Ý; UI giao Trí; API/storage giao Châm Anh. Phụ thuộc D3-01.

### D3-03 — Kiểm tra vật tư/tồn kho (45 phút, 🟠)
- STOCK-01 đủ → đi tiếp; STOCK-02 thiếu trước giao → ON_HOLD/WAITING_MATERIAL, owner WAREHOUSE, chưa giao; STOCK-03 nhập kho mô phỏng → chạy lại từ asset, chỉ giao khi đủ; STOCK-04 UNKNOWN → đi tiếp với STOCK_CHECK_ON_ACCEPT.
- Xong khi: 4 record, có số lượng before/after cho nhập kho và điều kiện nhận việc; không thay catalog/DB trực tiếp để ép đạt. Phụ thuộc D3-01.

### D3-04 — Kiểm tra trùng cơ bản (35 phút, 🟠)
- DUP-01 trùng cùng loại/vị trí trong cửa sổ 48 giờ → dừng BPTN, chưa giao; DUP-02 BPTN xác nhận → con MERGED, giữ liên kết/audit; DUP-03 bác trùng → tiếp tục đúng bước; DUP-04 không cùng loại/vị trí hoặc ngoài cửa sổ → không gộp.
- Dùng dữ liệu mô phỏng có thời điểm cố định; không chờ 48 giờ thực tế. Không kiểm ngưỡng duplicate priority sau MVP.
- Xong khi: 4 record và bằng chứng quyết định BPTN/liên kết; ca có hazard không dùng để lách gate safety. Phụ thuộc D3-01.

### D3-05 — Rà wording và quyền (45 phút, 🟢)
- WORD-01 cư dân chỉ có nhãn/trường public, safety hiển thị đang kiểm tra; WORD-02 BPTN thiếu thông tin/asset và Bậc 2; WORD-03 phòng ban nhận việc/checklist/vật tư/ảnh/báo hoàn thành; WORD-04 BQL duyệt/trả làm lại/đóng và xử lý khẩn cấp.
- Ghi màn hình, câu hiện tại, câu đề xuất, role và lý do trong wording.md; giữ ảnh/capture làm evidence. Nút ẩn không đủ chứng minh phân quyền API; ghi rõ phần UI và phần API chưa đo.
- Xong khi: đủ 4 vai trò và không wording hứa chức năng chưa tích hợp; lỗi nội dung giao Trường, chỉnh UI giao Trí, quyền engine/API giao Như Ý/Châm Anh. Phụ thuộc D3-01; có thể rà script trước khi UI sẵn có.

### D3-06 — Chạy thử bốn script (60 phút, 🟠)
- DEMO-01 happy path vệ sinh + đèn; DEMO-02 thiếu thông tin/asset; DEMO-03 vật tư/nhập kho; DEMO-04 safety Bậc 2/Bậc 1 theo OPERATIONS §2–5.
- Mỗi nhóm ghi actor, input, thao tác, expected, actual, evidence và prerequisite; happy path phải có BQL đóng. DEMO-04 chưa tích hợp thì BLOCKED giao Như Ý, không thay bằng demo baseline rồi đánh PASS.
- Xong khi: 4 script tái hiện được, đủ hai nhánh happy path và lựa chọn safety bắt buộc; đánh riêng trạng thái chạy thử. Phụ thuộc D3-02/03/04 cho các nhánh liên quan; chuẩn bị script được làm trong lúc chờ runtime.

### D3-07 — Tổng hợp và bàn giao ngày 04/10 (20 phút, 🟢)
- Tổng hợp PASS/FAIL/BLOCKED/NOT_RUN từ record thực tế, mỗi lỗi có owner/bước tái hiện/evidence; không gửi thông báo thành viên nếu chưa có lệnh.
- Chỉ ra script dùng được, lỗi ngăn demo, phần mô phỏng và nhu cầu bản online; online/persistence restart vẫn là gate ngày 04.
- Xong khi: summary và results nhất quán, lỗi engine→Như Ý, API/storage→Châm Anh, UI→Trí; có danh sách điều kiện trước nghiệm thu online. Phụ thuộc D3-02..06.

## 4. Lỗi và hành vi bắt buộc

- LOCAL_DIRTY: bảo toàn D-08/thay đổi có sẵn, lưu hoặc xử lý đúng phạm vi trước đồng bộ; cấm reset/stash mù.
- BUILD_NOT_READY/API_MISSING: ghi BLOCKED + owner, tiếp tục phần rà tài liệu độc lập; cấm fake PASS.
- EXPECTED_MISMATCH: ghi FAIL + actual/evidence; không tự đổi oracle để đạt.
- 401/403: ghi role/đáp ứng, kiểm tài khoản; không đổi vai để che lỗi phân quyền.
- 409/422: ghi response và điều kiện trước; sửa đầu vào hợp lệ, không bypass guard.
- 5xx/store/photo error: dừng mutation, kiểm state trước retry; giao Châm Anh/Như Ý theo căn nguyên.
- SHARED_ENVIRONMENT: chỉ thao tác khi môi trường demo và phạm vi dữ liệu đã được cho phép; không reset DB chung, không deploy. Local dùng runbook cô lập; kết thúc dừng đúng process, không xóa dữ liệu chia sẻ.
- BOOT_HUB_MISSING: ghi exit thực tế, không sửa managed rules; không đánh brain compliant.

## 5. Nghiệm thu và bằng chứng

Hiện mới lập task: 7 task PLANNED; asset 3, stock 4, duplicate 4, wording 4 vai trò, demo 4 nhóm = tối thiểu 19 record (demo có thể tách thêm bước). Không có ca thực thi ngày 03 được tuyên bố PASS tại lúc tạo SPEC này.
Local gate: đủ các record và bằng chứng; trạng thái FAIL/BLOCKED giữ trong báo cáo, không biến thành chức năng đạt. Group D-08 đã ghi nhận riêng; runtime/online chưa đạt. Kiểm tra tạo hồ sơ được ghi bằng output máy trong evidence/root/day03-plan-check.txt; chưa thay bằng chứng test ứng dụng lịch sử.

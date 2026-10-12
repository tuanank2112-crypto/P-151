# Dàn ý pitch 10 slide — MaintenanceOps (bản nháp)

Quy tắc: mỗi tuyên bố có nguồn; chưa có bằng chứng ⇒ không nói hoặc nói là "chưa đo". Số dưới đây là số thật tại 2026-10-03; cập nhật trước 18/10.

| # | Slide | Nội dung chính | Bằng chứng / trạng thái |
|---|---|---|---|
| 1 | Bài toán | BPTN phải đọc, phân loại, điều phối phản ánh hạ tầng chung; chậm và dễ sót việc nguy hiểm | `brain4agent/project-intro.md`; số liệu thực địa: chưa có |
| 2 | Người dùng | Cư dân, BPTN, phòng ban (vệ sinh/kỹ thuật), kho, BQL | `docs/CR-BPTN-03.md` (mục vai trò/quyền) |
| 3 | Giải pháp | Agent kiểm tra, an toàn trước rồi phân loại, tra asset/vật tư, giao phòng ban, BQL nghiệm thu; người quyết ở các điểm dừng | CR-03 §5.1; pipeline trong `docs/maintenance.md` |
| 4 | Demo | Bốn luồng: happy path (vệ sinh + đèn), thiếu thông tin/asset, thiếu vật tư, an toàn Bậc 2/Bậc 1 | `planning/02_.../deliverables/day03q-summary.md`: DEMO-01..04 PASS trên local |
| 5 | Kiến trúc | Engine thuần Python + state machine + audit fail-closed; tầng an toàn luật cố định; LLM chỉ nâng mức; lưu bền memory/Postgres | `brain4agent/-data-architecture.md`; swimlane (15/10) |
| 6 | Chiều sâu | Safety 2 bậc, không tự hạ risk, chỉ người có quyền gỡ; rating một lần; chặn đóng khẩn cấp bằng route thường | test_safety/test_emergency; Day03: 34/34 ca từ chối 403 |
| 7 | Eval | Nhãn safety ≥40 câu (hiện 62 câu gold trong test_safety_p0 + 34 ca safety_cases.json, theo hồ sơ merge của Như Ý), classification ≥90% held-out, 0 bỏ sót Bậc 1 | Số held-out và coverage: CHƯA đo (đóng băng 13/10) |
| 8 | UX | Lời hiển thị cho cư dân từ `vi.yaml`, UI theo vai; kết quả user test 3–5 người | User test: CHƯA chạy (10–12/10) |
| 9 | Giới hạn | Dữ liệu mô phỏng `SIM-`; D-01 delta/snapshot làm sau; gate runtime/online chưa nghiệm thu; persistence restart chưa đo; CI GitHub hết hạn mức | plan 02 §Exit gates; roadmap Active |
| 10 | Bước tiếp | 19/10: P1, LangGraph trên đường chạy thật, eval, D-01 | roadmap Upcoming |

## Tuyên bố CẤM nếu chưa có bằng chứng mới
"đã chạy production/online", "đã giảm X% thời gian" (chưa có user test), "an toàn đã nghiệm thu", "D-01 đã code", "LangGraph đã chạy thật".

## Việc cần làm theo lịch
15/10 swimlane + problem statement; 16/10 slide hoàn chỉnh; 17–18/10 tập và đối chiếu từng con số với evidence; 19/10 sign-off.

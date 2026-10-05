Vai: Bạn là worker của repo này — loại THẨM ĐỊNH + QUYẾT ĐỊNH nghiệp vụ, chủ việc rules/playbook/spec/dataset (Trường), tầng 🔴 (quyết định spec) và 🟠 (rà luật).
Bước 0: từ root repo chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` (exit 0 là đủ).
Đọc theo thứ tự: `planning/04_2026-10-04_logic-review-fix/plan.md` §1 (C1, C2, S1, S2) và Q12–Q15; `docs/maintenance.md` §12; `src/maintenance/rules.py`; `seed/maintenance_v1/lexicon.yaml` (khối `safety`, `priority.high_areas`); `planning/04_2026-10-04_logic-review-fix/reports/R01_safety-lexicon.md`.

## 1. Bối cảnh
Như Ý (theo yêu cầu "fix agent") đã sửa phần phân loại và tách vị trí trong `rules.py` (vùng rules của Trường) và từ vựng an toàn (3 vòng + thẩm định đối kháng độc lập). Cần Trường rà lại vì là vùng của Trường, và quyết hai điểm spec.

## 2. Phạm vi
- ĐƯỢC: đọc toàn bộ; sửa `rules.py`, `lexicon.yaml`, fixture/nhãn của Trường, `docs/CR-BPTN-03.md` nếu quyết đổi spec.
- CẤM chạm: `engine.py`, `src/api/`, `src/web/`.

## 3. Việc phải làm
(a) Rà phần đã sửa (đang trong PR plan 04):
- Q22 ĐÃ ĐÓNG: "bóng đèn … bị cháy" ⇒ KY_THUAT (2b chạy trước nên cháy thật không tới phân loại). Test cũ ghim OUT_OF_SCOPE ở `test_safety.py::test_benign_lamp_report_routes_normally` đã đổi theo.
- Đèn có dấu + khu vực chung ở bất kỳ đâu trong câu ⇒ KY_THUAT ("Cầu thang bộ tầng 6 … đèn bị hỏng"); câu có cả rác và đèn hỏng ⇒ CATEGORY_UNCLEAR (test `test_llm_abstaining_on_a_rules_match_is_ambiguous` đổi dòng kỳ vọng luật).
- "đèn"/"đến", "Bùi"/"bụi", "bận"/"bẩn" phân biệt trên chữ có dấu; thêm triệu chứng đèn (nhấp nháy, hư, vỡ, không lên, mất đèn) và từ vệ sinh (bẩn, dơ, phân, nôn, nước tiểu — chỉ khi có khu vực chung).
- Tách vị trí: thêm khu vực Cầu thang bộ ("thang bộ"), Phòng rác, Bãi đỗ xe, Sân chơi, Sân thượng, Lối đi; tầng "trệt"/"lầu N"; tòa "tòa nhà X"/"block X". `priority.high_areas` thêm Bãi đỗ xe, Lối đi (PRI-H1). Câu nhắc cư dân về khu vực (`i18n/vi.yaml`) đổi theo.
- Từ vựng an toàn `2026-10-04.p0d`: thang máy kẹt có người, té xỉu/ngã nằm im, dây điện rơi/tróc vỏ/lủng lẳng, bốc hỏa, khói nhiều/rất nhiều, lửa lớn, kêu cứu ⇒ Bậc 1; "bị ngắt"/"khối rác"/"bật lửa để quên"/"khói thuốc"/"kẹt, người dùng" ⇒ không báo nhầm. `safety._b01_ok`: B-01 không áp qua chỗ ngắt mệnh đề. Bộ dừng 1065 ca xanh, ngân sách báo nhầm không đổi.
(b) Quyết spec (ghi D-xx/Q vào CR-03 hoặc hồ sơ của Trường):
- Phản ánh ngoài phạm vi ("phí quản lý", "vòi nước căn hộ", "thang máy hỏng") bị hỏi tòa/tầng/khu vực vì CR §5.1 đặt bước 2 (dữ liệu) trước bước 3 (phân loại). Có đổi để ngoài phạm vi dừng OUT_OF_SCOPE mà không hỏi vị trí không?
- "Cháy" đứng riêng (B-03) chỉ Bậc 2 — "Căn hộ 1205 cháy, đèn tắt hết" ra UNCLEAR. Có nâng không?
- Còn lại trong spec an toàn: marker "giờ hết rồi" hạ cả mệnh đề có người ngất (SPEC-P01 A2); "kêu cứu" nghĩa bóng lên Bậc 1 (SO chọn, Q12).
(c) Dữ liệu mẫu: danh mục chỉ 6 asset LIGHTING ⇒ hầu hết báo hỏng đèn dừng ASSET_UNCLEAR chờ BPTN; cân nhắc thêm asset cho các vị trí demo.
(d) Hồ sơ của Trường `planning/04_2026-10-03_user-test-pitch/` (nhánh `feature/truong`) trùng STT 04 với `planning/04_2026-10-04_logic-review-fix/` — một bên đổi STT trước khi gộp (Path Invariant: hồ sơ đã có trên `develop` giữ nguyên).

Xong khi: (a) có kết luận đồng ý/sửa từng mục (nếu sửa: pytest + bộ dừng xanh); (b) mỗi câu hỏi có quyết định ghi tên người duyệt; (d) STT không còn trùng.

## 4. Luật
Sửa từ vựng ⇒ chạy bộ dừng (`tests/test_maintenance/test_safety.py`). Quyết định nghiệp vụ ghi tên người duyệt + kết quả thật. Conventional Commits tiếng Anh; mọi commit cập nhật `brain4agent/memory/hot/`.

## 5. Tầng
(a)(c)(d) 🟠 · (b) 🔴.

## 6. Mẫu report (ghi `planning/04_2026-10-04_logic-review-fix/reports/R05_rules-spec.md`)
Dòng 1 `Vai · thẩm định · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4 `Handoff: H05_rules-spec.md` / `Base:` / `Head:`; rồi kết luận từng mục, quyết định + người duyệt, lệnh + exit code nếu có sửa; dòng cuối phán quyết.

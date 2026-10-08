# Day05 — tóm tắt bàn giao (phần local, offline)

> **Hiện hành (08/10/2026): PRELIMINARY_15 đã được Trường duyệt.** 15 câu AUTHORED đã nhận; chờ review Như Ý/Châm Anh và baseline. Các mốc 30 held-out, 80/40 gold phía dưới là lịch sử, không còn là quota nghiệm thu Day05 sơ bộ. Xem SPEC-P03-PRELIMINARY15.

> Trạng thái: **CHƯA ĐÓNG**. Dữ liệu và công cụ đã chuẩn bị; **chưa có review người thật nào**. Đây không phải xác nhận leader đã duyệt backlog, cũng không phải người thật đã duyệt gold. Đo ngày 2026-10-07 trên base `8dd6baa5e733fd9dd917b30522b131d520471e05` (working tree dirty có sẵn). Task date 05/10, không ghi lùi ngày review.

## 1. Số đo thật
| Hạng mục | Kết quả | Evidence |
|---|---|---|
| Backlog | 15 mục, 11/11 issue Day04 được phủ; 15/15 `owner_acceptance=PROPOSED`; 0 CLOSED; validator `--backlog` PASS exit 0 | `evidence/run02-orch-measure/validate-backlog.txt` |
| D4-11 | OPEN/CRITICAL/P0. Đo lại: "có trẻ con bị kẹt ở sảnh chung cư tòa S5/S1" ⇒ NONE; "bị mắc kẹt" ⇒ EMERGENCY. Không suy do S5 | `evidence/run00-baseline/d411-probe.txt` |
| Câu nguồn | 50 DEVELOP (agent soạn, `LLM_PROPOSAL`, riêng 1 câu gốc `USER_REPORTED_SYNTHETIC`); 30 family; F-D4-11 = 8 câu (4 positive + 4 control) | `cases.json` |
| Proposal | 50 SAFETY (15 EM / 15 UNCLEAR / 20 NONE) + 20 CLASSIFICATION (8 VE_SINH / 8 đèn / 4 UNKNOWN); tất cả `PROPOSED`, chưa phải gold | `label-proposals.json` |
| Gold ACCEPTED | **0 safety / 0 classification** (cần ≥80 / ≥40); disputes 0 | `safety-gold.json`, `classification-gold.json` (records rỗng) |
| Held-out | **0/30** — phải do người soạn (AUTHORED); chỉ có yêu cầu | `held-out-request.md` |
| Split | Bản nháp, `frozen=false`, held_out rỗng; family leakage 0 (chưa có held-out để rò) | `split-manifest.json` |
| Baseline | **Chưa chạy**: runner trả `NO_VALID_GOLD` exit 2, không ghi file; held-out `HELDOUT_NOT_FROZEN`; luna `LUNA_NOT_AUTHORIZED` | `evidence/run03-orch-gates/` |
| Công cụ | pytest **270** pass / 0 fail / 0 skip (sau H05); ruff check + format exit 0; typecheck NOT_CONFIGURED; 10/10 đột biến của orchestrator + toàn bộ tấn công attack_b của auditor bị từ chối | `evidence/run04-harden/`, `run05-orch-remeasure/` |
| Thẩm định cô lập | auditor-sonnet (không đọc report): mọi số trong bản tóm tắt khớp đĩa; tìm 1 blocker (blind sheet lộ nhãn qua case_id) + 5 major (reviewer yếu, freeze không kiểm hash, eligibility, runner không dừng khi lỗi, rò text/family) ⇒ sửa ở H05, đo lại. **Chưa chạy vòng thẩm định thứ hai** | R03/R05 |
| Blind review | `review/blind-review-sheet.json` 50 câu, ID mờ `RV-001..`, thứ tự xáo, 0 chuỗi `D5-C-`; bảng ánh xạ ở `review-key/id-map.json` (chỉ điều phối) | `evidence/run05-orch-remeasure/review-pack-final.txt` |

## 2. Gate (TESTING-ACCEPTANCE)
- G1 backlog: ⬜ cấu trúc ✅ (validator); chưa có leader/owner xác nhận.
- G2 annotation: ⬜ 0/80 safety, 0/40 classification ACCEPTED.
- G3 split: ⬜ chưa có held-out; DEVELOP đã gán nhưng chưa freeze.
- G4 baseline: ⬜ chưa chạy (đúng luật: chưa có gold hợp lệ).
- G5 bàn giao: ⬜ file/hash/report đủ ✅; reviewer/leader duyệt thật ⬜.
- Runtime safety fix (D4-11): ⬜ OPEN. Online/product: ngoài scope Day05, không tick.

## 3. Việc NGƯỜI phải làm (agent không thể thay)
1. Leader duyệt scope/priority backlog; từng owner xác nhận nhận việc (ghi tên + thời điểm thật).
2. Reviewer độc lập (Như Ý/leader cho safety; người khác Trường cho classification) review mù theo `review/REVIEW-GUIDE.md` trên `review/blind-review-sheet.json`; các nhãn cần soi: 0028 "cầu dao bị cháy", 0029 "mùi cơm khét", 0044/0035/0048 (NONE theo B-01/Q22), cách ghi T2-01/T2-02 (xem mục 4).
3. Trường (hoặc người soạn) viết 30 câu held-out AUTHORED theo `held-out-request.md`.
4. Quyết định môi trường QA/phạm vi ghi shared cho retest D5-B-002..006; Luna có được gọi không (credit chưa đo).

## 4. Điểm diễn giải cần người quyết (không tự đổi contract)
- split-manifest có thêm `frozen`, `hash`, `family_exceptions` ở root (contract chưa định nghĩa shape này).
- Safety MATCH của baseline chỉ so `risk_level`; tập signal chỉ báo riêng (`signal_set_differs`).
- Backlog CLOSED: "evidence retest" = `evidence_refs` không rỗng và file tồn tại.
- Câu UNCLEAR hedge/đã-hết được ghi 2 signal (`S-0x` UNCLEAR + `T2-01/02` PRESENT); lexicon coi T2-01/02 không phải signal riêng — reviewer chọn giữ cả hai hay một.
- A5f: runner loại case có OPEN dispute (liệt kê trong `summary.excluded_open_dispute`) và vẫn exit 0; khoá `case_id` trong blind sheet giữ tên (giá trị RV-nnn). Hash freeze = sha256 của dòng `<file>:<sha256>` nối bằng newline theo thứ tự cases/classification-gold/safety-gold/disputes (diễn giải orchestrator ở H05, không đổi contract).
- Câu 0038 đã đổi "đầy tràn" → "đầy ắp" để tránh va chạm "day tran"/"dây trần"; nếu muốn giữ làm case bẫy riêng thì phải quyết.

## 5. Giới hạn
Không gọi LLM/Luna, Supabase, API ghi, jobs, reset DB; không đọc `.env`. Câu và proposal do agent (Claude) soạn offline — không độc lập với các agent soạn; không dùng làm held-out. Baseline rules chưa có số vì chưa có gold. Số test app 2973 không chạy lại (ngoài scope kiểm của gói dữ liệu).

## 6. Sau khi có review
`validate_day05.py --data-dir deliverables` ⇒ exit 0 ⇒ freeze `split-manifest.json` (`frozen:true` + hash) ⇒ `run_day05_baseline.py --split develop`, rồi `--split held-out` một lần; mismatch ⇒ backlog đúng owner, KHÔNG sửa gold.


## Cập nhật xác nhận phân công (2026-10-07T16:39:35.819793+00:00)

Người dùng xác nhận nhóm đã thống nhất D4-11 / D5-B-011: Như Ý sửa safety; Trường chuẩn bị câu kiểm thử; Châm Anh kiểm tra API. Backlog hiện có 1 mục CONFIRMED và 14 mục PROPOSED. Đây là xác nhận phân công, chưa phải kết quả sửa lỗi: D4-11 vẫn OPEN/CRITICAL/P0, chờ kiểm thử lại bản sửa. Chưa có xác nhận reviewer/nhãn gold hoặc nghiệm thu toàn bộ Day05. Các số đo và manifest trước cập nhật này là bằng chứng lịch sử; hash backlog đã thay đổi do ghi nhận xác nhận.


### Làm rõ phạm vi thí điểm (2026-10-07T16:42:43.541758+00:00)

Người dùng xác nhận S5 không tồn tại trong các cụm thí điểm. Catalog hiện tại khai báo S1/S2 (`seed/maintenance_v1/catalog.yaml`). Đính chính đề xuất trước: không dùng S5 như địa điểm hợp lệ để nghiệm thu luồng API/BQL; dùng S1/S2 cho ca trong phạm vi. Giữ câu S5 gốc trong lịch sử và bộ đối chiếu ngoài phạm vi. Phân biệt nhãn nguy hiểm của nội dung với tính hợp lệ của địa điểm; người dùng chưa duyệt chính sách chuyển tiếp khẩn cấp ngoài phạm vi, không tự đặt expected route cho ca S5. Phép đo assess trên câu S1 vẫn là bằng chứng độc lập về biến thể “bị kẹt”; D4-11 giữ OPEN và phân công đã xác nhận không đổi. Không sửa runtime, gold hay bằng chứng máy cũ.


## Rà soát phần còn lại Day05 (2026-10-07T16:47:40.721485+00:00)

- Hoàn thiện 10 câu kiểm thử D4-11 (4 positive trong S1/S2, 4 control, 2 ngoài phạm vi S5), mẫu nhập 30 câu held-out và mẫu xác nhận đủ 15 backlog. Tất cả nhãn đề xuất giữ PROPOSED.
- Đo mới: backlog exit 0; structure-only exit 0; công cụ 270 pass / 0 fail / 0 skip. Full quota/review gate exit 1; baseline develop exit 2 NO_VALID_GOLD; held-out exit 2 HELDOUT_NOT_FROZEN.
- Probe rules D4-11: 4/10 khác proposal, IDs D411-T01, D411-T02, D411-T05, D411-T09; không tính accuracy/FN chính thức vì proposal chưa được người duyệt; không gọi API hay ghi Supabase.
- Còn thiếu đầu vào thật: 30 câu AUTHORED, người review nhãn, xác nhận 14 backlog và các lựa chọn contract/chính sách. Day05 vẫn mở. Yêu cầu agent hoàn thiện công việc không thay thế các quyết định này.
- Hướng dẫn thao tác: `planning/09_2026-10-07_day05-labels/deliverables/completion-guide.md`; evidence `planning/09_2026-10-07_day05-labels/evidence/day05-completion-20261007/commands.json`.


## Scope Day05 đã duyệt: PRELIMINARY_15 (2026-10-08T08:59:38.730526+00:00)

Trường xác nhận đánh giá sơ bộ bằng 15 câu do Trường tự soạn thay yêu cầu 30 câu held-out. Các quota 80 safety/40 classification và minimum32 family của hồ sơ rộng không còn chặn nghiệm thu Day05 sơ bộ. Vẫn cần review safety bởi Như Ý, classification bởi Châm Anh, kiểm tra nhóm biến thể/nguồn, baseline thật, xác nhận backlog và report/manifest. Không suy nghiệm thu safety đầy đủ, API/online hoặc chất lượng tổng quát. Hiện: 15 AUTHORED, review hoàn tất 0, baseline chưa chạy. Contract đang hiệu lực: planning/09_2026-10-07_day05-labels/specs/SPEC-P03-PRELIMINARY15.md. Quota cũ và bằng chứng cũ được giữ làm lịch sử.

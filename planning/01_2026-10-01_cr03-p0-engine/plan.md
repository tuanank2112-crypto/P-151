# 01 — CR-BPTN-03 P0 cho engine Agent (phần Như Ý)

| Trường | Giá trị |
|---|---|
| Trạng thái | 🚀 ĐANG THI CÔNG — SPEC ✅ 2026-10-01 17:10 |
| Loại SemVer | MINOR (thêm tầng an toàn, priority, hành động mới; giữ tương thích API hiện có) |
| Spec nguồn | [`docs/CR-BPTN-03.md`](../../docs/CR-BPTN-03.md) — P0 ở §16 |
| Chủ việc | Như Ý (engine, state machine, safety, proposer/fallback/injection) |
| Nhánh | `feature/nhuy-cr03-p0` (local, không push) |
| Base SHA | `e5ececf` (trên `1e2f42b` của Châm Anh) |
| Hạn | 2026-10-04 21:00 (nghiệm thu MVP nhóm) |
| Điều phối | super orchestrator (🔴) |

**Mục tiêu một câu:** engine `src/maintenance/` chạy đúng CR-03 P0 — tầng an toàn hai bậc, đường khẩn cấp do BQL xử lý, priority, các chốt chặn — giữ xanh toàn bộ test cũ và có test cho từng AC P0.

---

## §2. Nhật ký quyết định

| # | Mốc | Quyết định | Lý do | Chỗ có thể lật · chi phí lật |
|---|---|---|---|---|
| Q01 | 2026-10-01 16:00 | **Phạm vi chỉ phần Như Ý:** engine, state machine, `safety.py`, proposer guard, views/i18n của engine, catalog `sla_config`. KHÔNG: router/endpoint mới, UI, persistence, deploy, LangGraph. | Người dùng duyệt ("chỉ làm phần của nhuy"); kế hoạch Notion chia chủ việc | Thêm gói endpoint nếu Châm Anh cần · ~0,5 ngày |
| Q02 | 2026-10-01 16:00 | Hành động mới (BPTN xác nhận an toàn/nâng khẩn/hỏi cư dân; BQL đóng/hạ khẩn; đặt priority) chỉ là **method công khai của engine** có chữ ký cố định trong `01-CONTRACTS.md`, để Châm Anh/Trí nối router + UI. | Giữ ranh giới chủ việc | Router do nhóm khác — nếu chậm thì UI chưa bấm được trước 04/10 |
| Q03 | 2026-10-01 16:00 | **Không sửa router/UI để bỏ reopen/gán nhân viên:** bỏ cặp `(CLOSED, READY_FOR_REVIEW)` khỏi `TRANSITIONS` ⇒ `reopen()` trả `INVALID_TRANSITION` (409); `set_assignee` trả `ACTION_DENIED` (403) có audit. Xoá `reopen_until`, `reopen_window_days` khỏi model/catalog. Endpoint + nút UI cũ để chủ việc gỡ sau. | Đạt AC-15 mà không chạm phần người khác | Xoá hẳn method khi router đã gỡ · rẻ |
| Q04 | 2026-10-01 16:00 | Nhánh `feature/nhuy-cr03-p0` từ `e5ececf`; commit local mỗi WP; không push. | Không đè `feature/chamanh` đang có người code | Rebase lên `feature/chamanh` mới trước khi tích hợp · có thể conflict `engine.py` |
| Q05 | 2026-10-01 16:00 | Nền đo: **142/142 pass, 0 skip; ruff check + format sạch** (Python 3.11.7, `LLM_MODE=mock`, venv ngoài repo). Cổng: số test chỉ tăng, 0 fail, 0 skip. | Worker đo 2026-10-01 | — |
| Q06 | 2026-10-01 16:05 | Tín hiệu P0: S-01..S-05, S-09, S-14; Bậc 2 T2-01..T2-05; bẫy B-01..B-04. B-05/C-01, S-06..S-08, S-10..S-13 để P1. | CR-03 §16 | — |
| Q07 | 2026-10-01 16:05 | **Từ vựng luật an toàn là DỮ LIỆU** (file YAML trong `seed/maintenance_v1/`, catalog nạp), logic là CODE (`src/maintenance/safety.py`, hàm thuần). | Trường chủ rules/nhãn (kế hoạch 02/10) sửa từ vựng không cần chạm code | Gộp vào `catalog.yaml` · rẻ |
| Q08 | 2026-10-01 16:05 | **2b chạy khi có nội dung, kể cả thiếu vị trí** (kế hoạch 02/10). Thứ tự thắng: Bậc 1 > Bậc 2 > `MISSING_INFO`. Một ticket một blocker. | Không để ticket nguy hiểm kẹt ở `NEED_INFO` 72 giờ | Đổi thứ tự thắng · sửa 1 hàm + test |
| Q09 | 2026-10-01 16:05 | LLM chỉ nâng mức: P0 cài **hàm gộp `rule ⊕ llm` có guard** + test AC-05; LLM lỗi/timeout/sai schema ⇒ giữ kết quả luật, ghi fallback. Prompt an toàn cho LLM thật để P1 (10/10). | `LLM_MODE=mock` mặc định; luật đã quyết định | Bật prompt sớm hơn · ~0,5 ngày |
| Q10 | 2026-10-01 16:05 | Giá trị cấu hình theo mặc định CR-03: `safety_review.escalate_after_hours=4` (giờ lịch), `missing_info.safety_context.escalate_after_hours=12`; D-04 (B-01 lành tính), D-05 (`STOCK_CHECK_ON_ACCEPT`), D-07 (ảnh bắt buộc) giữ như CR-03. | Chưa có người duyệt khác (D-08) | Sửa số trong `catalog.yaml` · rẻ |
| Q11 | 2026-10-01 16:05 | Ticket Bậc 1: bỏ qua bước 3, 5–8; bước 4 chỉ **liên kết** (`related_ticket_ids`) theo vị trí + cửa sổ, không gộp. | CR-03 D-09 | — |
| Q12 | 2026-10-01 16:05 | Seed CLN-004 (chất lạ) và TEC-005 (tia lửa) đổi expected sang Bậc 1 trong WP của Như Ý để test xanh; đánh dấu để Trường rà nhãn. | Không đổi thì test fixture đỏ | Trường đổi nhãn · rẻ |
| Q13 | 2026-10-01 16:05 | Thứ tự thi công tuần tự WP2 → WP3 → WP4 → WP5 (cùng `engine.py`), **cùng một worker-sonnet** để giữ cache; WP6 thẩm định cô lập. Mọi entry point ghi mới phải giữ `engine.lock`. | Tránh conflict; gotcha concurrency | Song song WP5 nếu tách file · rủi ro conflict |
| Q14 | 2026-10-01 16:05 | Danh sách BPTN/BQL/phòng ban sắp theo §7 bằng một hàm khoá sắp xếp trong engine/views; router không đổi. | Q01 | — |

| Q15 | 2026-10-01 17:10 | **SPEC ✅ DUYỆT** (SO đo: 8/8 file đủ BẮT BUỘC/CẤM/Vùng cấm/Phân loại lỗi; prototype `TOTAL=84 BAD=0 TIER1_MISS=0`, `MERGE_SELFTEST=5 ok`, exit 0; architect chỉ ghi trong `specs/`). Chấp nhận drift D1–D13 theo `00-ARCHITECTURE.md` §8. | Đo lại, không tin report | — |
| Q16 | 2026-10-01 17:10 | (Q-A) **T16/T17/E02 KHÔNG vào P0** — giữ `TRANSITIONS` 25 dòng. | Kế hoạch Notion dời sang 08/10 | Thêm WP4b · ~0,5 ngày |
| Q17 | 2026-10-01 17:10 | (Q-B) Sửa chữ CR-03 §5.2 theo D2 (chạy lại từ bước 2, 2b tự bỏ qua khi đã cleared) ở bước đồng bộ docs cuối hồ sơ. | Chỉ là chữ | — |
| Q18 | 2026-10-01 17:10 | (Q-C) S-06 giữ P1; "bị điện giật" ở P0 là Bậc 2 (vẫn dừng cho người xem). (Q-D) Chấp nhận B-04 "an toàn trước"; Trường rà nhãn sau. (Q-F) Chấp nhận câu chữ `safety_details` của architect; Trường rà. | Nghiêng về an toàn, không chặn tiến độ | Đổi `phase`/nhãn trong lexicon · rẻ |
| Q19 | 2026-10-01 17:10 | (Q-E) **BQL chỉ dùng 3 lựa chọn Bậc 2 khi ticket đã leo thang** (+1 guard +1 test). | CR-03 §2 dòng BQL: "trên ticket đã leo thang" | Bỏ guard · rẻ |
| Q20 | 2026-10-01 17:10 | (D13) Sửa expected seed CLN-004/TEC-005 ở **WP3** (không phải WP5) để cổng xanh sau từng WP. | Detector bật ở WP3 làm đổi kết quả fixture | — |
| Q21 | 2026-10-01 18:00 | **WP3 ✅** (SO đo: 266 pass, ruff sạch, diff 20 file trong phạm vi; evidence làm đỏ có). Chấp nhận: sửa 9 dòng `test_engine.py` (hệ quả Q20); `git add -f` file `tests/test_maintenance/data/*.yaml`, **không sửa `.gitignore`** (cấu hình chung của nhóm — thêm file data mới thì cũng `-f`); mỗi ticket có thêm audit `ASSESS_SAFETY` kể cả NONE (truy vết); ví dụ chuẩn hoá P01 §3.1 theo luật + REF. | Đo lại | Thêm `!tests/**/data/` vào `.gitignore` khi nhóm đồng ý · rẻ |
| Q22 | 2026-10-01 18:00 | **Vấn đề ngoài engine:** "Bóng đèn … bị cháy" qua 2b ra `NONE` đúng (B-01), nhưng bộ phân loại (rules/proposer, V-10 không đổi ở P0) cho `OUT_OF_SCOPE` ⇒ ticket đèn phổ biến nhất bị dừng chờ BPTN. Chuyển Trường (chủ rules/playbook) xử; không sửa trong hồ sơ này. | Ranh giới Q01 | Thêm WP sửa `rules.py` nếu Trường giao lại · ~0,5 giờ |
| Q23 | 2026-10-01 18:50 | **WP4 🔁 SỬA drift 1:** BPTN trên blocker chủ BQL (`EMERGENCY_PENDING_BQL`) ⇒ `ACTION_DENIED` 403 + audit cho MỌI hành động, kể cả `bptn_resolve`; `bptn_resolve` trên `SAFETY_REVIEW_REQUIRED` (chủ BPTN) vẫn 409. Chấp nhận drift 2 (theo Q19) và drift 3 (`test_api.py` dùng TEC-002). SPEC P02 §5.5/§11/E-13 và TESTING X-2 lệch CR-03 ⇒ CR-03 thắng. | CR-03 §4.4 bất biến 5, AC-06 | — |
| Q24 | 2026-10-02 | **WP6 thẩm định 🔁 SỬA** (R05): quyền/audit/chặn gỡ khẩn cấp/đồng thời PASS; N-01, N-05, N-06 **bỏ sót Bậc 1** ⇒ thêm gói **WP3b** (cùng worker, cùng SPEC P01) rồi **thẩm định lại bằng auditor MỚI**. Thước đo WP3b = các ca N-xx thành ca có nhãn trong `tests/test_maintenance/data/safety_cases_p0.yaml` với kỳ vọng ở Q25; bộ 84 ca cũ giữ 0 sai, 0 báo nhầm. | CR-03 §15 "0 bỏ sót Bậc 1" | — |
| Q25 | 2026-10-02 | **Kỳ vọng (theo CR-03, nghiêng về an toàn):** (1) phủ định/marker "đã xảy ra"/hedge **chỉ áp trong cùng mệnh đề** với tín hiệu — ranh giới mệnh đề gồm `, ; . ! ? \n` và liên từ "và/nhưng/mà/rồi" ⇒ N-01, N-02 = **EMERGENCY**; (2) phủ định kép N-08 ⇒ ít nhất **UNCLEAR**; (3) B-01 chỉ khi "cháy/hỏng/…" thuộc chính danh từ đèn/bóng, có thiết bị điện khác (ổ cắm, hộp điện, dây, tủ điện, công tắc) làm chủ ngữ ⇒ không áp B-01 ⇒ N-03 ít nhất **UNCLEAR**; (4) B-04 chỉ hạ khi có ngữ cảnh nấu ăn **và không** có ngữ cảnh điện; so khớp ngữ cảnh nấu ăn phải phân biệt dấu ("nâu" ≠ "nấu") ⇒ N-04 = **EMERGENCY**; (5) từ vựng thêm: ngất/xỉu, hỏa hoạn/cháy nhà, khói mù/khói đen, lửa bốc, dây (điện) bị hở/hở điện, kẹt thang máy/mắc kẹt ⇒ N-05 = **EMERGENCY** (kể cả thiếu vị trí, Q08); (6) chuẩn hoá NFKC trước NFD, bỏ ký tự định dạng (Cf) KHÔNG chèn khoảng trắng, gộp ký tự lặp ≥3 ⇒ N-06 = như câu thường. | Ưu tiên không bỏ sót | Trường rà nhãn/từ vựng sau · rẻ |
| Q26 | 2026-10-02 | **Hiệu năng/độ dài:** bỏ O(n²) trong `_sentence_bounds` (một lần tách câu/mệnh đề cho cả văn bản); engine từ chối mô tả cư dân > **5000 ký tự** bằng lỗi validation (422) — không cắt cụt âm thầm. Đo: mô tả 24 KB xử lý < 1 s; 5001 ký tự ⇒ 422. | N-07 DoS; khớp giới hạn 5000 của `ChatRequest` sẵn có | Đổi ngưỡng trong catalog · rẻ |
| Q28 | 2026-10-02 | **Thẩm định lần 2 🔁 (R07) — fail ×2 cùng cổng an toàn ⇒ leo judge (cò T1, K.5).** Dòng Đ: cò T1 · bằng chứng R05 (N-01) và R07 (M1, M13, M14) đều bỏ sót Bậc 1 ở HEAD `acb82fd`, 352/352 xanh · câu hỏi: "vá từ vựng/cửa sổ tiếp, hay đổi thiết kế phạm vi phủ định + B-01, và đâu là ranh giới nghiệm thu P0?" · **cái sẽ đổi:** nội dung WP3c (luật phạm vi phủ định, B-01, từ vựng, tiêu chí dừng) và việc có/không thẩm định lần 3. Ngân sách: judge thứ nhất của hồ sơ. | K.5 | — |
| Q29 | 2026-10-02 | **Phán xử judge (Opus) cho Q28:** sửa ở mức THIẾT KẾ, không vá câu. Luật WP3c = R1–R10 của judge (R1 phạm vi phủ định hẹp dùng chung safety+priority: cue + ≤2 token đệm {có,thấy,bị,hề,được,còn} kết thúc ngay trước span, ≤80 ký tự, hai cue liền ⇒ UNCLEAR; R2 gộp match chồng; R3 cue không chứa đối tượng; R4 kế thừa phủ định qua hay/hoặc/lẫn, cấm qua phẩy/"và"; R5 hedge cùng luật R1, marker T2-02 chỉ khi đứng SAU tín hiệu + tiểu từ; R6 B-01 chỉ khi phần trước thuộc tập đóng {danh từ đèn, vị trí, tầng/tòa, bị/đã/…, mã} và ≤20 token, bỏ non_lamp; R7 đồng tự theo token CÓ dấu của chính pattern; R8 ký tự vô hình = Cf ∪ U+034F ∪ FE00–FE0F ∪ filler Hangul, 2 biến thể lấy max; R9 lưới Bậc 2 "lửa/khói/máu/bất động" ngoài span ⇒ T2-03; R10 từ vựng M14, "kẹt" với người/thang máy, loại "phòng/chữa cháy", S-05 không khớp "chạy chậm/liên tục/thử", 24 KB < 1 s). **Tiêu chí dừng P0:** 0 lọt trên bộ nhãn R05+R07 và bộ sinh tổ hợp (f_neg, a_sep, jx_coord, a_b01); holdout của judge NONE ≤3/39 (bộ holdout KHÔNG giao worker); EMERGENCY nhầm 0 trên fixture, ≤1/59 b_fp, ≤2/20 jx_negfp, ≤3/33 b_fp2; UNCLEAR ≤5/59 b_fp. **Không bật LLM ở P0** (receive giữ lock). Thẩm định lần 3 (auditor khác): lỗi mới ở cơ chế hạ mức ⇒ 🔁 chặn; lỗ từ vựng mới ⇒ thêm YAML, ghi lại, KHÔNG chặn. Giới hạn đã biết: Cyrillic, leet, tách chữ, ligature, lặp 2 chữ. SPEC-P01 §3.2/3.3/3.5/3.6/§7 + 01-CONTRACTS §5 sửa trước bởi architect (**model Opus — người dùng cấm Fable 2026-10-02**). Dòng Đ architect lần 2: lần 1 viết SPEC gốc; lần này R1/R6 đổi hợp đồng đã duyệt (cò T3). | Judge đo trên bản thử: f_neg 67→0, a_sep 24→0, a_b01 12→0, b_fp2 27→4 | Nới ngưỡng holdout/báo nhầm · rẻ |
| Q30 | 2026-10-02 | **SPEC sửa đổi (architect Opus) ✅** — SO đo: diff đúng 4 file specs (+735/−145), 4/4 đủ BẮT BUỘC/CẤM/Vùng cấm/Phân loại lỗi; bản thử theo SPEC đạt f_neg 0/100, a_sep 0/40, jx_coord 0/400, a_b01 0/20, b_fp 0 EMERGENCY/4 UNCLEAR, jx_negfp 0, b_fp2 3. Câu hỏi mở: (1) **duyệt A4** loại trừ khói thuốc/hương/nhang (UNCLEAR 4/59 ≤ 5); (2) R4 chạy thật theo A3 — chấp nhận, SO đo holdout D-8 trên bản cài cuối; (3) **duyệt A2** (giữ EMERGENCY cho "Có tia lửa…, đèn đã tắt"); (4) **duyệt A1** (danh từ đèn phải đúng dấu; "den bi chay" không dấu ⇒ UNCLEAR, nghiêng an toàn); (5) **duyệt** cue/cue người/`homograph_intended` mới của A4; (6) **chấp nhận** loại `c-fullwidth-no-space` (giới hạn tách chữ) và S-07/S-10 (P1, Q06) khỏi "0 lọt"; (7) phạm vi WP3c lấy từ dòng "File được ghi" SPEC-P01 — dòng WP3b/REF ở OPERATIONS/00-ARCH lỗi thời, sửa chữ lúc đồng bộ docs. Bộ holdout của judge do SO giữ, không giao worker. | Đo lại | Đổi ngưỡng/loại trừ trong lexicon · rẻ |
| Q31 | 2026-10-02 | **Thẩm định lần 3 🔁 (R09) — sửa hẹp WP3d, KHÔNG mở vòng thẩm định thứ 4.** Gate máy xanh toàn bộ; còn 4 lỗi cơ chế hạ mức có ca tái hiện. Cách sửa (nghiêng an toàn — bỏ hạ mức sai thì chỉ có thể nâng mức): **(A)** bỏ cue phủ định một chữ cái `k co`, `k thay` (và mọi cue có token 1 ký tự); giữ `ko`, `hok`; "Tòa KO có khói" ghi giới hạn đã biết. **(B)** cue hedge (T2-01) và ngữ cảnh nấu ăn B-04 so khớp trên **văn bản CÓ dấu** (NFC, chữ thường) — văn bản không dấu ⇒ không hạ ⇒ giữ mức cao. **(C)** R7: dạng đồng tự chỉ loại match khi **không** có từ đồng hiện xác nhận nghĩa nguy hiểm trong cùng mệnh đề (bốc/bay/ra/lên/tỏa/cháy/điện/người/bị/xỉu/té); thêm `homograph_intended` cho `co khoi`, `boc khoi`, `khoi boc`, `co lua`, `lua boc`, `bi ngat`, `ngat di`, `ho ra`, `day dien ho`. **(D)** `coordination_hazard_tokens` loại cụm `chua chay`, `bao chay`, `phong chay`. **(G)** `is_invisible` thêm Cc (trừ \t \n \r), U+2800, vùng Private Use (E000–F8FF). **Từ vựng:** "nổ" + ngữ cảnh điện, "bị bỏng", "dây điện bị trần (ra)", "cháy sang/ra", "người bên trong không ra được/mắc kẹt trong thang máy". **Đo đóng:** atk1–atk4 của auditor ⇒ A–D, G đều ra mức đúng; toàn bộ bộ dừng D-1…D-10 + holdout D-8 không hồi quy; ngưỡng báo nhầm Q29 giữ. Lý do không thẩm định lần 4: hai vòng gần nhất chỉ còn lỗi dữ liệu hẹp, gate máy đã ổn định; vòng lặp phải có điểm dừng trước MVP 04/10. Thay đổi so với SPEC-P01 §3.3.1 (R7) và hedge — SO ghi, đồng bộ chữ SPEC lúc đóng hồ sơ. | R09; hạn MVP | Mở thẩm định lần 4 nếu số đo hồi quy · ~1 giờ |
| Q32 | 2026-10-02 | **WP3d ✅ (R10) ⇒ cổng WP6 ĐÓNG ✅ theo Q31.** SO đo: pytest 1462 passed, ruff sạch, diff 5 file đúng phạm vi H07; holdout judge {EM 31, UNCLEAR 6, NONE 2}/39 (≤3); f_neg 0, a_b01 0, jx_negfp EM 0, b_fp2 FLAGGED 4 (EM ≤3); atk2/atk4 FAILS 0; atk1 còn A7 (giới hạn đã biết "Tòa KO"), E1 (R5 mơ hồ ⇒ UNCLEAR theo SPEC), F3/F5 (B-04 chữ đúng dấu ⇒ UNCLEAR theo thiết kế). Chấp nhận drift: confirmers theo từng token đồng tự; không thêm intended `co lua`; S-09 `bi ngat` regex lookahead + nới V-08 cho khoá regex. | Đo lại | — |
| Q33 | 2026-10-02 | **Đóng hồ sơ:** đồng bộ chữ SPEC-P01 (R7 confirmers, hedge có dấu, cue một chữ cái), TESTING X-2 (403), OPERATIONS (dòng WP3b/c/d), CR-03 §5.2 theo Q17, `docs/maintenance.md` (tài liệu module mới theo §5.C), não 6 điểm + `project-intro`/`-data-architecture` nếu lệch. **Version:** brain `current_version` 1.0.1 → **1.1.0** (MINOR); **KHÔNG** đổi version app trong `src/` (CR-03 mới xong P0 trên nhánh riêng; version app đổi khi nhóm tích hợp vào `develop`). | AGENTS §4, §5.B; tránh xung đột với nhánh nhóm | Bump version app khi merge `develop` · rẻ |
| Q27 | 2026-10-02 | **Lỗi nhẹ cùng gói:** N-09 so sánh `>=` (bổ sung cùng instant vẫn quét lại 2b); N-10 luật priority dùng cùng hàm phủ định theo mệnh đề ("không chắn lối đi" không kích hoạt PRI-H2). **Ngoài phạm vi, ghi lại:** `cancel_reason` hiển thị nguyên văn cho cư dân, `cancel` thiếu AuditEvent (có từ trước) ⇒ Idea Vault; chữ "409" ở TESTING X-2 sửa lúc đồng bộ docs. | Rẻ, cùng file | — |

### Quyết định bị thay thế
- Q12 (seed sửa ở WP5) → thay bởi Q20 (sửa ở WP3).

---

## §3. Work Packages

| WP | Việc | Tầng | Vai | SPEC |
|---|---|---|---|---|
| WP0 | Đo nền test/ruff + quét khoảng trống | 🟢 | worker | — (xong, Q05) |
| WP1 | Viết bộ `specs/` | 🔴 | architect-fable | tất cả |
| WP2 | Contract: enum, trường Ticket, `TRANSITIONS`, `BLOCKER_OWNERS`, catalog `sla_config`, bỏ reopen/assignee | 🟠 | worker-sonnet | `01-CONTRACTS`, `SPEC-P02` |
| WP3 | `safety.py` + từ vựng YAML + chèn 2b + guard LLM + seed CLN-004/TEC-005 (Q20) | 🟠 | worker-sonnet | `SPEC-P01`, `SPEC-P04` §seed |
| WP4 | Hành động BPTN/BQL cho an toàn (+guard Q19), chặn `resume()`/job, thời hạn Bậc 2, outbox `emergency.created`, nhãn cư dân | 🟠 | worker-sonnet | `SPEC-P02` |
| WP5 | Priority PRI-H/M/L/D0 + sắp xếp; rating một lần | 🟠 | worker-sonnet | `SPEC-P03`, `SPEC-P04` |
| WP3b | Làm cứng an toàn theo R05 (Q25–Q27) | 🟠 | worker-sonnet | `SPEC-P01` + Q25 |
| WP3c | Thiết kế lại phạm vi an toàn theo judge (Q29–Q30) | 🟠 | worker-sonnet | `SPEC-P01` (sửa đổi) |
| WP6 | Thẩm định cô lập (≥3 cách phá) — lần 1 R05 🔁, lần 2 R07 🔁, lần 3 sau WP3c | 🔴 | auditor-sonnet | `TESTING-ACCEPTANCE` §12 |

## §4. Checklist thực thi
- [x] WP0 đo nền (142/142, ruff sạch)
- [x] Commit nền `e5ececf`, nhánh `feature/nhuy-cr03-p0`
- [x] WP1 `specs/` đủ 4 mảng + SO đo (Q15)
- [x] WP2 (R01 ✅) · [x] WP3 (R02 ✅) · [x] WP4 (R03 ✅ sau 🔁) · [x] WP5 (R04 ✅) (mỗi WP: report + SO đo lại + phán)
- [ ] WP6 thẩm định ✅ — lần 1 🔁 (R05) → WP3b (H05) → thẩm định lại bằng auditor mới
- [ ] Đồng bộ não (6 điểm) + `docs/` + changelog/version
- [ ] Sign-off `✅ ĐÃ HOÀN THÀNH` + mốc giây

## §5. Bảng trỏ SPEC

| File | Nội dung |
|---|---|
| [`specs/00-ARCHITECTURE.md`](specs/00-ARCHITECTURE.md) | Mục tiêu, non-goals, bất biến I-01..I-15, ranh giới, drift D1–D13 |
| [`specs/01-CONTRACTS.md`](specs/01-CONTRACTS.md) | Enum, model, `TRANSITIONS` (25), `BLOCKER_OWNERS`, `sla_config`, lexicon schema, 9 method công khai |
| [`specs/SPEC-P01-safety-layer.md`](specs/SPEC-P01-safety-layer.md) | Thuật toán 2b, guard rule ⊕ llm |
| [`specs/SPEC-P02-emergency-flow.md`](specs/SPEC-P02-emergency-flow.md) | Vòng đời blocker an toàn, 5 method, thời hạn, outbox, nhãn cư dân |
| [`specs/SPEC-P03-priority.md`](specs/SPEC-P03-priority.md) | PRI-H/M/L/D0, `set_priority`, `queue_sort_key` |
| [`specs/SPEC-P04-guards.md`](specs/SPEC-P04-guards.md) | Reopen 409, assignee deny, rating một lần, seed |
| [`specs/OPERATIONS.md`](specs/OPERATIONS.md) | Lệnh kiểm, thứ tự WP, ranh giới file, rollback |
| [`specs/TESTING-ACCEPTANCE.md`](specs/TESTING-ACCEPTANCE.md) | Ma trận AC → test, 84 câu nhãn, cách phá, Exit Gates |
| `specs/LEXICON-P0.yaml`, `SAFETY-CASES-P0.yaml`, `REF-safety-proto.py` | Từ vựng chuẩn, tập câu có nhãn, prototype đo |

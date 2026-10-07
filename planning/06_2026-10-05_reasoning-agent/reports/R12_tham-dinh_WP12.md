Vai: worker (vai-thi-cong) · loại: thẩm định (chỉ đọc, làm đỏ) · họ/model: Claude Opus 5.5 (claude-opus-5-5) · Bước 0: exit 1, đúng 1 dòng `BRN-002 … khối luật: boot` (Q21, đi tiếp) · hiểu việc: phạm vi = đọc code bd0ca17 + chạy probe; chỉ ghi `evidence/WP12/*` và file này; xong khi = break-1…6, extra ≥ 3, pytest.txt có dòng `EXIT=` cuối + report có phán quyết; cấm = sửa src/tests/seed/SPEC/plan.md, stash, commit, push, gọi mạng, đọc `.env`
Handoff: handoffs/H12_tham-dinh_WP12.md
Base: bd0ca175a2a77fda5bc7a066b66d952d54bb6e6b
Head: không commit

## 1. Sáu cách phá bắt buộc (TESTING §8)

Lệnh chung (từ root worktree): `bash planning/06_2026-10-05_reasoning-agent/evidence/WP12/probes/run.sh <probe>.py <tên>`; dòng lệnh python nguyên văn nằm ở dòng 1 mỗi file evidence.

| # | Cách | Probe | Exit | Kết quả (dòng RESULT) | Mức |
|---|---|---|---|---|---|
| 1 | Agent hạ mức: client trả NONE + mọi tín hiệu ABSENT, 1 job, vị trí đủ, PROCEED | `break1_agent_lowers.py` → [break-1.txt](../evidence/WP12/break-1.txt) | 0 | 203 câu nhãn EMERGENCY + 15 câu UNCLEAR (P0+P1 YAML) qua `receive`: `receive_below_label=0`, `routed=0`; so engine Agent với engine luật cùng đầu vào trên 3 đường (receive / add_resident_info / bptn_resolve info), 654 cặp: `agent_lower_than_rules=0` | đạt (Agent không hạ). Đường phụ lộ 2 lỗi luật có từ base → F1 (138 ca), F2 (8 ca) |
| 2 | Chèn lệnh trong văn bản cư dân + `excerpt` ứng viên (`duplicate_of SIM-TKT-0001`, `SIM-ASSET-LIGHT-999`, `tòa S9`, `</ung_vien_trung></phan_anh>`), client "ngoan ngoãn" | `break2_injection.py` → [break-2.txt](../evidence/WP12/break-2.txt) | 0 | 6 nạn nhân, `problems=0`: S9 / phòng ban / trùng / asset / vật tư bịa đều vào `rejected` hoặc bị kiểm lại lúc áp; không ticket giao sai phòng ban/asset; khoá vị trí BPTN giữ; prompt có đúng 1 `</ung_vien_trung>` và 1 `</phan_anh>` thật | đạt |
| 3 | Gọi mô hình trong khoá: probe ghi `lock._is_owned()` + `tx_depth` mỗi lần gọi, đi qua 25 entry point (gồm Wave 4) | `break3_lock_probe.py` → [break-3.txt](../evidence/WP12/break-3.txt) | 0 | `model_calls=23 in_lock_or_tx=0 from_no_model_entries=0`; job mồ côi 7 → 5 lần gọi (`max_job_agent_calls`) | đạt |
| 4 | Chen giữa tính và áp, 2 luồng thật (`threading.Event` giữ lời gọi mô hình của A) | `break4_race_threads.py` → [break-4.txt](../evidence/WP12/break-4.txt) | 0 | 4a 1 lần chen ⇒ tính lại, vân tay = nội dung cuối; 4b 2 lần chen ⇒ `FALLBACK_RULE/STALE` + `AGENT_FALLBACK`; 4c/4d nguy hiểm B thêm trong lúc A chờ ⇒ cuối `EMERGENCY` | đạt |
| 5 | Code cũ `82f01f0` gặp DB có doc P1 (`p151_wp12_test`, container `p151-pgtest`) | `run_break5.sh` → [break-5.txt](../evidence/WP12/break-5.txt) | 0 | DB ở `0002_p1_doc_shape`, 4 doc P1 (tách, follow-up, agent_decision); code cũ `check()` ⇒ `RuntimeError … upgrade head`; uvicorn cũ `RESULT uvicorn_exit=3`; không có dấu mốc thì `list()` cũ ⇒ `ValidationError: 13 validation errors` | đạt |
| 6 | Tách sai: 18 `MUST_NOT_SPLIT` + 10 câu tự viết (5 nhân quả, 3 hai nơi, 1 thiếu vị trí, 1 Bậc 2) × luật / Mirror / Agent "tách bừa" | `break6_wrong_split.py` → [break-6.txt](../evidence/WP12/break-6.txt) | 0 | luật 0/28 tách, Mirror 0/28; tách bừa 25/28, engine chặn đúng 3 ca thiếu điều kiện P05 §3 (thiếu vị trí, Bậc 2): `violations=0` | đạt theo tiêu chí §8.6; ca "hai nơi" lộ F8 |

Độ nhạy (bộ đo mới phải từng đỏ trên hệ cố tình hỏng): `mutants.py` → [mutants.txt](../evidence/WP12/mutants.txt), exit 0, `RESULT mutants=6 caught=6 blind=[]` (đột biến monkeypatch trong tiến trình con, không chạm file src).

## 2. Cách tự thiết kế ngoài §8

| # | Cách | Probe / evidence | Exit | Kết quả | Mức |
|---|---|---|---|---|---|
| E1 | Cư dân bổ sung nguy hiểm Bậc 1 khi ticket NEED_INFO còn thiếu vị trí; và trả lời câu hỏi an toàn T06 bằng "có lửa" | `extra_addition_not_assessed.py` (HEAD + base) → [extra-1.txt](../evidence/WP12/extra-1.txt) | 1 / 1 | HEAD và base giống nhau: 6/6 bổ sung Bậc 1 giữ `NEED_INFO`, `risk=NONE`; T06 trả lời "Giờ có lửa bốc lên rồi!" giữ `NEED_INFO`, `risk=UNCLEAR` | **CHẶN** (F1) |
| E2 | Ngữ cảnh: câu đèn đứng trước câu khói (nội dung engine thật sự chấm) | `extra_context_lowers.py` (HEAD + base) → [extra-2.txt](../evidence/WP12/extra-2.txt) | 1 / 1 | 8/32 cặp: bổ sung riêng EMERGENCY, gộp với câu đèn ⇒ UNCLEAR (`T2-03 B-03`); base giống hệt | GHI (F2) |
| E3 | Agent bịa vị trí (không trích dẫn) cho phản ánh không ghi nơi | `extra_invented_location.py` → [extra-3.txt](../evidence/WP12/extra-3.txt) | 1 | 3 ticket ROUTED tới nơi cư dân không viết (vd "Đèn hành lang không sáng" ⇒ `Tòa S2 / Tầng 7 / Hành lang`, asset 005); một câu trộn không vị trí bị TÁCH; engine luật cùng câu ⇒ `NEED_INFO` | GHI (F3) |
| E4 | Vi sai từ vựng base `p0g` ↔ HEAD `p1d` (tiền tố B-01 mới nho/xin/giup/thay, homograph ga/mau/roi/do, Q25) trên 3013 câu | `extra_lexicon_diff.py` → [extra-4.txt](../evidence/WP12/extra-4.txt) | 1 | 104 câu hạ, cả 104 là `UNCLEAR→NONE`, 0 câu EMERGENCY bị hạ; 102 là cụm đèn hỏng ("đèn cháy", "chập điện") sau tiền tố mới; Q25: 48 câu kêu cứu + "cháy" chỉ UNCLEAR, 24 ra NONE (có từ base) | GHI (F11) |
| E5 | Bước ngẫu nhiên 32 × ≤ 250 thao tác, kiểm bất biến `duplicate_count` (P04 §2.1) sau mỗi bước | `extra_dup_count_walk.py` → [extra-5.txt](../evidence/WP12/extra-5.txt) | 1 | 21/32 lượt vi phạm; mọi vi phạm đầu ở `undo_split` (F4) hoặc ticket mở lại bằng T09 mang số đếm cũ (F7) | GHI |
| E6 | Tái hiện tối thiểu `undo_split` | `extra_undo_split.py` → [extra-6.txt](../evidence/WP12/extra-6.txt) | 1 | (a) 3 lần tách + hoàn tác ⇒ gốc `duplicate_count=3`, 0 nghi trùng, PRI-U1 nâng MEDIUM→HIGH; (b) hoàn tác tách lần 2 sau T09 ⇒ `ValidationError` (V-T5); (c) số đếm cũ sau T09; (d) gộp dây chuyền qua `undo_split` được chấp nhận | GHI (F4–F7) |
| E7 | Ma trận quyền 9 thao tác Wave 4 × 10 actor | `extra_permissions.py` → [extra-7.txt](../evidence/WP12/extra-7.txt) | 0 | `accepted_forbidden=0 refused_allowed=0`; 5 lần từ chối là 409 không audit thay vì 403 + `ACTION_DENIED` | GHI (F10) |
| E8 | Tách vs an toàn; follow-up vs khoá vị trí BPTN | `extra_followup_split_safety.py` → [extra-8.txt](../evidence/WP12/extra-8.txt) | 1 | Agent nâng S-00/T2-04 ⇒ không tách; 32 câu tách: 0 con thấp hơn gốc; follow-up mất `locked_fields.location` (Mirror ⇒ hỏi lại cư dân; Agent đoán ⇒ `Tòa S2 / Tầng 7`) | đạt / GHI (F9) |
| E9 | Rò rỉ `agent_decision` sang view cư dân (marker trong mọi trường văn bản tự do của mô hình) | `extra_resident_leak.py` → [extra-9.txt](../evidence/WP12/extra-9.txt) | 0 | 7 ticket, `resident_views_with_leak=0` | đạt |

Cổng rẻ đo lại ([gates.txt](../evidence/WP12/gates.txt)): G4 meter `GATES_FAILED=0` exit 0; G5 REF-agent-contract `SELFTEST_FAILURES=0` exit 0, REF-split-verdict `VARIANT_FAILURES=0` exit 0; G-STUB `TOTAL=0`.

## 3. Cổng chung

`bash planning/06_2026-10-05_reasoning-agent/evidence/WP12/probes/run_pytest_full.sh` → [pytest.txt](../evidence/WP12/pytest.txt): `3338 passed, 75 deselected in 123.40s` · `EXIT=0` (HEAD `bd0ca17`, chạy sau mọi probe). Tổng/pass/fail/skip: 3338 / 3338 / 0 / 0 (75 deselected = ca `pg`, không `--pg`).

`git status --porcelain` sau khi chạy: `?? planning/06_2026-10-05_reasoning-agent/evidence/WP12/` và file report này; `git diff --stat` rỗng (0 file theo dõi đổi). Worktree tạm `82f01f0` đã `git worktree remove` (exit 0). DB `p151_wp12_test` được tạo mới và để lại.

## 4. Phân công thực tế

| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP12 thẩm định đối kháng (6 cách §8 + 9 cách tự thiết kế + đột biến) | 🔴 | Claude Opus 5.5, tự làm, không giao con |

## 5. Phát hiện

| ID | Mức | Thấy | Đúng (nguồn) | Tái hiện | File:dòng nghi |
|---|---|---|---|---|---|
| F1 | **CHẶN** | Bổ sung văn bản (cư dân, cả trả lời T06) vào ticket `NEED_INFO` còn thiếu vị trí KHÔNG chạy lại 2b: "Có mùi gas nồng nặc", "Hộp đèn đang cháy, có lửa!" ⇒ `NEED_INFO`, `risk=NONE`, không `emergency.created`; trả lời T06 "có lửa" ⇒ vẫn `NEED_INFO`/UNCLEAR (chờ leo thang SLA). Có từ base `82f01f0`; plan 06 không gây ra nhưng đường `add_resident_info` của Agent (P02 §5) gọi mô hình rồi bỏ kết quả | CR-BPTN-03 §5.2 dòng 188 "Sau mọi bổ sung văn bản … luôn chạy lại 2b", AC-08, dòng 251 (T06: "chạy lại 2b"); 00 V-05 "0 bỏ sót Bậc 1 kể cả khi mô hình lỗi" | `bash …/probes/run_two_roots.sh extra_addition_not_assessed.py extra-1` (cần worktree base), hoặc chỉ HEAD: `python …/probes/extra_addition_not_assessed.py .` | `src/maintenance/engine.py:2635-2638` (`_cleared` MISSING_INFO chỉ trả True khi đủ vị trí) → `engine.py:2658` `_resume_activated` không chạy pipeline ⇒ 2b không chạy |
| F2 | GHI | Câu đèn đứng trước làm "Khói rất nhiều ở hành lang tầng 9" từ EMERGENCY xuống UNCLEAR (`T2-03 B-03`) trên nội dung gộp; có từ base | nhãn SC-205…208 = EMERGENCY | `python …/probes/extra_context_lowers.py .` | luật B-03 trong `src/maintenance/safety.py` + từ vựng (không sửa — V-13) |
| F3 | GHI (lỗ SPEC) | Agent đưa tòa/tầng/khu hợp lệ danh mục mà KHÔNG trích dẫn ⇒ engine dùng (G-5 MINOR) ⇒ ROUTED tới nơi cư dân không viết; câu trộn không vị trí bị tách | P02 §6.2 "KHÔNG BAO GIỜ đi tiếp khi thiếu vị trí"; A-29; nhưng P01 §3.2 chỉ kiểm quote "nếu có" | `python …/probes/extra_invented_location.py` | `src/maintenance/agent/validate.py:98` (quote tuỳ chọn); `engine.py:3044-3056` |
| F4 | GHI | `undo_split` con đang `VERIFYING/DUPLICATE` của R: con thành MERGED nhưng R giữ +1; 3 lần ⇒ PRI-U1 nâng MEDIUM→HIGH với 0 nghi trùng | P04 §2.1 định nghĩa `duplicate_count`; `cancel` có `_release_duplicate_count` | `python …/probes/extra_undo_split.py` (a) | `src/maintenance/coordination/split.py:190-245` (không gỡ đếm của blocker cũ) |
| F5 | GHI | Hoàn tác tách → T09 → hoàn tác tách lại ⇒ `ValidationError` "danh sách liên kết không được lặp id" (router: 422) | P05 §5 nêu "hoàn tác của hoàn tác: undo_merge"; `_merge_into` có kiểm `child_id not in merged_children` | `extra_undo_split.py` (b) | `split.py:225` |
| F6 | GHI | `undo_split` nhận con đang có ticket khác MERGED vào nó ⇒ gộp dây chuyền | P04 §8 CẤM gộp dây chuyền (`_merge_into`, `bql_merge` đều chặn) | `extra_undo_split.py` (d) | `split.py:190-205` (thiếu `_has_open_merged_children`) |
| F7 | GHI | Số đếm của ticket đang MERGED bị đóng băng (I-26) nhưng T09 mở lại ⇒ mang số cũ (1 với 0 nghi trùng) | P04 §2.1 | `extra_undo_split.py` (c); walk seed 3/5 trong extra-5 | `src/maintenance/coordination/merge.py:79` (bỏ qua gốc kết thúc) + `merge.py:_unmerge` |
| F8 | GHI (lỗ SPEC) | Agent "tách bừa" câu hai nơi ⇒ engine tách, con KY_THUAT ROUTED `DEPT_TECHNICAL` tại `Tòa S1 / Tầng 3` trong khi đèn ở `tòa S2 tầng 7`; không có hàng bất đồng nào (luật có `split_verdict=two-places` nhưng không dùng) | P05 §7 Vùng cấm "Không tách khi … nhắc hai nơi" (P05 §3 không có điều kiện này) | `python …/probes/break6_wrong_split.py` (dòng `[two-places]`) | `split.py:55-66` `_has_two_jobs`; bảng G đóng `agent/reconcile.py` |
| F9 | GHI (lỗ SPEC) | Follow-up không mang `locked_fields.location` BPTN đã chốt cho nguồn ⇒ hỏi lại cư dân, hoặc Agent đoán nơi khác | I-19 tinh thần; tách (P05 §3.1 bước 4) có chép khoá vị trí, P07 §6 không nói | `python …/probes/extra_followup_split_safety.py` (b) | `src/maintenance/coordination/neighbors.py:200-230` `_build_follow_up` |
| F10 | GHI | 4 vai sai bị 409 không audit thay vì 403 + `ACTION_DENIED`: SYSTEM `undo_merge` (×2), BQL `report_wrong_department`, DEPARTMENT `bql_wrong_department(KEEP)` (BQL `return_wrong_department` có từ trước). Không ca nào được chấp nhận | P04 §9, P06 §8 (bảng lỗi: vai khác ⇒ 403 + audit) | `python …/probes/extra_permissions.py` | `engine.py:1722-1744` (`transition` coi vai "tới được trạng thái đích" là 409) |
| F11 | GHI (Q25) | "Xin cứu, nhà cháy" / "Giúp em với, cháy rồi" chỉ UNCLEAR (có từ base); "Xin cứu, đèn cháy" NONE (có từ base); tiền tố B-01 mới hạ 102 cụm đèn hỏng UNCLEAR→NONE, gồm "Thấy đèn cháy", "Thay bóng đèn cháy to lắm" | quyết định người dùng "đèn cháy = đèn hỏng" (khớp); kêu cứu + cháy nên là Bậc 1 ở tầng luật (V-05) — chờ người quyết | `bash …/probes/run_with_old.sh extra_lexicon_diff.py extra-4` | `seed/maintenance_v1/lexicon.yaml` `b01_prefix_words` (dòng 81-90) |

## 6. Việc KHÔNG làm + lý do
- Không sửa lỗi nào (handoff THẨM ĐỊNH, cấm sửa src/tests/seed/SPEC).
- Không chạy `--pg` của bộ pytest (cổng chung yêu cầu `pytest -q` thường); Postgres chỉ dùng cho cách phá 5.
- Không đo G-LIVE (không gọi mạng, không khoá).
- Không xoá DB `p151_wp12_test` (handoff chỉ nói tạo nếu chưa có).

## 7. Câu hỏi cần người
1. F1 có từ base `82f01f0`: sửa trong hồ sơ 06 (đường `add_resident_info` của Agent dựa vào nó) hay mở hotfix riêng trước khi đóng hồ sơ 06?
2. F3/F8/F9 là lỗ SPEC (P01 §3.2 cho vị trí không trích dẫn; P05 §3 thiếu điều kiện "hai nơi" cho đường Agent; P07 §6 không chép khoá vị trí) — giao architect sửa SPEC?
3. Q25/F11: "kêu cứu + cháy" có nâng thành Bậc 1 ở tầng luật (P0 S-05) không, hay để Agent nâng (khi mô hình lỗi thì chỉ Bậc 2)?

## 8. Tiếp theo
🖐 Cần tay người: quyết câu hỏi 1–3 ở §7 (phạm vi sửa F1; giao architect cho F3/F8/F9; Q25).
🤖 Agent làm được ngay: (chờ lệnh) handoff THI CÔNG sửa F1 + test hồi quy dùng lại `extra_addition_not_assessed.py`; sửa F4–F6 trong `split.py`.
⭐ Nên làm trước: F1 — tín hiệu Bậc 1 cư dân bổ sung đang không tới BQL trên đường phổ biến nhất (trả lời câu hỏi vị trí).
⏸ Chưa làm: sửa lỗi (ngoài vai thẩm định); `--pg` toàn bộ; G-LIVE (không khoá, không mạng).

🔁 SỬA: F1 — bổ sung văn bản vào ticket NEED_INFO còn thiếu vị trí (kể cả trả lời T06) không chạy lại tầng an toàn 2b (CR §5.2 dòng 188, AC-08); `engine.py:2635-2638`; có từ base 82f01f0

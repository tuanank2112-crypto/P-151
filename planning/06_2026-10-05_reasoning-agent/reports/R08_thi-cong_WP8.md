Worker · thi công · Sonnet 5.5 · Bước 0 exit 1 (đúng một dòng BRN-002 khối luật boot, CRLF, Q21 — đi tiếp) · hiểu việc: ghi split.py + test_p1_split.py + 2 câu test_acceptance; xong khi test_p1_split + test_acceptance EXIT=0 (+ pg), 3 đột biến đỏ; cấm engine.py, agent/**, lexicon, SPEC, test cũ khác
Handoff: handoffs/H08_thi-cong_WP8.md
Base: f1f372532321ea6958ba5306c0762f50e8ac5d17
Head: chưa commit (SO gộp)

| Lệnh | Exit | Kết quả | Evidence |
|---|---|---|---|
| pytest test_p1_split.py trên stub | 1 | 26 failed, 9 passed (S-01 đỏ) | evidence/WP8/red-before.txt |
| pytest test_p1_split.py + test_acceptance.py | 0 | 75 passed, 2 deselected | evidence/WP8/green.txt |
| `--pg` test_p1_split.py (DB p151_wp8_test) | 0 | 37 passed (2 ca pg thêm) | evidence/WP8/pg.txt |
| đột biến (a) bỏ điều kiện 4 | 1 | S-03[rules] đỏ (1 failed) | evidence/WP8/mutation-a.txt |
| đột biến (b) bỏ điều kiện 3 | 1 | S-08 đỏ (1 failed) | evidence/WP8/mutation-b.txt |
| đột biến (c) bỏ `self.llm is None` | 1 | 3 ca S-05 đỏ | evidence/WP8/mutation-c.txt |
| pytest toàn bộ | 1 | 3281 passed, 2 failed, 0 skip, 50 deselected | evidence/WP8/pytest.txt |
| REF `--variants` | 0 | VARIANT_FAILURES=0, SINGLE_JOB_VARIANTS_SPLIT=0 | evidence/WP8/ref.txt |
| ruff check + format --check (src tests) | 0 | sạch | evidence/WP8/ruff.txt |
| `grep -c 'NotImplementedError("plan 06' split.py` | — | 0 | — |
| `grep -cP '[\x08\x0b\x0c]'` 3 file đã ghi | — | 0, 0, 0 | — |

2 fail của pytest toàn bộ đều là test cũ khẳng định "hook còn là stub", đỏ ĐÚNG vì WP8 lấp stub (ngoài phạm vi tôi, xem câu hỏi 1):
- test_agent_engine.py::test_a27_… nửa đầu khẳng định `_try_split` stub ⇒ dừng "Agent thấy hai việc".
- test_p1_infra.py::test_hook_stubs_have_their_stage_one_bodies dòng `engine.undo_split(...)` còn đòi NotImplementedError.

Bảng phân công: WP8 a–d → 🟠 → Sonnet 5.5 (tự làm, không giao con).

Chọn Q23 (3): câu chữ proposal của ticket tách. `_bind_category(..., "AGENT_SPLIT")` khi chưa có proposal ghi chữ "Category do BPTN chọn (locked_fields)" + `PB-COM-R-OVR-01` + `locked_fields.category` — sai (không ai khoá). Không sửa được engine.py, nên `_split_mixed_report` gieo sẵn `work.proposal`/`child.proposal` (helper `_seed_split_proposal`) với `category_source="AGENT_SPLIT"`, `matched_rule_ids=["PB-COM-R-SPLIT-01"]` (cùng rule_id audit SPLIT_TICKET), lý do "Phản ánh có hai việc, tách thành hai ticket: ticket này giữ việc …", `source_references=[…, "split_category"]`; `_bind_category` thấy cùng playbook ⇒ chỉ làm mới `location_proposed` rồi đi tiếp. Test S-01 khoá câu chữ này. Đổi chữ: một hằng trong split.py.

Quyết định kỹ thuật: (1) điều kiện 2 đặt CUỐI trong `_try_split` vì nhánh luật gọi `_classification` (có ghi audit CREATE_PROPOSAL); chỉ chạy khi 4 điều kiện kia đã qua, và là việc bước 3 vẫn phải làm ngay sau (cache). (2) Điều kiện 2 dùng `_job_view` (đủ ý "job Agent đều bị loại ⇒ luật quyết", Q26). (3) Con chạy pipeline trong `self._prepared({..., child_id: record})` lồng, giữ `retry_on_stale` hiện hành ⇒ con không gọi mô hình (test CountingClient: 1 lần gọi cho gốc + con).

Phát hiện (không phải lỗi WP8): (a) sau `safety_confirm_safe`, quyết định Agent (Mirror) ra 0 job ⇒ đường Agent không bao giờ tới điều kiện 4 trong ca này; S-03 mutation (a) chỉ đỏ ở đường luật — điều kiện 4 vẫn cần cho đường luật. (b) Agent chỉ được cho ứng viên trùng tạo TRƯỚC `created` (nghiêm ngặt), nên test S-07 phải `clock.advance` giữa hai phản ánh; đường luật dùng tie-break theo id. (c) `duplicate_count` của gốc cũ vẫn 0 khi con DUPLICATE vì `_on_duplicate_detected` còn là stub WP7 — test S-07 không khẳng định số đếm.

git diff --cached --stat: xem lệnh cuối trong phản hồi của SO (chạy sau `git add` tường minh: split.py, test_p1_split.py, test_acceptance.py, evidence/WP8/*, R08).

Việc không làm / lưu ý:
- Không sửa 2 test cũ nêu trên (CẤM test cũ khác); đề xuất sửa: A-27 bỏ nửa đầu (đã đổi nghĩa), thay bằng khẳng định tách thật; test_p1_infra bỏ dòng `undo_split` khỏi danh sách stub (WP7/9/10 sẽ gỡ các dòng của mình).
- Không có chỗ gọi sai trong engine.py: `_try_split` được gọi ở bước 3 đúng thứ tự, `_bind_category(work, SPLIT_PAIR[0], "AGENT_SPLIT")` chạy sau tách.
- Không chép liên kết `related_ticket_ids` (SPEC §3.1 không nêu; liên kết hai chiều là `split_from`/`split_children`).
- Điều kiện 5 (regex vị trí) không có test riêng bắt riêng được (vị trí thiếu đã bị bước 2 chặn trước bước 3); giữ để đúng SPEC.

Câu hỏi mở cho SO:
1. Hai test cũ đỏ (A-27 nửa đầu, p1_infra stub-list dòng undo_split): SO cho phép WP13/gộp sửa, hay giao tôi sửa đúng hai dòng đó?
2. WP7/WP9/WP10 cũng sẽ làm đỏ cùng test p1_infra (mỗi gói một dòng stub): nên gộp sửa một lần khi hợp nhất.
3. Chữ proposal Q23 (3) như trên — SO duyệt hoặc đổi.

⏳ Chờ người duyệt.

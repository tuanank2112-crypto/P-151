Vai: worker · thi công · Claude/Opus 5.5 · Bước 0 exit 1 (BRN-002 khối luật boot cũ [tự sửa], BRN-028 today.md 180 dòng [cần người]; KHÔNG chạy chế độ ghi) · hiểu việc: dựng kho ≥120 câu cư dân × ≥8 mẫu vị trí (có/không dấu), sửa `rules.py`/`proposer.py` tới khi thêm vị trí không đổi loại việc và `extract_location` ra đúng vị trí mẫu; cấm chạm safety/lexicon/engine/api/web/seed/docs/brain, không sửa kỳ vọng test cũ, không commit.
Handoff: H02_classify-metamorphic.md
Base: e14b1a9
Head: uncommitted (worktree D:\P151\.claude\worktrees\agent-a537b1ab848044eb8)

## 1. Lệnh + exit (env `LLM_MODE=mock PYTHONUTF8=1`, python venv311 scratchpad)
| Lệnh | Kết quả |
|---|---|
| `python -m pytest -q -p no:cacheprovider` (base e14b1a9, trước sửa) | `1843 passed, 29 deselected` |
| `python -m pytest -q -p no:cacheprovider` (sau sửa) | `2678 passed, 29 deselected in 27.73s` · exit 0 · 0 fail · 0 skip (+835 test) |
| `pytest test_fixtures.py test_acceptance.py test_cr03_targets.py` | `54 passed` (file không đổi, base cũng xanh) |
| `ruff check src tests` | `All checks passed!` exit 0 |
| `ruff format --check src tests` | `74 files already formatted` exit 0 |
| `grep -cP '[\x08\x0b\x0c]'` 4 file đã sửa/tạo | 0 / 0 / 0 / 0 |
| ĐỎ: 2 file test mới/thêm trên `rules.py` + `proposer.py` gốc (lấy bằng `git show e14b1a9:…`) | `280 failed, 589 passed` |

## 2. Bộ biến thể
- Kho (a): **133 câu** — đèn 44 · vệ sinh 43 · ngoài phạm vi 30 · trộn 16 (gồm câu dễ nhầm: "Bùi Thị Hoa", "Phan Văn Tài", "Tôi bận", "Tôi đến nơi", "Khi đến", "Anh Đen", đèn căn hộ, đèn đường ngoài cổng, "đề nghị lắp thêm đèn").
- Biến thể (b): 11 mẫu vị trí × 2 (có dấu / không dấu) = 22/câu ⇒ **2926 biến thể**, 5852 phép kiểm (loại việc + vị trí).
- Vi phạm TRƯỚC sửa (code e14b1a9): **1483** (toàn bộ là loại việc; vị trí 0). Phân bố: TEC→OUT 540, CLN→OUT 530, UNCLEAR→OUT 90, UNCLEAR→CLN 75, UNCLEAR→TEC 60, OUT→CLN 56 (mẫu "phòng rác"), TEC→CLN 54 + TEC→UNCLEAR 34 (mẫu "phòng rác"), OUT→TEC 40 (đèn căn hộ / đèn đường + vị trí mẫu), OUT→UNCLEAR 4.
- Vi phạm SAU sửa: **0**. `RESIDUAL` = rỗng (không câu nào miễn trừ).
- Định nghĩa "câu gốc": nhãn của câu khi báo ở khu vực chung. Từ cần khu vực ("bẩn", "đèn"…) đứng một mình là OUT_OF_SCOPE theo thiết kế plan 04, nên câu không vị trí không phải mốc so sánh; thay vào đó cả 22 biến thể phải cùng ra nhãn kỳ vọng. Test `test_corpus_sentences_carry_no_location` bảo đảm vị trí chỉ đến từ mẫu.

## 3. Sửa gì
- `rules.py`: (1) `LOCATION_MARKERS`: "phòng rác" → marker khu vực trung tính ⇒ chữ vị trí không tự kích VE_SINH; phòng rác "đầy/tràn" vẫn là vệ sinh. (2) marker dấu mới: mờ/rơi/rớt/nổ/đầy/tràn (phân biệt mở/rồi/nó/dãy/trần). (3) triệu chứng đèn: chớp, nháy nháy, không bật, bật không lên, sáng yếu, lờ mờ, tối om/thui, nổ, rơi/rớt, đứt, chết, lủng lẳng, rè rè, cháy bóng, "bong den chay" không dấu. (4) đèn không dấu `den … <triệu chứng>` (≤3 từ, cần khu vực, loại trừ khi/đi/tôi/mới/vừa trước). "mất đèn" không dấu. (5) đèn trong căn hộ/phòng ngủ/nhà tôi và đèn ngoài cổng/đường phố/vỉa hè ⇒ không phải đèn khu vực chung. (6) ~30 mẫu vệ sinh mềm (cần khu vực): nước đọng, sàn trơn, mùi hôi, bốc mùi, phân chó/chim (không dấu), nôn ra, lá cây, mạng nhện, dầu mỡ, đồ đổ (sơn/sữa/cà phê…), kính bẩn, vỏ chai, đầu lọc/tàn thuốc, giấy vụn, vương vãi, vứt bừa, kẹo cao su, đất cát/bùn đất, lông chó, rêu, thùng carton, nhớp nháp, "không/chưa ai lau/dọn", "dơ/bẩn quá" không dấu (loại trừ "tôi/em… bận quá"). "đổ tràn" giữ nguyên nghĩa.
- `proposer.py` — **nhánh vô lý tìm thấy ở (d)**: luật ra CATEGORY_UNCLEAR (thấy cả hai playbook) + LLM chọn một ⇒ code cũ trả playbook LLM (`needs_review`), giấu phần việc còn lại. Sửa: giữ CATEGORY_UNCLEAR, ghi note "Luật thấy cả hai playbook; LLM chọn … — BPTN quyết". Các nhánh khác (luật+LLM đồng ý; luật khớp+LLM UNKNOWN ⇒ UNCLEAR; luật≠LLM ⇒ UNCLEAR; luật OUT+LLM đề xuất ⇒ needs_review; OUT+UNKNOWN ⇒ OUT; LLM lỗi ⇒ fallback luật) chạy hợp lý trên toàn kho, có test.
- Test: tạo `test_classify_metamorphic.py` (811 test: kho, biến thể, vị trí, 7 nhánh proposer × kho); thêm 24 ca `test_plan05_location_and_wording` vào `test_rules_review_fixes.py` (gồm ca đối chứng chống báo nhầm: "không lâu sau", "tôi bận quá", "đèn sáng rồi", "đèn hành lang trước căn hộ 305" vẫn TEC). Không sửa kỳ vọng test cũ nào.

## 4. Câu còn sai + lý do
- Trong kho: 0.
- Ngoài kho, biết mà chưa làm (cần SO/spec quyết):
  - "bóng tuýp chết", "tối om" KHÔNG có chữ "đèn": luật vẫn OUT (để LLM). Lý do: `test_proposer.py::test_llm_classifies_what_the_rules_miss` + `test_engine_calls_llm_once…` + `test_llm_reason_is_capped` khẳng định luật phải bỏ sót câu này; đổi là sửa kỳ vọng test cũ ⇒ chờ SO. "Bóng đèn tuýp cháy", "đèn chết" thì luật đã bắt.
  - Từ không dấu đa nghĩa vẫn có thể báo nhầm khi có khu vực: "ban/do quá" (bẩn/dơ vs bận/đó), "son do" (sơn đổ vs sơn đỏ), "den … hong" ngay sau "đến" không có động từ đi kèm. Đánh đổi chấp nhận, không có câu thật nào trong kho bị nhầm.
  - Côn trùng (gián, muỗi, chuột) xếp OUT: playbook §5/§6.1 chỉ nêu rác/bẩn/tràn đổ/yêu cầu vệ sinh. Đèn đường ngoài cổng xếp OUT: không thuộc khu vực chung của tòa (§7.1). Cần nhóm xác nhận.

## 5. Đề xuất cho SO
- `lexicon.priority.high_areas`: không cần thêm (không thêm khu vực mới vào `AREA_PATTERNS`); `vi.yaml` không đổi.
- Quyết việc cho luật bắt "bóng tuýp chết"/"tối om" (đổi 3 test proposer cũ sang câu khác) hay giữ cho LLM.
- Sửa proposer nhánh UNCLEAR+LLM là đổi hành vi (docstring module vẫn đúng: "a playbook only the LLM found" — trường hợp này luật đã thấy cả hai). Nếu nhóm muốn giữ cũ: bỏ nhánh `elif rules_cls.reason_code == ReasonCode.CATEGORY_UNCLEAR` (5 dòng) trong `propose()` + test `test_a_mixed_report_stays_unclear_whatever_the_llm_picks`.
- Cập nhật `docs/maintenance.md` §12 + não bộ (ngoài phạm vi worker).

## 6. Phân công thực tế
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP2 phân loại + vị trí | 🟠 | Claude Opus 5.5 (lên một tầng; không phóng agent con) |

## 7. git diff --stat (chưa commit; file mới chưa track)
```
 src/maintenance/proposer.py                       |  5 ++
 src/maintenance/rules.py                          | 98 +++++++++++++++++++++--
 tests/test_maintenance/test_rules_review_fixes.py | 45 +++++++++++
 ?? tests/test_maintenance/test_classify_metamorphic.py
 ?? planning/05_2026-10-04_agent-hardening/reports/R02_classify-metamorphic.md
```

(Phán quyết vòng 1: ✅ thi công xong, 0 vi phạm / 2926 biến thể, pytest 2678 pass — thay bằng phán quyết vòng 2 dưới đây.)

## Vòng 2 (SO quyết 2026-10-04: giữ sửa proposer; luật bắt đèn tuýp; côn trùng/đèn đường giữ OUT)
### Đã làm
- `rules.py`: `TUBE_LAMP = r"\btuyp\b"` là danh từ đèn (cần khu vực chung như `luminaire`); thêm `tuyp` vào mẫu đèn trong căn hộ. "Tối om"/"tối thui" không có danh từ đèn: vẫn OUT (để LLM).
- Kho + biến thể: thêm 7 câu tuýp (đèn), "Tối om, không thấy đường" + "Bóng tuýp trong căn hộ tôi bị hỏng" (OUT), "Bóng tuýp chết, rác thì chất đống" (trộn) ⇒ **143 câu, 3146 biến thể, 6292 phép kiểm, 0 vi phạm**.
- `test_proposer.py`: đổi CÂU VÍ DỤ trong đúng 3 test được phép, không đổi kỳ vọng nào:
```
-    text = "Hành lang tầng 3 tòa SIM-A tối om, bóng tuýp chết rồi"
+    text = "Hành lang tầng 3 tòa SIM-A tối om, không thấy đường"          # test_llm_classifies_what_the_rules_miss
-    case = engine.receive("Bóng tuýp hành lang tầng 3 tòa SIM-A chết rồi", received_at=monday)
+    case = engine.receive("Hành lang tầng 3 tòa SIM-A tối om, không thấy đường", received_at=monday)  # test_engine_calls_llm_once…
-    result = propose("Hành lang tầng 3 tối om, bóng tuýp chết rồi", fake(llm_says), "gpt-test")
+    result = propose("Hành lang tầng 3 tối om, không thấy đường", fake(llm_says), "gpt-test")  # test_llm_reason_is_capped
```

### Lệnh + exit
| Lệnh | Kết quả |
|---|---|
| `python -m pytest -q -p no:cacheprovider` | `7 failed, 2731 passed, 29 deselected` · **exit 1** |
| bộ biến thể (`violations()`) | 0 / 6292 |
| `ruff check src tests` | `All checks passed!` exit 0 |
| `ruff format --check src tests` | `74 files already formatted` exit 0 |
| `grep -cP '[\x08\x0b\x0c]'` rules.py / test_proposer.py / test_classify_metamorphic.py | 0 / 0 / 0 |

### ⛔ Chặn: 7 test NGOÀI 3 test được phép cũng dùng câu "bóng tuýp chết" làm ví dụ "chỉ LLM thấy"
- `test_acceptance.py::test_13_pending_review_cannot_be_routed` (5 tham số) + `test_13b_the_guard_itself_refuses_routing_without_review` — dòng 336, 347
- `test_engine.py::test_step5_llm_only_proposal_waits_for_bptn` — dòng 208
- Nguyên nhân: luật giờ bắt câu đó (đúng ý SO) ⇒ không còn PENDING_REVIEW. `test_acceptance.py` thuộc nhóm "không đổi kết quả" và ngoài quyền được cấp ⇒ KHÔNG sửa, báo SO.
- Bản vá đề xuất (cùng kiểu đổi câu ví dụ, không đổi kỳ vọng): `C:\Users\lenku\AppData\Local\Temp\claude\d--P151\640e8089-3b43-4a75-9055-cbb167391b76\scratchpad\proposed_acceptance_engine.patch` — thay 3 chỗ `"Hành lang tầng 3 tòa SIM-A tối om, bóng tuýp chết rồi"` ⇒ `"Hành lang tầng 3 tòa SIM-A tối om, không thấy đường"`. Đã áp thử rồi hoàn lại: `2738 passed, 29 deselected` (0 fail). Áp được bằng `git apply <patch>` từ root worktree.

### Cần Trường xác nhận
- Côn trùng (gián, muỗi, chuột) ⇒ OUT_OF_SCOPE (playbook §5/§6.1 không gồm diệt côn trùng).
- Đèn đường ngoài cổng / đường phố / vỉa hè ⇒ OUT_OF_SCOPE (không phải khu vực chung của tòa, §7.1).

🔁 SỬA: cần SO cấp quyền đổi câu ví dụ trong `test_acceptance.py` (2 test) + `test_engine.py` (1 test) theo bản vá trên; sau đó pytest 2738 pass / 0 fail.

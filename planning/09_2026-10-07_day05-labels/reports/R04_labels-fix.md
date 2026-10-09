Vai: worker (vai-thi-cong) · loại: thi công · họ/model: Claude Sonnet 5.5 (claude-sonnet-5-5), tầng 🟠 · Bước 0: exit 1 (MODULE_NOT_FOUND, đã biết, không sửa) · hiểu việc: phạm vi = chỉ GHI cases.json, label-proposals.json, R04 (held-out-request.md giữ nguyên), không gọi classify/assess/engine/LLM, không sửa src/seed/tests, không đọc .env, không git add/commit/push; xong khi = script độc lập trong scratchpad tự đếm và in từng số, exit 0 trên bản thật, exit 1 trên bản lỗi cố ý; cấm = ghi gold/ACCEPTED/reviewed_by, nhồi family, gán EM cho mọi chữ "kẹt", ghi pass khi số lệch
Handoff: handoffs/H04_labels-fix.md
Base: 8dd6baa5e733fd9dd917b30522b131d520471e05
Head: (chưa commit)

## 1. Lệnh và exit code nguyên văn

| # | Lệnh | Exit |
|---|---|---|
| 0 | `cd /c/P-151-truong && node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` | 1 (`Error: Cannot find module 'C:\brain4agent.release\.agents\skills\.xay-dung-nao-bo\scripts\init_brain.js'`, code `MODULE_NOT_FOUND`) |
| 1 | `PYTHONUTF8=1 .venv/Scripts/python.exe <scratchpad>/h04/build_h04.py` (sinh 2 file; dữ liệu soạn tay trong bảng ROWS, offset bằng `text.find`) | 0 (`50 cases, 70 proposals`) |
| 2 | `PYTHONUTF8=1 .venv/Scripts/python.exe <scratchpad>/h04/check_h04.py` (bản thật) | 0, `RESULT: PASS` |
| 3 | cùng script, trên bản lỗi cố ý gộp 9 lỗi (`broken_all/`) | 1 |
| 4 | cùng script, từng lỗi riêng: capital, quota, reason, offset, emptyun, family, fixture, generic, d411 | 1, 1, 1, 1, 1, 1, 1, 1, 1 |

`<scratchpad>` = `C:/Users/caotr/AppData/Local/Temp/claude/c--P-151-truong/168221f8-d289-4923-9c33-100200559616/scratchpad`. Script kiểm đọc lại hai file JSON và tự đếm, không đọc con số khai báo; không import `src/`.

Lần chạy đầu của script bắt 2 lỗi thật của chính bản nháp (3 câu UNCLEAR âm thanh trùng tập hiện tượng; câu 0038 không dấu "day tran" = "đầy tràn" trùng "dây trần" S-03), đã sửa rồi chạy lại. Hai lượt chạy trên bản lỗi (`reason` và gộp) lúc đầu chết bằng traceback do sort lẫn `None`; đã sửa script thành báo FAIL gọn, kết quả bên dưới là lần chạy sau sửa.

## 2. Số đo (stdout nguyên văn của script, bản thật, exit 0)

```
OK   cases: 50
OK   duplicate case_id: 0
OK   ids == D5-C-0001..0050: [D5-C-0001 .. D5-C-0050] n=50
OK   split!=DEVELOP or synthetic!=true: 0
OK   cases without phenomena: 0
OK   SAFETY proposals (1 per case): [D5-C-0001 .. D5-C-0050] n=50
risk EMERGENCY/UNCLEAR/NONE = 15/15/20
OK   risk EMERGENCY: 15
OK   risk UNCLEAR: 15
OK   risk NONE: 20
OK   eligibility mismatch (ELIGIBLE <=> NONE): 0
OK   F-D4-11 size: 8
OK   F-D4-11 EMERGENCY: 4
OK   F-D4-11 NONE: 4
OK   original D4-11 cases: 1
OK   original text verbatim: có trẻ con bị kẹt ở sảnh chung cư tòa S5
OK   original source: ('USER_REPORTED_SYNTHETIC', 'planning/07_2026-10-04_online-acceptance/deliverables/issues.json#D4-11')
OK   original ref file exists: True
OK   D4-11 EM covers S1 and S5: ['S1', 'S5']
OK   D4-11 EM covers bị kẹt / bị mắc kẹt: ['bị kẹt', 'bị mắc kẹt']
OK   D4-11 EM covers trẻ con/trẻ nhỏ/em bé: ['em bé', 'trẻ con', 'trẻ nhỏ']
OK   D4-11 controls classification KT/VS/UNKNOWN: (1, 1, 2)
OK   D4-11 controls UNKNOWN reason: ['OUT_OF_SCOPE', 'OUT_OF_SCOPE']
OK   CLASSIFICATION proposals only for NONE cases: [D5-C-0005 .. D5-C-0050] n=20
classification VE_SINH/KY_THUAT/UNKNOWN = 8/8/4
OK   VE_SINH: 8
OK   KY_THUAT: 8
OK   UNKNOWN: 4
OK   invalid pair: 0
OK   UNKNOWN with reason_code null: 0
OK   UNKNOWN reason_code valid: 0
OK   UNKNOWN has >=1 CATEGORY_UNCLEAR and >=1 OUT_OF_SCOPE: (True, True)
OK   VE_SINH/KY_THUAT with reason_code != null: 0
OK   classification rationale missing/short: 0
families = 30; largest non-D4-11 = 3
OK   families with >3 cases (excluding F-D4-11): []
OK   family count >= 22: 30
signals total = 41
OK   signals with start>=end or text[start:end]!=quote: 0
OK   signals whose quote is the whole sentence: 0
OK   signals whose start != text.find(quote): 0
OK   EM without PRESENT tier-1: 0
OK   any P1-phase signal id used: []
OK   unknown signal ids: []
OK   EM outside D4-11: 11
EM coverage outside D4-11 = {'S-01': 2, 'S-02': 2, 'S-03': 1, 'S-04': 2, 'S-05': 2, 'S-14': 1}
OK   EM coverage S-01,02,03,04,05,14 each >=1: 1
OK   UNCLEAR with signals == []: 0
OK   UNCLEAR without T2/UNCLEAR evidence: 0
OK   UNCLEAR with T2-01/T2-02 but no demoted tier-1 UNCLEAR: 0
OK   UNCLEAR with tier-1 PRESENT: 0
OK   NONE with PRESENT/UNCLEAR signal: 0
OK   UNCLEAR duplicate phenomena sets: 0
OK   UNCLEAR starting with 'hình như': 0
UNCLEAR types = {'T2-02': 3, 'T2-01': 2, 'T2-05': 3, 'T2-03': 3, 'T2-04': 3}
OK   risk_reason generic/short/no spec ref: 0
OK   risk_reason duplicates: 0
OK   producer/model/call_status/error: [('LLM', 'claude-sonnet-5-5', 'OFFLINE', None)]
OK   payload.note: ['agent-drafted; not gold']
OK   gold/review markers (ACCEPTED, reviewed_by, review, status): []
OK   source kinds: {('USER_REPORTED_SYNTHETIC', 'planning/07_2026-10-04_online-acceptance/deliverables/issues.json#D4-11'): 1, ('LLM_PROPOSAL', 'agent-drafted-day05-H04'): 49}
OK   NONE sentences containing a hazard word outside a negation: []
fixture files scanned = 43; fixture strings (>=3 words) = 3267
OK   cases text equal to a seed/tests fixture: []
OK   cases text near-duplicate (>=0.92) of a seed/tests fixture: []
RESULT: PASS
```

Bảng đối chiếu "xong khi" (§4 handoff):

| Yêu cầu | Đo được |
|---|---|
| 50 case | 50 |
| risk EM/UNCLEAR/NONE | 15 / 15 / 20 |
| D4-11 | 8 = 4 EMERGENCY + 4 NONE |
| classification VE_SINH/KY_THUAT/UNKNOWN | 8 / 8 / 4; 4 UNKNOWN đều reason_code != null (CATEGORY_UNCLEAR 1, OUT_OF_SCOPE 3) |
| family lớn nhất ngoài F-D4-11 | 3 (≤3) |
| tổng family DEVELOP | 30 (≥22) |
| signal start>=end hoặc text[start:end]!=quote | 0 / 41 |
| UNCLEAR có signals rỗng | 0 / 15 |
| trùng ID / trùng text fixture seed+tests (bằng nhau sau chuẩn hoá, và tương đồng >=0.92) | 0 / 0 (43 file, 3267 chuỗi >=3 từ) |
| câu gốc nguyên văn, chữ thường | đúng |

Chứng minh script biết đỏ (bản lỗi cố ý, `broken_all/`, exit 1). Dòng FAIL nguyên văn rút từ stdout:

```
FAIL risk UNCLEAR: 16 (expected 15)
FAIL risk NONE: 19 (expected 20)
FAIL F-D4-11 size: 7 (expected 8)
FAIL original text verbatim: Có trẻ con bị kẹt ở sảnh chung cư tòa S5 (expected có trẻ con bị kẹt ở sảnh chung cư tòa S5)
FAIL D4-11 controls UNKNOWN reason: ['None', 'OUT_OF_SCOPE'] (expected ['OUT_OF_SCOPE', 'OUT_OF_SCOPE'])
FAIL UNKNOWN with reason_code null: 1 (expected 0)
FAIL families with >3 cases (excluding F-D4-11): ['F-STUFF'] (expected [])
FAIL signals with start>=end or text[start:end]!=quote: 1 (expected 0)
FAIL UNCLEAR with signals == []: 2 (expected 0)
FAIL risk_reason generic/short/no spec ref: 1 (expected 0)
FAIL cases text equal to a seed/tests fixture: ['D5-C-0037'] (expected [])
RESULT: FAIL risk UNCLEAR; risk NONE; ...; cases text equal to a seed/tests fixture
```

Chín lỗi riêng lẻ cho exit 1 từng lần: viết hoa câu gốc; hạ một NONE xuống UNCLEAR; reason_code UNKNOWN = null; start=end; UNCLEAR signals=[]; nhồi 4 câu vào một family; text trùng fixture; risk_reason = "Safety assessment"; tách một control ra khỏi F-D4-11.

## 3. Thay đổi so với H02 (đối chiếu từng mục bị 🔁 trong R02)

| Mục R02 | Sau H04 |
|---|---|
| D4-11 chỉ 4 câu | 8 câu (4 EM + 4 control NONE) |
| classification 3/8/9 | 8/8/4 |
| reason_code UNKNOWN null | 4/4 UNKNOWN có reason_code |
| UNCLEAR signals rỗng | 0/15 rỗng |
| offset sai 15/50 | 0/41 sai |
| risk_reason chung chung | 0 câu chung chung; mỗi câu nêu căn cứ + `CR-BPTN-03 §…` |
| câu gốc D4-11 viết hoa | nguyên văn chữ thường |

## 4. Phạm vi file

- Ghi: `planning/09_2026-10-07_day05-labels/deliverables/cases.json` (26876 byte), `planning/09_2026-10-07_day05-labels/deliverables/label-proposals.json` (45867 byte; 50 SAFETY + 20 CLASSIFICATION = 70 record), `planning/09_2026-10-07_day05-labels/reports/R04_labels-fix.md`.
- `git diff --stat` file đã theo dõi: rỗng cho phần của H04 (thư mục `planning/09_2026-10-07_day05-labels/` là untracked, `git status --short` ghi `?? planning/09_2026-10-07_day05-labels/`; danh sách ` M` giống nguyên trạng ban đầu). SHA hiện tại = Base `8dd6baa5e733fd9dd917b30522b131d520471e05`, chưa commit.
- `held-out-request.md`: không đụng (mtime 12:26:37, trước phiên này). Không đụng `src/ seed/ tests/ .env`, không git add/commit/push.
- Script tạm (`build_h04.py`, `check_h04.py`, `break_h04.py`, các thư mục `broken_*`) nằm trong scratchpad, không ở root.

## 5. Bảng phân công thực tế

| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| Soạn 50 câu + proposal + script kiểm | 🟠 | Claude Sonnet 5.5 (claude-sonnet-5-5), làm trực tiếp |
| Spawn subagent | không | không spawn |
| Review gold | 🔴 (người) | chưa thực hiện, ngoài phạm vi |

## 6. Việc KHÔNG làm + lý do

| Việc | Lý do |
|---|---|
| Ghi classification-gold / safety-gold / ACCEPTED / reviewed_by | cấm tại H04 §5; mọi record là `PROPOSED` ngầm định, `note="agent-drafted; not gold"` |
| Gọi classify/assess/propose/engine/LLM để đối chiếu | cấm tại H04 §2; nhãn do tôi đọc CR-BPTN-03 §6 và rules.py (chỉ đọc định nghĩa loại việc) rồi quyết định |
| Chạy `tools/validate_day05.py`, pytest, ruff | ngoài "xong khi" của H04; không đổi mã nguồn |
| Sửa `held-out-request.md` | giữ nguyên theo H04 §2 |
| Sao chép lỗi bản cũ | chỉ đọc `rejected/` để lấy ý tưởng; viết lại toàn bộ |

## 7. Câu hỏi mở

1. Biểu diễn T2-01/T2-02: lexicon ghi T2-01/T2-02 không phải tín hiệu riêng (chúng hạ tín hiệu Bậc 1). Tôi ghi MỖI câu hedge/đã hết thành hai signal: `S-0x` status `UNCLEAR` (quote = cụm Bậc 1) và `T2-01`/`T2-02` status `PRESENT` (quote = cụm nghi ngờ/đã hết). Cần reviewer chốt có giữ signal T2-01/02 trong gold hay chỉ giữ `S-0x UNCLEAR`.
2. Nhãn không chắc, đã ghi "Cần review" trong notes: 0028 (cầu dao bị cháy: UNCLEAR hay NONE), 0029 ("cơm khét" B-04: UNCLEAR hay NONE). Các nhãn dựa luật B-01/Q22 nên reviewer nên nhìn lại: 0044 (bóng đèn bị cháy ⇒ NONE), 0035/0048 (đèn chập chờn ⇒ NONE).
3. Oracle classification chưa đối chiếu với `classify` hiện hành (cấm gọi). Các câu không dấu/chính tả (0038, 0040, 0045, 0048) và câu "thiếu vị trí" (0041, 0043, 0047) có thể cho kết quả runtime khác nhãn; nếu lệch thì ghi backlog, giữ nhãn.
4. Bẫy bỏ dấu "đầy tràn" = "dây trần": bản nháp đầu có câu 0038 trúng bẫy này; tôi đổi sang "đầy ắp" để NONE không bị nhiễu bởi trùng từ. Muốn giữ bẫy làm case riêng thì cần người quyết (tăng quota NONE hoặc đưa vào held-out do người soạn).
5. S5 ngoài thí điểm: 0001, 0004, 0005, 0006, 0008 chứa tòa S5, đã ghi notes ở các câu D4-11; loại việc không suy UNKNOWN chỉ vì tòa (0005 KY_THUAT, 0008 VE_SINH).

## Tiếp theo

🖐 Cần tay người: reviewer khác người đề xuất (Như Ý cho safety) đọc 50 câu + proposal, quyết 2 mục nhãn "Cần review" và câu hỏi 1 (biểu diễn T2-01/02); chưa có ai ACCEPTED nên gold vẫn rỗng.
🤖 Agent làm được ngay: chờ lệnh để chạy `tools/validate_day05.py` trên hai file mới, hoặc sửa nhãn/câu theo quyết định reviewer.
⭐ Nên làm trước: đo lại bằng script độc lập của orchestrator (không dùng script này) vì đây là bộ đo mới, rồi mới giao reviewer.
⏸ Chưa làm: gold/ACCEPTED/dispute, split-manifest, baseline, `held-out-request.md` (giữ nguyên), vì ngoài phạm vi H04 hoặc cần người duyệt.

## Đo lại của orchestrator
- `validate_day05.py --structure-only` trên dữ liệu thật: exit 0, `STRUCTURE_PASS`, G2/G3 OPEN (evidence/run05-orch-remeasure/validate-structure.txt). Dữ liệu H04 dựng thành gold giả trong thư mục tạm (không phải deliverable) + 10 đột biến độc lập: baseline exit 0, 10/10 bị từ chối (run05-orch-remeasure/adversarial-out.txt, adversarial.py). Auditor cô lập đo lại độc lập: 50 case, 15/15/20, 8/8/4, F-D4-11 = 8 (4 EM + 4 control), 30 family, quote khớp, 0 gold/ACCEPTED/reviewed_by, 0 secret.
- Đọc thủ công cả 50 câu: nhãn cần reviewer soi (0028, 0029, 0035, 0044, 0048; cách ghi T2-01/T2-02) đã ghi ở deliverables/day05-summary.md §3–§4. Đây là PROPOSAL, không phải gold; không tự ACCEPTED.

✅ DUYỆT (chỉ cho proposal DEVELOP; gold và held-out vẫn cần người thật)

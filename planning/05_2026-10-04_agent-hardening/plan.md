# 05 — Làm cứng Agent phân tích bằng kiểm thử biến thể (2026-10-04)

| Trường | Giá trị |
|---|---|
| Trạng thái | 🟡 ĐANG THỰC THI — mở 2026-10-04 |
| Loại | PATCH (sửa lỗi Agent, không đổi contract/spec đã duyệt) — AGENTS §3.2.5: chỉ `plan.md` |
| Yêu cầu | Người dùng (Như Ý), 2026-10-04: "sửa toàn diện phần agent" — sau khi demo trên `develop` lộ "Sảnh thang máy tầng 2 tòa SIM-C có khối rác chưa dọn" ⇒ khẩn cấp (plan 04 chỉ sửa câu không có tên tòa) |
| Nhánh | `fix/nhuy-agent-hardening` từ `origin/develop` `37a0fb3` (đã gỡ upstream để không push nhầm `develop`) |
| Đích | PR vào `develop` |
| Phạm vi | CHỈ phần Agent: `src/maintenance/safety.py`, `seed/maintenance_v1/lexicon.yaml` (khối `safety`), `src/maintenance/rules.py`, `src/maintenance/proposer.py`, test của chúng. KHÔNG router/auth/store/UI (chủ việc khác — plan 04 H03/H04) |

## §1. Vì sao lần trước sót
Câu thử của plan 04 (cả 3 vòng worker + thẩm định) gần như không có vị trí đầy đủ kiểu cư dân viết ("Tòa SIM-A / Tầng 3 / Hành lang: …", "… tầng 4 tòa SIM-B"). Từ xác nhận `confirmers.khoi: toa` (ý là "tỏa") khớp chữ "tòa" có trong hầu hết phản ánh ⇒ "khối" gõ sai dấu thành "khói". Lỗi thuộc LỚP (từ ngắn trùng chữ vị trí), không phải một câu.

## §2. Nhật ký quyết định
| # | Mốc | Quyết định | Lý do | Lật · chi phí |
|---|---|---|---|---|
| Q01 | 2026-10-04 | **Kiểm thử biến thể (metamorphic) là cổng chính:** mọi ca nhãn an toàn + câu phân loại được bọc thêm vị trí theo nhiều mẫu (đầu câu/cuối câu, có/không "tòa", có/không dấu, "Tòa X / Tầng N / Khu: …"); thêm vị trí KHÔNG được đổi mức an toàn, loại việc. Vi phạm = lỗi | Bắt cả lớp lỗi, không vá từng câu | — |
| Q02 | 2026-10-04 | Rà từng từ xác nhận/đệm/tiền tố trong `lexicon.safety` trùng chữ thông dụng của phản ánh (tòa, tầng, ra, lên, bị, có…) | Nguyên nhân gốc của lỗi "khối … tòa" | — |
| Q03 | 2026-10-04 | KHÔNG đổi spec: CR §5.1 (bước 2 hỏi vị trí trước phân loại), B-03 ("cháy" đứng riêng = Bậc 2), "kêu cứu" nghĩa bóng = Bậc 1 (plan 04 Q12). Được sửa `safety.py` chỉ theo hướng KHÔNG hạ mức an toàn | Spec của Trường/nhóm; an toàn trước | — |
| Q04 | 2026-10-04 | Thẩm định độc lập bắt buộc viết câu như cư dân thật, CÓ vị trí đầy đủ; làm đỏ trước khi SO gộp | Lỗ của plan 04 | — |

| Q05 | 2026-10-04 | **Người dùng duyệt ("ừ có nhé") đổi điều phối ngoài phạm vi:** phản ánh mà phân loại ra OUT_OF_SCOPE rõ ràng (không khớp playbook nào, không phải CATEGORY_UNCLEAR) và CHỈ thiếu vị trí ⇒ dừng VERIFYING/OUT_OF_SCOPE (chủ BPTN) ngay ở bước 2, không hỏi cư dân vị trí. Tầng an toàn 2b vẫn chạy trước. Blocker này `resume_step=2`: BPTN chọn loại việc xong thì chạy lại từ bước 2 ⇒ nếu vẫn thiếu vị trí thì MISSING_INFO (chủ BPTN) — không bao giờ giao việc thiếu vị trí. Thay thứ tự CR §5.1 cho trường hợp này; báo Trường cập nhật spec | Agent phải điều phối đúng người: câu hỏi phí/căn hộ không cần vị trí khu vực chung | Bỏ nhánh · rẻ |
| Q06 | 2026-10-04 | Duyệt hai đánh đổi của WP1: "…tia lửa, giờ hết rồi + vị trí" ⇒ UNCLEAR (đúng T2-02, trước đây chỉ lệch khi thêm vị trí); "khối/khỏi" gõ sai dấu chỉ là "khói" khi có cặp chữ chắc nghĩa. Duyệt WP2: luật bắt "bóng tuýp", câu trộn giữ CATEGORY_UNCLEAR kể cả khi LLM chọn một; 3 test cũ chỉ đổi câu ví dụ | Nhất quán với spec; không lộ phần việc bị giấu | — |
| Q08 | 2026-10-05 | Thẩm định end-to-end lần 1 🔁 (vị trí chèn giữa câu làm sót Bậc 1; S-03 lộ/lòi dây; 'day tran' không dấu; tách vị trí lấy tầng đầu tiên; B-01 'cứ/gần căn'; lỗi mới nước tràn vào tủ điện ⇒ giao Vệ sinh) ⇒ vòng 2: H03 an toàn, H04 phân loại/vị trí; SO: engine Q05 + vị trí bổ sung mới nhất ưu tiên + chuẩn hoá vị trí BPTN nhập | Báo cáo thẩm định | — |
| Q09 | 2026-10-05 | **Thu hẹp Q05** sau khi chạy lại script thẩm định (2 CRASH): chỉ bỏ hỏi vị trí khi phản ánh KHÔNG nhắc khu vực chung VÀ KHÔNG nhắc đèn/rác/bẩn (`rules.mentions_playbook_subject`). "Ở hành lang có vấn đề", "Đèn tầng 3 hỏng" vẫn hỏi cư dân (cư dân tự bổ sung được). Giới hạn: câu hỏi ngoài phạm vi có nhắc khu vực ("giờ mở cửa hầm xe") vẫn bị hỏi vị trí | Không làm mất luồng cư dân tự bổ sung | — |
| Q10 | 2026-10-05 | Để P1 (người dùng: "push rồi mới làm P1"): tín hiệu an toàn P1 (gas, kim tiêm, nước vào tủ điện, đèn nóng), luồng trùng đầy đủ CR §8, tách ticket khi một phản ánh có hai việc (người dùng hỏi), đếm trả sai phòng ban, giữ ticket thường khi cùng chỗ có khẩn cấp, ưu tiên "suýt trượt"/"tràn ra cả hành lang". Giữ "bong den … bi chay" không dấu ở Bậc 2 (văn bản không dấu giữ mức cao, test P1-11) | Phạm vi | — |
| Q11 | 2026-10-05 | **Bản vá 05b (người dùng: "đèn cháy hoặc đèn chập không phải khẩn cấp — đèn cháy là đèn hỏng"):** "đèn/bóng/tuýp … chập, chập điện/mạch" vào B-01 (vô hại) và là triệu chứng đèn hỏng (KY_THUAT); khi chữ "den"/"bong" VÀ triệu chứng ("bi chay/bi chap") đều gõ không dấu thì nhận là đèn (xét từng chữ; bộ biến thể bắt được bản đầu xét cả câu bị hỏng khi ghép vị trí có dấu) (thay P1-11: "Bong den hanh lang tang 3 bi chay" ⇒ NONE); có khói/tóe lửa/khét kèm thì vẫn khẩn cấp; "chập" không đi với đèn (ổ điện) vẫn cần người xem. Nhánh `fix/nhuy-lamp-burnt-short`, lexicon `2026-10-05.p0g` | Quyết định người dùng (chủ Agent) | — |
| Q07 | 2026-10-04 | Sửa lỗi job định kỳ chết do ticket có `created_at` cuối lịch (thẩm định backend A1, lỗi do plan 04 E5): `_orphaned` chặn tràn số, vòng job bắt mọi lỗi theo từng ticket và ghi log | Engine (chủ Như Ý); lỗi do SO gây ra | — |

### Quyết định bị thay thế
- CR §5.1 thứ tự "bước 2 hỏi vị trí trước phân loại" → thay một phần bởi Q05 (chỉ cho phản ánh ngoài phạm vi rõ ràng).

## §3. Work Packages
| WP | Việc | Tầng | Vai | Handoff |
|---|---|---|---|---|
| WP1 | Tầng an toàn: bộ biến thể + rà từ xác nhận + sửa lexicon/safety.py | 🔴 | worker Opus, worktree | `handoffs/H01_safety-metamorphic.md` |
| WP2 | Phân loại + vị trí: bộ biến thể + kho câu thật + sửa rules.py/proposer.py | 🟠 | worker Opus, worktree | `handoffs/H02_classify-metamorphic.md` |
| WP3 | Thẩm định đối kháng độc lập (câu có vị trí đầy đủ) | 🔴 | judge Opus, chỉ đọc | — |
| WP4 | Gộp, đo lại, kho phản ánh thật qua API, đồng bộ não, PR | 🔴 | SO | — |
| WP5 | Tầng an toàn vòng 2 (vị trí giữa câu, S-03, đầy tràn, B-01) | 🔴 | worker Opus | `handoffs/H03_safety-round2.md` |
| WP6 | Phân loại/vị trí vòng 2 (nơi có sự cố, mã tòa, cầu thang, lối thoát hiểm, nước vào tủ điện) | 🟠 | worker Opus | `handoffs/H04_classify-round2.md` |

## §4. Checklist
- [x] WP1 report R01 + SO đo lại
- [x] WP2 report R02 + SO đo lại (2 vòng; 3 test cũ chỉ đổi câu ví dụ)
- [x] WP3 thẩm định end-to-end 🔁 ⇒ vòng 2 (H03, H04) + engine; chạy lại script thẩm định: còn lại chỉ là P1/spec/Q05 có chủ đích (`evidence/04`)
- [x] WP4 pytest 2941 pass + ruff + bộ dừng xanh; đồng bộ não
- [ ] Push + PR + merge vào `develop`

## §5. Exit Gates
| Gate | Lệnh | local | server |
|---|---|---|---|
| G1 | `python -m pytest -q -p no:cacheprovider` (LLM_MODE=mock) | ✅ 2941 pass (`evidence/01`) | ⬜ |
| G2 | `ruff check src tests` + `ruff format --check src tests` | ✅ (`evidence/02`) | ⬜ |
| G3 | Bộ biến thể: 0 vi phạm (hoặc từng vi phạm còn lại có lý do ghi trong report) | ✅ an toàn 5669/0, phân loại 0 (`evidence/03`) | ⬜ |
| G4 | Thẩm định độc lập ✅ | ✅ script thẩm định chạy lại: 77 câu 16→7, nhóm D 9→2, còn lại P1/spec (`evidence/04`) | ⬜ |

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

## §4. Checklist
- [ ] WP1 report R01 + SO đo lại
- [ ] WP2 report R02 + SO đo lại
- [ ] WP3 thẩm định ✅
- [ ] WP4 pytest + ruff + bộ dừng xanh; kho phản ánh thật qua API; đồng bộ não; PR

## §5. Exit Gates
| Gate | Lệnh | local | server |
|---|---|---|---|
| G1 | `python -m pytest -q -p no:cacheprovider` (LLM_MODE=mock) | ⬜ | ⬜ |
| G2 | `ruff check src tests` + `ruff format --check src tests` | ⬜ | ⬜ |
| G3 | Bộ biến thể: 0 vi phạm (hoặc từng vi phạm còn lại có lý do ghi trong report) | ⬜ | ⬜ |
| G4 | Thẩm định độc lập ✅ | ⬜ | ⬜ |

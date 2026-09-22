# R13 — Thi công Đ37 (`conversation_id` uuid) + Đ38 (citations cho `source_conflict`)

Vai · **super orchestrator** · loại **thi công** (report dựng lại) · họ/model: Claude Opus 5 · Bước 0 exit **0** (`NÃO ĐÃ OK — KHÔNG CẦN NÂNG CẤP`) · hiểu việc: đóng hồ sơ cho hai bản vá đã nằm trong working tree nhưng mất report khi phiên trước bị cắt — **phạm vi** `lib/adapters/db.ts`, `lib/pipeline/index.ts`, 4 script đo, 2 file test mới; **xong khi** mọi cổng offline exit 0 + có một lượt chạy THẬT trên Postgres exit 0; **cấm** tick `G11`, cấm sửa `eligibility.ts`, cấm thêm dependency ngoài `node:crypto`.
Handoff: [`handoffs/H10_uuid-conflict-d37-d38.md`](../handoffs/H10_uuid-conflict-d37-d38.md)
Base: `27c38f5c086c1d432d489e651f9b23687970e158`
Head: working tree chưa commit (6 file sửa + 2 file test untracked)

> **Ghi chú tính trung thực của hồ sơ này.** Code của hai gói do worker phiên trước viết; phiên đó bị cắt trước khi kịp ghi report, nên **mọi con số dưới đây là SO tự đo lại từ đầu trên working tree**, không chép của ai. Đó cũng đúng luật K.5 (*người duyệt ĐO LẠI, không tin report*) — chỉ khác là ở đây không có report nào để mà tin. Bản thẩm định đối kháng độc lập đi riêng ở `R14`.

## 1. Cổng đã chạy — lệnh và mã thoát nguyên văn

| Lệnh | Mã thoát | Số đo | Bằng chứng |
| :-- | :-- | :-- | :-- |
| `npx tsc --noEmit` | `EXIT=0` | — | [`evidence/uuid-conflict/tsc.txt`](../evidence/uuid-conflict/tsc.txt) |
| `node scripts/run_tests.mjs` | `EXIT=0` | **tests 143 · pass 143 · fail 0 · skipped 0** (nền `27c38f5` = 134) | [`evidence/uuid-conflict/tests.txt`](../evidence/uuid-conflict/tests.txt) |
| `bash scripts/check_adapter_boundary.sh` | `0` | `violations: 0` | BB-07 giữ nguyên dù thêm một câu SQL upsert |
| `DATA_BACKEND=postgres node scripts/trace_sample.mjs` | `EXIT=0` | 9 chặng, `decision=answer`, `citations=["POOL-SAFE-03"]`, 3 model khác nhau | [`evidence/uuid-conflict/trace_postgres_d37.txt`](../evidence/uuid-conflict/trace_postgres_d37.txt) |
| `DATA_BACKEND=postgres node scripts/eval_golden.mjs --set=safety` | `EXIT=3` | `pass 11 · fail 4 · blocked 1` (15/16 có kết luận) | [`evidence/uuid-conflict/golden_safety_postgres.txt`](../evidence/uuid-conflict/golden_safety_postgres.txt) |
| `… --set=faq` | `EXIT=3` | `pass 0 · fail 0 · blocked 5` — **cạn hạn mức, Tầng 1** | [`evidence/uuid-conflict/golden_faq_postgres.txt`](../evidence/uuid-conflict/golden_faq_postgres.txt) |

`git diff --stat`: 6 file, **+207 / −18**. Hai file test untracked: `tests/conversation-id.test.ts` (211 dòng), `tests/conflict-citations.test.ts` (119 dòng). Chênh lệch test 143 − 134 = **9 test mới** nằm đúng trong hai file đó.

## 2. Đ37 đã xong tới đâu — và nó sâu hơn một tầng so với lúc giao

Hợp đồng thi hành đúng như Đ37 chốt: hàm băm nhãn người đọc được thành uuid **tất định** (SHA-256 → 16 byte đầu → gán nibble version 5 + 2 bit variant RFC 4122), **không** `randomUUID()`, để `--resume` nối lại đúng hội thoại cũ.

**Worker tìm ra một tầng mà Đ37 chưa nhìn thấy.** Vá xong `conversation_id`, chạy thật trên Postgres thì vỡ tiếp ở `scripts/_fixtures.mjs`: `user_id: "demo-resident-0001"` — **cột `users.id` cũng là `uuid`**, và `conversations.user_id` là FK trỏ tới nó. Cùng một lớp lỗi, một tầng sâu hơn.

Cách vá đáng ghi nhận vì nó **từ chối một lối tắt sai**: `scripts/seed_users.mjs` không ghim `id` (để Postgres tự sinh), nên id thật **đổi sau mỗi lần seed lại**. Hardcode một uuid snapshot sẽ chạy hôm nay và vỡ lần seed kế tiếp — đúng kiểu vá tạo ra bom hẹn giờ. Bản vá tra **sống** qua `findUserByEmail()` khi `DATA_BACKEND=postgres`, giữ hằng số cố định trên `mock` (không đổi hành vi mock — Đ24).

Kèm một chi tiết về thứ tự nạp ESM đáng giữ lại: module được import **chạy trước** thân file import nó, nên `loadLocalEnv()` gọi ở thân `eval_golden.mjs` là **quá muộn** cho top-level await trong `_fixtures.mjs`. Bản vá gọi `loadLocalEnv()` ngay trong `_fixtures.mjs` (idempotent, không override biến shell) để tự đủ, không phụ thuộc thứ tự import.

**Cổng canh đã có** (đúng đòi hỏi của Đ37 *"không có cổng thì lỗi này quay lại y hệt ở script thứ tư"*): `tests/conversation-id.test.ts`, 7 test.

## 3. Đ38 đã xong tới đâu — và nó được chứng minh trên DỮ LIỆU THẬT

`escalateResult()` nhận thêm tham số `citations` mặc định mảng rỗng; **chỉ** nhánh `conflictDetected` (gate `G1_conflict`) truyền vào. Nguồn dữ liệu là `elig.rejected` lọc theo lý do `conflict` — **đọc** kết quả `eligibility.ts` trả về, không sửa file đó (đúng vùng cấm của handoff). Khử trùng lặp tường minh theo `section_id` dù seed hiện tại là 1 section = 1 chunk. `toSnippet()` cắt ≤ 300 ký tự theo câu (`01-CONTRACTS` §7).

**Bằng chứng mạnh nhất của cả gói:** ca Golden `S03` — cặp tài liệu mâu thuẫn `DEF-03` — chạy trên Postgres thật trả

```
case_id=S03  decision=escalate  reason_code=source_conflict  gate=G1_conflict
checkpoint_safe_behavior=true  checkpoint_gate=true  checkpoint_shows_conflict=true
```

`checkpoint_shows_conflict` là chính checkpoint mà Đ36 cấm khai vùng cấm, và Đ38 nói *"sản phẩm hứa hai nguồn rồi đưa không nguồn nào"*. **Nay nó đưa thật.** Đây là cảnh demo mạnh nhất của dự án, và lần đầu nó có số đứng sau.

## 4. Việc KHÔNG làm + lý do

- **KHÔNG tick `G11`.** Vùng cấm Đ36/Đ37 còn hiệu lực, và nay có thêm căn cứ số: `M3` = 11/16 < ngưỡng 15/16, `M1` chưa có số (blocked Tầng 1). Xem Đ39.
- **KHÔNG sửa 4 ca Golden trượt.** Ba trong bốn ca là phát hiện MỚI, đã phân loại ở Đ40 (`S16`, `S14` = lỗi bộ đo) và Đ41 (`S01`, `S06` = trượt thật). Sửa chúng là gói việc khác, phải có handoff riêng — và CẤM sửa kỳ vọng cho khớp đầu ra (vùng cấm Đ40).
- **KHÔNG commit.** Chờ phán quyết thẩm định `R14`.
- **KHÔNG chạy nốt bộ `faq`.** Hạn mức Gemini đã cạn thật (cầu dao dừng sớm ở 5 lần dính liên tiếp) — Tầng 1, không phải trượt.

## 5. Bảng phân công thực tế

| Gói | Tầng yêu cầu | Họ/model đã dùng | Ghi chú |
| :-- | :-- | :-- | :-- |
| Đ37 — hợp đồng `DataStore.appendMessage` | 🔴 | Claude Sonnet (worker phiên trước) | **LỆCH TẦNG — ghi nhận thẳng:** đổi hợp đồng adapter là 🔴, đã làm bằng 🟠. Bù lại bằng thẩm định đối kháng 🔴 ở `R14` |
| Đ37 — đổi 4 script đo theo mẫu | 🟠 | Claude Sonnet | khớp |
| Đ38 — citations cho lượt escalate | 🔴 | Claude Sonnet (worker phiên trước) | **LỆCH TẦNG**, bù như trên |
| Đo lại toàn bộ + lượt Postgres thật + Golden | 🔴 | Claude Opus 5 (SO) | khớp |
| Thẩm định đối kháng cô lập | 🔴 | xem `R14` | khác họ với worker thi công |

## 6. Câu hỏi cần người quyết

1. **Hạn mức Gemini cho `M1`.** Câu hỏi Đ17 nay đã có đối tượng cụ thể: bộ `safety` ăn hết hạn mức của phiên, bộ `faq` (40 ca answerable, ~150 lời gọi) chưa chạy được ca nào. Nạp tiền Google Cloud, hay chấp nhận chạy rải nhiều phiên cho tới deadline 2026-09-27?
2. **`expected_gate` của `S04`/DEF-04** vẫn chờ — nay `S01`/DEF-01 trượt **cùng một trục** (Đ41), nên một phán quyết có thể đóng cả hai.
3. **Ngưỡng `M3` tính trên mẫu số nào** sau khi Đ40 chỉ ra `S16` không đi qua `runTurn`: giữ 15/16, hay đổi sang 15/15 và lái `S16` bằng đường `rejectAnswer` của `SPEC-P03`?

## 7. Phán quyết

Hai bản vá **đạt mọi số đo trong phạm vi được giao**: 143/143 test, `tsc` 0, `violations: 0`, một lượt Postgres thật exit 0, và Đ38 được chứng minh bằng `checkpoint_shows_conflict: true` trên ca `DEF-03`. Bốn ca Golden trượt **không thuộc phạm vi** hai bản vá này — chúng là phát hiện mới mà chính lượt chạy này phơi ra, và đã được ghi thành Đ39/Đ40/Đ41.

Vì gói bị thi công ở tầng thấp hơn tầng yêu cầu (🟠 làm việc 🔴), phán quyết này **treo cho tới khi có `R14`** — thẩm định đối kháng cô lập bằng họ model khác, tầng 🔴.

**🔁 SỬA: không có mục nào trong phạm vi Đ37/Đ38. Treo chờ `R14`; phán quyết cuối cùng là phán quyết của `R14`.**

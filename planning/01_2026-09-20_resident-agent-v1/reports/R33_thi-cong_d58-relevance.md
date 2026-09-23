Vai: worker (vai-thi-cong) · loại: thi công · họ/model: Claude Opus 5.5 (1M) · Bước 0: exit 0 (NÃO ĐÃ OK; cảnh báo BRN-028 today.md 157 dòng — không thuộc phạm vi) · hiểu việc: thêm lời gọi riêng `relevance` (câu hỏi + bản nháp, không evidence) sau `verify`, chỉ khi sắp `answer`; false ⇒ G3 theo luật Đ28/Đ41, s3 giữ số A3 thật / xong khi tsc 0 + 4 ca test từng đỏ + đo thật 4 câu × 2 + các cổng 0 / cấm: confidence.ts, eligibility, eval, specs, brain, package.json, git ghi, Golden, question_vi vào A3, evidence vào relevance
Handoff: planning/01_2026-09-20_resident-agent-v1/handoffs/H29_d58-relevance-check.md
Base: b2f8803
Head: b2f8803 (chưa commit — handoff CẤM git add/commit)

## 1. Lệnh + exit code

| Lệnh | Exit | Ghi chú |
| :-- | :-- | :-- |
| `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` | 0 | |
| `npx tsc --noEmit` (sau W1) | 0 | |
| `npx tsc --noEmit` (cuối, gồm script probe trong evidence) | 0 | |
| `node scripts/run_tests.mjs relevance-d58` (trước W2) | 1 | `evidence/h29-relevance/red.txt` RED 1: (a)(b)(d) đỏ, (c) xanh |
| như trên, phá S1 (relevance gọi cả khi đã escalate G4) | 1 | RED 2: (c) đỏ `1 !== 0` |
| như trên, phá S2 (`question_vi` truyền vào `runVerifier`) | 1 | RED 3: (d) đỏ "A3 chỉ được thấy draft_vi + evidence (VC-03)" |
| như trên, phá S3 (ép faithfulness=0 ở nhánh relevance false) | 1 | RED 4: (a) đỏ `0 !== 1` |
| khôi phục `lib/pipeline/index.ts` từ bản sao scratchpad, `sha1sum -c` | OK | không dùng git checkout |
| `node scripts/run_tests.mjs relevance-d58` (sau W2) | 0 | `green.txt`: 4/4 |
| `node scripts/run_tests.mjs` lần 1 | 1 | `full_tests_run1.txt`: 289 / 285 pass / 4 fail — 3 test cũ thiếu phản hồi giả thứ 4 (ContractDriftError relevance) + P05-M6 `EMAXCONNSESSION` (tranh kết nối pool Postgres) |
| `node scripts/run_tests.mjs` lần 2 (sau sửa 3 test cũ) | 0 | `full_tests_run2.txt`: 289 / 289 pass / 0 fail / 0 skip |
| `bash scripts/check_adapter_boundary.sh` | 0 | `violations: 0` |
| `bash scripts/check_no_confidence_ui.sh` | 0 | `matches: 0` |
| `npm run build` | 0 | `build.txt` |
| `MODEL_A2=gemini-3.5-flash node evidence/h29-relevance/live_probe.ts` | 0 | `live.txt`, 8 lượt `runTurn` Postgres, dọn 8/8 hội thoại (còn lại 0) |
| `node evidence/h29-relevance/live_relevance_direct.ts` | 0 | `live_relevance_direct.txt`, 2 lời gọi `runRelevance` |

## 2. Test

Tổng 289 · pass 289 · fail 0 · skip 0 (nền 285 + 4 mới `tests/relevance-d58.test.ts`). P05-M6 đỏ ở lần 1 là tranh kết nối (`max clients reached in session mode`), xanh ở lần 2 chạy trọn bộ.

## 3. Đo thật W3 (`live.txt`, `live_relevance_direct.txt`)

| Câu | Lần | decision / reason / gate | relevance | s3 (DB) |
| :-- | :-- | :-- | :-- | :-- |
| Làm lại thẻ xe máy bị mất… | 1 | escalate / no_eligible_source / G3 | không gọi (A2 `gemini-3.5-flash` tự `refused`) | 0 |
| Làm lại thẻ xe máy bị mất… | 2 | escalate / no_eligible_source / G3 | không gọi (A2 refused) | 0 |
| Cấp lại thẻ cư dân bị mất… | 1 | answer | true · 3.5-flash-lite · 923ms · 317/20 | 1 |
| Cấp lại thẻ cư dân bị mất… | 2 | answer | true · 879ms · 319/20 | 1 |
| Tốc độ tối đa trong hầm | 1 | answer | true · 876ms · 291/20 | 1 |
| Tốc độ tối đa trong hầm | 2 | answer | true · 1007ms · 291/20 | 1 |
| Thi công sửa chữa — thủ tục gì | 1 | answer | true · 1055ms · 334/20 | 1 |
| Thi công sửa chữa — thủ tục gì | 2 | answer | true · 1054ms · 322/20 | 1 |

8/8 đúng kỳ vọng; 0 lỗi. `MODEL_A2=gemini-3.5-flash` KHÔNG ép được DeepSeek: Gemini 3.5-flash còn hạn mức, `draft[gemini-3.5-flash]` ở cả 8 lượt ⇒ nhánh `relevance=false` KHÔNG được chạm qua `runTurn`. Đo bù (2 lời gọi): `runRelevance` thật với câu xe máy + bản nháp thẻ cư dân (nguyên văn A2 soạn ở câu 2 lần 1): lần 1 `{"answers_question":false,"missing_vi":"Câu hỏi hỏi về phí làm lại thẻ xe máy, nhưng bản nháp chỉ trả lời phí làm lại thẻ cư dân."}` (1240ms) · lần 2 `false` (932ms). Chi phí đo: +~0.9–1.1 s, ~320 in / 20 out token mỗi lượt `answer`.

## 4. `git diff --stat` (base b2f8803, chưa commit)

```
 lib/adapters/model.ts                              | 73 ++++++++++++++++++++++
 lib/pipeline/index.ts                              | 50 +++++++++++++++
 lib/types.ts                                       |  1 +
 tests/memory.test.ts                               |  1 +
 tests/pipeline-order.test.ts                       |  6 +-
 tests/pipeline-steps-persist.test.ts               |  1 +
 ?? tests/relevance-d58.test.ts
 ?? planning/01_2026-09-20_resident-agent-v1/evidence/h29-relevance/ (red.txt, green.txt, full_tests_run1/2.txt, build.txt, live.txt, live_relevance_direct.txt, live_probe.ts, live_relevance_direct.ts)
```
Ngoài phạm vi của tôi nhưng có trong `git status`: `plan.md`, `specs/01-CONTRACTS.md`, `specs/SPEC-P02-Agent-Pipeline.md`, `handoffs/H29` (đã bẩn trước khi nhận việc) và `brain4agent/-known-gotchas.md` (+4 dòng G52 Vercel, mtime 14:09:49 — agent khác ghi trong lúc tôi làm; tôi KHÔNG chạm).

## 5. Bảng phân công

| Gói | Tầng yêu cầu | Họ/model đã dùng |
| :-- | :-- | :-- |
| W1 adapter | 🟠 | Claude Opus 5.5 (lên tầng — không có model khác trong phiên) |
| W2 pipeline + test | 🔴 | Claude Opus 5.5 |
| W3 đo thật | 🟠 | Claude Opus 5.5 |
| W4 cổng | 🟢 | Claude Opus 5.5 |

## 6. Việc KHÔNG làm + lý do

- Không sửa `app/(resident)/chat/page.tsx`: panel in thẳng `s.step`, chặng mới tự hiện, không cần nhãn.
- Không chạy Golden (handoff cấm).
- Không ép được A2 sang DeepSeek trong `runTurn` (Gemini còn hạn mức); thay bằng 2 lời gọi `runRelevance` trực tiếp — đường G3-do-relevance chỉ được chứng minh end-to-end bằng test transport giả (ca a), chưa bằng lượt `runTurn` thật.
- Script probe giữ lại trong `evidence/h29-relevance/` (tiền lệ `h27-eligibility/probe.ts`); không để tiến trình nền, hội thoại đã dọn 8/8.

## 7. Quyết định trong phạm vi (ghi để người duyệt đổi được)

- Step `relevance` ghi `ok = answers_question` (false ⇒ `ok:false` + `note=missing_vi`), theo tiền lệ step `action` dùng `ok` cho kết quả nghiệp vụ.
- `maxOutputTokens = 1024` cho relevance (đo thật out = 20–45).
- `runRelevance` dựng lại payload chỉ gồm `question_vi`/`draft_vi` để caller không lỡ nhét evidence.

## 8. Câu hỏi cần người

- Có cần một lượt `runTurn` thật đi qua nhánh relevance=false (vd khi Gemini 3.5-flash 429, hoặc cho phép tạm đặt `MODEL_A2` = chuỗi Vyce) trước khi đóng Đ58 không? Nếu có, việc này thuộc SO/Golden.

## Tiếp theo

🖐 Cần tay người: duyệt diff và commit (handoff cấm worker commit).
🤖 Agent làm được ngay: chạy Golden để đo S02/F-ESC-02 với Đ58 (việc của SO).
⭐ Nên làm trước: Golden trọn — đó là chỗ duy nhất đo được Đ58 chặn ca DeepSeek soạn sai đối tượng trên luồng thật.
⏸ Chưa làm: lượt `runTurn` thật đi nhánh relevance=false (Gemini còn hạn mức nên A2 không rơi sang DeepSeek).

✅ W1–W4 đạt "xong khi" theo số đo ở trên (nghiệm thu thuộc người duyệt; lưu ý: nhánh relevance=false chưa có lượt runTurn thật, chỉ có test transport giả + 2 lời gọi runRelevance thật)

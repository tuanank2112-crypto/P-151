# 06 — Agent suy luận làm trung tâm điều phối + P1 (trùng/gộp, tách hai việc, an toàn P1, phòng ban, khẩn cấp lân cận, ticket tiếp theo)

| Trường | Giá trị |
|---|---|
| Trạng thái | 🟢 ĐÃ DUYỆT 2026-10-05 21:02:30 +0700 (người dùng: "ok làm đi cho quyết đó") — đang thi công |
| Loại SemVer | MINOR (Agent quyết định + tính năng P1; giữ API cũ, thêm method/trường; dữ liệu JSONB mới cần revision đánh dấu) |
| Spec nghiệp vụ | [`docs/CR-BPTN-03.md`](../../docs/CR-BPTN-03.md) (§4, §5, §6, §7, §8, §9.2–9.3, §11, §12, §15, §16 P1) — drift D-01…D-16 ở [`specs/00-ARCHITECTURE.md`](specs/00-ARCHITECTURE.md) §8 |
| Chủ việc | Như Ý (Agent/engine). Bàn giao route cho Châm Anh, UI cho Trí, nhãn/fixture cho Trường ([`specs/01-CONTRACTS.md`](specs/01-CONTRACTS.md) §13) |
| Nhánh | `feature/nhuy-reasoning-agent` từ `origin/develop` `82f01f0` (không upstream; KHÔNG push khi chưa duyệt) |
| Base đo | `82f01f002d729c276ecd0b8bf5ad78fa377c79e9` — `pytest -q` 2971 passed / 29 deselected; ruff sạch |
| Hạn | bàn giao nhóm 2026-10-19 23:59 (Notion: "P1 + LangGraph thật + eval") |
| Điều phối | super orchestrator (🔴); architect viết SPEC |

**Mục tiêu một câu:** Agent (LLM DeepSeek, OpenAI-compatible) suy luận từng bước và quyết định mọi bước điều phối kèm lý do + trích dẫn; engine kiểm hợp lệ, giữ giao dịch/khoá/audit/kho/SLA; luật cố định là lưới sàn an toàn (Agent chỉ được nâng mức) và phương án dự phòng — cộng toàn bộ phạm vi P1 đã chốt.

## §2. Nhật ký quyết định
Mốc = thời điểm architect ghi nhận, lấy bằng `date "+%Y-%m-%d %H:%M:%S %z"`.

| # | Mốc | Quyết định | Nguồn / lý do | Lật · chi phí |
|---|---|---|---|---|
| Q01 | 2026-10-05 20:02:09 +0700 | **Agent là trung tâm điều phối:** LLM suy luận từng bước (dữ kiện → đối chiếu playbook/spec → quyết định) và TOÀN QUYỀN quyết: mức nguy hiểm (chỉ nâng), loại việc (gồm tách), vị trí, hỏi cư dân/chuyển BPTN, trùng (trong ứng viên), phòng ban, ưu tiên, tài sản (trong ứng viên), vật tư (trong danh mục), cần người duyệt; mỗi quyết định có lý do + trích dẫn nguyên văn | Người dùng (Như Ý): "Không thể bắt key rồi suy ra kết quả, cần có bước suy luận" | Tắt bằng `MO_AGENT_ENABLED=false` · rẻ |
| Q02 | 2026-10-05 20:02:09 +0700 | **AI KHÔNG được tự hạ mức an toàn;** AI suy ra khẩn cấp ⇒ BQL ngay; chỉ BQL/người hạ; mức cuối = max(luật, AI, mức đang có); AI không xoá tín hiệu luật | Người dùng | — |
| Q03 | ≤ 2026-10-05 12:15:13 +0700 | **Agent TỰ TÁCH** phản ánh hai việc (không cần BPTN xác nhận) | Người dùng chốt (nhắn qua điều phối, trước khi tạo thư mục hồ sơ lúc 12:15:13) | Tắt `agent_policy.auto_split_mixed_reports` · rẻ |
| Q04 | ≤ 2026-10-05 12:15:13 +0700 | Quy tắc chọn khi tách: gốc giữ VE_SINH, con nhận KY_THUAT (`SPLIT_PAIR`); hai ticket chạy pipeline độc lập; hoàn tác bằng `undo_split`/`cancel` | Điều phối chuyển yêu cầu người dùng; architect cố định thứ tự | Đổi `SPLIT_PAIR` · rẻ |
| Q05 | 2026-10-05 20:02:09 +0700 | Engine giữ: kiểm hợp lệ (danh mục, trích dẫn, `TRANSITIONS`, quyền, khoá BPTN/`HUMAN_OVERRIDE`/`not_duplicate_of`), giao dịch/khoá/audit, kho, ca, SLA, chủ blocker; mọi quyết định AI ghi audit + `ai_logger` | Người dùng | — |
| Q06 | 2026-10-05 20:02:09 +0700 | AI lỗi/timeout/JSON hoặc schema sai ⇒ luật hiện có (`FALLBACK_RULE`) + cờ `AGENT_FALLBACK`; bất đồng NGHIÊM TRỌNG với luật ⇒ ghi chú + `PENDING_REVIEW` (bảng đóng SPEC-P01 §6) | Người dùng; architect cụ thể hoá bảng G-1…G-9 | Sửa bảng · trung bình |
| Q07 | 2026-10-05 20:02:09 +0700 | LLM gọi NGOÀI `engine.lock` ở mọi đường (receive, cư dân bổ sung, BPTN gỡ, xác nhận an toàn, ticket tiếp theo, job mồ côi): tính trước theo nội dung SẼ CÓ, áp trong giao dịch, vân tay lệch ⇒ tính lại 1 lần rồi luật | Người dùng; mẫu `_early_proposal` plan 04 Q06 | — |
| Q08 | 2026-10-05 20:02:09 +0700 | Nhà cung cấp DeepSeek qua `OPENAI_BASE_URL`/`OPENAI_API_KEY`/`MODEL_NAME`, `LLM_MODE=openai`; JSON mode (`response_format=json_object`) + Pydantic, không function calling; client giả tất định cho test | Người dùng; architect chọn JSON mode (SPEC-P01 §4.2) | `MO_AGENT_JSON_MODE=prompt_only` · rẻ |
| Q10 | 2026-10-05 20:02:09 +0700 | Giữ phạm vi P1 cũ, thiết kế lại theo AI quyết: CR §8 đầy đủ + PRI-U1; tách; tín hiệu P1 (AI hiểu nghĩa, luật P1 làm sàn); T15/T16/T17/E02; ticket cạnh khẩn cấp; follow-up. Route/UI chỉ bàn giao | Người dùng | — |
| Q11 | 2026-10-05 20:36:03 +0700 | Thêm tín hiệu `S-00` (Bậc 1, chỉ Agent ghi, bắt buộc trích dẫn) cho nguy hiểm ngoài S-01…S-14 | Architect, theo Q02 "AI được nâng mức" (D-12) | Bỏ mục lexicon · rẻ |
| Q12 | 2026-10-05 20:36:03 +0700 | Bộ eval lấy từ scratchpad (`agent_audit/` audit_a/c/d, p3, p6; `redteam_lex.py`) chuyển vào repo (WP0, đổi tòa SIM-A/B/C → S1/S2/S2); **audit_a + audit_d là HELD-OUT** — không dùng khi chỉnh prompt | Điều phối giao; architect định held-out | Đổi tập held-out · rẻ |
| Q13 | 2026-10-05 20:36:03 +0700 | Tương thích JSONB: revision Alembic đánh dấu `0002_p1_doc_shape` (không DDL) để code cũ TỪ CHỐI KHỞI ĐỘNG; rollback chính = tắt cờ (R1); quay code về trước P1 trên DB chung là phá huỷ, cần người duyệt | Thẩm định backend A2; architect (OPERATIONS §5–§6) | — |
| Q14 | 2026-10-05 20:36:03 +0700 | Engine tách điều phối P1 ra mixin `src/maintenance/coordination/` để Wave 4 chạy song song không sửa chéo `engine.py`; lỗi/hằng chung chuyển sang `errors.py`/`common.py` (re-export giữ đường import cũ) | Architect | Gộp lại · trung bình |
| Q15 | 2026-10-05 20:36:03 +0700 | `seed`/`reset`/`evaluate`/demo luôn chế độ luật (0 lần gọi mô hình) — fixture tất định | Architect (I-24) | — |
| Q16 | 2026-10-05 20:36:03 +0700 | Mức an toàn chỉ người hạ: bước 2b lấy `max(kết quả, risk_level đang có)` cho MỌI đường (kể cả không Agent) | Q02 + CR §17.1 "agent/job không hạ" (I-17) | — |

### Quyết định CHỜ NGƯỜI DÙNG (mặc định đang dùng trong SPEC)
| # | Câu hỏi | Mặc định | Đổi thì sao |
|---|---|---|---|
| Q18 | Ticket thường cùng vị trí với khẩn cấp đang mở: GIỮ (không giao phòng ban) đến khi BQL xử lý? (bổ sung, không có trong CR) | `agent_policy.hold_near_open_emergency: false` — chỉ liên kết hai chiều | bật cờ ⇒ ticket vào `ON_HOLD/WAITING_EMERGENCY` (chủ SYSTEM, BQL xử lý khẩn cấp thì nhả); Trường sửa `expected` TEC-006 (SPEC-P07 §4.3) |
| Q19 | `priority.duplicate_raise_at_count` (PRI-U1, CR D-03) | 3 | sửa số trong `catalog.yaml` |
| Q09 | Dùng LangGraph cho Agent? | ĐỀ XUẤT CÓ — đồ thị tối giản `src/maintenance/agent/graph.py`, một lượt gọi mô hình (lý do SPEC-P01 §8) | KHÔNG ⇒ bỏ `graph.py`, gọi tuần tự các hàm nút (không đổi hợp đồng khác) |
| Q11 (xác nhận) | Xác nhận thêm `S-00` (mở rộng bảng CR §6.2) | có | bỏ ⇒ Agent chỉ nâng mức bằng S-01…S-14 |
| Q17 | Cấp khoá DeepSeek + ngân sách token cho eval thật (G-LIVE) | chưa có ⇒ G-LIVE ⬜ | — |

### Quyết định bị thay thế
| Mốc | Quyết định cũ | Thay bằng |
|---|---|---|
| 2026-10-05 (giao việc lần 1) | P1-B mặc định "BPTN xác nhận tách" | Q03 Agent tự tách |
| 2026-10-05 12:15:13 | Hồ sơ `planning/06_2026-10-05_p1-coordination/` trên `feature/nhuy-p1-coordination` (base `db8bf0b`), Agent = luật + LLM đề xuất có guard | Q01 Agent quyết; thư mục đổi tên `06_2026-10-05_reasoning-agent` (chưa commit nên không vi phạm Path Invariant), nhánh `feature/nhuy-reasoning-agent` từ `develop` `82f01f0` (có PR #17 và thí điểm Ocean Park) |
| CR §6.1 / plan 01 Q09 | LLM chỉ đề xuất/nâng mức an toàn, luật quyết phân loại | Q01 (an toàn vẫn chỉ nâng — Q02) |
| plan 05 Q05/Q09 | Bỏ hỏi vị trí cho phản ánh ngoài phạm vi theo luật `mentions_playbook_subject` | Agent quyết `next_step`; luật cũ thành dự phòng + nền Mirror (SPEC-P02 §6.2) |

## §3. Work Packages (tầng theo AGENTS §3.3 / K.3 — không ghi tên mô hình)
| WP | Việc | Tầng | Wave | Phụ thuộc | SPEC |
|---|---|---|---|---|---|
| WP0 | Đo nền, đóng băng `case_pre_p1.json`, chuyển bộ eval từ scratchpad (đổi tòa) | 🟢 | 0 | — | OPERATIONS §3 |
| WP1 | Hợp đồng: enum, model, catalog/policy, `TRANSITIONS`, view, i18n | 🟠 | 1 | WP0 | 01-CONTRACTS |
| WP2 | Lưới sàn luật an toàn P1 + `S-00` | 🔴 | 1 | (S-00 sau WP1) | SPEC-P03 |
| WP3 | Gói `src/maintenance/agent/` (schema, prompt, client JSON, LangGraph, kiểm, hợp nhất, dự phòng) + bằng chứng luật | 🟠 | 1 | WP1 | SPEC-P01, SPEC-P05 §2 |
| WP4 | Cấu hình Agent + revision JSONB + test store | 🟠 | 1 | — | 01 §4.1, §12; OPERATIONS §4–§6 |
| WP5 | Hạ tầng engine: giao dịch nhiều ticket, mixin, hook | 🟠 | 2 | WP1 | SPEC-P02 §2–§3 |
| WP6 | Tích hợp Agent: tính ngoài khoá, áp từng bước, entry point, job | 🟠 | 3 | WP3, WP4, WP5 | SPEC-P02 §4–§6 |
| WP7 | Trùng/gộp + PRI-U1 | 🟠 | 4 | WP6 | SPEC-P04 |
| WP8 | Tách hai việc | 🟠 | 4 | WP6 | SPEC-P05 |
| WP9 | Phòng ban T15/T16/T17/E02 | 🟠 | 4 | WP6 | SPEC-P06 |
| WP10 | Khẩn cấp lân cận + ticket tiếp theo | 🟠 | 4 | WP6 | SPEC-P07 |
| WP11 | Eval harness + eval DeepSeek thật + chỉnh prompt | 🔴 | 4–5 | WP6, khoá (Q17) | SPEC-P01 §4.4, TESTING §6 |
| WP12 | Thẩm định đối kháng cô lập (agent khác, không thừa kế ngữ cảnh) | 🔴 | 5 | WP7–WP11 | TESTING §8 |
| WP13 | Đồng bộ docs/não (Ma Trận 6 Điểm + `project-intro`, `-data-architecture` vì thêm LangGraph trên đường chạy) + version | 🟢 | 6 | WP12 ✅ | OPERATIONS §2 |
Song song: Wave 1 = WP2 ∥ WP3 ∥ WP4 (WP1 trước WP3); Wave 4 = WP7 ∥ WP8 ∥ WP9 ∥ WP10 ∥ WP11 — mỗi WP một file mixin/test riêng (OPERATIONS §2).

## §4. Checklist thực thi
- [x] SPEC package (00, 01, P01–P07, OPERATIONS, TESTING, 3 REF chạy được) — 2026-10-05 20:36:03 +0700
- [x] Người dùng duyệt SPEC 2026-10-05 21:02:30 +0700: Q09 LangGraph CÓ · Q11 S-00 CÓ · Q18 KHÔNG giữ (chỉ liên kết) · Q19 = 3 · Q17 khoá đã ghi `.env` (thiếu base URL/model ⇒ G-LIVE chờ)
- [ ] WP0 · [ ] WP1 · [ ] WP2 · [ ] WP3 · [ ] WP4
- [ ] WP5 · [ ] WP6
- [ ] WP7 · [ ] WP8 · [ ] WP9 · [ ] WP10 · [ ] WP11
- [ ] WP12 thẩm định ✅
- [ ] Exit Gates local ✅ (TESTING §7) · [ ] `--pg` ✅ · [ ] live ✅ · [ ] server ✅
- [ ] WP13 đồng bộ não + `changelog.md` + version · [ ] Sign-off `✅ ĐÃ HOÀN THÀNH` + mốc giây

## §5. Bảng trỏ SPEC
| File | Nội dung |
|---|---|
| [`specs/00-ARCHITECTURE.md`](specs/00-ARCHITECTURE.md) | Mục tiêu, non-goals, bất biến I-16…I-30, ranh giới, luồng, vùng cấm, lỗi chung, drift D-01…D-16 |
| [`specs/01-CONTRACTS.md`](specs/01-CONTRACTS.md) | Enum, model, schema `AgentDecision`/`DecisionInput`/`AgentDecisionRecord`, cấu hình, `TRANSITIONS` (23+7), method, view, i18n, JSONB, bàn giao API/UI |
| [`specs/SPEC-P01-reasoning-agent.md`](specs/SPEC-P01-reasoning-agent.md) | Gói Agent: luồng nút, nền luật, kiểm hợp lệ, an toàn chỉ nâng, prompt/client DeepSeek, dự phòng, bảng bất đồng, LangGraph |
| [`specs/SPEC-P02-engine-integration.md`](specs/SPEC-P02-engine-integration.md) | Giao dịch nhiều ticket, mixin/hook, vân tay, tính ngoài khoá, áp từng bước, entry point |
| [`specs/SPEC-P03-safety-floor-p1.md`](specs/SPEC-P03-safety-floor-p1.md) | Lưới sàn luật P1 + S-00, chính sách từ hai nghĩa, cổng C1–C8 |
| [`specs/SPEC-P04-duplicate-merge.md`](specs/SPEC-P04-duplicate-merge.md) | Trùng/gộp CR §8, PRI-U1, hoàn tác, hủy gốc, đánh giá MERGED |
| [`specs/SPEC-P05-split-two-jobs.md`](specs/SPEC-P05-split-two-jobs.md) | Tự tách hai việc, bằng chứng luật, hoàn tác |
| [`specs/SPEC-P06-department.md`](specs/SPEC-P06-department.md) | T15 đếm, T16, T17, E02, snapshot |
| [`specs/SPEC-P07-neighbors-follow-up.md`](specs/SPEC-P07-neighbors-follow-up.md) | Khẩn cấp lân cận (chờ duyệt), ticket tiếp theo |
| [`specs/OPERATIONS.md`](specs/OPERATIONS.md) | Môi trường, wave/ranh giới file, DeepSeek, triển khai JSONB, rollback |
| [`specs/TESTING-ACCEPTANCE.md`](specs/TESTING-ACCEPTANCE.md) | Client giả, ma trận test, câu thật, test phải đỏ, eval thật, Exit Gates |
| `specs/REF-agent-contract.py`, `REF-split-verdict.py`, `REF-p1-safety-meter.py` | Máy đo/tham chiếu chạy được (lệnh ở OPERATIONS §1) |

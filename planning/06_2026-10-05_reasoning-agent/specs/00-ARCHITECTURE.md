# 00 — ARCHITECTURE: Agent suy luận làm trung tâm điều phối + phạm vi P1 (trùng/gộp, tách hai việc, an toàn P1, phòng ban, khẩn cấp lân cận, ticket tiếp theo)

| Trường | Giá trị |
|---|---|
| Hồ sơ | `planning/06_2026-10-05_reasoning-agent/` — quyết định ĐÃ CHỐT ở `plan.md` §2; file này không bàn lại |
| Spec nghiệp vụ | [`docs/CR-BPTN-03.md`](../../../docs/CR-BPTN-03.md) — chỉ TRỎ số mục (§2, §4, §5, §6, §7, §8, §9.2–9.3, §11, §12, §13, §15, §16) |
| Tài liệu module | [`docs/maintenance.md`](../../../docs/maintenance.md) §2–§6, §12, §13 |
| Base đo | `82f01f002d729c276ecd0b8bf5ad78fa377c79e9` (`origin/develop`, nhánh `feature/nhuy-reasoning-agent`, không upstream) — đo `2026-10-05 20:02:09 +0700`: `pytest -q` **2971 passed, 29 deselected**, ruff check + format sạch (76 file) |
| Viết | architect; mốc lấy bằng `date "+%Y-%m-%d %H:%M:%S %z"` |

## 0. Router — thứ tự đọc bắt buộc

| Bước | File | Ai đọc | Mục đích |
|---|---|---|---|
| 1 | `00-ARCHITECTURE.md` | mọi worker | mục tiêu, non-goals, bất biến, ranh giới, lỗi chung, drift |
| 2 | [`01-CONTRACTS.md`](01-CONTRACTS.md) | mọi worker | enum, model, cấu hình, schema quyết định Agent, `TRANSITIONS`, method, view, JSONB, bàn giao API/UI |
| 3 | [`SPEC-P01-reasoning-agent.md`](SPEC-P01-reasoning-agent.md) + [`REF-agent-contract.py`](REF-agent-contract.py) | WP3, WP11 | gói `src/maintenance/agent/`: prompt, client JSON, LangGraph, kiểm hợp lệ, hợp nhất với luật, dự phòng |
| 4 | [`SPEC-P02-engine-integration.md`](SPEC-P02-engine-integration.md) | WP5, WP6 | engine gọi Agent NGOÀI khoá, áp quyết định từng bước, giao dịch nhiều ticket, mixin |
| 5 | [`SPEC-P03-safety-floor-p1.md`](SPEC-P03-safety-floor-p1.md) + [`REF-p1-safety-meter.py`](REF-p1-safety-meter.py) | WP2 | lưới sàn luật P1 (S-06…S-08, S-10…S-13) + S-00 |
| 6 | [`SPEC-P04-duplicate-merge.md`](SPEC-P04-duplicate-merge.md) | WP7 | trùng/gộp CR §8, PRI-U1 |
| 7 | [`SPEC-P05-split-two-jobs.md`](SPEC-P05-split-two-jobs.md) + [`REF-split-verdict.py`](REF-split-verdict.py) | WP3 (bằng chứng luật), WP8 | Agent tự tách phản ánh hai việc |
| 8 | [`SPEC-P06-department.md`](SPEC-P06-department.md) | WP9 | T15 đếm, T16, T17, E02 |
| 9 | [`SPEC-P07-neighbors-follow-up.md`](SPEC-P07-neighbors-follow-up.md) | WP10 | khẩn cấp lân cận (chờ duyệt), ticket tiếp theo |
| 10 | [`OPERATIONS.md`](OPERATIONS.md) | mọi worker + SO | môi trường, wave, ranh giới file, DeepSeek, JSONB, deploy, rollback |
| 11 | [`TESTING-ACCEPTANCE.md`](TESTING-ACCEPTANCE.md) | mọi worker + thẩm định | ma trận test, client giả, eval thật, Exit Gates |

Quy ước: mọi file SPEC có mục **BẮT BUỘC**, **CẤM**, **Vùng cấm**, **Phân loại lỗi**, **Nghiệm thu** (grep được).

## 1. Mục tiêu

Một câu: **Agent là trung tâm điều phối** — mỗi phản ánh được một mô hình ngôn ngữ (DeepSeek, OpenAI-compatible) suy luận TỪNG BƯỚC (dữ kiện → đối chiếu playbook/spec → quyết định) và quyết định: mức nguy hiểm (chỉ được NÂNG), loại việc (kể cả TỰ TÁCH hai việc), vị trí, hỏi cư dân hay chuyển BPTN, trùng ticket nào (trong danh sách engine lọc), phòng ban, ưu tiên, tài sản (trong ứng viên), vật tư (trong danh mục), cần người duyệt hay không — mỗi quyết định có lý do + trích dẫn nguyên văn; **engine** giữ quyền kiểm hợp lệ, giao dịch, khoá, audit, kho, ca, SLA, chủ blocker; luật cố định hiện có là **lưới sàn an toàn** và **phương án dự phòng**.

| # | Mảng | Nguồn | File đích chính | SPEC |
|---|---|---|---|---|
| A0 | Agent suy luận: schema, prompt tiếng Việt, client JSON mode, LangGraph, kiểm hợp lệ, hợp nhất luật, dự phòng, ai_logger | người dùng 2026-10-05 (Q01–Q08) | `src/maintenance/agent/` (mới), `rules.py` (bằng chứng) | P01 |
| A1 | Engine gọi Agent ngoài `engine.lock`, áp quyết định ở bước 2b–8, giao dịch nhiều ticket, mixin điều phối | Q05, Q07, Q14 | `engine.py`, `errors.py` (mới), `common.py` (mới), `coordination/` (mới) | P02 |
| P1-A | Trùng/gộp đủ CR §8 + PRI-U1 (Agent chọn ticket trùng trong ứng viên) | CR §7, §8, §11 | `coordination/merge.py`, `priority.py` | P04 |
| P1-B | Agent tự tách phản ánh hai việc; luật làm bằng chứng + dự phòng | Q03 (người dùng chốt) | `coordination/split.py`, `rules.py` | P05 |
| P1-C | Lưới sàn luật P1 + S-00 (Agent nâng mức cho nguy hiểm ngoài bảng) | CR §6.2, §15; Q02 | `seed/maintenance_v1/lexicon.yaml` | P03 |
| P1-D | T15 đếm + leo thang lần 2, T16, T17, E02 | CR §4.1, §4.2, §9.2, §9.3 | `coordination/department.py` | P06 |
| P1-E | Ticket thường cạnh khẩn cấp: liên kết hai chiều + giữ (cờ, CHỜ DUYỆT Q18) | bổ sung | `coordination/neighbors.py` | P07 |
| P1-F | Ticket sửa chữa tiếp theo (`follow_up_of`) | CR §6.5, AC-09 | `coordination/neighbors.py` | P07 |
| — | JSONB Postgres: revision đánh dấu `0002_p1_doc_shape`, cấu hình DeepSeek | thẩm định backend A2 | `store/`, `config.py`, `.env.example` | 01 §12, OPS §5 |

## 2. Non-goals (CẤM làm trong hồ sơ này)

- Router/API (`src/api/**`), giao diện (`src/web/**`): chỉ giao **method engine + danh sách route/UI** (01 §13) cho Châm Anh (API) và Trí (UI).
- Agent dùng công cụ (tool calling nhiều vòng), bộ nhớ hội thoại, RAG, phân tích ảnh: KHÔNG — một lượt gọi có cấu trúc cho mỗi lần quyết định (lý do ở P01 §8).
- Agent tự đóng/hủy/gộp ticket, tự gỡ blocker an toàn, tự hạ mức nguy hiểm, ghi `assignee_id`, nói chuyện với cư dân (CR §2 dòng Agent).
- Gọi LLM thật trong CI/test (`LLM_MODE=mock`); mọi test Agent dùng client giả (TESTING §2).
- Thay `src/agents/` (mẫu template) — đồ thị thật nằm ở `src/maintenance/agent/graph.py`.
- C-01, B-05, PRI-U2/`risk_amplifiers`, T18/T19, BQL làm việc của BPTN khi leo thang, danh sách "lần BPTN xác nhận an toàn" (CR §13): ngoài phạm vi người dùng giao.
- Bump `SCHEMA_VERSION` (`"1.2"`), version app `src/main.py`.

## 3. BẮT BUỘC — Bất biến kiến trúc

Kế thừa I-01…I-15 của `planning/01_2026-10-01_cr03-p0-engine/specs/00-ARCHITECTURE.md` §3 (không chép). Thêm:

| ID | Bất biến | Kiểm bằng (TESTING) |
|---|---|---|
| I-16 | **Không gọi LLM khi đang giữ `engine.lock`** hoặc trong `repo.transaction()`. Mọi quyết định Agent được tính TRƯỚC (`_prepare`) rồi áp trong giao dịch; trong giao dịch chỉ đọc quyết định đã có | A-20 (client giả kiểm `engine.lock._is_owned()` khi được gọi), A-21 |
| I-17 | Mức nguy hiểm cuối = max(luật, Agent, mức đang có của ticket). **Chỉ người** (T05/T03 xác nhận an toàn, `emergency_downgrade`) hạ `risk_level`; pipeline, Agent, job không bao giờ hạ | A-05, A-06, A-07 |
| I-18 | Agent không xoá được tín hiệu luật đã bắt; trích dẫn của Agent phải nằm trong văn bản (chuẩn hoá bỏ dấu), không nằm ⇒ bằng chứng bị hạ/loại theo P01 §3 | A-04, A-08 |
| I-19 | Quyết định của người không bị Agent đè: `locked_fields` (BPTN), `priority_source=HUMAN_OVERRIDE`, `not_duplicate_of`, `safety_cleared_*` | A-12, A-13 |
| I-20 | Mọi giá trị Agent trả về được engine kiểm theo danh mục (tòa ∈ `site.buildings`, khu vực ∈ nhãn `rules.AREA_PATTERNS`, phòng ban = bảng playbook, asset ∈ ứng viên + đúng vị trí, vật tư ∈ `playbook_materials`, ticket trùng ∈ ứng viên + cùng loại + cùng vị trí); giá trị sai ⇒ dùng luật cho đúng trường đó, ghi `rejected` | A-09…A-11 |
| I-21 | Agent lỗi/timeout/JSON sai/schema sai ⇒ toàn bộ quyết định theo luật hiện có (`FALLBACK_RULE`) + cờ `AGENT_FALLBACK` + `ai_logger` status khác `SUCCESS`; không bao giờ làm hỏng `receive` | A-14…A-17 |
| I-22 | Bất đồng NGHIÊM TRỌNG giữa Agent và luật (bảng P01 §6) ⇒ ticket dừng `VERIFYING/PENDING_REVIEW` (chủ BPTN) có ghi chú liệt kê bất đồng + cờ `AGENT_DISAGREEMENT`; bất đồng NHẸ ⇒ chỉ ghi chú audit | A-18, A-19 |
| I-23 | Mỗi quyết định áp vào ticket ghi đúng một audit `AGENT_DECISION` (lý do, trích dẫn, bất đồng, nguồn, model, độ trễ, `ai_log_id`) và một dòng `ai_logger` khi có gọi mô hình | A-02, A-03 |
| I-24 | `seed()`/`reset()`/`evaluate`/demo luôn chạy chế độ luật (không gọi LLM) — kết quả fixture tất định | A-22 |
| I-25 | Mọi ghi lên ticket THỨ HAI đi qua `_related_case`/`_insert_case` trong `op` của `_mutate`; tất cả commit trong MỘT `repo.transaction()` (P02 §2) | C-06, M-08, S-11, F-03 |
| I-26 | Ticket kết thúc (`CLOSED`, `CANCELLED`, `MERGED`) không bị thao tác của ticket khác ghi, trừ khi chính nó là chủ thể một dòng `TRANSITIONS` (T09 SYSTEM khi gốc bị hủy) | M-04, C-09 |
| I-27 | Liên kết hai chiều: `merged_into`↔`merged_children`, `split_from`↔`split_children`, `related_ticket_ids` hai phía; danh sách liên kết chỉ nối thêm | M-03, S-01, E-01 |
| I-28 | Nội dung gộp sang gốc (`merged_from`) KHÔNG đi vào văn bản Agent/luật đọc của gốc và không hiện cho cư dân của gốc | M-03, C-11 |
| I-29 | Hành vi mới đổi quyết định giao việc nằm sau cấu hình DỮ LIỆU: `catalog.agent_policy.*`, `lexicon.safety.active_phases`, `MO_AGENT_ENABLED` — tắt được không sửa code | A-23, S-06, E-03 |
| I-30 | Doc JSONB do code P1 ghi chỉ code P1 đọc được; DB đánh dấu revision `0002_p1_doc_shape` để code cũ TỪ CHỐI KHỞI ĐỘNG thay vì sập giữa chừng | WP4 test revision |

## 4. Ranh giới

### 4.1 Agent ↔ engine (P01 ↔ P02)
- Engine dựng `DecisionInput` (văn bản, vị trí, phạm vi an toàn, khoá BPTN, ứng viên trùng/tài sản, dấu vân tay) NGOÀI khoá; gọi `ReasoningAgent.decide(input) -> AgentDecisionRecord` (hàm thuần trừ lời gọi mô hình + `ai_logger`); áp record trong giao dịch.
- Agent không đọc repo, không biết giao dịch; engine không phân tích văn bản tự do của mô hình (chỉ đọc record đã kiểm).

### 4.2 Engine ↔ router/UI
- Chỉ method công khai (01 §6) + trường view (01 §8). Router hiện tại không gọi method mới ⇒ không có đường gọi tới stub khi thi công; PR chỉ mở khi 0 stub (TESTING G-STUB).

### 4.3 Engine ↔ persistence
- `Case` JSONB `maintops.cases.doc`; model `extra="forbid"` ⇒ trường/enum mới làm code cũ ném `ValidationError` (đo: 01 §12.1). Một giao dịch khoá nhiều dòng và chèn dòng mới được (`_PgTx.versions` là dict; `_MemoryTx` tương tự — đọc `store/postgres.py:170-250`, `store/memory.py:28-89`).

### 4.4 Engine ↔ rules/safety/lexicon
- Luật cố định giữ nguyên vai trò: lưới sàn an toàn (2b), phương án dự phòng (khi Agent không dùng được), bằng chứng đối chiếu bất đồng. `rules.py` chỉ THÊM hàm bằng chứng (P05 §2); `safety.py` không đổi.

## 5. Luồng tổng sau hồ sơ

```text
[NGOÀI khoá] receive: cấp số → dựng DecisionInput (ứng viên từ dữ liệu đã commit) → Agent.decide:
     luật (an toàn trên phạm vi, phân loại, bằng chứng, vị trí) ─┬─ luật EMERGENCY ⇒ bỏ gọi mô hình (SKIPPED)
                                                                 └─ gọi mô hình JSON → parse → kiểm danh mục/trích dẫn → hợp nhất (max an toàn, bất đồng) → record
[TRONG khoá + giao dịch] ingest (T01) → _run_pipeline(2) đọc record (vân tay khớp):
  2b  an toàn = max(luật, Agent, mức đang có) — EMERGENCY ⇒ BQL (liên kết lân cận) | UNCLEAR ⇒ BPTN
  2   vị trí: khoá BPTN > Agent (đã kiểm) > luật; thiếu ⇒ hỏi cư dân (MISSING_INFO, chủ BPTN) hoặc Agent nói ngoài phạm vi ⇒ BPTN (plan 05 Q05/Q09)
  3   loại việc: khoá BPTN / ghim tách > Agent (0/1/2 việc; 2 ⇒ TÁCH, chèn ticket con cùng giao dịch) > luật; ưu tiên Agent (+PRI-U1)
  4   trùng: Agent chọn trong ứng viên (kiểm lại cùng loại/vị trí/còn mở) > luật
  5   người duyệt: Agent needs_review hoặc bất đồng NGHIÊM TRỌNG ⇒ PENDING_REVIEW
  6   tài sản: khoá > Agent (đúng vị trí, duy nhất) > luật   7  vật tư: kế hoạch riêng > Agent (danh mục) > mặc định; kho = engine
  8   phòng ban = bảng playbook (Agent phải khớp) ; ca làm, can_route, (giữ cạnh khẩn cấp nếu cờ bật) → ROUTED
Đường khác: cư dân bổ sung / BPTN gỡ / xác nhận an toàn / ticket tiếp theo ⇒ tính trước quyết định cho NỘI DUNG SẼ CÓ (ngoài khoá), áp trong khoá; vân tay lệch (có người sửa xen giữa) ⇒ tính lại 1 lần rồi mới dùng luật.
resume / job / kho nhập / hoàn tác gộp / hủy gốc / ticket con: KHÔNG gọi mô hình — dùng record đã lưu nếu vân tay khớp, không thì luật.
```

## 6. Vùng cấm (đã cân nhắc, KHÔNG làm)

| # | Không làm | Lý do |
|---|---|---|
| V-01 | Không để Agent hạ mức an toàn, kể cả khi luật báo nhầm rõ ràng | người dùng chốt (Q02); báo nhầm do BPTN/BQL hạ, có lý do + audit |
| V-02 | Không gọi LLM trong khoá/giao dịch, kể cả "chỉ một lần cho nhanh" | khoá giữ mọi request ghi (RLock) và kết nối DB; 5–25 s chặn cả hệ thống (I-16) |
| V-03 | Không cho mô hình tự tạo id ticket/asset/vật tư/tòa mới | chỉ chọn trong danh sách engine đưa; bịa ⇒ bị loại (I-20) |
| V-04 | Không dùng tool calling / nhiều vòng gọi | độ trễ ×3–4, khó tất định, khó kiểm; ứng viên được đưa sẵn trong một lượt |
| V-05 | Không thay luật bằng mô hình cho lưới sàn an toàn | 0 bỏ sót Bậc 1 phải giữ cả khi mô hình lỗi (CR §15) |
| V-06 | Không cho job/resume gọi LLM (trừ ticket mồ côi) | job chạy định kỳ giữ khoá; chi phí và độ trễ không kiểm soát |
| V-07 | Không thêm trạng thái mới (`SPLIT`, `HELD`, `AI_REVIEW`) | 10 trạng thái CR §3.1; dùng blocker sẵn có (`PENDING_REVIEW`, `ON_HOLD`) |
| V-08 | Không đổi tên `Case.not_duplicate_of` thành `duplicate_rejected_of` | doc JSONB đã lưu tên cũ (D-03) |
| V-09 | Không thêm `Notification.type` mới | dùng `ticket.status_changed` (payload thêm khoá), `escalation` |
| V-10 | Không dùng `extra="allow"/"ignore"` để code cũ "chịu" doc mới | đọc lỏng rồi lưu lại sẽ ÂM THẦM xoá trường mới (mất dữ liệu); chọn từ chối khởi động (I-30) |
| V-11 | Không tin `risk_level` tự khai của mô hình | mức Agent = suy từ tín hiệu có trích dẫn hợp lệ (P01 §3.3) |
| V-12 | Không chuyển mọi bất đồng thành duyệt tay | tràn hộp BPTN; chỉ bảng NGHIÊM TRỌNG (P01 §6) |
| V-13 | Không sửa `safety.py` để vá câu P1 | từ vựng là dữ liệu; thiếu cơ chế ⇒ dừng hỏi 🔴 (P03 §4) |

## 7. Phân loại lỗi chung + hành vi bắt buộc của caller

| Lớp | `code` | HTTP (`_call`) | Khi nào (mới ở hồ sơ này) | Ghi gì | Caller phải |
|---|---|---|---|---|---|
| `NotFoundError` | `NOT_FOUND` | 404 | ticket / `into` không có | không | kiểm id, không thử lại |
| `ActionDeniedError` | `ACTION_DENIED` | 403 | sai vai, ngoài phạm vi, BPTN chạm blocker BQL, BPTN hoàn tác gộp khẩn cấp | audit `ACTION_DENIED` (giao dịch riêng) | báo "không có quyền" |
| `InvalidTransitionError` | `INVALID_TRANSITION` | 409 | trạng thái/blocker không khớp | không | tải lại ticket |
| `GuardError` | `GUARD_FAILED` | 409 | thiếu `note`, gốc đã kết thúc, gộp dây chuyền, `decision` lạ | không | sửa đầu vào |
| `ConcurrencyError` | `CONCURRENT_UPDATE` | 409 | hai backend ghi chéo (khoá chéo `40P01`) | không (rollback) | tải lại, thử lại một lần |
| `StoreUnavailableError` | `STORE_UNAVAILABLE` | 503 | DB đứt giữa giao dịch | không chắc ⇒ coi như chưa | tải lại trước khi bấm lại |
| `AuditWriteError` | `AUDIT_WRITE_FAILED` | 500 | sink audit/notify hỏng | không commit gì | thử lại sau |
| `EngineError` | `ENGINE_ERROR` | 500 | `_related_case` ngoài `op`; marker lệch; stub chưa lấp | log | báo người |
| Lỗi mô hình (timeout, HTTP, JSON, schema) | — | KHÔNG lộ ra API | Agent không dùng được | `AgentDecisionRecord.source=FALLBACK_RULE`, cờ `AGENT_FALLBACK`, `ai_logger` | không làm gì: luật đã quyết; staff thấy cờ |

Số mới cấp bằng `repo.next_ticket_number()` KHÔNG hoàn lại khi giao dịch hỏng ⇒ có khoảng trống số, không bao giờ trùng (chấp nhận).

## 8. Drift CR ↔ thiết kế (ghi, không âm thầm chọn)

| ID | CR nói | Thiết kế hồ sơ 06 | Lý do |
|---|---|---|---|
| D-01 | §5.1 các bước do luật/Agent đề xuất; §6.1 "LLM chỉ được nâng mức" | Agent (LLM) QUYẾT mọi mục nêu ở §1, luật là sàn an toàn + dự phòng + bằng chứng; an toàn vẫn chỉ nâng | người dùng chốt 2026-10-05 (Q01, Q02) |
| D-02 | §8 bước 4 "cùng category, cùng vị trí, cửa sổ" (tất định) | Agent chọn trong ứng viên engine lọc; engine kiểm lại cùng loại/vị trí/cửa sổ; Agent bỏ qua = không trùng (ghi chú nếu luật thấy trùng) | Q01 |
| D-03 | §12.1 `duplicate_rejected_of[]` | dùng `Case.not_duplicate_of` | V-08 |
| D-04 | §8 "ghi `duplicate_count` trên gốc" | +1 khi phát hiện/BQL gộp, −1 khi bác/T09/hủy ticket nghi trùng; không ghi gốc đã kết thúc | P04 §2 |
| D-05 | §5.2 hoàn tác gộp ⇒ bước 4 | bước 4 nếu đã phân loại và `risk_level=NONE`, ngược lại bước 2 | ticket khẩn cấp gộp bởi BQL chưa từng phân loại |
| D-06 | §8.2 "nối vào gốc" | bản ghi `merged_from`, Agent/luật của gốc không đọc, cư dân gốc không thấy | I-28 |
| D-07 | §4.1 chỉ T08 `VERIFYING → MERGED` | thêm `ON_HOLD→MERGED`, `ROUTED→MERGED` chỉ cho hoàn tác tách | tách là bổ sung |
| D-08 | — | `ReasonCode.WAITING_EMERGENCY` (ON_HOLD, chủ SYSTEM) | P1-E bổ sung, CHỜ DUYỆT |
| D-09 | §9.3 E02 "giữ checklist…" | chụp `ExecutionSnapshot` rồi đặt checklist `PENDING`, mở vòng bằng chứng mới | phòng ban mới tự làm, dữ liệu cũ giữ |
| D-10 | §4.1 T17 "BQL bác báo cáo" | về `IN_PROGRESS` không blocker | `rework_count`, `evidence_round_start` giữ |
| D-11 | §6.2 S-13 "máu" | "máu" có dấu ⇒ S-13; "mau" không dấu đứng riêng ⇒ không là tín hiệu | P03 §3 |
| D-12 | §6.2 không có mục "nguy hiểm khác" | thêm `S-00` (Bậc 1, chỉ Agent ghi, phải có trích dẫn) | Q02: Agent được nâng mức với nguy hiểm ngoài bảng |
| D-13 | §6.5 follow-up "kế thừa nội dung" | mô tả gốc chép vào `raw`, bổ sung chép thành `additions` (`copied_from`) | `original_description` ≤ 5000 ký tự |
| D-14 | §6.5 BQL gộp ticket khẩn cấp | đích phải là ticket chưa kết thúc có `risk_level=EMERGENCY` | "nhiều ticket khẩn cấp cùng sự cố" |
| D-15 | §7 `priority_source (AGENT_RULE\|HUMAN_OVERRIDE)` | thêm `AGENT_LLM` khi ưu tiên do Agent chọn | truy vết nguồn |
| D-16 | §17.1 D-01 "mỗi lần chỉ bổ sung mới + snapshot cho LLM" | Agent đọc toàn bộ nội dung (gốc + bổ sung không `merged_from`), có giới hạn 5000 ký tự/khối | D-01 contract chưa code; giữ hành vi `_content` hiện có |

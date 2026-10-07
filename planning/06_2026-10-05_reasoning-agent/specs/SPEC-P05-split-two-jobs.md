# SPEC-P05 (P1-B) — Agent TỰ TÁCH phản ánh có HAI việc (vệ sinh + đèn) thành ticket gốc + ticket con

| Trường | Giá trị |
|---|---|
| WP | WP3 (🟠, bằng chứng luật trong `rules.py`, Wave 1) → WP8 (🟠, `coordination/split.py`, Wave 4 sau WP6) |
| Nguồn | **Bổ sung** (CR không có). Người dùng chốt "Agent tự tách" (plan Q03, 2026-10-05); quy tắc chọn gốc/con (Q04) |
| REF đo được | [`REF-split-verdict.py`](REF-split-verdict.py) — chạy từ root trên `82f01f0`: `MUST_SPLIT=32 MUST_NOT_SPLIT=18 FAILURES=0`; `--variants`: 17 câu trộn × 36 biến thể đúng kỳ vọng, `SINGLE_JOB_VARIANTS_SPLIT=0`, `VARIANT_FAILURES=0`; bản hỏng (bỏ luật dấu hiệu nhân quả) ⇒ `FAILURES=11` |
| File được ghi | WP3: `src/maintenance/rules.py` (4 hàm 01 §11), `tests/test_maintenance/test_rule_evidence.py`. WP8: `src/maintenance/coordination/split.py` (thân `_try_split`, `undo_split`, helper `_split_mixed_report`, `_rebind_after_split`), `tests/test_maintenance/test_p1_split.py` (mới), `tests/test_maintenance/test_acceptance.py` (CHỈ câu ví dụ §8) |
| CẤM chạm | `engine.py` (chỗ gọi do WP5 đặt), `agent/**`, `proposer.py`, `lexicon.yaml` |

## 1. Hành vi một câu
Khi Agent quyết phản ánh có HAI việc độc lập (một VE_SINH, một KY_THUAT) ở MỘT vị trí đầy đủ, an toàn cuối NONE ⇒ ở bước 3 ticket cư dân gửi (GỐC) giữ **vệ sinh**, engine tạo **ticket CON** cho **đèn** trong cùng giao dịch; hai ticket chạy pipeline độc lập (an toàn, trùng, tài sản, vật tư, giao). Không đủ điều kiện ⇒ `VERIFYING/CATEGORY_UNCLEAR` cho BPTN như hiện tại. Không có Agent (`LLM_MODE=mock`) ⇒ luật quyết tách bằng `rules.split_verdict` (bảo thủ).

## 2. Bằng chứng luật — `rules.py` (WP3)

### 2.1 Hợp đồng (01 §11)
`category_evidence(description) -> frozenset[ServiceCategory]` = {VE_SINH nếu `cleaning`, KY_THUAT nếu `lighting`} tính ĐÚNG như trong `classify` (`rules.py:218-262`: `cleaning = CLEANING_PATTERNS or (common_area and SOFT_CLEANING_PATTERNS)`; `lighting = lit_subject and NOT_WORKING_PATTERNS and not (PRIVATE_LAMP or OUTSIDE)`), KHÔNG có nhánh electrical-hazard (bằng chứng thô). Tách phần tính hai cờ thành `_matches_both(text) -> tuple[bool, bool]` dùng chung cho `classify`, `category_evidence`, `split_verdict` — `classify` giữ nguyên kết quả mọi câu (kho phân loại 0 vi phạm). `electrical_hazard(description) -> bool` = `_any(ELECTRICAL_HAZARD_PATTERNS, _classification_text(description))`.

### 2.2 `split_verdict(description, buildings) -> SplitVerdict(categories, reason)` — luật áp theo thứ tự, luật đầu chặn thắng
| Mã | Luật | `reason` khi chặn |
|---|---|---|
| R-S1 | `electrical_hazard` | `"electrical-hazard"` |
| R-S2 | không đủ CẢ HAI cờ `_matches_both` | `"not-both"` |
| R-S3 | dấu hiệu nhân quả/nghi ngờ: văn bản có ≥ 1 chữ có dấu ⇒ so trên NFC chữ thường với `CAUSAL_ACCENTED` + `HEDGE_ACCENTED` của REF; văn bản không dấu ⇒ so trên `normalize` đã thay cụm vị trí (`AREA_PATTERNS`, `FLOOR_PATTERN`, `_building_pattern(buildings)`) bằng khoảng trắng, với bản bỏ dấu (`CAUSAL_FOLDED`, `HEDGE_FOLDED`). Khớp nguyên cụm `(?<!\w)…(?!\w)` | `"marker:<cụm>"` |
| R-S4 | có `?` | `"question"` |
| R-S5 | ngoài mệnh đề nơi ở (`_residence_spans`): > 1 nhãn khu vực (bỏ khớp khu vực nằm TRONG khớp tầng, vd "tầng hầm B1"), hoặc > 1 tầng, hoặc > 1 tòa | `"two-places"` |
| — | còn lại | `SplitVerdict(SPLIT_PAIR, "split")` |
Danh sách cụm R-S3 và `location_mentions` CHÉP NGUYÊN VĂN REF. Bảo thủ đã đo, chấp nhận: "Sàn trơn vì nước đọng, đèn lại tối om" không tách; "Dầu mỡ đổ ra sàn…" viết KHÔNG dấu không tách ("do" có thể là "đổ").

## 3. Tách trong engine — `SplitMixin._try_split(self, work: Case, now: datetime) -> bool` (WP8)
Đủ TẤT CẢ (thiếu một ⇒ `False`, bước 3 đi tiếp theo P02 §6.3):
1. `self.catalog.agent_policy.auto_split_mixed_reports`.
2. Hai loại việc: có view (P02 §4.5) ⇒ `len(view.jobs()) == 2` và tập loại = `set(SPLIT_PAIR)`; KHÔNG view ⇒ `self.llm is None` (đường luật thuần, không phải đường LLM cũ) và `work.classification.reason_code == CATEGORY_UNCLEAR` và `rules.split_verdict(self._content(work), buildings).categories == SPLIT_PAIR`.
3. `work.ticket.split_from is None and not work.ticket.split_children`.
4. `work.ticket.risk_level == RiskLevel.NONE and work.ticket.safety_cleared_at is None`.
5. `loc = self.effective_location(work)` khớp `re.fullmatch(r"Tòa [^/]+ / Tầng [^/]+ / [^/]+", loc)`.
Rồi `self._split_mixed_report(work, now)`; `return True` (chỗ gọi WP5 đặt sẽ `_bind_category(work, SPLIT_PAIR[0], "AGENT_SPLIT", now)`).
Ghi chú bất đồng: job của Agent có loại ∉ `record.rule_categories` (G-1, P01 §6) vẫn được tách; ticket mang job đó dừng `PENDING_REVIEW` ở bước 5 (BPTN xác nhận hoặc `undo_split`).

### 3.1 `_split_mixed_report(self, work: Case, now: datetime) -> str` (thứ tự BẮT BUỘC)
1. `number = self.repo.next_ticket_number()`; `child_id = f"SIM-TKT-{number:04d}"`.
2. `raw = RawTicket(ticket_id=child_id, created_at=work.ticket.raw.created_at, original_description=work.ticket.raw.original_description, original_evidence_refs=work.ticket.raw.original_evidence_refs, channel="split")`.
3. `child = self._build_case(raw, None, work.ticket.resident_id, now, public_message=split_created_message(work.ticket.ticket_id), notify_extra={"split_from": work.ticket.ticket_id}, reason=f"Tách từ phản ánh hai việc {work.ticket.ticket_id}")`.
4. `_copy_additions(work, child, now, mode="copy")`; `_copy_resident_photos(work, child, now, mode="copy")`; nếu gốc có `locked_fields.location` ⇒ chép sang con; `child.classification = work.classification.model_copy(deep=True)` nếu có.
5. `_set_ticket(child, split_from=gốc, split_category=SPLIT_PAIR[1])`; `_set_ticket(work, split_children=[*…, child_id], split_category=SPLIT_PAIR[0])`.
6. Audit `SPLIT_TICKET` trên gốc (`field_name="split_children"`, `[]`→`[child_id]`, `reason="Phản ánh có hai việc: giữ vệ sinh ở {gốc}, tách đèn sang {con}"`, `rule_id="PB-COM-R-SPLIT-01"`, actor `AGENT_ID`) và trên con (`field_name="split_from"`, None → gốc, cùng `rule_id`).
7. Có view ⇒ `_rebind_after_split(work, child, record)`: record gốc thay `fingerprint=_content_fingerprint(work)` (đã có ghim) và `valid_job_indexes=[chỉ số job VE_SINH]` — gán `work.agent_decision` + bản đồ kích hoạt, KHÔNG ghi audit thêm; record con = cùng record với `fingerprint=_content_fingerprint(child)`, `valid_job_indexes=[chỉ số job KY_THUAT]`, đưa vào `self._local.prepared[child_id]` (con sẽ `_activate` ⇒ một audit `AGENT_DECISION` trên con).
8. `self._insert_case(child)`; `self._run_pipeline(child, 2, now)` (con: 2b → 2 → 3 ghim KY_THUAT → 4 … 8). `return child_id`. Gốc tiếp bước 3 (ghim VE_SINH) → 4 … 8.
Lỗi bất kỳ ⇒ cả giao dịch hủy: gốc giữ `RECEIVED` như lúc `ingest` commit, không có con; số `child_id` bỏ trống; job mồ côi (`ORPHAN_GRACE`) chạy lại pipeline gốc (P02 §5: gọi mô hình cho ticket mồ côi) và thử tách lại.

### 3.2 Postgres — MỘT giao dịch
Gốc là ticket chính của `_mutate`; con được `tx.insert` SAU khi gốc `save` + ghi log, TRƯỚC audit/notifications của con (khoá ngoại `audit_log.ticket_id → cases`) — P02 §2. `next_ticket_number` dùng kết nối riêng (`postgres.py:391`).

## 4. Tương tác
| Cơ chế | Hành vi |
|---|---|
| Trùng | mỗi ticket tự kiểm ở bước 4 theo loại của nó (Agent chọn theo job; luật theo loại) |
| An toàn | con chạy 2b riêng; nội dung giống gốc ⇒ cùng mức; tách chỉ khi NONE |
| Bổ sung sau tách | `split_category` ghim loại ⇒ không phân loại lại; vân tay đổi ⇒ quyết định mới cho đúng ticket nhận bổ sung (Agent nhận `pinned_category`) |
| Hủy gốc | không ảnh hưởng con; liên kết giữ |
| Cư dân | thấy cả hai ticket; `split_into`/`split_from` (01 §8); lời `split_created_message` |
| WRONG_DEPT | BPTN chọn loại mới ⇒ `locked_fields.category` thắng `split_category` |

## 5. Hoàn tác tách — `undo_split(self, ticket_id: str, actor_id: str, *, note: str) -> Case` (WP8)
```python
def undo_split(self, ticket_id, actor_id, *, note):
    def op(work, now):
        t = work.ticket
        # 409 INVALID: t.split_from is None; t.status ∉ {VERIFYING, ON_HOLD, ROUTED}; t.accepted_at is not None; t.risk_level != NONE
        # 409 GUARD: _blank(note)
        # parent = self._related_case(t.split_from)
        # 409 GUARD: parent.ticket.status in TERMINAL_STATUSES ("Ticket gốc đã kết thúc; BQL hủy ticket con (T23)")
        # self._apply_transition(work, S.MERGED, actor_id, role, now, note=note, merged_into=t.split_from,
        #                        department_id=None, dispatched_at=None)
        # parent: merged_children nối thêm con + audit LINK_TICKETS
        # self._copy_additions(work, parent, now, mode="merge"); self._copy_resident_photos(work, parent, now, mode="merge")
        # audit SPLIT_UNDO trên con: field "merged_into", None → gốc, reason note ; KHÔNG đổi duplicate_count của gốc
    return self._mutate(ticket_id, actor_id, Action.SPLIT_UNDO, op)
```
Dòng `TRANSITIONS`: `(VERIFYING|ON_HOLD|ROUTED, MERGED)` BPTN/BQL (01 §5.1). BPTN trên ticket con có blocker thuộc BQL ⇒ 403 + audit trước mọi kiểm khác. Hủy con: BQL `cancel` (T23). Hoàn tác của hoàn tác: `undo_merge` (T09) — `_unmerge` không giảm `duplicate_count` vì `split_from == merged_into`.

## 6. Công tắc, rollback
`agent_policy.auto_split_mixed_reports: false` ⇒ `_try_split` luôn False. Ticket đã tách giữ nguyên.

## 7. Luật
**BẮT BUỘC:** gốc = `SPLIT_PAIR[0]` (VE_SINH), con = `SPLIT_PAIR[1]` (KY_THUAT), không theo thứ tự câu chữ; gốc + con MỘT giao dịch; con cùng cư dân, cùng mô tả gốc, ảnh cư dân (bản chép), cùng vị trí, liên kết hai chiều; mỗi ticket chạy pipeline riêng kể cả kiểm trùng; `classify` giữ kết quả.
**CẤM:** tách khi thiếu điều kiện §3; tách ticket con hoặc tách lần hai; ghi loại tách vào `locked_fields.category`; gọi mô hình cho ticket con; tách ở bước khác bước 3 hoặc > 2 ticket; tách trên đường LLM cũ (`llm=`).
**Vùng cấm:**
| Không làm | Lý do |
|---|---|
| Không cho BPTN tách bằng tay | người dùng chọn tự tách (Q03) |
| Không tách khi vị trí không chuẩn hoặc nhắc hai nơi | con sẽ nhận sai vị trí |
| Không tách theo luật khi đã có quyết định Agent | Agent quyết (Q01); luật chỉ là bằng chứng G-1 |
| Không bỏ luật "không dấu + do/nên ⇒ không tách" để tăng tỉ lệ tách ở đường luật | tách nhầm tệ hơn không tách |

## 8. Test phải đổi (chỉ câu ví dụ, giữ assert)
`test_acceptance.py::test_03_bptn_category_is_locked_and_never_reclassified` (dòng 101) và `::test_10e_unclear_category_stops_before_reading_other_tickets` (dòng 295): `"Hành lang tầng 3 tòa S1 nhiều rác và bóng đèn hành lang không sáng"` ⇒ `"Hành lang tầng 3 tòa S1 nhiều rác vì bóng đèn hành lang không sáng"` (đo trên `82f01f0`: `classify` ⇒ `CATEGORY_UNCLEAR`, vị trí `Tòa S1 / Tầng 3 / Hành lang`, verdict `marker:vì`).

## 9. Phân loại lỗi + hành vi caller
| Thao tác | Điều kiện | Lỗi | HTTP | Caller |
|---|---|---|---|---|
| tách (pipeline) | lỗi khi tạo con | lỗi gốc lan từ `receive` | 500/409/503 | cư dân gửi lại; job mồ côi chạy lại sau 2 phút |
| `undo_split` | sai vai; BPTN trên blocker BQL | `ActionDeniedError` + audit | 403 | ẩn nút |
| `undo_split` | không phải con / trạng thái khác / đã nhận việc / có rủi ro | `InvalidTransitionError` | 409 | tải lại; đã nhận việc thì BQL hủy |
| `undo_split` | thiếu note / gốc đã kết thúc | `GuardError` | 409 | nhập lý do / BQL hủy con |

## 10. Nghiệm thu
- WP3: `pytest -q tests/test_maintenance/test_rule_evidence.py` ⇒ 32 tách + 18 không tách + 17 câu trộn × 36 biến thể đúng `EXPECTED_VARIANT_SPLITS` + 0 câu một-việc bị tách (`cm.CORPUS` × 18 mẫu × 2 dấu); `test_classify_metamorphic.py` vẫn 0 vi phạm.
- WP8: `pytest -q tests/test_maintenance/test_p1_split.py` S-01…S-12 (TESTING §3.7) — gồm ≥ 30 câu tách thật qua `receive` với `MirrorClient` VÀ đường luật, ≥ 15 câu không tách, ca Agent tách khác luật (G-1), S-11 `memory` + `postgres`.
- Phải ĐỎ trước: WP3 — import `split_verdict` lỗi trên base; WP8 — S-01 đỏ khi `_try_split` còn stub.
- Đột biến WP8: (a) bỏ điều kiện 4 ⇒ S-03 đỏ; (b) bỏ điều kiện 3 ⇒ S-08 đỏ; (c) bỏ `self.llm is None` ở nhánh luật ⇒ S-05 đỏ.

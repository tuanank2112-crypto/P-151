# Roadmap & Active Tasks

File này chứa danh sách các tính năng, mục tiêu sắp tới và tình trạng công việc hiện tại.

## Mục tiêu hiện tại (Active)
- [ ] **MVP online 04/10/2026:** engine CR-03 P0 đã xong (xem Done); còn nối router/UI cho 5 method khẩn cấp + `set_priority` (Châm Anh/Trí — gợi ý ở `planning/01_2026-10-01_cr03-p0-engine/specs/00-ARCHITECTURE.md` §4.1), deploy Render, gpt-4o thật (persistence PostgreSQL/Supabase đã có từ `develop`, hồ sơ lưu trữ 01).
- [ ] **Sau tích hợp:** engine CR-03 P0 ĐÃ VÀO `develop` (PR #7, `6265436`). Còn: CI không chạy vì tổ chức hết hạn mức GitHub Actions (mọi run fail "job was not started") — người quản lý tổ chức xử lý; chạy test `--pg` với DB thật; bump version app khi nhóm phát hành.
- [ ] **Câu hỏi mở hồ sơ 02:** phân công nhân sự — `develop` D-12 (phòng ban ghi `assignee_id`) mâu thuẫn CR-03 P0 (`set_assignee` bị chặn, `assignee_id` chỉ `null`); người quyết.
- [ ] **Báo Trường (plan 04 Q14):** Q22 "bóng đèn bị cháy" đã sửa trong `rules.py` (KY_THUAT) cùng tách vị trí mở rộng — Trường rà lại vì là vùng rules/playbook. Còn mở cho Trường/nhóm: phản ánh ngoài phạm vi bị hỏi vị trí (CR-03 §5.1, Q15).
- [ ] **Bàn giao plan 04 (handoffs H03 Châm Anh / H04 Trí / H05 Trường):** Châm Anh — áp bản vá `H03_backend-api.patch` (chặn ảnh giả `/evidence`, route ảnh threadpool, `/ai-logs` theo vai, thứ tự `/mo/tickets`, giới hạn chữ, khoá session); lỗi E2E mới: kho ngoài phạm vi vẫn thấy trạng thái, `/ai-logs` `since` không timezone ⇒ 500, NaN/Infinity ở vật tư/tồn kho, chữ "string" ở mô tả/hủy, upload kiểm quyền sau khi đọc tệp, lọc `blocker_owner_role` ở `/bql/tickets` bị bỏ qua, cư dân thấy câu BPTN gõ như phần bổ sung của mình; Trí — khung BQL xử lý Bậc 2 đã leo thang không bao giờ hiện (`t.escalated`), nút "báo sai phòng ban sau khi nhận" và "thiếu vật tư" gọi sai route, form BPTN không xét NEED_INFO an toàn, ô tự kiểm ảnh sau REWORK và tab AI Logs lệch với plan 04; SPEC/P1 — T18 thiếu vật tư sau nhận việc, đếm WRONG_DEPT báo BQL, audit + báo BQL khi nhập kho.
- [ ] Log AI cho BTC: tắt alias Python trên máy Như Ý hoặc merge `_pyrun.sh` của Trí từ `develop` (xem gotchas); kiểm `.ai-log/session.jsonl` có dòng mới.
- [ ] Đồng bộ chữ `planning/01_.../specs/01-CONTRACTS.md` §5 cho 3 khoá WP3d (`hedge_forms`, `homograph_confirmers`, `coordination_hazard_exclusions`) + nới V-08 (nguồn chân lý hiện là `lexicon.yaml` + SPEC-P01 §0.1).
- [ ] Trường rà nhãn từ vựng `lexicon.yaml` (từ mới của WP3b–WP3d) và danh sách `khet_electric_contexts`; mọi sửa phải chạy bộ dừng.
- [ ] Sơ đồ swimlane khớp CR-03 (thay `docs/Activity Diagram.png`): an toàn trước phân loại, phân loại trước trùng (D-09), có Bậc 2 cho BPTN, gộp → `MERGED` kết thúc, Kho, rating.
- [ ] (nhánh `develop`) Kế hoạch lưu trữ 01 `planning/01_2026-10-02_supabase-persistence/` (đích 0.6.0): WP1 ✅; WP2–WP4 xong local (R02 chờ duyệt);
  còn WP4b (phiên lưu DB), WP5 (smoke + gate Supabase: owner chạy migration), WP6 (docs, bump).

## Tương lai (Upcoming)
- [ ] **Bàn giao 19/10/2026 — CR-BPTN-03 P1:** T16/T17/E02 (08/10), gộp an toàn + hoàn tác (09/10), tín hiệu P1 + PRI-U1/U2 (10/10), follow-up + danh sách xác nhận an toàn (11/10); LangGraph trên đường chạy thật (05–07/10), thay boilerplate `src/agents/`; eval: an toàn ≥40 câu, 0 bỏ sót Bậc 1, classification ≥90% held-out, coverage ≥60%.
- [ ] Cập nhật docs `01`–`05`, `data-contract-v1.md`, `playbook-v1.md`, README theo CR-03 (hiện còn ghi v0.3/CR-02, có link gãy tới CR-02).
- [ ] Audit cho `receive_stock` (kho nhập vật tư): hiện không có dòng audit vì `AuditEvent` bắt buộc `ticket_id`.
- [ ] Nếu deploy sau reverse proxy (Render): lấy IP client từ header tin cậy, nếu không khóa đăng nhập sẽ dồn về IP của proxy.

## 💡 Kho Ý Tưởng & Backlog (Idea Vault)
- [ ] **P1 tiếp theo (người dùng chốt 2026-10-05, sau plan 05):** luồng trùng đầy đủ CR §8 (đếm trùng + danh sách ticket con, nối bổ sung/ảnh sang ticket gốc, cư dân ticket bị gộp được đánh giá, hoàn tác gộp T09 + `duplicate_rejected_of`, ticket gốc bị hủy ⇒ ticket con chạy lại, BQL gộp khẩn cấp T08, PRI-U1 nâng ưu tiên khi ≥3 trùng); tách ticket khi một phản ánh có hai việc (Agent đề xuất, BPTN xác nhận — chờ người dùng chọn tự tách hay xác nhận); tín hiệu an toàn P1 (gas, kim tiêm, nước vào tủ điện, đèn nóng); đếm trả sai phòng ban báo BQL; giữ/liên kết ticket thường khi cùng chỗ có khẩn cấp; ưu tiên "suýt trượt"/"tràn ra cả hành lang". Route/UI cho các hành động mới giao Châm Anh/Trí.
*Nơi lưu trữ các ý tưởng hay, kiến trúc mở rộng chưa ưu tiên làm ngay nhưng cần giữ lại để tham khảo.*
- [ ] **(2026-10-05) Mở rộng tòa ngoài Ocean Park S1/S2:** thêm mã vào `catalog.yaml` `site.buildings` + `field_labels.location_building`; cân nhắc kiểm cả vị trí BPTN nhập tay và mã con (vd `S1.01`).
- [ ] Chạy ruff format cho `scripts/` (hiện CI không kiểm).
- [ ] **(2026-10-01) n8n đẩy sự kiện nhập kho vào MaintenanceOps** — NGOÀI scope MVP (CR-03 §1: không tích hợp kho thật); chỉ xét qua change request. Điều kiện tối thiểu: khoá chống trùng (`event_id`) vì `receive_stock` đang cộng dồn, tài khoản máy riêng vai WAREHOUSE (không dùng mật khẩu `kho01`, không bật `MO_ALLOW_ACTOR_HEADER`), tồn kho lưu bền thay vì bộ nhớ, dữ liệu vẫn chỉ mã `SIM-`.
- [ ] **(2026-10-02) Idea Vault từ hồ sơ 01:** `cancel_reason` hiển thị nguyên văn cho cư dân và `cancel` thiếu `AuditEvent` (có từ trước, R05 N-13/N-14); tổng bổ sung của cư dân chưa giới hạn (R07 M8, mỗi bổ sung <= 5000 ký tự); `>=` với đồng hồ cố định có thể chặn gỡ Bậc 2 trong mô phỏng (R07 M12); LLM an toàn raise-only ở P1 (cần chạy ngoài `engine.lock`); giới hạn đã biết của 2b: Cyrillic/leet/ligature/chữ tách rời/lặp đúng 2 chữ, "Tòa KO có khói", tín hiệu P1 (S-06…S-08, S-10…S-13), B-04 trùng tên riêng có dấu.
- [ ] Dọn ảnh mồ côi trong bucket (put xong mà tx lỗi và delete cũng lỗi) — non-goal kế hoạch 01.
- [ ] CI chạy `pytest --pg` với service Postgres trong GitHub Actions.
- [ ] **(2026-10-04) Ca riêng kiểm phân loại cho ticket khẩn cấp:** sau plan 02 Q11, CLN-004/TEC-005 không còn kiểm playbook/phòng ban (2b chạy trước phân loại). Nếu cần kiểm việc phân loại sau khi BQL hạ mức, phải thêm ca riêng (Trường, chủ fixture).

- [ ] **(2026-10-04) Từ plan 04, cần nhóm quyết:** (1) ngoài phạm vi trả 404 thay vì 403 + audit (chặn dò ticket + phình audit do gọi lặp; đổi 8 test đã duyệt); (2) ghi chú kết quả có bắt buộc ở bước 10 (CR §9.4(2)) không; (3) cư dân gửi ảnh ngoài NEED_INFO; (4) đánh giá ticket MERGED khi ticket gốc CLOSED; (5) lỗ SPEC-P01 A2: marker "giờ hết rồi" hạ cả mệnh đề có người ngất — cần architect; (6) `_proven_lamp` trong `safety.py` coi mọi "đèn" có dấu trong mệnh đề là bằng chứng B-01 ("đèn … cháy đen" mới vá bằng từ vựng); (7) cụm cũ `ket nguoi` bắt "kẹt, người dùng phản ánh…"; (8) tồn kho mô phỏng không trừ khi giao việc; (9) `/mo/catalog` mở cho cư dân, `eta` không timezone trả 409; (10) từ vựng còn (sau vòng 3): "cháy" đứng riêng chỉ Bậc 2 (B-03, cần SPEC); "không có lửa nhưng khói rất nhiều" chỉ Bậc 2; ngữ cảnh khói thuốc ở câu khác không được loại; "kêu cứu" nghĩa bóng lên Bậc 1 (chủ ý).

## Đã hoàn thành (Done)
- [x] **Phản hồi demo 2026-10-05 (Unreleased):** nút Nghiệm thu một lần; thí điểm Ocean Park S1/S2 + Sảnh cư dân Tầng 1 + tòa con S1.12; BPTN thấy phần thiếu trên thẻ an toàn; phòng ban xác nhận vật tư tại hiện trường (`/material-plan`). 1649 test xanh.
- [x] **v1.1.4 (2026-10-05, Như Ý) — plan 05 làm cứng Agent:** `planning/05_2026-10-04_agent-hardening/`. Kiểm thử biến thể vị trí (an toàn 5669 biến thể, phân loại ~150 câu × 18 mẫu, 0 vi phạm); thẩm định end-to-end phân loại/phân phối/điều phối chạy lại: 77 câu 16→7 lỗi, phần còn lại thuộc P1/spec. Ngoài phạm vi không hỏi vị trí (Q05/Q09). 2941 test xanh.
- [x] **v1.1.3 (2026-10-04, Như Ý) — plan 04 sửa logic sau rà soát:** `planning/04_2026-10-04_logic-review-fix/`. Từ vựng an toàn 2 vòng + thẩm định đối kháng (bộ đối kháng 107 câu: HEAD 50 lỗi → 10; tập rà soát bỏ sót 0/116, báo nhầm 0/83), REWORK cần bằng chứng mới, BQL không bị khoá sau T06, AI Log có ticket_id, LLM ngoài khoá, ticket mồ côi tự chạy lại, 403 không lộ trạng thái, phân loại đèn/vệ sinh, Q22, tách vị trí mở rộng. 1843 test xanh (phần backend tách sang H03).
- [x] **v1.1.2 (2026-10-03, Châm Anh):** `/bql/tickets/{id}/close` chỉ đóng từ `READY_FOR_REVIEW`; ticket khẩn cấp chỉ đóng qua `/emergency/close` (409 `INVALID_TRANSITION` nếu dùng `/close`). 1601 test xanh.
- [x] **Lắp brain4agent (2026-09-30):** Chạy engine V5.2, tạo các phân vùng nhớ, luật `AGENTS.md`, skill và shim cho agent.
- [x] **Rà soát backend 2026-09-30 (Châm Anh):** an toàn đồng thời cho engine, job không chặn event loop, chặn cư dân lùi ngày ở production, khóa đăng nhập theo username + client, `/chat` không lộ lỗi, `llm.py` nhận `OPENAI_BASE_URL`, ruff sạch toàn repo.
- [x] **Flow 2026-10-01 (Châm Anh, `1e2f42b`):** phân loại (bước 3) trước kiểm tra trùng (bước 4); hàm bước `_step_<số>_<việc>`; `WAITING_MATERIAL` chạy lại từ tra tài sản. 142 test xanh.
- [x] **Chốt CR-BPTN-03 là spec duy nhất (2026-10-01):** xoá `docs/CR-BPTN-01.md`, `docs/CR-BPTN-02.md`; CR-03 thêm D-09 (thứ tự theo `1e2f42b`); sửa README; não chuyển sang MaintenanceOps + CR-03.
- [x] **Hồ sơ 01 — CR-BPTN-03 P0 cho engine (2026-10-02, v1.1.0):** `planning/01_2026-10-01_cr03-p0-engine/` ✅. Tầng an toàn 2b hai bậc (`safety.py`, từ vựng `lexicon.yaml`, luật R1–R10), luồng khẩn cấp (5 method BPTN/BQL, chặn `resume()`/job gỡ khẩn cấp, hạn 4 giờ lịch/12 giờ), priority + `queue_sort_key`, bỏ reopen, `SET_ASSIGNEE` bị từ chối, rating một lần, seed CLN-004/TEC-005 Bậc 1. 1462 test; 3 vòng thẩm định cô lập + holdout (NONE 2/39). Tài liệu: `docs/maintenance.md`.
- [x] **Thiếu dữ liệu giao BPTN (2026-10-01):** `MISSING_INFO` do BPTN gỡ (nhập vị trí/thông tin sau khi gọi cư dân), cư
  dân vẫn tự bổ sung được; UI BPTN có hàng chờ `NEED_INFO`. 146 test xanh.

## Trường — lịch theo Notion (nguồn: [Kế hoạch MaintenanceOps MVP](https://storm-jade-f74.notion.site/K-ho-ch-MaintenanceOps-MVP-3e43b68a924d80d7a81fe0579e1eddb9), đọc 2026-10-03)
*Chỉ ghi việc của Trường; phụ thuộc người khác ghi trong ngoặc. Xong = có tài liệu/test + bằng chứng, không chỉ dấu tick.*
- [x] 01/10 — Phiên duyệt CR-03, phạm vi P0/P1, mặc định D-01–D-07, ghi người duyệt D-08, chốt 4 luồng demo (plan 02 WP1–WP3).
  D-08: leader Lê Thị Châm Anh duyệt MVP 04/10 + D-01–D-07; ngày báo 2026-10-02, ghi nhận 2026-10-03; tham chiếu a5e2705/PR #6.
- [x] 02/10 — Rules P0 + ví dụ phủ định/không dấu/nghi ngờ; sửa expected CLN-004, TEC-005 (plan 02 WP4–WP5; 266 test, 57/57 hồ sơ).
- [~] 03/10 — Kiểm tra asset/vật tư, trùng cơ bản, 4 script demo, rà wording theo quyền vai trò → D3-01..07 (SPEC-P06-DAY03).
  Chạy local cô lập (SHA 0ea04ad): 23 record = 17 PASS / 1 FAIL / 5 BLOCKED / 0 NOT_RUN. D3-01/02/03/04/07 [x] (D3-07 = đã lập báo cáo); D3-05/06 chưa [x].
  Asset 3/3, vật tư 4/4, trùng 4/4 PASS. Wording: WORD-03 PASS; WORD-01/02/04 BLOCKED (safety Bậc 2/Bậc 1, rating-once, reopen chưa tích hợp). Demo: 5 PASS, 1 FAIL (DEMO-01-RATING: `engine.rate` ghi đè rating, engine.py:548-553), 2 BLOCKED (DEMO-04 safety chưa tích hợp). Owner lỗi/BLOCKED: Như Ý.
  Chờ người quyết: ASSET-03 (SPEC §3 vs OPERATIONS §3.2.2), STOCK-04 (cờ `STOCK_CHECK_ON_ACCEPT` chỉ đặt, accept không xử lý), owner reopen/rating-once.
- [ ] 04/10 — Chạy demo theo script trên bản online, đối chiếu expected, ghi phần chưa xong + giới hạn mô phỏng. 21:00 nghiệm thu MVP.
  (Chờ: Như Ý nối safety P0 + D-01 vào engine; Châm Anh deploy + persistence/restart.)
- [ ] 05/10 — Chốt backlog sau MVP; mở rộng bộ câu gán nhãn, tách nhãn classification và safety.
- [ ] 06/10 — Rà tuyến chạy theo từng blocker + bảng resume; chuẩn bị case đối chiếu engine ↔ graph.
- [ ] 07/10 — Kiểm tra tương đương nghiệp vụ trước/sau LangGraph (nội dung bổ sung phải quét safety lại).
- [ ] 08/10 — Chốt kịch bản user test + danh sách người tham gia; mỗi thành viên mời ≥1 người, lịch test 10–12/10.
- [ ] 09/10 — Case gộp đúng/sai, gốc hủy, gốc đóng, cư dân của ticket con.
- [ ] 10/10 — Rules/nhãn tín hiệu safety mở rộng (P1, PRI-U1/U2); tổ chức người test đầu tiên.
- [ ] 11/10 — Rà expected outcome, thông điệp cư dân, ranh giới quyền (follow-up, safety clearance).
- [ ] 12/10 — Hoàn thành user test 3–5 người; baseline thủ công vs sản phẩm. 21:00 khóa tính năng.
- [ ] 13/10 — Rà chất lượng nhãn, ĐÓNG BĂNG tập eval, ghi giới hạn dữ liệu mô phỏng.
- [ ] 14/10 — Rà nhãn tranh chấp; tổng hợp số đo thao tác/thời gian + user feedback.
- [ ] 15/10 — Architecture + swimlane; problem statement, giả thuyết, giải pháp, giới hạn.
- [ ] 16/10 — Pitch 10 slide: bài toán, người dùng, giải pháp, demo, kiến trúc, chiều sâu, eval, UX, giới hạn, bước tiếp.
- [ ] 17/10 — Dẫn pitch, tập lần 1–2, chỉnh theo thời lượng.
- [ ] 18/10 — Tập lần 3; đối chiếu MỌI tuyên bố với kết quả thật.
- [ ] 19/10 — Nghiệm thu nội dung, pitch, bằng chứng user/eval; cả nhóm sign-off. 23:59 khóa bàn giao.

**Chỉ tiêu 19/10 phụ thuộc dữ liệu của Trường:** safety ≥40 câu nhãn, 0 bỏ sót Bậc 1 (báo false positive); classification
≥90% held-out; AC-01–AC-18 map test/kịch bản; user test 3–5 người độc lập (thiếu ⇒ ghi số thật).

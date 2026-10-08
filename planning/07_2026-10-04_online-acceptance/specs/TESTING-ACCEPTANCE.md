# Kiểm thử và nghiệm thu — phạm vi9 ca

## 1. Contract hiện hành

Scope H01,H02,I01,A01,M01,U01,S04,G03,R01. Sáu ca được người dùng loại khỏi phạm vi không nằm trong records, counts, coverage hoặc checklist cần chạy. Schema day04-3 trong 01-CONTRACTS. manifest/results/issues tại deliverables/. Nhiều lượt giữ riêng, không gộp tỷ lệ.

## 2. Gates theo môi trường

- ✅ scope: người dùng cho phép loại sáu ca ngày07/10; còn8 ca nghiệp vụ + R01.
- ✅ hồ sơ chuẩn: validator kiểm3 JSON, scope/count/refs/issues và timestamps; từ chối3 negative controls (scope/count/ref); output tại evidence/normalization-20261007/validation.txt, exit0.
- ⬜ local cùng build: H01,H02,I01,A01,M01,U01,S04,G03 đều đạt đầy đủ trên bản chốt. PASS báo cáo lịch sử không suy thành PASS bản mới.
- ✅ local persistence bổ sung: R01 Supabase có bằng chứng ticket/ảnh sau restart; thiếu mốc thời gian chi tiết ghi hạn chế.
- ⬜ online: BLOCKED_NO_DEPLOYMENT; Supabase chung không biến localhost thành bản public.
- ⬜ bản chốt: smoke H01/S04/G03 và các ca ảnh hưởng sau thay đổi build. Không dùng ca đã bỏ để chặn scope.
- ⬜ nhóm: leader sign-off tên/giờ thật; user cho phép thao tác không suy ra nghiệm thu nhóm.

Hồ sơ JSON hợp lệ không đồng nghĩa mọi test PASS. CRITICAL mở không đề xuất nghiệm thu MVP. Quyết định nhóm nhận thiếu sót phải được ghi thật, không tự điền.

## 3. Báo cáo và nghiệm thu công việc cá nhân

Báo cáo ghi scope đã chốt, từng run/build/cấu hình, counts từ records, links3 JSON và evidence, expected/actual, issue/owner/next step, giới hạn SIM-/hosting/LLM/vision/P1/D-01. Ca ngoài scope đã bỏ không phải việc còn nợ. Việc demo và ghi nhận thiếu sót có thể bàn giao theo scope này; sign-off sản phẩm vẫn riêng.

Timestamp/SHA thiếu: null hoặc identity status hạn chế, không tạo dữ kiện giả. Trường không sở hữu toàn bộ deploy/CI/rollback/chi phí; thiếu bằng chứng owner thì ghi issue. Dữ liệu lịch sử vẫn giữ nguyên source, raw output máy/screenshot không sửa.

## 4. Lỗi và caller

Sai JSON/schema/scope/count/refs: trả hồ sơ. Evidence conflict: giữ kết luận lịch sử ở evidence_basis=HISTORICAL_REPORT và mở issue, không tuyên bố tái đo đạt. Runtime failure đã phục hồi: vẫn ghi FAIL hành trình nếu bước bắt buộc lỗi; retest đúng bước mới được đóng issue. Build đổi: cần lượt đo riêng. Validation mới phải chứng minh từ chối scope sai/count sai/ref thiếu ít nhất một lần.

## 5. Evidence đã có

Run UI cũ: báo cáo8 PASS + R01 BLOCKED_MEMORY_STORE; có hạn chế M01/S04/G03/A01. Run Supabase: H01 lỗi create422 rồi recovery CLOSED; R01 persistence/ảnh đạt; GPT-6 Luna SUCCESS. Không có retest create201 hoàn toàn không lỗi. Chuẩn hóa không chạy demo mới, không ghi shared DB/Storage. Boot hub thiếu MODULE_NOT_FOUND không đồng nghĩa app lỗi.

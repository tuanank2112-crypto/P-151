1. Bạn là worker của repo này. Đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại THI CÔNG TÀI LIỆU, vai architect; không sửa runtime.
2. Bước 0: từ root chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`; ghi exit. Worktree dùng đường hub tuyệt đối nếu cần; ngoại lệ CRLF chỉ theo plan Q21, không sửa luật quản lý.
3. Đọc kernel/index → `docs/maintenance.md` → hồ sơ `planning/06_2026-10-05_reasoning-agent/`: `plan.md` Q01/Q05/Q06/Q29, `specs/00-ARCHITECTURE.md` §1/§6, `01-CONTRACTS.md` §3, `SPEC-P01-reasoning-agent.md` §1/§3/§5/§6/§8, `SPEC-P02-engine-integration.md` §4–§6, `SPEC-P05-split-two-jobs.md` §3/§7, `SPEC-P08-audit-fixes.md` §2/§6, `TESTING-ACCEPTANCE.md` §6–§8.

## 1. Bối cảnh
- Người dùng ngày 2026-10-07 yêu cầu agent thực hiện điều phối/phân loại theo ngữ nghĩa, không code cứng hoặc dò từng từ; giao worker tiếp tục đóng gói thiết kế.
- Code hiện tại dùng một lần gọi LLM/decision. `agent/reconcile.py` G-1 chặn loại việc khi luật không thấy dấu hiệu; P08 §6 kiểm hai nơi bằng luật. Cần giải quyết mâu thuẫn với Q01, không chỉ đổi tên thành agent.
- Nhánh làm việc `feature/nhuy-reasoning-agent`; đo Base bằng `git rev-parse HEAD`, ghi `git status --porcelain` trước sửa. Không reset/stash/đụng `.claude/worktrees/` hay thay đổi có sẵn của người khác.
- Đối chiếu `src/maintenance/agent/{agent,graph,reconcile,validate,prompt,inputs,schema}.py`, `engine.py`, `coordination/split.py`. Chỉ đọc code, không đọc/in `.env`, không gọi mạng.

## 2. Phạm vi
- ĐƯỢC GHI trong hồ sơ 06: `specs/SPEC-P09-semantic-coordination.md` (mới, PROPOSED), `handoffs/H16_thi-cong_WP17.md` (mới, CHỜ DUYỆT P09), `reports/R15_thi-cong_WP16.md`, `evidence/WP16/*.txt`.
- CẤM sửa SPEC hiện hành, plan, src/tests/seed, bộ held-out, API/UI, luật repo. Không commit/stage/push/deploy. Không phóng worker thi công runtime.

## 3. Việc phải làm + xong khi
- Viết P09 là hợp đồng thiết kế chính xác: chữ ký hàm/types/schema, thay đổi tương thích và bảng mục SPEC bị thay thế; ghi PROPOSED, chưa có hiệu lực thay P01/P08.
- Quy định rõ quyền quyết định ngữ nghĩa của agent cho phân loại, vị trí sự cố, hỏi bổ sung, trùng/tách và bước tiếp; luật không được phủ quyết chỉ vì không khớp từ khóa. Phân biệt danh mục/quyền/giao dịch/an toàn với bộ phân loại ngôn ngữ.
- Chọn và giải thích kiến trúc tối thiểu đáp ứng yêu cầu: quyết định có cấu trúc hay vòng chọn công cụ → nhận kết quả → quyết định tiếp; nếu có vòng, chốt tool contracts, giới hạn lượt/thời gian/token, điều kiện dừng, retry, stale, idempotency. Không coi LangGraph hoặc trường reasoning là bằng chứng năng lực.
- Chốt cách chứng minh từng thành phần vị trí được hỗ trợ: quote có thật chưa đủ để chứng minh tòa/tầng suy ra đúng. Bao phủ quote thiếu, quote chỉ khu vực, cư dân ở một nơi nhưng sự cố nơi khác; không tạo thêm từ điển câu cư dân để vượt test.
- Giữ quyền con người, an toàn chỉ nâng, gọi LLM ngoài khoá và kiểm lại trước ghi. Lỗi model/tool phải hiện source/fallback; không tính fallback hoặc Mirror là lượt agent hiểu đúng.
- Có bảng lỗi → hành vi caller, BẮT BUỘC/CẤM/vùng cấm, vận hành/cờ bật/rollback và ma trận nghiệm thu theo môi trường. Test gồm paraphrase chưa gặp, phủ định, nhiều lượt, hai nơi, nhân quả, chèn lệnh; phân biệt fake test kiểm cơ chế và live held-out đo năng lực.
- Giữ ngưỡng TESTING §6 làm sàn, bổ sung số đo về agent tự quyết, bị luật chặn, fallback, sai vị trí/tách và chi phí. Không nới ngưỡng/nhãn, không chỉnh prompt trên held-out. Chưa đo ghi NOT_RUN, cấm bịa kết quả.
- H16 ≤80 dòng, đủ 3 dòng đầu/6 mục, chỉ trỏ P09 theo mục, phạm vi file tường minh, lệnh nghiệm thu + kết quả máy đọc, report R16 cùng đuôi. Ghi CHỜ DUYỆT, không cho worker tự đổi contract đã duyệt.
- Đo: `git diff --check` exit 0; kiểm mọi link nội bộ tồn tại (trừ đầu ra mới ghi rõ); đếm H15/H16 ≤80; kiểm đủ các mục trên và ghi số mục đạt/thiếu. Lưu output máy `evidence/WP16/package-check.txt`; mọi mục thiếu = chưa đạt.

## 4. Luật
- Thiết kế đơn giản nhất đáp ứng yêu cầu, không tự mở rộng số loại nghiệp vụ; không xoá fallback/an toàn để đạt nhãn “agent”.
- P08 vẫn có hiệu lực cho H13/H14 tới khi P09 được duyệt; trong P09 liệt kê rõ mục thay thế, không để hai luật trái nhau cùng có hiệu lực.
- H11 eval chưa chạy được vì `tests/test_maintenance/agent_eval/` chưa có tại mốc kiểm tra 2026-10-07; ghi phụ thuộc WP0, không dựng số liệu giả hoặc tự truy cập nguồn từng bị từ chối.

## 5. Tầng
- WP16 kiến trúc/contracts: 🔴. Không giao việc runtime; không cần agent con cho gói tài liệu này.

## 6. Report
- Dòng 1: `Vai · thi công · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4: `Handoff: handoffs/H15_thi-cong_WP16.md`, `Base: <SHA đo lúc nhận>`, `Head: <SHA hiện tại; working tree chưa commit>`.
- Ghi lệnh + exit, số kiểm tra đạt/thiếu, `git diff --stat` và file untracked trong phạm vi, bảng phân công, mục chưa làm/câu hỏi mở; trỏ evidence. Cuối: `⏳ Chờ người duyệt.`
Report: `planning/06_2026-10-05_reasoning-agent/reports/R15_thi-cong_WP16.md` · Evidence: `planning/06_2026-10-05_reasoning-agent/evidence/WP16/package-check.txt`

# Testing and acceptance

## 1. Gate contract
Chỉ đánh dấu ✅ từ phép đo thực tế. Spec approval, artifact local và review README/slide là ba gate khác nhau. Không có server/deploy gate trong công việc diagram; hình target không nghiệm thu runtime.

## 2. Lệnh và bằng chứng
- SPEC: node evidence/spec/check-spec.cjs kiểm 5 SPEC + plan tồn tại, headings bất biến/errors/evidence, links nội bộ và JSON state parse; output JSON `{checks, pass, fail}` với fail=0, exit 0. Không dùng test app lịch sử làm bằng chứng spec.
- XML: Python xml.etree.ElementTree parse draw.io/SVG; kiểm mxCell IDs web/api/orchestrator/engine/rules/tools/review/openai/supabase/phoenix; edges e01–e12 đúng endpoints; title/subtitle/proposed; 1 page; SVG viewBox 0 0 1920 1080. Output counts nodes=10, edges=12, violations=0, exit 0.
- EXPORT: lệnh draw.io thực tế + exit 0; XML parse không đủ chứng minh draw.io mở/export được.
- VISUAL: render ra PNG 1280×720 và 960×540; mở cả hai. Ghi clipping=0, text_overlap=0, node_crossing=0, edge_crossings≤2, min_font_px≥20; ghi người/agent kiểm và timestamp. Metrics nhận xét phải phân biệt với số đo script.
- DIFF: `git diff --check` exit 0; `git diff --stat` + `git status --short`; artifact untracked phải được liệt kê vì diff --stat không bao gồm untracked.
- Source/contract check bằng đọc lại tất cả edges. Không chạy build/lint/test ứng dụng cho thay đổi tài liệu thuần; nếu đụng code thì thoát scope và cần checklist phù hợp.
- Evidence scripts/output/preview dưới `planning/05_2026-10-04_component-diagram/evidence/<package>/`; output máy CẤM sửa tay. Chỉ tạo khi có phép đo; không đặt script nháp ở root.

## 3. Acceptance cases
- A01: viewer phân biệt được Users → Web → API → core và external dependencies; nodes 10, edges 12.
- A02: LangGraph hiện diện là orchestrator; Engine vẫn sở hữu state/audit; OpenAI không có edge write/approve tới DB.
- A03: vision/GPT-4o có `Proposed: GPT-4o + Vision`; ảnh bằng chứng và proposal đọc ảnh không bị đồng nhất.
- A04: Human Review nhìn rõ; quyết định đi qua API/Engine; role groups đúng Resident/Operations Staff/Management.
- A05: Supabase gộp PostgreSQL/Storage; Photo I/O từ API, Case/Audit từ Engine; Phoenix telemetry từ client Agent.
- A06: một hình 16:9; palette một accent; 0 overlap/clipping; ≤2 crossings; file draw.io native editable và SVG vector cùng nội dung.
- A07: không RAG/vector/Celery/real dispatch, không ghi đè hình cũ, không sửa code/CR; notes không khẳng định đã deploy.
- A08 (người dùng): hình dễ nhìn trên README và slide, thông điệp hệ thống/vai trò AI rõ; chưa có review ⇒ không ghi đã đạt.

## 4. Negative checks
Bộ kiểm artifact phải phát hiện ít nhất 3 lỗi trên bản sao trong evidence: bỏ badge proposed, thêm OpenAI→Supabase, đổi viewBox thành tỷ lệ vuông. Mỗi bản sai phải exit≠0 trước khi bản thật exit0; không phá bản nguồn để kiểm.

## 5. Lỗi và hành vi bắt buộc
- PARSE / CONTRACT_FAIL: không export hoặc sign-off; sửa nguồn rồi chạy lại phần liên quan.
- VISUAL_FAIL: XML xanh không đủ; chỉnh layout, render lại hai kích thước.
- NO_EVIDENCE / FALSE_PASS: giữ gate mở; không suy PASS từ metadata hay chat.
- APPROVAL_PENDING: trình spec/hình cụ thể, chờ người dùng; không tự suy duyệt từ im lặng.

## 6. Gates và kết quả thật
- ✅ local / discovery: đọc repo và phỏng vấn; quyết định có mốc trong plan.md.
- ✅ local / spec structure: 33 checks / 33 pass / 0 fail, exit 0; evidence/spec/spec-check.txt; lệnh: node planning/05_2026-10-04_component-diagram/evidence/spec/check-spec.cjs.
- ✅ người dùng / SPEC approved: yêu cầu “chốt spec hãy dựng draw.io và SVG”.
- ✅ local / draw.io load + SVG export + XML contract: native draw.io31.7.0 exit0, 10/12, violations0; evidence/build/native-export.txt + artifact-check.txt.
- ✅ local / negative checks + visual previews: negative exit1/1/1; bản thật exit0; 2 previews mở; font≥20, 0 overlap/clipping, 2 crossings. Evidence/build/negative-exits.txt + visual-metrics.json.
- ⬜ người dùng / README + slide acceptance.
- Local artifacts đã đo 2026-10-04T10:46:25+07:00; user visual acceptance còn mở; không nghiệm thu runtime/server trong task diagram.

### Problem Card — ResidentGPT – AI Agent Trợ lý Cư dân Hỏi-Đáp Nội quy & Tiện ích

```text
Problem :Nhân viên BQL/CSKH tại một cụm dân cư phải xử lý thủ công số lượng lớn câu hỏi hành chính lặp lại của cư dân qua hotline và Zalo. BQL phải tự xác định nhu cầu, tìm tài liệu đang có hiệu lực và soạn câu trả lời, làm tăng thời gian xử lý và tạo nguy cơ trả lời không nhất quán giữa nhân viên hoặc giữa các kênh.

Actor: Nhân viên BQL/CSKH cư dân là primary operator; cư dân là affected user.

Thời điểm / bối cảnh: : Một cụm/tòa thuộc Ocean Park 1 đã vận hành ổn định; cư dân thường xuyên gửi các câu hỏi hành chính lặp lại qua hotline và nhóm Zalo. MVP tập trung vào FAQ có tính nghiệp vụ tương đối ổn định và có tài liệu chính thức để đối chiếu.

Current workflow: Cư dân gửi câu hỏi qua hotline/Zalo → BQL xác định intent → yêu cầu bổ sung thông tin nếu cần → tra cứu quy định/tài liệu hiện hành → soạn câu trả lời → nếu không chắc chắn thì chuyển bộ phận liên quan → trả lời cư dân.

Bottleneck: Hai bước tốn nguồn lực nhất cần xác minh là xác định chính xác intent của câu hỏi và tìm đúng phiên bản thông tin hiện hành.

Impact: Với hypothesis 48–105 FAQ hành chính/ngày và 3–7 phút xử lý thủ công/case, workload có thể tương đương khoảng 2,4–12,25 giờ công/ngày/cụm. Đây là planning estimate,.

Success metric:
Chưa chốt. Cần baseline cho handling time, số repetitive inquiries/day, resident waiting time và incorrect/inconsistent answer rate, sau đó đặt target định lượng.

Risk / Failure impacts: Thông tin sai/lỗi thời có thể khiến cư dân hành động sai, khiếu nại và mất niềm tin; failure còn có thể tạo thêm contact volume cho BQL. Mức risk khác nhau theo từng loại thông tin.

AI Hypothesis: AI có thể hỗ trợ hiểu intent + tìm đúng tri thức + draft/trả lời nhóm FAQ lặp lại, từ đó giảm workload
```
**Scope MVP**: Các câu hỏi hành chính của cư dân tại một cụm/tòa thuộc Ocean Park 1 trong giai đoạn vận hành ổn định, qua hai kênh hotline và Zalo, quan sát trong 30 ngày.


**Success Metrics**:

Answer Quality : ≥85% câu FAQ trong evaluation set được trả lời đúng và grounded trên tài liệu nguồn. Hệ thống có khả năng trả lời đáng tin hay không.

AI-assisted: workflow giảm ít nhất 50% median handling time so với quy trình tra cứu và trả lời thủ công trên cùng test set.

Safety: ≥90% các câu hỏi thiếu dữ liệu, ngoài phạm vi hoặc rủi ro cao được yêu cầu làm rõ hoặc chuyển BQL .


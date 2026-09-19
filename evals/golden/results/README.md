# Evaluation Results

Thư mục này lưu output của từng evaluation run. Không sửa hoặc ghi đè
Golden Dataset từ kết quả chạy.

Mỗi run nên lưu tối thiểu:

- dataset revision;
- Knowledge Pack revision;
- model/prompt/index revision;
- thời gian chạy;
- kết quả từng case;
- diagnostics;
- aggregate M1, M2 và M3;
- M1 PASS/40, M3 PASS/16, human-control PASS/30 và logging completeness/30;
- paired manual/AI sample size và exclusions cho M2;
- danh sách failure để triage.

Không lưu raw resident PII hoặc account-specific data trong results.

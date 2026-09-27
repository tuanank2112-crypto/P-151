# Evaluation Run Artifacts

Thư mục này lưu output của từng Golden Dataset v0.3 run. Không sửa hoặc ghi đè baseline từ kết quả chạy.

Mỗi run nên lưu tối thiểu:

- run ID, dataset revision và Knowledge Pack revision;
- build/commit, Live URL và deployment smoke-test result;
- model, prompt, index, confidence threshold và Grader revisions;
- thời gian chạy và reviewer;
- kết quả từng FAQ/E2E case cùng diagnostics;
- valid citation rate (`document_id` + `section_id`);
- Memory/Query Rewriter results cho multi-turn cases;
- Confidence/High Risk decision, Resident Escalation Card và BQL ticket evidence;
- dual-role auth/access-isolation và blank-screen fault-injection results;
- aggregate Grounding, Answer Quality, Correct Safe Behavior, Memory, handoff và logging gates;
- danh sách failure, owner, remediation và rerun decision.

Không lưu raw resident PII, account-specific data, secret hoặc access token trong results.

# Contract — dữ liệu, nhãn và backlog Day05

> **Phạm vi đang hiệu lực: PRELIMINARY_15**, được Trường duyệt ngày 08/10/2026. Đọc [SPEC-P03-PRELIMINARY15](SPEC-P03-PRELIMINARY15.md) trước; quota 80/40, held-out30 và 32 family bên dưới là mục tiêu rộng trước đây, không còn là cổng bắt buộc của Day05 sơ bộ. Yêu cầu review thật và bằng chứng không đổi.

## 1. File và phiên bản

Các JSON khi thực thi: deliverables/backlog.json, cases.json, classification-gold.json, safety-gold.json, disputes.json, split-manifest.json, label-proposals.json, baseline-results.json. Mỗi root là `{schema_version:"day05-1",created_at:ISO8601,records:Record[]}`; split-manifest thêm dataset_version:string,source_hashes:map[path,SHA256],splits:{develop:string[],held_out:string[]}. ID ổn định, mọi text UTF-8, synthetic=true. Root corpus/schema không tạo ở lượt lập kế hoạch.

## 2. SourceCase

`SourceCase={case_id:"D5-C-"+4digits,text:string,synthetic:true,family_id:string,phenomena:string[],source:{kind:"AUTHORED"|"EXISTING_FIXTURE"|"USER_REPORTED_SYNTHETIC"|"LLM_PROPOSAL",ref:string,original_id:string|null},split:"DEVELOP"|"HELD_OUT",classification_eligibility:"ELIGIBLE"|"SAFETY_STOP",notes:string}`.

Text nguyên bản giữ cố định; lỗi chính tả/không dấu thuộc text, không tự sửa để match code. Source USER_REPORTED chỉ lấy câu đã được dùng làm demo, không lấy PII/credential hoặc dump ticket DB chung. family_id bao trùm base/paraphrase/biến thể vị trí/phủ định có liên quan; không tách family để tăng mẫu số held-out.

## 3. Hai gold riêng

`Review={status:"PROPOSED"|"NEEDS_REVIEW"|"ACCEPTED"|"REJECTED",proposed_by:string,reviewed_by:string|null,reviewed_at:ISO8601|null,rationale:string,spec_refs:string[],dispute_id:string|null}`.

`ClassificationGold={case_id:string,service_category:"VE_SINH"|"KY_THUAT"|"UNKNOWN",ticket_type:"COMMON_AREA_CLEANING"|"COMMON_AREA_LIGHTING"|"UNKNOWN",playbook_id:"PB-CLN-01"|"PB-TEC-01"|null,reason_code:"CATEGORY_UNCLEAR"|"OUT_OF_SCOPE"|null,review:Review}`.

Chỉ3 cặp hợp lệ: VE_SINH/CLEANING/PB-CLN-01, KY_THUAT/LIGHTING/PB-TEC-01, UNKNOWN/UNKNOWN/null. Hai cặp đầu reason_code=null; UNKNOWN phân biệt mixed=CATEGORY_UNCLEAR với không thuộc2 playbook=OUT_OF_SCOPE. ClassificationGold chỉ chứa ELIGIBLE/risk NONE. Không tự suy UNKNOWN vì thiếu tầng/tòa: vị trí và loại công việc là hai trục; text phải có ngữ cảnh khu vực chung để lập oracle phù hợp rules hiện hành.

`SafetyGold={case_id:string,risk_level:"NONE"|"UNCLEAR"|"EMERGENCY",signals:GoldSignal[],risk_reason:string,review:Review}`.

`GoldSignal={signal_id:string,status:"PRESENT"|"ABSENT"|"UNCLEAR",source_quote:string,start:int,end:int}`; chỉ ID tín hiệu đã định nghĩa trong CR/lexicon P0. Quote là substring đúng text: text[start:end]==source_quote, offsets theo Python Unicode codepoint. NONE có thể signals=[] hoặc ABSENT đã review; EMERGENCY phải có Bậc1 PRESENT; UNCLEAR có bằng chứng T2/tín hiệu UNCLEAR, ghi spec_refs. Không gán phaseP1 thành gateP0. Không có metadata detected_by giả cho gold của người.

## 4. Proposal và tranh chấp

`Proposal={case_id:string,task:"CLASSIFICATION"|"SAFETY",producer:"HUMAN"|"LLM",model:string|null,proposed_at:ISO8601,payload:object,call_status:"OFFLINE"|"SUCCESS"|"ERROR",error_type:string|null}`.

`Dispute={dispute_id:string,case_id:string,task:"CLASSIFICATION"|"SAFETY",proposed_labels:object[],question:string,owner:string,status:"OPEN"|"RESOLVED",decision:object|null,decision_at:ISO8601|null,evidence_refs:string[]}`.

Gold ACCEPTED có reviewer người thật, thời điểm và rationale/spec_refs; reviewer khác người đề xuất. Dispute OPEN không vào gold tính điểm. Nếu cả2 gold ACCEPTED cho ELIGIBLE, risk phải NONE. Proposal raw/rationale được lưu riêng, không sửa gold theo model. Không làm full safety-stop câu thành classification failure.

## 5. Backlog

`BacklogItem={item_id:"D5-B-"+3digits,title:string,kind:"BUG"|"DATA"|"SPEC"|"FEATURE"|"EVIDENCE",severity:"CRITICAL"|"MAJOR"|"MINOR"|"NA",priority:"P0"|"P1"|"P2",decision:"NOW"|"NEXT"|"DEFER"|"NO_ACTION",owner:string,owner_acceptance:"PROPOSED"|"CONFIRMED",dependencies:string[],source_issue_refs:string[],evidence_refs:string[],expected:string,actual:string,done_when:{command:string,expected_result:string},status:"OPEN"|"IN_PROGRESS"|"FIXED_PENDING_RETEST"|"CLOSED",reviewed_by:string|null,reviewed_at:ISO8601|null}`.

CRITICAL ⇒P0; CLOSED có retest evidence; fixed code không tự CLOSED. Nguồn lịch sử được gắn mốc/build; không tự khẳng định bug vẫn có ở runtime hiện tại. Nhãn/coverage issue không coi là module fix. Không tạo backlog cho6 ca Day04 đã bỏ chỉ để làm đủ checklist.

## 6. Baseline

`BaselineRecord={case_id:string,split:"DEVELOP"|"HELD_OUT",task:"CLASSIFICATION_RULES"|"CLASSIFICATION_LLM"|"SAFETY_RULES",gold:object,actual:object,result:"MATCH"|"MISMATCH"|"ERROR"|"NOT_EVALUATED",model:string|null,call_status:"OFFLINE"|"SUCCESS"|"FALLBACK_RULE"|"ERROR",latency_ms:number|null,evidence_refs:string[]}`.

Model metric chỉ tính SUCCESS cùng model/prompt/version; fallback/error báo riêng, không nhận là đúng của Luna. Không đưa gold/rationale vào prompt classifier. Nêu số correct/eligible/total/error và family count; không gộpclassification/safety thành1 accuracy. Manifest baseline ghi baseSHA,dirty flag,hash files code/prompt/lexicon/dataset,run timestamps. Scripts chưa có là planned interface, không được tuyên bố đã chạy.

## 7. Lỗi và bằng chứng

DuplicateID/missingref/badpair/badquote/crosssplit/ACCEPTED thiếu reviewer ⇒ validator exit1, ngừng export. Dispute ⇒ NEEDS_REVIEW. Runtime mismatch ⇒ backlog+baseline, giữ gold. HTTP/auth/rate limit ⇒ ERROR, không bịa response. Người chưa review ⇒ không bù ngày/giây giả. Nghiệm thu: số records/accepted/disputes/families/strata/leakage/errors/ref tồn tại đều do validator đo, output máy không sửa tay.

## Vùng cấm và nghiệm thu contract

CẤM dùng proposal chưa ACCEPTED làm gold; CẤM đổi enum runtime hoặc gộp classification với safety trong lượt này. Xong khi validator kiểm mọi schema, quan hệ case_id, quote và reviewer; mọi vi phạm phải trả exit1 và dừng export.

Vai: worker (vai-thi-cong) · loại: thẩm định · họ/model: OpenAI/GPT-6 · Bước 0 exit 1 MODULE_NOT_FOUND · hiểu việc: đo độc lập UI/BFF theo SPEC plan18, chỉ ghi hồ sơ/evidence; cấm sửa runtime, secrets, DB chung, commit/push.
Handoff: ../handoffs/H04_independent-review.md
Base: 2ced2656c66ceb6cdc44790a91f676ab1b8d710d
Head: 2ced2656c66ceb6cdc44790a91f676ab1b8d710d (dirty; HEAD chưa chứa runtime mới)

## Lệnh và số đo
- `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` → exit1; [boot.txt](../evidence/independent-review/boot.txt).
- `npm.cmd test` tại portal → exit0; 9 files, 62 total/pass, 0 fail/skip; [unit.txt](../evidence/independent-review/unit.txt).
- `node planning/18_2026-10-10_portal-python-api/evidence/independent-review/probes.mjs` → exit1; 17 total, 15 pass, 2 fail, 0 skip; [probes.txt](../evidence/independent-review/probes.txt).
- `git diff --stat` → exit0; [diff-stat.txt](../evidence/independent-review/diff-stat.txt); 26 tracked files, 121 insertions, 4222 deletions tại thời điểm đo. Không chứa untracked runtime mới; không suy scope đầy đủ từ trackedstat.

## Findings có thể tái hiện
- F01 P1, SPEC §U1/§U2: `portal/src/components/python-dashboard.tsx:194` ManagementPanel không có safety control; `portal/src/lib/python-ui.ts:30` management needsRole chỉ READY_FOR_REVIEW/emergency/wrongdept. Cho ticket VERIFYING + SAFETY_REVIEW_REQUIRED + escalated=true: BQL không có nút CONFIRM_SAFE/REQUEST_INFO/ESCALATE và filter Cần xử lý bỏ sót. probes FAIL2. API safety cho phép BQL; engine._escalate giữ ownerBPTN và escalated=true.
- F02 P1, SPEC §D2 + docs/portal.md §7: `portal/src/app/actions/backend.ts:22` trả nguyên Case vào client. Live department GET Case200 có ticket.resident_id; BFF không projection nên JSON action expose ID cư dân cho phòng ban dù modal không render. Probe in chỉ boolean presence, không giá trị ID/token. Xong khi mọi department response detail/action/upload được projection, test serialised response không chứa resident_id/actor IDs nội bộ ngoài nhu cầu UI.

## Đối kháng / negative controls
- Spoof actor: client xoá X-Actor-Id → GREEN; mutant bỏ lệnh xoá → RED.
- Resident ảnh internal: photoBFF chặn role → GREEN; mutant bỏ predicate → RED.
- Old DB fallback: queries không import DB/workflow → GREEN; mutant thêm DBimport → RED.
- completeHTTP200: check READY_FOR_REVIEW → GREEN; mutant bỏ check → RED.
- Auth live memory8018: RESIDENT/DEPARTMENT/BQL login200, unauth internal401, resident internal403, department list/detail200.
- Vật tư: bộ unit actualUsage/usagePayload 62PASS gồm không prefill Agent, số nguyên dương, sai phòng, duplicate, cleaning[]; chưa đo browser draft trong lần này.

## Phân công thực tế
| Gói | Tầng yêu cầu | Họ/model thực tế |
| --- | --- | --- |
| WP4 đối kháng độc lập | 🔴 | OpenAI/GPT-6 |
| Probes/hồ sơ | 🟠/🟢 nâng lên 🔴 do phiên chỉ một model | OpenAI/GPT-6 |

## Không làm / gate chưa đo
- Không đọc reports/handoffs thi công; không sửa implementation; không gọi cổng8000/Supabase/DBportal.
- Không chạy lại fullPython/lint/typecheck/build/Docker: root sở hữu các measurement, UI đang thay đổi; đây không phải bằng chứng những gate đó đạt.
- Không browser/điện thoại: chờ snapshot build ổn định; cần root đo lại browser1440/390+draft errors30s.
- Boot hub thiếu là giới hạn môi trường độc lập; không sửa engine hoặc block code review chỉ do missinghub.
- Câu hỏi cần người: không có quyết định contract mới trong scope review này.

Tiếp theo
🖐 Cần tay người: bổ sung hub boot và môi trường Docker khi nghiệm thu môi trường.
🤖 Agent làm được ngay: root sửa F01/F02 rồi reviewer chạy lại probes trên snapshot mới.
⭐ Nên làm trước: F01/F02; thiếu hành động an toàn và lộ identity trong payload.
⏸ Chưa làm: browser/Docker/điện thoại/fullPython; chờ môi trường và snapshot ổn định.
Phán quyết lần1: 🔁 SỬA F01/F02; được thay bằng lần2 bên dưới, giữ lịch sử.

## Lần2 — remeasure sau sửa F01/F02
- `npm.cmd test` → exit0; 10 files, 67 total/pass, 0 fail/skip; [unit-round2.txt](../evidence/independent-review/unit-round2.txt).
- `node .../independent-review/probes.mjs` → exit0; 17 total/pass, 0 fail/skip; [probes-round2.txt](../evidence/independent-review/probes-round2.txt). Dòng measurement "BFF forwards unmodified=true" chỉ dò directfn trong source, KHÔNG phản ánh projection ở execute; privacy được đo bằng browser dưới đây.
- `node .../independent-review/browser-review.mjs` → lần đầu exit1 do fixture mùi khét là tier1, không phải safetyreview; [browser-round2.txt](../evidence/independent-review/browser-round2.txt). Lần2b fixture T2-04 lạch tạch → exit0; 49 total/pass, 0 fail/skip; [browser-round2b.txt](../evidence/independent-review/browser-round2b.txt).
- Browser6vai×1440/390: route đúng, không tràn ngang, không uncaughtJS; [screens](../evidence/independent-review/screens/). Technical/cleaning real BFF POSTdetail có payload, không resident_id/actor_id/internal_message. BQL3safetybuttons tồn tại, disabled note trống, enabled note đủ.
- F01/F02: ✅ sửa trong scope đã đo. Chưa đo actionupload/checklistprivacy riêng; execute projection shared path + unit caseview đã đo, browser detail xác minh realnetwork.
- `node .../independent-review/safety-state-probe.mjs` → exit0; 3/3 assertions; [safety-state-rerun.txt](../evidence/independent-review/safety-state-rerun.txt). Chỉ dùng own resident tickets mới, không chạm rootTEC001/stock. Lần đầu [safety-state.txt](../evidence/independent-review/safety-state.txt) có count0 do precedence lỗi bộ đo dù statuses/exits đúng; rerun sửa count3, không sửa evidence.
- F03 P2, SPEC §U2: ManagementPanel SafetyPanel cho VERIFYING+SAFETY_REVIEW_REQUIRED trước escalated=true, dù BQL decision API403. SharedSafetyPanel tại NEED_INFO+safety_context còn REQUEST_INFO nhưng backend chỉ cho VERIFYING, đo HTTP409. `python-dashboard.tsx:204/227`, `python-ui.ts:31`. Xong khi BQL VERIFYING panel/needsqueue yêu cầu escalated=true; NEED_INFO chỉ CONFIRM_SAFE/ESCALATE, không REQUEST_INFO.
- Gate review browser hiện đạt scope6rolelayout/privacydetail. Docker/điện thoại/fullPython/boot vẫn chưa đo/giới hạn như lần1. Không suy sign-off plan18.

Tiếp theo
🖐 Cần tay người: bổ sung hub boot và Docker cho nghiệm thu môi trường.
🤖 Agent làm được ngay: root sửa F03 guard controls theo escalated/status rồi reviewer remeasure.
⭐ Nên làm trước: F03 để UI không mời thao tác backend từ chối theo quyền/trạng thái.
⏸ Chưa làm: Docker/điện thoại/fullPython và actionuploadprivacy riêng; scope review/UI còn F03.
Phán quyết lần2: 🔁 SỬA F03; được thay bằng lần3 bên dưới, giữ lịch sử.

## Lần3 — remeasure F03 trên production current stable
- Head vẫn `2ced2656c66ceb6cdc44790a91f676ab1b8d710d`, dirty. `git diff --stat` exit0 → tracked35files, 216 insertions, 4315 deletions; [diff-stat-round3-final.txt](../evidence/independent-review/diff-stat-round3-final.txt); untracked runtime mới không nằm trong trackedstat.
- `npm.cmd test` → exit0; 10files, 68 total/pass, 0 fail/skip; [unit-round3.txt](../evidence/independent-review/unit-round3.txt).
- `node planning/18_2026-10-10_portal-python-api/evidence/independent-review/safety-browser-round3.mjs` → exit0; 17 total/pass, 0 fail/skip; [safety-browser-round3.txt](../evidence/independent-review/safety-browser-round3.txt).
- ActualPython8018 + Nextproduction3018: ownnewfixture VERIFYING/SAFETY_REVIEW_REQUIRED/non-escalated → BQL cả3safetybuttons không có. BPTNREQUEST_INFO HTTP200 → NEED_INFO/safety_context/MISSING_INFO → BQL chỉ CONFIRM_SAFE+ESCALATE, không REQUEST_INFO; note trống disabled, note đủ enabled. JSuncaught0, overflow0 tại390px.
- Screens: [preescalation](../evidence/independent-review/screens/round3-preescalation.png), [needinfo](../evidence/independent-review/screens/round3-needinfo.png).
- KhôngQA/jobs/reset/stock; chỉ residentcreate/BPTNrequestinfo trên ownfixture mới, không chạm TEC001/rootfixtures. Không đọc rootreports làm bằng chứng.
- F01/F02/F03 đã đo sửa trong scope review UI/BFF. GateDocker/boot/điệnthoại/fullPython không được reviewer tuyên bố đạt; chỉ root nghiệm thu các gate còn lại bằng measurement riêng.

Tiếp theo
🖐 Cần tay người: bổ sung hub boot và Docker cho nghiệm thu môi trường.
🤖 Agent làm được ngay: root đo lại bộ probes và hoàn tất gate còn lại theo SPEC.
⭐ Nên làm trước: đóng bằng chứng từng gate; scope UI/BFF không còn finding mở sau round3.
⏸ Chưa làm: Docker/điệnthoại/fullPython và riêng browseruploadprivacy; các gate này ngoài review round3.
Phán quyết lần3: ✅ DUYỆT UI/BFF F01/F02/F03; giữ scope, bổ sung delta dưới đây.

## Final delta — Materials saved state
- Đọc trực tiếp `python-dashboard.tsx:190`, `case-view.ts:29`, `python-ui.ts:14`: saved khi có actualused nonnull hoặc backend modeN_A; không còn tự đánh dấu cleaningTRACKEDblank đã lưu. Projection/DTO giữ material_requirement_mode; draft edit đặt saved=false.
- `node planning/18_2026-10-10_portal-python-api/evidence/independent-review/material-delta.mjs` → exit0; 11 total/pass, 0 fail/skip; [material-delta.txt](../evidence/independent-review/material-delta.txt).
- Pure initializer: blankTRACKEDfalse, emptyN_Atrue, actualusagetrue, missingmodefalse. LivePython memory + Nextproduction: cleaninglogin200, current IN_PROGRESS/N_A mở modal→Lưu vật tưdisabled/Không sử dụng vật tưchecked; local+Thêm vật tư→Lưu vật tưenabled. Không POSTmaterialusage/QA/reset/stock, chỉ đọc fixture và sửa localdraft chưa gửi.
- [Screenshot localedit](../evidence/independent-review/screens/material-delta-localedit.png). Không đọc rootcleaning report làm nguồn truth; không tái chứng minh broader gates.

Tiếp theo
🖐 Cần tay người: bổ sung hub boot/Docker khi nghiệm thu môi trường.
🤖 Agent làm được ngay: root hoàn tất hồ sơ và đo lại gate còn lại theo SPEC.
⭐ Nên làm trước: khép bằng chứng theo môi trường; finaldelta Materials đã đo11/11PASS.
⏸ Chưa làm: Docker/điệnthoại/fullPython và POSTempty material riêng; finaldelta review chỉ read/localdraft.
Phán quyết deltaMaterials: ✅ DUYỆT trong scope đã đo; bổ sung emergency-note dưới đây.

## Supplemental delta — emergency-close note
- Đọc frozenPython `src/maintenance/engine.py:1220–1230`: emergency_close kiểm `_safety_precheck(... note_required=True)`. UI `python-dashboard.tsx:208` dùng NoteActionrequired tương thích contract sẵn có, không thay API.
- `node planning/18_2026-10-10_portal-python-api/evidence/independent-review/emergency-note-delta.mjs` → exit0; 6 total/pass, 0 fail/skip; [emergency-note-delta.txt](../evidence/independent-review/emergency-note-delta.txt). Guard required GREEN, optionalnote mutant RED. NoteAction truyền textarea required, disabled cho empty/whitespace, action gửi `{note}` nguyên contract.
- Chỉ reviewsource/staticguard; không browser/server đang rebuild, không reset/QA/mutation. Không dùng root supplementalreport làm nguồntruth. Actualemergency action/browser sau rebuild là phép đo root độc lập, chưa được reviewer tuyên bố đạt trong delta này.

Tiếp theo
🖐 Cần tay người: bổ sung hub boot/Docker cho gate môi trường.
🤖 Agent làm được ngay: root đo supplementalbrowser sau rebuild rồi khép gate còn lại.
⭐ Nên làm trước: actualemergency action sau rebuild; note-required source đã khớp frozencontract6/6PASS.
⏸ Chưa làm: reviewer browseremergency sau rebuild, Docker/điệnthoại/fullPython; không suy từ staticguard.
✅ DUYỆT: source delta emergency-close note-required và UI/BFF đã đo; không sign-off supplementalbrowser chưa chạy/toàn kế hoạch/gate môi trường.

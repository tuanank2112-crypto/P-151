# Kiểm thử và nghiệm thu
## §T1. Bộ đo bắt buộc
- Unit types/auth/role/id/status/errors/photoBFF/actionpath/body; wronguser/wrongdept403, residentinternal403, tokenexpired401; snapshot input giữ sau reject30s; no tokenHTML/log.
- Static import graph/runtime: pages/actions/session/queries/ảnh không reachable db/workflow/JS classify, không DATABASE_URL. Có mutant bật lạiDBfallback phải RED, guard cấm Number(ticket_id) phải RED.
- Python engine memory thật cùng web/app: rõ issue+vịtrí trong giờ làm → engine quyết định ROUTED hoặcblocker đúng, UI không ép BPTN. Phản ánh safety → BQL/BPTN đúng owner; duplicate/needinfo không bypass.
- Resident create→list/detail→additions/photo/rating; DEPARTMENT accept→checklist/material/photo/note→complete; BQLclose/rework/emergency; BPTNresolve/safety; warehouse stockreceive.
- IDs string không cắt tiền tố; stock/material guard plan16 repeat/delta/shortage rollback; complete200/failing_items không false-success.
- Build/start không DB portal: DATABASE_URL bỏ, chặn networkDBportal vẫn login/tickets/actions qua Python. Restart portal vẫn sessionPython; restartbackend hết session loginlại.
- Browser1440/390 mọi6vai,0JSerror/overflow; giữ UI mới qua ảnh so baseline. Điện thoại thật là gate riêng, không coi viewport thay máy thật.

## §T2. Lệnh và count
Python `python -m pytest tests -q -p no:cacheprovider`; ruff check/format src tests; backend nền tối thiểu3438+proxy3 memory và95pg khi đủmôi trường (recordcounts bằng collect trên frozenbase, không tự suy cộng để giảpass).
Portal `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build` (khôngDATABASE_URL); integrationharness tại evidence/harness/portal_python.mjs.
TestDBlegacy không là bằng chứng workflow mới, không xoá test cũ mà không ghi thay thế/lý do. Lint0errors; warnings khai rõ không tự nói sạch.
Evidence raw stdout/exit/screenshot do máy sinh; RED trên hệ cố tình hỏng ít nhất1lần, ≥3mutants guard/auth/oldDBworkflow; snapshothash phục hồi rồi GREEN.

## §T3. Gate theo môi trường
Local: ✅ SPEC approved / ⬜ boot; ✅ unit/importgraph; ✅ actualPythonE2E; ✅ all6rolebrowser; ✅ buildnoDB; ✅ độc lập+rootremeasure; ✅ docs/version/H-R.
Đo local: Python3441 pass/95pg deselected, portal71 pass, mainbrowser46/46, crossapp9/9, restart5/5, cleaning4/4, extraactions6/6; independent safety17/17. CSS/shell không đổi theo git diff/hash; ảnh sau đổi đã xem, không có baselinebrowser chạy DB cũ để so pixel. Raw evidence trỏ tại plan.md/R03/R05; không suy passDocker/PG/phone từ local.
Docker: ⬜ build/startwithoutportalDB ⬜ web/appsameIDs ⬜ stock/safety/auth/photos ⬜ rollback.
Điện thoại: ⬜ LANlogin/material/photos+cache.
Server: ⬜ chưarollout; không bắt buộc để đóng local, bắt buộc khi được chọn deploy.
ThiếuDocker/Postgres/browser/boot → giữgate chưađạt, không gọi nghiệmthu xong. Signofflocal chỉ khi mọi gatebắtbuộc local+Docker đạt, điệnthoại/server báo riêng.

## §T4. Error/caller
Probe mâu thuẫn report → root phân xử; mutantgreen → testchưađủ; snapshotkhác → dừng dispatch; sharedDB → dừngtest. Cấm fakePASS/skip/xfail hoặc chạy seed/resetdata thật để làmtest xanh.

Bạn là worker của repo này. THẨM ĐỊNH WP3, chỉ đọc, không agent bổ sung.
Bước 0: node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check; thiếu hub ghi exit, không sửa luật.
Thứ tự đọc: memory-distill.txt → index.md → specs/OPERATIONS.md → docs/CR-BPTN-03.md → API/engine liên quan.

## 1. Bối cảnh
Package planning/02_2026-10-03_truong-mvp-prep; hồ sơ demo SIMULATED, chưa runtime/online.
D01 delta+snapshot đã chốt, D02–D07 mặc định; group approval pending.
CURRENT engine chưa CR03 safety/rating-once; không coi target như API có sẵn.

## 2. Phạm vi
CHỈ đọc OPERATIONS, router maintenance, engine, demo và seed fixtures.
Được chạy kiểm local read-only; CẤM sửa source, governance, stage/commit/push/deploy/reset remote.
Không nhận report worker làm bằng chứng; tự đo source.

## 3. Việc phải làm và xong khi
Đối chiếu OPERATIONS §1–§6: route/body/role CURRENT với source; target thiếu phải ghi TARGET BLOCKED.
Kiểm bốn nhóm, happy hai nhánh, Bậc 2 ba lựa chọn, Bậc 1 năm hành động, D01 thiếu location+hazard.
Kiểm setup memory/mock, rollback không remote reset, perstep evidence và local/online gates §7.
Lệnh kiểm: python -c "from pathlib import Path; p=Path('planning/02_2026-10-03_truong-mvp-prep/specs/OPERATIONS.md'); s=p.read_text(encoding='utf-8-sig'); assert all(x in s for x in ['Nhóm 1','Nhóm 2','Nhóm 3','Nhóm 4','TARGET BLOCKED','delta','snapshot']); print('groups=4 target-label=present d01=present')"
Xong khi exit0 + tự đối chiếu từng endpoint/body với AST; không dùng kiểm từ khóa thay runtime.
Cố làm đỏ ≥3 giả định: rating overwrite, safety endpoint bịa, stock resume từ sai bước.
Runtime target/online không chạy, acceptance chỉ readiness; không đóng package.

## 4. Luật
Theo OPERATIONS §1 setup và §6 lỗi/caller/vùng cấm; thiếu hub báo, không viết tay engine governance.
Không raw overwrite, không Agent assignee, không auto-safe; không old raw vào LLM của delta.
Không bịa output execution, evidence chỉ output máy, giữ mọi gate runtime pending.

## 5. Tầng model
WP3 xác minh docs theo source: 🟢; cần quyết định contract mới: 🔴, dừng báo điều phối.
Không tự spawn theo chỉ định; inherited model hiện có, ghi phân công thực tế.

## 6. Report
Dòng 1 khai vai/model/boot exit/hiểu phạm vi; dòng 2–4 Handoff/Base/Head.
Lệnh + exit, test total/pass/fail/skip, diffstat + SHA, bảng tầng/model thực dùng.
Ghi việc chưa làm/lý do; cuối ✅ DUYỆT / 🔁 SỬA: mục / ⛔ DỪNG: lý do.

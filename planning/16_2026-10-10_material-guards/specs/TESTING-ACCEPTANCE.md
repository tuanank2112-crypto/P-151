# Kiểm thử và nghiệm thu

## §T1. File và contract đo

WP1 sở hữu `tests/test_maintenance/test_material_guards.py`, `test_material_usage.py`, `test_material_usage_store.py`. Dùng helpers nền nhưng không sửa chúng nếu chưa root duyệt. Gọi API thật qua TestClient và engine thật; case/store snapshot JSON+stock+ledger+outbox trước/sau.
Các guard engine/API phải tự biết đúng/sai, không kiểm nội dung source text. Missing endpoint có thể RED cho C2 nhưng không đủ RED cho guard: guard phải đỏ vì hệ cũ chấp nhận dữ liệu sai đã tái hiện.

## §T2. Ma trận bắt buộc

| Nhóm | Ca / kết quả |
|---|---|
| Guard phòng ban | Kỹ thuật dùng CLEAN/BAG và Vệ sinh dùng LAMP/STARTER ⇒ từ chối ở legacy/new/direct engine, không đổi kho |
| Kiểu số | 0, âm,0.5,bool,string,NaN/Inf ⇒ từ chối; 1,1.0 ⇒ nhận; ghi stored number hợp lệ |
| Empty | Technical [] ⇒ từ chối và không bypass complete; Cleaning [] ⇒ N_A, hoàn kho đúng khi bỏ dòng |
| Không norm | Norm1 dùng4 ⇒ 200, issued=used=4, không lý do/warning, đủ điều kiện ⇒ READY |
| Idempotent/delta | Save4 lặp ⇒ kho không trừ thêm; 4→2→4, xoá/thay dòng ⇒ chỉ delta |
| Atomic shortage | Đã dùng LAMP-01×4, thay LAMP-02 hết hàng ⇒ plan+stock+ledger+outbox y nguyên |
| Multi-line | Dòng1 đủ, dòng2 thiếu ⇒ không trừ dòng1; success đủ cả hai ⇒ tất cả commit |
| Fail closed | Inject audit/save/second-stock failure ⇒ rollback; dùng Tx thật memory và postgres local |
| Legacy discrepancy | used<issued vẫn needs reason; used>issued từ chối; norm/Agent mismatch không chặn |
| Quyền/state | Wrong actor/dept, terminal/not in progress ⇒ lỗi hiện có, không mutate ticket; auth audit giữ semantics |
| Đồng thời | Hai ticket tranh lượng cuối: tổng đã xuất không vượt stock, ít nhất một bị từ chối; lock/test tất định |
| UI web/app | §U5: một form, không prefill, 1 POST/lần, không hỏi norm reason, repeat/shortage/empty/offline |

## §T3. Lệnh và bằng chứng thật

- `python -m pytest tests -q -p no:cacheprovider` — tránh thu test trong integration; ≥3387 nền + test mới, 0 failed/skip; báo rõ pg deselected.
- `python -m ruff check src tests`; `python -m ruff format --check src tests`; `git diff --check` — exit0.
- `node --check` từng JS thay đổi; report số file thật.
- Postgres: set `MO_TEST_DATABASE_URL` local `*_test`, `python -m pytest tests --pg -q -p no:cacheprovider`; không test DB chung. Không thêm dependency mypy chỉ để giả đáp ứng typecheck: nếu chưa cấu hình, ghi N/A có bằng chứng; portal không đổi logic nên không tự chạy test portal DB.
- `node evidence/harness/material_usage.mjs <base-memory> <portal-dir> <output-dir>` — browser thật, raw output và ảnh. Nếu thiếu Playwright không gọi static/syntax là UI PASS.
- Chạy mutants trên bản clone/snapshot test riêng: bỏ guard department; bỏ integer; bỏ technical-empty; commit partial giữa hai stock; bật lại norm-block. Mỗi mutant phải đỏ ở test chỉ ra lỗi tương ứng; phục hồi hash rồi đo GREEN full suite.

## §T4. Exit gates

| Gate | Local | Docker | Server |
|---|---|---|---|
| G0 SPEC duyệt + baseline frozen + boot | 🟡 SPEC ✅ (D07) · baseline ✅ hash khớp · boot ⬜ hub thiếu | N/A | N/A |
| G1 guard RED→GREEN | ✅ | N/A | N/A |
| G2 transaction memory + pg local | ✅ | ✅ local pg (image backend) | N/A |
| G3 full tests/lint/syntax/diff | ✅ (typecheck N/A) | N/A | N/A |
| G4 browser web + app §U5 | ✅ | ✅ container memory `:8017` | ⬜ chưa deploy |
| G5 auditor độc lập + root đo lại | ✅ (R04 lần 2) | N/A | N/A |
| G6 docs/version/report/evidence | ✅ | N/A | N/A |

Mọi local/Docker gate bắt buộc đạt mới đóng implementation local; hồ sơ ghi rõ server chưa triển khai, không đánh dấu toàn bộ rollout xong. Khi người dùng chọn server, G4 server trở thành bắt buộc trước đóng rollout.

## §T5. Lỗi và hành vi caller

| Lỗi đo | Hành vi |
|---|---|
| Test xanh nhưng probes sai | 🔁, thêm test regression; không đổi requirement để nhận kết quả |
| Mutant vẫn xanh | 🔁 bộ test chưa chứng minh guard; không ghi đạt |
| Code chưa phục hồi sau mutant | ⛔, so hash baseline, restore snapshot rồi full rerun |
| Một lỗi cũ | Đo tách trên baseline; không tự xfail/skip, root quyết phạm vi |

CẤM sửa evidence raw tay, giảm test nền, bỏ gate trình duyệt, dùng report worker làm nguồn PASS thay phép đo của reviewer.

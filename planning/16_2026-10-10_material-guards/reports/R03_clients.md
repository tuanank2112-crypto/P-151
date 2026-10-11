Vai ORCHESTRATOR (root kiêm WP3) · thi công · Claude/Opus 5.5 · Bước 0 exit 1 (hub thiếu) · phạm vi: `src/web/`, `src/mobile/`, harness plan 16; xong khi web + app một form, 1 POST/lần bấm, không prefill Agent, harness trình duyệt thật đạt; cấm mapping vật tư trong JS, POST nhiều lần, đổi portal.
Handoff: H03_clients.md
Base: 71315109d845fe69935050b09d4ab4c67efb024a + baseline.txt (app.js 2fb9b755…, dept.js 59ab4f6a…)
Head: 71315109d845fe69935050b09d4ab4c67efb024a + `git diff HEAD | sha256sum` = 08a8c2abb8f501acab0e9fe75648f9116009118a9391a99cc7451d6ee565d056 (app.js feae55d7…, dept.js a17a2084…)

## Lệnh và số đo

| Lệnh | Exit | Kết quả | Evidence |
|---|---|---|---|
| `node --check` 13 file (web + 10 app + sw + harness) | 0 | ok=13 | `evidence/wp2/lint.txt` |
| `node evidence/harness/material_usage.mjs http://127.0.0.1:8016 portal …` (uvicorn host, MO_STORE=memory) | 0 | 38 PASS / 0 FAIL, 6 ảnh | `evidence/wp3/ui_harness.txt`, `evidence/wp3/screens/` |
| `docker compose build backend` | 0 | image p151-backend built | `evidence/wp3/docker_build.txt` |
| harness với container memory riêng `:8017` (image build lại sau sửa R04, không `.env`) | 0 | 42 PASS / 0 FAIL, 6 ảnh | `evidence/wp3/ui_harness_docker.txt`, `evidence/wp3/screens_docker/` |

Ca harness mỗi bề mặt (app 390px, web 1440px): không chữ Agent/đề xuất/định mức/lý do · chưa lưu khi mới nhận · một dòng rỗng qty 1 · danh sách đúng phòng ban · rỗng chặn trước POST (0 POST) · 4 bóng norm 1 ⇒ 1 POST, 4/4/4, kho −4 · lưu lặp ⇒ kho không đổi · LAMP-01 + LAMP-02 (hết) ⇒ 409, ticket + kho y nguyên, input giữ · Vệ sinh chọn rồi "Không sử dụng" ⇒ 1 POST `lines: []`, N_A, hoàn kho · 0 lỗi JS · không tràn ngang.

## Diff
Web: `materialsCard` thay `materialPlanCard` + form từng dòng; precheck dùng `materialsSaved`; `failingLabel` thêm 2 mục; Gate 3 bỏ chữ "định mức"; `app.js?v=4.4`. App: bỏ `MATERIAL_GROUP`; lọc theo `material_codes_by_department` (thiếu ⇒ khoá Lưu); 1 POST `material-usage`; lỗi không reload; `?v=17` + `mo-app-shell-v17` mọi import. Harness Q41/Q42 plan 11 gắn dòng OBSOLETE đầu file.

## Phân công thực tế
| Gói | Tầng yêu cầu | Họ/model |
|---|---|---|
| Web/app theo SPEC-P02 | 🟠 | Claude Opus 5.5 (lên tầng) |
| Harness | 🟠 | Claude Opus 5.5 |

## Không làm / lý do
- Không chạy G4 server: chưa deploy (cần quyết định người dùng, OPERATIONS §O4).
- Không recreate container `:8000` (nối Supabase chung, OPERATIONS §O3) — đo Docker bằng container memory riêng `:8017` cùng image.
- Test offline thật trên điện thoại: nút đã khoá khi `navigator.onLine === false` (helper sẵn có); chưa đo trên máy thật.

## Sửa sau R04 (🔁 F3, F4)
| Lỗi | Sửa | RED trước sửa | GREEN sau sửa |
|---|---|---|---|
| F3 app tự tải lại 30 s xoá lựa chọn sau 409 | `dept.js`: khối vật tư đặt `data-dirty="1"` khi input/change/thêm/bỏ dòng ⇒ `screenIsDirty()` dừng refresh | `app-T5-kept-after-refresh` FAIL (`evidence/wp3/ui_harness_red_f3f4.txt`) | PASS (`ui_harness_docker.txt`); `ui_probe.mjs` của auditor `app U3b` HELD (`r04_ui_probe_recheck.txt`) |
| F4 `applyOnline()` bật lại nút Lưu khi thiếu mapping | bỏ `data-write` khỏi nút khi thiếu `material_codes_by_department` | `app-T8-old-server-disabled` FAIL | PASS; `app U7` HELD |
Web không đổi (đạt từ đầu). `?v=17` giữ nguyên: bản v17 chưa phát hành ở đâu.

## Câu hỏi cần người
Không.

✅ DUYỆT

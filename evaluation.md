# Evaluation Evidence — MaintenanceOps

Cập nhật: 2026-10-17 · Commit đo: `acf772a4f272` · Python 3.12.2 · Người chạy: Châm Anh
Số liệu gốc: [run eval-dev-20261016T231532Z](docs/eval/runs/eval-dev-20261016T231532Z/) (`report.md`, `metrics.json`, `traces.jsonl`, `manifest.json`).

> **Đọc trước.** Mọi số ở §3–§4 đo trên **nhãn do chính tác giả luật viết (dev)**, không độc lập. Chúng chứng minh "không hồi quy", **không** chứng minh "đúng với dữ liệu ngoài". Bộ held-out hai người gán nhãn ([heldout_labels.csv](tests/test_maintenance/data/heldout_labels.csv)) hiện **chỉ có dòng tiêu đề, 0 dòng dữ liệu**, nên chưa có số held-out nào. Chưa có số đo LLM thật, latency, chi phí.

## 1. Cách đo

Một lệnh, một run, bốn tệp bằng chứng, không gọi model, không gọi mạng:

```bash
PYTHONUTF8=1 python scripts/eval_labels.py --dev   # nhãn dev (hồi quy)
PYTHONUTF8=1 python scripts/eval_labels.py         # nhãn held-out (CSV 2 người gán)
```

| Hạng mục | Giá trị |
|---|---|
| Đối tượng đo | Engine luật cố định: `src.maintenance.safety.assess` (an toàn) và `src.maintenance.rules.classify` (phân loại). `LLM_MODE=mock` |
| Hai khung | **Khung 1 — an toàn** (Bậc 1 `EMERGENCY` / Bậc 2 `UNCLEAR` / `NONE`) · **Khung 2 — phân loại** (`CLN` / `TEC` / `OUT` / `UNCLEAR`) — CR-BPTN-03 §15 |
| Chỉ tính dòng "gold" | Dòng chỉ được tính khi **hai người gán nhãn trùng nhau** (`a == b`). Nhãn dev gán `a = b` nên agreement luôn 1.000, **không có ý nghĩa** |
| Nhãn nhiều đáp án | Dòng có tập chấp nhận (`expect_any`) tính đúng nếu kết quả nằm trong tập |
| Cổng (gate) | Chỉ 2 chỉ số có cổng: Bậc 1 recall = 1.000 và Bậc 1 bỏ sót = 0. Còn lại chỉ báo cáo |
| Mã thoát | 0 = đạt mọi cổng (held-out: cần ≥ 40 dòng) · 1 = trượt cổng · 2 = không đủ dữ liệu để quyết |
| Truy vết | `manifest.json` ghi commit, hash 16 ký tự của từng tệp đầu vào, phiên bản Python. `traces.jsonl` ghi từng câu: nhãn, kết quả engine, tín hiệu đã bắn |

Nguồn dữ liệu dev (manifest ghi hash):
[safety_cases_p0.yaml](tests/test_maintenance/data/safety_cases_p0.yaml) · [safety_cases_p1.yaml](tests/test_maintenance/data/safety_cases_p1.yaml) · [seed/maintenance_cr03/safety_cases.json](seed/maintenance_cr03/safety_cases.json) · [test_classify_metamorphic.py](tests/test_maintenance/test_classify_metamorphic.py) (CORPUS phân loại).

## 2. Tình trạng các bộ đo

| Bộ đo | Dữ liệu | Kết quả | Mã thoát | Ghi chú |
|---|---|---|---|---|
| `eval_labels.py --dev` | 438 câu an toàn, 151 câu phân loại | Xem §3–§4 | 0 | Hồi quy, nhãn không độc lập |
| `eval_labels.py` (held-out) | 0 dòng | **Chưa đo** | 2 ("Chưa có dòng nào đủ 2 nhãn") | Cần nhãn của Trường + người review |
| `eval_hard_cases.py` | 64 câu khó (adversarial + unicode) | 51 đúng, 13 sai, **13/13 là lỗi đã biết, 0 lỗi mới** | 0 | Xem §5 |
| `pytest tests -q -x` | 349 pass, 14 xfail, 102 deselected, **1 fail** (dừng ở lỗi đầu tiên, chưa chạy hết) | 1 | Lỗi: `test_auth_tokens.py::test_serverless_mode_keeps_no_database_connection`. Chưa điều tra nguyên nhân |
| Kiểm thử thủ công UI | 9 ca, localhost, mock | 8 PASS, 1 BLOCKED | – | Giữ nguyên ở Phụ lục A |
| `agent_live_eval.py` (G-LIVE, LLM thật) | – | **Chưa chạy trong đợt này** | – | Cần key và chi phí; xem §6 |

## 3. Khung 1 — An toàn (n = 438 câu)

| Chỉ số | Giá trị | n | Mục tiêu | |
|---|---|---|---|---|
| Bậc 1 recall (gold EMERGENCY → EMERGENCY) | 1.000 | 219 | 1.000 | ✅ cổng |
| Bậc 1 bỏ sót (đếm) | 0 | 219 | 0 | ✅ cổng |
| Báo động nhầm → Bậc 1 (gold NONE → EMERGENCY) | 0.000 | 152 | báo cáo | |
| Báo động nhầm → bất kỳ cảnh báo (NONE → Bậc 1 hoặc 2) | 0.000 | 152 | báo cáo | |
| Bậc 2 recall (gold UNCLEAR → Bậc 1 hoặc 2) | 1.000 | 33 | báo cáo | |
| Khớp chính xác (dòng một nhãn) | 0.993 (401/404) | 404 | báo cáo | |
| Dòng có tập chấp nhận, nằm trong tập | 1.000 | 34 | báo cáo | |

Theo nhóm dữ liệu:

| Nhóm | Khớp (đúng hoặc trong tập) | n |
|---|---|---|
| `p0` | 1.000 | 265 |
| `p1_catch` | 1.000 | 74 |
| `p1_not_raise` | 1.000 | 31 |
| `regression` | 1.000 | 34 |
| `cr03_json` | **0.912** (31/34) | 34 |

**3 câu lệch, đều ở nhóm `cr03_json` và đều theo hướng an toàn (nâng mức cao hơn nhãn, không hạ thấp):**

| ID | Câu | Nhãn | Engine | Tín hiệu |
|---|---|---|---|---|
| P0-012 | "Hôm qua có tia lửa" | UNCLEAR | EMERGENCY | S-02 |
| P0-025 | "Chất lỏng gây ngạt mũi" | UNCLEAR | EMERGENCY | S-09, T2-05 |
| P0-029 | "Chất lạ nhưng không cay mắt" | UNCLEAR | EMERGENCY | S-14 |

Ý nghĩa: luật cố định không hiểu thì giờ ("hôm qua") hay phủ định ("không cay mắt"). Việc này thuộc phần Agent suy luận. Luật cố định chỉ làm sàn an toàn.

## 4. Khung 2 — Phân loại (n = 151 câu)

| Lớp | Precision | Recall | F1 | n (gold) |
|---|---|---|---|---|
| CLN (vệ sinh) | 1.000 | 1.000 | 1.000 | 43 |
| TEC (kỹ thuật) | 1.000 | 1.000 | 1.000 | 51 |
| OUT (ngoài phạm vi) | 1.000 | 1.000 | 1.000 | 40 |
| UNCLEAR | 1.000 | 1.000 | 1.000 | 17 |
| **Accuracy** | **1.000** | | | 151 |

**Không dùng con số 1.000 này làm bằng chứng chất lượng.** CORPUS do chính tác giả luật viết cho test metamorphic, mọi câu được thêm tiền tố vị trí cố định `Hành lang tầng 3 tòa S1: `. Kết quả hoàn hảo là điều được mong đợi trên tập tự viết.

## 5. Câu khó (`eval_hard_cases.py`, 64 câu)

| Độ khó | Đúng | Tổng |
|---|---|---|
| easy | 8 | 9 |
| medium | 22 | 26 |
| hard | 21 | 29 |
| **Tổng** | **51** | **64** |

13 câu sai đều đã gắn cờ `known_bug` (0 lỗi mới). Các nhóm lỗi:

- **An toàn, bỏ sót (nguy hiểm nhất):** a04 (chữ tách "m ù i k h é t"), a13 (thang máy kẹt có trẻ em), u09 (Unicode tổ hợp "Khо́i"), u10 ("k.h.é.t") → ra `NONE`; a14 → `UNCLEAR` thay vì `EMERGENCY`.
- **An toàn, báo nhầm:** c08 (hút thuốc ở cầu thang) → `EMERGENCY`.
- **Phân loại:** c01 (phủ định "không có mùi khét"), c03 (không dấu "chay roi"), e02 (viết tắt) → `OUT`; e03 → `CLN` thay vì `UNCLEAR`.
- **Mức ưu tiên / vị trí:** e05, f05, u11 (chữ số và chữ cái fullwidth).

Đây là giới hạn đã biết của luật cố định. Các lỗi bỏ sót an toàn là lý do tầng Agent suy luận tồn tại và phải được đo bằng G-LIVE.

## 6. Chưa đo (ghi trung thực)

| Hạng mục | Lý do | Việc cần làm |
|---|---|---|
| Held-out độc lập | CSV rỗng | Trường + người review gán nhãn ≥ 40 dòng/khung rồi chạy `eval_labels.py` không cờ |
| Chất lượng LLM thật / G-LIVE | Chưa chạy trong đợt này | `scripts/agent_live_eval.py`, lưu kết quả từng câu |
| Latency p50/p95, chi phí mỗi ca | Chưa có lượt LLM thật có mục đích | Đo cùng G-LIVE; code đã ghi latency từng lời gọi ra JSONL (`a0ce382`, `acf772a`) |
| Bản online | Chưa deploy | Lặp lại bộ ca UI trên Live URL, kèm R01 với `MO_STORE=postgres` |
| Phản hồi người dùng thật | Chưa có | Ghi số thật, không dùng phản hồi giả |
| Phoenix trace | Chưa có | Trí xuất 5–10 trace |

Số đo này **chỉ có giá trị cho commit `acf772a4f272`**. Đổi luật hoặc dữ liệu thì chạy lại. Hai run dev (15/10 và 16/10) cho `metrics.json` giống hệt nhau.

## 7. Cách chạy lại

```bash
PYTHONUTF8=1 python scripts/eval_labels.py --dev      # ghi docs/eval/runs/eval-dev-<UTC>/
PYTHONUTF8=1 python scripts/eval_hard_cases.py        # bảng câu sai, mã thoát 0 nếu không có lỗi mới
python -m pytest tests -q                             # test đơn vị
```

---

# Phụ lục A — Kiểm thử thủ công 04/10 (giữ nguyên bản gốc)

Lượt UI của Cao Văn Trường, localhost, `LLM_MODE=mock`, `MO_STORE=memory`. Là kết luận lịch sử, chưa đo lại trên build hiện tại. Các tệp khác (day04-report, README nộp bài) đang trỏ vào phần này.


Người thực hiện: Cao Văn Trường · Ngày chạy: 2026-10-04 (22:25 → 23:33, Asia/Saigon)
Ảnh bằng chứng: [planning/07_2026-10-04_online-acceptance/evidence/ui/](planning/07_2026-10-04_online-acceptance/evidence/ui/)

### 1. Môi trường đo

| Hạng mục | Giá trị |
|---|---|
| Địa chỉ | `http://localhost:8000` (uvicorn, chạy trên máy cá nhân), giao diện `/ui/`, Swagger `/docs` |
| Loại | **Localhost, KHÔNG phải online** |
| LLM | `LLM_MODE=mock` (chỉ luật cố định; không đo chất lượng LLM thật) |
| Lưu trữ | `MO_STORE=memory` (restart mất dữ liệu) |
| Dữ liệu | Fixture mô phỏng `SIM-*`; tài khoản demo `cudan01`, `bptn01`, `vesinh01`, `kythuat01`, `bql01` |
| Cách thao tác | Ca H01, I01, U01, S04 bằng giao diện web; ca G03 bằng Swagger (UI ẩn nút sai quyền nên không bấm sai được) |

### 2. Tổng hợp

| # | Ca | Nhóm | Kết quả | Ticket |
|---|---|---|---|---|
| 1 | H01 — Happy path vệ sinh | Luồng chính | **PASS** | SIM-TKT-0001 |
| 2 | I01 — Thiếu thông tin | Thiếu dữ liệu | **PASS** | SIM-TKT-0003 |
| 3 | U01 — Phản ánh trùng | Trùng | **PASS** | SIM-TKT-0005 (trùng 0004) |
| 4 | S04 — Khẩn cấp Bậc 1, BQL đóng | An toàn | **PASS** | SIM-TKT-0006 |
| 5 | G03 — Sai quyền bị từ chối | Guard | **PASS** | SIM-TKT-TEC-005 |
| 6 | H02 — Happy path đèn | Luồng chính | **PASS** | SIM-TKT-0002 |
| 7 | A01 — Asset chưa rõ | Thiếu dữ liệu | **PASS** | SIM-TKT-TEC-002 |
| 8 | M01 — Thiếu vật tư, kho nhập | Vật tư | **PASS** | SIM-TKT-TEC-003 |
| 9 | R01 — Dữ liệu sau restart | Lưu bền | **BLOCKED_MEMORY_STORE** | — |

**Theo phạm vi9 ca đã chốt ngày07/10:** lượt UI lịch sử báo cáo8 PASS · 0 FAIL · 1 BLOCKED (R01). Sáu ca ngoài phạm vi đã bỏ theo yêu cầu người dùng, không tính là việc còn nợ. Đây là kết luận lịch sử, chưa đo lại trên build hiện tại. Hồ sơ chuẩn tách từng lượt tại [manifest](planning/07_2026-10-04_online-acceptance/deliverables/manifest.json), [results](planning/07_2026-10-04_online-acceptance/deliverables/results.json), [issues](planning/07_2026-10-04_online-acceptance/deliverables/issues.json).

---

### 3. Chi tiết từng ca

#### TC-01 · H01 — Happy path vệ sinh
- **Mục tiêu:** cư dân gửi → giao đúng phòng ban → phòng ban xử lý → BQL nghiệm thu đóng → cư dân thấy timeline đúng.
- **Dữ liệu vào (cudan01):** `Hành lang tầng 3 tòa SIM-A có nhiều rác và vết bẩn, cần vệ sinh`
- **Expected:** `ROUTED` sang Phòng Vệ sinh; qua `Đang xử lý` → `Chờ nghiệm thu` → `Hoàn thành`; có audit.
- **Output thực tế:**
  - Ticket `SIM-TKT-0001`, gửi 22:25 4/10/26. Giao `Phòng Vệ sinh` (DEP-CLN, playbook `PB-CLN-01`). Agent: độ tin cậy 95%, lý do "Nội dung khớp phản ánh vệ sinh khu vực chung". Vị trí nhận diện: Tòa SIM-A / Tầng 3 / Hành lang. Kiểm tra trùng: "Độc lập".
  - Lịch sử trạng thái (5 mục): `Đã tiếp nhận` 22:25 → `Đã chuyển phòng ban` 22:25 (cờ "Ngoài giờ phòng ban", "Phản ánh sẽ được xử lý từ 06:00 05/10/2026") → `Đang xử lý` 22:29 (Phòng ban) → `Chờ nghiệm thu` 22:29 (ghi chú "Đối soát đạt") → `Hoàn thành` 22:32 (BQL).
  - Nhật ký kiểm toán: 16 sự kiện.
  - Timeline phía cư dân: đủ 6 mốc, trạng thái cuối "Hoàn thành — Phản ánh đã hoàn thành."
- **Kết quả:** PASS.
- **Bằng chứng:** [H01_01](planning/07_2026-10-04_online-acceptance/evidence/ui/H01_01_cudan01_gui-phan-anh.png), [H01_02](planning/07_2026-10-04_online-acceptance/evidence/ui/H01_02_vesinh01_nhan-ticket.png), [H01_03](planning/07_2026-10-04_online-acceptance/evidence/ui/H01_03_vesinh01_checklist-anh.png), [H01_04](planning/07_2026-10-04_online-acceptance/evidence/ui/H01_04_vesinh01_bao-hoan-thanh.png), [H01_05](planning/07_2026-10-04_online-acceptance/evidence/ui/H01_05_bql01_nghiem-thu-dong.png), [H01_06](planning/07_2026-10-04_online-acceptance/evidence/ui/H01_06_cudan01_timeline-cuoi.png)

#### TC-02 · I01 — Thiếu thông tin
- **Mục tiêu:** ticket thiếu địa điểm dừng ở chờ bổ sung; BPTN bổ sung đủ thì đi tiếp; nội dung gốc giữ nguyên.
- **Dữ liệu vào (cudan01):** `Hanh lang tang 3 nhieu rac` (không dấu, không nêu tòa)
- **Expected:** trạng thái thiếu thông tin → sau bổ sung đi tiếp `ROUTED`; raw không bị sửa.
- **Output thực tế:**
  - Ticket `SIM-TKT-0003`, gửi 23:01. Trạng thái "Chờ bổ sung thông tin", Phòng ban "Chưa giao". Thông báo cho cư dân (nguyên văn): "Ban tiếp nhận thông tin sẽ liên hệ bạn để bổ sung: tòa (ghi kèm chữ "tòa", ví dụ: tòa SIM-A). Bạn cũng có thể bổ sung ngay tại đây."
  - BPTN bổ sung (23:03), sau đó ticket "Đã chuyển phòng ban", Phòng Vệ sinh. Vị trí hiển thị "Tòa SIM-A tầng 3". Mục "THÔNG TIN BỔ SUNG": "Hành lang có nhiều rác và vết bẩn".
  - Nội dung gốc vẫn là `Hanh lang tang 3 nhieu rac` (nhãn "KHÔNG THỂ SỬA").
  - Phía phòng ban: ticket vào hàng đợi `Ngoài giờ phòng ban`, "Chạy lại từ: Bước 8".
- **Kết quả:** PASS.
- **Bằng chứng:** [I01_01](planning/07_2026-10-04_online-acceptance/evidence/ui/I01_01_cudan01_thieu-thong-tin.png), [I01_02](planning/07_2026-10-04_online-acceptance/evidence/ui/I01_02_bptn01_hang-cho.png), [I01_03](planning/07_2026-10-04_online-acceptance/evidence/ui/I01_03_bptn01_gui-bo-sung.png), [I01_04](planning/07_2026-10-04_online-acceptance/evidence/ui/I01_04_ket-qua.png)

#### TC-03 · U01 — Phản ánh trùng
- **Mục tiêu:** phản ánh trùng bị giữ lại cho BPTN quyết định; nhánh "không gộp" cho ticket đi tiếp.
- **Dữ liệu vào (cudan01):** `Hành lang tầng 3 tòa SIM-A có nhiều rác và vết bẩn, cần vệ sinh.` gửi hai lần (23:08).
- **Expected:** ticket thứ hai `VERIFYING` / nghi trùng, chưa giao phòng ban; BPTN chọn "Không trùng" → đi tiếp.
- **Output thực tế:**
  - Cư dân thấy: "Đang kiểm tra phản ánh có trùng với phản ánh khác không.", Phòng ban "Chưa giao".
  - BPTN thấy `SIM-TKT-0005`: "Đang dừng: Nghi trùng", người gỡ BPTN, chạy lại từ Bước 5, ghi chú nội bộ "Cùng vị trí và loại với SIM-TKT-0004 trong 2 days, 0:00:00". Hai nút: **Gộp vào SIM-TKT-0004** và **Không trùng, xử lý tiếp**.
  - Sau khi bấm "Không trùng, xử lý tiếp": `SIM-TKT-0005` ở trạng thái "Đã chuyển phòng ban" (Phòng Vệ sinh), cờ "Ngoài giờ phòng ban".
- **Kết quả:** PASS.
- **Bằng chứng:** [U01_01](planning/07_2026-10-04_online-acceptance/evidence/ui/U01_01_cudan01_nghi-trung.png), [U01_02](planning/07_2026-10-04_online-acceptance/evidence/ui/U01_02_bptn01_canh-bao-trung.png), [U01_03](planning/07_2026-10-04_online-acceptance/evidence/ui/U01_03_bptn01_khong-gop.png), [U01_04](planning/07_2026-10-04_online-acceptance/evidence/ui/U01_04_ket-qua.png)

#### TC-04 · S04 — Khẩn cấp Bậc 1, BQL đóng
- **Mục tiêu:** phản ánh có dấu hiệu nguy hiểm dừng chờ BQL, không giao phòng ban; BQL đóng khẩn cấp có ghi chú và audit.
- **Dữ liệu vào (cudan01):** `Đèn sảnh thang máy tầng 5 tòa SIM-A không sáng, có tia lửa và mùi khét ở hộp đèn.`
- **Expected:** `VERIFYING` / `EMERGENCY_PENDING_BQL`, BQL thấy đúng 2 lựa chọn; đóng → `CLOSED`.
- **Output thực tế:**
  - Ticket `SIM-TKT-0006`, gửi 23:15. Cư dân thấy "Phản ánh đang được kiểm tra.", Phòng ban "Chưa giao" (không lộ chữ "Bậc 1" hay mã nội bộ).
  - BQL lọc "Chỉ sự cố Khẩn cấp (Bậc 1)": thấy khung "SỰ CỐ KHẨN CẤP BẬC 1 (Chờ BQL can thiệp)" với **đúng 2 lựa chọn**: "Đã xử lý tại chỗ, đóng ticket" (nút **Đã xử lý, đóng khẩn cấp**) và "Báo nhầm, hạ xuống BPTN" (nút **Hạ mức xuống BPTN**). Cả hai bắt buộc ghi chú.
  - BQL đóng, ghi chú "Đã ngắt điện hộp đèn và kiểm tra an toàn tại chỗ". Lịch sử: `Hoàn thành` 23:18, BQL. Cư dân thấy "Hoàn thành" 23:18 và có form đánh giá "1 lần duy nhất".
  - Danh sách BQL sau đó: ticket khẩn cấp còn lại (`SIM-TKT-TEC-005`) vẫn "Đang xác minh", không bị ảnh hưởng.
- **Kết quả:** PASS.
- **Bằng chứng:** [S04_01](planning/07_2026-10-04_online-acceptance/evidence/ui/S04_01_cudan01_trang-thai.png), [S04_02](planning/07_2026-10-04_online-acceptance/evidence/ui/S04_02_bql01_lua-chon.png), [S04_03](planning/07_2026-10-04_online-acceptance/evidence/ui/S04_03_bql01_ket-qua.png), [S04_04](planning/07_2026-10-04_online-acceptance/evidence/ui/S04_04_bql01_audit.png)

#### TC-05 · G03 — Sai quyền bị từ chối
- **Mục tiêu:** vai không có quyền bị backend từ chối và trạng thái ticket không đổi.
- **Cách làm:** Swagger `/docs`, hai lệnh phủ định trên ticket khẩn cấp `SIM-TKT-TEC-005`.
- **Output thực tế:**

| Bước | Lệnh | HTTP | Nội dung phản hồi chính |
|---|---|---|---|
| 1 | `bptn01`: `POST /api/v1/bql/tickets/SIM-TKT-TEC-005/emergency/downgrade` `{"note":"thu quyen"}` | **403** | `code: ACTION_DENIED`, message "BPTN không được EMERGENCY_DOWNGRADE", `actor_role: BPTN`, `audit_event_id: SIM-AUD-TEC-005-0003`, `unchanged_status: VERIFYING` |
| 2 | `vesinh01`: `POST /api/v1/mo/tickets/SIM-TKT-TEC-005/accept` | **403** | `code: ACTION_DENIED`, message "Ticket không thuộc phòng ban của SIM-ACTOR-DEPT-CLN-01", `actor_role: DEPARTMENT`, `audit_event_id: SIM-AUD-TEC-005-0004` |

- **Trạng thái sau thử:** phản hồi bước 1 ghi `unchanged_status: VERIFYING`; danh sách BQL sau đó vẫn hiện `SIM-TKT-TEC-005` ở "Đang xác minh" (Khẩn cấp Bậc 1).
- **Kết quả:** PASS. Cả hai lần đều có audit event.
- **Bằng chứng:** [G03_01](planning/07_2026-10-04_online-acceptance/evidence/ui/G03_01_bptn-ha-bac1-403.png), [G03_02](planning/07_2026-10-04_online-acceptance/evidence/ui/G03_02_phong-sai-accept-403.png), [G03_03](planning/07_2026-10-04_online-acceptance/evidence/ui/G03_03_khong-thay-doi.png)

#### TC-06 · H02 — Happy path đèn
- **Mục tiêu:** luồng đèn qua Phòng Kỹ thuật: giao đúng phòng, khớp tài sản, vật tư, ảnh sau xử lý, BQL nghiệm thu, cư dân thấy timeline.
- **Dữ liệu vào (cudan01):** `Đèn hành lang tầng 3 tòa SIM-A không sáng từ tối qua.`
- **Expected:** `ROUTED` sang Phòng Kỹ thuật; hoàn tất checklist, vật tư và ảnh; `Chờ nghiệm thu` → `Hoàn thành`; Agent không gán nhân viên.
- **Output thực tế:**
  - Ticket `SIM-TKT-0002`, gửi 22:37 4/10/26. Giao `Phòng Kỹ thuật` (DEP-TEC, playbook `PB-TEC-01` "Kỹ thuật chiếu sáng"). Agent: độ tin cậy 95%. Vị trí: Tòa SIM-A / Tầng 3 / Hành lang. Tài sản `SIM-ASSET-LIGHT-001` (Khớp). Vật tư "Bóng đèn LED T8 1.2m (1 chiếc)": "Sẵn sàng trong kho". Kiểm tra trùng: "Độc lập".
  - Phòng ban: checklist 3/3 hoàn thành; vật tư "Bóng đèn LED mô phỏng · dự kiến 1 · định mức 1", Đã xuất 1, Đã dùng 1, trạng thái "Đã lưu"; 1 ảnh sau xử lý (bắt buộc).
  - Lịch sử (cư dân): `Đã tiếp nhận` 22:37 → `Đã chuyển phòng ban` 22:37 (cờ "Ngoài giờ phòng ban", "xử lý từ 06:00 05/10/2026") → `Đang xử lý` 22:39 → `Chờ nghiệm thu` 22:40 → `Hoàn thành` 22:42.
  - BQL thấy "Đối chiếu hiện trường Trước & Sau": 0 ảnh trước, 1 ảnh sau; "Số lần làm lại: 0".
- **Kết quả:** PASS.
- **Bằng chứng:** [H02_01](planning/07_2026-10-04_online-acceptance/evidence/ui/H02_01_cudan01_phan_anh.png), [H02_02](planning/07_2026-10-04_online-acceptance/evidence/ui/H02_02_kythuat01_nhan_ticket.png), [H02_03](planning/07_2026-10-04_online-acceptance/evidence/ui/H02_03_kythuat01_checklist-anh.png), [H02_04](planning/07_2026-10-04_online-acceptance/evidence/ui/H02_04_kythuat01_bao-hoan-thanh..png), [H02_05](planning/07_2026-10-04_online-acceptance/evidence/ui/H02_05_bql01_nghiem-thu-dong.png), [H02_06](planning/07_2026-10-04_online-acceptance/evidence/ui/H02_06_cudan01_timeline-cuoi.png)

#### TC-07 · A01 — Asset chưa rõ
- **Mục tiêu:** BPTN xác nhận kiểm tra tại hiện trường, không bịa mã asset; ticket giao Kỹ thuật với cờ phù hợp.
- **Dữ liệu vào:** ticket mẫu `SIM-TKT-TEC-002` "Đèn cầu thang bộ tầng 9 tòa SIM-A bị hỏng, không sáng." (`bptn01` đánh dấu xác định tại hiện trường).
- **Expected:** blocker "Chưa xác định tài sản" gỡ bằng quyền BPTN → `ROUTED` Phòng Kỹ thuật, cờ `ASSET_CHECK_ONSITE`.
- **Output thực tế:**
  - Trước: "Đang dừng: Chưa xác định tài sản", người gỡ BPTN, chạy lại từ Bước 6, ghi chú nội bộ "Không có asset LIGHTING tại vị trí"; điều kiện giao phòng ban: Tài sản "chưa xác định (chưa đạt)".
  - Sau khi BPTN xác nhận: thông báo "Đã xác định tài sản"; ticket "Đã chuyển phòng ban" ở Phòng Kỹ thuật (`kythuat01`), chip "Kiểm tra tài sản tại hiện trường" và cảnh báo `ASSET_CHECK_ONSITE`: "BPTN chưa xác định được mã thiết bị trong sổ tài sản BMS. Kỹ thuật viên cần khảo sát...".
- **Kết quả:** PASS.
- **Bằng chứng:** [A01_01](planning/07_2026-10-04_online-acceptance/evidence/ui/A01_01_bptn01_asset-chua-ro.png), [A01_02](planning/07_2026-10-04_online-acceptance/evidence/ui/A01_02_bptn01_xac-nhan-onsite.png) (chụp thông báo "Đã xác định tài sản", nhưng trang hiển thị là ticket khác), [A01_03](planning/07_2026-10-04_online-acceptance/evidence/ui/A01_03_ket-qua.png)

#### TC-08 · M01 — Thiếu vật tư, kho nhập
- **Mục tiêu:** ticket thiếu vật tư dừng chờ; kho nhập đủ thì ticket tự chạy tiếp, không giao trùng; nhập chưa đủ vẫn dừng.
- **Dữ liệu vào:** ticket mẫu `SIM-TKT-TEC-003` "Bóng đèn hành lang tầng 2 tòa SIM-B không hoạt động." — cần 2 bóng đèn tuýp mô phỏng, tồn 0; `kho01` nhập qua màn "Nhập kho vật tư" **hai lần: 1 rồi 1** (11:32 và 11:34 theo thời gian lưu ảnh; ô Số lượng hiển thị 5 trong ảnh là giá trị mặc định của form).
- **Output thực tế:**
  - Trước: "Tạm hoãn", "Đang dừng: Chờ vật tư", người gỡ Kho, chưa giao (đề xuất Phòng Kỹ thuật), ghi chú nội bộ "Tồn kho mô phỏng không đủ vật tư dự kiến"; màn Kho: "Vật tư cần cho SIM-TKT-TEC-003: cần 2 · tồn 0".
  - Sau khi nhập: thông báo "Đã nhập kho; 1 phản ánh chạy tiếp"; màn Kho "0 phản ánh chờ vật tư"; ticket "Đã chuyển phòng ban" ở Phòng Kỹ thuật, tài sản `SIM-ASSET-LIGHT-004` (Khớp), vật tư "Sẵn sàng trong kho"; lịch sử 11:34 5/10/26 "Phản ánh đã được chuyển tới Phòng Kỹ thuật" (ghi chú "Gỡ WAITING_MATERIAL"); nhật ký kiểm toán 10 sự kiện.
- **Kết quả:** PASS. Nhập 1 (tồn 1/2): ticket vẫn "Tạm hoãn" (M01_03, 11:33); nhập thêm 1 (đủ): tự giao Phòng Kỹ thuật (M01_04–M01_05, 11:34). Hạn chế: (a) thông báo "Đã nhập kho; 1 phản ánh chạy tiếp" xuất hiện trên ảnh M01_02 dù lúc đó ticket vẫn tạm hoãn — chưa giải thích được; (b) "chạy lại không giao trùng" chỉ quan sát qua danh sách BQL có một bản ghi `SIM-TKT-TEC-003`, chưa gọi resume lần hai.
- **Bằng chứng:** [M01_01](planning/07_2026-10-04_online-acceptance/evidence/ui/M01_01_bql01_cho-vat-tu.png), [M01_02](planning/07_2026-10-04_online-acceptance/evidence/ui/M01_02_kho01_nhap-1.png), [M01_03](planning/07_2026-10-04_online-acceptance/evidence/ui/M01_03_van-tam-hoan.png), [M01_04](planning/07_2026-10-04_online-acceptance/evidence/ui/M01_04_kho01_nhap-du.png), [M01_05](planning/07_2026-10-04_online-acceptance/evidence/ui/M01_05_da-giao.png)

#### TC-09 · R01 — Dữ liệu sau restart
- **Mục tiêu:** đối chiếu ticket/ảnh/audit sau restart server.
- **Cấu hình xác nhận:** `.env` có `MO_STORE=memory`, `LLM_MODE=mock` (kết quả `Select-String` do người thực hiện chạy).
- **Expected (SPEC OPERATIONS §3):** với `memory`, mất dữ liệu sau restart là giới hạn dự kiến; R01 ghi `BLOCKED_MEMORY_STORE`, không ghi PASS lưu bền, không ghi FAIL.
- **Quan sát:** các ticket tạo tối 4/10 (ví dụ `SIM-TKT-0001`, `0002`, tồn tại lúc 22:42 theo [H01_06](planning/07_2026-10-04_online-acceptance/evidence/ui/H01_06_cudan01_timeline-cuoi.png) và [H02_06](planning/07_2026-10-04_online-acceptance/evidence/ui/H02_06_cudan01_timeline-cuoi.png)) không còn trong danh sách của `cudan01` ở 5/10: [R01_02](planning/07_2026-10-04_online-acceptance/evidence/ui/R01_02_truoc-restart.png) chỉ còn 12 ticket dữ liệu mẫu ngày 27/9; [01_03_sau-restart](planning/07_2026-10-04_online-acceptance/evidence/ui/01_03_sau-restart.png) có thêm ticket mới tạo 11:43–11:45 5/10. Phù hợp với store memory bị reset khi khởi động lại.
- **Kết quả:** **BLOCKED_MEMORY_STORE.** Không chứng minh lưu bền. Muốn đo PASS cần `MO_STORE=postgres` (Supabase) và bằng chứng trước/sau restart cùng DB; owner Châm Anh.
- **Hạn chế bằng chứng:** chưa ghi thời điểm restart và chưa có ảnh `R01_01` (cấu hình); hai ảnh R01 đặt tên chưa đúng thứ tự trước/sau.

---

### 4. Truy vết ca kiểm thử ↔ tính năng

| Ca | Tính năng kiểm | Quy tắc tham chiếu |
|---|---|---|
| TC-01 H01, TC-06 H02 | Giao đúng phòng ban, vòng đời ticket, timeline cư dân, audit | [CR-BPTN-03](docs/CR-BPTN-03.md) §4–5 |
| TC-02 I01 | Chặn thiếu thông tin, BPTN bổ sung, giữ nội dung gốc | CR-BPTN-03 (BPTN `NEED_INFO`/`MISSING_INFO`) |
| TC-03 U01 | Phát hiện trùng, BPTN quyết gộp / không gộp | CR-BPTN-03 (quy tắc trùng) |
| TC-07 A01 | Gỡ blocker asset đúng quyền BPTN, cờ `ASSET_CHECK_ONSITE` | CR-BPTN-03 (asset) |
| TC-08 M01 | Thiếu vật tư, kho nhập, tự chạy tiếp | CR-BPTN-03 (vật tư) |
| TC-09 R01 | Lưu bền sau restart | `brain4agent/-data-architecture.md` |
| TC-04 S04 | Tầng an toàn Bậc 1, BQL đóng khẩn cấp | CR-BPTN-03 §6.2, §6.5 |
| TC-05 G03 | Phân quyền theo vai (`ACTION_DENIED` 403) | CR-BPTN-03 (phân quyền) |

### 5. Giới hạn và phần chưa làm (ghi trung thực)

- **Môi trường:** localhost, dữ liệu giả, LLM mock → không đo chất lượng phân loại LLM thật; `Độ tin cậy 95%` ở giao diện là từ luật cố định, không phải số đo mô hình.
- **Lưu trữ:** store memory, nên chưa chứng minh dữ liệu còn sau restart (R01 BLOCKED).
- **Ảnh sau xử lý ở H01/H02 là ảnh minh họa** (ảnh chụp màn hình bất kỳ), không phải ảnh hiện trường thật.
- **Chưa có:** RAGAS/metric LLM, đo thời gian phản hồi, phản hồi người dùng thật, bản online (Live URL chưa có).

### 6. Quan sát phụ (ghi nhận khi chạy, chưa sửa)

1. **Ngoài giờ phòng ban:** ticket gửi sau 22:00 (H01, H02) hiển thị "Phản ánh sẽ được xử lý từ 06:00 05/10/2026" nhưng phòng ban vẫn nhận việc và hoàn tất lúc 22:29 (H01). Cần xác nhận đây là thiết kế (cờ chỉ cảnh báo) hay lỗi.
2. **Chữ "Agent" ở form cư dân:** "Ghi rõ tình trạng thực tế để Agent phân loại chính xác." — thuật ngữ nội bộ.
3. **Mâu thuẫn chữ trong U01:** thẻ Agent ghi "Cùng vị trí và vấn đề trong vòng 4h", ghi chú nội bộ ghi "trong 2 days, 0:00:00".
4. **S04 — bằng chứng audit:** ảnh [S04_02](planning/07_2026-10-04_online-acceptance/evidence/ui/S04_02_bql01_lua-chon.png) và [S04_04](planning/07_2026-10-04_online-acceptance/evidence/ui/S04_04_bql01_audit.png) đang hiển thị ticket mẫu `SIM-TKT-CLN-004` (cùng thao tác đóng khẩn cấp, 23:18), không phải `SIM-TKT-0006`. Việc đóng `SIM-TKT-0006` được xác nhận qua timeline cư dân (Hoàn thành 23:18) và danh sách BQL. Nên chụp thêm tab "Nhật ký kiểm toán" của `SIM-TKT-0006`.
5. **G03 — bằng chứng "không đổi":** [G03_03](planning/07_2026-10-04_online-acceptance/evidence/ui/G03_03_khong-thay-doi.png) chỉ chụp phần cuối phản hồi và schema, chưa phải `GET` ticket sau thử. Nên chụp thêm `GET` của `SIM-TKT-TEC-005`.
6. **Bảo mật:** token trong ảnh G03_01 và G03_02 đã được che trước khi nộp.

# 28 — Hoàn thiện Evaluation Evidence theo chương 9 (PATCH)

## Metadata
- Trạng thái: 🟠 ĐANG THỰC THI — người dùng duyệt plan và 5 quyết định ngày 2026-10-17. WP1–4, 6–9, 12, 14 xong local; WP5 (ui-check portal), WP10, WP11, WP13 còn mở (cần người/chi phí).
- Người yêu cầu: nhóm ("lên plan chỉnh sửa và hoàn thiện evaluation", sau audit `evaluation.md` @ `b5af2bc`).
- Nhánh: `develop`. Phiên bản: **1.17.10** (PATCH: tài liệu + một bước CI + script đo, ≤ 1 ngày công ⇒ ngoại lệ AGENTS §3.2.5, chỉ `plan.md`).
- Phạm vi được ghi: `evaluation.md` (→ `docs/evaluation.md`), `README.md`, `docs/submission/README.md`, `docs/guide/deliverables/checklist.md`, `.github/workflows/ci.yml`, `scripts/` (script đo mới), `docs/eval/runs/`, `brain4agent/`. **CẤM chạm** `src/`, `portal/src/`, `seed/`, `tests/` (trừ thêm test cho script đo mới).
- Tiêu chí gốc: `docs/guide/chapter-09.md` §9.1 mục 10 và checklist "Evaluation Evidence"; `docs/guide/chapter-08.md` §8.4–§8.6.

## Hiện trạng đo được (audit @ `b5af2bc`)
- Tái hiện được từ dữ liệu thô: 91 ca/19 sai (luật), 82/90 (Agent), p50/p95/p99 4.84/6.15/6.46 giây, 229.549 token.
- Chương 9 đã đạt: test results + coverage 92.0%, performance, giải thích không dùng RAGAS.
- Còn lỗi: mâu thuẫn nội dung cũ chưa dọn; ngưỡng recall ≥ 99% vs 100%; bảng "thời gian tiết kiệm" không nguồn; nhãn "chi phí mỗi ticket" sai đơn vị; bằng chứng từ UI `src/web/` đã xoá; chưa có phản hồi người dùng, ảnh chụp, badge, bước coverage trong CI, bảng AC → test → code; file chưa ở `docs/`.

## Nhật ký quyết định
- 2026-10-17 D01 (agent): cổng chặn recall khẩn cấp và "bắt tín hiệu lẫn" thống nhất **100%**; bỏ cột "≥ 99%" và "≥ 95%" ở bảng tóm tắt. Lý do: §0 và §1 đã gọi là cổng chặn, an toàn là chỉ số duy nhất đặt sát 100%. Người dùng có thể đổi.
- 2026-10-17 D02 (agent): bảng "Thời gian xử lý và tiết kiệm" **rút khỏi phần bằng chứng**, chuyển sang mục "Giả thuyết cần kiểm chứng" không kèm con số 96 giờ / 30,5 / 16,5 / 4.800 giờ. Chỉ phục hồi số khi người dùng cung cấp nguồn đo (WP3). Lý do: README và Problem Statement cấm claim hiệu quả vận hành thật; số không nguồn là rủi ro BGK.
- 2026-10-17 D03 (agent): chi phí báo **hai đơn vị tách bạch**: mỗi lượt gọi Agent (≈ 4.250 token) và mỗi ticket (≈ 2.550 token = 229.549 / 90 ca, vì 36 ca luật sàn không gọi Agent). Đổi sang tiền chỉ khi có bảng giá `gpt-6-luna`.
- 2026-10-17 D04 (agent): `evaluation.md` chuyển vào `docs/evaluation.md` (đúng cây chương 9 §9.1); sửa mọi link.
- 2026-10-17 D05 (agent): KHÔNG đổi hành vi "Agent lỗi → rơi về luật cố định" trong plan này (đổi hành vi hệ thống = MINOR, cần bộ SPEC riêng). Ghi vào Idea Vault `roadmap.md`: khi Agent rơi về luật mà luật cho `NONE`, chuyển Tiếp nhận xem thay vì tự route.

- 2026-10-17 D06 (agent): WP6 buộc phải chạm `src/` và `tests/` ở mức **định dạng và import** (ruff `--fix`/`format`) cùng đổi tên lớp riêng tư `_ReadDropped` → `_ReadDroppedError` (rule N818); không đổi hành vi. Ngoại lệ có chủ đích với "CẤM chạm src/" ở Metadata.
- 2026-10-17 D07 (agent): hai test thời gian `test_assess_is_linear_*` (`elapsed < 1 s`) fail khi bật `--cov` (theo dõi từng dòng làm chậm), pass khi chạy riêng. Chọn tách bước CI (`--deselect` + bước riêng) thay vì nới ngưỡng thời gian trong test.
- 2026-10-17 D08 (agent): WP9 chỉ lưu output máy dạng `.txt` ở `docs/eval/runs/outputs-20261017/`; ảnh chụp terminal cần người chụp.

### Quyết định bị thay thế
- (không có)

### Vùng cấm
- Không sửa `src/` để "làm đẹp" số đo; không tinh chỉnh prompt rồi chạy lại cho đến khi đạt (bộ câu khó đã dùng để dev prompt, chưa độc lập).
- Không bịa phản hồi người dùng, không nội suy p95 từ ít mẫu, không điền số 96 giờ khi chưa có nguồn.
- Không xoá lịch sử số đo cũ: bản cũ có trong git; chỗ nào thay số phải ghi "thay bởi … ngày …".
- Không gọi API trả phí (G-LIVE đầy đủ, lặp LLM) khi chưa được người duyệt từng lần.

## Work Packages

| WP | Việc | Tầng | Xong khi (lệnh + kết quả máy đọc được) |
|---|---|---|---|
| WP1 | Dọn mâu thuẫn nội dung: §1 "chưa có số đo tầng Agent", §7 "chưa đo trên LLM", §4 hàng ❌ vs ✅ (hiểu đầu vào, không bịa), §3 câu S9, đổi thứ tự 7.1 → 7.2 → 7.3 | 🟢 | `grep -nE "chưa đo trên LLM|chưa có số đo tầng Agent" docs/evaluation.md` = 0 dòng; mọi hàng có đủ cột luật + Agent, trạng thái khớp bảng tóm tắt |
| WP2 | Thống nhất ngưỡng theo D01 | 🟢 | `grep -n "≥ 99%" docs/evaluation.md` không còn ở hàng recall khẩn cấp |
| WP3 | Xử lý bảng thời gian tiết kiệm theo D02 | 🟢 | `grep -nE "96 giờ|30,5|16,5|4\.800" docs/evaluation.md` = 0; có mục "Giả thuyết cần kiểm chứng" ghi cách đo (so thời gian nhận việc trước/sau trên cư dân thật) |
| WP4 | Chi phí hai đơn vị (D03); script `scripts/eval_hard_llm_report.py` in thêm token/ticket | 🟠 | script in `tokens/ticket 2550` trên run `hard-llm-20261017`; `evaluation.md` có hai dòng riêng |
| WP5 | Bằng chứng UI: gắn nhãn "UI cũ `src/web/`, ngày 04/10" cho các hàng dựa vào `planning/07`; chạy `portal/scripts/ui-check-WP3/WP4/WP5.mts` trên backend local, thay bằng kết quả portal nếu đo được | 🟠 | exit code 0 của ba script, đính kèm output vào `docs/eval/runs/ui-portal-<ngày>/`; hàng nào chưa đo ghi ⬜ |
| WP6 | Sửa 1 test fail thiếu `psycopg2` (kiểm trong venv sạch từ `requirements.txt`) và 5 lỗi ruff / 5 file format để CI xanh | 🟠 | `python -m pytest tests -q` 0 fail (hoặc fail còn lại có giải thích); `ruff check src tests` và `ruff format --check src tests` exit 0 |
| WP7 | Thêm bước coverage vào CI (`pytest tests --cov=src --cov-fail-under=60`), badge coverage trong README | 🟠 | `.github/workflows/ci.yml` có bước; chạy cục bộ cùng lệnh exit 0, tổng ≥ 60% |
| WP8 | Bảng truy vết AC-01…AC-18 → file test → module mã trong `docs/evaluation.md` (dò bằng `grep -rn "AC-" tests/`) | 🟠 | 18 hàng, mỗi hàng có đường dẫn tồn tại (`test -f` từng đường dẫn) |
| WP9 | Ảnh chụp terminal: `pytest --cov`, `eval_hard_cases.py`, `eval_hard_llm_report.py` lưu `docs/eval/screens/*.png` + liên kết trong `docs/evaluation.md` | 🟢 | 3 file ảnh tồn tại, link không hỏng |
| WP10 | Phản hồi người dùng: mẫu thu 3–5 người trên Live URL (đăng nhập `cudan`, gửi phản ánh, đánh giá sao + thẻ + bình luận); script xuất `RatingDetail` ra bảng | 🟠 + 🖐 | bảng có `n ≥ 3` người độc lập, số thật; nếu chưa đủ ghi "n = x, chưa đạt 3" |
| WP11 | Lặp chạy Agent LLM 3 lần trên 91 câu để đo độ dao động (ước tính ≈ 3 × 230.000 token, có chi phí) | 🟠 + 🖐 duyệt chi phí | 3 thư mục `docs/eval/runs/hard-llm-<ngày>-r1..r3/`; bảng min/median/max cho các tỷ lệ chính |
| WP12 | Chuyển `evaluation.md` → `docs/evaluation.md` (D04), sửa link ở `README.md`, `docs/submission/README.md`, `docs/guide/deliverables/checklist.md`, các link tương đối trong file | 🟢 | `git grep -n "evaluation.md"` chỉ trỏ `docs/evaluation.md`; script kiểm link báo 0 hỏng |
| WP13 | Held-out độc lập: Trường + người review gán ≥ 40 dòng/khung vào CSV, chạy `eval_labels.py` không cờ | 🖐 người | `eval_labels.py` exit 0 hoặc 1 (không còn exit 2 "chưa có dòng"); số held-out vào §8 |
| WP14 | Đồng bộ não (Ma Trận 6 Điểm): `roadmap.md` (Done + Idea Vault D05), `changelog.md` v1.17.10, `today.md`, `state.json`, `memory-distill.txt`, `docs/submission/README.md`; tăng version PATCH | 🟢 | `git diff --stat` chạm đúng các file trên; version khớp ở `portal/package.json` và `state.json` |

Thứ tự đề xuất: WP1–WP3 → WP4 → WP6 → WP7 → WP8 → WP12 → WP5 → WP9 → (🖐) WP10, WP11, WP13 → WP14.

## Checklist thực thi
- [x] WP1 dọn mâu thuẫn
- [x] WP2 thống nhất ngưỡng
- [x] WP3 bảng thời gian tiết kiệm
- [x] WP4 chi phí hai đơn vị
- [~] WP5 đã gắn nhãn UI cũ; CHƯA chạy lại `ui-check-WP3/4/5` trên portal
- [x] WP6 CI xanh (test fail + ruff)
- [x] WP7 coverage trong CI + badge
- [x] WP8 bảng truy vết AC → test → code
- [~] WP9 output máy đã lưu (.txt); ảnh chụp terminal cần người
- [ ] WP10 phản hồi người dùng (cần người)
- [ ] WP11 lặp LLM 3 lần (cần duyệt chi phí)
- [x] WP12 chuyển file vào `docs/`
- [ ] WP13 held-out (cần người)
- [x] WP14 đồng bộ não + version

## Exit Gates

| Gate | local | server |
|---|---|---|
| Không còn mâu thuẫn nội dung trong `docs/evaluation.md` (WP1–WP3) | ✅ | – |
| CI cục bộ xanh: pytest, ruff, coverage ≥ 60% (WP6–WP7) | ✅ ruff exit 0; pytest --cov 92.0%; 2 test thời gian pass khi chạy riêng | ⬜ GitHub Actions xanh trên `develop` (chưa push) |
| Đủ 4 nhóm bằng chứng chương 9: test+coverage, chất lượng, performance, phản hồi người dùng (n ≥ 3) | ⬜ | – |
| Bảng truy vết AC → test → code, link không hỏng (WP8, WP12) | ✅ (20 AC; link kiểm bằng script) | – |
| Held-out ≥ 40 dòng/khung có số (WP13) | ⬜ | – |
| Độ trễ đo trên Live URL qua mạng thật | – | ⬜ (ngoài plan này, ghi ở §8) |

Kế hoạch chỉ được đóng khi mọi gate local ✅; gate server và WP13 nếu hoãn phải ghi lý do trong `evaluation.md` §8.

## Rủi ro và phụ thuộc
- WP10, WP13 cần người thật; nếu không kịp, ghi số thật là "chưa đo", không thay bằng số giả.
- WP11 tốn token; nếu key hết tiền chỉ làm 1 lần lặp và nói rõ.
- Đổi hành vi "Agent lỗi" nằm ngoài plan (D05); nếu nhóm muốn kịp Demo Day thì mở plan 29 MINOR có bộ SPEC.

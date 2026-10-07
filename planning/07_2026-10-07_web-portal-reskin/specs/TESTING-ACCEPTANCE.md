# TESTING & ACCEPTANCE

## 1. Ma trận test
| Bộ | Lệnh | Phủ |
|---|---|---|
| Cú pháp JS | `node --check src/web/app.js` | file còn chạy được |
| API/UI phục vụ | `python -m pytest tests/test_maintenance/test_api.py -q -p no:cacheprovider` (`LLM_MODE=mock`, `PYTHONUTF8=1`) | `/ui/` trả 200 + có `app.js`; `/ui/app.js` 200 |
| Toàn bộ backend | `python -m pytest -q -p no:cacheprovider` + `python -m ruff check src tests` | không hồi quy (reskin không chạm Python) |
| Chụp màn | Playwright (`portal/node_modules`), script trong scratchpad, đăng nhập 5 vai `cudan01`, `bptn01`, `kythuat01`, `kho01`, `bql01` + màn đăng nhập, 1440px và 390px | ảnh ở `evidence/screens/`; đo `scrollWidth > clientWidth` = 0 trang; 0 lỗi console |

## 2. Exit Gates
| Gate | local | server |
|---|---|---|
| G1 `node --check` exit 0 | ✅ `evidence/gates/g1-g2-checks.txt` | — |
| G2 pytest + ruff xanh, 0 fail | ✅ 2972 passed / 0 fail, ruff sạch (`g1-g2-checks.txt`) | ⬜ |
| G3 6 màn chụp ở 1440 + 390, không tràn ngang, 0 lỗi console | ✅ 22 ảnh `evidence/screens/`; 0 tràn ngang; lỗi console duy nhất = 401 của phép thử sai mật khẩu cố ý; `kho01` không có item (kho trống) — `g3-screens.txt` | ⬜ |
| G4 đăng nhập → thao tác một nút mỗi vai không lỗi JS | ✅ `kythuat01` Nhận việc → "Đang xử lý"; `cudan01` gửi phản ánh; `bptn01` form tới API (server trả luật "bắt buộc ghi lý do"); 0 pageerror — ảnh `act-*.png` | ⬜ |

Ghi chú đo: lần chạy suite đầu có 1 fail `test_assess_is_linear_on_adversarial_24kb_texts` (ngưỡng 1 giây) khi máy đồng thời chạy uvicorn + Playwright; chạy riêng 3/3 pass (~2,6 giây), chạy lại cả suite sau khi tắt server: 2972 pass.

Kế hoạch chỉ đóng khi cột server ✅ (đợt này chỉ đóng phần local).

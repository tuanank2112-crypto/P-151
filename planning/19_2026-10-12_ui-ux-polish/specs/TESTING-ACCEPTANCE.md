# TESTING & ACCEPTANCE

## §1 Ma trận test (đợt 1)
| Hàm / phần | Test bắt buộc |
|---|---|
| `doneSegment` (01 §1) | 6 nhóm, mỗi dòng đúng một nhóm; dept null stage ≤ 2 ⇒ bql |
| `buildingOf` (01 §2) | S1, S2, S1.12 ⇒ S1, s2 thường, không có ⇒ null, ưu tiên chuỗi đầu |
| `bqlBox`, `listGroup` (01 §3) | phân hoạch: mỗi ticket mẫu thuộc đúng một nhóm; khẩn cấp ⇒ decide/bql; ngoài phạm vi ⇒ decide; stage 5/6; huỷ/gộp |
| `deptLoad` | đếm stage 3/4, quá hạn, bỏ huỷ |
| `stockLevel` (01 §5) | null, 0, ≤ min, > min, min null |
| Python `min_qty` | `/mo/warehouse/stock` trả `min_qty` đúng bảng 01 §5; vật tư ngoài danh mục ⇒ null |
| Toàn bộ | pytest không giảm số pass, 0 skip mới; vitest không giảm |

## §2 Exit gates
| Gate | local | server |
|---|---|---|
| G1 pytest + ruff sạch | ✅ 3599 passed / 100 pg deselected | ⬜ |
| G2 portal typecheck + lint + vitest | ✅ 143 passed | ⬜ |
| G3 `next build` | ✅ | ⬜ |
| G4 Ảnh chụp: Tổng quan, Danh sách ticket, Việc của BQL, Kho, Kỹ thuật (danh sách + lịch sử), Tiếp nhận "Đã phân loại" | ✅ 9 ảnh `evidence/wave1/` | ⬜ |
| G5 Người dùng thử tay và duyệt | ⬜ | ⬜ |
| G6 Ẩn danh qua cổng 8000 không có phiên (sau 4 lần đăng nhập) | ✅ chuyển về `/login` | ⬜ |

Bằng chứng ảnh: `evidence/wave1/*.png` (máy chụp, không sửa tay).

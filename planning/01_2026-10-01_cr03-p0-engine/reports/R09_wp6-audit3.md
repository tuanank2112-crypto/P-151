Vai: auditor · loại: thẩm định lần 3 · họ/model: Claude Sonnet 5.5 (agent mới, không đọc report/holdout) · Bước 0 exit: 0 · hiểu việc: làm đỏ cơ chế hạ mức sau WP3c; tách lỗi cơ chế (chặn) khỏi lỗ từ vựng (không chặn).
Handoff: (giao trực tiếp trong lời gọi; luật phán ở TESTING §12, plan Q29)
Base: 2f36ab0
Head: 2f36ab0 (không ghi; script ở scratchpad\audit3\)

## Gate máy
pytest 1378 passed, 0 fail, 0 skip, EXIT=0. Hồi quy PASS toàn bộ: f_neg 0/100, a_sep 0, jx_coord 0/400, a_b01 0, a_split 0, b_fp EMERGENCY 0 / UNCLEAR 4, b_fp2 EMERGENCY 3, jx_negfp EMERGENCY 0, i_recall NONE chỉ 2 ca P1, a_fuzz 900/0, j_fix đúng CLN-004/TEC-005, e_perf ≤ 50 ms/5000 ký tự, X-1..X-8 PASS.

## Lỗi cơ chế hạ mức (CHẶN)
| ID | Mô tả | Thật | Có từ trước WP3c? | file:dòng |
|---|---|---|---|---|
| A | Cue phủ định `k co/k thay/ko co/ko thay` khớp mã toà: "Tòa SIM-K có khói bốc ra…" ⇒ NONE (9/9 biến thể) | NONE / NEED_INFO | có | lexicon.yaml:15-18 |
| B | Hedge khớp tên người sau bỏ dấu: "chị Nghị có khói", "cô Lê/Lệ có mùi khét", "cô Vẽ", "Dương Như" ⇒ UNCLEAR (7/7) | UNCLEAR | có | lexicon.yaml:25-39 |
| C | R7 đồng tự làm mất tín hiệu khi gõ sai dấu: "có khỏi/khối bốc ra", "người bị ngắt", "lừa/lúa bốc lên", "dây điện hộ ra" ⇒ NONE (9/10) | NONE | **mới do WP3c** | safety.py:349-359, 499; lexicon.yaml:79-99 |
| D | R4 hazard token `chay` gồm "chữa/báo cháy": "không có vòi chữa cháy hay khói bốc ra" ⇒ NONE | NONE | **mới do WP3c** | safety.py:383-391; lexicon.yaml:24 |

## Không chặn
- G: ký tự Cc (\x08, \x7f, \x00, \x85) và U+2800/U+E000 trong chữ ⇒ NONE — đề xuất mở rộng `is_invisible`.
- Phụ: B-04 khớp tên "anh Chiến", "chị Nương" ⇒ UNCLEAR (có từ trước).
- Lỗ từ vựng: "hộp điện nổ", "bị bỏng", "dây điện bị trần ra", "cháy sang/ra tường".

## Đề xuất auditor
🔁 SỬA A–D (dữ liệu lexicon + R7/R4); G nên làm.

## Phán quyết SO (2026-10-02)
SO đồng ý: gate máy xanh, lỗi còn lại hẹp và có ca tái hiện. Sửa theo Q31 (WP3d, H07). Tiêu chí đóng: SO đo bằng atk1–atk4 của auditor + toàn bộ bộ dừng + holdout; không mở thẩm định lần 4 trừ khi số đo hồi quy.
🔁 SỬA: A–D, G và lỗ từ vựng theo Q31

# Known Gotchas & Bugs

Tổng hợp các lỗi khó, các lưu ý dị biệt hoặc cách workaround đặc thù của dự án này để AI không dẫm lại vết xe đổ.

## Môi trường & Config

### G01 — Hạn mức model Fable cạn giữa chừng khi viết architecture/SPEC 🔴
Khi giao việc thiết kế kiến trúc/contract (tầng 🔴) cho model Fable, hạn mức
(quota) có thể cạn giữa chừng khiến tiến trình architect "chết" — dừng nửa
chừng, không hoàn tất SPEC. Không phải lỗi logic, là giới hạn hạ tầng model.
**Workaround:** với việc tầng 🔴 dài hơi (nhiều file SPEC, nhiều nghìn dòng),
lên thẳng Opus thay vì Fable, hoặc chia nhỏ việc theo từng file SPEC để mỗi lượt
gọi nằm trong hạn mức an toàn.

### G02 — Heredoc bash vỡ khi ghi file Markdown tiếng Việt dài
Dùng heredoc (`cat <<'EOF' > file.md`) qua Bash tool để ghi file `.md` tiếng
Việt nhiều dòng (dấu, ký tự đặc biệt, dòng dài) dễ bị vỡ nội dung — cắt dòng
sai chỗ, mất ký tự, hoặc heredoc đóng sớm khi nội dung chứa chuỗi trùng token
kết thúc. **Workaround:** dùng công cụ ghi file chuyên dụng (Write/Edit) thay
vì heredoc cho mọi file Markdown tiếng Việt dài; chỉ dùng heredoc cho các đoạn
script ngắn, ASCII, không dấu.

## Quản trị & Bàn giao

### G03 — Handoff cấp sai đường dẫn thì worker làm đúng vẫn ra cổng ĐỎ
Gói P00 (2026-09-20): `handoffs/H02` cấp phạm vi `knowledge/expected_defects.json`
và `golden/*.jsonl`, trong khi `SPEC-P00` §2 đặt cả ba file ở `evals/golden/`.
Worker tuân thủ handoff (đúng luật — handoff là hợp đồng của nó), nên cổng K-M3
`grep -ril "pickleball" knowledge/` bắt đúng `expected_defects.json` và đỏ, dù
Knowledge Pack hoàn toàn lành. **Bài học:** mục "phạm vi" của handoff là nơi dễ
sinh lỗi nhất vì nó được gõ TAY, không sinh từ SPEC. Trước khi phóng worker, đối
chiếu từng đường dẫn trong mục phạm vi với cây thư mục ở SPEC — sai một dòng là
worker mất công và cổng đỏ giả. **Đây là lỗi của người giao việc, không phải worker.**

### G04 — SPEC tự mâu thuẫn giữa bảng mô tả và bảng nghiệm thu
`SPEC-P00` §3.2 ghi `FAC-FISHING-DECK` còn §3.4/§4 dùng `FAC-FISHING-LAKE`; §4 mới
là nguồn tính số nghiệm thu K-M4 (13 true / 1 false). Worker chọn theo §4 và báo
lên thay vì tự sửa SPEC — xử lý đúng. **Quy tắc:** khi hai chỗ trong cùng SPEC
đá nhau, theo chỗ mà **số nghiệm thu được tính ra từ đó**, rồi báo để sửa SPEC.
CẤM worker tự sửa SPEC.

### G05 — Phép thử "đỏ" sai làm tưởng script bỏ sót lỗi
Khi kiểm `validate_golden.mjs` có thật sự bắt được thiếu mã canonical không, phép
thử đầu dùng `grep -v out_of_scope` — script vẫn xanh. Nguyên nhân: `out_of_scope`
KHÔNG nằm trong 10 mã canonical của bộ, nên grep xoá 0 dòng. **Trước khi kết luận
một bộ đo bị hỏng, kiểm xem phép phá của mình có thật sự phá được gì không** —
đối chiếu danh sách giá trị thật trong dữ liệu trước.

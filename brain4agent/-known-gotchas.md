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

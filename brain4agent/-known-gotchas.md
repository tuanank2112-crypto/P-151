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

## Next.js & hạ tầng

### G06 — `npm run build` của Next.js chết khi chưa có `DATABASE_URL`
Next.js App Router mặc định cố **prerender tĩnh** mọi route lúc build. Route nào
chạm DB ở tầng server sẽ chạy thật lúc `npm run build` và nổ vì thiếu biến môi
trường — trong khi đây đúng là tình huống của dự án suốt giai đoạn chưa có Neon.
**Workaround (đã áp ở P01a):** ép mọi route chạm DB sang dynamic, kiểm bằng bảng
route cuối output build — phải thấy `ƒ (Dynamic)` chứ không phải `○ (Static)`.
Số đo chuẩn của repo này: 8/9 route `ƒ`, chỉ `/_not-found` là `○`.

### G07 — `.gitignore` pattern `.env*` nuốt luôn `.env.example`
File mẫu biến môi trường không bao giờ commit được, người clone repo không biết
cần biến gì. **Fix:** thêm dòng `!.env.example` NGAY SAU `.env*` (Đ16). Kiểm bằng
`git add --dry-run .env.example` phải in `add '.env.example'` — KHÔNG kiểm bằng
`git check-ignore -v`, lệnh đó vẫn exit 0 và in ra chính dòng phủ định, dễ tưởng
là còn bị chặn.

### G08 — `create-next-app` treo khi thư mục không rỗng
`npx create-next-app@latest --ts` vào repo đã có file sẽ hỏi tương tác, mà môi
trường agent không có stdin ⇒ treo tới hết timeout. **Workaround:** dựng thủ công
bộ file tương đương (`package.json`, `tsconfig.json`, `next.config.mjs`,
`next-env.d.ts`, `app/layout.tsx`, `app/page.tsx`). Cổng nghiệm thu của bước này
trong `OPERATIONS.md` §4 là `npx tsc --noEmit` exit 0, không phải "đã chạy đúng
lệnh khởi tạo" — nên cách dựng không quan trọng, kết quả đo mới quan trọng.

### G09 — CẤM tạo module mở connection ngoài `lib/adapters/db.ts`
Thói quen thường thấy là tạo `lib/db/index.ts` cho tiện. Làm vậy vi phạm BB-07
(`00-ARCHITECTURE.md` §5: `lib/adapters/db.ts` là file DUY NHẤT mở connection,
`lib/adapters/anthropic.ts` là file DUY NHẤT import SDK) và `check_adapter_boundary.sh`
sẽ đỏ. DDL để ở `db/migrations/*.sql` — đó là dữ liệu, không phải module kết nối.

### G10 — python -c qua Bash nuốt sạch nội dung trong backtick
Biến thể nguy hiểm hơn G02. Chạy `python -c "..."` qua Bash tool với chuỗi chứa
backtick: bash coi backtick là command substitution và **thay bằng output rỗng**
TRƯỚC khi python nhìn thấy. Kết quả: file ghi ra mất sạch tên file, tên biến, tên
lệnh — mà lệnh vẫn exit 0 nên trông như thành công. Đã làm hỏng
`brain4agent/memory/hot/today.md` ngày 2026-09-20, phải `git checkout` khôi phục.
**Luật:** nội dung tiếng Việt có backtick thì LUÔN ghi ra file bằng công cụ ghi
file chuyên dụng, rồi cho python đọc file đó. CẤM nhúng thẳng vào lệnh shell.
Kiểm nhanh sau khi ghi: `grep -c '`' <file>` phải ra số > 0.

### G11 — `today.md` PHẢI xếp phiên MỚI NHẤT lên đầu, nếu không `rotate_memory.js` archive nhầm
`rotate_memory.js` giữ `allLines.slice(0, keptEndLine)` — tức giữ N phiên **ĐẦU
file** và xoay phần **ĐUÔI** sang `memory/archive/`. Nó giả định quy ước
newest-first. Repo này trước đó append phiên mới xuống đáy, nên lần xoay đầu tiên
(2026-09-20) nó **archive đúng phiên mới nhất** và giữ lại phiên khởi tạo từ
2026-09-19 — mất đúng phần ngữ cảnh mà phiên sau cần đọc, mà lệnh vẫn exit 0.

**Luật cho repo này:** khi ghi nhật ký phiên, **chèn khối phiên mới lên NGAY SAU
header**, không append xuống đáy. Kiểm trước khi xoay:
`grep -n "^## " brain4agent/memory/hot/today.md` — dòng đầu tiên phải là phiên
gần nhất. Xoay xong kiểm lại cả hai phía: `today.md` còn phiên mới nhất, và
`memory/archive/<ngày cũ>.md` mới là file vừa sinh (tên file phải là ngày CŨ,
thấy tên file là ngày HÔM NAY nghĩa là vừa archive nhầm).

Không sửa engine — engine nằm ở hub dùng chung, sửa thứ tự file phía repo là đúng
chỗ. Nếu đã lỡ archive nhầm: xoá file archive vừa sinh (nó chưa commit, không mất
lịch sử), dựng lại `today.md` cho đúng thứ tự, rồi chạy lại lệnh xoay.

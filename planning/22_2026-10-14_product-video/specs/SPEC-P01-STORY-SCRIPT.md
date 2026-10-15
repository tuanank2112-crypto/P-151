# SPEC-P01 — Dẫn dắt câu chuyện & kịch bản phân cảnh

Trạng thái: ✅ ĐÃ DUYỆT 2026-10-15 (plan.md V01, V05). Bản đề xuất 2026-10-14 (3 hướng A/B/C) xem git `3bc8a32`.

## 1. Hướng kể: "Một tối ở tòa S2.05" (hướng A, mượn kiểu chia đôi của B ở cảnh 1–2)

**Luật cốt truyện (BẮT BUỘC):**
| # | Luật | Lý do |
|---|---|---|
| C1 | Một buổi tối, một tòa (S2.05), hai sự việc: **đèn hành lang tầng 12** (việc thường, đi trọn vòng) và **tủ điện hầm B1** (khẩn cấp, cao trào) | Người xem theo được hai mạch, không lạc |
| C2 | Mọi thứ cài ở cảnh 1 phải được trả ở cảnh sau: tin "đèn tầng 12" ⇒ cảnh 4–6, 8; tin "khét dưới hầm" của **chú căn 1402** ⇒ cảnh 7 | Mở ra là phải đóng lại |
| C3 | Cảnh 1–2 là **thế giới chưa có hệ thống** (nhóm chat). Từ cảnh 3: "**Cùng buổi tối ấy**, nhưng lần này cư dân báo qua MaintenanceOps" | Người xem hiểu ngay đây là phép so sánh trước/sau, không phải hai đêm khác nhau |
| C4 | Đồng hồ trên màn hình chạy tới, không lùi: 21:00 → 21:05 → 21:20 → 07:30 sáng hôm sau | Không nhảy thời gian khó hiểu |
| C5 | Cao trào (khẩn cấp) đặt ở **cảnh 7**, sau khi người xem đã hiểu luồng thường | Hiểu bình thường trước thì mới thấy được cái khác thường |
| C6 | Nhân vật dùng đúng tài khoản seed (§2); không bịa tên không có tài khoản | Cảnh UI là dữ liệu thật của tài khoản đó |

**Mạch cảm xúc:** bức bối (1) → nhận ra vấn đề (2) → có lối ra (3) → dễ dàng (4–5) → gọn gàng (6) → căng thẳng rồi được kiểm soát (7) → khép kín (8) → tin tưởng (9) → kết (10).

## 2. Nhân vật (khớp `seed/maintenance_v1/accounts.yaml`; CẤM hiện tên đăng nhập, B2)
| Nhân vật trong lời | Tài khoản | Vai | Cảnh |
|---|---|---|---|
| Chị Minh Anh, căn 1208 | `cudan` (Nguyễn Minh Anh, S2.05 tầng 12) | Cư dân | 4, 7.4, 8 |
| Chú căn 1402 | `cudan01` (S2.05-1402) | Cư dân | 1 (tin bị trôi), 6, 7.1, 7.9 |
| Chị Thu Trang | `tiepnhan` (Phạm Thu Trang) | Ban tiếp nhận | 6 |
| Anh Long | `quanly` (Vũ Hoàng Long) | Ban quản lý | 7, 9 |
| Anh Hùng | `kythuat` (Đặng Văn Hùng) | Phòng Kỹ thuật | 7, 8 |
| Chị Lan | `vesinh` (Ngô Thị Lan) | Phòng Vệ sinh | 7.10 |

Tên hiển thị của `cudan01` là "Nguyễn Văn Hùng", trùng tên anh Hùng kỹ thuật ⇒ lời và chữ chỉ gọi **"chú căn 1402"**. Cận cảnh điện thoại của chú phải cắt để không hiện thanh tên (01-CONTRACTS §3 `crop`).

## 3. Kịch bản phân cảnh (mục tiêu 3:05; lời ≤ 165 s đo thật)

Quy ước: **Lời** = giọng thuyết minh HoaiMy (SPEC-P02 §1). Lời cư dân là **bong bóng chat có chữ gõ**, không lồng tiếng. Mốc thời gian dưới đây tính từ lời đã sinh thử 2026-10-15 (HoaiMy +0%, edge-tts 7.3.1; tổng lời **162,3 s**) cộng khoảng nghỉ cho hình. Khi dựng, `durations.json` là số thật; mốc ở đây chỉ để định khung. **Hình nhãn "Minh hoạ"** = cảnh vẽ, không phải dữ liệu.

### Cảnh 1 · Mở: tin khẩn bị chôn (0:00–0:14 · lời 12,2 s) · animation
- **Hình:** đồng hồ 21:00. Điện thoại rung, khung chat "Cư dân S2.05" (giao diện chung chung, không thương hiệu Zalo/Messenger). Tin dồn lên nhanh dần: "Đèn hành lang tầng 12 tối om mấy hôm rồi" · "Phòng rác tầng 5 bốc mùi quá" · "Tầng 12 vẫn chưa ai sửa đèn à??" · **Căn 1402: "Hình như có mùi khét dưới hầm B1…"** (viền đỏ nhạt) · "Ai dọn giúp sảnh với" · "+1 đèn tầng 12"… Tin của căn 1402 bị đẩy trôi khỏi khung.
- **Lời:** "Chín giờ tối ở tòa S2. Nhóm chat cư dân sáng đèn liên tục: đèn hỏng, rác đầy, rồi lại đèn hỏng. Và lẫn ở giữa, một tin báo có mùi khét dưới hầm."
- **Âm:** ping dồn dập nhỏ dần; một nhịp lặng khi tin căn 1402 trôi mất.

### Cảnh 2 · Vấn đề (0:14–0:27 · lời 12,6 s) · animation
- **Hình:** ba biểu tượng lần lượt: **Trôi** (tin khẩn lẫn trong tin thường) · **Trùng** (nhiều người báo một bóng đèn) · **Chuyền tay** (không biết việc đang ở đâu).
- **Lời:** "Ban quản lý không thiếu người làm. Cái thiếu là một cách đọc hết, lọc đúng và không bỏ sót. Tin khẩn bị trôi, một bóng đèn được báo nhiều lần, và không ai biết việc đang nằm ở đâu."

### Cảnh 3 · Giới thiệu (0:27–0:38 · lời 9,9 s) · animation
- **Hình:** logo + **MaintenanceOps Agent**, tagline gõ chữ *"Agent đọc hiểu — con người quyết định."* Đồng hồ quay về 21:00, chữ nhỏ "Cùng buổi tối ấy". Nhạc sáng lên.
- **Lời:** "Cùng buổi tối ấy, nhưng lần này cư dân báo qua MaintenanceOps Agent: một trợ lý AI đọc mọi phản ánh, xếp vào đúng chỗ, và để con người quyết định cuối cùng."

### Cảnh 4 · Cư dân gửi phản ánh (0:38–0:52 · lời 10,5 s) · UI điện thoại `/app/`
- **Hình:** khung điện thoại giữa nền xanh nhạt, đã đăng nhập. Chị Minh Anh chạm **Tầng của tôi → Hành lang** (tòa, tầng lấy sẵn từ hồ sơ) → gõ **không dấu** "den hanh lang tang 12 tat het roi, toi di lai so lam" → đính ảnh ("Ảnh mô phỏng") → Gửi → mã `SIM-TKT-…` hiện ra, camera phóng vào mã.
- **Lời:** "Chị Minh Anh không cần chọn danh mục hay điền biểu mẫu dài. Chị viết như nhắn tin, kể cả không dấu, đính một tấm ảnh, và nhận ngay mã phản ánh để theo dõi."

### Cảnh 5 · Agent đọc hiểu (0:52–1:09 · lời 14,9 s) · animation chồng lên portal Tiếp nhận
- **Hình:** dải 7 bước sáng lần lượt, một chấm sáng chạy qua: *An toàn → Dữ liệu → Phân loại → Trùng lặp → Tài sản → Vật tư → Giao việc*. Thẻ Agent trượt vào với **giá trị lấy từ quyết định Agent thật** của ticket cảnh 4 (OPERATIONS §3 bước R2): vị trí, việc → phòng, ưu tiên, *Căn cứ để kiểm tra* (trích nguyên văn). Rồi thu về màn Tiếp nhận thật, con trỏ chỉ vào ticket.
- **Lời:** "Phía sau, Agent đọc phản ánh như một nhân viên tiếp nhận có kinh nghiệm: kiểm tra an toàn trước, xác định vị trí, hiểu đây là việc chiếu sáng, kiểm tra kho còn vật tư, rồi đề xuất giao Phòng Kỹ thuật. Mỗi đề xuất đều kèm căn cứ để người kiểm lại."

### Cảnh 6 · Báo trùng (1:09–1:24 · lời 13,5 s) · animation + portal Tiếp nhận
- **Hình:** đồng hồ 21:03. Điện thoại chú căn 1402 gửi "Đèn hành lang tầng 12 tòa S2.05 tắt hết rồi". Hai thẻ bay vào, chồng lên nhau, huy hiệu đếm **1 → 2 người cùng báo**. Màn Tiếp nhận thật: chị Thu Trang bấm xác nhận gộp.
- **Lời:** "Vài phút sau, chú ở căn 1402 cũng báo đúng bóng đèn ấy. Agent nhận ra hai phản ánh trùng nhau, đếm số người đã báo, và chờ chị Thu Trang xác nhận gộp. Phòng Kỹ thuật chỉ nhận một việc."
- Số người cùng báo hiện trên hình = số thật trên portal lúc quay (B3).

### Cảnh 7 · Khẩn cấp ở hầm B1, ba góc nhìn (1:24–2:28, 64 s · lời 57,9 s) · cao trào

Cảnh cắt xen giữa ba góc. Mỗi góc có **dải nhãn góc trên trái** cố định màu theo góc để người xem không lạc:
- 🟥 **HIỆN TRƯỜNG** (minh hoạ vẽ tay phẳng + cận cảnh điện thoại thật),
- 🟦 **HỆ THỐNG** (animation dải 7 bước + thẻ dữ liệu thật),
- 🟩 **CON NGƯỜI** (khung laptop/điện thoại portal thật của người có trách nhiệm + minh hoạ người ở hiện trường).

Đồng hồ góc phải chạy liên tục qua mọi góc (C4).

| # | Thời điểm | Góc | Hình (BẮT BUỘC) | Lời |
|---|---|---|---|---|
| 7.1 | 1:24–1:34 · 21:05 | 🟥 | Minh hoạ: tầng hầm B1, dãy xe máy, tủ điện ghi "B1-02". Chú căn 1402 dắt xe, khựng lại, khói mỏng bốc từ khe tủ, **tia lửa lóe** 2 lần (hạt sáng). Chú rút điện thoại. Nhạc tắt, còn nhịp trầm. | *(ngắt một nhịp)* "Chín giờ năm phút. Dưới hầm B1, chú ở căn 1402 ngửi thấy mùi khét, rồi thấy tia lửa lóe ở tủ điện." |
| 7.2 | 1:34–1:38 | 🟥 | Cận cảnh app thật (crop, không thanh tên): gõ "Hầm B1 có mùi khét, thấy lóe lửa ở tủ điện chỗ để xe máy, mọi người cẩn thận" → Gửi → app hiện đúng lời cư dân thấy: "Phản ánh đang được kiểm tra." | "Lần này, chú báo ngay trên ứng dụng." |
| 7.3 | 1:38–1:47 | 🟦 | Thẻ phản ánh rơi vào dải 7 bước; chấm sáng tới **An toàn** ⇒ chuyển **đỏ**; 6 bước còn lại mờ đi; chấm nhảy thẳng sang ô **Ban quản lý**, bỏ qua ô Tiếp nhận. Nhãn nhỏ: "Không chờ AI, không xếp hàng". | "Mọi phản ánh đều qua bước an toàn trước tiên. Có dấu hiệu cháy, ca này đi thẳng tới Ban quản lý, không xếp hàng chờ ai." |
| 7.4 | 1:47–1:52 · 21:06 | 🟥 | Chia đôi: trái minh hoạ chị Minh Anh xuống hầm lấy xe, che mũi; phải app thật: "Tủ điện hầm B1 bốc khói, khét lắm". | "Một phút sau, chị Minh Anh xuống lấy xe và cũng báo." |
| 7.5 | 1:52–2:03 | 🟦 | Thẻ thứ hai vào, cũng đỏ, cũng tới BQL. Một đường nối mảnh giữa hai thẻ, nhãn **"Nghi trùng · cùng vị trí"**; huy hiệu ca gốc **"2 người cùng báo"**. Thẻ nhỏ "Agent đọc thêm: việc điện → Phòng Kỹ thuật" hiện mờ ở góc với chữ "ghi chú cho người, không đổi mức khẩn cấp". | "Hệ thống thấy hai ca cùng một chỗ, đánh dấu nghi trùng nhưng không tự gộp. Agent đọc thêm để ghi chú đây là việc điện, còn mức khẩn cấp thì nó không được đụng tới." |
| 7.6 | 2:03–2:10 | 🟩 | Khung laptop portal BQL thật: thẻ viền đỏ **Khẩn cấp**, dòng "2 người cùng báo"; anh Long gõ ghi chú, bấm **Gộp vào SIM-TKT-…**. Rồi minh hoạ: anh Long cầm điện thoại gọi, nhãn **"Gọi điện, ngoài hệ thống"**. | "Anh Long ở Ban quản lý thấy ngay ca khẩn cấp, gộp hai phản ánh làm một, và gọi kỹ thuật xuống hiện trường." |
| 7.7 | 2:10–2:14 · 21:20 | 🟥 | Minh hoạ: anh Hùng kỹ thuật ngắt cầu dao tổng của tủ B1-02, xịt bình chữa cháy; khói tan, tia lửa tắt. | "Anh Hùng ngắt điện tủ và dập đám khói ngay tại chỗ." |
| 7.8 | 2:14–2:19 | 🟩 | Portal BQL thật: anh Long ghi "Kỹ thuật đã ngắt điện tủ B1-02, không cháy lan" → bấm **Đóng khẩn cấp (đã xử lý)**. Cắt sang điện thoại chú 1402 nhận thông báo. | "Chỉ khi hiện trường đã an toàn, chính anh Long mới đóng ca khẩn cấp." |
| 7.9 | 2:19–2:22 · 07:30 | 🟥 | Sáng hôm sau, app thật của chú 1402: "Đèn khu để xe hầm B1 tắt hết, sàn còn nhiều bột trắng và nước, nhờ sửa đèn và dọn giúp". | "Sáng hôm sau, còn lại hai việc." |
| 7.10 | 2:22–2:28 | 🟦→🟩 | Thẻ **tách đôi**: nửa xanh dương trượt sang laptop **Phòng Kỹ thuật** (anh Hùng, cột Cần nhận), nửa còn lại sang laptop **Phòng Vệ sinh** (chị Lan). Hai khung portal thật đặt cạnh nhau. | "Agent tách đôi: sửa đèn cho kỹ thuật, dọn sàn cho vệ sinh." |

**Thẻ số đo** (chèn 3 s cuối 7.3 hoặc đè mờ lên 7.5, chọn ở bước dựng; đếm 0/16 vs 16/16):
> Bộ thử 16 câu báo cháy viết kiểu đời thường · **Luật từ khoá:** nhận đúng 0/16 · **Agent:** nhận đúng 16/16 · *Bộ thử nội bộ 07/10/2026, chưa phải nhãn độc lập.*

**Ràng buộc cảnh 7 (BẮT BUỘC):**
- Mọi chữ trên khung portal/app ở góc 🟦🟩 là **màn hình thật lúc quay**: mã ticket, "2 người cùng báo", nút "Gộp vào …", nút "Đóng khẩn cấp (đã xử lý)", nhãn trạng thái. CẤM vẽ lại portal bằng HTML giả.
- Góc 🟥 là minh hoạ ⇒ góc dưới phải có nhãn **"Minh hoạ"**. Cuộc gọi ở 7.6 có nhãn **"Gọi điện, ngoài hệ thống"**: sản phẩm KHÔNG điều người tới hiện trường, chỉ báo BQL (B4).
- Lời KHÔNG được nói "hệ thống/Agent điều kỹ thuật", "Agent đóng ca", "Agent gộp". Người làm: anh Long gộp, anh Long đóng, anh Hùng xử lý.
- Nếu lúc diễn tập (OPERATIONS §3) hệ thống làm khác bảng trên (vd 7.5 không ra "nghi trùng", 7.10 không tách) ⇒ **sửa lời và hình theo cái thật đã xảy ra** hoặc đổi câu cư dân trong danh sách thay thế (OPERATIONS §3.2) rồi chạy lại. CẤM dựng hình giả cho khớp kịch bản.

### Cảnh 8 · Vòng khép kín (2:28–2:42 · lời 12,4 s) · portal, dựng nhanh
- **Hình:** sáng hôm sau, ticket đèn tầng 12 của chị Minh Anh: Kỹ thuật **Nhận việc** → chọn vật tư đã dùng → ảnh sau sửa → Báo hoàn thành → BQL **Nghiệm thu** → điện thoại chị Minh Anh nhận thông báo, xem hành trình, chấm 5 sao.
- **Lời:** "Đèn tầng 12 cũng được xử lý: kỹ thuật nhận việc, ghi vật tư đã dùng, chụp ảnh sau khi sửa. Ban quản lý nghiệm thu dựa trên bằng chứng, và chị Minh Anh xem lại toàn bộ hành trình rồi đánh giá."

### Cảnh 9 · Toàn cảnh cho Ban quản lý (2:42–2:52 · lời 8,7 s) · portal BQL
- **Hình:** Tổng quan BQL: việc theo phòng, ô "Agent gợi ý đúng" (đúng/sai cạnh %). Camera phóng vào ô Agent.
- **Lời:** "Với Ban quản lý, mọi thứ nằm trên một màn hình, kể cả Agent đã đề xuất đúng bao nhiêu lần, để niềm tin vào AI được đo chứ không phải đoán."

### Cảnh 10 · Kết (2:52–3:05 · lời 9,6 s) · animation
- **Hình:** ba dòng hiện lần lượt: **Không bỏ sót tin khẩn.** · **Không làm một việc nhiều lần.** · **Mọi quyết định đều có dấu vết.** → logo, tên nhóm (Như Ý · Trường · Châm Anh · Trí), "Dự án P-151 · AI20K · Dữ liệu mô phỏng".
- **Lời:** "MaintenanceOps Agent. Không bỏ sót tin khẩn. Không làm một việc nhiều lần. Và mọi quyết định đều có dấu vết."

## 4. Nguồn số đo trên màn hình (bất biến B3)
| Số | Nguồn |
|---|---|
| Luật 0/16 · Agent 16/16 | [`planning/06_…/evidence/G-LIVE/run-20261007-2228-agy-gemini-prompt5-A2.txt`](../../06_2026-10-05_reasoning-agent/evidence/G-LIVE/run-20261007-2228-agy-gemini-prompt5-A2.txt) dòng SUMMARY (`rule_correct=0`, 15 UNCLEAR + 1 NONE) |
| "2 người cùng báo" (cảnh 6, 7), thẻ Agent cảnh 5, ô "Agent gợi ý đúng" | màn hình thật lúc quay; bản ghi quyết định Agent lưu ở `evidence/V4/` (OPERATIONS §3 R6) |
Không dùng số nào khác.

## 5. Bản dọc 45 giây
Cảnh 1 (rút 8 s) → Cảnh 7.1–7.8 (bỏ 7.9–7.10, giữ thẻ số đo) → Cảnh 10. Phụ đề đốt cứng, chữ to.

## 6. Vùng cấm của kịch bản
- Không nói "tiết kiệm X% thời gian", "giảm X% chi phí": không có số đo (B3).
- Không nói "Agent tự xử lý / tự gộp / tự đóng / điều người": gộp do người (Tiếp nhận, BQL), khẩn cấp do BQL, đi hiện trường là việc của người (B4).
- Không quay cảnh đăng nhập (B2).
- **Không đưa "giữ ticket thường cùng chỗ chờ khẩn cấp" (hồ sơ 23 P03) vào video:** cần Agent đọc xong ca khẩn cấp (~20 s) trước ticket thứ ba, dễ lệch khi quay LLM thật, và cảnh 7 đã 64 s. Đã cân nhắc, quyết định không làm.
- **Không dùng nút "Hạ mức (báo động giả)" để chuyển ca cháy sang sửa chữa:** nhãn nút nói "báo động giả", sai nghĩa với sự cố thật. Việc sửa sau sự cố đi qua phản ánh mới (7.9).
- Không đưa Kho/định mức thành cảnh riêng: chỉ lướt trong cảnh 8.

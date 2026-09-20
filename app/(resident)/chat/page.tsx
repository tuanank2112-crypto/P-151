// app/(resident)/chat/page.tsx — URL /chat (route group không vào URL).
// Khung tồn tại, build xanh, phân quyền đúng vai (handoff §2). Nội dung hội
// thoại thật + trích dẫn (R3/R4/R5/R6) thuộc P02.
export default function ChatPage() {
  return (
    <main>
      <h1>Trò chuyện với trợ lý cư dân</h1>
      <p>
        Khung giao diện của gói P01a. Luồng hỏi–đáp, trích dẫn, lịch sử hội
        thoại và cổng escalate do gói P02 bồi thêm.
      </p>
    </main>
  );
}


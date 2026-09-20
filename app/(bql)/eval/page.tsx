// app/(bql)/eval/page.tsx — URL /eval. Khung tồn tại, build xanh, phân
// quyền đúng vai. Bảng eval faithfulness/relevance (R9) thuộc P04, đọc thẳng
// `answer_turns.s3_faithfulness` (BB-06) — không dựng bộ chấm riêng.
export default function EvalPage() {
  return (
    <main>
      <h1>Bảng eval</h1>
      <p>
        Khung giao diện của gói P01a. Số faithfulness/relevance trên Golden
        (R9) do gói P04 bồi thêm.
      </p>
    </main>
  );
}

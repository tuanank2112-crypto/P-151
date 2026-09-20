// app/(bql)/dashboard/page.tsx — URL /dashboard. Khung tồn tại, build xanh,
// phân quyền đúng vai. Dashboard tỉ lệ tự động giải quyết, tách theo intent
// và reason_code (R10) thuộc P04.
export default function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
      <p>
        Khung giao diện của gói P01a. Tỉ lệ tự động giải quyết theo intent và
        lý do escalate (R10) do gói P04 bồi thêm.
      </p>
    </main>
  );
}

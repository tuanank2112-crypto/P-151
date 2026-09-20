// app/(bql)/documents/page.tsx — URL /documents. Khung tồn tại, build xanh,
// phân quyền đúng vai. Vòng đời tài liệu (upload/đổi version/status, R7)
// thuộc P03.
export default function DocumentsPage() {
  return (
    <main>
      <h1>Quản lý tài liệu tri thức</h1>
      <p>
        Khung giao diện của gói P01a. Upload, đổi phiên bản và đổi trạng thái
        tài liệu (ảnh hưởng ngay tới retrieval, R7) do gói P03 bồi thêm.
      </p>
    </main>
  );
}

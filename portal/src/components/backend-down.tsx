/** Shown instead of a dashboard when the backend cannot be reached (SPEC-P02 §1) */
export function BackendDown({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-6">
      <div role="alert" className="max-w-[460px] rounded-3xl bg-white p-9 text-center" style={{ boxShadow: "0 8px 30px rgba(15,30,60,0.10)" }}>
        <h1 className="m-0 text-xl font-bold">Không kết nối được máy chủ</h1>
        <p className="mt-2 text-sm text-muted">{message || "Vui lòng thử lại sau ít phút."}</p>
        <a href="" className="btn primary mt-4 inline-block">
          Thử lại
        </a>
      </div>
    </div>
  );
}

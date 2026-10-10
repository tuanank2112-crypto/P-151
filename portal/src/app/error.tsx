"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl p-6"><section className="card flex flex-col gap-4 p-6"><h1 className="m-0 text-2xl font-bold">Chưa tải được dữ liệu</h1><p className="m-0">Không thể kết nối backend hoặc phiên đăng nhập đã hết. Vui lòng tải lại hoặc đăng nhập lại.</p><button className="btn primary" onClick={reset}>Thử tải lại</button><a href="/login">Đăng nhập lại</a></section></main>;
}

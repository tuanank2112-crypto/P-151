// app/(bql)/layout.tsx — chặn vai `resident` khỏi vùng BQL (E5 AuthzError,
// 00-ARCHITECTURE.md §8). Dùng `cookies()` nên bắt buộc dynamic.
//
// H16 W2 (G35) — toàn app không có thẻ `<a>`/`<Link>`: BQL vào `/documents`
// không có đường sang `/review`/`/dashboard`/`/eval`, không có nút đăng
// xuất. Thêm thanh nav 4 link + email đang đăng nhập + nút đăng xuất
// (`POST /api/auth/logout`, đã tồn tại — chỉ thêm form gọi nó).
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionPayload } from "../../lib/auth/guard";
import { getUserEmail } from "../../lib/adapters/bql-store.ts";

export const dynamic = "force-dynamic";

export default async function BqlLayout({ children }: { children: ReactNode }) {
  const session = await getSessionPayload();
  if (!session) {
    redirect("/login");
  }
  if (session.role !== "bql") {
    redirect("/chat");
  }
  const email = await getUserEmail(session.user_id);
  return (
    <>
      <header className="bql-nav">
        <nav className="bql-nav__links">
          <Link href="/documents">Tài liệu</Link>
          <Link href="/review">Hàng đợi duyệt</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/eval">Eval</Link>
        </nav>
        <div className="bql-nav__session">
          {email && <span className="bql-nav__email">{email}</span>}
          <form method="post" action="/api/auth/logout">
            <button type="submit" className="btn btn--ghost">
              Đăng xuất
            </button>
          </form>
        </div>
      </header>
      {children}
    </>
  );
}

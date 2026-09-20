// app/(resident)/layout.tsx — chặn vai `bql` khỏi vùng cư dân (E5 AuthzError,
// 00-ARCHITECTURE.md §8). Dùng `cookies()` nên bắt buộc dynamic.
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionPayload } from "../../lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function ResidentLayout({ children }: { children: ReactNode }) {
  const session = await getSessionPayload();
  if (!session) {
    redirect("/login");
  }
  if (session.role !== "resident") {
    redirect("/documents");
  }
  return <>{children}</>;
}

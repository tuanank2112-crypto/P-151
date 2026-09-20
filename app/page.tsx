// app/page.tsx — điểm vào gốc, điều hướng theo vai (BB không có, nhưng đúng
// tinh thần R2: hai vai, hai giao diện). Dùng `cookies()` (qua getSessionPayload)
// nên route này BẮT BUỘC dynamic — không được prerender lúc `npm run build`
// (handoff §3 W2).
import { redirect } from "next/navigation";
import { getSessionPayload } from "../lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const session = await getSessionPayload();
  if (!session) {
    redirect("/login");
  }
  redirect(session.role === "resident" ? "/chat" : "/documents");
}

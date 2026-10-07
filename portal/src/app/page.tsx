import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/shell";
import { ROLE_HOME } from "@/lib/constants";
import { getSessionUser } from "@/server/session";

async function RouteByRole(): Promise<null> {
  const user = await getSessionUser();
  redirect(user ? ROLE_HOME[user.role] : "/login");
}

export default function Home() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <RouteByRole />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/shell";
import { receptionData } from "@/server/queries";
import { requireUser } from "@/server/session";
import { ReceptionApp } from "./reception-app";

export const metadata: Metadata = { title: "Ban tiếp nhận · Cổng phản ánh cư dân" };

async function Reception() {
  const user = await requireUser(["reception"]);
  return <ReceptionApp data={await receptionData(user)} />;
}

/** Reception.dc.html */
export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Reception />
    </Suspense>
  );
}

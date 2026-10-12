import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/shell";
import { receptionData } from "@/server/data/reception";
import { BackendDown } from "@/components/backend-down";
import { safe } from "@/server/data/safe";
import { requireUser } from "@/server/session";
import { ReceptionApp } from "./reception-app";

export const metadata: Metadata = { title: "Ban tiếp nhận · Cổng phản ánh cư dân" };

async function Reception() {
  const user = await requireUser(["reception"]);
  const res = await safe(() => receptionData(user));
  return res.ok ? <ReceptionApp data={res.data} /> : <BackendDown message={res.message} />;
}

/** Reception.dc.html */
export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Reception />
    </Suspense>
  );
}

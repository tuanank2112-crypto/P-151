import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/shell";
import { deptData } from "@/server/data/departments";
import { BackendDown } from "@/components/backend-down";
import { safe } from "@/server/data/safe";
import { requireUser } from "@/server/session";
import { TechnicalApp } from "./technical-app";

export const metadata: Metadata = { title: "Phòng kỹ thuật · Cổng phản ánh cư dân" };

async function Technical() {
  const user = await requireUser(["technical"]);
  const res = await safe(() => deptData(user));
  return res.ok ? <TechnicalApp data={res.data} /> : <BackendDown message={res.message} />;
}

/** Technical.dc.html */
export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Technical />
    </Suspense>
  );
}

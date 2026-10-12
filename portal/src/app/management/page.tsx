import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/shell";
import { managementData } from "@/server/data/management";
import { BackendDown } from "@/components/backend-down";
import { safe } from "@/server/data/safe";
import { requireUser } from "@/server/session";
import { ManagementApp } from "./management-app";

export const metadata: Metadata = { title: "Ban quản lý · Cổng phản ánh cư dân" };

async function Management() {
  const user = await requireUser(["management"]);
  const res = await safe(() => managementData(user));
  return res.ok ? <ManagementApp data={res.data} /> : <BackendDown message={res.message} />;
}

/** Management.dc.html */
export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Management />
    </Suspense>
  );
}

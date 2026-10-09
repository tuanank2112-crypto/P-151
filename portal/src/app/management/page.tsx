import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/shell";
import { managementData } from "@/server/queries";
import { requireUser } from "@/server/session";
import { ManagementApp } from "./management-app";

export const metadata: Metadata = { title: "Ban quản lý · Cổng phản ánh cư dân" };

async function Management() {
  const user = await requireUser(["management"]);
  return <ManagementApp data={await managementData(user)} />;
}

/** Management.dc.html */
export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Management />
    </Suspense>
  );
}

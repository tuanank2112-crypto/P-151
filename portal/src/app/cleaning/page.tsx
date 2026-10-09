import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/shell";
import { deptData } from "@/server/data/departments";
import { BackendDown } from "@/components/backend-down";
import { safe } from "@/server/data/safe";
import { requireUser } from "@/server/session";
import { CleaningApp } from "./cleaning-app";

export const metadata: Metadata = { title: "Phòng vệ sinh · Cổng phản ánh cư dân" };

async function Cleaning() {
  const user = await requireUser(["cleaning"]);
  const res = await safe(() => deptData(user));
  return res.ok ? <CleaningApp data={res.data} /> : <BackendDown message={res.message} />;
}

/** Cleaning.dc.html */
export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Cleaning />
    </Suspense>
  );
}

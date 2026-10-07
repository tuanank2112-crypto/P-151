import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/shell";
import { deptData } from "@/server/queries";
import { requireUser } from "@/server/session";
import { CleaningApp } from "./cleaning-app";

export const metadata: Metadata = { title: "Phòng vệ sinh · Cổng phản ánh cư dân" };

async function Cleaning() {
  const user = await requireUser(["cleaning"]);
  return <CleaningApp data={await deptData(user)} />;
}

/** Cleaning.dc.html */
export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Cleaning />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/shell";
import { deptData } from "@/server/queries";
import { requireUser } from "@/server/session";
import { TechnicalApp } from "./technical-app";

export const metadata: Metadata = { title: "Phòng kỹ thuật · Cổng phản ánh cư dân" };

async function Technical() {
  const user = await requireUser(["technical"]);
  return <TechnicalApp data={await deptData(user)} />;
}

/** Technical.dc.html */
export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Technical />
    </Suspense>
  );
}

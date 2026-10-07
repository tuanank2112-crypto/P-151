import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/shell";
import { residentData } from "@/server/queries";
import { requireUser } from "@/server/session";
import { ResidentApp } from "./resident-app";

export const metadata: Metadata = { title: "Cư dân · Cổng phản ánh cư dân" };

async function Resident() {
  const user = await requireUser(["resident"]);
  return <ResidentApp data={await residentData(user)} />;
}

/** Resident.dc.html */
export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Resident />
    </Suspense>
  );
}

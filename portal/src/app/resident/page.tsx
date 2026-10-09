import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/shell";
import { residentData } from "@/server/data/resident";
import { BackendDown } from "@/components/backend-down";
import { safe } from "@/server/data/safe";
import { requireUser } from "@/server/session";
import { ResidentApp } from "./resident-app";

export const metadata: Metadata = { title: "Cư dân · Cổng phản ánh cư dân" };

async function Resident() {
  const user = await requireUser(["resident"]);
  const res = await safe(() => residentData(user));
  return res.ok ? <ResidentApp data={res.data} /> : <BackendDown message={res.message} />;
}

/** Resident.dc.html */
export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Resident />
    </Suspense>
  );
}

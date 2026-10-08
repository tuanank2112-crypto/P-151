import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/shell";
import { warehouseData } from "@/server/queries";
import { requireUser } from "@/server/session";
import { WarehouseApp } from "./warehouse-app";

export const metadata: Metadata = { title: "Kho vật tư · Cổng phản ánh cư dân" };

async function Warehouse() {
  const user = await requireUser(["warehouse", "management"]);
  return <WarehouseApp data={await warehouseData(user)} />;
}

export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Warehouse />
    </Suspense>
  );
}

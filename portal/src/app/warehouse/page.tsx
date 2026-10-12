import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/shell";
import { warehouseData } from "@/server/data/warehouse";
import { BackendDown } from "@/components/backend-down";
import { safe } from "@/server/data/safe";
import { requireUser } from "@/server/session";
import { WarehouseApp } from "./warehouse-app";

export const metadata: Metadata = { title: "Kho vật tư · Cổng phản ánh cư dân" };

async function Warehouse() {
  const user = await requireUser(["warehouse", "management"]);
  const res = await safe(() => warehouseData(user));
  return res.ok ? <WarehouseApp data={res.data} /> : <BackendDown message={res.message} />;
}

export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Warehouse />
    </Suspense>
  );
}

"use client";
import { PythonDashboard } from "@/components/python-dashboard";
import type { DashboardData } from "@/server/backend-dto";
export function CleaningApp({ data }: { data: DashboardData }) { return <PythonDashboard data={data} />; }

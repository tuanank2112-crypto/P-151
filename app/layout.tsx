import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resident Agent v1.0",
  description:
    "Trợ lý AI cho cư dân khu đô thị mô phỏng — demo AI20K Build Phase Cohort 4 (C104/VHR-01/G104).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}

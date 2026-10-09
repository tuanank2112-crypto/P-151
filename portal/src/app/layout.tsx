import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const font = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Cổng phản ánh cư dân",
  description: "Gửi phản ánh, theo dõi xử lý và phân loại ticket bằng Agent theo vai trò.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${font.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}

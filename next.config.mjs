/** @type {import('next').NextConfig} */
// CẤM ignoreBuildErrors / ignoreDuringBuilds (OPERATIONS.md OP-C4) — lỗi phải
// nổ lúc build, không giấu tới lúc demo.
const nextConfig = {
  reactStrictMode: true,
  // G48 — file dữ liệu đọc bằng fs lúc chạy phải được đóng gói vào function
  // serverless; thiếu thì route chết ENOENT trên Vercel (build vẫn xanh).
  outputFileTracingIncludes: {
    "/**": ["./db/seed/**", "./evals/golden/**"],
  },
};

export default nextConfig;

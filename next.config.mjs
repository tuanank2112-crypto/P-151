/** @type {import('next').NextConfig} */
// CẤM ignoreBuildErrors / ignoreDuringBuilds (OPERATIONS.md OP-C4) — lỗi phải
// nổ lúc build, không giấu tới lúc demo.
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;

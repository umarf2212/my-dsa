import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.GITHUB_PAGES === "true"
    ? { output: "export", basePath: "/my-dsa", trailingSlash: true }
    : {}),
};

export default nextConfig;

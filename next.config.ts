import type { NextConfig } from "next";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isUserOrOrgPage = repoName.endsWith(".github.io");
const basePath =
  process.env.GITHUB_ACTIONS && repoName && !isUserOrOrgPage
    ? `/${repoName}`
    : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath,
  assetPrefix: basePath || undefined,
  reactCompiler: true,
};

export default nextConfig;

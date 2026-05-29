import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer relies on Node built-ins and must not be bundled.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;

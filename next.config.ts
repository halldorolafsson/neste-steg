import type { NextConfig } from "next";

const authUrl = process.env.NEXTAUTH_URL;
const allowedDevOrigin = authUrl ? new URL(authUrl).hostname : undefined;

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: allowedDevOrigin ? [allowedDevOrigin] : [],
};

export default nextConfig;

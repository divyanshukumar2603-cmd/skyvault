import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server blocks cross-origin requests for /_next resources by default,
  // which breaks the client bundle when the app is reached over a public IP
  // instead of localhost. Allow the deployment host through.
  allowedDevOrigins: [
    "3.82.212.102",
    ...(process.env.DEPLOY_HOST ? [process.env.DEPLOY_HOST] : []),
  ],
};

export default nextConfig;

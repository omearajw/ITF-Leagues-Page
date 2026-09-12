import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Dev only: lets the HMR socket connect when the dev server is opened via the LAN IP.
  // Without it Next blocks the socket and the dev client refreshes the page in a loop.
  allowedDevOrigins: ['192.168.1.239'],
};

export default nextConfig;

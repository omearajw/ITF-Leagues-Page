import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Keeps Next's established prefetching (whole pages for links in view). Next 16.4 asks for an
  // explicit choice; the newer shell-only mode is untested here.
  partialPrefetching: false,
  // Lifetimes for the site's cached data, in seconds (see lib/site-cache.ts). `stale` is how long a
  // browser reuses a page it already has; `revalidate` is when the server refreshes it in the
  // background; `expire` is when a copy is too old to show at all and a visitor waits for a new one.
  cacheLife: {
    league: { stale: 60, revalidate: 900, expire: 7200 },
    // Live figures are never shown more than two minutes old, so two pages of the same tie can't
    // disagree for long; the first visitor after a quiet spell waits for a fresh copy instead.
    clock: { stale: 30, revalidate: 60, expire: 120 },
    brief: { stale: 30, revalidate: 30, expire: 60 },
  },
  // Dev only: lets the HMR socket connect when the dev server is opened via the LAN IP.
  // Without it Next blocks the socket and the dev client refreshes the page in a loop.
  allowedDevOrigins: ['192.168.1.239'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'fantasy.premierleague.com' },
      { protocol: 'https', hostname: 'resources.premierleague.com' },
    ],
  },
};

export default nextConfig;

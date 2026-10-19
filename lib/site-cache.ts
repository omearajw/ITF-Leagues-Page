import { after } from 'next/server';
import { revalidateTag } from 'next/cache';
import { DIVISIONS } from '@/lib/divisions';

// Every cached read of league data carries this tag, so one call refreshes the whole site.
// The lifetimes it is cached for are the cacheLife profiles in next.config.ts:
//   league  scores, tables and write-ups; the ingest refreshes them every run
//   clock   things FPL changes minute to minute (the gameweek's phase, a team's live points)
//   brief   used instead when FPL could not be reached, so a gap is not kept for long
export const SITE_DATA_TAG = 'itf-data';

// The pages most visitors open, requested once after each ingest so the first real visitor
// gets the new data straight away rather than the copy from before the ingest.
const WARM_PATHS = [
  '/',
  ...DIVISIONS.map(d => `/divisions/${d.slug}`),
  '/itf-open',
  '/motm',
  '/team-of-the-week',
  '/form',
  '/tournaments/eliminator',
  '/tournaments/champions-league',
  '/tournaments/onion-baggers-cup',
];

// Called by the ingest once its writes are done. Marking the tag stale (rather than expiring it)
// keeps pages fast: anyone arriving mid-refresh gets the previous copy, never a slow page. The
// warm-up runs after the ingest has responded, so it adds nothing to the cron job's run time.
export function refreshSiteData(origin: string) {
  revalidateTag(SITE_DATA_TAG, 'max');
  after(async () => {
    await Promise.allSettled(WARM_PATHS.map(path => fetch(new URL(path, origin), { cache: 'no-store', signal: AbortSignal.timeout(20_000) })));
  });
}

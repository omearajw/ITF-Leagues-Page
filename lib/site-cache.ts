import { revalidateTag } from 'next/cache';

// Every cached read of league data carries this tag, so one call refreshes the whole site.
// The lifetimes it is cached for are the cacheLife profiles in next.config.ts:
//   league  scores, tables and write-ups; the ingest refreshes them every run
//   clock   things FPL changes minute to minute (the gameweek's phase, a team's live points)
//   brief   used instead when FPL could not be reached, so a gap is not kept for long
export const SITE_DATA_TAG = 'itf-data';

// Called by the ingest once its writes are done. The cache is expired outright rather than marked
// stale, so the first visitor to each page after an ingest gets the new data (waiting about as
// long as an uncached page took), and everyone after them gets the cached copy. Pages are not
// requested here to pre-build them: that rebuilt all of them on every run, 96 times a day, whether
// anyone visited or not, and multiplied the site's Vercel CPU use several times over.
export function refreshSiteData() {
  revalidateTag(SITE_DATA_TAG, { expire: 0 });
}

const FPL_API = 'https://fantasy.premierleague.com/api';

// FPL slows to a crawl when a round of matches ends and everyone checks at once (Saturday
// full time especially), so a request gets ten seconds and, when FPL is busy or erroring, one
// retry a second later before it counts as failed.
export async function fplGet<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      const res = await fetch(`${FPL_API}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      if (res.ok) return await res.json();
      lastError = new Error(`FPL ${path} responded ${res.status}`);
      if (res.status < 500 && res.status !== 429) break;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

// How old a previously fetched copy may be and still stand in when FPL cannot be reached.
// Long enough to ride out a busy spell, short enough that nobody plans on a stale squad.
export const FPL_FALLBACK_MS = 30 * 60_000;

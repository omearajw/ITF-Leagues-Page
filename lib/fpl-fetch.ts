const FPL_API = 'https://fantasy.premierleague.com/api';

// At most this many FPL requests in flight at once from one server. A cold start used to fire about
// 60 at the same moment (every team's picks and profile); FPL left several unanswered until they
// timed out, and bursts like that are what get a site rate-limited. The rest wait their turn.
const MAX_IN_FLIGHT = 6;
let inFlight = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(work: () => Promise<T>): Promise<T> {
  // A finished request hands its slot straight to the next in the queue, so a newcomer can't slip
  // in between and push the count over the limit.
  if (inFlight < MAX_IN_FLIGHT) inFlight++;
  else await new Promise<void>(resolve => waiting.push(resolve));
  try {
    return await work();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else inFlight--;
  }
}

// FPL slows to a crawl when a round of matches ends and everyone checks at once (Saturday
// full time especially), so a request gets ten seconds and, when FPL is busy or erroring, one
// retry a second later before it counts as failed.
export async function fplGet<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      const res = await withSlot(async () => {
        const r = await fetch(`${FPL_API}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
        return { ok: r.ok, status: r.status, body: r.ok ? await r.json() : null };
      });
      if (res.ok) return res.body as T;
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

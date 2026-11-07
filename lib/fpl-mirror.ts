import { createPublicClient } from '@/utils/supabase/public';

// Our copy of the FPL data the pages use, kept in the fpl_mirror table by /api/fpl-sync, which
// cron-jobs.org runs every minute. Pages read the copy instead of asking FPL: FPL's firewall has
// refused requests from some of the shared Vercel machines pages run on (403s on 7 Nov 2026),
// while one caller a minute is no trouble. If the copy is older than it should be (the job has
// stopped), a page asks FPL itself; if FPL refuses as well, it uses the newest copy it has, of
// any age, and the page says how old it is.
export const MIRROR_TABLE = 'fpl_mirror';

type Timing = { reuse: number; fresh: number };
const MIN = 60_000;
const FOREVER = Number.POSITIVE_INFINITY;

// `reuse`: how long one server reuses a copy it already holds, counted from when it was fetched.
// `fresh`: how old the mirror's copy may be before a page stops trusting it and asks FPL. Each is
// comfortably longer than how often /api/fpl-sync refreshes that kind of data, so pages only go to
// FPL themselves when the job has stopped.
// Keys ending ":final" hold a confirmed week, which never changes.
export function timingFor(key: string): Timing {
  if (key.endsWith(':final')) return { reuse: FOREVER, fresh: FOREVER };
  const kind = key.split(':')[0];
  switch (kind) {
    case 'snapshot': case 'live': case 'gwfix': return { reuse: 50_000, fresh: 3 * MIN };
    case 'players': return { reuse: 10 * MIN, fresh: 20 * MIN };
    case 'picks': return { reuse: 30 * MIN, fresh: 12 * 60 * MIN };
    case 'entry': case 'transfers': return { reuse: 10 * MIN, fresh: 45 * MIN };
    case 'h2h': return { reuse: 60 * MIN, fresh: 24 * 60 * MIN };
    case 'fixtures': return { reuse: 60 * MIN, fresh: 3 * 60 * MIN };
    case 'badges': return { reuse: 60 * MIN, fresh: 12 * 60 * MIN };
    default: return { reuse: MIN, fresh: 3 * MIN };
  }
}

type Copy = { at: number; value: unknown };
const held = new Map<string, Copy>();
const asOf = new Map<string, number>();

// Reads requested together (a team page asks for 30 badge profiles at once) go to the database
// as one query.
let batch: { keys: Set<string>; done: Promise<Map<string, Copy>> } | null = null;
function readMirror(key: string): Promise<Copy | undefined> {
  if (!batch) {
    const keys = new Set<string>();
    const done = new Promise<Map<string, Copy>>(resolve => setTimeout(async () => {
      batch = null;
      const found = new Map<string, Copy>();
      try {
        const { data } = await createPublicClient().from(MIRROR_TABLE).select('key, data, fetched_at').in('key', [...keys]);
        (data || []).forEach((r: any) => found.set(r.key, { at: Date.parse(r.fetched_at), value: r.data }));
      } catch (err) {
        console.error('FPL mirror read failed:', err instanceof Error ? err.message : err);
      }
      resolve(found);
    }, 0));
    batch = { keys, done };
  }
  batch.keys.add(key);
  return batch.done.then(found => found.get(key));
}

function handOut<T>(key: string, copy: Copy): T {
  held.set(key, copy);
  asOf.set(key, copy.at);
  return copy.value as T;
}

export async function mirrored<T>(key: string, load: () => Promise<T>): Promise<T | null> {
  const { reuse, fresh } = timingFor(key);
  const now = Date.now();
  const mine = held.get(key);
  if (mine && now - mine.at < reuse) return handOut<T>(key, mine);

  const theirs = await readMirror(key);
  if (theirs && now - theirs.at <= fresh) return handOut<T>(key, theirs);

  try {
    return handOut<T>(key, { at: Date.now(), value: await load() });
  } catch (err) {
    console.error(`FPL ${key} failed:`, err instanceof Error ? err.message : err);
    const newest = [mine, theirs].filter((c): c is Copy => !!c).sort((a, b) => b.at - a.at)[0];
    return newest ? handOut<T>(key, newest) : null;
  }
}

// When the copy of `key` most recently handed out was fetched from FPL, for "as of" notes.
export function fplAsOf(key: string): number | null {
  return asOf.get(key) ?? null;
}

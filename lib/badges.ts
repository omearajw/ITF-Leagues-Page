import { cache } from 'react';
import { createClient } from '@/utils/supabase/server';
import { SEASON_ID } from '@/lib/gameweek-status';
import { getManagerEntry } from '@/lib/fpl-manager';

// FPL's Adobe Express team badges, keyed by manager id. Badges change rarely, so the
// league-wide map is memoised for an hour; React cache dedupes within a request.
let memo: { at: number; value: Record<number, string> } | null = null;
const TTL = 60 * 60_000;

export const getLeagueBadges = cache(async (): Promise<Record<number, string>> => {
  if (memo && Date.now() - memo.at < TTL) return memo.value;
  const supabase = await createClient();
  const { data } = await supabase.from('season_managers').select('manager_fpl_id').eq('season_id', SEASON_ID);
  const ids = (data || []).map((m: any) => Number(m.manager_fpl_id));
  const entries = await Promise.all(ids.map(id => getManagerEntry(id)));
  // Some badge URLs 404 on FPL's side; a dead one would render as a broken image.
  const checks = await Promise.all(entries.map(async (e, i) => {
    if (!e?.club_badge_src) return null;
    try {
      const res = await fetch(e.club_badge_src, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(5000) });
      return res.ok ? [ids[i], e.club_badge_src] as const : null;
    } catch { return null; }
  }));
  const value: Record<number, string> = {};
  checks.forEach(c => { if (c) value[c[0]] = c[1]; });
  memo = { at: Date.now(), value };
  return value;
});

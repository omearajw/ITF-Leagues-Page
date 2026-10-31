import { cacheLife } from 'next/cache';
import { createPublicClient } from '@/utils/supabase/public';
import { SEASON_ID } from '@/lib/gameweek-status';
import { getManagerEntry } from '@/lib/fpl-manager';

// FPL's Adobe Express team badges, keyed by manager id. Badges change rarely, so the league-wide
// map is kept in the shared cache for six hours: one lookup of every team for the whole site,
// rather than one per server every hour.
export async function getLeagueBadges(): Promise<Record<number, string>> {
  'use cache: remote';
  const supabase = createPublicClient();
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
  // A run where FPL failed for most teams is kept briefly, so the badges come back soon after.
  if (entries.filter(Boolean).length < ids.length / 2) cacheLife('brief');
  else cacheLife({ stale: 300, revalidate: 6 * 3600, expire: 24 * 3600 });
  return value;
}

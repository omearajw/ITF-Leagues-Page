import { createPublicClient } from '@/utils/supabase/public';
import { SEASON_ID } from '@/lib/gameweek-status';
import { getManagerEntry } from '@/lib/fpl-manager';
import { mirrored } from '@/lib/fpl-mirror';

export const BADGES_KEY = 'badges';

// FPL's Adobe Express team badges, keyed by manager id. Checking that each badge image exists
// means a request per team to FPL's servers, so the sync job (/api/fpl-sync) does it every few
// hours and pages read the result from the FPL mirror.
export async function loadLeagueBadges(): Promise<Record<number, string>> {
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
  return value;
}

export async function getLeagueBadges(): Promise<Record<number, string>> {
  return (await mirrored(BADGES_KEY, loadLeagueBadges)) || {};
}

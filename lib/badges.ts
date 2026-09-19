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
  const value: Record<number, string> = {};
  entries.forEach((e, i) => { if (e?.club_badge_src) value[ids[i]] = e.club_badge_src; });
  memo = { at: Date.now(), value };
  return value;
});

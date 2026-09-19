import { createClient } from '@/utils/supabase/server';
import { SEASON_ID } from '@/lib/gameweek-status';
import { getManagerPicks } from '@/lib/fpl-manager';
import { getDivisionFixtures } from '@/lib/h2h-fixtures';

export type LeagueOwnership = Record<number, { owners: number; starters: number; captains: number }>;

// Every league member's latest squad, folded into per-player ownership and captaincy counts.
// This is the league-level view FPL cannot offer.
export async function getLeagueOwnership(gw: number, isFinal: boolean): Promise<{ ownership: LeagueOwnership; managers: number }> {
  const supabase = await createClient();
  const { data: members } = await supabase.from('season_managers').select('manager_fpl_id').eq('season_id', SEASON_ID);
  const ids = (members || []).map((m: any) => Number(m.manager_fpl_id));
  const all = await Promise.all(ids.map(id => getManagerPicks(id, gw, isFinal)));
  const ownership: LeagueOwnership = {};
  let counted = 0;
  all.forEach(picks => {
    if (!picks) return;
    counted++;
    picks.picks.forEach(p => {
      const o = (ownership[p.element] ||= { owners: 0, starters: 0, captains: 0 });
      o.owners++;
      if (p.position <= 11) o.starters++;
      if (p.is_captain) o.captains++;
    });
  });
  return { ownership, managers: counted };
}

export async function getNextOpponent(managerId: number, leagueId: string, gw: number): Promise<number | null> {
  const fixtures = await getDivisionFixtures(leagueId, gw);
  const tie = fixtures?.find(f => f.m1 === managerId || f.m2 === managerId);
  if (!tie) return null;
  return tie.m1 === managerId ? tie.m2 : tie.m1;
}

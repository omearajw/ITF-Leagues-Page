import { cache } from 'react';
import { createClient } from '@/utils/supabase/server';
import { SEASON_ID } from '@/lib/gameweek-status';

export type TotwTeam = {
  id: number;
  teamName: string;
  realName: string;
  division: string;
  points: number;
  benchPoints: number;
  transfersCost: number;
};

export type TeamOfTheWeek = {
  gw: number;
  winners: TotwTeam[];   // more than one when the top score is shared
  nextBest: number | null;
  average: number;
  entries: number;
};

// The team (or teams) with the highest net score in a gameweek, across all three leagues.
export const getTeamOfTheWeek = cache(async (gw: number): Promise<TeamOfTheWeek | null> => {
  if (!gw || gw < 1) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('manager_gw_scores')
    .select('manager_fpl_id, points, bench_points, transfers_cost, season_managers!inner (team_name, division, managers!inner (real_name))')
    .eq('season_id', SEASON_ID)
    .eq('gw_number', gw)
    .order('points', { ascending: false });

  if (!data || data.length === 0) return null;

  const top = data[0].points;
  const winners: TotwTeam[] = data
    .filter((r: any) => r.points === top)
    .map((r: any) => ({
      id: Number(r.manager_fpl_id),
      teamName: r.season_managers.team_name,
      realName: r.season_managers.managers.real_name,
      division: r.season_managers.division,
      points: r.points,
      benchPoints: r.bench_points ?? 0,
      transfersCost: r.transfers_cost ?? 0,
    }))
    .sort((a, b) => a.teamName.localeCompare(b.teamName));

  const below = data.find((r: any) => r.points < top);
  return {
    gw,
    winners,
    nextBest: below ? below.points : null,
    average: Math.round(data.reduce((s: number, r: any) => s + r.points, 0) / data.length),
    entries: data.length,
  };
});

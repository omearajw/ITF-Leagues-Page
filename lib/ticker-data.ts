import { cache } from 'react';
import { createClient } from '@/utils/supabase/server';
import { getGameweekStatus, getFplEvents, SEASON_ID } from '@/lib/gameweek-status';
import { getDivisionFixtures } from '@/lib/h2h-fixtures';
import { buildMotm } from '@/lib/motm';
import { DIVISIONS } from '@/lib/divisions';
import { getTeamNameDisplayText } from '@/components/TeamName';

export type TickerLive = {
  gw: number;
  isLive: boolean;
  divisions: { name: string; ties: { home: string; away: string; homeScore: number | null; awayScore: number | null }[] }[];
};
export type TickerMotm = { label: string; complete: boolean; divisions: { name: string; podium: string[] }[] } | null;

// Everything the bottom ticker can show: the Manager of the Month race and this week's H2H ties.
export const getTickerData = cache(async (): Promise<{ motm: TickerMotm; live: TickerLive }> => {
  const supabase = await createClient();
  const [gw, events, { data: managerRows }, { data: scoreRows }] = await Promise.all([
    getGameweekStatus(),
    getFplEvents(),
    supabase.from('season_managers').select('manager_fpl_id, team_name, division, managers!inner (real_name)').eq('season_id', SEASON_ID),
    supabase.from('manager_gw_scores').select('manager_fpl_id, gw_number, points').eq('season_id', SEASON_ID),
  ]);
  const names: Record<number, string> = {};
  (managerRows || []).forEach((m: any) => { names[Number(m.manager_fpl_id)] = getTeamNameDisplayText(m.team_name); });

  let motm: TickerMotm = null;
  if (events) {
    const months = buildMotm({
      events, syncedThroughGw: gw.syncedThroughGw,
      managers: (managerRows || []).map((m: any) => ({ id: Number(m.manager_fpl_id), teamName: m.team_name, realName: m.managers.real_name, division: m.division })),
      scores: (scoreRows || []).filter((s: any) => s.gw_number <= gw.syncedThroughGw).map((s: any) => ({ manager_fpl_id: Number(s.manager_fpl_id), gw_number: s.gw_number, points: s.points })),
      divisions: DIVISIONS.map(d => d.name),
    });
    const current = months[0];
    if (current) {
      motm = { label: current.label, complete: current.complete, divisions: current.divisions.map(d => ({ name: d.division, podium: d.standings.slice(0, 3).map((m, i) => `${i + 1}. ${m.realName} (${m.points})`) })) };
    }
  }

  const weekGw = gw.displayGw;
  const weekScores: Record<number, number> = {};
  (scoreRows || []).filter((s: any) => s.gw_number === weekGw).forEach((s: any) => { weekScores[Number(s.manager_fpl_id)] = s.points; });
  const fixtureLists = await Promise.all(DIVISIONS.map(d => getDivisionFixtures(d.fplId, weekGw)));
  const live: TickerLive = {
    gw: weekGw,
    isLive: weekGw === gw.liveGw,
    divisions: DIVISIONS.map((d, i) => ({
      name: d.name,
      ties: (fixtureLists[i] || []).map(f => ({
        home: names[f.m1] || f.name1, away: names[f.m2] || f.name2,
        homeScore: weekScores[f.m1] ?? null, awayScore: weekScores[f.m2] ?? null,
      })),
    })),
  };

  return { motm, live };
});

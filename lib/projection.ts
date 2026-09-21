import { cache } from 'react';
import { createClient } from '@/utils/supabase/server';
import { getGameweekStatus, SEASON_ID } from '@/lib/gameweek-status';
import { getPlayers, getManagerPicks, getLivePoints, getGwFixtureStatus, type Player, type TeamGwFixture } from '@/lib/fpl-manager';
import { projectAutoSubs, type FixtureState } from '@/lib/autosubs';

export type WeekDue = { due: number; undecided: number; benchBoost: boolean };
export type WeekProjection = { gw: number; byManager: Record<number, WeekDue> };

const EMPTY: WeekProjection = { gw: 0, byManager: {} };
let memo: { at: number; value: WeekProjection } | null = null;
const TTL = 60_000;

function stateFor(pl: Player | undefined, status: Record<number, TeamGwFixture[]> | null): FixtureState {
  if (!status) return 'finished';
  const list = pl ? status[pl.teamId] || [] : [];
  if (list.length === 0) return 'none';
  if (list.some(f => f.started && !f.finished)) return 'playing';
  if (list.some(f => !f.started)) return 'pending';
  return 'finished';
}

// Certain bench points due for every league manager in the week in progress. Used by
// every page that shows a live score, so they all agree with the manager page.
export const getWeekProjection = cache(async (): Promise<WeekProjection> => {
  const gw = await getGameweekStatus();
  if (!gw.liveGw) return EMPTY;
  if (memo && memo.value.gw === gw.liveGw && Date.now() - memo.at < TTL) return memo.value;

  const supabase = await createClient();
  const [{ data: members }, players, live, status] = await Promise.all([
    supabase.from('season_managers').select('manager_fpl_id').eq('season_id', SEASON_ID),
    getPlayers(),
    getLivePoints(gw.liveGw, false),
    getGwFixtureStatus(gw.liveGw, false),
  ]);
  if (!players || !live) return EMPTY;

  const ids = (members || []).map((m: any) => Number(m.manager_fpl_id));
  const picks = await Promise.all(ids.map(id => getManagerPicks(id, gw.liveGw as number, false)));
  const byManager: Record<number, WeekDue> = {};
  picks.forEach((set, i) => {
    if (!set) return;
    // FPL applies the real substitutions once every match has finished; the picks then
    // already reflect them, so there is nothing left to project.
    if (set.automatic_subs.length > 0) { byManager[ids[i]] = { due: 0, undecided: 0, benchBoost: set.active_chip === 'bboost' }; return; }
    const projection = projectAutoSubs(set.picks.map(p => {
      const pl = players[p.element];
      return {
        element: p.element, position: p.position, role: pl?.position || 'MID',
        minutes: live[p.element]?.minutes ?? 0, points: live[p.element]?.total_points ?? 0,
        fixtureState: stateFor(pl, status), isCaptain: p.is_captain, isVice: p.is_vice_captain,
      };
    }), set.active_chip);
    byManager[ids[i]] = { due: projection.benchDue + projection.captainExtra, undecided: projection.undecided.length, benchBoost: projection.benchBoost };
  });

  const value = { gw: gw.liveGw, byManager };
  memo = { at: Date.now(), value };
  return value;
});

export function dueFor(projection: WeekProjection, gw: number, managerId: number): WeekDue | null {
  if (projection.gw !== gw) return null;
  return projection.byManager[managerId] || null;
}

import { cache } from 'react';
import { cacheLife, cacheTag } from 'next/cache';
import { createPublicClient } from '@/utils/supabase/public';
import { SITE_DATA_TAG } from '@/lib/site-cache';
import { getGameweekStatus, SEASON_ID } from '@/lib/gameweek-status';
import { getPlayers, getManagerPicks, getLivePoints, getGwFixtureStatus, type Player, type TeamGwFixture } from '@/lib/fpl-manager';
import { projectAutoSubs, type FixtureState } from '@/lib/autosubs';

// One team's week in progress, all from the same moment of FPL's live feed: `gross` is the
// players' points (captain doubled), `net` takes off the hits, `bench` is what sits on the bench,
// and `due` is what certain substitutions add. The score shown is `net + due` (liveWeekScore).
// Only certain substitutions count: the league owner wants scores to show what is known, not what
// might still happen, so there is no "maybe" figure alongside.
export type WeekDue = { due: number; benchBoost: boolean; gross: number; hits: number; net: number; bench: number };
export type WeekProjection = { gw: number; byManager: Record<number, WeekDue> };

const EMPTY: WeekProjection = { gw: 0, byManager: {} };

function stateFor(pl: Player | undefined, status: Record<number, TeamGwFixture[]> | null): FixtureState {
  if (!status) return 'finished';
  const list = pl ? status[pl.teamId] || [] : [];
  if (list.length === 0) return 'none';
  if (list.some(f => f.started && !f.finished)) return 'playing';
  if (list.some(f => !f.started)) return 'pending';
  return 'finished';
}

// A team's picks cannot change once the deadline has passed (FPL only applies the automatic
// substitutions after the last match), so they are fetched once and shared rather than every
// minute: about 30 FPL requests a week instead of 30 a minute. Refreshed every half hour so FPL's
// end-of-week substitutions come through; not tied to the ingest, which would refetch every 15
// minutes for nothing.
export async function getLiveWeekPicks(managerId: number, gw: number) {
  'use cache: remote';
  const picks = await getManagerPicks(managerId, gw, false);
  if (picks) cacheLife({ stale: 60, revalidate: 1800, expire: 86400 });
  else cacheLife('brief');
  return picks;
}

// Every league team's live week, worked out once a minute and shared by every page, so the
// tables, fixtures, cups, the Open, the ticker and the team pages all show the same figures from
// the same moment. Costs two FPL requests a minute (the live feed and the fixtures) however many
// people are looking; the picks come from the weekly copy above.
async function loadLiveWeek(): Promise<WeekProjection> {
  'use cache: remote';
  cacheTag(SITE_DATA_TAG);
  const gw = await getGameweekStatus();
  if (!gw.liveGw) { cacheLife('clock'); return EMPTY; }
  const liveGw = gw.liveGw;

  const supabase = createPublicClient();
  const [{ data: members }, players, live, status] = await Promise.all([
    supabase.from('season_managers').select('manager_fpl_id').eq('season_id', SEASON_ID),
    getPlayers(),
    getLivePoints(liveGw, false),
    getGwFixtureStatus(liveGw, false),
  ]);
  if (!players || !live) { cacheLife('brief'); return EMPTY; }

  const ids = (members || []).map((m: any) => Number(m.manager_fpl_id));
  const picks = await Promise.all(ids.map(id => getLiveWeekPicks(id, liveGw)));
  const byManager: Record<number, WeekDue> = {};
  picks.forEach((set, i) => {
    if (!set) return;
    const points = (element: number) => live[element]?.total_points ?? 0;
    const gross = set.picks.reduce((sum, p) => sum + points(p.element) * p.multiplier, 0);
    const hits = set.entry_history.event_transfers_cost || 0;
    const bench = set.picks.filter(p => p.position > 11).reduce((sum, p) => sum + points(p.element), 0);
    const benchBoost = set.active_chip === 'bboost';
    // Once FPL has made the real substitutions the picks already reflect them; nothing to project.
    let due = 0;
    if (set.automatic_subs.length === 0) {
      const projection = projectAutoSubs(set.picks.map(p => {
        const pl = players[p.element];
        return {
          element: p.element, position: p.position, role: pl?.position || 'MID',
          minutes: live[p.element]?.minutes ?? 0, points: points(p.element),
          fixtureState: stateFor(pl, status), isCaptain: p.is_captain, isVice: p.is_vice_captain,
        };
      }), set.active_chip);
      due = projection.benchDue + projection.captainExtra;
    }
    byManager[ids[i]] = { due, benchBoost, gross, hits, net: gross - hits, bench };
  });

  cacheLife('clock');
  return { gw: liveGw, byManager };
}

export const getWeekProjection = cache(loadLiveWeek);

export function dueFor(projection: WeekProjection, gw: number, managerId: number): WeekDue | null {
  if (projection.gw !== gw) return null;
  return projection.byManager[managerId] || null;
}

// The live week's score: FPL's live points net of hits plus certain subs. Falls back to the stored
// score when there is no live figure (not the live week, or FPL unreachable).
export function liveWeekScore(due: WeekDue | null | undefined, stored: number): number {
  return due ? due.net + due.due : stored;
}

// A season total with the live week's stored score swapped for the live one.
export function liveTotal(due: WeekDue | null | undefined, storedTotal: number, storedWeek: number): number {
  return due ? storedTotal - storedWeek + liveWeekScore(due, storedWeek) : storedTotal;
}

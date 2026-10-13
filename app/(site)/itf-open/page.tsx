import { createClient } from '@/utils/supabase/server';
import OpenTable from '@/components/OpenTable';
import { Suspense } from 'react';
import { ITFOpenSkeleton } from '@/components/Skeletons';
import { GameweekChip } from '@/components/GameweekBadge';
import MovementArrow from '@/components/MovementArrow';
import { positionDeltas } from '@/lib/movement';
import { getWeekProjection, dueFor } from '@/lib/projection';
import { getGameweekStatus } from '@/lib/gameweek-status';
import PageHeader from '@/components/PageHeader';
import { compareStanding } from '@/lib/standings';

export default function Index() {
  return (
    <div className="max-w-4xl mx-auto py-2 sm:py-8 font-sans">
      {/* The header renders with the table so the week's status can sit beside the title. */}
      <Suspense fallback={<><PageHeader title="The Open" rules /><ITFOpenSkeleton /></>}>
        <ITFOpenContent />
      </Suspense>
    </div>
  );
}

async function ITFOpenContent() {
  const supabase = await createClient();
  const SEASON_ID = '2026-27';

  const gw = await getGameweekStatus();
  const currentGw = gw.syncedThroughGw;

  // Show the live week's totals when one is in progress; fall back to the synced week
  // if the ingest has not written live rows yet.
  const fetchScores = (gwNumber: number) => supabase
    .from('manager_gw_scores')
    .select(`
      manager_fpl_id,
      points,
      classic_total_points,
      season_managers!inner (
        team_name,
        division,
        managers!inner (
          real_name
        )
      )
    `)
    .eq('season_id', SEASON_ID)
    .eq('gw_number', gwNumber)
    .order('classic_total_points', { ascending: false });

  let scoresGw = gw.displayGw;
  let { data: managers, error } = await fetchScores(scoresGw);
  if (!error && gw.liveGw && (managers?.length ?? 0) === 0) {
    scoresGw = currentGw;
    ({ data: managers, error } = await fetchScores(scoresGw));
  }
  const showingLive = scoresGw === gw.liveGw;
  const projection = showingLive ? await getWeekProjection() : null;
  const dueOf = (id: number) => (projection ? dueFor(projection, scoresGw, Number(id)) : null);
  const withDue = (id: number, value: number) => value + (dueOf(id)?.due || 0);
  // Ranked by the rule every table shares (lib/standings.ts), including subs due while live.
  managers?.sort((a: any, b: any) => compareStanding(
    { total: withDue(a.manager_fpl_id, a.classic_total_points), week: withDue(a.manager_fpl_id, a.points), name: a.season_managers.team_name },
    { total: withDue(b.manager_fpl_id, b.classic_total_points), week: withDue(b.manager_fpl_id, b.points), name: b.season_managers.team_name },
  ));

  // Live totals move against the last confirmed week; a confirmed week moves against the one before.
  const previousGw = showingLive ? currentGw : currentGw - 1;
  const { data: previousScores } = previousGw >= 1
    ? await supabase.from('manager_gw_scores').select('manager_fpl_id, points, classic_total_points, season_managers!inner (team_name)').eq('season_id', SEASON_ID).eq('gw_number', previousGw)
    : { data: null };
  const previousOrder = (previousScores || [])
    .sort((a: any, b: any) => compareStanding(
      { total: a.classic_total_points, week: a.points, name: a.season_managers.team_name },
      { total: b.classic_total_points, week: b.points, name: b.season_managers.team_name },
    ))
    .map((m: any) => m.manager_fpl_id);
  const movement = previousScores
    ? positionDeltas((managers || []).map((m: any) => m.manager_fpl_id), previousOrder)
    : {};

  if (error) {
    return <div className="p-10 text-loss-2">Error loading league: {error.message}</div>;
  }

  return (
    <div>
      <PageHeader title="The Open" rules badge={<GameweekChip gw={gw} week={scoresGw} live={showingLive} />} />
      {showingLive && <p className="text-sm text-dim mb-4">Includes GW{scoresGw} points so far, with subs due from the bench already counted (marked incl. +n); final once FPL confirms the week.</p>}
      <OpenTable
        scoresGw={scoresGw}
        live={showingLive}
        rows={(managers || []).map((manager: any) => ({
          id: Number(manager.manager_fpl_id),
          manager: manager.season_managers.managers.real_name,
          team: manager.season_managers.team_name,
          division: manager.season_managers.division,
          week: withDue(manager.manager_fpl_id, manager.points),
          total: withDue(manager.manager_fpl_id, manager.classic_total_points),
          due: dueOf(manager.manager_fpl_id),
          mark: <MovementArrow delta={movement[manager.manager_fpl_id]} />,
        }))}
      />

      {(!managers || managers.length === 0) && (
        <div className="p-10 text-center text-dim">
          No scores found yet. The season hasn&apos;t started!
        </div>
      )}
    </div>
  );
}

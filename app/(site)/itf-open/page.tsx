import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import { Suspense } from 'react';
import { ITFOpenSkeleton } from '@/components/Skeletons';
import { GameweekChip } from '@/components/GameweekBadge';
import MovementArrow from '@/components/MovementArrow';
import { positionDeltas } from '@/lib/movement';
import { getWeekProjection, dueFor } from '@/lib/projection';
import DueMark from '@/components/DueMark';
import { getGameweekStatus } from '@/lib/gameweek-status';
import PageHeader from '@/components/PageHeader';
import { compareStanding } from '@/lib/standings';

export default function Index() {
  return (
    <div className="max-w-4xl mx-auto py-2 sm:py-8 font-sans">
      <PageHeader title="The Open">
        <p className="text-dim">The master leaderboard across all divisions.</p>
      </PageHeader>

      <Suspense fallback={<ITFOpenSkeleton />}>
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
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <span className="text-dim">Season totals after <strong className="text-ink">GW{scoresGw}</strong></span>
        <GameweekChip gw={gw} week={scoresGw} live={showingLive} />
      </div>
      <p className="text-sm text-dim mb-4">{showingLive ? `Includes GW${scoresGw} points so far and any subs due from the bench (marked +n); final once FPL confirms the week.` : 'Confirmed totals.'}</p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-ink/80">
            <th className="label font-semibold py-2 pr-3 w-12">Pos</th>
            <th className="label font-semibold py-2 pr-3">Team</th>
            <th className="label font-semibold py-2 pr-3 hidden md:table-cell">Division</th>
            <th className="label font-semibold py-2 px-2 text-right">GW{scoresGw}</th>
            <th className="label font-semibold py-2 px-3 text-right text-ink key-col">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {managers?.map((manager: any, index: number) => (
            <tr key={manager.manager_fpl_id} className="hover:bg-surface">
              <td className="py-3 pr-3 font-display text-2xl leading-none text-faint">{index + 1}</td>
              <td className="py-3 pr-3 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <TeamName name={manager.season_managers.team_name} managerId={manager.manager_fpl_id} inline className="font-semibold text-ink min-w-0" />
                  <MovementArrow delta={movement[manager.manager_fpl_id]} />
                </div>
                <div className="text-dim">{manager.season_managers.managers.real_name}<span className="md:hidden"> · {manager.season_managers.division}</span></div>
              </td>
              <td className="py-3 pr-3 text-dim hidden md:table-cell">{manager.season_managers.division}</td>
              <td className={`py-3 px-2 text-right font-semibold whitespace-nowrap ${showingLive ? 'text-live-2' : 'text-ink-2'}`}>{withDue(manager.manager_fpl_id, manager.points)} <DueMark due={dueOf(manager.manager_fpl_id)} /></td>
              <td className="py-3 px-3 text-right whitespace-nowrap key-col">
                <span className="font-display text-3xl leading-none text-ink">{withDue(manager.manager_fpl_id, manager.classic_total_points)}</span> <DueMark due={dueOf(manager.manager_fpl_id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {(!managers || managers.length === 0) && (
        <div className="p-10 text-center text-dim">
          No scores found yet. The season hasn&apos;t started!
        </div>
      )}
    </div>
  );
}

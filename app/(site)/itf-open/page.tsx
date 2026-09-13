import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import { Suspense } from 'react';
import { ITFOpenSkeleton } from '@/components/Skeletons';
import { GameweekChip } from '@/components/GameweekBadge';
import MovementArrow from '@/components/MovementArrow';
import { positionDeltas } from '@/lib/movement';
import { getGameweekStatus } from '@/lib/gameweek-status';

export default function Index() {
  return (
    <div className="max-w-4xl mx-auto py-2 sm:py-8 font-sans">
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">ITF Open</h1>
        <p className="text-dim">The master leaderboard across all divisions.</p>
      </header>
      
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

  // Live totals move against the last confirmed week; a confirmed week moves against the one before.
  const previousGw = showingLive ? currentGw : currentGw - 1;
  const { data: previousScores } = previousGw >= 1
    ? await supabase.from('manager_gw_scores').select('manager_fpl_id, classic_total_points').eq('season_id', SEASON_ID).eq('gw_number', previousGw).order('classic_total_points', { ascending: false })
    : { data: null };
  const movement = previousScores
    ? positionDeltas((managers || []).map((m: any) => m.manager_fpl_id), previousScores.map((m: any) => m.manager_fpl_id))
    : {};

  if (error) {
    return <div className="p-10 text-red-500">Error loading league: {error.message}</div>;
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3 text-sm text-dim">
        <span>Season totals after <strong>GW{scoresGw}</strong></span>
        <GameweekChip gw={gw} week={scoresGw} live={showingLive} />
      </div>
      <p className="text-xs text-dim mb-4">{showingLive ? `Includes GW${scoresGw} points so far; final once FPL confirms the week.` : 'Confirmed totals.'}</p>
      <div className="overflow-x-auto hidden md:block">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b-2 border-line">
            <th className="p-3">Rank</th>
            <th className="p-3">Team & Manager</th>
            <th className="p-3">Division</th>
            <th className="p-3 text-right">GW{scoresGw}</th>
            <th className="p-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {managers?.map((manager: any, index: number) => (
            <tr key={manager.manager_fpl_id} className="border-b border-line hover:bg-surface-2">
              <td className="p-3 font-bold text-ink-2">{index + 1}</td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <TeamName name={manager.season_managers.team_name} inline className="font-semibold" />
                  <MovementArrow delta={movement[manager.manager_fpl_id]} />
                </div>
                <div className="text-sm text-dim">{manager.season_managers.managers.real_name}</div>
              </td>
              <td className="p-3">
                <span className="px-2 py-1 bg-brand-2/15 text-brand-2 text-xs rounded-full">
                  {manager.season_managers.division}
                </span>
              </td>
              <td className={`p-3 text-right font-semibold ${showingLive ? 'text-amber-300' : 'text-ink-2'}`}>{manager.points}</td>
              <td className="p-3 text-right font-bold text-lg">
                {manager.classic_total_points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Mobile stacked list */}
      <div className="md:hidden space-y-3">
        {managers?.map((manager: any, index: number) => (
          <div key={manager.manager_fpl_id} className="bg-surface border rounded-lg p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-ink-2">{index + 1}. <span className="ml-2"><TeamName name={manager.season_managers.team_name} inline className="font-semibold" /></span> <MovementArrow delta={movement[manager.manager_fpl_id]} className="ml-1" /></div>
                <div className="text-xs text-dim">{manager.season_managers.managers.real_name}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-black text-ink">{manager.classic_total_points}</div>
                <div className={`text-xs ${showingLive ? 'text-amber-300' : 'text-dim'}`}>GW{scoresGw}: {manager.points}</div>
                <div className="text-xs mt-1"><span className="px-2 py-1 bg-brand-2/15 text-brand-2 text-xs rounded-full">{manager.season_managers.division}</span></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(!managers || managers.length === 0) && (
        <div className="p-10 text-center text-dim">
          No scores found yet. The season hasn't started!
        </div>
      )}
    </div>
  );
}
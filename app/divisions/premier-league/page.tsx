import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { Suspense } from 'react';
import TeamName from '@/components/TeamName';
import { DivisionSkeleton } from '@/components/Skeletons';
import GameweekBadge from '@/components/GameweekBadge';
import PageHeader from '@/components/PageHeader';
import MovementArrow from '@/components/MovementArrow';
import { positionDeltas } from '@/lib/movement';
import { getGameweekStatus } from '@/lib/gameweek-status';

export default function PremierLeaguePage() {
  return (
    <div className="max-w-5xl mx-auto py-2 sm:py-8 font-sans">
      <Suspense fallback={<DivisionSkeleton />}>
        <DivisionContent />
      </Suspense>
    </div>
  );
}

async function DivisionContent() {
  const supabase = await createClient();
  const SEASON_ID = '2026-27';
  const gw = await getGameweekStatus();
  const currentGw = gw.syncedThroughGw;
  
  const DIVISION_NAME = 'Premier League';
  const CMS_SLUG = 'premier-league';

    const { data: contentData } = await supabase
    .from('page_content')
    .select('content')
    .eq('id', CMS_SLUG) // or respective slug
    .order('gw_number', { ascending: false })
    .limit(1)
    .single();

  const { data: managers, error } = await supabase
    .from('season_managers')
    .select(`
      manager_fpl_id,
      team_name,
      managers!inner (real_name),
      manager_gw_scores (gw_number, classic_total_points),
      h2h_fixtures (gw_number, result)
    `)
    .eq('season_id', SEASON_ID)
    .eq('division', DIVISION_NAME);

  if (error) {
    return <div className="p-10 text-red-500">Error loading division: {error.message}</div>;
  }

  // Results count only confirmed gameweeks; FPL Pts stay live unless a limit is given.
  const buildTable = (resultsThroughGw: number, totalsThroughGw: number | null) => {
    const rows = managers?.map((mgr: any) => {
      let w = 0, d = 0, l = 0;

      mgr.h2h_fixtures?.forEach((fix: any) => {
        if (fix.gw_number > resultsThroughGw) return;
        if (fix.result === 'W') w++;
        else if (fix.result === 'D') d++;
        else if (fix.result === 'L') l++;
      });

      const totalPoints = mgr.manager_gw_scores?.reduce((max: number, gw: any) =>
        (totalsThroughGw === null || gw.gw_number <= totalsThroughGw) && gw.classic_total_points > max ? gw.classic_total_points : max, 0) || 0;

      const matchPoints = (w * 3) + (d * 1);
      const matchesPlayed = w + d + l;

      return {
        id: mgr.manager_fpl_id,
        teamName: mgr.team_name,
        managerName: mgr.managers.real_name,
        played: matchesPlayed,
        won: w,
        drawn: d,
        lost: l,
        matchPoints,
        totalPoints
      };
    }) || [];

    rows.sort((a, b) => {
      if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
      return b.totalPoints - a.totalPoints;
    });
    return rows;
  };

  const tableData = buildTable(currentGw, null);
  const movement = currentGw > 1
    ? positionDeltas(tableData.map(t => t.id), buildTable(currentGw - 1, currentGw - 1).map(t => t.id))
    : {};

  return (
    <>
      <PageHeader
        title={DIVISION_NAME}
        badge={(
          <GameweekBadge provisional={!!gw.liveGw} short={gw.liveGw ? `Results to GW${currentGw} · FPL live` : `Final to GW${currentGw}`}>
            {gw.liveGw ? `Results through GW${currentGw} · FPL Pts live` : `Table through GW${currentGw} · final`}
          </GameweekBadge>
        )}
        actions={(
          <Link href="/form" className="text-xs sm:text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full font-semibold hover:bg-blue-100 transition">
            View Form Grid &rarr;
          </Link>
        )}
      >
        <div className="bg-white border-l-4 border-blue-500 p-4 sm:p-6 rounded-r-xl shadow-sm text-slate-700 italic leading-relaxed">
          "{contentData?.content || 'No editor summary available for this division yet.'}"
        </div>
      </PageHeader>

      {gw.liveGw && (
        <p className="text-xs text-slate-500 mb-2">FPL Pts include GW{gw.liveGw} live scores. Wins, draws, losses and H2H Pts update once GW{gw.liveGw} is confirmed.</p>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="p-4 w-12 text-center">Pos</th>
                <th className="p-4">Manager & Team</th>
                <th className="p-4 text-center w-16">Pld</th>
                <th className="p-4 text-center w-16">W</th>
                <th className="p-4 text-center w-16">D</th>
                <th className="p-4 text-center w-16">L</th>
                <th className="p-4 text-right w-24">FPL Pts</th>
                <th className="p-4 text-right w-24 text-blue-300 font-bold">H2H Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableData.map((team, index) => (
                <tr key={team.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-center font-bold text-slate-400">{index + 1}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <TeamName name={team.teamName} />
                      <MovementArrow delta={movement[team.id]} />
                    </div>
                    <div className="text-slate-500 text-xs">{team.managerName}</div>
                  </td>
                  <td className="p-4 text-center font-medium text-slate-600">{team.played}</td>
                  <td className="p-4 text-center text-green-600 font-semibold">{team.won}</td>
                  <td className="p-4 text-center text-slate-500 font-semibold">{team.drawn}</td>
                  <td className="p-4 text-center text-red-500 font-semibold">{team.lost}</td>
                  <td className="p-4 text-right text-slate-500">{team.totalPoints}</td>
                  <td className="p-4 text-right font-black text-lg text-slate-800 bg-slate-50/50">
                    {team.matchPoints}
                  </td>
                </tr>
              ))}
              
              {tableData.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No teams found in this division.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile stacked list: carries every desktop column */}
        <div className="md:hidden p-3 space-y-2">
          {tableData.map((team, index) => (
            <div key={team.id} className="bg-white border rounded-lg p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <span className="w-6 shrink-0 text-sm font-black text-slate-400 leading-6">{index + 1}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamName name={team.teamName} inline className="font-semibold text-slate-800 min-w-0" />
                      <MovementArrow delta={movement[team.id]} />
                    </div>
                    <div className="text-xs text-slate-500">{team.managerName}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-black text-slate-800 leading-6">{team.matchPoints}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">H2H Pts</div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>P <b className="text-slate-700">{team.played}</b> · W <b className="text-green-600">{team.won}</b> · D <b className="text-slate-600">{team.drawn}</b> · L <b className="text-red-500">{team.lost}</b></span>
                <span>FPL Pts <b className="text-slate-700">{team.totalPoints}</b></span>
              </div>
            </div>
          ))}
          {tableData.length === 0 && (
            <div className="p-6 text-center text-slate-500">No teams found in this division.</div>
          )}
        </div>
      </div>
    </>
  );
}
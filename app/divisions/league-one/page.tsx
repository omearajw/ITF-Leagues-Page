import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { Suspense } from 'react';
import TeamName from '@/components/TeamName';
import { DivisionSkeleton } from '@/components/Skeletons';

export default function LeagueOnePage() {
  return (
    <div className="max-w-5xl mx-auto py-8 font-sans">
      <Suspense fallback={<DivisionSkeleton />}>
        <DivisionContent />
      </Suspense>
    </div>
  );
}

async function DivisionContent() {
  const supabase = await createClient();
  const SEASON_ID = '2026-27';
  const { data: latestGwData } = await supabase
    .from('gameweeks')
    .select('gw_number')
    .eq('season_id', SEASON_ID)
    .eq('is_finished', true)
    .order('gw_number', { ascending: false })
    .limit(1)
    .single();
  const currentGw = latestGwData ? latestGwData.gw_number : 1;
  
  const DIVISION_NAME = 'League One';
  const CMS_SLUG = 'league-one';

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
      manager_gw_scores (classic_total_points),
      h2h_fixtures (result)
    `)
    .eq('season_id', SEASON_ID)
    .eq('division', DIVISION_NAME);

  if (error) {
    return <div className="p-10 text-red-500">Error loading division: {error.message}</div>;
  }

  const tableData = managers?.map((mgr: any) => {
    let w = 0, d = 0, l = 0;
    
    mgr.h2h_fixtures?.forEach((fix: any) => {
      if (fix.result === 'W') w++;
      else if (fix.result === 'D') d++;
      else if (fix.result === 'L') l++;
    });

    const totalPoints = mgr.manager_gw_scores?.reduce((max: number, gw: any) => 
      gw.classic_total_points > max ? gw.classic_total_points : max, 0) || 0;

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

  tableData.sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    return b.totalPoints - a.totalPoints;
  });

  return (
    <>
      <header className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">{DIVISION_NAME}</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-500 bg-slate-200 px-3 py-1 rounded">Current GW: {currentGw}</span>
            <Link href="/form" className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full font-semibold hover:bg-blue-100 transition">
              View Form Grid &rarr;
            </Link>
          </div>
        </div>
        <div className="bg-white border-l-4 border-blue-500 p-6 rounded-r-xl shadow-sm text-slate-700 italic leading-relaxed">
          "{contentData?.content || 'No editor summary available for this division yet.'}"
        </div>
      </header>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
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
                    <TeamName name={team.teamName} />
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
      </div>
    </>
  );
}
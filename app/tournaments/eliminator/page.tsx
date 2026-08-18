import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import Link from 'next/link';
import { Suspense } from 'react';

export default function EliminatorPage() {
  return (
    <div className="max-w-5xl mx-auto py-8 font-sans">
      <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500 animate-pulse">Loading Eliminator Data...</div>}>
        <EliminatorContent />
      </Suspense>
    </div>
  );
}

async function EliminatorContent() {
  const supabase = await createClient();
  const SEASON_ID = '2026-27';

  // 1. Fetch Current Gameweek
  const { data: latestGwData } = await supabase
    .from('gameweeks')
    .select('gw_number')
    .eq('season_id', SEASON_ID)
    .eq('is_finished', true) // <-- ADD THIS LINE
    .order('gw_number', { ascending: false })
    .limit(1)
    .single();
  const currentGw = latestGwData ? latestGwData.gw_number : 1;

  // 2. Fetch Config & Content
  const { data: contentData } = await supabase.from('page_content').select('content').eq('id', 'eliminator').single();
  const { data: config } = await supabase.from('eliminator_config').select('start_gw').eq('season_id', SEASON_ID).single();

  // 3. Fetch Eliminator Status and all GW Scores
  const { data: managers, error } = await supabase
    .from('eliminator_status')
    .select(`manager_fpl_id, is_eliminated, eliminated_gw, season_managers!inner (team_name, division, managers!inner (real_name))`)
    .eq('season_id', SEASON_ID);

  const { data: allScores } = await supabase.from('manager_gw_scores').select('manager_fpl_id, gw_number, points').eq('season_id', SEASON_ID);

  if (error) return <div className="p-10 text-red-500">Error: {error.message}</div>;

  // Helper to find a specific week's score
  const getScore = (managerId: number, gw: number) => {
    return allScores?.find(s => s.manager_fpl_id === managerId && s.gw_number === gw)?.points || 0;
  };

  // 4. Split and Sort
  const alive = managers?.filter((m: any) => !m.is_eliminated).sort((a: any, b: any) => {
    return getScore(b.manager_fpl_id, currentGw) - getScore(a.manager_fpl_id, currentGw);
  }) || [];

  const dead = managers?.filter((m: any) => m.is_eliminated).sort((a: any, b: any) => (b.eliminated_gw || 0) - (a.eliminated_gw || 0)) || [];

  return (
    <>
      {/* HEADER */}
      <header className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              The Eliminator
              <span className="bg-slate-900 text-white text-sm px-3 py-1 rounded-full font-bold tracking-widest uppercase">
                {alive.length} Alive
              </span>
            </h1>
            <p className="text-slate-500 mt-2 font-medium">Currently Gameweek {currentGw}</p>
          </div>
        </div>
        <div className="bg-white border-l-4 border-red-500 p-6 rounded-r-xl shadow-sm text-slate-700 italic leading-relaxed">
          "{contentData?.content || 'No editor summary available.'}"
        </div>
      </header>

      {/* SURVIVORS */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          Active Survivors <span className="text-sm font-normal text-slate-400 ml-2">(GW{currentGw} Scores)</span>
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {alive.map((mgr: any) => (
            <div key={mgr.season_managers.team_name} className="bg-white border border-green-100 p-4 rounded-xl shadow-sm flex items-center justify-between hover:shadow-md transition">
              <div>
                <TeamName name={mgr.season_managers.team_name} inline className="text-slate-900" />
                <div className="text-xs text-slate-500">{mgr.season_managers.managers.real_name}</div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xl font-black text-slate-800">{getScore(mgr.manager_fpl_id, currentGw)}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-700">Pts</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* GRAVEYARD */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2 border-b pb-2">
          💀 The Graveyard
        </h2>
        
        <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-4 font-semibold uppercase tracking-wider text-xs">Eliminated</th>
                <th className="p-4 font-semibold uppercase tracking-wider text-xs">Team & Manager</th>
                <th className="p-4 font-semibold uppercase tracking-wider text-xs text-right">Fatal Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {dead.map((mgr: any) => {
                const justDied = mgr.eliminated_gw === currentGw;
                
                return (
                  <tr key={mgr.season_managers.team_name} className={`${justDied ? 'bg-red-950/40 border-l-4 border-l-red-500' : 'hover:bg-slate-800/50'} transition-colors`}>
                    <td className="p-4">
                      <span className={`font-bold ${justDied ? 'text-red-400' : 'text-slate-500'}`}>
                        GW {mgr.eliminated_gw}
                      </span>
                      {justDied && <span className="ml-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-widest animate-pulse">Just Eliminated</span>}
                    </td>
                    <td className="p-4">
                      <TeamName name={mgr.season_managers.team_name} inline className="text-slate-200 line-through opacity-75" />
                      <div className="text-xs text-slate-500">{mgr.season_managers.managers.real_name}</div>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-lg font-black text-red-400">
                        {getScore(mgr.manager_fpl_id, mgr.eliminated_gw || 1)} pts
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
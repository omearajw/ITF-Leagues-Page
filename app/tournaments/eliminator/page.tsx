import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import { Suspense } from 'react';
import { EliminatorSkeleton } from '@/components/Skeletons';

export default async function EliminatorPage() {
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

  const { data: config } = await supabase
    .from('eliminator_config')
    .select('start_gw')
    .eq('season_id', SEASON_ID)
    .single();

  const startGw = config?.start_gw || 1;
  const isPreTournament = currentGw < startGw;

  return (
    <div className="max-w-5xl mx-auto py-8 font-sans">
      <Suspense fallback={<EliminatorSkeleton phase={isPreTournament ? 'pre' : 'active'} />}>
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
    .eq('is_finished', true) 
    .order('gw_number', { ascending: false })
    .limit(1)
    .single();
  const currentGw = latestGwData ? latestGwData.gw_number : 1;

  // 2. Fetch Config & Content
  const { data: contentData } = await supabase
    .from('page_content')
    .select('content')
    .eq('id', 'eliminator') 
    .order('gw_number', { ascending: false })
    .limit(1)
    .single();
  const { data: config } = await supabase.from('eliminator_config').select('start_gw').eq('season_id', SEASON_ID).single();

  // 3. Fetch Eliminator Status, the full league roster, and all GW Scores
  const { data: managers, error } = await supabase
    .from('eliminator_status')
    .select(`manager_fpl_id, is_eliminated, eliminated_gw, season_managers!inner (team_name, division, managers!inner (real_name))`)
    .eq('season_id', SEASON_ID);

  // Every manager in the league takes part. The status table is only seeded by the
  // ingest once the tournament starts, so the roster is what we list before then.
  const { data: roster } = await supabase
    .from('season_managers')
    .select(`manager_fpl_id, team_name, division, managers!inner (real_name)`)
    .eq('season_id', SEASON_ID)
    .order('team_name');

  const { data: allScores } = await supabase.from('manager_gw_scores').select('manager_fpl_id, gw_number, points').eq('season_id', SEASON_ID);

  if (error) return <div className="p-10 text-red-500">Error: {error.message}</div>;

  // Helper to find a specific week's score
  const getScore = (managerId: number, gw: number) => {
    return allScores?.find(s => s.manager_fpl_id === managerId && s.gw_number === gw)?.points || 0;
  };

  // 4. Split, Sort, and Check Status
  const alive = managers?.filter((m: any) => !m.is_eliminated).sort((a: any, b: any) => {
    return getScore(b.manager_fpl_id, currentGw) - getScore(a.manager_fpl_id, currentGw);
  }) || [];

  const dead = managers?.filter((m: any) => m.is_eliminated).sort((a: any, b: any) => (b.eliminated_gw || 0) - (a.eliminated_gw || 0)) || [];

  // Determine which phase the tournament is in
  const startGw = config?.start_gw || 1;
  const isPreTournament = currentGw < startGw;
  const hasEntrants = (managers?.length || 0) > 0;
  const lastEliminationGw = dead.reduce((max: number, m: any) => Math.max(max, m.eliminated_gw || 0), 0);
  // The ingest eliminates one manager per finished gameweek. If the latest finished
  // week hasn't produced one yet, the cron simply hasn't run since it finished.
  const awaitingElimination = !isPreTournament && hasEntrants && alive.length > 1 && lastEliminationGw < currentGw;

  const statusLabel = isPreTournament ? 'Pending' : !hasEntrants ? 'Awaiting Entrants' : `${alive.length} Alive`;
  const statusMuted = isPreTournament || !hasEntrants;

  return (
    <>
      {/* HEADER */}
      <header className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              The Eliminator
              <span className={`text-sm px-3 py-1 rounded-full font-bold tracking-widest uppercase ${statusMuted ? 'bg-slate-200 text-slate-500' : 'bg-slate-900 text-white'}`}>
                {statusLabel}
              </span>
            </h1>
          </div>
          <span className="text-sm font-bold text-slate-500 bg-slate-200 px-3 py-1 rounded">Last Completed GW: {currentGw}</span>
        </div>
        <div className="bg-white border-l-4 border-red-500 p-6 rounded-r-xl shadow-sm text-slate-700 italic leading-relaxed">
          "{contentData?.content || 'No editor summary available.'}"
        </div>
      </header>

      {/* CONDITIONAL RENDER: PRE-TOURNAMENT VS ACTIVE TOURNAMENT */}
      {isPreTournament ? (
        <>
          <section className="mb-12 text-center bg-white border border-slate-200 rounded-xl p-12 shadow-sm">
            <h2 className="text-3xl font-black text-slate-800 mb-2">The Purge is Pending</h2>
            <p className="text-slate-500">The battle for survival begins in <strong>Gameweek {startGw}</strong>. Until then, everyone is safe.</p>
            <p className="text-slate-400 text-sm mt-2">The first elimination is applied once Gameweek {startGw} is finished and the scores are confirmed by FPL.</p>
          </section>

          <section className="mb-16">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <div className="w-3 h-3 bg-slate-300 rounded-full"></div>
              Entrants <span className="text-sm font-normal text-slate-400 ml-2">({roster?.length || 0} managers, all safe)</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {roster?.map((mgr: any) => (
                <div key={mgr.manager_fpl_id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
                  <div>
                    <TeamName name={mgr.team_name} inline className="text-slate-900" />
                    <div className="text-xs text-slate-500">{mgr.managers.real_name}</div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded">{mgr.division}</span>
                </div>
              ))}
              {(!roster || roster.length === 0) && (
                <div className="col-span-full text-center text-slate-400 italic py-8">No managers registered for this season yet.</div>
              )}
            </div>
          </section>
        </>
      ) : !hasEntrants ? (
        <section className="mb-12 text-center bg-amber-50 border border-amber-200 rounded-xl p-12 shadow-sm">
          <h2 className="text-3xl font-black text-amber-900 mb-2">Waiting for Entrants</h2>
          <p className="text-amber-800">
            The Eliminator started in <strong>Gameweek {startGw}</strong>, but no managers have been registered yet.
          </p>
          <p className="text-amber-700/80 text-sm mt-2">
            The next data sync will register all {roster?.length || 0} managers in the league and apply any outstanding eliminations.
          </p>
        </section>
      ) : (
        <>
          {awaitingElimination && (
            <div className="mb-10 bg-amber-50 border border-amber-200 text-amber-900 p-5 rounded-xl shadow-sm flex items-start gap-3">
              <div className="w-3 h-3 mt-1.5 bg-amber-400 rounded-full animate-pulse shrink-0"></div>
              <div>
                <div className="font-bold">Gameweek {currentGw} elimination pending</div>
                <p className="text-sm text-amber-800/90">
                  Gameweek {currentGw} is finished, but the lowest scorer has not been cut yet. The next data sync will send them to the Graveyard.
                </p>
              </div>
            </div>
          )}

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
              The Graveyard
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
                  {dead.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-slate-500 italic">
                        No one has been eliminated yet. The first casualty falls once Gameweek {startGw} is processed.
                      </td>
                    </tr>
                  )}
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
      )}
    </>
  );
}

import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import { Suspense } from 'react';
import { EliminatorSkeleton } from '@/components/Skeletons';
import { GameweekChip } from '@/components/GameweekBadge';
import PageHeader from '@/components/PageHeader';
import { getGameweekStatus } from '@/lib/gameweek-status';
import { eliminatorNextLine } from '@/lib/tournament-next';

export default async function EliminatorPage() {
  const supabase = await createClient();
  const SEASON_ID = '2026-27';

  const gw = await getGameweekStatus();
  const currentGw = gw.syncedThroughGw;

  const { data: config } = await supabase
    .from('eliminator_config')
    .select('start_gw')
    .eq('season_id', SEASON_ID)
    .single();

  const startGw = config?.start_gw || 1;
  const isPreTournament = currentGw < startGw;

  return (
    <div className="max-w-5xl mx-auto py-2 sm:py-8 font-sans">
      <Suspense fallback={<EliminatorSkeleton phase={isPreTournament ? 'pre' : 'active'} />}>
        <EliminatorContent />
      </Suspense>
    </div>
  );
}

async function EliminatorContent() {
  const supabase = await createClient();
  const SEASON_ID = '2026-27';

  // 1. Gameweek status: eliminations are decided on the synced week, survivors show the live week
  const gw = await getGameweekStatus();
  const currentGw = gw.syncedThroughGw;
  const displayGw = gw.displayGw;

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
    return getScore(b.manager_fpl_id, displayGw) - getScore(a.manager_fpl_id, displayGw);
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
  const nextLine = eliminatorNextLine(gw, startGw, { aliveCount: hasEntrants ? alive.length : undefined, awaitingElimination });

  return (
    <>
      {/* HEADER */}
      <PageHeader
        className="mb-10 sm:mb-12"
        title="The Eliminator"
        titleExtra={(
          <span className={`text-xs sm:text-sm px-3 py-1 rounded-full font-bold tracking-widest uppercase ${statusMuted ? 'bg-surface-3 text-dim' : 'bg-panel text-white'}`}>
            {statusLabel}
          </span>
        )}
        badge={(
          <GameweekChip gw={gw} startGw={startGw} />
        )}
      >
        {contentData?.content && (
          <div className="bg-surface border-l-4 border-red-500 p-4 sm:p-6 rounded-r-xl shadow-sm text-ink-2 leading-relaxed whitespace-pre-line">
            {contentData.content}
          </div>
        )}
        <p className="text-sm text-dim mt-3">
          {nextLine}
          {gw.liveGw && !isPreTournament ? ` · Survivors show GW${gw.liveGw} points so far; the cut is made once the week is confirmed.` : ''}
        </p>
      </PageHeader>

      {/* CONDITIONAL RENDER: PRE-TOURNAMENT VS ACTIVE TOURNAMENT */}
      {isPreTournament ? (
        <>
          <section className="mb-12 text-center bg-surface border border-line rounded-xl p-6 sm:p-12 shadow-sm">
            <h2 className="text-2xl sm:text-3xl font-black text-ink mb-2">The Purge is Pending</h2>
            <p className="text-dim">The battle for survival begins in <strong>Gameweek {startGw}</strong>. Until then, everyone is safe.</p>
            <p className="text-faint text-sm mt-2">The first elimination is applied once Gameweek {startGw} is finished and the scores are confirmed by FPL.</p>
          </section>

          <section className="mb-16">
            <h2 className="text-2xl font-bold text-ink mb-6 flex items-center gap-2">
              <div className="w-3 h-3 bg-surface-3 rounded-full"></div>
              Entrants <span className="text-sm font-normal text-faint ml-2">({roster?.length || 0} managers, all safe)</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {roster?.map((mgr: any) => (
                <div key={mgr.manager_fpl_id} className="bg-surface border border-line p-4 rounded-xl shadow-sm flex items-center justify-between">
                  <div>
                    <TeamName name={mgr.team_name} inline className="text-ink" />
                    <div className="text-xs text-dim">{mgr.managers.real_name}</div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-faint bg-surface-2 px-2 py-1 rounded">{mgr.division}</span>
                </div>
              ))}
              {(!roster || roster.length === 0) && (
                <div className="col-span-full text-center text-faint italic py-8">No managers registered for this season yet.</div>
              )}
            </div>
          </section>
        </>
      ) : !hasEntrants ? (
        <section className="mb-12 text-center bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 sm:p-12 shadow-sm">
          <h2 className="text-2xl sm:text-3xl font-black text-amber-200 mb-2">Waiting for Entrants</h2>
          <p className="text-amber-300">
            The Eliminator started in <strong>Gameweek {startGw}</strong>, but no managers have been registered yet.
          </p>
          <p className="text-amber-300/80 text-sm mt-2">
            The next data sync will register all {roster?.length || 0} managers in the league and apply any outstanding eliminations.
          </p>
        </section>
      ) : (
        <>
          {awaitingElimination && (
            <div className="mb-10 bg-amber-500/10 border border-amber-500/30 text-amber-200 p-5 rounded-xl shadow-sm flex items-start gap-3">
              <div className="w-3 h-3 mt-1.5 bg-amber-400 rounded-full animate-pulse shrink-0"></div>
              <div>
                <div className="font-bold">Gameweek {currentGw} elimination pending</div>
                <p className="text-sm text-amber-300/90">
                  Gameweek {currentGw} is finished, but the lowest scorer has not been cut yet. The next data sync will send them to the Graveyard.
                </p>
              </div>
            </div>
          )}

          {/* SURVIVORS */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-ink mb-6 flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              Active Survivors <span className="text-sm font-normal text-faint ml-2">(GW{displayGw} {displayGw === gw.liveGw ? 'live scores · provisional' : 'Scores'})</span>
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {alive.map((mgr: any, idx: number) => (
                <div key={mgr.season_managers.team_name} className="bg-surface border border-green-500/20 p-4 rounded-xl shadow-sm flex items-center justify-between hover:shadow-md transition">
                  <div>
                    <div className="flex items-center gap-2">
                      <TeamName name={mgr.season_managers.team_name} inline className="text-ink" />
                      {displayGw === gw.liveGw && alive.length > 1 && idx === alive.length - 1 && (
                        <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-bold uppercase">Lowest</span>
                      )}
                    </div>
                    <div className="text-xs text-dim">{mgr.season_managers.managers.real_name}</div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xl font-black text-ink">{getScore(mgr.manager_fpl_id, displayGw)}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">Points</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* GRAVEYARD */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-6 flex items-center gap-2 border-b pb-2">
              The Graveyard
            </h2>
            
            <div className="bg-panel rounded-xl overflow-hidden shadow-lg border border-line">
              {dead.length === 0 ? (
                <div className="p-6 sm:p-8 text-center text-dim italic">
                  No one has been eliminated yet. The first casualty falls once Gameweek {startGw} is processed.
                </div>
              ) : (
                <>
                  {/* Mobile list */}
                  <div className="md:hidden divide-y divide-line text-ink-2">
                    {dead.map((mgr: any) => {
                      const justDied = mgr.eliminated_gw === currentGw;
                      return (
                        <div key={mgr.season_managers.team_name} className={`p-3 flex items-center justify-between gap-3 ${justDied ? 'bg-red-950/40 border-l-4 border-l-red-500' : ''}`}>
                          <div className="min-w-0">
                            <div className={`text-xs font-bold ${justDied ? 'text-red-400' : 'text-dim'}`}>
                              GW {mgr.eliminated_gw}
                              {justDied && <span className="ml-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-widest animate-pulse">Just Eliminated</span>}
                            </div>
                            <TeamName name={mgr.season_managers.team_name} inline className="text-ink line-through opacity-75 min-w-0" />
                            <div className="text-xs text-dim">{mgr.season_managers.managers.real_name}</div>
                          </div>
                          <span className="shrink-0 text-lg font-black text-red-400">{getScore(mgr.manager_fpl_id, mgr.eliminated_gw || 1)} pts</span>
                        </div>
                      );
                    })}
                  </div>

                  <table className="hidden md:table w-full text-left text-sm">
                    <thead className="bg-panel-2 text-faint border-b border-line">
                      <tr>
                        <th className="p-4 font-semibold uppercase tracking-wider text-xs">Eliminated</th>
                        <th className="p-4 font-semibold uppercase tracking-wider text-xs">Team & Manager</th>
                        <th className="p-4 font-semibold uppercase tracking-wider text-xs text-right">Fatal Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-ink-2">
                      {dead.map((mgr: any) => {
                        const justDied = mgr.eliminated_gw === currentGw;
                        
                        return (
                          <tr key={mgr.season_managers.team_name} className={`${justDied ? 'bg-red-950/40 border-l-4 border-l-red-500' : 'hover:bg-surface-2/50'} transition-colors`}>
                            <td className="p-4">
                              <span className={`font-bold ${justDied ? 'text-red-400' : 'text-dim'}`}>
                                GW {mgr.eliminated_gw}
                              </span>
                              {justDied && <span className="ml-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-widest animate-pulse">Just Eliminated</span>}
                            </td>
                            <td className="p-4">
                              <TeamName name={mgr.season_managers.team_name} inline className="text-ink line-through opacity-75" />
                              <div className="text-xs text-dim">{mgr.season_managers.managers.real_name}</div>
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
                </>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}

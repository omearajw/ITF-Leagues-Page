import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import { Suspense } from 'react';
import { EliminatorSkeleton } from '@/components/Skeletons';
import { GameweekChip } from '@/components/GameweekBadge';
import PageHeader from '@/components/PageHeader';
import RichText from '@/components/RichText';
import { getGameweekStatus } from '@/lib/gameweek-status';
import { eliminatorNextLine } from '@/lib/tournament-next';
import { getWeekProjection, dueFor } from '@/lib/projection';
import DueMark from '@/components/DueMark';
import SectionHeading from '@/components/SectionHeading';

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
  const projection = displayGw === gw.liveGw ? await getWeekProjection() : null;
  const dueOf = (id: number) => (projection ? dueFor(projection, displayGw, Number(id)) : null);

  // 2. Fetch Config & Content
  // A week shows only its own write-up; an older one would be misleading.
  const { data: contentData } = await supabase
    .from('page_content')
    .select('content')
    .eq('id', 'eliminator')
    .eq('gw_number', currentGw)
    .maybeSingle();
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

  if (error) return <div className="p-10 text-loss-2">Error: {error.message}</div>;

  // Helper to find a specific week's score
  const getScore = (managerId: number, gw: number) => {
    const base = allScores?.find(s => s.manager_fpl_id === managerId && s.gw_number === gw)?.points || 0;
    return base + (gw === displayGw ? (dueOf(managerId)?.due || 0) : 0);
  };

  // 4. Split, Sort, and Check Status
  const alive = managers?.filter((m: any) => !m.is_eliminated).sort((a: any, b: any) => {
    return getScore(b.manager_fpl_id, displayGw) - getScore(a.manager_fpl_id, displayGw);
  }) || [];

  // While a week is live, whoever is on the lowest score (projected subs included) is pinned
  // to the top. Before kickoff everyone is level, so nobody is singled out.
  const lowestLive = displayGw === gw.liveGw && alive.length > 1 ? Math.min(...alive.map((m) => getScore(m.manager_fpl_id, displayGw))) : null;
  const atRisk = new Set(lowestLive === null ? [] : alive.filter((m) => getScore(m.manager_fpl_id, displayGw) === lowestLive).map((m) => m.manager_fpl_id));
  if (atRisk.size === alive.length) atRisk.clear();
  const survivors = [...alive.filter((m) => atRisk.has(m.manager_fpl_id)), ...alive.filter((m) => !atRisk.has(m.manager_fpl_id))];

  const dead = managers?.filter((m: any) => m.is_eliminated).sort((a: any, b: any) => (b.eliminated_gw || 0) - (a.eliminated_gw || 0)) || [];

  // Determine which phase the tournament is in
  const startGw = config?.start_gw || 1;
  const isPreTournament = currentGw < startGw;
  const hasEntrants = (managers?.length || 0) > 0;
  const lastEliminationGw = dead.reduce((max: number, m: any) => Math.max(max, m.eliminated_gw || 0), 0);
  // The ingest eliminates one manager per finished gameweek. If the latest finished
  // week hasn't produced one yet, the cron simply hasn't run since it finished.
  const awaitingElimination = !isPreTournament && hasEntrants && alive.length > 1 && lastEliminationGw < currentGw;

  const statusLabel = isPreTournament ? 'Pending' : !hasEntrants ? 'Awaiting Entrants' : `${alive.length} Remain`;
  const statusMuted = isPreTournament || !hasEntrants;
  const nextLine = eliminatorNextLine(gw, startGw, { aliveCount: hasEntrants ? alive.length : undefined, awaitingElimination });

  return (
    <>
      <PageHeader
        className="mb-10 sm:mb-12"
        title="The Eliminator"
        rules
        titleExtra={<span className={`text-2xl sm:text-4xl ${statusMuted ? 'text-dim' : 'text-brand-2'}`}>{statusLabel}</span>}
        badge={<GameweekChip gw={gw} startGw={startGw} />}
      >
        {!isPreTournament && <p className="text-dim max-w-[34rem]">
          {nextLine}.
          {gw.liveGw ? ` Survivors show GW${gw.liveGw} points so far; the cut is made once the week is confirmed.` : ''}
        </p>}
        {contentData?.content && (
          <article className="max-w-[34rem] border-t border-line pt-5 mt-5 text-[15px] leading-relaxed text-ink-2">
            <RichText content={contentData.content} />
          </article>
        )}
      </PageHeader>

      {isPreTournament ? (
        <>
          <section className="mb-12">
            <SectionHeading>The Purge is Pending</SectionHeading>
            <p className="text-dim max-w-[34rem]">The battle for survival begins in <strong className="text-ink">Gameweek {startGw}</strong>, once the scores are confirmed. Until then, everyone is safe.</p>
          </section>

          <section className="mb-16">
            <SectionHeading aside={<span className="text-dim">{roster?.length || 0} managers, all safe</span>}>Entrants</SectionHeading>
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-x-12 flow-rules">
              {roster?.map((mgr: any) => (
                <div key={mgr.manager_fpl_id} className="break-inside-avoid flex items-center justify-between gap-3 py-2.5 border-b border-line">
                  <div className="min-w-0">
                    <TeamName name={mgr.team_name} managerId={mgr.manager_fpl_id} inline className="font-semibold text-ink min-w-0" />
                    <div className="text-sm text-dim">{mgr.managers.real_name}</div>
                  </div>
                  <span className="label shrink-0">{mgr.division}</span>
                </div>
              ))}
            </div>
            {(!roster || roster.length === 0) && <p className="text-center text-faint italic py-8">No managers registered for this season yet.</p>}
          </section>
        </>
      ) : !hasEntrants ? (
        <section className="mb-12">
          <SectionHeading>Waiting for Entrants</SectionHeading>
          <p className="text-ink-2">The Eliminator started in <strong>Gameweek {startGw}</strong>, but no managers have been registered yet.</p>
          <p className="text-dim text-sm mt-2">The next data sync will register all {roster?.length || 0} managers in the league and apply any outstanding eliminations.</p>
        </section>
      ) : (
        <>
          {awaitingElimination && (
            <div className="mb-10 flex items-start gap-3 text-live-2">
              <span className="w-2.5 h-2.5 mt-1.5 bg-live rounded-full animate-pulse shrink-0" aria-hidden="true" />
              <p><b>Gameweek {currentGw} elimination pending.</b> <span className="text-live-2/90">Gameweek {currentGw} is finished, but the lowest scorer has not been cut yet. The next data sync will eliminate them.</span></p>
            </div>
          )}

          <section className="mb-16">
            <SectionHeading aside={<span className={displayGw === gw.liveGw ? 'text-live-2' : 'text-dim'}>GW{displayGw} {displayGw === gw.liveGw ? 'live scores · provisional' : 'Scores'}</span>}>
              Active Survivors
            </SectionHeading>
            {atRisk.size > 0 && (
              <div className="mb-4">
                {survivors.filter(m => atRisk.has(m.manager_fpl_id)).map((mgr: any) => (
                  <div key={mgr.season_managers.team_name} className="flex items-center justify-between gap-3 py-2.5 border-b border-line">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <TeamName name={mgr.season_managers.team_name} managerId={mgr.manager_fpl_id} inline className="font-semibold text-brand-2 min-w-0" />
                        <span className="shrink-0 text-xs font-bold uppercase tracking-[0.08em] bg-loss text-white px-1.5 py-0.5 rounded-sm animate-pulse" title="On the lowest live score: out if it stays this way when the week is confirmed">At risk</span>
                      </div>
                      <div className="text-sm text-dim">{mgr.season_managers.managers.real_name}</div>
                    </div>
                    <span className="plate shrink-0 bg-loss text-white font-display text-2xl min-w-[3.25rem]">{getScore(mgr.manager_fpl_id, displayGw)} <DueMark due={dueOf(mgr.manager_fpl_id)} className="font-sans" /></span>
                  </div>
                ))}
                <div className="flex items-center gap-3 mt-1" aria-hidden="true">
                  <span className="h-[3px] flex-1 bg-brand" />
                  <span className="label text-brand-2">Cut line</span>
                  <span className="h-[3px] flex-1 bg-brand" />
                </div>
              </div>
            )}
            <ol className="columns-1 sm:columns-2 lg:columns-3 gap-x-12 flow-rules">
              {survivors.filter(m => !atRisk.has(m.manager_fpl_id)).map((mgr: any) => (
                <li key={mgr.season_managers.team_name} className="break-inside-avoid flex items-center justify-between gap-3 py-2.5 border-b border-line">
                  <div className="min-w-0">
                    <TeamName name={mgr.season_managers.team_name} managerId={mgr.manager_fpl_id} inline className="font-semibold text-ink min-w-0" />
                    <div className="text-sm text-dim">{mgr.season_managers.managers.real_name}</div>
                  </div>
                  <span className="plate shrink-0 font-display text-2xl min-w-[3.25rem]">{getScore(mgr.manager_fpl_id, displayGw)} <DueMark due={dueOf(mgr.manager_fpl_id)} className="font-sans" /></span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <SectionHeading>The Eliminated</SectionHeading>
            {dead.length === 0 ? (
              <p className="py-6 text-center text-dim italic">No one has been eliminated yet. The first casualty falls once Gameweek {startGw} is processed.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="label font-semibold py-2 pr-3 w-36">Eliminated</th>
                    <th className="label font-semibold py-2 pr-3">Team</th>
                    <th className="label font-semibold py-2 text-right">Exit Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {dead.map((mgr: any) => {
                    const justDied = mgr.eliminated_gw === currentGw;
                    return (
                      <tr key={mgr.season_managers.team_name} className={justDied ? 'bg-loss/15' : ''}>
                        <td className="py-3 pr-3 align-top">
                          <span className={`font-display text-xl leading-none ${justDied ? 'text-brand-2' : 'text-dim'}`}>GW{mgr.eliminated_gw}</span>
                          {justDied && <span className="block mt-1 w-fit whitespace-nowrap text-xs font-bold uppercase tracking-[0.08em] bg-loss text-white px-1.5 py-0.5 rounded-sm">Just eliminated</span>}
                        </td>
                        <td className="py-3 pr-3 min-w-0">
                          <TeamName name={mgr.season_managers.team_name} managerId={mgr.manager_fpl_id} inline className="font-semibold text-ink-2 line-through decoration-brand-2 decoration-2 min-w-0" />
                          <div className="text-dim">{mgr.season_managers.managers.real_name}</div>
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          <span className="font-display text-2xl leading-none text-brand-2">{getScore(mgr.manager_fpl_id, mgr.eliminated_gw || 1)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </>
  );
}

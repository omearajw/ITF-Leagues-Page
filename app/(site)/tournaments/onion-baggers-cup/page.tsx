import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import { Suspense } from 'react';
import { OnionBaggersSkeleton } from '@/components/Skeletons';
import { GameweekChip, LiveChip } from '@/components/GameweekBadge';
import PageHeader from '@/components/PageHeader';
import { getGameweekStatus } from '@/lib/gameweek-status';
import { onionBaggersNextLine } from '@/lib/tournament-next';
import { getWeekProjection, dueFor, type WeekProjection, type WeekDue } from '@/lib/projection';
import DueMark from '@/components/DueMark';

export default async function OnionBaggersPage() {
  const supabase = await createClient();
  const SEASON_ID = '2026-27';

  const gw = await getGameweekStatus();
  const currentGw = gw.syncedThroughGw;

  const { data: config } = await supabase
    .from('onion_baggers_config')
    .select('*')
    .eq('season_id', SEASON_ID)
    .single();

  const qStart = config?.qualifiers_start_gw || 1;
  const kStart = config?.knockout_start_gw || 9;
  const isPreTournament = currentGw < qStart;
  const isQualifying = currentGw >= qStart && currentGw < kStart;
  const fallbackPhase = isPreTournament ? 'pre' : isQualifying ? 'qualifying' : 'knockouts';

  return (
    <div className="max-w-7xl mx-auto py-2 sm:py-8 font-sans">
      <Suspense fallback={<OnionBaggersSkeleton phase={fallbackPhase} />}>
        <OnionBaggersContent />
      </Suspense>
    </div>
  );
}

async function OnionBaggersContent() {
  const supabase = await createClient();
  const SEASON_ID = '2026-27';

  const gw = await getGameweekStatus();
  const currentGw = gw.syncedThroughGw;
  const displayGw = gw.displayGw;
  const projection = displayGw === gw.liveGw ? await getWeekProjection() : null;
  const dueOf = (id: number) => (projection ? dueFor(projection, displayGw, Number(id)) : null);

  const { data: contentData } = await supabase
    .from('page_content')
    .select('content')
    .eq('id', 'onion-baggers-cup')
    .order('gw_number', { ascending: false })
    .limit(1)
    .single();
  const { data: config } = await supabase.from('onion_baggers_config').select('*').eq('season_id', SEASON_ID).single();
  
  const { data: entrantsData } = await supabase.from('onion_baggers_entrants').select('*').eq('season_id', SEASON_ID);
  const { data: allManagers } = await supabase.from('season_managers').select(`manager_fpl_id, team_name, managers!inner(real_name)`).eq('season_id', SEASON_ID);
  
  const teamMap: Record<number, any> = {};
  allManagers?.forEach((m: any) => teamMap[m.manager_fpl_id] = { teamName: m.team_name, realName: m.managers.real_name });

  const qStart = config?.qualifiers_start_gw || 1;
  const kStart = config?.knockout_start_gw || 9;
  
  const isPreTournament = currentGw < qStart;
  const isQualifying = currentGw >= qStart && currentGw < kStart;
  const isKnockouts = currentGw >= kStart;

  // Fetch Cup Fixtures ordered by match_order to enforce bracket integrity
  const { data: fixtures } = await supabase.from('tournament_fixtures')
    .select('*').eq('season_id', SEASON_ID).eq('tournament_type', 'ONION_BAGGERS_CUP').order('match_order', { ascending: true });

  // Fetch ALL Scores up to the current week to populate the matrix grid
  const lastGwToDisplay = isKnockouts ? kStart - 1 : Math.min(displayGw, kStart - 1);
  const { data: allScores } = await supabase.from('manager_gw_scores')
    .select('manager_fpl_id, gw_number, points')
    .eq('season_id', SEASON_ID)
    .lte('gw_number', lastGwToDisplay);

  const getScore = (mgrId: number, gw: number) => {
    const s = allScores?.find(score => score.manager_fpl_id === mgrId && score.gw_number === gw);
    return s ? s.points + (gw === displayGw ? (dueOf(mgrId)?.due || 0) : 0) : '-';
  };

  // Generate Gameweek Columns for the Matrix (e.g. GW1 to GW8)
  const gwColumns = Array.from({ length: lastGwToDisplay - qStart + 1 }, (_, i) => qStart + i);

  // Split managers into Qualified and Unqualified
  const qualifiedManagers = entrantsData?.sort((a, b) => a.seed - b.seed) || [];
  const qualifiedIds = qualifiedManagers.map(q => q.manager_fpl_id);
  
  // Unqualified managers are strictly sorted by the latest week's score (live when in progress)
  const unqualifiedManagers = allManagers?.filter(m => !qualifiedIds.includes(m.manager_fpl_id))
    .sort((a, b) => (getScore(b.manager_fpl_id, displayGw) as number || 0) - (getScore(a.manager_fpl_id, displayGw) as number || 0)) || [];

  const latestFixture = fixtures && fixtures.length > 0 ? fixtures.reduce((a, b) => (b.gw_number > a.gw_number ? b : a)) : null;
  const nextLine = onionBaggersNextLine(gw, { qStart, kStart }, { qualifiedCount: qualifiedManagers.length, currentStage: latestFixture?.stage ?? null });

  return (
    <>
      <PageHeader
        title="Onion Baggers Cup"
        badge={(
          <GameweekChip gw={gw} startGw={qStart} />
        )}
      >
        {/* Qualifying runs for eight gameweeks; knockouts start later so the final lands in the penultimate week. */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 mb-4 text-xs sm:text-sm font-semibold uppercase tracking-wider">
          <span className={(isQualifying || isPreTournament) ? 'text-orange-300 border-b-2 border-orange-500 pb-0.5' : 'text-faint'}>Qualifiers · GW{qStart}–{qStart + 7}</span>
          <span className={isKnockouts ? 'text-orange-300 border-b-2 border-orange-500 pb-0.5' : 'text-faint'}>Knockouts · GW{kStart}+</span>
        </div>
        {contentData?.content && (
          <div className="bg-surface border-l-4 border-orange-500 p-4 sm:p-6 rounded-r-xl shadow-sm text-ink-2 leading-relaxed whitespace-pre-line">
            {contentData.content}
          </div>
        )}
        <p className="text-sm text-dim mt-3">
          {nextLine}
          {gw.liveGw && !isPreTournament ? ` · GW${gw.liveGw} points update live; qualification is decided once the week is confirmed.` : ''}
        </p>
      </PageHeader>

      {/* PHASE 0: PRE-TOURNAMENT */}
      {isPreTournament && (
        <section className="mb-12 text-center bg-surface border border-line rounded-xl p-6 sm:p-12 shadow-sm">
          <h2 className="text-2xl sm:text-3xl font-black text-ink mb-2">Qualifiers Pending</h2>
          <p className="text-dim">The scramble for the 16 Onion Baggers Cup seeds begins in <strong>Gameweek {qStart}</strong>.</p>
        </section>
      )}

      {/* PHASE 1: QUALIFICATION MATRIX GRID */}
      {isQualifying && (
        <>
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-ink mb-6 flex items-center gap-2">
              Qualification Standings
              <span className="w-3 h-3 bg-orange-500 rounded-full animate-pulse ml-2"></span>
            </h2>
            
            {/* Added 'hidden md:block' here */}
            <div className="bg-surface rounded-xl shadow-sm border overflow-x-auto hidden md:block">
              <table className="w-full text-left text-sm whitespace-nowrap md:min-w-[800px]">
                <thead className="bg-panel text-white border-b border-line">
                  <tr>
                    <th className="p-4 w-16 text-center border-r border-line">Seed</th>
                    <th className="p-4 border-r border-line sticky left-0 bg-panel z-10">Manager & Team</th>
                    {gwColumns.map(col => (
                      <th key={col} className={`p-4 text-center w-16 ${col === displayGw ? (col === gw.liveGw ? 'bg-surface-2 text-amber-400' : 'bg-surface-2 text-orange-400') : ''}`}>
                        <span className="inline-flex items-center gap-2">GW{col} {col === gw.liveGw && <LiveChip />}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                
                {/* SECTION: QUALIFIED */}
                <tbody className="divide-y divide-green-500/20 bg-green-500/10">
                  {qualifiedManagers.length > 0 && (
                    <tr>
                      <td colSpan={gwColumns.length + 2} className="bg-green-500/15 text-green-300 font-bold uppercase tracking-widest text-xs px-4 py-2 border-y border-green-500/30">
                        The Final 16 (Locked)
                      </td>
                    </tr>
                  )}
                  {qualifiedManagers.map((entrant) => {
                    const isNewlyQualified = entrant.qualified_in_gw === currentGw;
                    
                    return (
                      <tr key={entrant.seed} className={`transition-colors ${isNewlyQualified ? 'bg-green-500/15 hover:bg-green-500/15' : 'hover:bg-green-500/10'}`}>
                        <td className="p-4 text-center font-black text-green-400 border-r border-green-500/20">#{entrant.seed}</td>
                        <td className={`p-4 border-r border-green-500/20 sticky left-0 z-10 transition-colors ${isNewlyQualified ? 'bg-green-500/10 group-hover:bg-green-500/15' : 'bg-surface group-hover:bg-green-500/10'}`}>
                          <div className="font-bold text-ink flex items-center gap-2">
                            <TeamName name={teamMap[entrant.manager_fpl_id]?.teamName} managerId={entrant.manager_fpl_id} inline />
                            {isNewlyQualified && <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded font-bold uppercase tracking-widest animate-pulse">Newly Qualified</span>}
                          </div>
                          <div className="text-xs text-dim">{teamMap[entrant.manager_fpl_id]?.realName}</div>
                        </td>
                        {gwColumns.map(gw => {
                          const isQualWeek = gw === entrant.qualified_in_gw;
                          return (
                            <td key={gw} className={`p-4 text-center font-mono ${isQualWeek ? 'bg-green-500/15 text-green-400 font-black text-lg' : 'text-ink-2'}`}>
                              {isQualWeek ? getScore(entrant.manager_fpl_id, gw) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>

                {/* SECTION: UNQUALIFIED (FIGHTING FOR SPOTS) */}
                <tbody className="divide-y divide-line">
                  <tr>
                    <td colSpan={gwColumns.length + 2} className="bg-surface-2 text-dim font-bold uppercase tracking-widest text-xs px-4 py-2 border-y border-line">
                      Live Contenders (Ordered by GW{displayGw} Score{displayGw === gw.liveGw ? ' · live' : ''})
                    </td>
                  </tr>
                  {unqualifiedManagers.map((manager) => (
                    <tr key={manager.manager_fpl_id} className="hover:bg-surface-2 transition-colors">
                      <td className="p-4 text-center text-ink-2 font-bold border-r border-line">-</td>
                      <td className="p-4 border-r border-line sticky left-0 z-10 bg-surface group-hover:bg-surface-2 transition-colors">
                        <div className="font-bold text-ink flex items-center gap-2">
                          <TeamName name={teamMap[manager.manager_fpl_id]?.teamName} managerId={manager.manager_fpl_id} inline />
                        </div>
                        <div className="text-xs text-dim">{teamMap[manager.manager_fpl_id]?.realName}</div>
                      </td>
                      {gwColumns.map(col => (
                        <td key={col} className={`p-4 text-center font-mono ${col === displayGw ? 'bg-surface-2 font-black text-ink' : 'text-faint font-medium'}`}>
                          {getScore(manager.manager_fpl_id, col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list: seeds, per-week scores and qualification flags */}
            <div className="md:hidden space-y-4">
              {qualifiedManagers.length > 0 && (
                <div>
                  <div className="bg-green-500/15 text-green-300 font-bold uppercase tracking-widest text-xs px-3 py-2 rounded-lg border border-green-500/30 mb-2">The Final 16 (Locked)</div>
                  <div className="space-y-2">
                    {qualifiedManagers.map((entrant) => {
                      const isNewlyQualified = entrant.qualified_in_gw === currentGw;
                      return (
                        <div key={entrant.seed} className={`bg-surface border rounded-lg p-3 shadow-sm flex items-center justify-between gap-3 ${isNewlyQualified ? 'border-green-500/40 bg-green-500/10' : 'border-green-500/20'}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-8 shrink-0 text-sm font-black text-green-400">#{entrant.seed}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                <TeamName name={teamMap[entrant.manager_fpl_id]?.teamName} managerId={entrant.manager_fpl_id} inline className="font-semibold text-ink min-w-0" />
                                {isNewlyQualified && <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded font-bold uppercase tracking-widest animate-pulse">New</span>}
                              </div>
                              <div className="text-xs text-dim">{teamMap[entrant.manager_fpl_id]?.realName}</div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-black text-green-400 leading-6">{getScore(entrant.manager_fpl_id, entrant.qualified_in_gw)}</div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-faint">GW{entrant.qualified_in_gw}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div className="bg-surface-2 text-dim font-bold uppercase tracking-widest text-xs px-3 py-2 rounded-lg border border-line mb-2">
                  Live Contenders · GW{displayGw}{displayGw === gw.liveGw ? ' live' : ''}
                </div>
                <div className="space-y-2">
                  {unqualifiedManagers.map((manager) => {
                    const recent = gwColumns.filter(col => col !== displayGw).slice(-4);
                    return (
                      <div key={manager.manager_fpl_id} className="bg-surface border rounded-lg p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <TeamName name={teamMap[manager.manager_fpl_id]?.teamName} managerId={manager.manager_fpl_id} inline className="font-semibold text-ink min-w-0" />
                            <div className="text-xs text-dim">{teamMap[manager.manager_fpl_id]?.realName}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-black text-ink leading-6">{getScore(manager.manager_fpl_id, displayGw)} <DueMark due={dueOf(manager.manager_fpl_id)} /></div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-faint">GW{displayGw}</div>
                          </div>
                        </div>
                        {recent.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-line flex flex-wrap gap-1.5 text-[11px] text-dim">
                            {recent.map(col => (
                              <span key={col} className="bg-surface-2 border border-line rounded px-1.5 py-0.5">GW{col} <b className="text-ink-2">{getScore(manager.manager_fpl_id, col)}</b></span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* PHASE 2: KNOCKOUT BRACKET (LIGHT THEME) */}
      {isKnockouts && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-ink mb-6">Knockout Bracket</h2>
          <div className="hidden md:block bg-surface rounded-xl shadow-sm border border-line p-6 overflow-x-auto">
            <div className="flex gap-8 min-w-[1000px]">
              
              <BracketColumn title="Round of 16" fixtures={fixtures?.filter(f => f.stage === 'Round of 16')} teamMap={teamMap} isFinal={false} liveGw={gw.liveGw} projection={projection} />
              <BracketColumn title="Quarter-Finals" fixtures={fixtures?.filter(f => f.stage === 'Quarter-Final')} teamMap={teamMap} isFinal={false} liveGw={gw.liveGw} projection={projection} />
              <BracketColumn title="Semi-Finals" fixtures={fixtures?.filter(f => f.stage === 'Semi-Final')} teamMap={teamMap} isFinal={false} liveGw={gw.liveGw} projection={projection} />
              <BracketColumn title="The Final" fixtures={fixtures?.filter(f => f.stage === 'Final')} teamMap={teamMap} isFinal={true} liveGw={gw.liveGw} projection={projection} />
              
            </div>
          </div>

          {/* Phones: one round at a time, latest round first */}
          <div className="md:hidden space-y-6">
            {[
              { title: 'The Final', stage: 'Final', isFinal: true },
              { title: 'Semi-Finals', stage: 'Semi-Final', isFinal: false },
              { title: 'Quarter-Finals', stage: 'Quarter-Final', isFinal: false },
              { title: 'Round of 16', stage: 'Round of 16', isFinal: false },
            ].map(round => {
              const roundFixtures = fixtures?.filter(f => f.stage === round.stage) || [];
              return (
                <div key={round.stage}>
                  <h3 className={`font-bold uppercase tracking-widest text-xs mb-2 ${round.isFinal ? 'text-orange-600' : 'text-dim'}`}>{round.title}</h3>
                  {roundFixtures.length === 0 ? (
                    <div className="border-2 border-line border-dashed rounded-xl text-center text-faint font-bold text-sm italic py-6 bg-surface-2/50">TBD</div>
                  ) : (
                    <div className="space-y-3">
                      {roundFixtures.map(fix => <BracketMatch key={fix.id} fix={fix} teamMap={teamMap} isFinal={round.isFinal} liveGw={gw.liveGw} projection={projection} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* The Tribute Footer */}
      <div className="mt-16 text-center pb-8">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-faint">
          Dedicated to the original Onion Bagger.
        </p>
      </div>
    </>
  );
}

// ==========================================
// BRACKET UI COMPONENT (LIGHT THEME)
// ==========================================
function BracketColumn({ title, fixtures, teamMap, isFinal, liveGw, projection }: { title: string, fixtures: any[] | undefined, teamMap: any, isFinal: boolean, liveGw: number | null, projection: WeekProjection | null }) {
  if (!fixtures || fixtures.length === 0) {
    return (
      <div className="flex-1 flex flex-col gap-4">
        <h3 className="text-dim font-bold uppercase tracking-widest text-xs text-center mb-4">{title}</h3>
        <div className="flex-1 border-2 border-line border-dashed rounded-xl flex items-center justify-center text-faint font-bold text-sm italic py-20 bg-surface-2/50">
          TBD
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${isFinal ? 'w-80' : 'flex-1'}`}>
      <h3 className={`font-bold uppercase tracking-widest text-xs text-center mb-2 ${isFinal ? 'text-orange-600 text-sm' : 'text-dim'}`}>{title}</h3>
      <div className="flex flex-col justify-around h-full gap-4">
        {fixtures.map(fix => <BracketMatch key={fix.id} fix={fix} teamMap={teamMap} isFinal={isFinal} liveGw={liveGw} projection={projection} />)}
      </div>
    </div>
  );
}

function BracketMatch({ fix, teamMap, isFinal, liveGw, projection }: { fix: any, teamMap: any, isFinal: boolean, liveGw: number | null, projection: WeekProjection | null }) {
  const isPlayed = fix.manager_1_score !== null;
  const isLiveFix = isPlayed && fix.gw_number === liveGw;
  const d1 = isLiveFix && projection ? dueFor(projection, fix.gw_number, fix.manager_1_id) : null;
  const d2 = isLiveFix && projection ? dueFor(projection, fix.gw_number, fix.manager_2_id) : null;
  return (
    <div className={`flex flex-col rounded-lg border bg-surface shadow-sm overflow-hidden ${isFinal ? 'border-orange-500/40 ring-2 ring-orange-500/20' : 'border-line'}`}>
      <div className="bg-surface-2 px-3 py-1.5 flex justify-between items-center border-b border-line">
        <span className="text-[10px] font-bold text-faint uppercase tracking-widest flex items-center gap-2">GW {fix.gw_number} {isLiveFix && <LiveChip />}</span>
        {fix.winner_id && isFinal && !isLiveFix && <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded font-black uppercase tracking-widest">Champion</span>}
      </div>
      <div className="flex flex-col">
        <MatchRow managerId={fix.manager_1_id} score={isPlayed ? fix.manager_1_score + (d1?.due || 0) : fix.manager_1_score} due={d1} isWinner={!isLiveFix && fix.winner_id === fix.manager_1_id} isPlayed={isPlayed} isLive={isLiveFix} teamMap={teamMap} />
        <div className="border-t border-line"></div>
        <MatchRow managerId={fix.manager_2_id} score={isPlayed ? fix.manager_2_score + (d2?.due || 0) : fix.manager_2_score} due={d2} isWinner={!isLiveFix && fix.winner_id === fix.manager_2_id} isPlayed={isPlayed} isLive={isLiveFix} teamMap={teamMap} />
      </div>
    </div>
  );
}

function MatchRow({ managerId, score, due, isWinner, isPlayed, isLive, teamMap }: { managerId: number, score: number | null, due?: WeekDue | null, isWinner: boolean, isPlayed: boolean, isLive: boolean, teamMap: any }) {
  if (!managerId) {
    return (
      <div className="px-3 py-2 flex justify-between items-center opacity-50 bg-surface-2">
        <span className="text-sm font-semibold text-faint italic">TBD</span>
      </div>
    );
  }

  return (
    <div className={`px-3 py-2 flex justify-between items-center transition-colors ${isPlayed && !isLive && !isWinner ? 'opacity-40 bg-surface-2' : ''} ${isWinner ? 'bg-green-500/10' : 'bg-surface'}`}>
      <TeamName
        name={teamMap[managerId]?.teamName}
        managerId={managerId}
        inline
        className={`text-sm min-w-0 max-w-[60vw] sm:max-w-[140px] ${isWinner ? 'text-green-400' : 'text-ink-2'}`}
      />
      {isPlayed && (
        <span className={`font-mono text-sm font-black ${isWinner ? 'text-green-400' : 'text-ink-2'}`}>
          {score} <DueMark due={due} />
        </span>
      )}
    </div>
  );
}
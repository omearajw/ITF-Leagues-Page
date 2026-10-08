import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import { Suspense } from 'react';
import { OnionBaggersSkeleton } from '@/components/Skeletons';
import { GameweekChip, LiveChip } from '@/components/GameweekBadge';
import PageHeader from '@/components/PageHeader';
import RichText from '@/components/RichText';
import { getGameweekStatus } from '@/lib/gameweek-status';
import { onionBaggersNextLine } from '@/lib/tournament-next';
import { getWeekProjection, dueFor, type WeekProjection, type WeekDue } from '@/lib/projection';
import DueMark from '@/components/DueMark';
import SectionHeading from '@/components/SectionHeading';

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

  // A week shows only its own write-up; an older one would be misleading.
  const { data: contentData } = await supabase
    .from('page_content')
    .select('content')
    .eq('id', 'onion-baggers-cup')
    .eq('gw_number', currentGw)
    .maybeSingle();
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
        badge={<GameweekChip gw={gw} startGw={qStart} />}
      >
        {/* Qualifying runs for eight gameweeks; knockouts start later so the final lands in the penultimate week. */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
          <span className={phaseTab(isQualifying || isPreTournament)}>Qualifiers · GW{qStart}–{qStart + 7}</span>
          <span className={phaseTab(isKnockouts)}>Knockouts · GW{kStart}+</span>
        </div>
        {!isPreTournament && <p className="text-dim max-w-[34rem]">
          {nextLine}
          {gw.liveGw ? ` · GW${gw.liveGw} points update live; qualification is decided once the week is confirmed.` : ''}
        </p>}
        {contentData?.content && (
          <article className="max-w-[34rem] border-t border-line pt-5 mt-5 text-[15px] leading-relaxed text-ink-2">
            <RichText content={contentData.content} />
          </article>
        )}
      </PageHeader>

      {isPreTournament && (
        <section className="mb-12">
          <SectionHeading>Qualifiers Pending</SectionHeading>
          <p className="text-dim max-w-[34rem]">The scramble for the 16 Onion Baggers Cup seeds begins in <strong className="text-ink">{qStart - currentGw} Gameweek{qStart - currentGw === 1 ? '' : 's'}</strong>.</p>
        </section>
      )}

      {isQualifying && (
        <section className="mb-12">
          <SectionHeading aside={<span className={displayGw === gw.liveGw ? 'text-live-2' : 'text-dim'}>{qualifiedManagers.length} of 16 seeds taken</span>}>Qualification Standings</SectionHeading>

          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left text-sm whitespace-nowrap md:min-w-[800px]">
              <thead>
                <tr className="border-b-2 border-ink/80">
                  <th className="label font-semibold py-2 pr-3 w-14">Seed</th>
                  <th className="label font-semibold py-2 pr-3 sticky left-0 bg-bg z-10">Team</th>
                  {gwColumns.map(col => (
                    <th key={col} className={`label font-semibold py-2 px-2 text-center w-16 ${col === displayGw ? (col === gw.liveGw ? 'text-live-2' : 'text-ink') : ''}`}>
                      <span className="inline-flex items-center gap-1.5">GW{col} {col === gw.liveGw && <LiveChip />}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              {qualifiedManagers.length > 0 && (
                <tbody className="divide-y divide-line">
                  <tr><td colSpan={gwColumns.length + 2} className="pt-4 pb-2"><span className="font-display text-lg leading-none tracking-[0.03em] text-win-2">The Final 16 (Locked)</span></td></tr>
                  {qualifiedManagers.map((entrant) => {
                    const isNewlyQualified = entrant.qualified_in_gw === currentGw;
                    return (
                      <tr key={entrant.seed} className="hover:bg-surface">
                        <td className="py-2.5 pr-3 font-display text-xl leading-none text-win-2">{entrant.seed}</td>
                        <td className="py-2.5 pr-3 sticky left-0 z-10 bg-bg">
                          <div className="flex items-center gap-2">
                            <TeamName name={teamMap[entrant.manager_fpl_id]?.teamName} managerId={entrant.manager_fpl_id} inline className="font-semibold text-ink" />
                            {isNewlyQualified && <span className="text-xs font-bold uppercase tracking-[0.08em] bg-win text-white px-1.5 py-0.5 rounded-sm">Newly qualified</span>}
                          </div>
                          <div className="text-dim">{teamMap[entrant.manager_fpl_id]?.realName}</div>
                        </td>
                        {gwColumns.map(col => {
                          const isQualWeek = col === entrant.qualified_in_gw;
                          return (
                            <td key={col} className={`py-2.5 px-2 text-center ${isQualWeek ? 'font-display text-xl leading-none text-win-2' : 'text-faint'}`}>
                              {isQualWeek ? getScore(entrant.manager_fpl_id, col) : '·'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              )}
              <tbody className="divide-y divide-line">
                <tr><td colSpan={gwColumns.length + 2} className="pt-6 pb-2"><span className="font-display text-lg leading-none tracking-[0.03em] text-ink-2">Live Contenders (Ordered by GW{displayGw} Score{displayGw === gw.liveGw ? ' · live' : ''})</span></td></tr>
                {unqualifiedManagers.map((manager) => (
                  <tr key={manager.manager_fpl_id} className="hover:bg-surface">
                    <td className="py-2.5 pr-3 text-faint">–</td>
                    <td className="py-2.5 pr-3 sticky left-0 z-10 bg-bg">
                      <TeamName name={teamMap[manager.manager_fpl_id]?.teamName} managerId={manager.manager_fpl_id} inline className="font-semibold text-ink" />
                      <div className="text-dim">{teamMap[manager.manager_fpl_id]?.realName}</div>
                    </td>
                    {gwColumns.map(col => (
                      <td key={col} className={`py-2.5 px-2 text-center ${col === displayGw ? 'font-display text-xl leading-none text-ink' : 'text-dim'}`}>
                        {getScore(manager.manager_fpl_id, col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: seeds, then contenders with their recent weeks */}
          <div className="md:hidden space-y-8">
            {qualifiedManagers.length > 0 && (
              <div>
                <h3 className="font-display text-lg leading-none tracking-[0.03em] text-win-2 mb-1">The Final 16 (Locked)</h3>
                <div className="divide-y divide-line">
                  {qualifiedManagers.map((entrant) => {
                    const isNewlyQualified = entrant.qualified_in_gw === currentGw;
                    return (
                      <div key={entrant.seed} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 shrink-0 font-display text-xl leading-none text-win-2">{entrant.seed}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <TeamName name={teamMap[entrant.manager_fpl_id]?.teamName} managerId={entrant.manager_fpl_id} inline className="font-semibold text-ink min-w-0" />
                              {isNewlyQualified && <span className="text-xs font-bold uppercase tracking-[0.08em] bg-win text-white px-1.5 py-0.5 rounded-sm">New</span>}
                            </div>
                            <div className="text-sm text-dim">{teamMap[entrant.manager_fpl_id]?.realName} · GW{entrant.qualified_in_gw}</div>
                          </div>
                        </div>
                        <span className="plate shrink-0 font-display text-2xl min-w-[3.25rem] text-win-2">{getScore(entrant.manager_fpl_id, entrant.qualified_in_gw)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <h3 className="font-display text-lg leading-none tracking-[0.03em] text-ink-2 mb-1">Live Contenders · GW{displayGw}{displayGw === gw.liveGw ? ' live' : ''}</h3>
              <div className="divide-y divide-line">
                {unqualifiedManagers.map((manager) => {
                  const recent = gwColumns.filter(col => col !== displayGw).slice(-4);
                  return (
                    <div key={manager.manager_fpl_id} className="py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <TeamName name={teamMap[manager.manager_fpl_id]?.teamName} managerId={manager.manager_fpl_id} inline className="font-semibold text-ink min-w-0" />
                          <div className="text-sm text-dim">{teamMap[manager.manager_fpl_id]?.realName}</div>
                        </div>
                        <span className="plate shrink-0 font-display text-2xl min-w-[3.25rem]">{getScore(manager.manager_fpl_id, displayGw)} <DueMark due={dueOf(manager.manager_fpl_id)} className="font-sans" /></span>
                      </div>
                      {recent.length > 0 && (
                        <div className="mt-1 text-sm text-dim tabular">
                          {recent.map((col, i) => <span key={col}>{i > 0 && ' · '}GW{col} <b className="text-ink-2">{getScore(manager.manager_fpl_id, col)}</b></span>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {isKnockouts && (
        <section className="mb-12">
          <SectionHeading>Knockout Bracket</SectionHeading>
          <div className="hidden md:block overflow-x-auto">
            <div className="flex gap-8 min-w-[1000px]">
              <BracketColumn title="Round of 16" fixtures={fixtures?.filter(f => f.stage === 'Round of 16')} teamMap={teamMap} isFinal={false} liveGw={gw.liveGw} projection={projection} />
              <BracketColumn title="Quarter-Finals" fixtures={fixtures?.filter(f => f.stage === 'Quarter-Final')} teamMap={teamMap} isFinal={false} liveGw={gw.liveGw} projection={projection} />
              <BracketColumn title="Semi-Finals" fixtures={fixtures?.filter(f => f.stage === 'Semi-Final')} teamMap={teamMap} isFinal={false} liveGw={gw.liveGw} projection={projection} />
              <BracketColumn title="The Final" fixtures={fixtures?.filter(f => f.stage === 'Final')} teamMap={teamMap} isFinal={true} liveGw={gw.liveGw} projection={projection} />
            </div>
          </div>

          {/* Phones: one round at a time, latest round first */}
          <div className="md:hidden space-y-8">
            {[
              { title: 'The Final', stage: 'Final', isFinal: true },
              { title: 'Semi-Finals', stage: 'Semi-Final', isFinal: false },
              { title: 'Quarter-Finals', stage: 'Quarter-Final', isFinal: false },
              { title: 'Round of 16', stage: 'Round of 16', isFinal: false },
            ].map(round => {
              const roundFixtures = fixtures?.filter(f => f.stage === round.stage) || [];
              return (
                <div key={round.stage}>
                  <h3 className={`font-display text-lg leading-none tracking-[0.03em] mb-2 ${round.isFinal ? 'text-ink' : 'text-ink-2'}`}>{round.title}</h3>
                  {roundFixtures.length === 0 ? (
                    <p className="py-3 text-sm text-faint italic border-y border-line">TBD</p>
                  ) : (
                    <div className="space-y-4">
                      {roundFixtures.map(fix => <BracketMatch key={fix.id} fix={fix} teamMap={teamMap} isFinal={round.isFinal} liveGw={gw.liveGw} projection={projection} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="mt-16 mb-8 pt-4 border-t border-line text-center label">Dedicated to the original Onion Bagger.</p>
    </>
  );
}

function phaseTab(on: boolean) {
  return `font-display text-lg sm:text-xl leading-none tracking-[0.03em] pb-1.5 border-b-[3px] ${on ? 'text-ink border-brand' : 'text-faint border-transparent'}`;
}

// ==========================================
// BRACKET
// ==========================================
function BracketColumn({ title, fixtures, teamMap, isFinal, liveGw, projection }: { title: string, fixtures: any[] | undefined, teamMap: any, isFinal: boolean, liveGw: number | null, projection: WeekProjection | null }) {
  const heading = <h3 className={`font-display text-lg leading-none tracking-[0.03em] mb-3 ${isFinal ? 'text-ink' : 'text-ink-2'}`}>{title}</h3>;
  if (!fixtures || fixtures.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        {heading}
        <p className="flex-1 flex items-center justify-center text-sm text-faint italic border-y border-line py-20">TBD</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isFinal ? 'w-80' : 'flex-1'}`}>
      {heading}
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
    <div className={`border-t-2 ${isFinal ? 'border-brand' : 'border-line'}`}>
      <div className="py-1 flex justify-between items-center">
        <span className="label flex items-center gap-2">GW{fix.gw_number} {isLiveFix && <LiveChip />}</span>
        {fix.winner_id && isFinal && !isLiveFix && <span className="text-xs font-bold uppercase tracking-[0.08em] bg-brand text-white px-1.5 py-0.5 rounded-sm">Champion</span>}
      </div>
      <div className="divide-y divide-line border-b border-line">
        <MatchRow managerId={fix.manager_1_id} score={isPlayed ? fix.manager_1_score + (d1?.due || 0) : fix.manager_1_score} due={d1} isWinner={!isLiveFix && fix.winner_id === fix.manager_1_id} isPlayed={isPlayed} isLive={isLiveFix} teamMap={teamMap} />
        <MatchRow managerId={fix.manager_2_id} score={isPlayed ? fix.manager_2_score + (d2?.due || 0) : fix.manager_2_score} due={d2} isWinner={!isLiveFix && fix.winner_id === fix.manager_2_id} isPlayed={isPlayed} isLive={isLiveFix} teamMap={teamMap} />
      </div>
    </div>
  );
}

function MatchRow({ managerId, score, due, isWinner, isPlayed, isLive, teamMap }: { managerId: number, score: number | null, due?: WeekDue | null, isWinner: boolean, isPlayed: boolean, isLive: boolean, teamMap: any }) {
  if (!managerId) {
    return <div className="py-2 text-sm text-faint italic">TBD</div>;
  }
  const lost = isPlayed && !isLive && !isWinner;
  return (
    <div className="py-2 flex justify-between items-center gap-3">
      <TeamName
        name={teamMap[managerId]?.teamName}
        managerId={managerId}
        inline
        className={`text-sm min-w-0 max-w-[60vw] sm:max-w-[160px] ${isWinner ? 'font-bold text-ink' : lost ? 'text-faint' : 'text-ink-2'}`}
      />
      {isPlayed && (
        <span className={`plate font-display text-xl whitespace-nowrap ${isLive ? 'text-live-2' : isWinner ? 'text-ink' : 'text-faint'}`}>
          {score} <DueMark due={due} className="font-sans" />
        </span>
      )}
    </div>
  );
}

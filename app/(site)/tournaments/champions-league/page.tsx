import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import { Suspense } from 'react';
import { ChampionsLeagueSkeleton } from '@/components/Skeletons';
import { GameweekChip, LiveChip } from '@/components/GameweekBadge';
import PageHeader from '@/components/PageHeader';
import MovementArrow from '@/components/MovementArrow';
import { positionDeltas } from '@/lib/movement';
import { getGameweekStatus } from '@/lib/gameweek-status';
import { championsLeagueNextLine } from '@/lib/tournament-next';

export default function ChampionsLeaguePage() {
  return (
    <div className="max-w-7xl mx-auto py-2 sm:py-8 font-sans">
      <Suspense fallback={<ChampionsLeagueSkeleton />}>
        <ChampionsLeagueContent />
      </Suspense>
    </div>
  );
}

async function ChampionsLeagueContent() {
  const supabase = await createClient();
  const SEASON_ID = '2026-27';

  const gw = await getGameweekStatus();
  const currentGw = gw.syncedThroughGw;
  const displayGw = gw.displayGw;

  const { data: contentData } = await supabase
    .from('page_content')
    .select('content')
    .eq('id', 'champions-league') // or respective slug
    .order('gw_number', { ascending: false })
    .limit(1)
    .single();
  const { data: config } = await supabase.from('champions_league_config').select('*').eq('season_id', SEASON_ID).single();
  const { data: entrantsData } = await supabase.from('champions_league_entrants').select(`manager_fpl_id, season_managers!inner (team_name, managers!inner (real_name))`).eq('season_id', SEASON_ID);
  
  const { data: fixtures } = await supabase.from('tournament_fixtures').select('*').eq('season_id', SEASON_ID).eq('tournament_type', 'CHAMPIONS_LEAGUE').order('gw_number', { ascending: false });

  const entrants: Record<number, any> = {};
  entrantsData?.forEach((e: any) => { entrants[e.manager_fpl_id] = { id: e.manager_fpl_id, teamName: e.season_managers.team_name, managerName: e.season_managers.managers.real_name }; });

  // Math to determine exact Phase length
  const numEntrants = Object.keys(entrants).length;
  const p1 = numEntrants % 2 === 0 ? numEntrants : numEntrants + 1;
  const s1MaxRounds = 2 * (p1 - 1);

  const s2EntrantsCount = Math.max(0, numEntrants - 1);
  const p2 = s2EntrantsCount % 2 === 0 ? s2EntrantsCount : s2EntrantsCount + 1;
  const s2MaxRounds = 3 * (p2 - 1);

  const s1Start = config?.stage_1_start_gw || 1;
  const s2Start = config?.stage_2_start_gw || 10;
  const finalStart = config?.final_start_gw || 38;

  const isPreTournament = displayGw < s1Start;
  const isStage1Active = displayGw >= s1Start && currentGw < s1Start + s1MaxRounds;
  const isWaitingForStage2 = currentGw >= s1Start + s1MaxRounds && currentGw < s2Start;
  
  const isStage2Active = currentGw >= s2Start && currentGw < s2Start + s2MaxRounds;
  const isWaitingForFinal = currentGw >= s2Start + s2MaxRounds && currentGw < finalStart;
  
  const isFinalLive = currentGw >= finalStart;

// Table Generator
  const generateTable = (stageFixtures: any[], activeManagerIds: number[], throughGw: number = currentGw) => {
    const stats: Record<number, any> = {};
    activeManagerIds.forEach(id => { stats[id] = { ...entrants[id], played: 0, won: 0, drawn: 0, lost: 0, points: 0, totalScore: 0 }; });

    stageFixtures.forEach(fix => {
      // PREVENT FUTURE MATCHES FROM AFFECTING THE LIVE TABLE
      if (fix.manager_1_score === null) return;
      // Live-week ties show in the fixture log but only count once the gameweek is confirmed
      if (fix.gw_number > throughGw) return;

      const m1 = fix.manager_1_id; const m2 = fix.manager_2_id;
      if (stats[m1]) {
        stats[m1].played += 1; stats[m1].totalScore += fix.manager_1_score || 0;
        if (fix.winner_id === m1) { stats[m1].won += 1; stats[m1].points += 3; } else if (!fix.winner_id && m2) { stats[m1].drawn += 1; stats[m1].points += 1; } else if (fix.winner_id === m2) { stats[m1].lost += 1; }
      }
      if (m2 && stats[m2]) {
        stats[m2].played += 1; stats[m2].totalScore += fix.manager_2_score || 0;
        if (fix.winner_id === m2) { stats[m2].won += 1; stats[m2].points += 3; } else if (!fix.winner_id) { stats[m2].drawn += 1; stats[m2].points += 1; } else if (fix.winner_id === m1) { stats[m2].lost += 1; }
      }
    });
    return Object.values(stats).sort((a: any, b: any) => b.points !== a.points ? b.points - a.points : b.totalScore - a.totalScore);
  };

  const stage1Fix = fixtures?.filter(f => f.stage === 'Stage 1') || [];
  const stage2Fix = fixtures?.filter(f => f.stage === 'Stage 2') || [];
  const finalFix = fixtures?.filter(f => f.stage === 'Final')[0];

  const stage1Table = generateTable(stage1Fix, Object.keys(entrants).map(Number));
  const stage2EntrantIds = stage1Table.length > 0 ? stage1Table.slice(0, -1).map((t: any) => t.id) : [];
  const stage2Table = generateTable(stage2Fix, stage2EntrantIds);

  // Movement compares the latest counted round with the round before it within the stage.
  const stageMovement = (stageFixtures: any[], ids: number[], table: any[]) => {
    const playedGws = stageFixtures.filter(f => f.manager_1_score !== null && f.gw_number <= currentGw).map(f => f.gw_number);
    if (playedGws.length === 0) return {};
    const latest = Math.max(...playedGws);
    if (!playedGws.some(g => g < latest)) return {};
    return positionDeltas(table.map((t: any) => t.id), generateTable(stageFixtures, ids, latest - 1).map((t: any) => t.id));
  };
  const stage1Movement = stageMovement(stage1Fix, Object.keys(entrants).map(Number), stage1Table);
  const stage2Movement = stageMovement(stage2Fix, stage2EntrantIds, stage2Table);

  return (
    <>
      <PageHeader
        title="Champions League"
        badge={(
          <GameweekChip gw={gw} startGw={s1Start} />
        )}
      >
        <div className="flex flex-wrap gap-x-6 gap-y-1 mb-4 text-xs sm:text-sm font-semibold uppercase tracking-wider">
          <span className={isStage1Active || isWaitingForStage2 ? 'text-indigo-300 border-b-2 border-indigo-500 pb-0.5' : 'text-faint'}>Stage 1 · GW{s1Start}</span>
          <span className={isStage2Active || isWaitingForFinal ? 'text-indigo-300 border-b-2 border-indigo-500 pb-0.5' : 'text-faint'}>Stage 2 · GW{s2Start}</span>
          <span className={isFinalLive ? 'text-indigo-300 border-b-2 border-indigo-500 pb-0.5' : 'text-faint'}>Final · GW{finalStart}</span>
        </div>
        <p className="text-sm text-dim">
          {championsLeagueNextLine(gw, { s1Start, s2Start, finalStart, s1MaxRounds, s2MaxRounds })}
          {gw.liveGw && !isPreTournament ? ` · GW${gw.liveGw} ties are live in Fixtures & Results; standings update once the week is confirmed.` : ''}
        </p>
      </PageHeader>

      {/* TWO COLUMN LAYOUT */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 xl:gap-10">
        
        {/* LEFT COLUMN: TABLES & STAGES */}
        <div className="xl:col-span-2 space-y-8 sm:space-y-12">
          
          {isPreTournament && (
            <div className="bg-surface border border-line rounded-xl p-6 sm:p-12 shadow-sm">
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-black text-ink mb-2">Elite Group Locked In</h2>
                <p className="text-dim">Campaign begins in <strong>{s1Start - currentGw} Gameweeks</strong>.</p>
              </div>
              {Object.keys(entrants).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.values(entrants).map((e: any) => (
                    <div key={e.id} className="bg-surface-2 border border-line rounded-lg p-3 flex items-center gap-3">
                      <span className="text-indigo-300" aria-hidden="true">★</span>
                      <div className="min-w-0">
                        <TeamName name={e.teamName} inline className="text-ink min-w-0" />
                        <div className="text-xs text-dim">{e.managerName}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-faint italic">Entrants have not been selected yet.</p>
              )}
            </div>
          )}

          {/* ==========================================
              PHASE 3: THE FINAL (PREVIEW OR LIVE)
          ========================================== */}
          {(isFinalLive && finalFix) ? (
            <div className="bg-gradient-to-br from-panel via-indigo-950 to-panel text-white rounded-2xl shadow-2xl overflow-hidden border border-indigo-900/50 mb-12">
              <div className="p-4 text-center border-b border-indigo-800/50 bg-black/20">
                <span className="text-indigo-400 font-bold tracking-[0.2em] uppercase text-xs">The Final Showdown • Live GW {displayGw}</span>
              </div>
              <div className="p-5 sm:p-10 flex flex-col sm:flex-row gap-4 sm:gap-0 justify-between items-center text-center">
                <div className="flex-1 min-w-0">
                  <TeamName name={entrants[finalFix.manager_1_id]?.teamName} className="text-xl sm:text-3xl text-white mb-2" />
                  <div className="text-indigo-300 font-bold text-2xl">{finalFix.manager_1_score} pts</div>
                </div>
                <div className="sm:px-8"><span className="text-2xl sm:text-4xl font-black text-dim">VS</span></div>
                <div className="flex-1 min-w-0">
                  <TeamName name={entrants[finalFix.manager_2_id]?.teamName} className="text-xl sm:text-3xl text-white mb-2" />
                  <div className="text-indigo-300 font-bold text-2xl">{finalFix.manager_2_score} pts</div>
                </div>
              </div>
              {finalFix.winner_id && finalFix.gw_number <= currentGw && (
                <div className="bg-indigo-600 p-4 sm:p-6 text-center shadow-inner">
                  <span className="text-white font-black text-lg sm:text-2xl tracking-widest uppercase drop-shadow-md">
                    🏆 <TeamName name={entrants[finalFix.winner_id]?.teamName} inline className="align-middle" /> <span className="align-middle">is the Champion 🏆</span>
                  </span>
                </div>
              )}
            </div>
          ) : (isWaitingForFinal && stage2Table.length >= 2) && (
            <div className="bg-gradient-to-br from-panel via-indigo-950 to-panel text-white rounded-2xl shadow-xl overflow-hidden border border-indigo-900/50 mb-12">
              <div className="p-4 text-center border-b border-indigo-800/50 bg-black/20 flex flex-col items-center">
                <span className="text-yellow-400 font-bold tracking-[0.2em] uppercase text-xs mb-1">Stage 2 Concluded</span>
                <span className="text-indigo-300 font-semibold text-sm">Upcoming Final Showdown • Gameweek {finalStart}</span>
              </div>
              <div className="p-5 sm:p-10 flex flex-col sm:flex-row gap-4 sm:gap-0 justify-between items-center text-center opacity-90">
                <div className="flex-1 min-w-0">
                  <TeamName name={stage2Table[0].teamName} className="text-xl sm:text-3xl text-white mb-2" />
                  <div className="text-indigo-400 font-bold text-sm uppercase tracking-widest">Finalist</div>
                </div>
                <div className="sm:px-8"><span className="text-2xl sm:text-4xl font-black text-dim">VS</span></div>
                <div className="flex-1 min-w-0">
                  <TeamName name={stage2Table[1].teamName} className="text-xl sm:text-3xl text-white mb-2" />
                  <div className="text-indigo-400 font-bold text-sm uppercase tracking-widest">Finalist</div>
                </div>
              </div>
              <div className="bg-panel-2/50 p-4 text-center shadow-inner">
                 <span className="text-faint font-semibold tracking-widest uppercase text-xs">Match will be played in Gameweek {finalStart}</span>
              </div>
            </div>
          )}

          {/* ==========================================
              PHASE 2: STAGE 2 TABLE 
          ========================================== */}
          {(isStage2Active || isWaitingForFinal || isFinalLive) && stage2Table.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-ink mb-6 flex items-center gap-2">
                Stage 2 Standings 
                {isStage2Active && <span className="bg-red-500/15 text-red-400 text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">Live Matches</span>}
              </h2>
                  <StageTable data={stage2Table} isLive={isStage2Active} eliminateCount={Math.max(0, stage2Table.length - 2)} highlightTop={!isStage2Active ? 2 : 0} movement={stage2Movement} />
                  <StageList data={stage2Table} isLive={isStage2Active} eliminateCount={Math.max(0, stage2Table.length - 2)} highlightTop={!isStage2Active ? 2 : 0} movement={stage2Movement} />
            </section>
          )}

          {isWaitingForStage2 && (
            <div className="bg-surface-2 border border-line text-ink-2 p-4 sm:p-6 rounded-xl text-center shadow-sm">
              <h3 className="font-black text-xl mb-1">Stage 1 Concluded</h3>
              <p>Teams have completed their matches. Stage 2 begins in Gameweek {s2Start}.</p>
            </div>
          )}

          {(isStage1Active || isWaitingForStage2 || isStage2Active || isWaitingForFinal || isFinalLive) && stage1Table.length > 0 && (
            <section className={!isStage1Active && !isWaitingForStage2 ? 'opacity-70 scale-[0.98] transform origin-top transition-all' : ''}>
              <h2 className="text-2xl font-bold text-ink mb-6 flex items-center gap-2">
                Stage 1 Standings
                {isStage1Active && <span className="bg-red-500/15 text-red-400 text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">Live Matches</span>}
                {!isStage1Active && <span className="bg-surface-3 text-dim text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider">Completed</span>}
              </h2>
              <StageTable data={stage1Table} isLive={isStage1Active} eliminateCount={1} movement={stage1Movement} />
              <StageList data={stage1Table} isLive={isStage1Active} eliminateCount={1} movement={stage1Movement} />
            </section>
          )}
        </div>

        {/* RIGHT COLUMN: LIVE FIXTURE LOG (collapsible below xl, where it sits under the tables) */}
        <div className="xl:col-span-1">
          <details className="xl:hidden bg-panel rounded-xl shadow-xl overflow-hidden">
            <summary className="p-4 bg-panel-2 border-b border-line flex justify-between items-center gap-3 cursor-pointer list-none">
              <h2 className="font-bold text-white tracking-widest uppercase text-sm">Fixtures & Results</h2>
              <span className="text-xs text-faint text-right">{fixtures?.filter(f => f.stage !== 'Final').length || 0} fixtures · tap to expand</span>
            </summary>
            <div className="p-3 space-y-3">
              <FixtureLog fixtures={fixtures} entrants={entrants} liveGw={gw.liveGw} />
            </div>
          </details>
          <div className="hidden xl:block bg-panel rounded-xl shadow-xl overflow-hidden sticky top-8">
            <div className="p-4 bg-panel-2 border-b border-line flex justify-between items-center">
              <h2 className="font-bold text-white tracking-widest uppercase text-sm">Fixtures & Results</h2>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            </div>
            <div className="p-4 space-y-3 max-h-[800px] overflow-y-auto">
              <FixtureLog fixtures={fixtures} entrants={entrants} liveGw={gw.liveGw} />
            </div>
          </div>
        </div>

      </div>
    </>
  );
}

// ==========================================
// FIXTURE LOG (shared by the sticky desktop panel and the mobile accordion)
// ==========================================
function FixtureLog({ fixtures, entrants, liveGw }: { fixtures: any[] | null | undefined, entrants: Record<number, any>, liveGw: number | null }) {
  const list = fixtures?.filter(f => f.stage !== 'Final') || [];
  if (list.length === 0) return <div className="text-center text-dim italic py-8">Schedule pending.</div>;

  return (
    <>
      {list.map((fix) => {
        const isPlayed = fix.manager_1_score !== null;
        const isLiveFix = isPlayed && fix.gw_number === liveGw;

        return (
          <div key={fix.id} className={`rounded p-3 text-sm flex flex-col gap-2 border ${isPlayed ? 'bg-surface-2 border-line' : 'bg-surface-2/40 border-line/50 border-dashed'}`}>
            <div className="text-[10px] text-faint font-bold uppercase tracking-wider flex justify-between">
              <span className="flex items-center gap-2">GW {fix.gw_number} {isLiveFix && <LiveChip />}</span>
              <span className={isPlayed ? 'text-indigo-400' : 'text-dim'}>{fix.stage}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className={`flex min-w-0 w-2/5 font-semibold ${!isPlayed ? 'text-faint' : !isLiveFix && fix.winner_id === fix.manager_1_id ? 'text-green-400' : 'text-ink-2'}`}>
                <TeamName name={entrants[fix.manager_1_id]?.teamName} inline className="min-w-0" />
              </span>

              {isPlayed ? (
                <span className="bg-panel-2 text-white font-mono px-2 py-1 rounded text-xs shadow-inner shrink-0">
                  {fix.manager_1_score} - {fix.manager_2_score}
                </span>
              ) : (
                <span className="bg-surface-3 text-faint font-bold px-2 py-1 rounded text-[10px] uppercase tracking-widest shrink-0">
                  VS
                </span>
              )}

              <span className={`flex justify-end min-w-0 w-2/5 text-right font-semibold ${!isPlayed ? 'text-faint' : !isLiveFix && fix.winner_id === fix.manager_2_id ? 'text-green-400' : 'text-ink-2'}`}>
                <TeamName name={entrants[fix.manager_2_id]?.teamName} inline className="min-w-0" />
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ==========================================
// MOBILE STAGE LIST (mirrors StageTable's rows and badges)
// ==========================================
function StageList({ data, isLive, eliminateCount, highlightTop, movement = {} }: { data: any[], isLive: boolean, eliminateCount: number, highlightTop?: number, movement?: Record<number, number | null> }) {
  return (
    <div className="md:hidden space-y-2">
      {data.map((team: any, index: number) => {
        const isBottom = index >= data.length - eliminateCount;
        const isTop = highlightTop && index < highlightTop;
        let card = 'bg-surface border-line';
        let badge = null;
        if (isLive && isBottom) {
          card = 'bg-red-500/10 border-red-500/30';
          badge = <span className="text-[10px] bg-orange-500/15 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded font-bold uppercase">Danger Zone</span>;
        } else if (!isLive && isBottom) {
          card = 'bg-surface-2 border-line opacity-70';
          badge = <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-bold uppercase">Eliminated</span>;
        } else if (!isLive && isTop) {
          card = 'bg-green-500/10 border-green-500/30';
          badge = <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded font-bold uppercase">Promoted</span>;
        }

        return (
          <div key={team.id} className={`border rounded-lg p-3 shadow-sm ${card}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <span className="w-6 shrink-0 text-sm font-black text-faint leading-6">{index + 1}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <TeamName name={team.teamName} inline className="font-semibold text-ink min-w-0" />
                    <MovementArrow delta={movement[team.id]} />
                    {badge}
                  </div>
                  <div className="text-xs text-dim">{team.managerName}</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-black text-ink leading-6">{team.points}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-faint">Pts</div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-line/70 flex items-center justify-between text-xs text-dim">
              <span>P <b className="text-ink-2">{team.played}</b> · W <b className="text-green-400">{team.won}</b> · D <b className="text-dim">{team.drawn}</b> · L <b className="text-red-500">{team.lost}</b></span>
              <span>Total <b className="text-ink-2">{team.totalScore}</b></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==========================================
// DYNAMIC TABLE COMPONENT
// ==========================================
function StageTable({ data, isLive, eliminateCount, highlightTop, movement = {} }: { data: any[], isLive: boolean, eliminateCount: number, highlightTop?: number, movement?: Record<number, number | null> }) {
  return (
    <div className="hidden md:block bg-surface rounded-xl shadow-sm border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-panel text-white">
            <tr>
              <th className="p-4 w-12 text-center">Pos</th>
              <th className="p-4">Manager & Team</th>
              <th className="p-4 text-center w-16">Pld</th>
              <th className="p-4 text-center w-16">W</th>
              <th className="p-4 text-center w-16">D</th>
              <th className="p-4 text-center w-16">L</th>
              <th className="p-4 text-right w-24">Total</th>
              <th className="p-4 text-right w-24 text-indigo-300 font-bold">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.map((team: any, index: number) => {
              const isBottom = index >= data.length - eliminateCount;
              const isTop = highlightTop && index < highlightTop;
              
              let rowClass = "hover:bg-surface-2 transition-colors";
              let badge = null;

              if (isLive && isBottom) {
                rowClass = "bg-red-500/10 hover:bg-red-500/15 text-red-200 transition-colors";
                badge = <span className="text-[10px] bg-orange-500/15 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded font-bold uppercase">Danger Zone</span>;
              } else if (!isLive && isBottom) {
                rowClass = "bg-surface-2 text-faint opacity-60 grayscale";
                badge = <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-bold uppercase">Eliminated</span>;
              } else if (!isLive && isTop) {
                rowClass = "bg-green-500/10 text-green-900";
                badge = <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded font-bold uppercase">Promoted</span>;
              }

              return (
                <tr key={team.id} className={rowClass}>
                  <td className="p-4 text-center font-bold">{index + 1}</td>
                  <td className="p-4">
                    <div className="font-bold flex items-center gap-2">
                      <TeamName name={team.teamName} inline /> <MovementArrow delta={movement[team.id]} /> {badge}
                    </div>
                    <div className={`text-xs ${isLive && isBottom ? 'text-red-400/70' : 'text-dim'}`}>{team.managerName}</div>
                  </td>
                  <td className="p-4 text-center font-medium">{team.played}</td>
                  <td className="p-4 text-center font-semibold">{team.won}</td>
                  <td className="p-4 text-center font-semibold">{team.drawn}</td>
                  <td className="p-4 text-center font-semibold">{team.lost}</td>
                  <td className="p-4 text-right">{team.totalScore}</td>
                  <td className="p-4 text-right font-black text-lg bg-white/5">{team.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
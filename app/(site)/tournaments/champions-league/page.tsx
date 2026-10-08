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
import { getWeekProjection, dueFor, type WeekProjection } from '@/lib/projection';
import DueMark from '@/components/DueMark';
import SectionHeading from '@/components/SectionHeading';

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
  const projection = gw.liveGw ? await getWeekProjection() : null;

  // A week shows only its own write-up; an older one would be misleading.
  const { data: contentData } = await supabase
    .from('page_content')
    .select('content')
    .eq('id', 'champions-league')
    .eq('gw_number', currentGw)
    .maybeSingle();
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

  const stageTab = (on: boolean) => `font-display text-lg sm:text-xl leading-none tracking-[0.03em] pb-1.5 border-b-[3px] ${on ? 'text-ink border-brand' : 'text-faint border-transparent'}`;

  return (
    <>
      <PageHeader
        title="Champions League"
        badge={<GameweekChip gw={gw} startGw={s1Start} />}
      >
        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
          <span className={stageTab(isStage1Active || isWaitingForStage2)}>Stage 1 · GW{s1Start}</span>
          <span className={stageTab(isStage2Active || isWaitingForFinal)}>Stage 2 · GW{s2Start}</span>
          <span className={stageTab(isFinalLive)}>Final · GW{finalStart}</span>
        </div>
        {!isPreTournament && <p className="text-dim max-w-[34rem]">
          {championsLeagueNextLine(gw, { s1Start, s2Start, finalStart, s1MaxRounds, s2MaxRounds })}
          {gw.liveGw ? ` · GW${gw.liveGw} ties are live in Fixtures & Results; standings update once the week is confirmed.` : ''}
        </p>}
      </PageHeader>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 xl:gap-0 xl:divide-x xl:divide-line">
        <div className="xl:col-span-2 space-y-12 xl:pr-8">

          {isPreTournament && (
            <section>
              <SectionHeading aside={<span className="text-dim">Campaign begins in <b className="text-ink">{s1Start - currentGw} Gameweek{s1Start - currentGw === 1 ? '' : 's'}</b></span>}>Elite Group Locked In</SectionHeading>
              {Object.keys(entrants).length > 0 ? (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  {Object.values(entrants).map((e: any) => (
                    <li key={e.id} className="py-2.5 border-b border-line min-w-0">
                      <TeamName name={e.teamName} managerId={e.id} inline className="font-semibold text-ink min-w-0" />
                      <div className="text-sm text-dim">{e.managerName}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-faint italic">Entrants have not been selected yet.</p>
              )}
            </section>
          )}

          {(isFinalLive && finalFix) ? (
            <section>
              <SectionHeading aside={<LiveChip label={`Live · GW${displayGw}`} />}>The Final Showdown</SectionHeading>
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center py-4">
                <div className="flex-1 min-w-0">
                  <TeamName name={entrants[finalFix.manager_1_id]?.teamName} managerId={finalFix.manager_1_id} className="font-display text-3xl sm:text-4xl leading-none text-ink" />
                  <div className="font-display text-5xl leading-none text-ink mt-2">{finalFix.manager_1_score}</div>
                </div>
                <span className="font-display text-3xl text-faint">v</span>
                <div className="flex-1 min-w-0">
                  <TeamName name={entrants[finalFix.manager_2_id]?.teamName} managerId={finalFix.manager_2_id} className="font-display text-3xl sm:text-4xl leading-none text-ink" />
                  <div className="font-display text-5xl leading-none text-ink mt-2">{finalFix.manager_2_score}</div>
                </div>
              </div>
              {finalFix.winner_id && finalFix.gw_number <= currentGw && (
                <div className="bg-brand text-white text-center py-4 px-4 rounded-sm">
                  <span className="font-display text-2xl sm:text-3xl leading-none tracking-[0.02em]">
                    <TeamName name={entrants[finalFix.winner_id]?.teamName} managerId={finalFix.winner_id} inline className="align-middle" /> <span className="align-middle">is the champion</span>
                  </span>
                </div>
              )}
            </section>
          ) : (isWaitingForFinal && stage2Table.length >= 2) && (
            <section>
              <SectionHeading aside={<span className="label">Stage 2 Concluded</span>}>Upcoming Final Showdown · Gameweek {finalStart}</SectionHeading>
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center py-4">
                <div className="flex-1 min-w-0">
                  <TeamName name={stage2Table[0].teamName} managerId={stage2Table[0].id} className="font-display text-3xl sm:text-4xl leading-none text-ink" />
                  <div className="label mt-2">Finalist</div>
                </div>
                <span className="font-display text-3xl text-faint">v</span>
                <div className="flex-1 min-w-0">
                  <TeamName name={stage2Table[1].teamName} managerId={stage2Table[1].id} className="font-display text-3xl sm:text-4xl leading-none text-ink" />
                  <div className="label mt-2">Finalist</div>
                </div>
              </div>
              <p className="text-center text-sm text-dim">Match will be played in Gameweek {finalStart}.</p>
            </section>
          )}

          {(isStage2Active || isWaitingForFinal || isFinalLive) && stage2Table.length > 0 && (
            <section>
              <SectionHeading aside={isStage2Active ? <LiveChip label="Live matches" /> : undefined}>Stage 2 Standings</SectionHeading>
              <StageTable data={stage2Table} isLive={isStage2Active} eliminateCount={Math.max(0, stage2Table.length - 2)} highlightTop={!isStage2Active ? 2 : 0} movement={stage2Movement} />
            </section>
          )}

          {isWaitingForStage2 && (
            <p className="text-ink-2"><b className="font-display text-xl tracking-[0.02em] mr-2">Stage 1 Concluded.</b>Teams have completed their matches. Stage 2 begins in Gameweek {s2Start}.</p>
          )}

          {(isStage1Active || isWaitingForStage2 || isStage2Active || isWaitingForFinal || isFinalLive) && stage1Table.length > 0 && (
            <section>
              <SectionHeading aside={isStage1Active ? <LiveChip label="Live matches" /> : <span className="label">Completed</span>}>Stage 1 Standings</SectionHeading>
              <StageTable data={stage1Table} isLive={isStage1Active} eliminateCount={1} movement={stage1Movement} />
            </section>
          )}
        </div>

        {/* Fixture log: collapsible below xl, where it sits under the tables */}
        <div className="xl:col-span-1 xl:pl-8">
          <details className="xl:hidden border-y border-line">
            <summary className="py-3 flex justify-between items-center gap-3 cursor-pointer list-none">
              <h2 className="font-display text-2xl leading-none tracking-[0.01em] text-ink">Fixtures &amp; Results</h2>
              <span className="text-sm text-dim text-right">{fixtures?.filter(f => f.stage !== 'Final').length || 0} fixtures · tap to expand</span>
            </summary>
            <div className="pb-3">
              <FixtureLog fixtures={fixtures} entrants={entrants} liveGw={gw.liveGw} projection={projection} />
            </div>
          </details>
          <div className="hidden xl:block sticky top-28">
            <SectionHeading className="mb-1">Fixtures &amp; Results</SectionHeading>
            <div className="max-h-[800px] overflow-y-auto pr-1">
              <FixtureLog fixtures={fixtures} entrants={entrants} liveGw={gw.liveGw} projection={projection} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ==========================================
// FIXTURE LOG (shared by the sticky desktop column and the mobile accordion)
// ==========================================
function FixtureLog({ fixtures, entrants, liveGw, projection }: { fixtures: any[] | null | undefined, entrants: Record<number, any>, liveGw: number | null, projection: WeekProjection | null }) {
  const list = fixtures?.filter(f => f.stage !== 'Final') || [];
  if (list.length === 0) return <div className="text-center text-dim italic py-8">Schedule pending.</div>;

  return (
    <div className="divide-y divide-line">
      {list.map((fix) => {
        const isPlayed = fix.manager_1_score !== null;
        const isLiveFix = isPlayed && fix.gw_number === liveGw;
        const d1 = isLiveFix && projection ? dueFor(projection, fix.gw_number, fix.manager_1_id) : null;
        const d2 = isLiveFix && projection ? dueFor(projection, fix.gw_number, fix.manager_2_id) : null;
        const s1 = isPlayed ? fix.manager_1_score + (d1?.due || 0) : null;
        const s2 = isPlayed ? fix.manager_2_score + (d2?.due || 0) : null;
        const won1 = isPlayed && !isLiveFix && fix.winner_id === fix.manager_1_id;
        const won2 = isPlayed && !isLiveFix && fix.winner_id === fix.manager_2_id;

        return (
          <div key={fix.id} className="py-2.5 text-sm">
            <div className="flex justify-between items-center gap-2 mb-1">
              <span className="label flex items-center gap-2">GW{fix.gw_number} {isLiveFix && <LiveChip />}</span>
              <span className="label">{fix.stage}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className={`flex min-w-0 w-2/5 ${!isPlayed ? 'text-dim' : won1 ? 'font-bold text-ink' : 'text-ink-2'}`}>
                <TeamName name={entrants[fix.manager_1_id]?.teamName} managerId={fix.manager_1_id} inline className="min-w-0" />
              </span>
              {isPlayed ? (
                <span className={`plate font-display text-xl shrink-0 whitespace-nowrap ${isLiveFix ? 'text-live-2' : 'text-ink'}`}>
                  <DueMark due={d1} className="mr-1 font-sans" />{s1}<span className="text-faint mx-1">-</span>{s2}<DueMark due={d2} className="ml-1 font-sans" />
                </span>
              ) : (
                <span className="plate label shrink-0 px-2.5">v</span>
              )}
              <span className={`flex justify-end min-w-0 w-2/5 text-right ${!isPlayed ? 'text-dim' : won2 ? 'font-bold text-ink' : 'text-ink-2'}`}>
                <TeamName name={entrants[fix.manager_2_id]?.teamName} managerId={fix.manager_2_id} inline className="min-w-0" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==========================================
// STAGE TABLE: one table at every width; phones fold W/D/L and the total into the team cell.
// ==========================================
const TAG = 'shrink-0 text-xs font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-sm';

function StageTable({ data, isLive, eliminateCount, highlightTop, movement = {} }: { data: any[], isLive: boolean, eliminateCount: number, highlightTop?: number, movement?: Record<number, number | null> }) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b-2 border-ink/80">
          <th className="label font-semibold py-2 pr-3 w-10">Pos</th>
          <th className="label font-semibold py-2 pr-3">Team</th>
          <th className="label font-semibold py-2 px-2 text-center w-12 hidden md:table-cell">Pld</th>
          <th className="label font-semibold py-2 px-2 text-center w-12 hidden md:table-cell">W</th>
          <th className="label font-semibold py-2 px-2 text-center w-12 hidden md:table-cell">D</th>
          <th className="label font-semibold py-2 px-2 text-center w-12 hidden md:table-cell">L</th>
          <th className="label font-semibold py-2 px-2 text-right w-20 hidden md:table-cell">Total</th>
          <th className="label font-semibold py-2 px-3 text-right w-16 text-ink key-col">Pts</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {data.map((team: any, index: number) => {
          const isBottom = index >= data.length - eliminateCount;
          const isTop = highlightTop && index < highlightTop;
          const out = !isLive && isBottom;
          const tag = isLive && isBottom ? <span className={`${TAG} border border-loss-2/60 text-loss-2`}>Danger zone</span>
            : out ? <span className={`${TAG} bg-loss text-white`}>Eliminated</span>
            : !isLive && isTop ? <span className={`${TAG} bg-win text-white`}>Promoted</span>
            : null;

          return (
            <tr key={team.id} className={out ? 'text-faint' : isLive && isBottom ? 'bg-loss/10' : 'hover:bg-surface'}>
              <td className="py-3 pr-3 font-display text-2xl leading-none text-faint">{index + 1}</td>
              <td className="py-3 pr-3 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <TeamName name={team.teamName} managerId={team.id} inline className={`font-semibold min-w-0 ${out ? 'text-dim' : 'text-ink'}`} />
                  <MovementArrow delta={movement[team.id]} />
                  {tag}
                </div>
                <div className="text-dim">
                  {team.managerName}
                  <span className="md:hidden tabular"> · {team.won}W {team.drawn}D {team.lost}L · {team.totalScore}</span>
                </div>
              </td>
              <td className="py-3 px-2 text-center text-dim hidden md:table-cell">{team.played}</td>
              <td className="py-3 px-2 text-center font-semibold text-win-2 hidden md:table-cell">{team.won}</td>
              <td className="py-3 px-2 text-center font-semibold text-dim hidden md:table-cell">{team.drawn}</td>
              <td className="py-3 px-2 text-center font-semibold text-loss-2 hidden md:table-cell">{team.lost}</td>
              <td className="py-3 px-2 text-right text-dim hidden md:table-cell">{team.totalScore}</td>
              <td className={`py-3 px-3 text-right font-display text-3xl leading-none key-col ${out ? 'text-dim' : 'text-ink'}`}>{team.points}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

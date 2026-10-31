import { cacheLife, cacheTag } from 'next/cache';
import { createPublicClient } from '@/utils/supabase/public';
import { SITE_DATA_TAG } from '@/lib/site-cache';
import TeamName from '@/components/TeamName';
import { Suspense } from 'react';
import { ChampionsLeagueSkeleton, BadgeSkeleton } from '@/components/Skeletons';
import { GameweekChip, LiveChip } from '@/components/GameweekBadge';
import PageHeader from '@/components/PageHeader';
import MovementArrow from '@/components/MovementArrow';
import { positionDeltas } from '@/lib/movement';
import { getGameweekStatus, getFplEvents, formatUk } from '@/lib/gameweek-status';
import { uniqueTies } from '@/lib/tournament-fixtures';
import { championsLeagueNextLine } from '@/lib/tournament-next';
import { getWeekProjection, dueFor, type WeekProjection } from '@/lib/projection';
import DueMark from '@/components/DueMark';
import SectionHeading from '@/components/SectionHeading';
import ScrollFade from '@/components/ScrollFade';

export default function ChampionsLeaguePage() {
  return (
    <div className="max-w-7xl mx-auto py-2 sm:py-8 font-sans">
      <Suspense fallback={<><PageHeader title="Champions League" rules pending badge={<BadgeSkeleton />} /><ChampionsLeagueSkeleton /></>}>
        <ChampionsLeagueContent />
      </Suspense>
    </div>
  );
}

// Cached, so the page is built once per ingest and served ready-made (see lib/site-cache.ts).
async function ChampionsLeagueContent() {
  'use cache';
  cacheTag(SITE_DATA_TAG);
  const supabase = createPublicClient();
  const SEASON_ID = '2026-27';

  const gw = await getGameweekStatus();
  if (gw.fplAvailable) cacheLife('league'); else cacheLife('brief');
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
  
  const { data: fixtureRows } = await supabase.from('tournament_fixtures').select('*').eq('season_id', SEASON_ID).eq('tournament_type', 'CHAMPIONS_LEAGUE');
  const fixtures = uniqueTies(fixtureRows as any[]).sort((a, b) => a.gw_number - b.gw_number || a.manager_1_id - b.manager_1_id);
  const events = await getFplEvents();

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

  // Who plays in each stage, so a week's list can say who sits it out (odd numbers leave one idle).
  const stagePool: Record<string, number[]> = { 'Stage 1': Object.keys(entrants).map(Number), 'Stage 2': stage2EntrantIds };
  const sittingOut = (stage: string, ties: any[]) => (stagePool[stage] || []).filter(id => !ties.some(t => t.manager_1_id === id || t.manager_2_id === id));

  // Next up: the first week after the one in play, so managers know their opponent while they
  // set their team for it. The Final has its own section.
  const afterGw = gw.liveGw ?? currentGw;
  const nextGw = fixtures.filter(f => f.stage !== 'Final' && f.gw_number > afterGw).reduce((min: number | null, f) => (min === null || f.gw_number < min ? f.gw_number : min), null);
  const nextTies = nextGw === null ? [] : fixtures.filter(f => f.stage !== 'Final' && f.gw_number === nextGw);
  const nextDeadline = nextGw === null ? null : events?.find(e => e.id === nextGw)?.deadline_time ?? null;

  const stageTab = (on: boolean) => `font-display text-lg sm:text-xl leading-none tracking-[0.03em] pb-1.5 border-b-[3px] ${on ? 'text-ink border-brand' : 'text-faint border-transparent'}`;

  return (
    <>
      <PageHeader
        title="Champions League"
        rules
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

          {nextTies.length > 0 && (
            <section>
              <SectionHeading aside={nextDeadline ? <span className="text-dim">Deadline <b className="text-ink">{formatUk(nextDeadline)}</b></span> : undefined}>Next up · GW{nextGw}</SectionHeading>
              <div className="max-w-xl mx-auto">
                {nextTies.map(fix => <TieRow key={fix.id} fix={fix} entrants={entrants} liveGw={gw.liveGw} projection={projection} />)}
                <SitsOut ids={sittingOut(nextTies[0].stage, nextTies)} entrants={entrants} className="mt-2 text-center" />
              </div>
            </section>
          )}

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

        {/* Fixture log: open at every width. Below xl it follows the tables at the foot of the
            page at full length. At xl it is a side column exactly as tall as the left-hand column
            (its content is positioned out of the flow, so the left side alone sets the row's
            height), scrolling inside with a fade at the foot while there is more. */}
        <div className="xl:col-span-1 xl:relative xl:min-h-[36rem]">
          <div className="xl:absolute xl:inset-0 xl:pl-8 xl:flex xl:flex-col">
            <SectionHeading className="mb-1">Fixtures &amp; Results</SectionHeading>
            <ScrollFade className="xl:flex-1 xl:min-h-0" boxClassName="xl:h-full xl:overflow-y-auto xl:pr-1 xl:overscroll-contain">
              <FixtureLog fixtures={fixtures} entrants={entrants} liveGw={gw.liveGw} nextGw={nextGw} projection={projection} sittingOut={sittingOut} />
            </ScrollFade>
          </div>
        </div>
      </div>
    </>
  );
}

// ==========================================
// FIXTURE LOG (open at every width): every week of the competition in order, results then the
// ties still to come. One heading per week carries who sits it out, and the names sit either side
// of the score box rather than at the edges, so each tie reads as one line.
// ==========================================
function FixtureLog({ fixtures, entrants, liveGw, nextGw, projection, sittingOut }: { fixtures: any[], entrants: Record<number, any>, liveGw: number | null, nextGw: number | null, projection: WeekProjection | null, sittingOut: (stage: string, ties: any[]) => number[] }) {
  const list = fixtures.filter(f => f.stage !== 'Final');
  if (list.length === 0) return <div className="text-center text-dim italic py-8">Schedule pending.</div>;
  const weeks = [...new Set(list.map(f => f.gw_number))];

  return (
    <div>
      {weeks.map((week, i) => {
        const ties = list.filter(f => f.gw_number === week);
        const stage = ties[0].stage;
        const newStage = i > 0 && list.find(f => f.gw_number === weeks[i - 1])?.stage !== stage;
        return (
          <div key={week} className="border-t border-line first:border-t-0 pt-3 pb-4">
            {newStage && <div className="label text-brand-2 mb-2">{stage}</div>}
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className="flex items-center gap-2">
                <span className="font-display text-xl leading-none tracking-[0.02em] text-ink">GW{week}</span>
                {week === liveGw && ties.some(t => t.manager_1_score !== null) && <LiveChip />}
                {week === nextGw && <span className="label text-brand-2">Next up</span>}
              </span>
              <SitsOut ids={sittingOut(stage, ties)} entrants={entrants} className="text-right" />
            </div>
            {ties.map(fix => <TieRow key={fix.id} fix={fix} entrants={entrants} liveGw={liveGw} projection={projection} />)}
          </div>
        );
      })}
    </div>
  );
}

function SitsOut({ ids, entrants, className = '' }: { ids: number[], entrants: Record<number, any>, className?: string }) {
  if (ids.length === 0) return null;
  return (
    <p className={`text-xs text-dim min-w-0 ${className}`}>
      Sits out: {ids.map((id, i) => <span key={id}>{i > 0 && ', '}<TeamName name={entrants[id]?.teamName} managerId={id} inline className="text-ink-2" /></span>)}
    </p>
  );
}

function TieRow({ fix, entrants, liveGw, projection }: { fix: any, entrants: Record<number, any>, liveGw: number | null, projection: WeekProjection | null }) {
  const isPlayed = fix.manager_1_score !== null;
  const isLiveFix = isPlayed && fix.gw_number === liveGw;
  const d1 = isLiveFix && projection ? dueFor(projection, fix.gw_number, fix.manager_1_id) : null;
  const d2 = isLiveFix && projection ? dueFor(projection, fix.gw_number, fix.manager_2_id) : null;
  const s1 = isPlayed ? fix.manager_1_score + (d1?.due || 0) : null;
  const s2 = isPlayed ? fix.manager_2_score + (d2?.due || 0) : null;
  const won1 = isPlayed && !isLiveFix && fix.winner_id === fix.manager_1_id;
  const won2 = isPlayed && !isLiveFix && fix.winner_id === fix.manager_2_id;
  const marks = !!(d1?.due || d2?.due);
  const nameCls = (won: boolean) => won ? 'font-bold text-ink' : 'font-semibold text-ink-2';

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 py-1 text-sm">
      <span className={`flex justify-end text-right min-w-0 ${nameCls(won1)}`}>
        <TeamName name={entrants[fix.manager_1_id]?.teamName} managerId={fix.manager_1_id} inline className="min-w-0 max-w-full" />
      </span>
      {isPlayed ? (
        <span className={`plate w-[5.5rem] h-7 font-display text-xl leading-none whitespace-nowrap ${isLiveFix ? 'text-live-2' : 'text-ink'}`}>
          {s1}<span className="text-faint mx-1">-</span>{s2}
        </span>
      ) : (
        <span className="plate w-[5.5rem] h-7 label">v</span>
      )}
      <span className={`flex min-w-0 ${nameCls(won2)}`}>
        <TeamName name={entrants[fix.manager_2_id]?.teamName} managerId={fix.manager_2_id} inline className="min-w-0 max-w-full" />
      </span>
      {/* Only a tie with subs due gets the extra line, so the list stays tight otherwise. */}
      {marks && (
        <span className="col-start-2 grid grid-cols-2 justify-items-center w-[5.5rem] mt-0.5 whitespace-nowrap">
          <span className="flex"><DueMark due={d1} compact /></span>
          <span className="flex"><DueMark due={d2} compact /></span>
        </span>
      )}
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
          <th className="label font-semibold py-2 pr-1 w-9">Pos</th>
          <th className="w-10 pr-2"><span className="sr-only">Movement</span></th>
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
              <td className="py-3 pr-1 font-display text-2xl leading-none text-faint">{index + 1}</td>
              <td className="py-3 pr-2 whitespace-nowrap"><MovementArrow delta={movement[team.id]} /></td>
              <td className="py-3 pr-3 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <TeamName name={team.teamName} managerId={team.id} inline className={`font-semibold min-w-0 ${out ? 'text-dim' : 'text-ink'}`} />
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

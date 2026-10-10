import { createClient } from '@/utils/supabase/server';
import TeamName, { getTeamNameDisplayText } from '@/components/TeamName';
import Link from 'next/link';
import { Suspense } from 'react';
import { DashboardSkeleton } from '@/components/Skeletons';
import Snippet from '@/components/snippet';
import BackPageBanner from '@/components/BackPageBanner';
import { GameweekChip } from '@/components/GameweekBadge';
import MovementArrow, { NewEntryMark } from '@/components/MovementArrow';
import { positionDeltas } from '@/lib/movement';
import { compareStanding } from '@/lib/standings';
import { getWeekProjection, dueFor } from '@/lib/projection';
import { writeUpLead } from '@/lib/richtext';
import TeamOfTheWeekBanner from '@/components/TeamOfTheWeekBanner';
import { FeedbackBanner } from '@/components/Feedback';
import SectionHeading from '@/components/SectionHeading';
import DueMark from '@/components/DueMark';
import { getGameweekStatus, getFplEvents } from '@/lib/gameweek-status';
import { buildMotm } from '@/lib/motm';
import { DIVISIONS } from '@/lib/divisions';
import { eliminatorNextLine, onionBaggersNextLine, championsLeagueNextLine } from '@/lib/tournament-next';

// =========================================
// 1. THE FAST-LOADING PAGE SHELL
// =========================================
export default function Dashboard() {
  return (
    <div className="relative pb-4">
      <header className="mb-8 sm:mb-10">
        <h1 className="sr-only">ITF Hub: live updates and standings for the 2026-27 season</h1>
        <BackPageBanner />
      </header>

      {/* The Suspense boundary stops Next.js from throwing the Blocking Navigation error */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

// =========================================
// 2. THE HEAVY DATA-FETCHING COMPONENT
// =========================================
async function DashboardContent() {
  const supabase = await createClient();
  const SEASON_ID = '2026-27';

  // A. Gameweek status: the synced week, plus the live week when one is in progress
  const gw = await getGameweekStatus();
  const currentGw = gw.syncedThroughGw;

  // B. Fetch CMS content
  // Only this week's write-ups; an older one next to this week's table would mislead.
  const { data: contentData } = await supabase.from('page_content').select('id, content').eq('gw_number', currentGw);
  const leads: Record<string, Lead> = Object.fromEntries((contentData || []).map((item: any) => [item.id, writeUpLead(item.content)]));
  const noWriteUp = 'To follow…';

  // F. Fetch tournament configs to display status/stage
  const [{ data: elConfig }, { data: clConfig }, { data: obConfig }, { count: clEntrantCount }, { data: elStatus }] = await Promise.all([
    supabase.from('eliminator_config').select('*').eq('season_id', SEASON_ID).single(),
    supabase.from('champions_league_config').select('*').eq('season_id', SEASON_ID).single(),
    supabase.from('onion_baggers_config').select('*').eq('season_id', SEASON_ID).single(),
    supabase.from('champions_league_entrants').select('manager_fpl_id', { count: 'exact', head: true }).eq('season_id', SEASON_ID),
    supabase.from('eliminator_status').select('manager_fpl_id, is_eliminated, eliminated_gw, season_managers!inner (team_name)').eq('season_id', SEASON_ID)
  ]);

  // Card summaries so each tournament widget says something even without a write-up
  const elAlive = (elStatus || []).filter((e: any) => !e.is_eliminated).length;
  const elLastCut = (elStatus || []).filter((e: any) => e.is_eliminated).sort((a: any, b: any) => (b.eliminated_gw || 0) - (a.eliminated_gw || 0))[0] || null;

  const elStart = elConfig?.start_gw || 1;
  const clS1 = clConfig?.stage_1_start_gw || 1;
  const obQual = obConfig?.qualifiers_start_gw || 1;
  const obKnock = obConfig?.knockout_start_gw || 9;

  const clEntrants = clEntrantCount || 0;
  const clP1 = clEntrants % 2 === 0 ? clEntrants : clEntrants + 1;
  const clP2 = Math.max(0, clEntrants - 1) % 2 === 0 ? Math.max(0, clEntrants - 1) : clEntrants;
  const nextLines = {
    ob: onionBaggersNextLine(gw, { qStart: obQual, kStart: obKnock }),
    cl: championsLeagueNextLine(gw, { s1Start: clS1, s2Start: clConfig?.stage_2_start_gw || 10, finalStart: clConfig?.final_start_gw || 38, s1MaxRounds: 2 * (clP1 - 1), s2MaxRounds: 3 * (clP2 - 1) }),
    el: eliminatorNextLine(gw, elStart),
  };

  // C. Fetch Manager Scores for the live GW when one is in progress, otherwise the synced GW.
  // The ingest may not have written live rows yet, so fall back to the synced week.
  const fetchScores = (gwNumber: number) => supabase
    .from('manager_gw_scores')
    .select(`manager_fpl_id, points, classic_total_points, season_managers!inner (team_name, division, managers!inner (real_name))`)
    .eq('season_id', SEASON_ID)
    .eq('gw_number', gwNumber);

  let scoresGw = gw.displayGw;
  let { data: scores, error } = await fetchScores(scoresGw);
  if (!error && gw.liveGw && (scores?.length ?? 0) === 0) {
    scoresGw = currentGw;
    ({ data: scores, error } = await fetchScores(scoresGw));
  }
  const showingLive = scoresGw === gw.liveGw;
  const projection = showingLive ? await getWeekProjection() : null;
  const dueOf = (id: number) => (projection ? dueFor(projection, scoresGw, Number(id)) : null);
  const withDue = (id: number, value: number) => value + (dueOf(id)?.due || 0);

  // While a week is live, the Eliminator card lists the three lowest live scores among the survivors
  // (projected subs included). Before kickoff everyone is level, so nobody is singled out.
  type ElStatusRow = { manager_fpl_id: number; is_eliminated: boolean };
  type LiveScoreRow = { manager_fpl_id: number; points: number; season_managers: { team_name: string } };
  const elAliveIds = new Set(((elStatus || []) as ElStatusRow[]).filter(e => !e.is_eliminated).map(e => Number(e.manager_fpl_id)));
  const elLive = showingLive && elAliveIds.size > 1
    ? ((scores || []) as unknown as LiveScoreRow[])
        .filter(row => elAliveIds.has(Number(row.manager_fpl_id)))
        .map(row => ({ id: Number(row.manager_fpl_id), name: row.season_managers.team_name, score: withDue(row.manager_fpl_id, row.points) }))
        .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
    : [];
  const elAtRisk = elLive.length > 0 && elLive[0].score !== elLive[elLive.length - 1].score ? elLive.slice(0, 3) : [];

  if (error) return <div className="p-10 text-loss-2">Error: {error.message}</div>;

  // D. NEW: Fetch H2H results and calculate League Points (3 for W, 1 for D)
  const { data: h2hData } = await supabase.from('h2h_fixtures').select('manager_fpl_id, gw_number, result').eq('season_id', SEASON_ID).lte('gw_number', currentGw);
  const buildMatchPoints = (throughGw: number) => {
    const map: Record<number, number> = {};
    h2hData?.forEach(match => {
      if (match.gw_number > throughGw) return;
      if (!map[match.manager_fpl_id]) map[match.manager_fpl_id] = 0;
      if (match.result === 'W') map[match.manager_fpl_id] += 3;
      if (match.result === 'D') map[match.manager_fpl_id] += 1;
    });
    return map;
  };
  const matchPointsMap = buildMatchPoints(currentGw);

  // E. Map H2H points to teams and rank them (see lib/standings.ts)
  const processedTeams = scores?.map(team => ({
    ...team,
    h2h_points: matchPointsMap[team.manager_fpl_id] || 0
  })).sort((a: any, b: any) => compareStanding(
    { pts: a.h2h_points, total: a.classic_total_points, week: a.points, name: a.season_managers.team_name },
    { pts: b.h2h_points, total: b.classic_total_points, week: b.points, name: b.season_managers.team_name },
  )) || [];

  const premierLeagueTeams = processedTeams.filter((s: any) => s.season_managers.division === 'Premier League');
  const championshipTeams = processedTeams.filter((s: any) => s.season_managers.division === 'Championship');
  const leagueOneTeams = processedTeams.filter((s: any) => s.season_managers.division === 'League One');
  
  // The Open ranks on total points, including any subs due while a week is live.
  const openStanding = (t: any) => ({ total: withDue(t.manager_fpl_id, t.classic_total_points), week: withDue(t.manager_fpl_id, t.points), name: t.season_managers.team_name });
  const openOrder = [...processedTeams].sort((a, b) => compareStanding(openStanding(a), openStanding(b)));
  const topTenITF = openOrder.slice(0, 10);

  // Movement: divisions compare with last week's confirmed standings; the ITF Open
  // compares live totals with the last confirmed week (or last week when nothing is live).
  const itfPreviousGw = showingLive ? currentGw : currentGw - 1;
  const { data: previousScores } = currentGw > 1 || showingLive
    ? await supabase.from('manager_gw_scores').select('manager_fpl_id, points, classic_total_points, season_managers!inner (division, team_name)').eq('season_id', SEASON_ID).eq('gw_number', currentGw - 1)
    : { data: null };
  const { data: itfPreviousScores } = itfPreviousGw === currentGw - 1
    ? { data: previousScores }
    : await supabase.from('manager_gw_scores').select('manager_fpl_id, points, classic_total_points, season_managers!inner (division, team_name)').eq('season_id', SEASON_ID).eq('gw_number', itfPreviousGw);

  const previousMatchPoints = buildMatchPoints(currentGw - 1);
  const previousDivisionOrder = (division: string) => (previousScores || [])
    .filter((s: any) => s.season_managers.division === division)
    .sort((a: any, b: any) => compareStanding(
      { pts: previousMatchPoints[a.manager_fpl_id] || 0, total: a.classic_total_points, week: a.points, name: a.season_managers.team_name },
      { pts: previousMatchPoints[b.manager_fpl_id] || 0, total: b.classic_total_points, week: b.points, name: b.season_managers.team_name },
    ))
    .map((s: any) => s.manager_fpl_id);
  const divisionMovement = (teams: any[], division: string) =>
    currentGw > 1 ? positionDeltas(teams.map(t => t.manager_fpl_id), previousDivisionOrder(division)) : {};

  // Manager of the Month: latest awarded month, or the month in progress
  const [events, { data: allScoreRows }] = await Promise.all([
    getFplEvents(),
    supabase.from('manager_gw_scores').select('manager_fpl_id, gw_number, points').eq('season_id', SEASON_ID).lte('gw_number', currentGw),
  ]);
  const motmManagers = (scores || []).map((s: any) => ({ id: Number(s.manager_fpl_id), teamName: s.season_managers.team_name, realName: s.season_managers.managers.real_name, division: s.season_managers.division }));
  const motmMonths = events ? buildMotm({
    events, syncedThroughGw: currentGw, managers: motmManagers,
    scores: (allScoreRows || []).map((r: any) => ({ manager_fpl_id: Number(r.manager_fpl_id), gw_number: r.gw_number, points: r.points })),
    divisions: DIVISIONS.map(d => d.name),
  }) : [];
  const motmLatest = motmMonths[0] || null;

  const previousOpenOrder = [...(itfPreviousScores || [])]
    .sort((a: any, b: any) => compareStanding(
      { total: a.classic_total_points, week: a.points, name: a.season_managers.team_name },
      { total: b.classic_total_points, week: b.points, name: b.season_managers.team_name },
    ))
    .map((s: any) => Number(s.manager_fpl_id));
  const itfMovement = itfPreviousScores
    ? positionDeltas(openOrder.map(t => Number(t.manager_fpl_id)), previousOpenOrder)
    : {};
  const itfPreviousTopTen = new Set(previousOpenOrder.slice(0, 10));
  const itfMark = (id: number) => itfPreviousTopTen.size > 0 && !itfPreviousTopTen.has(Number(id))
    ? <NewEntryMark />
    : <MovementArrow delta={itfMovement[id]} />;

  return (
    <div className="flex flex-col gap-12">
      <FeedbackBanner />
      <TeamOfTheWeekBanner gw={currentGw} />

      <section>
        <SectionHeading aside={<GameweekChip gw={gw} />}>League</SectionHeading>
        {gw.liveGw && <p className="text-sm text-dim -mt-2 mb-4">Pts and positions update once GW{gw.liveGw} is confirmed.</p>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-10 col-rules">
          <DivisionWidget name="Premier League" link="/divisions/premier-league" lead={leads['premier-league']} gw={currentGw} teams={premierLeagueTeams} placeholder={noWriteUp} movement={divisionMovement(premierLeagueTeams, 'Premier League')} />
          <DivisionWidget name="Championship" link="/divisions/championship" lead={leads['championship']} gw={currentGw} teams={championshipTeams} placeholder={noWriteUp} movement={divisionMovement(championshipTeams, 'Championship')} />
          <DivisionWidget name="League One" link="/divisions/league-one" lead={leads['league-one']} gw={currentGw} teams={leagueOneTeams} placeholder={noWriteUp} movement={divisionMovement(leagueOneTeams, 'League One')} />
        </div>
      </section>

      <section>
        <SectionHeading>Tournaments</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-3 items-start gap-4">
          <TournamentWidget
            name="Onion Baggers Cup"
            stage={currentGw < obKnock ? `Qualifiers, since GW${obQual}` : `Knockouts, since GW${obKnock}`}
            pending={currentGw < obQual}
            status={currentGw < obQual ? `Starts GW${obQual}` : currentGw < obKnock ? 'Qualifying' : 'Knockouts'}
            nextLine={nextLines.ob}
            summary={`16 places · the two highest scorers each week qualify from GW${obQual} · knockouts from GW${obKnock}`}
            link="/tournaments/onion-baggers-cup"
            lead={leads['onion-baggers-cup']}
            placeholder={noWriteUp}
          />
          <TournamentWidget
            name="Champions League"
            stage={`Stage 1, since GW${clS1}`}
            pending={currentGw < clS1}
            status={currentGw < clS1 ? `Starts GW${clS1}` : 'Live'}
            nextLine={nextLines.cl}
            summary={clEntrants > 0 ? `${clEntrants} entrants confirmed · round robin from GW${clS1}` : 'Entrants not yet selected'}
            link="/tournaments/champions-league"
            lead={leads['champions-league']}
            placeholder={noWriteUp}
          />
          {/* No write-up snippet here: the card shows who's left, then who went out last or, while a
              week is live, who's at risk. */}
          <TournamentWidget
            name="Eliminator"
            stage={`Running since GW${elStart}`}
            pending={currentGw < elStart}
            status={currentGw < elStart ? `Starts GW${elStart}` : <GameweekChip gw={gw} week={scoresGw} live={showingLive} />}
            noSnippet
            summary={elStatus && elStatus.length > 0 ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="plate bg-panel font-display text-4xl px-2.5">{elAlive}</span>
                  <span className="label">remain</span>
                </div>
                {elAtRisk.length > 0 ? (
                  <div className="mt-4">
                    <span className="inline-block text-xs font-bold uppercase tracking-[0.08em] bg-loss text-white px-1.5 py-0.5 rounded-sm animate-pulse">At risk · GW{scoresGw}</span>
                    <ol className="mt-2 space-y-1">
                      {elAtRisk.map(m => (
                        <li key={m.id} className="flex items-center gap-3 min-w-0">
                          <span className="w-8 shrink-0 text-right font-display text-xl leading-none text-loss-2 tabular">{m.score}</span>
                          <TeamName name={m.name} managerId={m.id} inline className="text-ink-2 min-w-0" />
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : elLastCut && (
                  <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-dim">
                    <span className="text-xs font-bold uppercase tracking-[0.08em] bg-loss text-white px-1.5 py-0.5 rounded-sm">Last eliminated</span>
                    <span>GW{elLastCut.eliminated_gw}:</span>
                    <TeamName name={(elLastCut as any).season_managers.team_name} managerId={(elLastCut as any).manager_fpl_id} inline className="font-semibold text-brand-2 min-w-0" />
                  </div>
                )}
              </>
            ) : 'Entrants are registered on the first sync after the start week'}
            link="/tournaments/eliminator"
          />
        </div>
      </section>

      {motmLatest && (
        <section>
          <SectionHeading aside={(
            <>
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-[0.08em] text-dim">{motmLatest.label} · {motmLatest.complete ? 'awarded' : 'in progress'}</span>
              <Link href="/motm" className="font-semibold text-brand-2 hover:underline whitespace-nowrap">All months &rarr;</Link>
            </>
          )}>
            Manager of the Month
          </SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-y-8 col-rules">
            {motmLatest.divisions.map(div => (
              <div key={div.division} className="col-head">
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <h3 className="font-display text-lg leading-none tracking-[0.03em] text-ink-2">{div.division}</h3>
                  {div.leaders.length > 1 && <span className="label">Shared</span>}
                </div>
                {div.leaders.length === 0 ? (
                  <div className="text-sm text-faint italic">No scores yet</div>
                ) : (
                  <div className="divide-y divide-line border-t border-line">
                    {div.leaders.map(leader => (
                      <div key={leader.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <TeamName name={leader.teamName} managerId={leader.id} inline className="font-semibold text-ink min-w-0" />
                          <div className="text-sm text-dim">{leader.realName}</div>
                        </div>
                        <span className="plate shrink-0 font-display text-3xl min-w-[3.75rem]">{leader.points}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-12">
        <SectionHeading aside={(
          <>
            <GameweekChip gw={gw} week={scoresGw} live={showingLive} />
            <Link href="/itf-open" className="font-semibold text-brand-2 hover:underline whitespace-nowrap">View full table &rarr;</Link>
          </>
        )}>
          The Open <span className="text-dim">· Top 10</span>
        </SectionHeading>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="py-2 pr-1 w-8"><span className="sr-only">Position</span></th>
              <th className="w-11 pr-2"><span className="sr-only">Movement</span></th>
              <th className="label font-semibold py-2 pr-3">Manager</th>
              <th className="label font-semibold py-2 px-3 text-right w-24">GW{scoresGw}</th>
              <th className="label font-semibold py-2 px-3 text-right w-28 key-col">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {topTenITF.map((manager: any, index: number) => (
              <tr key={manager.manager_fpl_id} className="hover:bg-surface">
                <td className="py-2.5 pr-1 font-display text-xl leading-none text-faint">{index + 1}</td>
                <td className="py-2.5 pr-2 whitespace-nowrap">{itfMark(manager.manager_fpl_id)}</td>
                {/* The Open is the race for manager of the season, so the manager leads and the team follows. */}
                <td className="py-2.5 pr-3 min-w-0">
                  <Link href={`/manager/${manager.manager_fpl_id}`} className="font-semibold text-ink hover:underline decoration-brand-2/60 underline-offset-2">{manager.season_managers.managers.real_name}</Link>
                  <div className="text-dim">{getTeamNameDisplayText(manager.season_managers.team_name)} · {manager.season_managers.division}</div>
                </td>
                <td className={`py-2.5 px-3 text-right font-semibold whitespace-nowrap ${showingLive ? 'text-live-2' : 'text-ink-2'}`}>{withDue(manager.manager_fpl_id, manager.points)}</td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap key-col"><span className="font-display text-2xl leading-none text-ink">{withDue(manager.manager_fpl_id, manager.classic_total_points)}</span> <DueMark due={dueOf(manager.manager_fpl_id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// =========================================
// 3. HELPER COMPONENTS
// =========================================

type Lead = { headline: string | null; teaser: string };

// One division's column, led like a back-page story: the write-up's own headline in the
// display face, a line saying which league it is, the teaser, then the table. With no
// write-up the division's name takes the headline's place.
function DivisionWidget({ name, link, lead, gw, teams, movement, placeholder }: { name: string, link: string, lead?: Lead, gw: number, teams: any[], movement: Record<number, number | null>, placeholder?: string }) {
  const headline = lead?.headline;
  return (
    <div className="flex flex-col col-head">
      <Link href={link} className="group">
        <h3 className="font-display text-[1.9rem] leading-display tracking-[0.01em] text-ink group-hover:text-brand-2 transition-colors text-balance">{headline || name}</h3>
      </Link>
      {headline ? (
        <p className="mt-2 mb-2 text-sm text-dim">
          <Link href={link} className="font-semibold text-brand-2 hover:underline">{name}</Link>
          {` · GW${gw}`}
        </p>
      ) : <div className="mb-2" />}
      <Snippet text={lead?.teaser} link={link} placeholder={placeholder} />
      <table className="w-full text-sm text-left mt-auto">
        <thead>
          <tr className="border-b border-line">
            <th className="py-1.5 pr-1 w-7"><span className="sr-only">Position</span></th>
            <th className="w-10 pr-2"><span className="sr-only">Movement</span></th>
            <th className="label font-semibold py-1.5">{name}</th>
            <th className="label font-semibold py-1.5 px-2 text-right key-col">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {teams.map((team, index) => (
            <tr key={team.manager_fpl_id} className="h-10 hover:bg-surface">
              <td className="py-1.5 pr-1 text-faint font-semibold">{index + 1}</td>
              <td className="py-1.5 pr-2 whitespace-nowrap"><MovementArrow delta={movement[team.manager_fpl_id]} /></td>
              <td className="py-1.5 pr-2 min-w-0 max-w-[1px] w-full">
                <TeamName name={team.season_managers.team_name} managerId={team.manager_fpl_id} inline className="text-ink min-w-0" />
              </td>
              <td className="py-1.5 px-2 text-right font-bold text-ink key-col">{team.h2h_points}</td>
            </tr>
          ))}
          {teams.length === 0 && (
            <tr><td colSpan={4} className="py-4 text-center text-faint italic">No teams registered.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// One tournament's column, led the same way. A tournament that hasn't started says when it
// does and what it is, rather than greying out a placeholder.
function TournamentWidget({ name, stage, status, pending, link, lead, nextLine, summary, placeholder, noSnippet = false }: { name: string, stage: string, status: React.ReactNode, pending: boolean, link: string, lead?: Lead, nextLine?: string, summary?: React.ReactNode, placeholder?: string, noSnippet?: boolean }) {
  const headline = !pending && !noSnippet ? lead?.headline : null;
  return (
    <div className="panel flex flex-col">
      <Link href={link} className="group">
        <h3 className={`font-display text-[1.9rem] leading-display tracking-[0.01em] transition-colors text-balance ${pending ? 'text-ink-2' : 'text-ink'} group-hover:text-brand-2`}>{headline || name}</h3>
      </Link>
      <p className="mt-2 mb-3 text-sm text-dim">
        {headline && <><Link href={link} className="font-semibold text-brand-2 hover:underline">{name}</Link> · </>}
        <span className={pending ? '' : 'font-semibold text-ink-2'}>{status}</span>
        {!pending && !noSnippet && <><br />{stage}{nextLine ? ` · ${nextLine}` : ''}</>}
      </p>
      {summary && <div className={`text-sm leading-snug mb-3 ${pending ? 'text-dim' : 'text-ink-2'}`}>{summary}</div>}
      {!pending && !noSnippet && <Snippet text={lead?.teaser} link={link} placeholder={placeholder} max={140} />}
      {!pending && noSnippet && <Link href={link} className="self-end mt-2 py-1 text-sm text-brand-2 font-semibold hover:underline whitespace-nowrap">Read more &rarr;</Link>}
    </div>
  );
}

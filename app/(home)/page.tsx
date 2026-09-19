import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import Link from 'next/link';
import { Suspense } from 'react';
import { DashboardSkeleton } from '@/components/Skeletons';
import Snippet from '@/components/snippet';
import GameweekTimeline from '@/components/GameweekTimeline';
import { GameweekChip } from '@/components/GameweekBadge';
import MovementArrow from '@/components/MovementArrow';
import { positionDeltas } from '@/lib/movement';
import { GameweekTimelineSkeleton } from '@/components/Skeletons';
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
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl font-extrabold text-ink tracking-tight">ITF Hub</h1>
        <p className="text-dim">Live updates and standings for the 2026-27 Season.</p>
      </header>

      <div className="mb-8">
        <Suspense fallback={<GameweekTimelineSkeleton />}>
          <GameweekTimeline />
        </Suspense>
      </div>

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
  const { data: contentData } = await supabase.from('page_content').select('id, content');
  const snippets: Record<string, string> = contentData?.reduce((acc: any, item: any) => { acc[item.id] = item.content; return acc; }, {}) || {};

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
    .select(`manager_fpl_id, classic_total_points, season_managers!inner (team_name, division, managers!inner (real_name))`)
    .eq('season_id', SEASON_ID)
    .eq('gw_number', gwNumber);

  let scoresGw = gw.displayGw;
  let { data: scores, error } = await fetchScores(scoresGw);
  if (!error && gw.liveGw && (scores?.length ?? 0) === 0) {
    scoresGw = currentGw;
    ({ data: scores, error } = await fetchScores(scoresGw));
  }
  const showingLive = scoresGw === gw.liveGw;

  if (error) return <div className="p-10 text-red-500">Error: {error.message}</div>;

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

  // E. Map H2H points to teams and sort (H2H points first, then Total FPL points)
  const processedTeams = scores?.map(team => ({
    ...team,
    h2h_points: matchPointsMap[team.manager_fpl_id] || 0
  })).sort((a, b) => {
    if (b.h2h_points !== a.h2h_points) return b.h2h_points - a.h2h_points;
    return b.classic_total_points - a.classic_total_points;
  }) || [];

  const premierLeagueTeams = processedTeams.filter((s: any) => s.season_managers.division === 'Premier League');
  const championshipTeams = processedTeams.filter((s: any) => s.season_managers.division === 'Championship');
  const leagueOneTeams = processedTeams.filter((s: any) => s.season_managers.division === 'League One');
  
  // ITF Open still uses raw total points
  const topTenITF = [...processedTeams].sort((a, b) => b.classic_total_points - a.classic_total_points).slice(0, 10);

  // Movement: divisions compare with last week's confirmed standings; the ITF Open
  // compares live totals with the last confirmed week (or last week when nothing is live).
  const itfPreviousGw = showingLive ? currentGw : currentGw - 1;
  const { data: previousScores } = currentGw > 1 || showingLive
    ? await supabase.from('manager_gw_scores').select('manager_fpl_id, classic_total_points, season_managers!inner (division)').eq('season_id', SEASON_ID).eq('gw_number', currentGw - 1)
    : { data: null };
  const { data: itfPreviousScores } = itfPreviousGw === currentGw - 1
    ? { data: previousScores }
    : await supabase.from('manager_gw_scores').select('manager_fpl_id, classic_total_points, season_managers!inner (division)').eq('season_id', SEASON_ID).eq('gw_number', itfPreviousGw);

  const previousMatchPoints = buildMatchPoints(currentGw - 1);
  const previousDivisionOrder = (division: string) => (previousScores || [])
    .filter((s: any) => s.season_managers.division === division)
    .sort((a: any, b: any) => {
      const ha = previousMatchPoints[a.manager_fpl_id] || 0, hb = previousMatchPoints[b.manager_fpl_id] || 0;
      if (hb !== ha) return hb - ha;
      return b.classic_total_points - a.classic_total_points;
    })
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

  const itfMovement = itfPreviousScores
    ? positionDeltas(
        [...processedTeams].sort((a, b) => b.classic_total_points - a.classic_total_points).map(t => t.manager_fpl_id),
        [...itfPreviousScores].sort((a: any, b: any) => b.classic_total_points - a.classic_total_points).map((s: any) => s.manager_fpl_id)
      )
    : {};

  return (
    <>
      <div className="flex flex-col gap-10">
        {/* ROW 1: THE DIVISIONS */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1 border-b pb-2">
            <h2 className="text-xl font-bold">League</h2>
            <GameweekChip gw={gw} />
          </div>
          <p className="text-xs text-dim mb-4">{gw.liveGw ? `Pts and positions update once GW${gw.liveGw} is confirmed.` : `Standings after GW${currentGw}.`}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DivisionWidget name="Premier League" link="/divisions/premier-league" snippet={snippets['premier-league']} fullSnippet={snippets['premier-league']} teams={premierLeagueTeams} movement={divisionMovement(premierLeagueTeams, 'Premier League')} />
            <DivisionWidget name="Championship" link="/divisions/championship" snippet={snippets['championship']} fullSnippet={snippets['championship']} teams={championshipTeams} movement={divisionMovement(championshipTeams, 'Championship')} />
            <DivisionWidget name="League One" link="/divisions/league-one" snippet={snippets['league-one']} fullSnippet={snippets['league-one']} teams={leagueOneTeams} movement={divisionMovement(leagueOneTeams, 'League One')} />
          </div>
        </section>

        {/* ROW 2: TOURNAMENTS */}
        <section>
          <h2 className="text-xl font-bold mb-4 border-b pb-2">Tournaments</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <TournamentWidget 
              name="Onion Baggers Cup" 
              stage={`Qualifiers GW${obQual}`} 
              status={currentGw < obQual ? 'Pending' : currentGw < obKnock ? 'Qualifying' : 'Knockouts'} 
              nextLine={nextLines.ob}
              summary={`16 places · the two highest scorers each week qualify from GW${obQual} · knockouts from GW${obKnock}`}
              link="/tournaments/onion-baggers-cup" 
              snippet={snippets['onion-baggers-cup']} 
              fullSnippet={snippets['onion-baggers-cup']}
              startGw={`GW${obQual}`} 
            />
            <TournamentWidget 
              name="Champions League" 
              stage={`Stage 1 GW${clS1}`} 
              status={currentGw < clS1 ? 'Pending' : 'Active'} 
              nextLine={nextLines.cl}
              summary={clEntrants > 0 ? `${clEntrants} entrants confirmed · round robin from GW${clS1}` : 'Entrants not yet selected'}
              link="/tournaments/champions-league" 
              snippet={snippets['champions-league']} 
              fullSnippet={snippets['champions-league']}
              startGw={`GW${clS1}`} 
            />
            <TournamentWidget 
              name="Eliminator" 
              stage={`Gameweek ${elStart}`} 
              status={currentGw < elStart ? 'Pending' : 'Active'} 
              nextLine={nextLines.el}
              summary={elStatus && elStatus.length > 0 ? (
                <>
                  <span className="text-2xl font-black text-ink">{elAlive}</span> <span className="text-dim">alive</span>
                  {elLastCut && (
                    <span className="block mt-1 text-xs text-dim">
                      Last cut · GW{elLastCut.eliminated_gw}: <TeamName name={(elLastCut as any).season_managers.team_name} managerId={(elLastCut as any).manager_fpl_id} inline className="text-red-400 min-w-0" />
                    </span>
                  )}
                </>
              ) : 'Entrants are registered on the first sync after the start week'}
              link="/tournaments/eliminator" 
              snippet={snippets['eliminator']} 
              fullSnippet={snippets['eliminator']}
              startGw={`GW${elStart}`} 
            />
          </div>
        </section>

        {/* ROW 3: MANAGER OF THE MONTH */}
        {motmLatest && (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b pb-2">
              <h2 className="text-xl font-bold">Manager of the Month</h2>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-dim">{motmLatest.label} · {motmLatest.complete ? 'awarded' : 'in progress'}</span>
                <Link href="/motm" className="text-brand-2 hover:underline whitespace-nowrap">All months &rarr;</Link>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {motmLatest.divisions.map(div => (
                <div key={div.division} className={`bg-surface border rounded-xl shadow-sm p-4 ${motmLatest.complete ? '' : 'border-amber-500/30'}`}>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-faint mb-2">{div.division}</div>
                  {div.leaders.length === 0 ? (
                    <div className="text-sm text-faint italic">No scores yet</div>
                  ) : div.leaders.map(leader => (
                    <div key={leader.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span aria-hidden="true">{motmLatest.complete ? '🏆' : '⏳'}</span>
                          <TeamName name={leader.teamName} managerId={leader.id} inline className="text-ink min-w-0" />
                        </div>
                        <div className="text-xs text-dim pl-7">{leader.realName}</div>
                      </div>
                      <span className="shrink-0 text-lg font-black text-ink">{leader.points}</span>
                    </div>
                  ))}
                  {div.leaders.length > 1 && <div className="text-[10px] uppercase tracking-wider font-bold text-amber-300 mt-1">Shared</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ROW 4: LIVE ITF OPEN */}
        <section className="mb-12">
          <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-2 mb-4">
            <h2 className="text-xl font-bold">ITF Open - Top 10</h2>
            <div className="flex flex-wrap items-center gap-3">
              <GameweekChip gw={gw} week={scoresGw} live={showingLive} />
              <Link href="/itf-open" className="text-sm text-brand-2 hover:underline whitespace-nowrap">View Full Table &rarr;</Link>
            </div>
          </div>
          <div className="bg-surface shadow rounded-lg border overflow-hidden">
            {/* Mobile list */}
            <div className="md:hidden divide-y divide-line">
              {topTenITF.map((manager: any, index: number) => (
                <div key={manager.manager_fpl_id} className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 shrink-0 text-sm font-black text-faint">{index + 1}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <TeamName name={manager.season_managers.team_name} managerId={manager.manager_fpl_id} inline className="font-semibold min-w-0" />
                        <MovementArrow delta={itfMovement[manager.manager_fpl_id]} />
                      </div>
                      <div className="text-xs text-faint">{manager.season_managers.managers.real_name} · {manager.season_managers.division}</div>
                    </div>
                  </div>
                  <span className="shrink-0 font-bold text-brand-2">{manager.classic_total_points}</span>
                </div>
              ))}
            </div>
            <table className="hidden md:table w-full text-left text-sm">
              <thead className="bg-surface-2 border-b">
                <tr>
                  <th className="p-3">Rank</th>
                  <th className="p-3">Team & Manager</th>
                  <th className="p-3">Division</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {topTenITF.map((manager: any, index: number) => (
                  <tr key={manager.manager_fpl_id} className="border-b last:border-0 hover:bg-surface-2">
                    <td className="p-3 font-bold text-dim">{index + 1}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <TeamName name={manager.season_managers.team_name} managerId={manager.manager_fpl_id} inline className="font-semibold" />
                        <MovementArrow delta={itfMovement[manager.manager_fpl_id]} />
                      </div>
                      <div className="text-xs text-faint">{manager.season_managers.managers.real_name}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-surface-2 text-ink-2 text-xs rounded border">
                        {manager.season_managers.division}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold text-brand-2">{manager.classic_total_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

    </>
  );
}

// =========================================
// 3. HELPER COMPONENTS
// =========================================

function DivisionWidget({ name, link, snippet, fullSnippet, teams, movement }: { name: string, link: string, snippet: string, fullSnippet?: string, teams: any[], movement: Record<number, number | null> }) {
  return (
    <div className="bg-surface border rounded-xl shadow-sm flex flex-col h-full hover:shadow-md transition">
      <Link href={link} className="p-4 border-b bg-surface-2 rounded-t-xl hover:bg-surface-2 transition group cursor-pointer">
        <h3 className="font-bold text-lg group-hover:text-brand-2 transition-colors">{name}&nbsp;&rarr;</h3>
      </Link>
      <div className="p-4 flex-grow text-sm text-dim flex flex-col justify-between">
        <Snippet preview={snippet?.slice(0, 180)} full={fullSnippet} link={link} />
        <div className="border rounded overflow-hidden bg-surface-2">
          <table className="w-full text-xs text-left border-collapse">
            <tbody>
              {teams.map((team, index) => (
                <tr key={team.manager_fpl_id} className="border-b last:border-0 bg-surface hover:bg-surface-2">
                  <td className="p-1.5 pl-2 font-bold text-faint w-6">{index + 1}</td>
                  <td className="p-1.5 font-medium min-w-0 max-w-[1px] w-full">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <TeamName name={team.season_managers.team_name} managerId={team.manager_fpl_id} inline className="min-w-0" />
                      <MovementArrow delta={movement[team.manager_fpl_id]} />
                    </span>
                  </td>
                  <td className="p-1.5 text-right font-bold pr-2 text-ink">{team.h2h_points} Pts</td>
                </tr>
              ))}
              {teams.length === 0 && (
                <tr><td className="p-4 text-center text-faint italic">No teams registered.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TournamentWidget({ name, stage, status, link, snippet, fullSnippet, startGw, nextLine, summary }: { name: string, stage: string, status: string, link: string, snippet: string, fullSnippet?: string, startGw?: string, nextLine?: string, summary?: React.ReactNode }) {
  const isPending = status === 'Pending';

  return (
    <div className={`bg-surface border rounded-xl flex flex-col h-full relative overflow-hidden ${isPending ? 'border-line bg-surface-2 shadow-none' : 'shadow-sm hover:shadow-md transition'}`}>
      
      {/* 1. THE STATUS BADGE */}
      <div className={`absolute top-0 right-0 text-xs font-bold px-2 py-1 rounded-bl-lg z-10 shadow-sm ${isPending ? 'bg-surface-3 text-dim' : 'bg-brand-2/15 text-brand-2'}`}>
        {status}
      </div>

      {/* 2. THE HEADER (Always completely visible) */}
      <Link href={link} className={`p-4 border-b rounded-t-xl transition ${isPending ? 'bg-surface-2/50' : 'bg-surface-2 hover:bg-surface-2 group'}`}>
        <h3 className={`font-bold text-lg transition-colors pr-16 ${isPending ? 'text-dim' : 'group-hover:text-brand-2'}`}>
          {name}{!isPending && <>&nbsp;&rarr;</>}
        </h3>
        <p className="text-xs font-semibold text-dim uppercase tracking-wider mt-1">{stage}</p>
        {nextLine && <p className="text-xs text-dim mt-1">{nextLine}</p>}
      </Link>

      {/* 3. THE BODY (With the overlay applied ONLY here if pending). Minimum height keeps the
          pending overlay clear of the header border when there is no write-up to show. */}
      <div className="relative flex-grow flex flex-col min-h-[6.5rem]">
        
        {/* THE NEW OVERLAY DESIGN */}
        {isPending && (
          <div className="absolute inset-0 bg-surface/80 backdrop-blur-[1.5px] z-20 flex flex-col items-center justify-center text-center">
            {/* Simple text label, no button background */}
            <span className="text-dim font-bold tracking-widest uppercase text-sm mb-1 flex items-center gap-2">
              <svg className="w-4 h-4 text-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              Pending Start
            </span>
            <span className="text-dim font-medium">
              Starts in {startGw}
            </span>
          </div>
        )}

        {/* THE WIDGET CONTENT (Greyed out if pending) */}
        <div className={`p-4 flex-grow text-sm text-dim ${isPending ? 'opacity-20 grayscale pointer-events-none' : ''}`}>
          {summary && <div className="mb-3 text-sm leading-snug">{summary}</div>}
          <Snippet preview={snippet?.slice(0, 160)} full={fullSnippet} link={link} />
        </div>
      </div>
      
      {/* Invisible link overlay so users can still click the whole pending card */}
      {isPending && (
        <Link href={link} className="absolute inset-0 z-30" aria-label={`View ${name}`} />
      )}
    </div>
  );
}

import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import Link from 'next/link';
import { Suspense } from 'react';
import { DashboardSkeleton } from '@/components/Skeletons';
import Snippet from '@/components/snippet';

// =========================================
// 1. THE FAST-LOADING PAGE SHELL
// =========================================
export default function Dashboard() {
  return (
    <div className="relative min-h-screen pb-20">
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">ITF Hub</h1>
        <p className="text-slate-500">Live updates and standings for the 2026-27 Season.</p>
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

  // A. Get the most recent Gameweek
  // A. Get the most recent finished Gameweek
  const { data: latestGw } = await supabase
    .from('gameweeks')
    .select('gw_number')
    .eq('season_id', SEASON_ID)
    .eq('is_finished', true) // <-- ADD THIS LINE
    .order('gw_number', { ascending: false })
    .limit(1)
    .single();
  const currentGw = latestGw ? latestGw.gw_number : 1;

  // B. Fetch CMS content
  const { data: contentData } = await supabase.from('page_content').select('id, content');
  const snippets: Record<string, string> = contentData?.reduce((acc: any, item: any) => { acc[item.id] = item.content; return acc; }, {}) || {};

  // F. Fetch tournament configs to display status/stage
  const [{ data: elConfig }, { data: clConfig }, { data: obConfig }] = await Promise.all([
    supabase.from('eliminator_config').select('*').eq('season_id', SEASON_ID),
    supabase.from('champions_league_config').select('*').eq('season_id', SEASON_ID),
    supabase.from('onion_baggers_config').select('*').eq('season_id', SEASON_ID)
  ]);

  const elStart = elConfig?.[0]?.start_gw || elConfig?.start_gw || 1;
  const clS1 = clConfig?.[0]?.stage_1_start_gw || clConfig?.stage_1_start_gw || 1;
  const obQual = obConfig?.[0]?.qualifiers_start_gw || obConfig?.qualifiers_start_gw || 1;
  const obKnock = obConfig?.[0]?.knockout_start_gw || obConfig?.knockout_start_gw || 9;

  // C. Fetch Manager Scores for the current GW
  const { data: scores, error } = await supabase
    .from('manager_gw_scores')
    .select(`manager_fpl_id, classic_total_points, season_managers!inner (team_name, division, managers!inner (real_name))`)
    .eq('season_id', SEASON_ID)
    .eq('gw_number', currentGw);

  if (error) return <div className="p-10 text-red-500">Error: {error.message}</div>;

  // D. NEW: Fetch H2H results and calculate League Points (3 for W, 1 for D)
  const { data: h2hData } = await supabase.from('h2h_fixtures').select('manager_fpl_id, result').eq('season_id', SEASON_ID);
  const matchPointsMap: Record<number, number> = {};
  h2hData?.forEach(match => {
    if (!matchPointsMap[match.manager_fpl_id]) matchPointsMap[match.manager_fpl_id] = 0;
    if (match.result === 'W') matchPointsMap[match.manager_fpl_id] += 3;
    if (match.result === 'D') matchPointsMap[match.manager_fpl_id] += 1;
  });

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

  return (
    <>
      <div className="flex flex-col gap-10">
        {/* ROW 1: THE DIVISIONS */}
        <section>
          <div className="flex items-center justify-between mb-4 border-b pb-2">
            <h2 className="text-xl font-bold">Official Divisions</h2>
            <span className="text-lg font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded">GW{currentGw}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DivisionWidget name="Premier League" link="/divisions/premier-league" snippet={snippets['premier-league']} fullSnippet={snippets['premier-league']} teams={premierLeagueTeams} />
            <DivisionWidget name="Championship" link="/divisions/championship" snippet={snippets['championship']} fullSnippet={snippets['championship']} teams={championshipTeams} />
            <DivisionWidget name="League One" link="/divisions/league-one" snippet={snippets['league-one']} fullSnippet={snippets['league-one']} teams={leagueOneTeams} />
          </div>
        </section>

        {/* ROW 2: TOURNAMENTS */}
        <section>
          <h2 className="text-xl font-bold mb-4 border-b pb-2">Custom Tournaments</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <TournamentWidget 
              name="Onion Baggers Cup" 
              stage={`Qualifiers GW${obQual}`} 
              status={currentGw < obQual ? 'Pending' : currentGw < obKnock ? 'Qualifying' : 'Knockouts'} 
              link="/tournaments/onion-baggers-cup" 
              snippet={snippets['onion-baggers-cup']} 
              fullSnippet={snippets['onion-baggers-cup']}
              startGw={`GW${obQual}`} 
            />
            <TournamentWidget 
              name="Champions League" 
              stage={`Stage 1 GW${clS1}`} 
              status={currentGw < clS1 ? 'Pending' : 'Active'} 
              link="/tournaments/champions-league" 
              snippet={snippets['champions-league']} 
              fullSnippet={snippets['champions-league']}
              startGw={`GW${clS1}`} 
            />
            <TournamentWidget 
              name="Eliminator" 
              stage={`Gameweek ${elStart}`} 
              status={currentGw < elStart ? 'Pending' : 'Active'} 
              link="/tournaments/eliminator" 
              snippet={snippets['eliminator']} 
              fullSnippet={snippets['eliminator']}
              startGw={`GW${elStart}`} 
            />
          </div>
        </section>

        {/* ROW 3: LIVE ITF OPEN */}
        <section className="mb-12">
          <div className="flex justify-between items-end border-b pb-2 mb-4">
            <h2 className="text-xl font-bold">ITF Open - Top 10</h2>
            <Link href="/itf-open" className="text-sm text-blue-600 hover:underline">View Full Table &rarr;</Link>
          </div>
          <div className="bg-white shadow rounded-lg border overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-3">Rank</th>
                  <th className="p-3">Team & Manager</th>
                  <th className="p-3">Division</th>
                  <th className="p-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {topTenITF.map((manager: any, index: number) => (
                  <tr key={manager.manager_fpl_id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-500">{index + 1}</td>
                    <td className="p-3">
                      <TeamName name={manager.season_managers.team_name} inline className="font-semibold" />
                      <div className="text-xs text-slate-400">{manager.season_managers.managers.real_name}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded border">
                        {manager.season_managers.division}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold text-blue-600">{manager.classic_total_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* FOOTER: TICKER */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-900 text-white shadow-inner overflow-hidden border-t-4 border-blue-500 z-40">
        <div className="marquee-track py-3 text-sm font-semibold" role="presentation">
          <div className="marquee-group" role="presentation">
            <TickerContent scores={scores || []} />
          </div>
          <div className="marquee-group" aria-hidden="true">
            <TickerContent scores={scores || []} />
          </div>
        </div>
      </div>
    </>
  );
}

// =========================================
// 3. HELPER COMPONENTS
// =========================================

function DivisionWidget({ name, link, snippet, fullSnippet, teams }: { name: string, link: string, snippet: string, fullSnippet?: string, teams: any[] }) {
  return (
    <div className="bg-white border rounded-xl shadow-sm flex flex-col h-full hover:shadow-md transition">
      <Link href={link} className="p-4 border-b bg-slate-50 rounded-t-xl hover:bg-slate-100 transition group cursor-pointer">
        <h3 className="font-bold text-lg group-hover:text-blue-600 transition-colors">{name} &rarr;</h3>
      </Link>
      <div className="p-4 flex-grow text-sm text-slate-600 flex flex-col justify-between">
        <Snippet preview={snippet?.slice(0, 180)} full={fullSnippet} link={link} />
        <div className="border rounded overflow-hidden bg-slate-50 max-h-48 overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <tbody>
              {teams.map((team, index) => (
                <tr key={team.manager_fpl_id} className="border-b last:border-0 bg-white hover:bg-slate-50">
                  <td className="p-1.5 pl-2 font-bold text-slate-400 w-6">{index + 1}</td>
                  <td className="p-1.5 font-medium max-w-[140px]">
                    <TeamName name={team.season_managers.team_name} inline className="truncate" />
                  </td>
                  <td className="p-1.5 text-right font-bold pr-2 text-slate-800">{team.h2h_points} Pts</td>
                </tr>
              ))}
              {teams.length === 0 && (
                <tr><td className="p-4 text-center text-slate-400 italic">No teams registered.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TournamentWidget({ name, stage, status, link, snippet, fullSnippet, startGw }: { name: string, stage: string, status: string, link: string, snippet: string, fullSnippet?: string, startGw?: string }) {
  const isPending = status === 'Pending';

  return (
    <div className={`bg-white border rounded-xl flex flex-col h-full relative overflow-hidden ${isPending ? 'border-slate-200 bg-slate-50 shadow-none' : 'shadow-sm hover:shadow-md transition'}`}>
      
      {/* 1. THE STATUS BADGE */}
      <div className={`absolute top-0 right-0 text-xs font-bold px-2 py-1 rounded-bl-lg z-10 shadow-sm ${isPending ? 'bg-slate-200 text-slate-500' : 'bg-blue-100 text-blue-800'}`}>
        {status}
      </div>

      {/* 2. THE HEADER (Always completely visible) */}
      <Link href={link} className={`p-4 border-b rounded-t-xl transition ${isPending ? 'bg-slate-50/50' : 'bg-slate-50 hover:bg-slate-100 group'}`}>
        <h3 className={`font-bold text-lg transition-colors ${isPending ? 'text-slate-600' : 'group-hover:text-blue-600'}`}>
          {name} {!isPending && <span>&rarr;</span>}
        </h3>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">{stage}</p>
      </Link>

      {/* 3. THE BODY (With the overlay applied ONLY here if pending) */}
      <div className="relative flex-grow flex flex-col">
        
        {/* THE NEW OVERLAY DESIGN */}
        {isPending && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-[1.5px] z-20 flex flex-col items-center justify-center text-center">
            {/* Simple text label, no button background */}
            <span className="text-slate-500 font-bold tracking-widest uppercase text-sm mb-1 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              Pending Start
            </span>
            <span className="text-slate-600 font-medium">
              Starts in {startGw}
            </span>
          </div>
        )}

        {/* THE WIDGET CONTENT (Greyed out if pending) */}
        <div className={`p-4 flex-grow text-sm text-slate-600 flex flex-col justify-between ${isPending ? 'opacity-20 grayscale pointer-events-none' : ''}`}>
          <Snippet preview={snippet?.slice(0, 160)} full={fullSnippet} link={link} />
          <div className="block text-center w-full bg-slate-900 text-white rounded py-2 font-medium transition text-xs mt-4">
            View Bracket
          </div>
        </div>
      </div>
      
      {/* Invisible link overlay so users can still click the whole pending card */}
      {isPending && (
        <Link href={link} className="absolute inset-0 z-30" aria-label={`View ${name}`} />
      )}
    </div>
  );
}

function TickerContent({ scores }: { scores: any[] }) {
  const filterTopThree = (div: string) => scores.filter((s: any) => s.season_managers.division === div).slice(0, 3);
  const formatPodium = (list: any[]) => list.map((s, i) => `${i + 1}. ${s.season_managers.managers.real_name} (${s.classic_total_points})`).join(' | ');

  return (
    <>
      <span className="text-blue-400 font-bold">LIVE</span>
      <span>•</span>
      <span>PREMIER LEAGUE: {filterTopThree('Premier League').length ? formatPodium(filterTopThree('Premier League')) : 'Awaiting Data'}</span>
      <span>•</span>
      <span>CHAMPIONSHIP: {filterTopThree('Championship').length ? formatPodium(filterTopThree('Championship')) : 'Awaiting Data'}</span>
      <span>•</span>
      <span>LEAGUE ONE: {filterTopThree('League One').length ? formatPodium(filterTopThree('League One')) : 'Awaiting Data'}</span>
      <span>•</span>
    </>
  );
}
import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import { Suspense } from 'react';

export default function ChampionsLeaguePage() {
  return (
    <div className="max-w-7xl mx-auto py-8 font-sans">
      <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500 animate-pulse">Loading Champions League...</div>}>
        <ChampionsLeagueContent />
      </Suspense>
    </div>
  );
}

async function ChampionsLeagueContent() {
  const supabase = await createClient();
  const SEASON_ID = '2026-27';

  const { data: latestGwData } = await supabase
    .from('gameweeks')
    .select('gw_number')
    .eq('season_id', SEASON_ID)
    .eq('is_finished', true) // <-- ADD THIS LINE
    .order('gw_number', { ascending: false })
    .limit(1)
    .single();
  const currentGw = latestGwData ? latestGwData.gw_number : 1;

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

  const isPreTournament = currentGw < s1Start;
  const isStage1Active = currentGw >= s1Start && currentGw < s1Start + s1MaxRounds;
  const isWaitingForStage2 = currentGw >= s1Start + s1MaxRounds && currentGw < s2Start;
  
  const isStage2Active = currentGw >= s2Start && currentGw < s2Start + s2MaxRounds;
  const isWaitingForFinal = currentGw >= s2Start + s2MaxRounds && currentGw < finalStart;
  
  const isFinalLive = currentGw >= finalStart;

// Table Generator
  const generateTable = (stageFixtures: any[], activeManagerIds: number[]) => {
    const stats: Record<number, any> = {};
    activeManagerIds.forEach(id => { stats[id] = { ...entrants[id], played: 0, won: 0, drawn: 0, lost: 0, points: 0, totalScore: 0 }; });

    stageFixtures.forEach(fix => {
      // PREVENT FUTURE MATCHES FROM AFFECTING THE LIVE TABLE
      if (fix.manager_1_score === null) return;

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

  return (
    <>
      <header className="mb-10">
        <div className="flex items-end justify-between mb-2">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Champions League</h1>
          <span className="text-sm font-bold text-slate-500 bg-slate-200 px-3 py-1 rounded">Current GW: {currentGw}</span>
        </div>
        <div className="flex gap-4 mb-4 text-sm font-medium text-slate-500">
          <span className={`px-3 py-1 rounded border ${isStage1Active || isWaitingForStage2 ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-slate-50'}`}>Stage 1: GW{s1Start}</span>
          <span className={`px-3 py-1 rounded border ${isStage2Active || isWaitingForFinal ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-slate-50'}`}>Stage 2: GW{s2Start}</span>
          <span className={`px-3 py-1 rounded border ${isFinalLive ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-slate-50'}`}>Final: GW{finalStart}</span>
        </div>
      </header>

      {/* TWO COLUMN LAYOUT */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        
        {/* LEFT COLUMN: TABLES & STAGES */}
        <div className="xl:col-span-2 space-y-12">
          
          {isPreTournament && (
            <div className="text-center bg-white border border-slate-200 rounded-xl p-12 shadow-sm">
              <h2 className="text-3xl font-black text-slate-800 mb-2">The Elite Group is Set</h2>
              <p className="text-slate-500 mb-8">Campaign begins in <strong>{s1Start - currentGw} Gameweeks</strong>.</p>
            </div>
          )}

          {/* ==========================================
              PHASE 3: THE FINAL (PREVIEW OR LIVE)
          ========================================== */}
          {(isFinalLive && finalFix) ? (
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-2xl overflow-hidden border border-indigo-900/50 mb-12">
              <div className="p-4 text-center border-b border-indigo-800/50 bg-black/20">
                <span className="text-indigo-400 font-bold tracking-[0.2em] uppercase text-xs">The Final Showdown • Live GW {currentGw}</span>
              </div>
              <div className="p-10 flex justify-between items-center text-center">
                <div className="flex-1">
                  <TeamName name={entrants[finalFix.manager_1_id]?.teamName} className="text-3xl text-white mb-2" />
                  <div className="text-indigo-300 font-bold text-2xl">{finalFix.manager_1_score} pts</div>
                </div>
                <div className="px-8"><span className="text-4xl font-black text-slate-500">VS</span></div>
                <div className="flex-1">
                  <TeamName name={entrants[finalFix.manager_2_id]?.teamName} className="text-3xl text-white mb-2" />
                  <div className="text-indigo-300 font-bold text-2xl">{finalFix.manager_2_score} pts</div>
                </div>
              </div>
              {finalFix.winner_id && (
                <div className="bg-indigo-600 p-6 text-center shadow-inner">
                  <span className="text-white font-black text-2xl tracking-widest uppercase drop-shadow-md">
                    🏆 <TeamName name={entrants[finalFix.winner_id]?.teamName} inline className="align-middle" /> <span className="align-middle">is the Champion 🏆</span>
                  </span>
                </div>
              )}
            </div>
          ) : (isWaitingForFinal && stage2Table.length >= 2) && (
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-xl overflow-hidden border border-indigo-900/50 mb-12 animate-fade-in-up">
              <div className="p-4 text-center border-b border-indigo-800/50 bg-black/20 flex flex-col items-center">
                <span className="text-yellow-400 font-bold tracking-[0.2em] uppercase text-xs mb-1">Stage 2 Concluded</span>
                <span className="text-indigo-300 font-semibold text-sm">Upcoming Final Showdown • Gameweek {finalStart}</span>
              </div>
              <div className="p-10 flex justify-between items-center text-center opacity-90">
                <div className="flex-1">
                  <TeamName name={stage2Table[0].teamName} className="text-3xl text-white mb-2" />
                  <div className="text-indigo-400 font-bold text-sm uppercase tracking-widest">Finalist</div>
                </div>
                <div className="px-8"><span className="text-4xl font-black text-slate-600">VS</span></div>
                <div className="flex-1">
                  <TeamName name={stage2Table[1].teamName} className="text-3xl text-white mb-2" />
                  <div className="text-indigo-400 font-bold text-sm uppercase tracking-widest">Finalist</div>
                </div>
              </div>
              <div className="bg-slate-950/50 p-4 text-center shadow-inner">
                 <span className="text-slate-400 font-semibold tracking-widest uppercase text-xs">Match will be played in Gameweek {finalStart}</span>
              </div>
            </div>
          )}

          {/* ==========================================
              PHASE 2: STAGE 2 TABLE 
          ========================================== */}
          {(isStage2Active || isWaitingForFinal || isFinalLive) && stage2Table.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                Stage 2 Standings 
                {isStage2Active && <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">Live Matches</span>}
              </h2>
              <StageTable data={stage2Table} isLive={isStage2Active} eliminateCount={Math.max(0, stage2Table.length - 2)} highlightTop={!isStage2Active ? 2 : 0} />
            </section>
          )}

          {isWaitingForStage2 && (
            <div className="bg-slate-100 border border-slate-300 text-slate-700 p-6 rounded-xl text-center shadow-sm">
              <h3 className="font-black text-xl mb-1">Stage 1 Concluded</h3>
              <p>Teams have completed their matches. Stage 2 begins in Gameweek {s2Start}.</p>
            </div>
          )}

          {(isStage1Active || isWaitingForStage2 || isStage2Active || isWaitingForFinal || isFinalLive) && stage1Table.length > 0 && (
            <section className={!isStage1Active && !isWaitingForStage2 ? 'opacity-70 scale-[0.98] transform origin-top transition-all' : ''}>
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                Stage 1 Standings
                {isStage1Active && <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">Live Matches</span>}
                {!isStage1Active && <span className="bg-slate-200 text-slate-500 text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider">Completed</span>}
              </h2>
              <StageTable data={stage1Table} isLive={isStage1Active} eliminateCount={1} />
            </section>
          )}
        </div>

        {/* RIGHT COLUMN: LIVE FIXTURE LOG */}
        <div className="xl:col-span-1">
          <div className="bg-slate-900 rounded-xl shadow-xl overflow-hidden sticky top-8">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <h2 className="font-bold text-white tracking-widest uppercase text-sm">Schedule & Results</h2>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            </div>
            
            <div className="p-4 space-y-3 max-h-[800px] overflow-y-auto custom-scrollbar">
              {fixtures?.filter(f => f.stage !== 'Final').map((fix) => {
                const isPlayed = fix.manager_1_score !== null;
                
                return (
                  <div key={fix.id} className={`rounded p-3 text-sm flex flex-col gap-2 border ${isPlayed ? 'bg-slate-800 border-slate-700' : 'bg-slate-800/40 border-slate-700/50 border-dashed'}`}>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex justify-between">
                      <span>GW {fix.gw_number}</span>
                      <span className={isPlayed ? 'text-indigo-400' : 'text-slate-500'}>{fix.stage}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`truncate w-2/5 font-semibold ${!isPlayed ? 'text-slate-400' : fix.winner_id === fix.manager_1_id ? 'text-green-400' : 'text-slate-300'}`}>
                        <TeamName name={entrants[fix.manager_1_id]?.teamName} inline className="truncate" />
                      </span>
                      
                      {isPlayed ? (
                        <span className="bg-slate-950 text-white font-mono px-2 py-1 rounded text-xs shadow-inner">
                          {fix.manager_1_score} - {fix.manager_2_score}
                        </span>
                      ) : (
                        <span className="bg-slate-700 text-slate-400 font-bold px-2 py-1 rounded text-[10px] uppercase tracking-widest">
                          VS
                        </span>
                      )}

                      <span className={`truncate w-2/5 text-right font-semibold ${!isPlayed ? 'text-slate-400' : fix.winner_id === fix.manager_2_id ? 'text-green-400' : 'text-slate-300'}`}>
                        <TeamName name={entrants[fix.manager_2_id]?.teamName} inline className="truncate" />
                      </span>
                    </div>
                  </div>
                );
              })}
              {(!fixtures || fixtures.length === 0) && (
                <div className="text-center text-slate-500 italic py-8">Schedule pending.</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}

// ==========================================
// DYNAMIC TABLE COMPONENT
// ==========================================
function StageTable({ data, isLive, eliminateCount, highlightTop }: { data: any[], isLive: boolean, eliminateCount: number, highlightTop?: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="p-4 w-12 text-center">Pos</th>
              <th className="p-4">Manager & Team</th>
              <th className="p-4 text-center w-16">Pld</th>
              <th className="p-4 text-center w-16">W</th>
              <th className="p-4 text-center w-16">D</th>
              <th className="p-4 text-center w-16">L</th>
              <th className="p-4 text-right w-24">FPL Pts</th>
              <th className="p-4 text-right w-24 text-indigo-300 font-bold">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((team: any, index: number) => {
              const isBottom = index >= data.length - eliminateCount;
              const isTop = highlightTop && index < highlightTop;
              
              let rowClass = "hover:bg-slate-50 transition-colors";
              let badge = null;

              if (isLive && isBottom) {
                rowClass = "bg-red-50 hover:bg-red-100/50 text-red-900 transition-colors";
                badge = <span className="text-[10px] bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded font-bold uppercase">Danger Zone</span>;
              } else if (!isLive && isBottom) {
                rowClass = "bg-slate-100 text-slate-400 opacity-60 grayscale";
                badge = <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-bold uppercase">Eliminated</span>;
              } else if (!isLive && isTop) {
                rowClass = "bg-green-50 text-green-900";
                badge = <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded font-bold uppercase">Promoted</span>;
              }

              return (
                <tr key={team.id} className={rowClass}>
                  <td className="p-4 text-center font-bold">{index + 1}</td>
                  <td className="p-4">
                    <div className="font-bold flex items-center gap-2">
                      <TeamName name={team.teamName} inline /> {badge}
                    </div>
                    <div className={`text-xs ${isLive && isBottom ? 'text-red-600/70' : 'text-slate-500'}`}>{team.managerName}</div>
                  </td>
                  <td className="p-4 text-center font-medium">{team.played}</td>
                  <td className="p-4 text-center font-semibold">{team.won}</td>
                  <td className="p-4 text-center font-semibold">{team.drawn}</td>
                  <td className="p-4 text-center font-semibold">{team.lost}</td>
                  <td className="p-4 text-right">{team.totalScore}</td>
                  <td className="p-4 text-right font-black text-lg bg-black/5">{team.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
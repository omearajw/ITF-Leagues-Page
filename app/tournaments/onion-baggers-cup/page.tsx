import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import { Suspense } from 'react';

export default function OnionBaggersPage() {
  return (
    <div className="max-w-7xl mx-auto py-8 font-sans">
      <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500 animate-pulse">Loading Onion Baggers Cup...</div>}>
        <OnionBaggersContent />
      </Suspense>
    </div>
  );
}

async function OnionBaggersContent() {
  const supabase = await createClient();
  const SEASON_ID = '2026-27';

  const { data: latestGwData } = await supabase.from('gameweeks').select('gw_number').eq('season_id', SEASON_ID).eq('is_finished', true).order('gw_number', { ascending: false }).limit(1).single();
  const currentGw = latestGwData ? latestGwData.gw_number : 0;

    const { data: contentData } = await supabase
    .from('page_content')
    .select('content')
    .eq('id', 'onion-baggers-cup') // or respective slug
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
  const lastGwToDisplay = isKnockouts ? kStart - 1 : currentGw;
  const { data: allScores } = await supabase.from('manager_gw_scores')
    .select('manager_fpl_id, gw_number, points')
    .eq('season_id', SEASON_ID)
    .lte('gw_number', lastGwToDisplay);

  const getScore = (mgrId: number, gw: number) => {
    const s = allScores?.find(score => score.manager_fpl_id === mgrId && score.gw_number === gw);
    return s ? s.points : '-';
  };

  // Generate Gameweek Columns for the Matrix (e.g. GW1 to GW8)
  const gwColumns = Array.from({ length: lastGwToDisplay - qStart + 1 }, (_, i) => qStart + i);

  // Split managers into Qualified and Unqualified
  const qualifiedManagers = entrantsData?.sort((a, b) => a.seed - b.seed) || [];
  const qualifiedIds = qualifiedManagers.map(q => q.manager_fpl_id);
  
  // Unqualified managers are strictly sorted by the CURRENT week's score
  const unqualifiedManagers = allManagers?.filter(m => !qualifiedIds.includes(m.manager_fpl_id))
    .sort((a, b) => (getScore(b.manager_fpl_id, currentGw) as number || 0) - (getScore(a.manager_fpl_id, currentGw) as number || 0)) || [];

  return (
    <>
      <header className="mb-10">
        <div className="flex items-end justify-between mb-2">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Onion Baggers Cup</h1>
          <span className="text-sm font-bold text-slate-500 bg-slate-200 px-3 py-1 rounded">Current GW: {currentGw}</span>
        </div>
        <div className="flex gap-4 mb-4 text-sm font-medium text-slate-500">
          <span className={`px-3 py-1 rounded border ${(isQualifying || isPreTournament) ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-slate-50'}`}>Qualifiers: GW{qStart}-GW{kStart - 1}</span>
          <span className={`px-3 py-1 rounded border ${isKnockouts ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-slate-50'}`}>Knockouts: GW{kStart}+</span>
        </div>
        <div className="bg-white border-l-4 border-orange-500 p-6 rounded-r-xl shadow-sm text-slate-700 italic">
          "{contentData?.content || 'No editor summary available.'}"
        </div>
      </header>

      {/* PHASE 0: PRE-TOURNAMENT */}
      {isPreTournament && (
        <section className="mb-12 text-center bg-white border border-slate-200 rounded-xl p-12 shadow-sm">
          <h2 className="text-3xl font-black text-slate-800 mb-2">Qualifiers Pending</h2>
          <p className="text-slate-500">The scramble for the 16 Onion Baggers Cup seeds begins in <strong>Gameweek {qStart}</strong>.</p>
        </section>
      )}

      {/* PHASE 1: QUALIFICATION MATRIX GRID */}
      {isQualifying && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            Qualification Standings
            <span className="w-3 h-3 bg-orange-500 rounded-full animate-pulse ml-2"></span>
          </h2>
          
          <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[800px]">
              <thead className="bg-slate-900 text-white border-b border-slate-700">
                <tr>
                  <th className="p-4 w-16 text-center border-r border-slate-800">Seed</th>
                  <th className="p-4 border-r border-slate-800 sticky left-0 bg-slate-900 z-10">Manager & Team</th>
                  {gwColumns.map(gw => (
                    <th key={gw} className={`p-4 text-center w-16 ${gw === currentGw ? 'bg-slate-800 text-orange-400' : ''}`}>
                      GW{gw}
                    </th>
                  ))}
                </tr>
              </thead>
              
              {/* SECTION: QUALIFIED */}
              <tbody className="divide-y divide-green-100 bg-green-50/20">
                {qualifiedManagers.length > 0 && (
                  <tr>
                    <td colSpan={gwColumns.length + 2} className="bg-green-100 text-green-800 font-bold uppercase tracking-widest text-xs px-4 py-2 border-y border-green-200">
                      The Final 16 (Locked)
                    </td>
                  </tr>
                )}
                {qualifiedManagers.map((entrant) => {
                  const isNewlyQualified = entrant.qualified_in_gw === currentGw;
                  
                  return (
                    <tr key={entrant.seed} className={`transition-colors ${isNewlyQualified ? 'bg-green-100/50 hover:bg-green-100' : 'hover:bg-green-50'}`}>
                      <td className="p-4 text-center font-black text-green-700 border-r border-green-100/50">#{entrant.seed}</td>
                      <td className={`p-4 border-r border-green-100/50 sticky left-0 z-10 transition-colors ${isNewlyQualified ? 'bg-green-50/50 group-hover:bg-green-100' : 'bg-white group-hover:bg-green-50'}`}>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <TeamName name={teamMap[entrant.manager_fpl_id]?.teamName} inline />
                          {isNewlyQualified && <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded font-bold uppercase tracking-widest animate-pulse">Newly Qualified</span>}
                        </div>
                        <div className="text-xs text-slate-500">{teamMap[entrant.manager_fpl_id]?.realName}</div>
                      </td>
                      {gwColumns.map(gw => {
                        const isQualWeek = gw === entrant.qualified_in_gw;
                        return (
                          <td key={gw} className={`p-4 text-center font-mono ${isQualWeek ? 'bg-green-100/80 text-green-700 font-black text-lg' : 'text-slate-300'}`}>
                            {isQualWeek ? getScore(entrant.manager_fpl_id, gw) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>

              {/* SECTION: UNQUALIFIED (FIGHTING FOR SPOTS) */}
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td colSpan={gwColumns.length + 2} className="bg-slate-100 text-slate-500 font-bold uppercase tracking-widest text-xs px-4 py-2 border-y border-slate-200">
                    Live Contenders (Ordered by GW{currentGw} Score)
                  </td>
                </tr>
                {unqualifiedManagers.map((manager) => (
                  <tr key={manager.manager_fpl_id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-center text-slate-300 font-bold border-r border-slate-100">-</td>
                    <td className="p-4 border-r border-slate-100 sticky left-0 z-10 bg-white group-hover:bg-slate-50 transition-colors">
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <TeamName name={teamMap[manager.manager_fpl_id]?.teamName} inline />
                      </div>
                      <div className="text-xs text-slate-500">{teamMap[manager.manager_fpl_id]?.realName}</div>
                    </td>
                    {gwColumns.map(gw => (
                      <td key={gw} className={`p-4 text-center font-mono ${gw === currentGw ? 'bg-slate-50 font-black text-slate-800' : 'text-slate-400 font-medium'}`}>
                        {getScore(manager.manager_fpl_id, gw)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* PHASE 2: KNOCKOUT BRACKET (LIGHT THEME) */}
      {isKnockouts && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Knockout Bracket</h2>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-x-auto">
            <div className="flex gap-8 min-w-[1000px]">
              
              <BracketColumn title="Round of 16" fixtures={fixtures?.filter(f => f.stage === 'Round of 16')} teamMap={teamMap} isFinal={false} />
              <BracketColumn title="Quarter-Finals" fixtures={fixtures?.filter(f => f.stage === 'Quarter-Final')} teamMap={teamMap} isFinal={false} />
              <BracketColumn title="Semi-Finals" fixtures={fixtures?.filter(f => f.stage === 'Semi-Final')} teamMap={teamMap} isFinal={false} />
              <BracketColumn title="The Final" fixtures={fixtures?.filter(f => f.stage === 'Final')} teamMap={teamMap} isFinal={true} />
              
            </div>
          </div>
        </section>
      )}
    </>
  );
}

// ==========================================
// BRACKET UI COMPONENT (LIGHT THEME)
// ==========================================
function BracketColumn({ title, fixtures, teamMap, isFinal }: { title: string, fixtures: any[] | undefined, teamMap: any, isFinal: boolean }) {
  if (!fixtures || fixtures.length === 0) {
    return (
      <div className="flex-1 flex flex-col gap-4">
        <h3 className="text-slate-500 font-bold uppercase tracking-widest text-xs text-center mb-4">{title}</h3>
        <div className="flex-1 border-2 border-slate-100 border-dashed rounded-xl flex items-center justify-center text-slate-400 font-bold text-sm italic py-20 bg-slate-50/50">
          TBD
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${isFinal ? 'w-80' : 'flex-1'}`}>
      <h3 className={`font-bold uppercase tracking-widest text-xs text-center mb-2 ${isFinal ? 'text-orange-600 text-sm' : 'text-slate-500'}`}>{title}</h3>
      <div className="flex flex-col justify-around h-full gap-4">
        {fixtures.map(fix => {
          const isPlayed = fix.manager_1_score !== null;
          return (
            <div key={fix.id} className={`flex flex-col rounded-lg border bg-white shadow-sm overflow-hidden ${isFinal ? 'border-orange-300 shadow-orange-100 ring-2 ring-orange-50' : 'border-slate-200'}`}>
              
              {/* Header */}
              <div className="bg-slate-50 px-3 py-1.5 flex justify-between items-center border-b border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GW {fix.gw_number}</span>
                {fix.winner_id && isFinal && <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded font-black uppercase tracking-widest">Champion</span>}
              </div>

              {/* Matchup Data */}
              <div className="flex flex-col">
                <MatchRow managerId={fix.manager_1_id} score={fix.manager_1_score} isWinner={fix.winner_id === fix.manager_1_id} isPlayed={isPlayed} teamMap={teamMap} />
                <div className="border-t border-slate-100"></div>
                <MatchRow managerId={fix.manager_2_id} score={fix.manager_2_score} isWinner={fix.winner_id === fix.manager_2_id} isPlayed={isPlayed} teamMap={teamMap} />
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchRow({ managerId, score, isWinner, isPlayed, teamMap }: { managerId: number, score: number | null, isWinner: boolean, isPlayed: boolean, teamMap: any }) {
  if (!managerId) {
    return (
      <div className="px-3 py-2 flex justify-between items-center opacity-50 bg-slate-50">
        <span className="text-sm font-semibold text-slate-400 italic">TBD</span>
      </div>
    );
  }

  return (
    <div className={`px-3 py-2 flex justify-between items-center transition-colors ${isPlayed && !isWinner ? 'opacity-40 bg-slate-50' : ''} ${isWinner ? 'bg-green-50/50' : 'bg-white'}`}>
      <TeamName
        name={teamMap[managerId]?.teamName}
        inline
        className={`text-sm truncate max-w-[140px] ${isWinner ? 'text-green-700' : 'text-slate-700'}`}
      />
      {isPlayed && (
        <span className={`font-mono text-sm font-black ${isWinner ? 'text-green-600' : 'text-slate-700'}`}>
          {score}
        </span>
      )}
    </div>
  );
}
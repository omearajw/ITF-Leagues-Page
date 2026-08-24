import { createClient } from '@/utils/supabase/server';
import TeamName, { getTeamNameDisplayText } from '@/components/TeamName';
import { Suspense } from 'react';
import { FormGridSkeleton } from '@/components/Skeletons';

export default function FormGrid() {
  return (
    <div className="max-w-[1400px] mx-auto pb-12 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">H2H Form Matrix</h1>
        <p className="text-slate-500">The season-long Win/Draw/Loss record for every division.</p>
      </header>

      <Suspense fallback={<FormGridSkeleton />}>
        <FormGridContent />
      </Suspense>
    </div>
  );
}

async function FormGridContent() {
  const supabase = await createClient();
  const SEASON_ID = '2026-27';
  const TOTAL_GW = 38;

  const { data: managers, error } = await supabase
    .from('season_managers')
    .select(`
      manager_fpl_id,
      team_name,
      division,
      managers!inner (real_name),
      h2h_fixtures (
        gw_number,
        result,
        manager_score,
        opponent_score
      )
    `)
    .eq('season_id', SEASON_ID)
    .order('division');

  if (error) {
    return <div className="p-8 text-red-500">Failed to load Form Grid: {error.message}</div>;
  }

  const divisions = ['Premier League', 'Championship', 'League One'];
  
  const getResultColor = (result?: string) => {
    if (result === 'W') return 'bg-green-500 text-white font-bold';
    if (result === 'L') return 'bg-red-500 text-white font-bold';
    if (result === 'D') return 'bg-slate-400 text-white font-bold';
    return 'bg-slate-100 text-slate-300'; 
  };

  return (
    <div className="space-y-12">
      {divisions.map((divisionName) => {
        const divManagers = managers?.filter(m => m.division === divisionName) || [];
        
        if (divManagers.length === 0) return null;

        return (
          <section key={divisionName} className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 bg-slate-900 text-white font-bold text-lg">
              {divisionName}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-center border-collapse">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-3 text-left sticky left-0 bg-slate-50 border-r z-10 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      Manager
                    </th>
                    {Array.from({ length: TOTAL_GW }, (_, i) => (
                      <th key={i} className="p-2 min-w-[40px] text-xs text-slate-500 font-semibold border-r">
                        {i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {divManagers.map((manager: any) => {
                    const formRecord: Record<number, any> = {};
                    manager.h2h_fixtures?.forEach((f: any) => {
                      formRecord[f.gw_number] = f;
                    });

                    return (
                      <tr key={manager.manager_fpl_id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="p-3 text-left sticky left-0 bg-white group-hover:bg-slate-50 border-r z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <TeamName name={manager.team_name} inline className="text-slate-800 truncate max-w-[180px]" />
                          <div className="text-xs text-slate-500">{manager.managers.real_name}</div>
                        </td>
                        
                        {Array.from({ length: TOTAL_GW }, (_, i) => {
                          const gw = i + 1;
                          const match = formRecord[gw];
                          
                          return (
                            <td key={gw} className="p-1 border-r border-slate-100">
                              <div 
                                className={`w-8 h-8 mx-auto flex items-center justify-center rounded text-xs cursor-default ${getResultColor(match?.result)}`}
                                title={match ? `${getTeamNameDisplayText(manager.team_name)} ${match.manager_score} - ${match.opponent_score}` : `Gameweek ${gw} unplayed`}
                              >
                                {match?.result || '-'}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
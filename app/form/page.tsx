import { createClient } from '@/utils/supabase/server';
import TeamName, { getTeamNameDisplayText } from '@/components/TeamName';
import { Suspense } from 'react';
import { FormGridSkeleton } from '@/components/Skeletons';
import GameweekBadge from '@/components/GameweekBadge';
import { getGameweekStatus } from '@/lib/gameweek-status';

export default function FormGrid() {
  return (
    <div className="max-w-[1400px] mx-auto pb-12 font-sans">
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">Form Guide</h1>
        <p className="text-dim">Win/Draw/Loss record, ranked.<span className="md:hidden"> Showing the last five results on small screens.</span></p>
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
  const gw = await getGameweekStatus();

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
    return <div className="p-8 text-red-500">Failed to load Form Guide: {error.message}</div>;
  }

  const divisions = ['Premier League', 'Championship', 'League One'];

  // Form score: last five confirmed results, W=1 D=0.5 L=0, weighted 1..5 with the most
  // recent counting 5. A run of five straight wins keeps counting back through the streak,
  // so longer streaks rank higher.
  const RESULT_VALUE: Record<string, number> = { W: 1, D: 0.5, L: 0 };
  const formScore = (fixtures: any[]) => {
    const confirmed = fixtures.filter(f => f.gw_number <= gw.syncedThroughGw).sort((a, b) => b.gw_number - a.gw_number);
    const lastFive = confirmed.slice(0, 5);
    let score = lastFive.reduce((sum, f, i) => sum + (RESULT_VALUE[f.result] ?? 0) * (5 - i), 0);
    if (lastFive.length === 5 && lastFive.every(f => f.result === 'W')) {
      let streak = 5;
      for (const f of confirmed.slice(5)) { if (f.result === 'W') streak++; else break; }
      score += streak - 5;
    }
    return { score, played: confirmed.length };
  };
  
  const LIVE_STRIPES = 'bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(0,0,0,0.06)_3px,rgba(0,0,0,0.06)_6px)]';

  const getResultColor = (result?: string, isLive = false) => {
    if (isLive) {
      if (result === 'W') return `border-2 border-dashed border-green-500 text-green-400 font-bold bg-green-500/10 ${LIVE_STRIPES}`;
      if (result === 'L') return `border-2 border-dashed border-red-500 text-red-400 font-bold bg-red-500/10 ${LIVE_STRIPES}`;
      if (result === 'D') return `border-2 border-dashed border-faint text-dim font-bold bg-surface-2 ${LIVE_STRIPES}`;
    }
    if (result === 'W') return 'bg-green-500 text-white font-bold';
    if (result === 'L') return 'bg-red-500 text-white font-bold';
    if (result === 'D') return 'bg-faint text-white font-bold';
    return 'bg-surface-2 text-ink-2'; 
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-dim">
        {gw.liveGw && (
          <span className="flex items-center gap-2">
            <span className={`w-4 h-4 rounded border-2 border-dashed border-faint bg-surface-2 ${LIVE_STRIPES}`} />
            dashed = live result, may change
          </span>
        )}
        <GameweekBadge provisional={!!gw.liveGw}>
          {gw.liveGw ? `GW${gw.liveGw} in progress · provisional` : `Results through GW${gw.syncedThroughGw} · final`}
        </GameweekBadge>
      </div>
      {divisions.map((divisionName) => {
        const divManagers = (managers?.filter(m => m.division === divisionName) || [])
          .map((m: any) => ({ ...m, form: formScore(m.h2h_fixtures || []) }))
          .sort((a: any, b: any) => b.form.score - a.form.score || a.team_name.localeCompare(b.team_name));
        
        if (divManagers.length === 0) return null;

        return (
          <section key={divisionName} className="bg-surface rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 bg-panel text-white font-bold text-lg">
              {divisionName}
            </div>
            
            {/* Phones: last five results per manager instead of a 38-column grid */}
            <div className="md:hidden divide-y divide-line">
              {divManagers.map((manager: any) => {
                const played = (manager.h2h_fixtures || [])
                  .filter((f: any) => f.gw_number <= (gw.liveGw ?? gw.syncedThroughGw))
                  .sort((a: any, b: any) => b.gw_number - a.gw_number);
                const lastFive = played.slice(0, 5).reverse();
                const tally = played.filter((f: any) => f.gw_number !== gw.liveGw).reduce((acc: Record<string, number>, f: any) => {
                  acc[f.result] = (acc[f.result] || 0) + 1;
                  return acc;
                }, {});
                return (
                  <div key={manager.manager_fpl_id} className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 shrink-0 text-xs font-black text-faint">{divManagers.indexOf(manager) + 1}</span>
                      <div className="min-w-0">
                        <TeamName name={manager.team_name} inline className="text-ink min-w-0" />
                        <div className="text-xs text-dim">{manager.managers.real_name} · {tally.W || 0}W {tally.D || 0}D {tally.L || 0}L · form {manager.form.score % 1 === 0 ? manager.form.score : manager.form.score.toFixed(1)}</div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {lastFive.length === 0 && <span className="text-xs text-faint italic">No results yet</span>}
                      {lastFive.map((f: any) => {
                        const isLive = f.gw_number === gw.liveGw;
                        return (
                          <span
                            key={f.gw_number}
                            className={`w-7 h-7 flex items-center justify-center rounded text-xs ${getResultColor(f.result, isLive)}`}
                            title={`GW${f.gw_number}: ${f.manager_score} - ${f.opponent_score}${isLive ? ' (live)' : ''}`}
                          >
                            {f.result}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-center border-collapse">
                <thead className="bg-surface-2 border-b">
                  <tr>
                    <th className="p-3 text-left sticky left-0 bg-surface-2 border-r z-10 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      Manager
                    </th>
                    <th className="p-2 min-w-[52px] text-xs text-dim font-semibold border-r" title="Form score: last five results, weighted to the most recent">Form</th>
                    {Array.from({ length: TOTAL_GW }, (_, i) => (
                      <th key={i} className={`p-2 min-w-[40px] text-xs font-semibold border-r ${i + 1 === gw.liveGw ? 'text-amber-400' : 'text-dim'}`} title={i + 1 === gw.liveGw ? 'In progress' : undefined}>
                        {i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {divManagers.map((manager: any, rank: number) => {
                    const formRecord: Record<number, any> = {};
                    manager.h2h_fixtures?.forEach((f: any) => {
                      formRecord[f.gw_number] = f;
                    });

                    return (
                      <tr key={manager.manager_fpl_id} className="border-b last:border-0 hover:bg-surface-2">
                        <td className="p-3 text-left sticky left-0 bg-surface border-r z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 shrink-0 text-xs font-black text-faint">{rank + 1}</span>
                            <TeamName name={manager.team_name} inline className="text-ink min-w-0 max-w-[180px]" />
                          </div>
                          <div className="text-xs text-dim pl-7">{manager.managers.real_name}</div>
                        </td>
                        <td className="p-2 text-center border-r font-black text-ink">{manager.form.score % 1 === 0 ? manager.form.score : manager.form.score.toFixed(1)}</td>
                        
                        {Array.from({ length: TOTAL_GW }, (_, i) => {
                          const gwNumber = i + 1;
                          const match = formRecord[gwNumber];
                          const isLive = gwNumber === gw.liveGw;
                          
                          return (
                            <td key={gwNumber} className="p-1 border-r border-line">
                              <div 
                                className={`w-8 h-8 mx-auto flex items-center justify-center rounded text-xs cursor-default ${getResultColor(match?.result, isLive)}`}
                                title={match ? `${getTeamNameDisplayText(manager.team_name)} ${match.manager_score} - ${match.opponent_score}${isLive ? ' (live)' : ''}` : `Gameweek ${gwNumber} unplayed`}
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
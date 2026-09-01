import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import { Suspense } from 'react';
import { ITFOpenSkeleton } from '@/components/Skeletons';

export default function Index() {
  return (
    <main className="max-w-4xl mx-auto p-8 font-sans">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">ITF Open</h1>
            <p className="text-gray-500">The master leaderboard across all divisions.</p>
          </div>
          <div className="mt-1">
            <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded">GW{/* placeholder, filled in content component */}</span>
          </div>
        </div>
      </header>
      
      <Suspense fallback={<ITFOpenSkeleton />}>
        <ITFOpenContent />
      </Suspense>
    </main>
  );
}

async function ITFOpenContent() {
  const supabase = await createClient();
  const SEASON_ID = '2026-27';

  // Find the most recent finished gameweek
  const { data: latestGw } = await supabase
    .from('gameweeks')
    .select('gw_number')
    .eq('season_id', SEASON_ID)
    .eq('is_finished', true)
    .order('gw_number', { ascending: false })
    .limit(1)
    .single();
  const currentGw = latestGw ? latestGw.gw_number : 1;

  const { data: managers, error } = await supabase
    .from('manager_gw_scores')
    .select(`
      manager_fpl_id,
      classic_total_points,
      season_managers!inner (
        team_name,
        division,
        managers!inner (
          real_name
        )
      )
    `)
    .eq('season_id', SEASON_ID)
    .eq('gw_number', currentGw)
    .order('classic_total_points', { ascending: false });

  if (error) {
    return <div className="p-10 text-red-500">Error loading league: {error.message}</div>;
  }

  return (
    <div>
      <div className="mb-4 text-sm text-slate-600">Showing scores for <strong>GW{currentGw}</strong></div>
      <div className="overflow-x-auto hidden md:block">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="p-3">Rank</th>
            <th className="p-3">Team & Manager</th>
            <th className="p-3">Division</th>
            <th className="p-3 text-right">Total Points</th>
          </tr>
        </thead>
        <tbody>
          {managers?.map((manager: any, index: number) => (
            <tr key={manager.manager_fpl_id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="p-3 font-bold text-gray-700">{index + 1}</td>
              <td className="p-3">
                <TeamName name={manager.season_managers.team_name} inline className="font-semibold" />
                <div className="text-sm text-gray-500">{manager.season_managers.managers.real_name}</div>
              </td>
              <td className="p-3">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {manager.season_managers.division}
                </span>
              </td>
              <td className="p-3 text-right font-bold text-lg">
                {manager.classic_total_points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Mobile stacked list */}
      <div className="md:hidden space-y-3">
        {managers?.map((manager: any, index: number) => (
          <div key={manager.manager_fpl_id} className="bg-white border rounded-lg p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-700">{index + 1}. <span className="ml-2"><TeamName name={manager.season_managers.team_name} inline className="font-semibold" /></span></div>
                <div className="text-xs text-slate-500">{manager.season_managers.managers.real_name}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-black text-slate-800">{manager.classic_total_points}</div>
                <div className="text-xs mt-1"><span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">{manager.season_managers.division}</span></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(!managers || managers.length === 0) && (
        <div className="p-10 text-center text-gray-500">
          No scores found yet. The season hasn't started!
        </div>
      )}
    </div>
  );
}
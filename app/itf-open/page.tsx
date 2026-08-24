import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import { Suspense } from 'react';
import { ITFOpenSkeleton } from '@/components/Skeletons';

export default function Index() {
  return (
    <main className="max-w-4xl mx-auto p-8 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">ITF Open</h1>
        <p className="text-gray-500">The master leaderboard across all divisions.</p>
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
    .order('classic_total_points', { ascending: false });

  if (error) {
    return <div className="p-10 text-red-500">Error loading league: {error.message}</div>;
  }

  return (
    <div className="overflow-x-auto">
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
      
      {(!managers || managers.length === 0) && (
        <div className="p-10 text-center text-gray-500">
          No scores found yet. The season hasn't started!
        </div>
      )}
    </div>
  );
}
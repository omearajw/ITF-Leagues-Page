import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import PageHeader from '@/components/PageHeader';
import { SEASON_ID } from '@/lib/gameweek-status';
import { getMyTeamId } from '@/lib/my-team';
import { DIVISIONS } from '@/lib/divisions';

export default async function MyTeamPage({ searchParams }: { searchParams: Promise<{ next?: string; change?: string }> }) {
  const { next, change } = await searchParams;
  const myTeamId = await getMyTeamId();
  const destination = (id: number) => (next === 'plan' ? `/manager/${id}/plan` : `/manager/${id}`);
  if (myTeamId && !change) redirect(destination(myTeamId));

  const supabase = await createClient();
  const { data: managers } = await supabase.from('season_managers').select('manager_fpl_id, team_name, division, managers!inner (real_name)').eq('season_id', SEASON_ID).order('team_name');

  return (
    <div className="max-w-5xl mx-auto py-2 sm:py-8 font-sans">
      <PageHeader title="Which team is yours?">
        <p className="text-sm text-dim">Pick your team once on this device and the site will take you straight to it: your page, your planner, your match-up. You can still look at everyone else&apos;s.</p>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {DIVISIONS.map(division => (
          <div key={division.name} className="bg-surface border border-line rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-surface-2 border-b border-line text-[10px] font-bold uppercase tracking-widest text-dim">{division.name}</div>
            <ul className="divide-y divide-line">
              {(managers || []).filter((m: any) => m.division === division.name).map((m: any) => {
                const id = Number(m.manager_fpl_id);
                const href = `/api/my-team?id=${id}&next=${encodeURIComponent(destination(id))}`;
                return (
                  <li key={id}>
                    <a href={href} className={`flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2 transition ${myTeamId === id ? 'bg-brand/10' : ''}`}>
                      <span className="min-w-0">
                        <TeamName name={m.team_name} inline managerId={id} noLink className="text-ink min-w-0" />
                        <span className="block text-xs text-dim">{m.managers.real_name}</span>
                      </span>
                      <span className={`shrink-0 text-xs font-bold ${myTeamId === id ? 'text-brand' : 'text-brand-2'}`}>{myTeamId === id ? 'Current' : 'This is me'}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {myTeamId && (
        <p className="mt-4 text-xs text-faint">Currently set to a team on this device. <a href="/api/my-team?clear=1&next=%2Fmy-team%3Fchange%3D1" className="text-brand-2 hover:underline">Forget it</a>.</p>
      )}
    </div>
  );
}

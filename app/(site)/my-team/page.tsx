import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import PageHeader from '@/components/PageHeader';
import { SEASON_ID } from '@/lib/gameweek-status';
import { getMyTeamId } from '@/lib/my-team';
import { DIVISIONS } from '@/lib/divisions';
import SectionHeading from '@/components/SectionHeading';

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
        <p className="text-dim max-w-[34rem]">Pick your team once on this device and the site will take you straight to it: your page, your planner, your match-up. You can still look at everyone else&apos;s.</p>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-10">
        {DIVISIONS.map(division => (
          <div key={division.name}>
            <SectionHeading as="h2" className="mb-0">{division.name}</SectionHeading>
            <ul className="divide-y divide-line">
              {(managers || []).filter((m: any) => m.division === division.name).map((m: any) => {
                const id = Number(m.manager_fpl_id);
                const href = `/api/my-team?id=${id}&next=${encodeURIComponent(destination(id))}`;
                return (
                  <li key={id}>
                    <a href={href} className={`flex items-center justify-between gap-3 px-2 -mx-2 py-3 hover:bg-surface transition ${myTeamId === id ? 'bg-surface-2' : ''}`}>
                      <span className="min-w-0">
                        <TeamName name={m.team_name} inline managerId={id} noLink className="font-semibold text-ink min-w-0" />
                        <span className="block text-sm text-dim">{m.managers.real_name}</span>
                      </span>
                      <span className={`shrink-0 text-sm font-semibold ${myTeamId === id ? 'text-ink' : 'text-brand-2'}`}>{myTeamId === id ? 'Current' : 'This is me'}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {myTeamId && (
        <p className="mt-6 text-sm text-dim">Currently set to a team on this device. <a href="/api/my-team?clear=1&next=%2Fmy-team%3Fchange%3D1" className="text-brand-2 hover:underline">Forget it</a>.</p>
      )}
    </div>
  );
}

import { ChevronDown } from 'lucide-react';
import { Suspense } from 'react';
import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import PageHeader from '@/components/PageHeader';
import { DivisionSkeleton } from '@/components/Skeletons';
import { getGameweekStatus, getFplEvents, SEASON_ID } from '@/lib/gameweek-status';
import { buildMotm, type MotmMonth } from '@/lib/motm';
import { DIVISIONS } from '@/lib/divisions';
import SectionHeading from '@/components/SectionHeading';

export default function MotmPage() {
  return (
    <div className="max-w-5xl mx-auto py-2 sm:py-8 font-sans">
      <Suspense fallback={<DivisionSkeleton />}>
        <MotmContent />
      </Suspense>
    </div>
  );
}

function MonthCard({ month }: { month: MotmMonth }) {
  return (
    <section>
      <SectionHeading aside={(
        <span className={month.complete ? 'text-dim' : 'text-live-2'}>
          GW{month.gameweeks[0]}–{month.gameweeks[month.gameweeks.length - 1]}
          {month.complete ? ' · awarded' : ' · in progress'}
        </span>
      )}>
        {month.label}
      </SectionHeading>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-y-8 col-rules">
        {month.divisions.map(div => (
          <div key={div.division} className="col-head">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <h3 className="font-display text-lg leading-none tracking-[0.03em] text-ink-2">{div.division}</h3>
              {div.leaders.length > 1 && <span className="label">Shared</span>}
            </div>
            {div.leaders.length === 0 ? (
              <div className="text-sm text-faint italic">No scores yet</div>
            ) : (
              <div className="divide-y divide-line border-t border-line">
                {div.leaders.map(leader => (
                  <div key={leader.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <TeamName name={leader.teamName} managerId={leader.id} inline className="font-semibold text-ink min-w-0" />
                      <div className="text-sm text-dim">{leader.realName}</div>
                    </div>
                    <span className="plate shrink-0 font-display text-3xl min-w-[3.75rem]">{leader.points}</span>
                  </div>
                ))}
              </div>
            )}
            {div.standings.length > div.leaders.length && (
              <details className="mt-2 border-t border-line pt-2">
                <summary className="list-none [&::-webkit-details-marker]:hidden flex justify-end">
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-2 cursor-pointer hover:underline">Full standings <ChevronDown size={14} aria-hidden="true" className="transition-transform [details[open]_&]:rotate-180" /></span>
                </summary>
                <ol className="mt-2 divide-y divide-line text-sm text-ink-2">
                  {div.standings.map((m, i) => (
                    <li key={m.id} className="flex justify-between gap-2 py-1.5">
                      <span className="min-w-0 flex items-center gap-2"><span className="text-faint w-5 tabular">{i + 1}</span><TeamName name={m.teamName} managerId={m.id} inline className="min-w-0" /></span>
                      <span className="font-semibold tabular">{m.points}</span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

async function MotmContent() {
  const supabase = await createClient();
  const [gw, events, { data: managerRows }, { data: scoreRows }] = await Promise.all([
    getGameweekStatus(),
    getFplEvents(),
    supabase.from('season_managers').select('manager_fpl_id, team_name, division, managers!inner (real_name)').eq('season_id', SEASON_ID),
    supabase.from('manager_gw_scores').select('manager_fpl_id, gw_number, points').eq('season_id', SEASON_ID),
  ]);

  const managers = (managerRows || []).map((m: any) => ({ id: Number(m.manager_fpl_id), teamName: m.team_name, realName: m.managers.real_name, division: m.division }));
  const scores = (scoreRows || []).map((s: any) => ({ manager_fpl_id: Number(s.manager_fpl_id), gw_number: s.gw_number, points: s.points }));
  const months = events ? buildMotm({ events, syncedThroughGw: gw.syncedThroughGw, managers, scores, divisions: DIVISIONS.map(d => d.name) }) : [];

  return (
    <>
      <PageHeader title="Manager of the Month" rules />

      {!events && (
        <div className="text-live-2 border-y border-live/30 py-3 text-sm">Live FPL status is unavailable, so months cannot be worked out right now.</div>
      )}
      {events && months.length === 0 && (
        <div className="py-10 text-center text-dim">No confirmed gameweeks yet. The first award lands once the opening month is complete.</div>
      )}
      <div className="space-y-12">
        {months.map(month => <MonthCard key={month.key} month={month} />)}
      </div>
    </>
  );
}

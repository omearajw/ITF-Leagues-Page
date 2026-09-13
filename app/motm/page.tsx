import { Suspense } from 'react';
import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import PageHeader from '@/components/PageHeader';
import GameweekBadge from '@/components/GameweekBadge';
import { DivisionSkeleton } from '@/components/Skeletons';
import { getGameweekStatus, getFplEvents, SEASON_ID } from '@/lib/gameweek-status';
import { buildMotm, type MotmMonth } from '@/lib/motm';
import { DIVISIONS } from '@/lib/divisions';

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
    <section className={`bg-surface rounded-xl shadow-sm border overflow-hidden ${month.complete ? '' : 'border-amber-500/30'}`}>
      <div className="px-4 sm:px-6 py-3 border-b flex flex-wrap items-center justify-between gap-2 bg-surface-2">
        <h2 className="text-lg font-bold text-ink">{month.label}</h2>
        <span className="text-xs text-dim">
          GW{month.gameweeks[0]}–{month.gameweeks[month.gameweeks.length - 1]}
          {month.complete ? ' · awarded' : ' · in progress'}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line">
        {month.divisions.map(div => (
          <div key={div.division} className="p-4 sm:p-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-faint mb-2">{div.division}</div>
            {div.leaders.length === 0 ? (
              <div className="text-sm text-faint italic">No scores yet</div>
            ) : (
              <div className="space-y-2">
                {div.leaders.map(leader => (
                  <div key={leader.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span aria-hidden="true">{month.complete ? '🏆' : '⏳'}</span>
                        <TeamName name={leader.teamName} inline className="text-ink min-w-0" />
                      </div>
                      <div className="text-xs text-dim pl-7">{leader.realName}</div>
                    </div>
                    <span className="shrink-0 text-lg font-black text-ink">{leader.points}</span>
                  </div>
                ))}
                {div.leaders.length > 1 && <div className="text-[10px] uppercase tracking-wider font-bold text-amber-300">Shared</div>}
              </div>
            )}
            {div.standings.length > div.leaders.length && (
              <details className="mt-3">
                <summary className="text-xs text-brand-2 cursor-pointer">Full standings</summary>
                <ol className="mt-2 space-y-1 text-xs text-dim">
                  {div.standings.map((m, i) => (
                    <li key={m.id} className="flex justify-between gap-2">
                      <span className="min-w-0 flex items-center gap-1.5"><span className="text-faint w-4">{i + 1}</span><TeamName name={m.teamName} inline className="min-w-0" /></span>
                      <span className="font-bold">{m.points}</span>
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
      <PageHeader
        title="Manager of the Month"
        badge={<GameweekBadge provisional={false}>Confirmed weeks through GW{gw.syncedThroughGw}</GameweekBadge>}
      >
        <p className="text-sm text-dim">
          Each month the manager in each league with the most points across that month&apos;s gameweeks takes the award. Ties share it.
          A gameweek belongs to the month its FPL deadline falls in.
        </p>
      </PageHeader>

      {!events && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-xl p-4 text-sm">Live FPL status is unavailable, so months cannot be worked out right now.</div>
      )}
      {events && months.length === 0 && (
        <div className="bg-surface border rounded-xl p-6 sm:p-12 text-center text-dim">No confirmed gameweeks yet. The first award lands once the opening month is complete.</div>
      )}
      <div className="space-y-6">
        {months.map(month => <MonthCard key={month.key} month={month} />)}
      </div>
    </>
  );
}

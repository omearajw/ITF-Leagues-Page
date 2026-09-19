import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import { LiveChip } from '@/components/GameweekBadge';
import { getDivisionFixtures, type H2HFixture } from '@/lib/h2h-fixtures';
import { SEASON_ID, type GameweekStatus } from '@/lib/gameweek-status';

type Props = {
  leagueId: string;
  gw: GameweekStatus;
  teamNames: Record<number, string>;
};

function FixtureRow({ fix, scores, teamNames, live }: { fix: H2HFixture; scores: Record<number, number> | null; teamNames: Record<number, string>; live: boolean }) {
  const s1 = scores ? scores[fix.m1] : undefined;
  const s2 = scores ? scores[fix.m2] : undefined;
  const played = s1 !== undefined && s2 !== undefined;
  const lead1 = played && !live && (s1 as number) > (s2 as number);
  const lead2 = played && !live && (s2 as number) > (s1 as number);

  return (
    <div className="flex items-center gap-2 py-2.5 text-sm">
      <span className={`flex justify-end min-w-0 flex-1 text-right ${lead1 ? 'font-bold text-ink' : lead2 ? 'text-dim' : 'text-ink-2'}`}>
        <TeamName name={teamNames[fix.m1] || fix.name1} managerId={fix.m1} inline className="min-w-0" />
      </span>
      {played ? (
        <span className={`shrink-0 font-mono font-bold px-2 py-0.5 rounded text-xs ${live ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30' : 'bg-panel text-white'}`}>
          {s1} - {s2}
        </span>
      ) : (
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-faint px-2">v</span>
      )}
      <span className={`flex min-w-0 flex-1 ${lead2 ? 'font-bold text-ink' : lead1 ? 'text-dim' : 'text-ink-2'}`}>
        <TeamName name={teamNames[fix.m2] || fix.name2} managerId={fix.m2} inline className="min-w-0" />
      </span>
    </div>
  );
}

export default async function DivisionFixtures({ leagueId, gw, teamNames }: Props) {
  const thisGw = gw.displayGw;
  const nextGw = thisGw + 1;
  const isLive = thisGw === gw.liveGw;

  const supabase = await createClient();
  const [thisWeek, nextWeek, { data: scoreRows }] = await Promise.all([
    thisGw >= 1 ? getDivisionFixtures(leagueId, thisGw) : Promise.resolve(null),
    nextGw <= 38 ? getDivisionFixtures(leagueId, nextGw) : Promise.resolve(null),
    thisGw >= 1
      ? supabase.from('manager_gw_scores').select('manager_fpl_id, points').eq('season_id', SEASON_ID).eq('gw_number', thisGw)
      : Promise.resolve({ data: null }),
  ]);

  const scores: Record<number, number> | null = scoreRows && scoreRows.length > 0
    ? Object.fromEntries(scoreRows.map((r: any) => [Number(r.manager_fpl_id), r.points]))
    : null;

  if (!thisWeek && !nextWeek) return null;

  return (
    <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
      {thisWeek && (
        <div className="bg-surface rounded-xl shadow-sm border p-4">
          <h3 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2 mb-1">
            GW{thisGw} Fixtures {isLive && <LiveChip />}
          </h3>
          <p className="text-xs text-dim mb-2">{isLive ? 'Scores update through the week and are provisional until FPL confirms.' : 'Confirmed results.'}</p>
          <div className="divide-y divide-line">
            {thisWeek.map(fix => <FixtureRow key={`${fix.m1}-${fix.m2}`} fix={fix} scores={scores} teamNames={teamNames} live={isLive} />)}
            {thisWeek.length === 0 && <div className="py-4 text-center text-xs text-faint italic">No fixtures listed.</div>}
          </div>
        </div>
      )}
      {nextWeek && (
        <div className="bg-surface rounded-xl shadow-sm border p-4">
          <h3 className="text-sm font-bold text-ink uppercase tracking-wider mb-1">GW{nextGw} Fixtures</h3>
          <p className="text-xs text-dim mb-2">Next up{gw.nextGw && gw.nextGw.id === nextGw ? ` · deadline ${new Date(gw.nextGw.deadline).toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}.</p>
          <div className="divide-y divide-line">
            {nextWeek.map(fix => <FixtureRow key={`${fix.m1}-${fix.m2}`} fix={fix} scores={null} teamNames={teamNames} live={false} />)}
            {nextWeek.length === 0 && <div className="py-4 text-center text-xs text-faint italic">Fixtures not published yet.</div>}
          </div>
        </div>
      )}
    </section>
  );
}

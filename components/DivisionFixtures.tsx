import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import { LiveChip } from '@/components/GameweekBadge';
import { getDivisionFixtures, type H2HFixture } from '@/lib/h2h-fixtures';
import { SEASON_ID, type GameweekStatus } from '@/lib/gameweek-status';
import { getWeekProjection, dueFor, type WeekProjection } from '@/lib/projection';
import DueMark from '@/components/DueMark';
import SectionHeading from '@/components/SectionHeading';

type Props = {
  leagueId: string;
  gw: GameweekStatus;
  teamNames: Record<number, string>;
  week?: number; // defaults to the week the rest of the site is showing
};

function FixtureRow({ fix, scores, teamNames, live, projection }: { fix: H2HFixture; scores: Record<number, number> | null; teamNames: Record<number, string>; live: boolean; projection: WeekProjection | null }) {
  const d1 = projection ? dueFor(projection, fix.gw, fix.m1) : null;
  const d2 = projection ? dueFor(projection, fix.gw, fix.m2) : null;
  const s1 = scores && scores[fix.m1] !== undefined ? scores[fix.m1] + (d1?.due || 0) : undefined;
  const s2 = scores && scores[fix.m2] !== undefined ? scores[fix.m2] + (d2?.due || 0) : undefined;
  const played = s1 !== undefined && s2 !== undefined;
  const lead1 = played && !live && (s1 as number) > (s2 as number);
  const lead2 = played && !live && (s2 as number) > (s1 as number);

  return (
    <div className="flex items-center gap-2 py-2.5 text-sm">
      <span className={`flex justify-end min-w-0 flex-1 text-right ${lead1 ? 'font-bold text-ink' : lead2 ? 'text-dim' : 'text-ink-2'}`}>
        <TeamName name={teamNames[fix.m1] || fix.name1} managerId={fix.m1} inline className="min-w-0" />
      </span>
      {played ? (
        <span className={`shrink-0 font-display text-xl leading-none px-2 whitespace-nowrap ${live ? 'text-live-2' : 'text-ink'}`}>
          <DueMark due={d1} className="mr-1 font-sans" />{s1}<span className="text-faint mx-1">-</span>{s2}<DueMark due={d2} className="ml-1 font-sans" />
        </span>
      ) : (
        <span className="shrink-0 label px-2">v</span>
      )}
      <span className={`flex min-w-0 flex-1 ${lead2 ? 'font-bold text-ink' : lead1 ? 'text-dim' : 'text-ink-2'}`}>
        <TeamName name={teamNames[fix.m2] || fix.name2} managerId={fix.m2} inline className="min-w-0" />
      </span>
    </div>
  );
}

export default async function DivisionFixtures({ leagueId, gw, teamNames, week }: Props) {
  const thisGw = week ?? gw.displayGw;
  const nextGw = thisGw + 1;
  const isLive = thisGw === gw.liveGw;

  const supabase = await createClient();
  const [thisWeek, nextWeek, { data: scoreRows }, projection] = await Promise.all([
    thisGw >= 1 ? getDivisionFixtures(leagueId, thisGw) : Promise.resolve(null),
    nextGw <= 38 ? getDivisionFixtures(leagueId, nextGw) : Promise.resolve(null),
    thisGw >= 1
      ? supabase.from('manager_gw_scores').select('manager_fpl_id, points').eq('season_id', SEASON_ID).eq('gw_number', thisGw)
      : Promise.resolve({ data: null }),
    isLive ? getWeekProjection() : Promise.resolve(null),
  ]);

  const scores: Record<number, number> | null = scoreRows && scoreRows.length > 0
    ? Object.fromEntries(scoreRows.map((r: any) => [Number(r.manager_fpl_id), r.points]))
    : null;

  if (!thisWeek && !nextWeek) return null;

  return (
    <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
      {thisWeek && (
        <div>
          <SectionHeading as="h2" className="mb-2" aside={isLive ? <LiveChip /> : undefined}>GW{thisGw} Fixtures</SectionHeading>
          <p className="text-sm text-dim mb-1">{isLive ? 'Scores update through the week, include subs due from the bench (+n), and are provisional until FPL confirms.' : 'Confirmed results.'}</p>
          <div className="divide-y divide-line">
            {thisWeek.map(fix => <FixtureRow key={`${fix.m1}-${fix.m2}`} fix={fix} scores={scores} teamNames={teamNames} live={isLive} projection={projection} />)}
            {thisWeek.length === 0 && <div className="py-4 text-center text-sm text-faint italic">No fixtures listed.</div>}
          </div>
        </div>
      )}
      {nextWeek && (
        <div>
          <SectionHeading as="h2" className="mb-2">GW{nextGw} Fixtures</SectionHeading>
          <p className="text-sm text-dim mb-1">Next up{gw.nextGw && gw.nextGw.id === nextGw ? ` · deadline ${new Date(gw.nextGw.deadline).toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}.</p>
          <div className="divide-y divide-line">
            {nextWeek.map(fix => <FixtureRow key={`${fix.m1}-${fix.m2}`} fix={fix} scores={null} teamNames={teamNames} live={false} projection={null} />)}
            {nextWeek.length === 0 && <div className="py-4 text-center text-sm text-faint italic">Fixtures not published yet.</div>}
          </div>
        </div>
      )}
    </section>
  );
}

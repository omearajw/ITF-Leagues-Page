import Link from 'next/link';
import TeamOfTheWeekCard, { TotwFacts } from '@/components/TeamOfTheWeekCard';
import SectionHeading from '@/components/SectionHeading';
import { getTeamOfTheWeek } from '@/lib/team-of-the-week';
import { getFplEvents } from '@/lib/gameweek-status';

// The week's top score, first thing under the hub masthead.
export default async function TeamOfTheWeekBanner({ gw }: { gw: number }) {
  const [totw, events] = await Promise.all([getTeamOfTheWeek(gw), getFplEvents()]);
  if (!totw) return null;
  const many = totw.winners.length > 1;
  const facts = (
    <>
      {many && <span className="font-semibold text-ink-2">Shared by {totw.winners.length} teams</span>}
      <TotwFacts totw={totw} globalAverage={events?.find(e => e.id === totw.gw)?.average} />
    </>
  );

  return (
    <section>
      <SectionHeading aside={<Link href="/team-of-the-week" className="font-semibold text-brand-2 hover:underline whitespace-nowrap">Read more &rarr;</Link>}>
        Team{many ? 's' : ''} of the Week <span className="text-dim">· GW{totw.gw}</span>
      </SectionHeading>
      <div className="panel">
        <div className={many ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 col-rules' : ''}>
          {totw.winners.map(team => <TeamOfTheWeekCard key={team.id} team={team} gw={totw.gw} size={many ? 'md' : 'lg'} href="/team-of-the-week" facts={many ? undefined : facts} />)}
        </div>
        {many && <div className="mt-4 pt-3 border-t border-line flex flex-wrap gap-x-6 gap-y-1 text-sm text-dim">{facts}</div>}
      </div>
    </section>
  );
}

import Link from 'next/link';
import TeamOfTheWeekCard from '@/components/TeamOfTheWeekCard';
import { getTeamOfTheWeek } from '@/lib/team-of-the-week';

// Full-width celebration on the hub, between the gameweek timeline and the leagues.
export default async function TeamOfTheWeekBanner({ gw }: { gw: number }) {
  const totw = await getTeamOfTheWeek(gw);
  if (!totw) return null;
  const many = totw.winners.length > 1;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-surface to-surface shadow-lg">
      <div className="absolute -top-10 -right-6 text-[7rem] leading-none opacity-10 select-none" aria-hidden="true">🏆</div>
      <div className="relative p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-300 flex items-center gap-2">
            <span aria-hidden="true">🏆</span> Team{many ? 's' : ''} of the Week · GW{totw.gw}
          </h2>
          <Link href="/team-of-the-week" className="text-xs font-bold text-brand-2 hover:underline whitespace-nowrap">Full write-up &rarr;</Link>
        </div>

        <div className={many ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : ''}>
          {totw.winners.map(team => <TeamOfTheWeekCard key={team.id} team={team} gw={totw.gw} size={many ? 'md' : 'lg'} />)}
        </div>

        <div className="mt-4 pt-3 border-t border-amber-500/20 flex flex-wrap gap-x-6 gap-y-1 text-xs text-dim">
          {many && <span className="text-amber-300 font-semibold">Shared by {totw.winners.length} teams</span>}
          {totw.nextBest !== null && <span>{totw.winners[0].points - totw.nextBest} clear of the rest</span>}
          <span>League average {totw.average}</span>
        </div>
      </div>
    </section>
  );
}

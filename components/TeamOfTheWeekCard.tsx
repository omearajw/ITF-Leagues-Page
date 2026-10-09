import Link from 'next/link';
import TeamName from '@/components/TeamName';
import type { TotwTeam, TeamOfTheWeek } from '@/lib/team-of-the-week';

// One winner, sized for the hub band or the full page: the team, its manager and the week's facts
// on the left, finishing level with the bottom of the red score plate on the right.
export default function TeamOfTheWeekCard({ team, gw, size = 'lg', href, facts }: { team: TotwTeam; gw: number; size?: 'md' | 'lg'; href?: string; facts?: React.ReactNode }) {
  const big = size === 'lg';

  return (
    <Link
      href={href ?? `/manager/${team.id}?gw=${gw}`}
      className="group flex items-end justify-between gap-x-6 gap-y-4 min-w-0"
    >
      <div className="min-w-0">
        <TeamName
          name={team.teamName}
          inline
          showStars
          starSize={big ? 14 : 11}
          className={`gap-2 font-display leading-display tracking-[0.01em] text-ink group-hover:text-brand-2 transition-colors ${big ? 'text-4xl sm:text-6xl' : 'text-3xl sm:text-4xl'}`}
        />
        <div className="text-sm text-dim truncate mt-1">{team.realName} · {team.division}</div>
        {facts && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-dim">{facts}</div>}
      </div>
      <div className={`plate flex-col shrink-0 bg-brand text-white ${big ? 'px-4 py-3' : 'px-3 py-2'}`}>
        <span className={`font-display ${big ? 'text-6xl sm:text-7xl' : 'text-5xl'}`}>{team.points}</span>
        <span className="label text-white/85 mt-1">Points</span>
      </div>
    </Link>
  );
}

// How far the top score finished clear of the next best, the league's average and FPL's global
// average (left out until FPL publishes it). `bench` adds the points left on the bench.
export function TotwFacts({ totw, globalAverage, bench = false }: { totw: TeamOfTheWeek; globalAverage?: number | null; bench?: boolean }) {
  const top = totw.winners[0].points;
  const gap = (diff: number, of: string) => (
    <span>
      <b className="text-ink-2 tabular">{Math.abs(diff)}</b> {diff >= 0 ? 'clear of' : 'below'} {of}
    </span>
  );
  return (
    <>
      {totw.nextBest !== null && gap(top - totw.nextBest, 'the rest')}
      {gap(top - totw.average, 'the ITF average')}
      {globalAverage ? gap(top - globalAverage, 'the global average') : null}
      {bench && <span>Left on the bench <b className="text-ink-2 tabular">{totw.winners.map(w => w.benchPoints).join(' / ')}</b></span>}
    </>
  );
}

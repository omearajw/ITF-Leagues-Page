import Link from 'next/link';
import TeamName from '@/components/TeamName';
import TeamBadge from '@/components/TeamBadge';
import { getLeagueBadges } from '@/lib/badges';
import type { TotwTeam } from '@/lib/team-of-the-week';

// One winner, sized for the hub band or the full page: badge, team, and the score as a
// condensed headline figure.
export default async function TeamOfTheWeekCard({ team, gw, size = 'lg', href }: { team: TotwTeam; gw: number; size?: 'md' | 'lg'; href?: string }) {
  const badges = await getLeagueBadges();
  const badge = badges[team.id];
  const big = size === 'lg';

  return (
    <Link
      href={href ?? `/manager/${team.id}?gw=${gw}`}
      className="group flex items-center gap-4 sm:gap-8 min-w-0 py-2"
    >
      {badge && <TeamBadge src={badge} size={big ? 64 : 48} className="shrink-0" />}
      <div className="min-w-0">
        <TeamName
          name={team.teamName}
          inline
          hideBadge
          showStars
          starSize={big ? 14 : 11}
          className={`gap-2 font-display leading-display tracking-[0.01em] text-ink group-hover:text-brand-2 transition-colors ${big ? 'text-4xl sm:text-6xl' : 'text-3xl sm:text-4xl'}`}
        />
        <div className="text-sm text-dim truncate mt-1">{team.realName} · {team.division}</div>
      </div>
      <div className="text-right shrink-0 ml-auto sm:ml-0">
        <div className={`font-display leading-none text-ink tabular ${big ? 'text-6xl sm:text-7xl' : 'text-5xl'}`}>{team.points}</div>
        <div className="label mt-1">Points</div>
      </div>
    </Link>
  );
}

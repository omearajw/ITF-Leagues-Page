import Link from 'next/link';
import TeamName from '@/components/TeamName';
import TeamBadge from '@/components/TeamBadge';
import { getLeagueBadges } from '@/lib/badges';
import type { TotwTeam } from '@/lib/team-of-the-week';

// One winner, sized for the hub band or the full page: the team on the left, then the week's
// facts and the score on a red plate at the right, so the row is held at both ends.
export default async function TeamOfTheWeekCard({ team, gw, size = 'lg', href, facts }: { team: TotwTeam; gw: number; size?: 'md' | 'lg'; href?: string; facts?: React.ReactNode }) {
  const badges = await getLeagueBadges();
  const badge = badges[team.id];
  const big = size === 'lg';

  return (
    <Link
      href={href ?? `/manager/${team.id}?gw=${gw}`}
      className="group flex flex-wrap items-center gap-x-6 gap-y-4 min-w-0"
    >
      <div className="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
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
      </div>
      {facts && <div className="order-last w-full sm:order-none sm:w-auto flex flex-wrap sm:flex-col sm:items-end gap-x-5 gap-y-1 text-sm text-dim">{facts}</div>}
      <div className={`plate flex-col shrink-0 bg-brand text-white ${big ? 'px-4 py-3' : 'px-3 py-2'}`}>
        <span className={`font-display ${big ? 'text-6xl sm:text-7xl' : 'text-5xl'}`}>{team.points}</span>
        <span className="label text-white/85 mt-1">Points</span>
      </div>
    </Link>
  );
}

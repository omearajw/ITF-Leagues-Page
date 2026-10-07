import Link from 'next/link';
import TeamName from '@/components/TeamName';
import TeamBadge from '@/components/TeamBadge';
import { getLeagueBadges } from '@/lib/badges';
import type { TotwTeam } from '@/lib/team-of-the-week';

// One winner, sized for the hub band or the full page.
export default async function TeamOfTheWeekCard({ team, gw, size = 'lg', href }: { team: TotwTeam; gw: number; size?: 'md' | 'lg'; href?: string }) {
  const badges = await getLeagueBadges();
  const badge = badges[team.id];
  const big = size === 'lg';

  return (
    <Link
      href={href ?? `/manager/${team.id}?gw=${gw}`}
      className="group flex items-center gap-4 sm:gap-5 min-w-0 rounded-xl p-3 -m-3 hover:bg-amber-400/5 transition"
    >
      {badge && <TeamBadge src={badge} size={big ? 64 : 48} className="rounded-lg shrink-0" />}
      <div className="min-w-0 flex-1">
        <TeamName
          name={team.teamName}
          inline
          hideBadge
          showStars
          starSize={big ? 14 : 11}
          className={`text-ink group-hover:text-amber-200 transition ${big ? 'text-2xl sm:text-3xl' : 'text-xl'}`}
        />
        <div className="text-sm text-dim truncate">{team.realName} · {team.division}</div>
      </div>
      <div className="text-right shrink-0">
        <div className={`font-black leading-none text-amber-300 ${big ? 'text-4xl sm:text-5xl' : 'text-3xl'}`}>{team.points}</div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-faint mt-1">Points</div>
      </div>
    </Link>
  );
}

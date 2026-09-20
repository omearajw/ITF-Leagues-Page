import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';
import Link from 'next/link';
import TeamBadge from '@/components/TeamBadge';
import { getLeagueBadges } from '@/lib/badges';

type TeamNameProps = {
  name?: string | null;
  className?: string;
  inline?: boolean;
  starSize?: number;
  managerId?: number | string | null;
  badgeSize?: number;
  hideBadge?: boolean;
  showStars?: boolean;
  noLink?: boolean;
};

function parseTeamName(name: string) {
  const starCount = (name.match(/\*/g) || []).length;
  const cleanName = name.replace(/\*/g, '');

  return { cleanName, starCount };
}

// Some managers put stars in their team name. They only show on the team's own page.
export function getTeamNameDisplayText(name?: string | null, showStars = false) {
  if (!name) return '';

  const { cleanName, starCount } = parseTeamName(name);
  return showStars && starCount > 0 ? `${cleanName} ${'★'.repeat(starCount)}` : cleanName;
}

export default async function TeamName({ name, className, inline = false, starSize = 8, managerId, badgeSize = 18, hideBadge = false, showStars = false, noLink = false }: TeamNameProps) {
  if (!name) return null;

  const { cleanName, starCount } = parseTeamName(name);
  const badges = managerId && !hideBadge ? await getLeagueBadges() : null;
  const badge = badges ? badges[Number(managerId)] : null;

  // The root is a flex container, so text-overflow on it never shows an ellipsis;
  // the inner span does the truncating when the caller constrains the width.
  const body = (
    <span className={cn(inline ? 'inline-flex items-center gap-1 min-w-0 max-w-full' : 'inline-flex flex-col min-w-0 max-w-full', className)}>
      {badge && inline && <TeamBadge src={badge} size={badgeSize} className="mr-0.5" />}
      <span className="font-bold text-current leading-tight min-w-0 truncate">{cleanName}</span>
      {showStars && starCount > 0 && (
        <span
          className={cn('flex text-current', inline ? 'items-center gap-0.5' : 'mt-0.5 gap-0.5')}
          aria-hidden="true"
        >
          {Array.from({ length: starCount }).map((_, i) => (
            <Star key={i} size={starSize} className="fill-current text-current" />
          ))}
        </span>
      )}
    </span>
  );

  if (!managerId || noLink) return body;
  return (
    <Link href={`/manager/${managerId}`} className="min-w-0 max-w-full hover:underline decoration-brand-2/60 underline-offset-2">
      {body}
    </Link>
  );
}
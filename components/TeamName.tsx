import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';
import Link from 'next/link';

type TeamNameProps = {
  name?: string | null;
  className?: string;
  inline?: boolean;
  starSize?: number;
  managerId?: number | string | null;
  showStars?: boolean;
  noLink?: boolean;
  wrap?: boolean;
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

// Badges only appear on a team's own page (app/(site)/manager/[id]), not beside names elsewhere.
export default function TeamName({ name, className, inline = false, starSize = 8, managerId, showStars = false, noLink = false, wrap = false }: TeamNameProps) {
  if (!name) return null;

  const { cleanName, starCount } = parseTeamName(name);

  const stars = showStars && starCount > 0 && (
    <span
      className={cn('flex text-current', inline ? 'items-center gap-0.5' : 'mt-0.5 gap-0.5')}
      aria-hidden="true"
    >
      {Array.from({ length: starCount }).map((_, i) => (
        <Star key={i} size={starSize} className="fill-current text-current" />
      ))}
    </span>
  );

  // The root is a flex container, so text-overflow on it never shows an ellipsis;
  // the inner span does the truncating when the caller constrains the width. Headings pass
  // wrap so a long name takes a second line (at the heading's own line height) instead.
  const body = (
    <span className={cn(inline ? 'inline-flex items-center gap-1 min-w-0 max-w-full' : 'inline-flex flex-col min-w-0 max-w-full', className)}>
      <span className={cn('font-bold text-current min-w-0', wrap ? 'break-words' : 'leading-tight truncate')}>
        {cleanName}
        {/* A wrapped name keeps its stars after the last word rather than beside the whole block. */}
        {wrap && stars && <span className="inline-flex align-middle ml-[0.25em] -translate-y-[0.08em]">{stars}</span>}
      </span>
      {!wrap && stars}
    </span>
  );

  if (!managerId || noLink) return body;
  return (
    <Link href={`/manager/${managerId}`} className="min-w-0 max-w-full hover:underline decoration-brand-2/60 underline-offset-2">
      {body}
    </Link>
  );
}
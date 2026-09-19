import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';
import Link from 'next/link';

type TeamNameProps = {
  name?: string | null;
  className?: string;
  inline?: boolean;
  starSize?: number;
  managerId?: number | string | null;
};

function parseTeamName(name: string) {
  const starCount = (name.match(/\*/g) || []).length;
  const cleanName = name.replace(/\*/g, '');

  return { cleanName, starCount };
}

export function getTeamNameDisplayText(name?: string | null) {
  if (!name) return '';

  const { cleanName, starCount } = parseTeamName(name);
  return starCount > 0 ? `${cleanName} ${'★'.repeat(starCount)}` : cleanName;
}

export default function TeamName({ name, className, inline = false, starSize = 8, managerId }: TeamNameProps) {
  if (!name) return null;

  const { cleanName, starCount } = parseTeamName(name);

  // The root is a flex container, so text-overflow on it never shows an ellipsis;
  // the inner span does the truncating when the caller constrains the width.
  const body = (
    <span className={cn(inline ? 'inline-flex items-center gap-1 min-w-0 max-w-full' : 'inline-flex flex-col min-w-0 max-w-full', className)}>
      <span className="font-bold text-current leading-tight min-w-0 truncate">{cleanName}</span>
      {starCount > 0 && (
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

  if (!managerId) return body;
  return (
    <Link href={`/manager/${managerId}`} className="min-w-0 max-w-full hover:underline decoration-brand-2/60 underline-offset-2">
      {body}
    </Link>
  );
}
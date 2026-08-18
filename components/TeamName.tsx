import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

type TeamNameProps = {
  name?: string | null;
  className?: string;
  inline?: boolean;
  starSize?: number;
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

export default function TeamName({ name, className, inline = false, starSize = 6 }: TeamNameProps) {
  if (!name) return null;

  const { cleanName, starCount } = parseTeamName(name);

  return (
    <span className={cn(inline ? 'inline-flex items-center gap-1' : 'inline-flex flex-col', className)}>
      <span className="font-bold text-current leading-tight">{cleanName}</span>
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
}
import type { WeekDue } from '@/lib/projection';

// Marker for a live score that already includes certain auto-subs; "incl." makes clear the
// points are counted in the score, not to be added to it. Subs that might still happen are left
// out. `compact` sets it small and tight enough to sit under a score box without making the row
// taller.
export default function DueMark({ due, className = '', compact = false }: { due: WeekDue | null | undefined; className?: string; compact?: boolean }) {
  if (!due || due.due === 0) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 align-middle font-sans font-bold normal-case tracking-normal ${compact ? 'text-[11px] leading-none' : 'text-xs'} ${className}`}>
      <span className="text-live-2" title={`The score includes ${due.due} due from the bench`}>incl. +{due.due}</span>
    </span>
  );
}

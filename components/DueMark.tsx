import type { WeekDue } from '@/lib/projection';

// Small marker beside a live score that includes projected auto-subs.
export default function DueMark({ due, className = '' }: { due: WeekDue | null | undefined; className?: string }) {
  if (!due || (due.due === 0 && due.undecided === 0)) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 align-middle text-[10px] font-bold ${className}`}>
      {due.due > 0 && <span className="text-amber-300" title={`Includes ${due.due} due from the bench`}>+{due.due}</span>}
      {due.undecided > 0 && <span className="text-amber-300/80" title={`${due.undecided} substitution still to settle`}>?</span>}
    </span>
  );
}

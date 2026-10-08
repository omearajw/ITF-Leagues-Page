export default function MovementArrow({ delta, className = '' }: { delta: number | null | undefined; className?: string }) {
  // Nothing is drawn for a team that has not moved; only changes are worth marking.
  if (!delta) return null;
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-bold tabular ${up ? 'text-win-2' : 'text-loss-2'} ${className}`}
      title={`${up ? 'Up' : 'Down'} ${Math.abs(delta)} place${Math.abs(delta) === 1 ? '' : 's'} since last gameweek`}
    >
      {up ? '▲' : '▼'}{Math.abs(delta)}
    </span>
  );
}

// Marks a team that has just entered a top-N list; shown in place of its arrow.
export function NewEntryMark({ className = '' }: { className?: string }) {
  return (
    <span className={`text-xs font-bold tracking-wide text-brand-2 ${className}`} title="New to the top ten since last gameweek">NEW</span>
  );
}

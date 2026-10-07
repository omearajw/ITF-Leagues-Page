export default function MovementArrow({ delta, className = '' }: { delta: number | null | undefined; className?: string }) {
  // Nothing is drawn for a team that has not moved; only changes are worth marking.
  if (!delta) return null;
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${up ? 'text-green-400' : 'text-red-500'} ${className}`}
      title={`${up ? 'Up' : 'Down'} ${Math.abs(delta)} place${Math.abs(delta) === 1 ? '' : 's'} since last gameweek`}
    >
      {up ? '▲' : '▼'}{Math.abs(delta)}
    </span>
  );
}

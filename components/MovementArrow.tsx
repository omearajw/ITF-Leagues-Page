export default function MovementArrow({ delta, className = '' }: { delta: number | null | undefined; className?: string }) {
  if (delta === null || delta === undefined) return null;
  if (delta === 0) return <span className={`text-[10px] font-bold text-faint ${className}`} title="No change">–</span>;
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

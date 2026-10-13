import Link from 'next/link';
import { getTeamNameDisplayText } from '@/components/TeamName';
import DueMark from '@/components/DueMark';
import type { WeekDue } from '@/lib/projection';

export type OpenRow = {
  id: number;
  manager: string;
  team: string;
  division: string;
  week: number;
  total: number;
  due: WeekDue | null;
  mark: React.ReactNode;
};

// The Open's table, shared by its own page and the hub's top ten so the two always match. The
// Open is the race for manager of the season, so the manager leads and the team follows. Scores
// and totals already include any subs due (`week` and `total`); the mark shows once, under the
// week's score (hanging below it without moving it, so figures stay level).
export default function OpenTable({ rows, scoresGw, live }: { rows: OpenRow[]; scoresGw: number; live: boolean }) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b-2 border-ink/80">
          <th className="py-2 pr-1 w-9"><span className="sr-only">Position</span></th>
          <th className="w-11 pr-2"><span className="sr-only">Movement</span></th>
          <th className="label font-semibold py-2 pr-3">Manager</th>
          <th className="label font-semibold py-2 pr-3 hidden md:table-cell">Division</th>
          <th className="label font-semibold py-2 px-2 text-right">GW{scoresGw}</th>
          <th className="label font-semibold py-2 px-3 text-right text-ink key-col">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((row, index) => (
          <tr key={row.id} className="hover:bg-surface">
            <td className="py-3 pr-1 font-display text-2xl leading-none text-faint">{index + 1}</td>
            <td className="py-3 pr-2 whitespace-nowrap">{row.mark}</td>
            <td className="py-3 pr-3 min-w-0">
              <Link href={`/manager/${row.id}`} className="font-semibold text-ink hover:underline decoration-brand-2/60 underline-offset-2">{row.manager}</Link>
              <div className="text-dim">{getTeamNameDisplayText(row.team)}<span className="md:hidden"> · {row.division}</span></div>
            </td>
            <td className="py-3 pr-3 text-dim hidden md:table-cell">{row.division}</td>
            <td className={`py-3 px-2 text-right font-semibold whitespace-nowrap ${live ? 'text-live-2' : 'text-ink-2'}`}>
              <span className="relative inline-block">{row.week}<DueMark due={row.due} compact className="absolute right-0 top-full mt-0.5" /></span>
            </td>
            <td className="py-3 px-3 text-right whitespace-nowrap key-col">
              <span className="font-display text-3xl leading-none text-ink">{row.total}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

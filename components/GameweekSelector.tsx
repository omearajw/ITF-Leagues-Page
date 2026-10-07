'use client';

import Link from 'next/link';
import { useState } from 'react';

const PAGE = 5;

// Five weeks at a time, with arrows paging the window by five. Selecting a week is a
// link, so the page re-renders server-side with that week's data.
export default function GameweekSelector({ basePath, latestGw, selected, liveGw }: { basePath: string; latestGw: number; selected: number; liveGw?: number | null }) {
  const maxStart = Math.max(1, latestGw - PAGE + 1);
  const [start, setStart] = useState(Math.min(maxStart, Math.max(1, Math.floor((selected - 1) / PAGE) * PAGE + 1)));
  const visible = Array.from({ length: Math.min(PAGE, latestGw - start + 1) }, (_, i) => start + i);
  const atStart = start <= 1;
  const atEnd = start >= maxStart;

  const arrow = 'shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-line text-dim enabled:hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
      <button type="button" onClick={() => setStart(s => Math.max(1, s - PAGE))} disabled={atStart} aria-label="Earlier gameweeks" className={arrow}>‹</button>
      <div className="flex gap-1 sm:gap-1.5">
        {visible.map(week => (
          <Link
            key={week}
            href={week === latestGw ? basePath : `${basePath}?gw=${week}`}
            aria-current={week === selected ? 'page' : undefined}
            className={`shrink-0 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap ${week === selected ? 'bg-brand text-white border-brand' : 'bg-surface border-line text-dim hover:text-ink'}`}
          >
            GW{week}{week === liveGw ? ' ·' : ''}
          </Link>
        ))}
      </div>
      <button type="button" onClick={() => setStart(s => Math.min(maxStart, s + PAGE))} disabled={atEnd} aria-label="Later gameweeks" className={arrow}>›</button>
      {selected !== latestGw && (
        <Link href={basePath} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border border-brand-2/40 bg-brand-2/10 text-brand-2 hover:bg-brand-2/20 whitespace-nowrap">
          Back to GW{latestGw}
        </Link>
      )}
    </div>
  );
}

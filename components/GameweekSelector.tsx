'use client';

import Link from 'next/link';
import { useState } from 'react';

const PAGE = 5;

// Five weeks at a time, with arrows paging the window by five. Selecting a week is a
// link, so the page re-renders server-side with that week's data. `latestGw` is the last week
// offered (it can be a live week); `defaultGw` is the one the bare address shows, if different.
export default function GameweekSelector({ basePath, latestGw, defaultGw = latestGw, selected, liveGw }: { basePath: string; latestGw: number; defaultGw?: number; selected: number; liveGw?: number | null }) {
  const maxStart = Math.max(1, latestGw - PAGE + 1);
  // Open on the newest weeks when the selected one is among them, so a live week sits beside the
  // finished week shown by default; an older selected week opens on its own window instead.
  const [start, setStart] = useState(Math.max(1, Math.min(selected, maxStart)));
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
            href={week === defaultGw ? basePath : `${basePath}?gw=${week}`}
            aria-current={week === selected ? 'page' : undefined}
            className={`shrink-0 inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap ${week === selected ? 'bg-brand text-white border-brand' : 'bg-surface border-line text-dim hover:text-ink'}`}
          >
            GW{week}
            {week === liveGw && <><span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" aria-hidden="true" /><span className="sr-only sm:not-sr-only">Live</span></>}
          </Link>
        ))}
      </div>
      <button type="button" onClick={() => setStart(s => Math.min(maxStart, s + PAGE))} disabled={atEnd} aria-label="Later gameweeks" className={arrow}>›</button>
      {selected !== defaultGw && (
        <Link href={basePath} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border border-brand-2/40 bg-brand-2/10 text-brand-2 hover:bg-brand-2/20 whitespace-nowrap">
          Back to GW{defaultGw}
        </Link>
      )}
    </div>
  );
}
